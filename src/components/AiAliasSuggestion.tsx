import { useEffect, useState } from 'react'
import type { Tier, Unit } from '../db/types'
import { suggestAliasMapping, type AliasSuggestion } from '../lib/aliasSuggestion'
import { hasAnyApiKey } from '../lib/llm'

interface AiAliasSuggestionProps {
  token: string
  onConfirmExisting: (ingredientId: string) => void
  onConfirmNew: (canonicalName: string, tier: Tier, unit: Unit) => void
}

type State = 'unavailable' | 'idle' | 'loading' | 'none' | AliasSuggestion

/**
 * SPEC.md §13's alias-resolution use case, wired into the same unresolved-
 * token screens the manual flow already shows. A suggestion is only ever
 * a proposal — nothing is written until the user taps Confirm here, which
 * hands off to the exact same code path the manual buttons use.
 */
export function AiAliasSuggestion({ token, onConfirmExisting, onConfirmNew }: AiAliasSuggestionProps) {
  const [state, setState] = useState<State>('unavailable')

  useEffect(() => {
    let cancelled = false
    hasAnyApiKey().then((has) => {
      if (!cancelled) setState(has ? 'idle' : 'unavailable')
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function ask() {
    setState('loading')
    const result = await suggestAliasMapping(token)
    setState(result ?? 'none')
  }

  if (state === 'unavailable') return null

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={ask}
        className="rounded-md border border-dashed border-stone-300 py-2 text-sm text-stone-500"
      >
        ✨ Ask AI to suggest a match
      </button>
    )
  }

  if (state === 'loading') {
    return <p className="text-center text-sm text-stone-400">Asking AI…</p>
  }

  if (state === 'none') {
    return <p className="text-center text-sm text-stone-400">AI assist unavailable — pick manually below.</p>
  }

  if (state.type === 'existing') {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-green-800 bg-green-50 p-3 text-sm">
        <p>
          AI suggests this is another name for <strong>{state.canonical_name}</strong>.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onConfirmExisting(state.ingredient_id)}
            className="flex-1 rounded-md bg-green-800 py-1.5 text-white"
          >
            Confirm
          </button>
          <button type="button" onClick={() => setState('none')} className="flex-1 rounded-md border border-stone-300 py-1.5 text-stone-600">
            Not this
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-green-800 bg-green-50 p-3 text-sm">
      <p>
        AI suggests creating <strong>{state.canonical_name}</strong> as a {state.tier} ({state.default_unit}).
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onConfirmNew(state.canonical_name, state.tier, state.default_unit)}
          className="flex-1 rounded-md bg-green-800 py-1.5 text-white"
        >
          Confirm
        </button>
        <button type="button" onClick={() => setState('none')} className="flex-1 rounded-md border border-stone-300 py-1.5 text-stone-600">
          Not this
        </button>
      </div>
    </div>
  )
}
