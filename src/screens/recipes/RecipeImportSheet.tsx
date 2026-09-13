import { useState } from 'react'
import { CreateIngredientForm } from '../../components/CreateIngredientForm'
import { MapIngredientForm } from '../../components/MapIngredientForm'
import { Sheet } from '../../components/Sheet'
import { addAlias } from '../../lib/ingredients'
import {
  commitRecipeImport,
  resolveImportIngredients,
  validateRecipeShape,
  type FieldError,
  type ImportRecipeInput,
  type UnresolvedLine,
} from '../../lib/recipeImport'

interface RecipeImportSheetProps {
  onClose: () => void
  onImported: (recipeId: string) => void
}

const EXAMPLE = `{
  "name": "Aloo Gobhi",
  "servings": 2,
  "prep_min": 30,
  "meal_slots": ["lunch", "dinner"],
  "tags": ["veg", "north-indian"],
  "ingredients": [
    { "name": "potato", "qty": 250, "unit": "g", "optional": false },
    { "name": "cauliflower", "qty": 300, "unit": "g", "optional": false }
  ],
  "steps": ["Chop everything", "Cook until tender"]
}`

type Step =
  | { name: 'resolve'; input: ImportRecipeInput; queue: UnresolvedLine[]; resolvedIds: Map<number, string> }
  | { name: 'confirm'; input: ImportRecipeInput; resolvedIds: Map<number, string> }

export function RecipeImportSheet({ onClose, onImported }: RecipeImportSheetProps) {
  const [text, setText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([])
  const [step, setStep] = useState<Step | null>(null)

  async function validate() {
    setJsonError(null)
    setFieldErrors([])

    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON')
      return
    }

    const result = validateRecipeShape(raw)
    if ('errors' in result) {
      setFieldErrors(result.errors)
      return
    }

    const { resolved, unresolved } = await resolveImportIngredients(result.data.ingredients)
    const resolvedIds = new Map<number, string>()
    resolved.forEach((ing, i) => resolvedIds.set(i, ing.id))

    if (unresolved.length > 0) {
      setStep({ name: 'resolve', input: result.data, queue: unresolved, resolvedIds })
    } else {
      setStep({ name: 'confirm', input: result.data, resolvedIds })
    }
  }

  if (!step) {
    return (
      <Sheet title="Import recipe" onClose={onClose}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-stone-500">Paste JSON in this shape:</p>
          <pre className="max-h-32 overflow-y-auto rounded-md bg-stone-100 p-2 text-xs text-stone-500">{EXAMPLE}</pre>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="Paste recipe JSON here"
            className="rounded-md border border-stone-300 px-3 py-2 font-mono text-xs"
          />
          {jsonError && <p className="text-sm text-red-700">{jsonError}</p>}
          {fieldErrors.length > 0 && (
            <ul className="rounded-md bg-red-50 p-2 text-sm text-red-700">
              {fieldErrors.map((e) => (
                <li key={e.path}>
                  <span className="font-mono">{e.path || '(root)'}</span>: {e.message}
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={validate} className="rounded-md bg-green-800 py-2 text-white">
            Validate
          </button>
        </div>
      </Sheet>
    )
  }

  if (step.name === 'resolve') {
    const current = step.queue[0]
    const advance = (ingredientId: string) => {
      const nextResolvedIds = new Map(step.resolvedIds)
      nextResolvedIds.set(current.index, ingredientId)
      const nextQueue = step.queue.slice(1)
      if (nextQueue.length === 0) {
        setStep({ name: 'confirm', input: step.input, resolvedIds: nextResolvedIds })
      } else {
        setStep({ name: 'resolve', input: step.input, queue: nextQueue, resolvedIds: nextResolvedIds })
      }
    }

    return (
      <ResolveOneIngredient
        query={current.line.name}
        remaining={step.queue.length}
        onResolved={advance}
        onClose={onClose}
      />
    )
  }

  return (
    <Sheet title="Confirm import" onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm text-stone-700">
        <p className="text-base font-medium text-stone-800">{step.input.name}</p>
        <p>
          {step.input.servings} servings · {step.input.prep_min} min · {step.input.meal_slots.join(', ')}
        </p>
        <ul className="list-disc pl-5">
          {step.input.ingredients.map((line, i) => (
            <li key={i}>
              {line.qty}
              {line.unit} {line.name}
              {line.optional ? ' (optional)' : ''}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={async () => {
            const id = await commitRecipeImport(step.input, step.resolvedIds)
            onImported(id)
          }}
          className="rounded-md bg-green-800 py-2 text-white"
        >
          Save recipe
        </button>
      </div>
    </Sheet>
  )
}

function ResolveOneIngredient({
  query,
  remaining,
  onResolved,
  onClose,
}: {
  query: string
  remaining: number
  onResolved: (ingredientId: string) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<'choice' | 'create' | 'map'>('choice')

  if (mode === 'choice') {
    return (
      <Sheet title="Ingredient not found" onClose={onClose}>
        <p className="mb-1 text-sm text-stone-600">
          "{query}" doesn't match any known ingredient or alias. No new ingredient is created without your
          confirmation.
        </p>
        <p className="mb-4 text-xs text-stone-400">{remaining} unresolved ingredient(s) left in this recipe.</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setMode('create')}
            className="rounded-md border border-green-800 py-2 text-green-800"
          >
            Create new ingredient "{query}"
          </button>
          <button
            type="button"
            onClick={() => setMode('map')}
            className="rounded-md border border-stone-300 py-2 text-stone-600"
          >
            This is another name for an ingredient I already have
          </button>
        </div>
      </Sheet>
    )
  }

  if (mode === 'create') {
    return (
      <Sheet title="New ingredient" onClose={onClose}>
        <CreateIngredientForm query={query} onCreated={(ing) => onResolved(ing.id)} />
      </Sheet>
    )
  }

  return (
    <Sheet title={`Map "${query}" to...`} onClose={onClose}>
      <MapIngredientForm
        onSelect={async (ing) => {
          await addAlias(ing.id, query)
          onResolved(ing.id)
        }}
      />
    </Sheet>
  )
}
