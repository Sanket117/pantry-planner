import { useState } from 'react'
import { CreateIngredientForm } from '../../components/CreateIngredientForm'
import { MapIngredientForm } from '../../components/MapIngredientForm'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import type { Ingredient } from '../../db/types'
import { addAlias, resolveIngredient } from '../../lib/ingredients'
import { StockFields, type StockValue } from './StockFields'

interface AddItemSheetProps {
  onClose: () => void
}

type Step =
  | { name: 'search' }
  | { name: 'unresolved'; query: string }
  | { name: 'create'; query: string }
  | { name: 'map'; query: string }
  | { name: 'stock'; ingredient: Ingredient; isExisting: boolean }

export function AddItemSheet({ onClose }: AddItemSheetProps) {
  const [step, setStep] = useState<Step>({ name: 'search' })
  const [query, setQuery] = useState('')

  async function handleSearchSubmit() {
    const trimmed = query.trim()
    if (!trimmed) return
    const match = await resolveIngredient(trimmed)
    if (match) {
      const existingStock = await db.pantry.get(match.id)
      setStep({ name: 'stock', ingredient: match, isExisting: Boolean(existingStock) })
    } else {
      setStep({ name: 'unresolved', query: trimmed })
    }
  }

  if (step.name === 'search') {
    return (
      <Sheet title="Add item" onClose={onClose}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-stone-600">
            Ingredient name
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
              placeholder="e.g. paneer, aloo, dahi"
              className="rounded-md border border-stone-300 px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={handleSearchSubmit}
            className="rounded-md bg-green-800 py-2 text-white disabled:opacity-50"
            disabled={!query.trim()}
          >
            Next
          </button>
        </div>
      </Sheet>
    )
  }

  if (step.name === 'unresolved') {
    return (
      <Sheet title="Ingredient not found" onClose={onClose}>
        <p className="mb-4 text-sm text-stone-600">
          "{step.query}" doesn't match any known ingredient or alias. No new ingredient is created without your
          confirmation.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setStep({ name: 'create', query: step.query })}
            className="rounded-md border border-green-800 py-2 text-green-800"
          >
            Create new ingredient "{step.query}"
          </button>
          <button
            type="button"
            onClick={() => setStep({ name: 'map', query: step.query })}
            className="rounded-md border border-stone-300 py-2 text-stone-600"
          >
            This is another name for an ingredient I already have
          </button>
        </div>
      </Sheet>
    )
  }

  if (step.name === 'create') {
    return (
      <Sheet title="New ingredient" onClose={onClose}>
        <CreateIngredientForm
          query={step.query}
          onCreated={(ing) => setStep({ name: 'stock', ingredient: ing, isExisting: false })}
        />
      </Sheet>
    )
  }

  if (step.name === 'map') {
    return (
      <Sheet title={`Map "${step.query}" to...`} onClose={onClose}>
        <MapIngredientForm
          onSelect={async (ing) => {
            await addAlias(ing.id, step.query)
            const existingStock = await db.pantry.get(ing.id)
            setStep({ name: 'stock', ingredient: ing, isExisting: Boolean(existingStock) })
          }}
        />
      </Sheet>
    )
  }

  return <StockStep ingredient={step.ingredient} isExisting={step.isExisting} onClose={onClose} />
}

function StockStep({
  ingredient,
  isExisting,
  onClose,
}: {
  ingredient: Ingredient
  isExisting: boolean
  onClose: () => void
}) {
  const [value, setValue] = useState<StockValue>({
    state: 'have',
    qty: '',
    unit: ingredient.default_unit,
    expires_on: '',
  })

  async function save() {
    const now = new Date().toISOString()
    const existing = await db.pantry.get(ingredient.id)
    await db.pantry.put({
      ingredient_id: ingredient.id,
      state: value.state,
      qty: ingredient.tier === 'perishable' ? Number(value.qty) || 0 : null,
      unit: ingredient.tier === 'perishable' ? value.unit : null,
      added_on: existing?.added_on ?? now,
      expires_on: ingredient.tier === 'perishable' ? value.expires_on || null : null,
      use_count: existing?.use_count ?? 0,
      updated_at: now,
    })
    onClose()
  }

  return (
    <Sheet title={ingredient.canonical_name} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {isExisting && (
          <p className="text-sm text-amber-700">Already in your pantry — this updates the existing entry.</p>
        )}
        <StockFields ingredient={ingredient} value={value} onChange={setValue} />
        <button type="button" onClick={save} className="rounded-md bg-green-800 py-2 text-white">
          Add to pantry
        </button>
      </div>
    </Sheet>
  )
}
