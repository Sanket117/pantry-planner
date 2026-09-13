import { db } from '../db/db'
import type { Ingredient, MealSlot } from '../db/types'
import { resolveIngredient } from './ingredients'
import { uniqueSlug } from './slug'

const VALID_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner']

export interface ImportIngredientLine {
  name: string
  qty: number
  unit: string
  optional: boolean
}

export interface ImportRecipeInput {
  name: string
  servings: number
  prep_min: number
  meal_slots: MealSlot[]
  tags: string[]
  ingredients: ImportIngredientLine[]
  steps: string[]
}

export interface FieldError {
  path: string
  message: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Validates the SPEC.md §8 shape, collecting every field error rather than stopping at the first. */
export function validateRecipeShape(raw: unknown): { data: ImportRecipeInput } | { errors: FieldError[] } {
  const errors: FieldError[] = []
  if (!isRecord(raw)) return { errors: [{ path: '', message: 'Expected a JSON object' }] }

  if (typeof raw.name !== 'string' || !raw.name.trim()) {
    errors.push({ path: 'name', message: 'Required, non-empty string' })
  }
  if (typeof raw.servings !== 'number' || raw.servings <= 0) {
    errors.push({ path: 'servings', message: 'Required, positive number' })
  }
  if (typeof raw.prep_min !== 'number' || raw.prep_min < 0) {
    errors.push({ path: 'prep_min', message: 'Required, non-negative number' })
  }

  let meal_slots: MealSlot[] = []
  if (!Array.isArray(raw.meal_slots) || raw.meal_slots.length === 0) {
    errors.push({ path: 'meal_slots', message: 'Required, non-empty array of breakfast/lunch/dinner' })
  } else if (!raw.meal_slots.every((s) => VALID_SLOTS.includes(s as MealSlot))) {
    errors.push({ path: 'meal_slots', message: 'Each entry must be breakfast, lunch, or dinner' })
  } else {
    meal_slots = raw.meal_slots as MealSlot[]
  }

  const tags = Array.isArray(raw.tags) && raw.tags.every((t) => typeof t === 'string') ? (raw.tags as string[]) : []

  let ingredients: ImportIngredientLine[] = []
  if (!Array.isArray(raw.ingredients) || raw.ingredients.length === 0) {
    errors.push({ path: 'ingredients', message: 'Required, non-empty array' })
  } else {
    const parsed: ImportIngredientLine[] = []
    raw.ingredients.forEach((line, i) => {
      if (!isRecord(line)) {
        errors.push({ path: `ingredients[${i}]`, message: 'Expected an object' })
        return
      }
      if (typeof line.name !== 'string' || !line.name.trim()) {
        errors.push({ path: `ingredients[${i}].name`, message: 'Required, non-empty string' })
      }
      if (typeof line.qty !== 'number' || line.qty <= 0) {
        errors.push({ path: `ingredients[${i}].qty`, message: 'Required, positive number' })
      }
      if (typeof line.unit !== 'string' || !line.unit.trim()) {
        errors.push({ path: `ingredients[${i}].unit`, message: 'Required, non-empty string' })
      }
      parsed.push({
        name: typeof line.name === 'string' ? line.name : '',
        qty: typeof line.qty === 'number' ? line.qty : 0,
        unit: typeof line.unit === 'string' ? line.unit : '',
        optional: line.optional === true,
      })
    })
    ingredients = parsed
  }

  const steps =
    Array.isArray(raw.steps) && raw.steps.every((s) => typeof s === 'string') ? (raw.steps as string[]) : []
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
    errors.push({ path: 'steps', message: 'Required, non-empty array of strings' })
  }

  if (errors.length > 0) return { errors }

  return {
    data: {
      name: (raw.name as string).trim(),
      servings: raw.servings as number,
      prep_min: raw.prep_min as number,
      meal_slots,
      tags,
      ingredients,
      steps,
    },
  }
}

export interface UnresolvedLine {
  index: number
  line: ImportIngredientLine
}

export interface ResolveResult {
  resolved: Map<number, Ingredient>
  unresolved: UnresolvedLine[]
}

/** Exact alias/canonical matching only — an unresolved name is reported, never auto-created. */
export async function resolveImportIngredients(ingredients: ImportIngredientLine[]): Promise<ResolveResult> {
  const resolved = new Map<number, Ingredient>()
  const unresolved: UnresolvedLine[] = []

  for (let i = 0; i < ingredients.length; i++) {
    const match = await resolveIngredient(ingredients[i].name)
    if (match) resolved.set(i, match)
    else unresolved.push({ index: i, line: ingredients[i] })
  }

  return { resolved, unresolved }
}

/** Creates the recipe + recipe_ingredients rows. Every ingredient must already be resolved. */
export async function commitRecipeImport(input: ImportRecipeInput, resolvedIngredientIds: Map<number, string>): Promise<string> {
  if (resolvedIngredientIds.size !== input.ingredients.length) {
    throw new Error('Cannot commit an import with unresolved ingredients')
  }

  return db.transaction('rw', db.recipes, db.recipe_ingredients, async () => {
    const id = await uniqueSlug(input.name, async (candidate) => Boolean(await db.recipes.get(candidate)))

    await db.recipes.add({
      id,
      name: input.name,
      servings: input.servings,
      prep_min: input.prep_min,
      meal_slots: input.meal_slots,
      tags: input.tags,
      steps: input.steps,
      active: true,
    })

    await db.recipe_ingredients.bulkAdd(
      input.ingredients.map((line, i) => ({
        id: crypto.randomUUID(),
        recipe_id: id,
        ingredient_id: resolvedIngredientIds.get(i)!,
        qty: line.qty,
        unit: line.unit,
        optional: line.optional,
      })),
    )

    return id
  })
}
