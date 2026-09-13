import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Ingredient } from '../db/types'
import { normalizeToken } from '../lib/ingredients'

interface MapIngredientFormProps {
  onSelect: (ingredient: Ingredient) => void
}

export function MapIngredientForm({ onSelect }: MapIngredientFormProps) {
  const [filter, setFilter] = useState('')
  const ingredients = useLiveQuery(
    async () => (await db.ingredients.toArray()).sort((a, b) => a.canonical_name.localeCompare(b.canonical_name)),
    [],
  )

  const visible = (ingredients ?? []).filter((i) => normalizeToken(i.canonical_name).includes(normalizeToken(filter)))

  return (
    <div>
      <input
        autoFocus
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search ingredients"
        className="mb-3 w-full rounded-md border border-stone-300 px-3 py-2"
      />
      <div className="flex max-h-72 flex-col divide-y divide-stone-100 overflow-y-auto">
        {visible.map((i) => (
          <button key={i.id} type="button" onClick={() => onSelect(i)} className="py-2 text-left text-sm text-stone-700">
            {i.canonical_name}
          </button>
        ))}
        {ingredients && visible.length === 0 && <p className="py-4 text-sm text-stone-400">No matches.</p>}
      </div>
    </div>
  )
}
