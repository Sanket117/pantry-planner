import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import type { PlanEntry, Recipe } from '../../db/types'
import { cookMeal } from '../../lib/cook'

interface CookSheetProps {
  entry: PlanEntry
  recipe: Recipe
  onClose: () => void
}

export function CookSheet({ entry, recipe, onClose }: CookSheetProps) {
  const [servings, setServings] = useState(recipe.servings)
  const [shortfalls, setShortfalls] = useState<string[] | null>(null)

  const shortfallIngredients = useLiveQuery(
    async () => (shortfalls ? db.ingredients.bulkGet(shortfalls) : []),
    [shortfalls],
  )

  async function confirmCook() {
    const result = await cookMeal(entry.id, servings)
    setShortfalls(result.shortfalls)
  }

  if (shortfalls) {
    return (
      <Sheet title="Cooked" onClose={onClose}>
        <div className="flex flex-col gap-3 text-sm text-stone-700">
          <p>{recipe.name} marked cooked. Pantry updated.</p>
          {shortfalls.length > 0 && (
            <div className="rounded-md bg-amber-50 p-3 text-amber-800">
              <p className="mb-1 font-medium">Ran short on:</p>
              <ul className="list-disc pl-5">
                {shortfallIngredients?.map((ing) => <li key={ing?.id}>{ing?.canonical_name}</li>)}
              </ul>
              <p className="mt-1 text-xs">These will show up at your next weekly reset to fix the quantities.</p>
            </div>
          )}
          <button type="button" onClick={onClose} className="rounded-md bg-green-800 py-2 text-white">
            Done
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={`Cook ${recipe.name}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm text-stone-600">
          Servings made
          <input
            type="number"
            min="0"
            step="0.5"
            value={servings}
            onChange={(e) => setServings(Number(e.target.value) || 0)}
            className="w-20 rounded-md border border-stone-300 px-2 py-1"
          />
        </label>
        <button type="button" onClick={confirmCook} className="rounded-md bg-green-800 py-2 text-white">
          Confirm cooked
        </button>
      </div>
    </Sheet>
  )
}
