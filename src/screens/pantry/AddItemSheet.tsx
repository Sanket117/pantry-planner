import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import type { Ingredient, Tier, Unit } from '../../db/types'
import { addAlias, normalizeToken, resolveIngredient } from '../../lib/ingredients'
import { uniqueSlug } from '../../lib/slug'
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

const UNITS: Unit[] = ['g', 'ml', 'piece', 'tbsp']

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
    return <CreateIngredientStep query={step.query} onCreated={(ing) => setStep({ name: 'stock', ingredient: ing, isExisting: false })} onClose={onClose} />
  }

  if (step.name === 'map') {
    return (
      <MapAliasStep
        query={step.query}
        onMapped={async (ing) => {
          await addAlias(ing.id, step.query)
          const existingStock = await db.pantry.get(ing.id)
          setStep({ name: 'stock', ingredient: ing, isExisting: Boolean(existingStock) })
        }}
        onClose={onClose}
      />
    )
  }

  return <StockStep ingredient={step.ingredient} isExisting={step.isExisting} onClose={onClose} />
}

function CreateIngredientStep({
  query,
  onCreated,
  onClose,
}: {
  query: string
  onCreated: (ingredient: Ingredient) => void
  onClose: () => void
}) {
  const [name, setName] = useState(query)
  const [tier, setTier] = useState<Tier>('perishable')
  const [unit, setUnit] = useState<Unit>('g')

  async function create() {
    const id = await uniqueSlug(name, async (candidate) => Boolean(await db.ingredients.get(candidate)))
    const aliases = normalizeToken(name) === normalizeToken(query) ? [] : [query]
    const ingredient: Ingredient = {
      id,
      canonical_name: name.trim(),
      aliases,
      tier,
      default_unit: unit,
      kcal_per_100g: null,
      protein_g: null,
      carb_g: null,
      fat_g: null,
    }
    await db.ingredients.add(ingredient)
    onCreated(ingredient)
  }

  return (
    <Sheet title="New ingredient" onClose={onClose}>
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
          Create and continue
        </button>
      </div>
    </Sheet>
  )
}

function MapAliasStep({
  query,
  onMapped,
  onClose,
}: {
  query: string
  onMapped: (ingredient: Ingredient) => void
  onClose: () => void
}) {
  const [filter, setFilter] = useState('')
  const ingredients = useLiveQuery(() => db.ingredients.orderBy('canonical_name').toArray(), [])

  const visible = (ingredients ?? []).filter((i) =>
    normalizeToken(i.canonical_name).includes(normalizeToken(filter)),
  )

  return (
    <Sheet title={`Map "${query}" to...`} onClose={onClose}>
      <input
        autoFocus
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search ingredients"
        className="mb-3 w-full rounded-md border border-stone-300 px-3 py-2"
      />
      <div className="flex max-h-72 flex-col divide-y divide-stone-100 overflow-y-auto">
        {visible.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => onMapped(i)}
            className="py-2 text-left text-sm text-stone-700"
          >
            {i.canonical_name}
          </button>
        ))}
        {ingredients && visible.length === 0 && <p className="py-4 text-sm text-stone-400">No matches.</p>}
      </div>
    </Sheet>
  )
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
