import type { PantryItem, PlanEntry, Recipe, RecipeIngredient } from '../db/types'
import { MEAL_SLOTS } from './slots'
import type { IngredientMap, PantryMap } from './availability'
import { computeCoverage } from './availability'
import type { Settings } from './settings'

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO).setHours(0, 0, 0, 0)
  const to = new Date(toISO).setHours(0, 0, 0, 0)
  return Math.round((to - from) / 86_400_000)
}

function clonePantry(pantry: PantryMap): PantryMap {
  const clone: PantryMap = new Map()
  for (const [id, item] of pantry) clone.set(id, { ...item })
  return clone
}

function lastPlannedDate(recipeId: string, history: PlanEntry[]): string | null {
  const dates = history
    .filter((e) => e.recipe_id === recipeId && (e.status === 'planned' || e.status === 'cooked'))
    .map((e) => e.date)
  if (dates.length === 0) return null
  return dates.reduce((latest, d) => (d > latest ? d : latest))
}

interface ScoreInput {
  recipe: Recipe
  recipeIngredients: RecipeIngredient[]
  date: string
  slot: (typeof MEAL_SLOTS)[number]
  pantry: PantryMap
  ingredients: IngredientMap
  history: PlanEntry[]
  settings: Settings
}

export interface ScoredRecipe {
  recipe: Recipe
  score: number
  coverage: number
}

/** Pure scoring per SPEC.md §6.2. Returns null if any hard filter excludes the recipe. */
export function scoreRecipe(input: ScoreInput): ScoredRecipe | null {
  const { recipe, recipeIngredients, date, slot, pantry, ingredients, history, settings } = input

  if (!recipe.meal_slots.includes(slot)) return null
  if (recipe.prep_min > settings.prep_ceiling[slot]) return null

  const { coverage } = computeCoverage(recipeIngredients, pantry, ingredients)
  if (coverage < settings.min_coverage) return null

  let score = coverage * 100

  for (const ri of recipeIngredients) {
    if (ri.optional) continue
    const ingredient = ingredients.get(ri.ingredient_id)
    if (ingredient?.tier !== 'perishable') continue
    const stock = pantry.get(ri.ingredient_id)
    if (!stock?.expires_on) continue
    const daysLeft = daysBetween(date, stock.expires_on)
    if (daysLeft <= 3) score += 25
    else if (daysLeft <= 6) score += 10
  }

  const lastDate = lastPlannedDate(recipe.id, history)
  if (lastDate) {
    const daysSince = daysBetween(lastDate, date)
    if (daysSince < 7) score -= 60
    else if (daysSince < 14) score -= 20
  }

  score += Math.random() * 5

  return { recipe, score, coverage }
}

function deductFromSimulation(recipeIngredients: RecipeIngredient[], pantry: PantryMap, ingredients: IngredientMap) {
  for (const ri of recipeIngredients) {
    if (ri.optional) continue
    if (ingredients.get(ri.ingredient_id)?.tier !== 'perishable') continue
    const stock = pantry.get(ri.ingredient_id)
    if (!stock) continue
    pantry.set(ri.ingredient_id, { ...stock, qty: Math.max(0, (stock.qty ?? 0) - ri.qty) })
  }
}

export interface GenerateWeekInput {
  weekDates: string[] // 7 ISO dates, in order
  recipes: Recipe[] // active recipes only
  recipeIngredientsByRecipe: Map<string, RecipeIngredient[]>
  pantry: PantryMap
  ingredients: IngredientMap
  pastPlanEntries: PlanEntry[] // history from before this week, for repetition scoring
  preservedEntries: PlanEntry[] // existing entries for this week that are locked or already cooked
  settings: Settings
  newId: () => string
}

export type SlotResult = { date: string; slot: (typeof MEAL_SLOTS)[number] } & (
  | { kind: 'preserved'; entry: PlanEntry }
  | { kind: 'assigned'; entry: PlanEntry }
  | { kind: 'empty'; reason: 'nothing in stock' }
)

export function generateWeek(input: GenerateWeekInput): SlotResult[] {
  const { weekDates, recipes, recipeIngredientsByRecipe, pastPlanEntries, preservedEntries, settings, newId } = input
  const pantry = clonePantry(input.pantry)
  const preservedByKey = new Map(preservedEntries.map((e) => [`${e.date}|${e.slot}`, e]))
  const results: SlotResult[] = []
  const generatedSoFar: PlanEntry[] = []

  for (const date of weekDates) {
    for (const slot of MEAL_SLOTS) {
      const key = `${date}|${slot}`
      const preserved = preservedByKey.get(key)

      if (preserved) {
        const ris = recipeIngredientsByRecipe.get(preserved.recipe_id) ?? []
        deductFromSimulation(ris, pantry, input.ingredients)
        results.push({ date, slot, kind: 'preserved', entry: preserved })
        continue
      }

      const history = [...pastPlanEntries, ...generatedSoFar]
      let best: ScoredRecipe | null = null
      for (const recipe of recipes) {
        const scored = scoreRecipe({
          recipe,
          recipeIngredients: recipeIngredientsByRecipe.get(recipe.id) ?? [],
          date,
          slot,
          pantry,
          ingredients: input.ingredients,
          history,
          settings,
        })
        if (scored && (!best || scored.score > best.score)) best = scored
      }

      if (!best) {
        results.push({ date, slot, kind: 'empty', reason: 'nothing in stock' })
        continue
      }

      const entry: PlanEntry = {
        id: newId(),
        date,
        slot,
        recipe_id: best.recipe.id,
        status: 'planned',
        servings_made: null,
        locked: false,
      }
      deductFromSimulation(recipeIngredientsByRecipe.get(best.recipe.id) ?? [], pantry, input.ingredients)
      generatedSoFar.push(entry)
      results.push({ date, slot, kind: 'assigned', entry })
    }
  }

  return results
}

export function pantryMapFromItems(items: PantryItem[]): PantryMap {
  return new Map(items.map((i) => [i.ingredient_id, i]))
}

export interface PickBestInput {
  recipes: Recipe[]
  recipeIngredientsByRecipe: Map<string, RecipeIngredient[]>
  date: string
  slot: (typeof MEAL_SLOTS)[number]
  pantry: PantryMap
  ingredients: IngredientMap
  history: PlanEntry[]
  settings: Settings
  exclude?: string[]
}

/** Used by the Week screen's "swap" action to find the next-best scorer for one slot. */
export function pickBestRecipe(input: PickBestInput): ScoredRecipe | null {
  const exclude = new Set(input.exclude ?? [])
  let best: ScoredRecipe | null = null
  for (const recipe of input.recipes) {
    if (exclude.has(recipe.id)) continue
    const scored = scoreRecipe({
      recipe,
      recipeIngredients: input.recipeIngredientsByRecipe.get(recipe.id) ?? [],
      date: input.date,
      slot: input.slot,
      pantry: input.pantry,
      ingredients: input.ingredients,
      history: input.history,
      settings: input.settings,
    })
    if (scored && (!best || scored.score > best.score)) best = scored
  }
  return best
}
