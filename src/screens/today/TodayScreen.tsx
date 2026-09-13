import { useState } from 'react'
import { db } from '../../db/db'
import type { PlanEntry, Recipe } from '../../db/types'
import { isoDate } from '../../lib/dates'
import { undoCook } from '../../lib/cook'
import { useWeekEntries, type WeekCell } from '../week/useWeekEntries'
import { CookSheet } from './CookSheet'
import { StepsSheet } from './StepsSheet'

export function TodayScreen() {
  const today = isoDate(new Date())
  const cells = useWeekEntries([today])
  const [viewingSteps, setViewingSteps] = useState<Recipe | null>(null)
  const [cooking, setCooking] = useState<{ entry: PlanEntry; recipe: Recipe } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function undo(entry: PlanEntry) {
    setError(null)
    try {
      const log = await db.cook_log.where('plan_entry_id').equals(entry.id).first()
      if (!log) {
        setError("Couldn't find the record of that cook — nothing to undo.")
        return
      }
      await undoCook(log.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not undo that.')
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-stone-800">Today</h1>

      {error && (
        <div className="flex items-start justify-between gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-500">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
        {cells?.map((cell) => (
          <TodayRow
            key={cell.slot}
            cell={cell}
            onViewSteps={() => cell.recipe && setViewingSteps(cell.recipe)}
            onCook={() => cell.entry && cell.recipe && setCooking({ entry: cell.entry, recipe: cell.recipe })}
            onUndo={() => cell.entry && undo(cell.entry)}
          />
        ))}
      </div>

      {viewingSteps && <StepsSheet recipe={viewingSteps} onClose={() => setViewingSteps(null)} />}
      {cooking && <CookSheet entry={cooking.entry} recipe={cooking.recipe} onClose={() => setCooking(null)} />}
    </div>
  )
}

function TodayRow({
  cell,
  onViewSteps,
  onCook,
  onUndo,
}: {
  cell: WeekCell
  onViewSteps: () => void
  onCook: () => void
  onUndo: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs capitalize text-stone-400">{cell.slot}</p>
        {cell.recipe ? (
          <button type="button" onClick={onViewSteps} className="truncate text-left text-sm text-stone-800 underline">
            {cell.recipe.name} · {cell.recipe.prep_min} min
          </button>
        ) : (
          <p className="text-sm text-stone-400">Nothing planned</p>
        )}
      </div>
      {cell.entry?.status === 'planned' && (
        <button type="button" onClick={onCook} className="rounded-md bg-green-800 px-3 py-1.5 text-sm text-white">
          Cooked
        </button>
      )}
      {cell.entry?.status === 'cooked' && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-green-700">✓ cooked</span>
          <button type="button" onClick={onUndo} className="text-xs text-stone-400 underline">
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
