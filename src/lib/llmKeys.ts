import Dexie, { type EntityTable } from 'dexie'

interface ApiKeysRow {
  id: 'keys'
  anthropic: string
  groq: string
}

// Separate on-device IndexedDB database from the six core tables (SPEC.md §5) —
// keys are never bundled, committed, or sent anywhere but the provider (§13).
class KeysDB extends Dexie {
  keys!: EntityTable<ApiKeysRow, 'id'>
  constructor() {
    super('pantry-planner-keys')
    this.version(1).stores({ keys: 'id' })
  }
}

const keysDb = new KeysDB()

export interface ApiKeys {
  anthropic: string
  groq: string
}

export async function getApiKeys(): Promise<ApiKeys> {
  const row = await keysDb.keys.get('keys')
  return { anthropic: row?.anthropic ?? '', groq: row?.groq ?? '' }
}

export async function setApiKeys(keys: ApiKeys): Promise<void> {
  await keysDb.keys.put({ id: 'keys', ...keys })
}
