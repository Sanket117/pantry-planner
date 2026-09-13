import { describe, expect, it } from 'vitest'
import type { Ingredient, PantryItem, Recipe, RecipeIngredient } from '../db/types'
import { DEFAULT_SETTINGS } from './settings'
import { generateWeek, pantryMapFromItems } from './planner'

const paneer: Ingredient = {
  id: 'paneer',
  canonical_name: 'Paneer',
  aliases: [],
  tier: 'perishable',
  default_unit: 'g',
  kcal_per_100g: null,
  protein_g: null,
  carb_g: null,
  fat_g: null,
}

function recipeNeedingPaneer(id: string): { recipe: Recipe; ingredients: RecipeIngredient[] } {
  return {
    recipe: {
      id,
      name: id,
      servings: 1,
      prep_min: 10,
      meal_slots: ['lunch', 'dinner'],
      tags: [],
      steps: [],
      active: true,
    },
    ingredients: [{ id: `${id}-ri`, recipe_id: id, ingredient_id: 'paneer', qty: 200, unit: 'g', optional: false }],
  }
}

describe('generateWeek forward simulation', () => {
  it('never plans two recipes that together exceed a shared perishable stock', () => {
    const a = recipeNeedingPaneer('recipe-a')
    const b = recipeNeedingPaneer('recipe-b')

    const pantryItem: PantryItem = {
      ingredient_id: 'paneer',
      state: 'have',
      qty: 200, // enough for exactly one of the two recipes
      unit: 'g',
      added_on: '2026-09-01',
      expires_on: null,
      use_count: 0,
      updated_at: '2026-09-01T00:00:00.000Z',
    }

    let counter = 0
    const results = generateWeek({
      weekDates: ['2026-09-14'],
      recipes: [a.recipe, b.recipe],
      recipeIngredientsByRecipe: new Map([
        [a.recipe.id, a.ingredients],
        [b.recipe.id, b.ingredients],
      ]),
      pantry: pantryMapFromItems([pantryItem]),
      ingredients: new Map([['paneer', paneer]]),
      pastPlanEntries: [],
      preservedEntries: [],
      settings: DEFAULT_SETTINGS,
      newId: () => `id-${counter++}`,
    })

    const assigned = results.filter((r) => r.kind === 'assigned')
    const emptied = results.filter((r) => r.kind === 'empty')

    // Only one of the two paneer-hungry recipes can be planned once 200g is spent.
    expect(assigned).toHaveLength(1)
    expect(emptied.length).toBeGreaterThanOrEqual(1)

    // The original pantry snapshot passed in must be untouched — planning never writes stock.
    expect(pantryItem.qty).toBe(200)
  })
})
