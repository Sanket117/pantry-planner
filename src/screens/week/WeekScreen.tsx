import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { MealSlot, PlanEntry } from '../../db/types'
import { formatDayLabel, isoDate, weekDatesFrom } from '../../lib/dates'
import { generateWeek, pickBestRecipe } from '../../lib/planner'
import { getSettings } from '../../lib/settings'
import { MEAL_SLOTS } from '../../lib/slots'
import { loadPlannerInputs } from './loadPlannerInputs'
import { useWeekEntries, type WeekCell } from './useWeekEntries'

export function WeekScreen() {
  const [weekStart] = useState(() => isoDate(new Date()))
  const weekDates = useMemo(() => weekDatesFrom(weekStart), [weekStart])
  const cells = useWeekEntries(weekDates)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [genSummary, setGenSummary] = useState<string | null>(null)

  const activeRecipeCount = useLiveQuery(
    async () => (await db.recipes.toArray()).filter((r) => r.active).length,
    [],
  )

  const hasAnyEntries = cells?.some((c) => c.entry) ?? false

  async function regenerate() {
    setBusy(true)
    setError(null)
    setGenSummary(null)
    try {
      const inputs = await loadPlannerInputs()

      if (inputs.activeRecipes.length === 0) {
        setGenSummary('No recipes yet. Add at least one in More → Recipes, then generate again.')
        return
      }

      const existing = await db.plan_entries.where('date').anyOf(weekDates).toArray()
      const pastEntries = await db.plan_entries.where('date').below(weekStart).toArray()
      const preservedEntries = existing.filter((e) => e.locked || e.status === 'cooked')

      const results = generateWeek({
        weekDates,
        recipes: inputs.activeRecipes,
        recipeIngredientsByRecipe: inputs.recipeIngredientsByRecipe,
        pantry: inputs.pantry,
        ingredients: inputs.ingredients,
        pastPlanEntries: pastEntries,
        preservedEntries,
        settings: getSettings(),
        newId: () => crypto.randomUUID(),
      })

      await db.transaction('rw', db.plan_entries, async () => {
        const toDelete = existing.filter((e) => !e.locked && e.status !== 'cooked').map((e) => e.id)
        if (toDelete.length) await db.plan_entries.bulkDelete(toDelete)
        const toPut = results.filter((r) => r.kind === 'assigned').map((r) => r.entry)
        if (toPut.length) await db.plan_entries.bulkPut(toPut)
      })

      const assignedCount = results.filter((r) => r.kind === 'assigned').length
      if (assignedCount === 0) {
        setGenSummary(
          `None of your ${inputs.activeRecipes.length} recipe(s) could be planned for any slot — check that ` +
            `their meal_slots/prep_min fit your Settings, and that your pantry actually covers their ` +
            `ingredients (min_coverage in Settings, default 70%).`,
        )
      } else if (assignedCount < results.length) {
        setGenSummary(`Planned ${assignedCount} of ${results.length} slots — the rest had nothing that fit in stock.`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong generating the plan.')
    } finally {
      setBusy(false)
    }
  }

  async function clearSlot(entry: PlanEntry) {
    try {
      await db.plan_entries.delete(entry.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not clear that slot.')
    }
  }

  async function toggleLock(entry: PlanEntry) {
    try {
      await db.plan_entries.update(entry.id, { locked: !entry.locked })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update that slot.')
    }
  }

  async function swapSlot(cell: WeekCell) {
    if (!cell.entry) return
    setBusy(true)
    setError(null)
    try {
      const inputs = await loadPlannerInputs()
      const pastEntries = await db.plan_entries.where('date').below(cell.date).toArray()
      const best = pickBestRecipe({
        recipes: inputs.activeRecipes,
        recipeIngredientsByRecipe: inputs.recipeIngredientsByRecipe,
        date: cell.date,
        slot: cell.slot,
        pantry: inputs.pantry,
        ingredients: inputs.ingredients,
        history: pastEntries,
        settings: getSettings(),
        exclude: [cell.entry.recipe_id],
      })
      if (best) {
        await db.plan_entries.update(cell.entry.id, { recipe_id: best.recipe.id })
      } else {
        setGenSummary('No other recipe fits this slot right now.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not swap that slot.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-stone-800">This week</h1>
        <button
          type="button"
          onClick={regenerate}
          disabled={busy}
          className="rounded-md bg-green-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Working…' : hasAnyEntries ? 'Regenerate' : 'Generate plan'}
        </button>
      </div>

      <p className="text-xs text-stone-400">
        Locked and already-cooked slots are kept as-is. Everything else is recomputed from what's actually in stock.
      </p>

      {activeRecipeCount === 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">No recipes yet.</p>
          <p className="mt-1 text-amber-700">
            The planner has nothing to choose from. Go to More → Recipes and paste in a few you actually cook, then
            come back and generate.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-500">
            Dismiss
          </button>
        </div>
      )}

      {genSummary && (
        <div className="flex items-start justify-between gap-2 rounded-md border border-stone-300 bg-stone-50 p-3 text-sm text-stone-600">
          <span>{genSummary}</span>
          <button type="button" onClick={() => setGenSummary(null)} className="text-stone-400">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {weekDates.map((date) => (
          <div key={date}>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
              {formatDayLabel(date)}
              {date === weekStart ? ' · today' : ''}
            </h2>
            <div className="flex flex-col divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
              {MEAL_SLOTS.map((slot) => {
                const cell = cells?.find((c) => c.date === date && c.slot === slot)
                return (
                  <SlotRow
                    key={slot}
                    slot={slot}
                    cell={cell}
                    busy={busy}
                    onClear={() => cell?.entry && clearSlot(cell.entry)}
                    onLock={() => cell?.entry && toggleLock(cell.entry)}
                    onSwap={() => cell && swapSlot(cell)}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SlotRow({
  slot,
  cell,
  busy,
  onClear,
  onLock,
  onSwap,
}: {
  slot: MealSlot
  cell: WeekCell | undefined
  busy: boolean
  onClear: () => void
  onLock: () => void
  onSwap: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs capitalize text-stone-400">{slot}</p>
        {cell?.recipe ? (
          <p className="truncate text-sm text-stone-800">
            {cell.recipe.name}
            {cell.entry?.status === 'cooked' ? ' ✓' : ''}
          </p>
        ) : (
          <p className="text-sm text-stone-400">
            {cell?.entry ? cell.entry.recipe_id : cell === undefined ? '…' : 'Nothing in stock'}
          </p>
        )}
      </div>
      {cell?.entry && cell.entry.status !== 'cooked' && (
        <div className="flex gap-1 text-xs">
          <button type="button" disabled={busy} onClick={onSwap} className="rounded border border-stone-300 px-2 py-1">
            Swap
          </button>
          <button
            type="button"
            onClick={onLock}
            className={`rounded border px-2 py-1 ${cell.entry.locked ? 'border-green-800 text-green-800' : 'border-stone-300 text-stone-500'}`}
          >
            {cell.entry.locked ? 'Locked' : 'Lock'}
          </button>
          <button type="button" onClick={onClear} className="rounded border border-stone-300 px-2 py-1 text-stone-500">
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
