import type { Ingredient, PantryItem, RecipeIngredient } from '../db/types'

export type PantryMap = Map<string, PantryItem>
export type IngredientMap = Map<string, Ingredient>

export interface IngredientAvailability {
  ingredient_id: string
  available: boolean
  ratio: number // 1 = fully covered; <1 = partial (perishables only); staples are 0 or 1
}

export function checkIngredientAvailability(
  recipeIngredient: RecipeIngredient,
  pantry: PantryMap,
  ingredients: IngredientMap,
): IngredientAvailability {
  const ingredient = ingredients.get(recipeIngredient.ingredient_id)
  const stock = pantry.get(recipeIngredient.ingredient_id)

  if (!ingredient || !stock) {
    return { ingredient_id: recipeIngredient.ingredient_id, available: false, ratio: 0 }
  }

  if (ingredient.tier === 'staple') {
    const available = stock.state !== 'out'
    return { ingredient_id: recipeIngredient.ingredient_id, available, ratio: available ? 1 : 0 }
  }

  const have = stock.qty ?? 0
  const ratio = recipeIngredient.qty > 0 ? have / recipeIngredient.qty : 1
  return { ingredient_id: recipeIngredient.ingredient_id, available: have >= recipeIngredient.qty, ratio }
}

export interface CoverageResult {
  coverage: number
  perIngredient: IngredientAvailability[]
}

export function computeCoverage(
  recipeIngredients: RecipeIngredient[],
  pantry: PantryMap,
  ingredients: IngredientMap,
): CoverageResult {
  const required = recipeIngredients.filter((ri) => !ri.optional)
  const perIngredient = required.map((ri) => checkIngredientAvailability(ri, pantry, ingredients))
  const coverage = required.length === 0 ? 1 : perIngredient.filter((a) => a.available).length / required.length
  return { coverage, perIngredient }
}
