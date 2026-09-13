import { db } from '../db/db'
import type { Ingredient, Tier, Unit } from '../db/types'
import { uniqueSlug } from './slug'

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

/** Shared by the manual create form and the AI alias suggestion — one write path either way. */
export async function createIngredient(
  canonicalName: string,
  tier: Tier,
  defaultUnit: Unit,
  extraAlias?: string,
): Promise<Ingredient> {
  const id = await uniqueSlug(canonicalName, async (candidate) => Boolean(await db.ingredients.get(candidate)))
  const aliases = extraAlias && normalizeToken(extraAlias) !== normalizeToken(canonicalName) ? [extraAlias.trim()] : []
  const ingredient: Ingredient = {
    id,
    canonical_name: canonicalName.trim(),
    aliases,
    tier,
    default_unit: defaultUnit,
    kcal_per_100g: null,
    protein_g: null,
    carb_g: null,
    fat_g: null,
  }
  await db.ingredients.add(ingredient)
  return ingredient
}
