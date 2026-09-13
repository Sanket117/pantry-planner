import { db } from '../../db/db'
import type { Recipe, RecipeIngredient } from '../../db/types'
import type { IngredientMap, PantryMap } from '../../lib/availability'
import { pantryMapFromItems } from '../../lib/planner'

export interface PlannerInputs {
  activeRecipes: Recipe[]
  recipeIngredientsByRecipe: Map<string, RecipeIngredient[]>
  pantry: PantryMap
  ingredients: IngredientMap
}

export async function loadPlannerInputs(): Promise<PlannerInputs> {
  const [allRecipes, allRecipeIngredients, pantryItems, ingredientList] = await Promise.all([
    db.recipes.toArray(),
    db.recipe_ingredients.toArray(),
    db.pantry.toArray(),
    db.ingredients.toArray(),
  ])
  // `active` is a boolean, which IndexedDB can't index — filter in JS.
  const recipes = allRecipes.filter((r) => r.active)

  const recipeIngredientsByRecipe = new Map<string, RecipeIngredient[]>()
  for (const ri of allRecipeIngredients) {
    const list = recipeIngredientsByRecipe.get(ri.recipe_id) ?? []
    list.push(ri)
    recipeIngredientsByRecipe.set(ri.recipe_id, list)
  }

  return {
    activeRecipes: recipes,
    recipeIngredientsByRecipe,
    pantry: pantryMapFromItems(pantryItems),
    ingredients: new Map(ingredientList.map((i) => [i.id, i])),
  }
}
