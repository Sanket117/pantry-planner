import Dexie, { type EntityTable } from 'dexie'
import type { CookLog, Ingredient, PantryItem, PlanEntry, Recipe, RecipeIngredient } from './types'

export class PantryDB extends Dexie {
  ingredients!: EntityTable<Ingredient, 'id'>
  pantry!: EntityTable<PantryItem, 'ingredient_id'>
  recipes!: EntityTable<Recipe, 'id'>
  recipe_ingredients!: EntityTable<RecipeIngredient, 'id'>
  plan_entries!: EntityTable<PlanEntry, 'id'>
  cook_log!: EntityTable<CookLog, 'id'>

  constructor(name = 'pantry-planner') {
    super(name)

    this.version(1).stores({
      ingredients: 'id, tier',
      pantry: 'ingredient_id, state, expires_on',
      recipes: 'id, active',
      recipe_ingredients: 'id, recipe_id, ingredient_id',
      plan_entries: 'id, date, [date+slot]',
      cook_log: 'id, plan_entry_id',
    })

    // IndexedDB keys can't be booleans, so `active` was never actually
    // indexed under v1 — drop it from the index list to avoid relying on
    // silently-broken query behavior (filter with .toArray() instead).
    this.version(2).stores({
      recipes: 'id',
    })
  }
}

export const db = new PantryDB()
