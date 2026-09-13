import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'

/** ingredient_ids that ran short in a cook logged within the last 7 days. */
export function useRecentShortfalls(): Set<string> | undefined {
  return useLiveQuery(async () => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)
    const cutoffIso = cutoff.toISOString()
    // cook_log isn't indexed on cooked_at (small table, personal-scale) — filter in JS.
    const logs = (await db.cook_log.toArray()).filter((l) => l.cooked_at >= cutoffIso)
    return new Set(logs.flatMap((l) => l.shortfalls))
  }, [])
}
