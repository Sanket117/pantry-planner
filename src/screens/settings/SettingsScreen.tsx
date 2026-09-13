import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, setSettings, useSettings } from '../../lib/settings'
import { getApiKeys, setApiKeys } from '../../lib/llmKeys'

export function SettingsScreen() {
  const settings = useSettings()
  const [keys, setKeys] = useState({ anthropic: '', groq: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getApiKeys().then(setKeys)
  }, [])

  async function saveKeys() {
    await setApiKeys(keys)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-stone-800">Settings</h1>

      <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Prep-time ceiling (minutes)</h2>
        {(['breakfast', 'lunch', 'dinner'] as const).map((slot) => (
          <label key={slot} className="flex items-center justify-between text-sm text-stone-600">
            <span className="capitalize">{slot}</span>
            <input
              type="number"
              min="0"
              value={settings.prep_ceiling[slot]}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  prep_ceiling: { ...settings.prep_ceiling, [slot]: Number(e.target.value) || 0 },
                })
              }
              className="w-20 rounded-md border border-stone-300 px-2 py-1"
            />
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3">
        <label className="flex items-center justify-between text-sm text-stone-600">
          <span>Minimum coverage to plan a recipe</span>
          <input
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={settings.min_coverage}
            onChange={(e) => setSettings({ ...settings, min_coverage: Number(e.target.value) })}
            className="w-20 rounded-md border border-stone-300 px-2 py-1"
          />
        </label>
        <label className="flex items-center justify-between text-sm text-stone-600">
          <span>Staple uses before "low"</span>
          <input
            type="number"
            min="1"
            value={settings.staple_low_threshold}
            onChange={(e) => setSettings({ ...settings, staple_low_threshold: Number(e.target.value) || 1 })}
            className="w-20 rounded-md border border-stone-300 px-2 py-1"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => setSettings(DEFAULT_SETTINGS)}
        className="rounded-md border border-stone-300 py-2 text-sm text-stone-600"
      >
        Reset to defaults
      </button>

      <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">AI assist (optional)</h2>
          <p className="mt-1 text-xs text-stone-400">
            Everything in this app works fully offline without these. Keys only add AI-suggested ingredient matches
            and recipe parsing — you always confirm before anything is saved. Stored on this device only.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm text-stone-600">
          Anthropic API key
          <input
            type="password"
            value={keys.anthropic}
            onChange={(e) => setKeys({ ...keys, anthropic: e.target.value })}
            placeholder="sk-ant-..."
            className="rounded-md border border-stone-300 px-3 py-2 font-mono text-xs"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-stone-600">
          Groq API key
          <input
            type="password"
            value={keys.groq}
            onChange={(e) => setKeys({ ...keys, groq: e.target.value })}
            placeholder="gsk_..."
            className="rounded-md border border-stone-300 px-3 py-2 font-mono text-xs"
          />
        </label>
        <button type="button" onClick={saveKeys} className="rounded-md bg-green-800 py-2 text-sm text-white">
          {saved ? 'Saved' : 'Save keys'}
        </button>
      </div>
    </div>
  )
}
