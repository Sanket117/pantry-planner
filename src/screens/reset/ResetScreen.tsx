import { useEffect, useState, type ReactNode } from 'react'
import { db } from '../../db/db'
import type { StapleState } from '../../db/types'
import { usePantryRows, type PantryRow } from '../pantry/usePantryRows'
import { useRecentShortfalls } from './useShortfalls'

interface StapleDraft {
  state: StapleState
}
interface PerishableDraft {
  qty: number
}

export function ResetScreen() {
  const rows = usePantryRows()
  const shortfalls = useRecentShortfalls()

  const [stapleDrafts, setStapleDrafts] = useState<Record<string, StapleDraft> | null>(null)
  const [perishableDrafts, setPerishableDrafts] = useState<Record<string, PerishableDraft> | null>(null)
  const [saved, setSaved] = useState(false)

  // Seed local drafts once the pantry loads. Deliberately not re-synced on
  // every live-query tick — the user is mid-edit and shouldn't get reset by
  // background changes elsewhere in the app.
  useEffect(() => {
    if (rows && stapleDrafts === null) {
      const staples: Record<string, StapleDraft> = {}
      const perishables: Record<string, PerishableDraft> = {}
      for (const row of rows) {
        if (row.ingredient.tier === 'staple') staples[row.ingredient.id] = { state: row.pantry.state }
        else perishables[row.ingredient.id] = { qty: row.pantry.qty ?? 0 }
      }
      setStapleDrafts(staples)
      setPerishableDrafts(perishables)
    }
  }, [rows, stapleDrafts])

  if (!rows || stapleDrafts === null || perishableDrafts === null) {
    return <p className="p-4 text-sm text-stone-400">Loading…</p>
  }

  const staples = rows.filter((r) => r.ingredient.tier === 'staple')
  const perishables = rows.filter((r) => r.ingredient.tier === 'perishable')

  const sortByShortfall = (list: PantryRow[]) =>
    [...list].sort((a, b) => {
      const aFlag = shortfalls?.has(a.ingredient.id) ? 0 : 1
      const bFlag = shortfalls?.has(b.ingredient.id) ? 0 : 1
      if (aFlag !== bFlag) return aFlag - bFlag
      return a.ingredient.canonical_name.localeCompare(b.ingredient.canonical_name)
    })

  async function confirm() {
    await db.transaction('rw', db.pantry, async () => {
      const now = new Date().toISOString()
      for (const [id, draft] of Object.entries(stapleDrafts!)) {
        await db.pantry.update(id, { state: draft.state, updated_at: now })
      }
      for (const [id, draft] of Object.entries(perishableDrafts!)) {
        await db.pantry.update(id, { qty: draft.qty, updated_at: now })
      }
    })
    setSaved(true)
  }

  if (saved) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-green-800">Pantry reconciled ✓</p>
        <p className="text-sm text-stone-500">Come back next week.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">Weekly reset</h1>
        <p className="text-sm text-stone-500">Match the ledger to what's actually in your kitchen. Under 2 minutes.</p>
      </div>

      <Section title="Perishables">
        {sortByShortfall(perishables).map((row) => (
          <div key={row.ingredient.id} className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-sm text-stone-800">
              {row.ingredient.canonical_name}
              {shortfalls?.has(row.ingredient.id) && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">ran short</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={perishableDrafts[row.ingredient.id]?.qty ?? 0}
                onChange={(e) =>
                  setPerishableDrafts((d) => ({ ...d, [row.ingredient.id]: { qty: Number(e.target.value) || 0 } }))
                }
                className="w-20 rounded-md border border-stone-300 px-2 py-1 text-sm"
              />
              <span className="text-xs text-stone-400">{row.pantry.unit}</span>
              <button
                type="button"
                onClick={() => setPerishableDrafts((d) => ({ ...d, [row.ingredient.id]: { qty: 0 } }))}
                className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-500"
              >
                Gone
              </button>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Staples">
        {sortByShortfall(staples).map((row) => (
          <div key={row.ingredient.id} className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-sm text-stone-800">{row.ingredient.canonical_name}</span>
            <div className="flex gap-1">
              {(['have', 'low', 'out'] as StapleState[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStapleDrafts((d) => ({ ...d, [row.ingredient.id]: { state: s } }))}
                  className={`rounded-md border px-2 py-1 text-xs capitalize ${
                    stapleDrafts[row.ingredient.id]?.state === s
                      ? 'border-green-800 bg-green-800 text-white'
                      : 'border-stone-300 text-stone-500'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <button type="button" onClick={confirm} className="rounded-md bg-green-800 py-3 font-medium text-white">
        Confirm reset
      </button>
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
