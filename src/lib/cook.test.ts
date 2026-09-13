import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { cookMeal, undoCook } from './cook'

beforeEach(async () => {
  await db.ingredients.bulkAdd([
    {
      id: 'paneer',
      canonical_name: 'Paneer',
      aliases: [],
      tier: 'perishable',
      default_unit: 'g',
      kcal_per_100g: null,
      protein_g: null,
      carb_g: null,
      fat_g: null,
    },
    {
      id: 'salt',
      canonical_name: 'Salt',
      aliases: [],
      tier: 'staple',
      default_unit: 'g',
      kcal_per_100g: null,
      protein_g: null,
      carb_g: null,
      fat_g: null,
    },
  ])

  await db.pantry.bulkAdd([
    {
      ingredient_id: 'paneer',
      state: 'have',
      qty: 200,
      unit: 'g',
      added_on: '2026-09-01',
      expires_on: null,
      use_count: 0,
      updated_at: '2026-09-01T00:00:00.000Z',
    },
    {
      ingredient_id: 'salt',
      state: 'have',
      qty: null,
      unit: null,
      added_on: '2026-09-01',
      expires_on: null,
      use_count: 7, // one more use crosses the default threshold of 8
      updated_at: '2026-09-01T00:00:00.000Z',
    },
  ])

  await db.recipes.add({
    id: 'paneer-bhurji',
    name: 'Paneer Bhurji',
    servings: 2,
    prep_min: 20,
    meal_slots: ['dinner'],
    tags: [],
    steps: [],
    active: true,
  })

  await db.recipe_ingredients.bulkAdd([
    { id: 'ri-paneer', recipe_id: 'paneer-bhurji', ingredient_id: 'paneer', qty: 200, unit: 'g', optional: false },
    { id: 'ri-salt', recipe_id: 'paneer-bhurji', ingredient_id: 'salt', qty: 1, unit: 'tbsp', optional: false },
  ])

  await db.plan_entries.add({
    id: 'pe-1',
    date: '2026-09-14',
    slot: 'dinner',
    recipe_id: 'paneer-bhurji',
    status: 'planned',
    servings_made: null,
    locked: false,
  })
})

afterEach(async () => {
  await Promise.all([
    db.ingredients.clear(),
    db.pantry.clear(),
    db.recipes.clear(),
    db.recipe_ingredients.clear(),
    db.plan_entries.clear(),
    db.cook_log.clear(),
  ])
})

describe('cookMeal', () => {
  it('deducts exactly half when cooking half the recipe servings', async () => {
    const result = await cookMeal('pe-1', 1) // recipe.servings = 2 -> ratio 0.5

    const paneerStock = await db.pantry.get('paneer')
    expect(paneerStock?.qty).toBe(100)
    expect(result.shortfalls).toEqual([])

    const saltStock = await db.pantry.get('salt')
    expect(saltStock?.use_count).toBe(0)
    expect(saltStock?.state).toBe('low') // 7 + 1 use crossed the threshold of 8

    const planEntry = await db.plan_entries.get('pe-1')
    expect(planEntry?.status).toBe('cooked')
    expect(planEntry?.servings_made).toBe(1)
  })

  it('records a shortfall and deducts to zero without blocking when stock is insufficient', async () => {
    await db.pantry.update('paneer', { qty: 50 })

    const result = await cookMeal('pe-1', 2) // full batch needs 200g, only 50g in stock

    expect(result.shortfalls).toEqual(['paneer'])
    const paneerStock = await db.pantry.get('paneer')
    expect(paneerStock?.qty).toBe(0)
  })
})

describe('undoCook', () => {
  it('replays deductions in reverse to restore byte-identical pantry state', async () => {
    const before = {
      paneer: await db.pantry.get('paneer'),
      salt: await db.pantry.get('salt'),
    }

    const { cookLogId } = await cookMeal('pe-1', 1)
    await undoCook(cookLogId)

    const after = {
      paneer: await db.pantry.get('paneer'),
      salt: await db.pantry.get('salt'),
    }

    // updated_at is expected to change on cook+undo; compare everything else exactly.
    expect({ ...after.paneer, updated_at: undefined }).toEqual({ ...before.paneer, updated_at: undefined })
    expect({ ...after.salt, updated_at: undefined }).toEqual({ ...before.salt, updated_at: undefined })

    const planEntry = await db.plan_entries.get('pe-1')
    expect(planEntry?.status).toBe('planned')
    expect(planEntry?.servings_made).toBeNull()

    expect(await db.cook_log.get(cookLogId)).toBeUndefined()
  })
})
