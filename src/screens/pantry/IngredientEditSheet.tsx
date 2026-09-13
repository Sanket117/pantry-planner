import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import type { Ingredient, Tier, Unit } from '../../db/types'

interface IngredientEditSheetProps {
  ingredient: Ingredient
  onClose: () => void
}

const UNITS: Unit[] = ['g', 'ml', 'piece', 'tbsp']

export function IngredientEditSheet({ ingredient, onClose }: IngredientEditSheetProps) {
  const [name, setName] = useState(ingredient.canonical_name)
  const [aliases, setAliases] = useState(ingredient.aliases.join(', '))
  const [tier, setTier] = useState<Tier>(ingredient.tier)
  const [unit, setUnit] = useState<Unit>(ingredient.default_unit)

  async function save() {
    await db.ingredients.update(ingredient.id, {
      canonical_name: name.trim() || ingredient.canonical_name,
      aliases: aliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      tier,
      default_unit: unit,
    })
    onClose()
  }

  return (
    <Sheet title="Edit ingredient" onClose={onClose}>
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
          Aliases (comma-separated)
          <input
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
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
            <option value="staple">Staple</option>
            <option value="perishable">Perishable</option>
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

        <button type="button" onClick={save} className="mt-2 rounded-md bg-green-800 py-2 text-white">
          Save
        </button>
      </div>
    </Sheet>
  )
}
