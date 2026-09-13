import { useMemo, useState } from 'react'
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

  const hasAnyEntries = cells?.some((c) => c.entry) ?? false

  async function regenerate() {
    setBusy(true)
    try {
      const inputs = await loadPlannerInputs()
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
    } finally {
      setBusy(false)
    }
  }

  async function clearSlot(entry: PlanEntry) {
    await db.plan_entries.delete(entry.id)
  }

  async function toggleLock(entry: PlanEntry) {
    await db.plan_entries.update(entry.id, { locked: !entry.locked })
  }

  async function swapSlot(cell: WeekCell) {
    if (!cell.entry) return
    setBusy(true)
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
      }
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
          {hasAnyEntries ? 'Regenerate' : 'Generate plan'}
        </button>
      </div>

      <p className="text-xs text-stone-400">
        Locked and already-cooked slots are kept as-is. Everything else is recomputed from what's actually in stock.
      </p>

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
