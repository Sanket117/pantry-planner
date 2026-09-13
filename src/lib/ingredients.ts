import { db } from '../db/db'
import type { Ingredient } from '../db/types'

export function normalizeToken(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Exact, case-insensitive match against canonical_name or aliases only.
 * No fuzzy matching — an unresolved token must never silently create an
 * ingredient (SPEC.md §8, §11).
 */
export async function resolveIngredient(rawToken: string): Promise<Ingredient | null> {
  const token = normalizeToken(rawToken)
  if (!token) return null

  const all = await db.ingredients.toArray()
  for (const ingredient of all) {
    if (normalizeToken(ingredient.canonical_name) === token) return ingredient
    if (ingredient.aliases.some((a) => normalizeToken(a) === token)) return ingredient
  }
  return null
}

export async function addAlias(ingredientId: string, alias: string): Promise<void> {
  const ingredient = await db.ingredients.get(ingredientId)
  if (!ingredient) throw new Error(`Unknown ingredient: ${ingredientId}`)
  const token = normalizeToken(alias)
  if (ingredient.aliases.some((a) => normalizeToken(a) === token)) return
  await db.ingredients.update(ingredientId, { aliases: [...ingredient.aliases, alias.trim()] })
}
