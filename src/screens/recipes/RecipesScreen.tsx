import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Recipe } from '../../db/types'
import { RecipeDetailSheet } from './RecipeDetailSheet'
import { RecipeImportSheet } from './RecipeImportSheet'

export function RecipesScreen() {
  const recipes = useLiveQuery(
    async () => (await db.recipes.toArray()).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  )
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState<Recipe | null>(null)

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-stone-800">Recipes</h1>
        <button
          type="button"
          onClick={() => setImporting(true)}
          className="rounded-md bg-green-800 px-3 py-2 text-sm font-medium text-white"
        >
          + Add
        </button>
      </div>

      {recipes !== undefined && recipes.length === 0 && (
        <p className="mt-8 text-center text-sm text-stone-400">
          No recipes yet. Paste one in from "+ Add" — 15 real dishes you actually cook beat a big library nobody
          uses.
        </p>
      )}

      <div className="flex flex-col divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
        {recipes?.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelected(r)}
            className="flex items-center justify-between px-3 py-3 text-left"
          >
            <div>
              <p className={`text-sm ${r.active ? 'text-stone-800' : 'text-stone-400 line-through'}`}>{r.name}</p>
              <p className="text-xs text-stone-400">
                {r.prep_min} min · {r.meal_slots.join(', ')}
              </p>
            </div>
            {!r.active && <span className="text-xs text-stone-400">inactive</span>}
          </button>
        ))}
      </div>

      {importing && (
        <RecipeImportSheet
          onClose={() => setImporting(false)}
          onImported={() => setImporting(false)}
        />
      )}
      {selected && <RecipeDetailSheet recipe={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
