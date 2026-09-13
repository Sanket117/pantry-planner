import { DEFAULT_SETTINGS, setSettings, useSettings } from '../../lib/settings'

export function SettingsScreen() {
  const settings = useSettings()

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
    </div>
  )
}
