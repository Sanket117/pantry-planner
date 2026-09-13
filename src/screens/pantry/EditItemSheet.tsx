import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { IngredientEditSheet } from './IngredientEditSheet'
import { StockFields, type StockValue } from './StockFields'
import type { PantryRow } from './usePantryRows'

interface EditItemSheetProps {
  row: PantryRow
  onClose: () => void
}

export function EditItemSheet({ row, onClose }: EditItemSheetProps) {
  const { pantry, ingredient } = row
  const [value, setValue] = useState<StockValue>({
    state: pantry.state,
    qty: pantry.qty?.toString() ?? '',
    unit: pantry.unit ?? ingredient.default_unit,
    expires_on: pantry.expires_on ?? '',
  })
  const [editingIngredient, setEditingIngredient] = useState(false)

  async function save() {
    await db.pantry.update(ingredient.id, {
      state: value.state,
      qty: ingredient.tier === 'perishable' ? Number(value.qty) || 0 : pantry.qty,
      unit: ingredient.tier === 'perishable' ? value.unit : pantry.unit,
      expires_on: ingredient.tier === 'perishable' ? value.expires_on || null : pantry.expires_on,
      updated_at: new Date().toISOString(),
    })
    onClose()
  }

  async function remove() {
    await db.pantry.delete(ingredient.id)
    onClose()
  }

  if (editingIngredient) {
    return <IngredientEditSheet ingredient={ingredient} onClose={() => setEditingIngredient(false)} />
  }

  return (
    <Sheet title={ingredient.canonical_name} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <StockFields ingredient={ingredient} value={value} onChange={setValue} />

        <button type="button" onClick={save} className="rounded-md bg-green-800 py-2 text-white">
          Save
        </button>

        <div className="flex items-center justify-between border-t border-stone-100 pt-3 text-sm">
          <button type="button" onClick={() => setEditingIngredient(true)} className="text-stone-500 underline">
            Edit ingredient details
          </button>
          <button type="button" onClick={remove} className="text-red-700">
            Remove from pantry
          </button>
        </div>
      </div>
    </Sheet>
  )
}
