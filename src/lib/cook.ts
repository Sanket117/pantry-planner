import { db } from '../db/db'
import type { CookLogDeduction, StapleState } from '../db/types'
import { getSettings } from './settings'

export interface CookResult {
  cookLogId: string
  shortfalls: string[]
}

/**
 * Mark a plan entry cooked and decrement the pantry per SPEC.md §6.3.
 * Insufficient stock is recorded as a shortfall, never blocked — the cook
 * always succeeds because the user is holding the real ingredient.
 */
export async function cookMeal(planEntryId: string, servingsMade: number): Promise<CookResult> {
  const settings = getSettings()

  return db.transaction(
    'rw',
    [db.plan_entries, db.recipes, db.recipe_ingredients, db.ingredients, db.pantry, db.cook_log],
    async () => {
      const planEntry = await db.plan_entries.get(planEntryId)
      if (!planEntry) throw new Error(`Unknown plan entry: ${planEntryId}`)

      const recipe = await db.recipes.get(planEntry.recipe_id)
      if (!recipe) throw new Error(`Unknown recipe: ${planEntry.recipe_id}`)

      const recipeIngredients = await db.recipe_ingredients.where('recipe_id').equals(recipe.id).toArray()
      const ratio = servingsMade / recipe.servings

      const deductions: CookLogDeduction[] = []
      const shortfalls: string[] = []

      for (const ri of recipeIngredients) {
        if (ri.optional) continue
        const ingredient = await db.ingredients.get(ri.ingredient_id)
        const stock = await db.pantry.get(ri.ingredient_id)
        if (!ingredient || !stock) continue

        if (ingredient.tier === 'perishable') {
          const needed = ri.qty * ratio
          const before = stock.qty ?? 0
          if (before < needed) shortfalls.push(ri.ingredient_id)
          const after = Math.max(0, before - needed)
          await db.pantry.update(ri.ingredient_id, { qty: after, updated_at: new Date().toISOString() })
          deductions.push({ ingredient_id: ri.ingredient_id, field: 'qty', before, after })
        } else {
          const beforeUseCount = stock.use_count
          let afterUseCount = beforeUseCount + 1
          const beforeState = stock.state
          let afterState = beforeState

          if (afterUseCount >= settings.staple_low_threshold) {
            afterState = 'low'
            afterUseCount = 0
          }

          await db.pantry.update(ri.ingredient_id, {
            use_count: afterUseCount,
            state: afterState,
            updated_at: new Date().toISOString(),
          })
          deductions.push({
            ingredient_id: ri.ingredient_id,
            field: 'use_count',
            before: beforeUseCount,
            after: afterUseCount,
          })
          if (afterState !== beforeState) {
            deductions.push({ ingredient_id: ri.ingredient_id, field: 'state', before: beforeState, after: afterState })
          }
        }
      }

      await db.plan_entries.update(planEntryId, { status: 'cooked', servings_made: servingsMade })

      const cookLogId = crypto.randomUUID()
      await db.cook_log.add({
        id: cookLogId,
        plan_entry_id: planEntryId,
        cooked_at: new Date().toISOString(),
        deductions,
        shortfalls,
      })

      return { cookLogId, shortfalls }
    },
  )
}

/** Replays a cook_log's deductions in reverse, restoring pantry state exactly. */
export async function undoCook(cookLogId: string): Promise<void> {
  return db.transaction('rw', db.cook_log, db.plan_entries, db.pantry, async () => {
    const log = await db.cook_log.get(cookLogId)
    if (!log) throw new Error(`Unknown cook_log: ${cookLogId}`)

    for (const deduction of [...log.deductions].reverse()) {
      const stock = await db.pantry.get(deduction.ingredient_id)
      if (!stock) continue

      if (deduction.field === 'qty') {
        await db.pantry.update(deduction.ingredient_id, { qty: deduction.before as number })
      } else if (deduction.field === 'state') {
        await db.pantry.update(deduction.ingredient_id, { state: deduction.before as StapleState })
      } else {
        await db.pantry.update(deduction.ingredient_id, { use_count: deduction.before as number })
      }
    }

    await db.plan_entries.update(log.plan_entry_id, { status: 'planned', servings_made: null })
    await db.cook_log.delete(cookLogId)
  })
}
