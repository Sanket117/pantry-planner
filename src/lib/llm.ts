import { getApiKeys } from './llmKeys'

const TIMEOUT_MS = 8000
const CLAUDE_MODEL = 'claude-sonnet-5'
const GROQ_MODEL = 'llama-3.1-8b-instant'

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Pulls the first JSON object/array out of a model response, tolerating ```json fences. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.search(/[[{]/)
  if (start === -1) throw new Error('no JSON found')
  return JSON.parse(candidate.slice(start))
}

async function callClaude(apiKey: string, prompt: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return null // covers 429/5xx — falls through to Groq
    const data = await res.json()
    return data?.content?.[0]?.text ?? null
  } catch {
    return null // timeout or network failure
  }
}

async function callGroq(apiKey: string, prompt: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.choices?.[0]?.message?.content ?? null
  } catch {
    return null
  }
}

/**
 * The single entry point for the SPEC.md §13 optional LLM layer: Claude,
 * then Groq, then null (the caller's manual path — never an error state).
 * `validate` is the schema check every response must pass before it reaches
 * the UI; a response that fails it is treated as a provider failure.
 */
export async function llmComplete<T>(prompt: string, validate: (raw: unknown) => T | null): Promise<T | null> {
  const keys = await getApiKeys()

  if (keys.anthropic) {
    const text = await callClaude(keys.anthropic, prompt)
    const result = tryValidate(text, validate)
    if (result) return result
  }

  if (keys.groq) {
    const text = await callGroq(keys.groq, prompt)
    const result = tryValidate(text, validate)
    if (result) return result
  }

  return null
}

function tryValidate<T>(text: string | null, validate: (raw: unknown) => T | null): T | null {
  if (!text) return null
  try {
    return validate(extractJson(text))
  } catch {
    return null
  }
}

export async function hasAnyApiKey(): Promise<boolean> {
  const keys = await getApiKeys()
  return Boolean(keys.anthropic || keys.groq)
}
