export type Tier = 'staple' | 'perishable'
export type Unit = 'g' | 'ml' | 'piece' | 'tbsp'
export type StapleState = 'have' | 'low' | 'out'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner'
export type PlanStatus = 'planned' | 'cooked' | 'skipped'

export interface Ingredient {
  id: string
  canonical_name: string
  aliases: string[]
  tier: Tier
  default_unit: Unit
  kcal_per_100g: number | null
  protein_g: number | null
  carb_g: number | null
  fat_g: number | null
}

export interface PantryItem {
  ingredient_id: string
  state: StapleState
  qty: number | null
  unit: string | null
  added_on: string
  expires_on: string | null
  use_count: number
  updated_at: string
}

export interface Recipe {
  id: string
  name: string
  servings: number
  prep_min: number
  meal_slots: MealSlot[]
  tags: string[]
  steps: string[]
  active: boolean
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  ingredient_id: string
  qty: number
  unit: string
  optional: boolean
}

export interface PlanEntry {
  id: string
  date: string
  slot: MealSlot
  recipe_id: string
  status: PlanStatus
  servings_made: number | null
}

export interface CookLogDeduction {
  ingredient_id: string
  field: 'qty' | 'state' | 'use_count'
  before: number | string
  after: number | string
}

export interface CookLog {
  id: string
  plan_entry_id: string
  cooked_at: string
  deductions: CookLogDeduction[]
  shortfalls: string[]
}
