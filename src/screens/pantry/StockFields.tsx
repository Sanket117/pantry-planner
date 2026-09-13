import type { Ingredient, StapleState } from '../../db/types'

export interface StockValue {
  state: StapleState
  qty: string
  unit: string
  expires_on: string
}

interface StockFieldsProps {
  ingredient: Ingredient
  value: StockValue
  onChange: (value: StockValue) => void
}

const STATES: StapleState[] = ['have', 'low', 'out']

export function StockFields({ ingredient, value, onChange }: StockFieldsProps) {
  if (ingredient.tier === 'staple') {
    return (
      <div className="flex flex-col gap-1 text-sm text-stone-600">
        <span>Stock level</span>
        <div className="flex gap-2">
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ ...value, state: s })}
              className={`flex-1 rounded-md border py-2 capitalize ${
                value.state === s ? 'border-green-800 bg-green-800 text-white' : 'border-stone-300 text-stone-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm text-stone-600">
          Quantity
          <input
            type="number"
            min="0"
            value={value.qty}
            onChange={(e) => onChange({ ...value, qty: e.target.value })}
            className="rounded-md border border-stone-300 px-3 py-2"
          />
        </label>
        <label className="flex w-24 flex-col gap-1 text-sm text-stone-600">
          Unit
          <input
            value={value.unit}
            onChange={(e) => onChange({ ...value, unit: e.target.value })}
            className="rounded-md border border-stone-300 px-3 py-2"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm text-stone-600">
        Expires on (optional)
        <input
          type="date"
          value={value.expires_on}
          onChange={(e) => onChange({ ...value, expires_on: e.target.value })}
          className="rounded-md border border-stone-300 px-3 py-2"
        />
      </label>
    </div>
  )
}
