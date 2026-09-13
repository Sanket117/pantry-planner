import { useState } from 'react'
import type { Ingredient, Tier, Unit } from '../db/types'
import { createIngredient } from '../lib/ingredients'

const UNITS: Unit[] = ['g', 'ml', 'piece', 'tbsp']

interface CreateIngredientFormProps {
  query: string
  onCreated: (ingredient: Ingredient) => void
  submitLabel?: string
  initialName?: string
  initialTier?: Tier
  initialUnit?: Unit
}

export function CreateIngredientForm({
  query,
  onCreated,
  submitLabel = 'Create and continue',
  initialName,
  initialTier = 'perishable',
  initialUnit = 'g',
}: CreateIngredientFormProps) {
  const [name, setName] = useState(initialName ?? query)
  const [tier, setTier] = useState<Tier>(initialTier)
  const [unit, setUnit] = useState<Unit>(initialUnit)

  async function create() {
    const ingredient = await createIngredient(name, tier, unit, query)
    onCreated(ingredient)
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-stone-600">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-stone-600">
        Tier
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as Tier)}
          className="rounded-md border border-stone-300 px-3 py-2"
        >
          <option value="staple">Staple (have / low / out)</option>
          <option value="perishable">Perishable (quantity tracked)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-stone-600">
        Default unit
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as Unit)}
          className="rounded-md border border-stone-300 px-3 py-2"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={create} className="rounded-md bg-green-800 py-2 text-white">
        {submitLabel}
      </button>
    </div>
  )
}
