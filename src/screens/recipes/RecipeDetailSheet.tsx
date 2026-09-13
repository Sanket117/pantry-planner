import { useLiveQuery } from 'dexie-react-hooks'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import type { Recipe } from '../../db/types'

interface RecipeDetailSheetProps {
  recipe: Recipe
  onClose: () => void
}

export function RecipeDetailSheet({ recipe, onClose }: RecipeDetailSheetProps) {
  const ingredients = useLiveQuery(async () => {
    const ris = await db.recipe_ingredients.where('recipe_id').equals(recipe.id).toArray()
    const all = await db.ingredients.bulkGet(ris.map((r) => r.ingredient_id))
    return ris.map((ri, i) => ({ ri, ingredient: all[i] }))
  }, [recipe.id])

  async function toggleActive() {
    await db.recipes.update(recipe.id, { active: !recipe.active })
  }

  async function remove() {
    await db.transaction('rw', db.recipes, db.recipe_ingredients, async () => {
      await db.recipe_ingredients.where('recipe_id').equals(recipe.id).delete()
      await db.recipes.delete(recipe.id)
    })
    onClose()
  }

  return (
    <Sheet title={recipe.name} onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm text-stone-700">
        <p>
          {recipe.servings} servings · {recipe.prep_min} min · {recipe.meal_slots.join(', ')}
        </p>
        {recipe.tags.length > 0 && <p className="text-xs text-stone-400">{recipe.tags.join(' · ')}</p>}

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">Ingredients</h3>
          <ul className="list-disc pl-5">
            {ingredients?.map(({ ri, ingredient }) => (
              <li key={ri.id}>
                {ri.qty}
                {ri.unit} {ingredient?.canonical_name ?? ri.ingredient_id}
                {ri.optional ? ' (optional)' : ''}
              </li>
            ))}
          </ul>
        </div>

        {recipe.steps.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">Steps</h3>
            <ol className="list-decimal pl-5">
              {recipe.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-stone-100 pt-3">
          <button type="button" onClick={toggleActive} className="text-stone-600 underline">
            {recipe.active ? 'Deactivate' : 'Activate'}
          </button>
          <button type="button" onClick={remove} className="text-red-700">
            Delete recipe
          </button>
        </div>
      </div>
    </Sheet>
  )
}
