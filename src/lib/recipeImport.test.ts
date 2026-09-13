import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { commitRecipeImport, resolveImportIngredients, validateRecipeShape } from './recipeImport'

const VALID_JSON = {
  name: 'Aloo Gobhi',
  servings: 2,
  prep_min: 30,
  meal_slots: ['lunch', 'dinner'],
  tags: ['veg'],
  ingredients: [
    { name: 'potato', qty: 250, unit: 'g', optional: false },
    { name: 'cauliflower', qty: 300, unit: 'g', optional: false },
  ],
  steps: ['Chop', 'Cook'],
}

beforeEach(async () => {
  await db.ingredients.bulkAdd([
    {
      id: 'potato',
      canonical_name: 'Potato',
      aliases: ['aloo'],
      tier: 'perishable',
      default_unit: 'g',
      kcal_per_100g: null,
      protein_g: null,
      carb_g: null,
      fat_g: null,
    },
    {
      id: 'cauliflower',
      canonical_name: 'Cauliflower',
      aliases: ['gobhi'],
      tier: 'perishable',
      default_unit: 'g',
      kcal_per_100g: null,
      protein_g: null,
      carb_g: null,
      fat_g: null,
    },
  ])
})

afterEach(async () => {
  await Promise.all([db.ingredients.clear(), db.recipes.clear(), db.recipe_ingredients.clear()])
})

describe('validateRecipeShape', () => {
  it('accepts a well-formed recipe', () => {
    const result = validateRecipeShape(VALID_JSON)
    expect('data' in result).toBe(true)
  })

  it('collects every field error instead of stopping at the first', () => {
    const result = validateRecipeShape({
      name: '',
      servings: -1,
      meal_slots: ['brunch'],
      ingredients: [{ name: 'x', qty: -5 }],
    })
    expect('errors' in result).toBe(true)
    if ('errors' in result) {
      const paths = result.errors.map((e) => e.path)
      expect(paths).toContain('name')
      expect(paths).toContain('servings')
      expect(paths).toContain('prep_min')
      expect(paths).toContain('meal_slots')
      expect(paths).toContain('ingredients[0].unit')
      expect(paths).toContain('steps')
    }
  })
})

describe('resolveImportIngredients', () => {
  it('resolves known aliases and reports unresolved names without creating anything', async () => {
    const { resolved, unresolved } = await resolveImportIngredients([
      { name: 'aloo', qty: 250, unit: 'g', optional: false },
      { name: 'made-up-thing', qty: 10, unit: 'g', optional: false },
    ])

    expect(resolved.get(0)?.id).toBe('potato')
    expect(unresolved).toHaveLength(1)
    expect(unresolved[0].line.name).toBe('made-up-thing')
    expect(await db.ingredients.count()).toBe(2) // still just the two seeded ones
  })
})

describe('commitRecipeImport', () => {
  it('refuses to commit while any ingredient is unresolved', async () => {
    const parsed = validateRecipeShape(VALID_JSON)
    if (!('data' in parsed)) throw new Error('expected valid data')

    await expect(commitRecipeImport(parsed.data, new Map([[0, 'potato']]))).rejects.toThrow()
    expect(await db.recipes.count()).toBe(0)
  })

  it('creates the recipe and its recipe_ingredients once fully resolved', async () => {
    const parsed = validateRecipeShape(VALID_JSON)
    if (!('data' in parsed)) throw new Error('expected valid data')

    const id = await commitRecipeImport(
      parsed.data,
      new Map([
        [0, 'potato'],
        [1, 'cauliflower'],
      ]),
    )

    const recipe = await db.recipes.get(id)
    expect(recipe?.name).toBe('Aloo Gobhi')
    const ris = await db.recipe_ingredients.where('recipe_id').equals(id).toArray()
    expect(ris).toHaveLength(2)
  })
})
