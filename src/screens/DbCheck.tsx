import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

const TABLES = ['ingredients', 'pantry', 'recipes', 'recipe_ingredients', 'plan_entries', 'cook_log'] as const

// Manual verification aid for the Phase 1 acceptance criterion: write a probe
// row, force-quit/reload the tab, and confirm the counter survived.
export function DbCheck() {
  const counts = useLiveQuery(async () => {
    const entries = await Promise.all(TABLES.map(async (t) => [t, await db.table(t).count()] as const))
    return Object.fromEntries(entries) as Record<(typeof TABLES)[number], number>
  }, [])

  const pings = useLiveQuery(() => db.table('ingredients').where('id').startsWith('__ping__').count(), [])

  async function addPing() {
    const id = `__ping__${crypto.randomUUID()}`
    await db.ingredients.add({
      id,
      canonical_name: id,
      aliases: [],
      tier: 'staple',
      default_unit: 'g',
      kcal_per_100g: null,
      protein_g: null,
      carb_g: null,
      fat_g: null,
    })
  }

  async function clearPings() {
    const rows = await db.ingredients.where('id').startsWith('__ping__').primaryKeys()
    await db.ingredients.bulkDelete(rows)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-stone-800">Database status</h1>
      <div className="rounded-lg border border-stone-200 bg-white p-3 text-sm text-stone-600">
        {counts
          ? TABLES.map((t) => (
              <div key={t} className="flex justify-between py-0.5">
                <span>{t}</span>
                <span className="font-mono">{counts[t]}</span>
              </div>
            ))
          : 'Loading…'}
      </div>
      <div className="rounded-lg border border-stone-200 bg-white p-3 text-sm text-stone-600">
        <p className="mb-2">
          Persistence probe rows: <span className="font-mono">{pings ?? '…'}</span>
        </p>
        <p className="mb-3 text-xs text-stone-400">
          Add a probe, then force-quit and reopen the app. The count should survive.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addPing}
            className="rounded-md bg-green-800 px-3 py-1.5 text-white active:bg-green-900"
          >
            Add probe
          </button>
          <button
            type="button"
            onClick={clearPings}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-stone-600 active:bg-stone-100"
          >
            Clear probes
          </button>
        </div>
      </div>
    </div>
  )
}
