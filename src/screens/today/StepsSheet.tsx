import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import type { Recipe } from '../../db/types'

interface StepsSheetProps {
  recipe: Recipe
  onClose: () => void
}

export function StepsSheet({ recipe, onClose }: StepsSheetProps) {
  const [servings, setServings] = useState(recipe.servings)
  const ratio = servings / recipe.servings

  const ingredients = useLiveQuery(async () => {
    const ris = await db.recipe_ingredients.where('recipe_id').equals(recipe.id).toArray()
    const all = await db.ingredients.bulkGet(ris.map((r) => r.ingredient_id))
    return ris.map((ri, i) => ({ ri, ingredient: all[i] }))
  }, [recipe.id])

  return (
    <Sheet title={recipe.name} onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm text-stone-700">
        <label className="flex items-center gap-2 text-sm text-stone-600">
          Servings
          <input
            type="number"
            min="1"
            value={servings}
            onChange={(e) => setServings(Number(e.target.value) || recipe.servings)}
            className="w-20 rounded-md border border-stone-300 px-2 py-1"
          />
        </label>

        <ul className="list-disc pl-5">
          {ingredients?.map(({ ri, ingredient }) => (
            <li key={ri.id}>
              {Math.round(ri.qty * ratio * 100) / 100}
              {ri.unit} {ingredient?.canonical_name ?? ri.ingredient_id}
              {ri.optional ? ' (optional)' : ''}
            </li>
          ))}
        </ul>

        {recipe.steps.length > 0 && (
          <ol className="list-decimal pl-5">
            {recipe.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
      </div>
    </Sheet>
  )
}
