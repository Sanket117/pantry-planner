import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { PlanEntry, Recipe } from '../../db/types'

export interface WeekCell {
  date: string
  slot: PlanEntry['slot']
  entry: PlanEntry | null
  recipe: Recipe | null
}

const SLOTS: PlanEntry['slot'][] = ['breakfast', 'lunch', 'dinner']

export function useWeekEntries(weekDates: string[]): WeekCell[] | undefined {
  return useLiveQuery(async () => {
    const entries = await db.plan_entries.where('date').anyOf(weekDates).toArray()
    const recipes = await db.recipes.bulkGet(entries.map((e) => e.recipe_id))
    const recipeById = new Map(recipes.filter((r): r is Recipe => Boolean(r)).map((r) => [r.id, r]))
    const entryByKey = new Map(entries.map((e) => [`${e.date}|${e.slot}`, e]))

    const cells: WeekCell[] = []
    for (const date of weekDates) {
      for (const slot of SLOTS) {
        const entry = entryByKey.get(`${date}|${slot}`) ?? null
        cells.push({ date, slot, entry, recipe: entry ? (recipeById.get(entry.recipe_id) ?? null) : null })
      }
    }
    return cells
  }, [weekDates.join(',')])
}
