import { useSyncExternalStore } from 'react'
import type { MealSlot } from '../db/types'

export interface Settings {
  prep_ceiling: Record<MealSlot, number>
  min_coverage: number
  staple_low_threshold: number
}

export const DEFAULT_SETTINGS: Settings = {
  prep_ceiling: { breakfast: 20, lunch: 45, dinner: 45 },
  min_coverage: 0.7,
  staple_low_threshold: 8,
}

const STORAGE_KEY = 'pantry-planner:settings'
const listeners = new Set<() => void>()
let cached: Settings | null = null

function read(): Settings {
  if (cached) return cached
  let result: Settings = DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) result = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // localStorage unavailable or corrupt — fall back to defaults
  }
  cached = result
  return result
}

export function getSettings(): Settings {
  return read()
}

export function setSettings(next: Settings): void {
  cached = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage unavailable — settings stay in-memory for this session
  }
  listeners.forEach((l) => l())
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    getSettings,
    getSettings,
  )
}
