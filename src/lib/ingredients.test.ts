import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { addAlias, resolveIngredient } from './ingredients'

beforeEach(async () => {
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
})

afterEach(async () => {
  await db.ingredients.clear()
})

describe('resolveIngredient', () => {
  it('matches the canonical name case-insensitively', async () => {
    expect(await resolveIngredient('PANEER')).toMatchObject({ id: 'paneer' })
    expect(await resolveIngredient('  paneer  ')).toMatchObject({ id: 'paneer' })
  })

  it('matches an alias', async () => {
    expect(await resolveIngredient('Panir')).toMatchObject({ id: 'paneer' })
    expect(await resolveIngredient('cottage cheese')).toMatchObject({ id: 'paneer' })
  })

  it('returns null for an unknown token and creates nothing', async () => {
    expect(await resolveIngredient('tamatar')).toBeNull()
    expect(await db.ingredients.count()).toBe(1)
  })
})

describe('addAlias', () => {
  it('appends a new alias without duplicating an existing one', async () => {
    await addAlias('paneer', 'tofu-like-thing')
    let updated = await db.ingredients.get('paneer')
    expect(updated?.aliases).toContain('tofu-like-thing')

    await addAlias('paneer', 'PANIR')
    updated = await db.ingredients.get('paneer')
    expect(updated?.aliases.filter((a) => a.toLowerCase() === 'panir')).toHaveLength(1)
  })
})
