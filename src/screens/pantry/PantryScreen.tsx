import { useState, type ReactNode } from 'react'
import type { PantryRow } from './usePantryRows'
import { usePantryRows } from './usePantryRows'
import { AddItemSheet } from './AddItemSheet'
import { EditItemSheet } from './EditItemSheet'
import { normalizeToken } from '../../lib/ingredients'

const STATE_STYLES: Record<string, string> = {
  have: 'bg-green-100 text-green-800',
  low: 'bg-amber-100 text-amber-800',
  out: 'bg-stone-200 text-stone-500',
}

function matchesSearch(row: PantryRow, search: string): boolean {
  const token = normalizeToken(search)
  if (!token) return true
  if (normalizeToken(row.ingredient.canonical_name).includes(token)) return true
  return row.ingredient.aliases.some((a) => normalizeToken(a).includes(token))
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.round(diff / 86_400_000)
}

export function PantryScreen() {
  const rows = usePantryRows()
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingRow, setEditingRow] = useState<PantryRow | null>(null)

  const visible = (rows ?? []).filter((r) => matchesSearch(r, search))
  const staples = visible.filter((r) => r.ingredient.tier === 'staple')
  const perishables = visible.filter((r) => r.ingredient.tier === 'perishable')

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pantry"
          className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-md bg-green-800 px-3 py-2 text-sm font-medium text-white"
        >
          + Add
        </button>
      </div>

      {rows === undefined && <p className="text-sm text-stone-400">Loading…</p>}

      {rows !== undefined && rows.length === 0 && (
        <p className="mt-8 text-center text-sm text-stone-400">
          Your pantry is empty. Tap "+ Add" to log what you have.
        </p>
      )}

      {perishables.length > 0 && (
        <Section title="Perishables">
          {perishables.map((row) => (
            <PerishableRow key={row.ingredient.id} row={row} onTap={() => setEditingRow(row)} />
          ))}
        </Section>
      )}

      {staples.length > 0 && (
        <Section title="Staples">
          {staples.map((row) => (
            <StapleRow key={row.ingredient.id} row={row} onTap={() => setEditingRow(row)} />
          ))}
        </Section>
      )}

      {adding && <AddItemSheet onClose={() => setAdding(false)} />}
      {editingRow && <EditItemSheet row={editingRow} onClose={() => setEditingRow(null)} />}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">{title}</h2>
      <div className="flex flex-col divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
        {children}
      </div>
    </div>
  )
}

function StapleRow({ row, onTap }: { row: PantryRow; onTap: () => void }) {
  return (
    <button type="button" onClick={onTap} className="flex items-center justify-between px-3 py-3 text-left">
      <span className="text-sm text-stone-800">{row.ingredient.canonical_name}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATE_STYLES[row.pantry.state]}`}>
        {row.pantry.state}
      </span>
    </button>
  )
}

function PerishableRow({ row, onTap }: { row: PantryRow; onTap: () => void }) {
  const days = daysUntil(row.pantry.expires_on)
  return (
    <button type="button" onClick={onTap} className="flex items-center justify-between px-3 py-3 text-left">
      <span className="text-sm text-stone-800">{row.ingredient.canonical_name}</span>
      <span className="flex items-center gap-2 text-xs text-stone-500">
        <span>
          {row.pantry.qty ?? 0}
          {row.pantry.unit}
        </span>
        {days !== null && (
          <span className={days <= 3 ? 'font-medium text-red-600' : ''}>
            {days < 0 ? 'expired' : `${days}d left`}
          </span>
        )}
      </span>
    </button>
  )
}
