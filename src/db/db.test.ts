import { afterEach, describe, expect, it } from 'vitest'
import { PantryDB } from './db'

const DB_NAME = 'pantry-planner-test'

afterEach(async () => {
  await new PantryDB(DB_NAME).delete()
})

describe('PantryDB schema', () => {
  it('round-trips a row through every table', async () => {
    const db = new PantryDB(DB_NAME)

    await db.ingredients.add({
      id: 'paneer',
      canonical_name: 'Paneer',
      aliases: ['panir', 'cottage cheese'],
      tier: 'perishable',
      default_unit: 'g',
      kcal_per_100g: 265,
      protein_g: 18.3,
      carb_g: 1.2,
      fat_g: 20.8,
    })

    await db.pantry.add({
      ingredient_id: 'paneer',
      state: 'have',
      qty: 200,
      unit: 'g',
      added_on: '2026-09-01',
      expires_on: '2026-09-08',
      use_count: 0,
      updated_at: '2026-09-01T00:00:00.000Z',
    })

    await db.recipes.add({
      id: 'paneer-bhurji',
      name: 'Paneer Bhurji',
      servings: 2,
      prep_min: 20,
      meal_slots: ['lunch', 'dinner'],
      tags: ['veg'],
      steps: ['Crumble paneer', 'Saute with onion and tomato'],
      active: true,
    })

    await db.recipe_ingredients.add({
      id: 'ri-1',
      recipe_id: 'paneer-bhurji',
      ingredient_id: 'paneer',
      qty: 200,
      unit: 'g',
      optional: false,
    })

    await db.plan_entries.add({
      id: 'pe-1',
      date: '2026-09-14',
      slot: 'dinner',
      recipe_id: 'paneer-bhurji',
      status: 'planned',
      servings_made: null,
      locked: false,
    })

    await db.cook_log.add({
      id: 'cl-1',
      plan_entry_id: 'pe-1',
      cooked_at: '2026-09-14T19:00:00.000Z',
      deductions: [{ ingredient_id: 'paneer', field: 'qty', before: 200, after: 0 }],
      shortfalls: [],
    })

    db.close()

    // Reopen a fresh connection to the same on-disk database, simulating a
    // force-quit and relaunch of the app.
    const reopened = new PantryDB(DB_NAME)

    expect(await reopened.ingredients.get('paneer')).toMatchObject({ canonical_name: 'Paneer' })
    expect(await reopened.pantry.get('paneer')).toMatchObject({ qty: 200, state: 'have' })
    expect(await reopened.recipes.get('paneer-bhurji')).toMatchObject({ name: 'Paneer Bhurji' })
    expect(await reopened.recipe_ingredients.get('ri-1')).toMatchObject({ qty: 200 })
    expect(await reopened.plan_entries.get('pe-1')).toMatchObject({ status: 'planned' })
    expect(await reopened.cook_log.get('cl-1')).toMatchObject({ shortfalls: [] })

    reopened.close()
  })
})
