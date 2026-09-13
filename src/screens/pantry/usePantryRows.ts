import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Ingredient, PantryItem } from '../../db/types'

export interface PantryRow {
  pantry: PantryItem
  ingredient: Ingredient
}

export function usePantryRows(): PantryRow[] | undefined {
  return useLiveQuery(async () => {
    const [pantryItems, ingredients] = await Promise.all([db.pantry.toArray(), db.ingredients.toArray()])
    const byId = new Map(ingredients.map((i) => [i.id, i]))
    return pantryItems
      .map((pantry) => {
        const ingredient = byId.get(pantry.ingredient_id)
        return ingredient ? { pantry, ingredient } : null
      })
      .filter((row): row is PantryRow => row !== null)
      .sort((a, b) => a.ingredient.canonical_name.localeCompare(b.ingredient.canonical_name))
  }, [])
}
