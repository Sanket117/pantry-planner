import { llmComplete } from './llm'
import { validateRecipeShape, type ImportRecipeInput } from './recipeImport'

/**
 * SPEC.md §13's second permitted use: turn freeform recipe text into the
 * §8 JSON shape. The result still goes through the normal import pipeline
 * (validate → resolve ingredients → user confirms) — nothing is saved here.
 */
export async function parseFreeformRecipe(text: string): Promise<ImportRecipeInput | null> {
  const prompt = `Convert this recipe into JSON matching exactly this shape:

{
  "name": "string",
  "servings": number,
  "prep_min": number,
  "meal_slots": ["breakfast" | "lunch" | "dinner", ...],
  "tags": ["string", ...],
  "ingredients": [
    { "name": "string", "qty": number, "unit": "string", "optional": boolean }
  ],
  "steps": ["string", ...]
}

Use the ingredient's common lowercase name for "name" (e.g. "potato", "paneer"), not a brand or a full description. Guess reasonable meal_slots and prep_min if not stated. Respond with ONLY the JSON object, no other text.

Recipe:
${text}`

  return llmComplete<ImportRecipeInput>(prompt, (raw) => {
    const result = validateRecipeShape(raw)
    return 'data' in result ? result.data : null
  })
}
