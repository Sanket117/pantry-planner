import { db } from '../db/db'
import type { Tier, Unit } from '../db/types'
import { llmComplete } from './llm'

const TIERS: Tier[] = ['staple', 'perishable']
const UNITS: Unit[] = ['g', 'ml', 'piece', 'tbsp']

export type AliasSuggestion =
  | { type: 'existing'; ingredient_id: string; canonical_name: string }
  | { type: 'new'; canonical_name: string; tier: Tier; default_unit: Unit }

/**
 * SPEC.md §13's first permitted use: propose a mapping for an unrecognized
 * token. The caller must still get the user's explicit confirmation before
 * writing anything — this only returns a suggestion, never commits.
 */
export async function suggestAliasMapping(token: string): Promise<AliasSuggestion | null> {
  const ingredients = await db.ingredients.toArray()
  if (ingredients.length === 0) return null

  const list = ingredients.map((i) => `${i.id}: ${i.canonical_name}`).join('\n')
  const prompt = `You are helping normalize a home pantry ingredient list.
The unrecognized token is: "${token}"

Here is the existing ingredient list (id: canonical name):
${list}

Decide whether "${token}" is very likely just another name (regional word, misspelling, translation) for one of the existing ingredients, or whether it is genuinely a new ingredient.

Respond with ONLY a JSON object, no other text, in one of these two shapes:
{"type": "existing", "ingredient_id": "<id from the list above>"}
{"type": "new", "canonical_name": "<clean display name>", "tier": "staple" | "perishable", "default_unit": "g" | "ml" | "piece" | "tbsp"}

"staple" means a long-shelf-life pantry basic (grain, dal, oil, spice, salt, sugar). "perishable" means it goes off and would be tracked by quantity and expiry (vegetable, dairy, fruit, meat, bread).`

  const knownIds = new Set(ingredients.map((i) => i.id))

  return llmComplete<AliasSuggestion>(prompt, (raw) => {
    if (typeof raw !== 'object' || raw === null) return null
    const obj = raw as Record<string, unknown>

    if (obj.type === 'existing') {
      if (typeof obj.ingredient_id !== 'string' || !knownIds.has(obj.ingredient_id)) return null
      const match = ingredients.find((i) => i.id === obj.ingredient_id)!
      return { type: 'existing', ingredient_id: match.id, canonical_name: match.canonical_name }
    }

    if (obj.type === 'new') {
      if (typeof obj.canonical_name !== 'string' || !obj.canonical_name.trim()) return null
      if (!TIERS.includes(obj.tier as Tier)) return null
      if (!UNITS.includes(obj.default_unit as Unit)) return null
      return {
        type: 'new',
        canonical_name: obj.canonical_name.trim(),
        tier: obj.tier as Tier,
        default_unit: obj.default_unit as Unit,
      }
    }

    return null
  })
}
