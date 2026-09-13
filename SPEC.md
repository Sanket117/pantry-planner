# Pantry-Driven Meal Planner — Build Specification

**Audience:** a coding agent (Claude Code, Cursor, or equivalent).
**Users:** exactly one. Single-device. No accounts, ever.
**Budget:** ₹0, permanently. Any dependency that can start charging, expire, or rate-limit is disqualified.

---

## 1. What this is

An inventory ledger for a home kitchen, with a meal-planning view on top.

The loop:

1. User adds ingredients they bought.
2. A deterministic planner builds a 7-day meal plan from what is actually in stock.
3. User cooks a meal and marks it done.
4. The pantry decrements.
5. Once a week the user reconciles the ledger against the real fridge.

**This is not a recipe discovery app.** The recipe library is small, hand-curated, and owned by the user. Do not build search, browsing, feeds, or recommendations from an external corpus.

## 2. Non-goals — do not build these

- No authentication, user accounts, or login.
- No backend server, no hosted database, no cloud sync.
- No LLM in the planner, the decrement, or any nutrition calculation. See §13 for where it is permitted.
- No photo/barcode recognition.
- No push notifications.
- No social, sharing, or multi-user features.
- No grocery-store integrations.

If a requirement seems to need any of the above, it is out of scope. Stop and flag it.

## 3. Constraints

| Constraint | Requirement |
|---|---|
| Cost | Zero. No paid service, no API key required to run the app. |
| Offline | Every core function works in airplane mode: pantry, planning, cooking, decrement, reset, nutrition. Only the §13 convenience layer may require network, and its absence must never block anything. |
| Platform | Mobile-first PWA, installable to the Android/iOS home screen. |
| Data ownership | All data on-device. One-tap JSON export and import. |
| Hosting | GitHub Pages (static). |

## 4. Stack

- **Vite + React + TypeScript**
- **Dexie.js** over IndexedDB for persistence
- **Tailwind CSS**
- **vite-plugin-pwa** for the service worker and manifest
- **No state management library.** React context plus Dexie live queries is sufficient at this size.

Build output must be a static bundle deployable to GitHub Pages with a base path (`/pantry/` or similar). Configure `vite.config.ts` `base` accordingly.

## 5. Data model

Six tables in Dexie.

### `ingredients` — the master list

```ts
{
  id: string;              // slug, e.g. "paneer"
  canonical_name: string;  // "Paneer"
  aliases: string[];       // ["panir", "cottage cheese"]
  tier: 'staple' | 'perishable';
  default_unit: 'g' | 'ml' | 'piece' | 'tbsp';
  kcal_per_100g: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
}
```

`aliases` is the normalization mechanism. When the user types a word not in any `canonical_name` or `aliases`, prompt them to either map it to an existing ingredient or create a new one. Match case-insensitively, trimmed. No fuzzy matching in v1 — exact match on the alias list only.

### `pantry` — current stock

```ts
{
  ingredient_id: string;   // primary key
  state: 'have' | 'low' | 'out';   // authoritative for staples
  qty: number | null;              // authoritative for perishables
  unit: string | null;
  added_on: string;                // ISO date
  expires_on: string | null;
  use_count: number;               // staples only; see §6.3
  updated_at: string;
}
```

**Two tiers, two fidelities. This is deliberate — do not unify them.**

- **Staples** (atta, rice, dal, oil, masala, salt, sugar): tracked as `have | low | out` only. No quantities. The user will never weigh these, so precise tracking produces false data.
- **Perishables** (vegetables, paneer, curd, milk, fruit): tracked with `qty` and `expires_on`. These drive the plan and this is where accuracy pays.

### `recipes`

```ts
{
  id: string;
  name: string;
  servings: number;
  prep_min: number;
  meal_slots: ('breakfast' | 'lunch' | 'dinner')[];
  tags: string[];
  steps: string[];
  active: boolean;        // soft-disable without deleting
}
```

### `recipe_ingredients`

```ts
{
  id: string;
  recipe_id: string;
  ingredient_id: string;
  qty: number;
  unit: string;
  optional: boolean;      // garnishes, "to taste" items
}
```

Quantities are for `recipes.servings` servings and scale linearly.

### `plan_entries`

```ts
{
  id: string;
  date: string;           // ISO date
  slot: 'breakfast' | 'lunch' | 'dinner';
  recipe_id: string;
  status: 'planned' | 'cooked' | 'skipped';
  servings_made: number | null;   // set on cook
}
```

### `cook_log`

```ts
{
  id: string;
  plan_entry_id: string;
  cooked_at: string;
  deductions: Array<{
    ingredient_id: string;
    field: 'qty' | 'state' | 'use_count';
    before: number | string;
    after: number | string;
  }>;
  shortfalls: string[];   // ingredient_ids where stock was insufficient
}
```

`deductions` exists so a mis-tap can be undone exactly. Undo replays it in reverse. Do not implement undo by recomputing — replay the log.

## 6. Core logic

### 6.1 Availability check

For a recipe and a given pantry state, compute per non-optional ingredient:

- **Perishable:** available if `pantry.qty >= required_qty`. Partial availability returns the ratio.
- **Staple:** available if `state !== 'out'`. There is no partial.
- **Missing from pantry entirely:** unavailable.

`coverage` = (count of available non-optional ingredients) / (total non-optional ingredients).

### 6.2 Planner scoring

The planner is **plain TypeScript. No model call. It must run offline in under 50ms.**

For each `(date, slot)` in the week, score every active recipe:

```
score = 0

// hard filters — exclude entirely
if (!recipe.meal_slots.includes(slot)) exclude
if (recipe.prep_min > settings.prep_ceiling[slot]) exclude
if (coverage < settings.min_coverage)  // default 0.7
   exclude

// scoring
score += coverage * 100

// expiry urgency: prefer recipes that consume what is about to die
for each perishable in recipe:
  days_left = expires_on - date
  if (days_left <= 3) score += 25
  else if (days_left <= 6) score += 10

// repetition penalty
days_since_last_planned = ...
if (days_since < 7)  score -= 60
if (days_since < 14) score -= 20

// mild randomness to avoid a deterministic rut
score += random(0, 5)
```

Pick the highest scorer.

**Then, critically: deduct that recipe's ingredients from a simulated in-memory copy of the pantry before scoring the next slot.**

Without this forward simulation the planner will schedule the same 200g of paneer across four different meals, the plan will look fine, and the pantry will be empty by Wednesday. This is the single most common way this feature is built wrong. The simulated ledger is discarded once the plan is generated — nothing is written to `pantry` at plan time.

If no recipe clears the filters for a slot, leave the slot empty with reason `"nothing in stock"`. Do not fall back to a recipe the user can't cook.

### 6.3 Decrement on "mark cooked"

```
ratio = servings_made / recipe.servings

for each non-optional recipe ingredient:
  if perishable:
     needed = qty * ratio
     if (pantry.qty < needed) record shortfall
     pantry.qty = max(0, pantry.qty - needed)
  if staple:
     pantry.use_count += 1
     if (use_count >= settings.staple_low_threshold)   // default 8
        state = 'low'; use_count = 0
```

**A staple never auto-transitions to `out`.** Only the user sets `out`, at the weekly reset or manually. The app must not confidently assert an empty jar it cannot see.

**Shortfall behaviour — decided, and the user may override:** if the recipe needs 200g and the pantry says 150g, **allow the cook, deduct to zero, and record a shortfall.** Never block.

Rationale: the user is standing in their kitchen holding the actual paneer. Reality outranks the ledger. An app that refuses to record something that physically happened trains the user to stop using it. Shortfalls surface at the weekly reset as "these ran short — your quantities may be drifting," which is the correct place to fix the data.

### 6.4 Weekly reset

One screen, target completion time under two minutes.

- Staples: a list with three-way toggles (`have | low | out`). Default to current value.
- Perishables: a list with qty steppers and a "gone" button.
- Items flagged as shortfalls in the past week are pinned to the top.
- One confirm button writes all changes in a single transaction.

This is the release valve for inventory drift. Without it the ledger diverges from reality permanently and the app becomes useless in about a month. It is not optional polish — build it in Phase 4.

### 6.5 Shopping list

Derived, never stored. Union of:

- all staples with `state` of `low` or `out`
- all perishables where planned consumption for the coming week exceeds current stock (the deficit quantity)

Grouped by tier. Each line has a checkbox that, when ticked, offers "add to pantry" with the deficit pre-filled.

## 7. Screens

1. **Today** — default view. The day's slots, each showing recipe name, prep time, and a "cooked" button. Tapping a recipe opens steps and scaled quantities.
2. **Week** — 7-day grid. Per-slot: swap (next-best scorer), clear, or lock. A "regenerate" button that respects locked entries.
3. **Pantry** — searchable list grouped by tier. Add item flow includes alias resolution. Inline edit.
4. **Recipes** — list, toggle active, edit. Add via a JSON paste box validated against the `recipes` + `recipe_ingredients` shape, with clear per-field errors.
5. **Reset** — the weekly reconcile screen (§6.4).
6. **Settings** — prep-time ceilings per slot, `min_coverage`, `staple_low_threshold`, JSON export, JSON import, wipe data.

Bottom tab bar: Today / Week / Pantry / More. Thumb-reachable. Every primary action reachable in one tap from Today.

## 8. Recipe import format

The user authors recipes in a chat assistant and pastes JSON. The paste box must accept this exact shape and validate it:

```json
{
  "name": "Aloo Gobhi",
  "servings": 2,
  "prep_min": 30,
  "meal_slots": ["lunch", "dinner"],
  "tags": ["veg", "north-indian", "dry"],
  "ingredients": [
    { "name": "potato", "qty": 250, "unit": "g", "optional": false },
    { "name": "cauliflower", "qty": 300, "unit": "g", "optional": false },
    { "name": "coriander", "qty": 10, "unit": "g", "optional": true }
  ],
  "steps": ["...", "..."]
}
```

On import, resolve each `name` against `ingredients.canonical_name` and `aliases`. Unresolved names block the import and prompt the user to map or create each one. Do not silently create ingredients — that is how the master list fills with duplicates like "tomato", "tomatoes", and "tamatar".

## 9. Build order

Ship each phase working before starting the next. Do not build ahead.

**Phase 1 — Foundation**
Vite + React + TS + Tailwind + Dexie scaffold. Six tables with schema and migrations. PWA manifest and service worker. Deploys to GitHub Pages.
*Acceptance:* installs to home screen; writes survive a force-quit.

**Phase 2 — Pantry only**
Ingredients master list, alias resolution, add/edit/delete, tier split, pantry screen. Seed with 30–50 ingredients.
*Acceptance:* usable as a standalone pantry tracker with no planner at all. **The user runs this for one week before Phase 3 begins.**

**Phase 3 — Recipes and planner**
Recipe CRUD, JSON import with validation, availability check, scoring, forward-simulated week generation, Week screen with swap and lock.
*Acceptance:* generates a 7-day plan from a real pantry in which no ingredient is double-allocated across slots. Write a unit test that asserts exactly this.

**Phase 4 — The loop**
Mark cooked, decrement, `cook_log`, undo, shortfall recording, weekly reset screen.
*Acceptance:* cook a meal, verify the pantry decremented correctly, undo it, verify state restored exactly.

**Phase 5 — Nutrition and shopping**
Per-100g values on ingredients, per-serving and per-day kcal/macro computation **in code**, shopping list derivation, JSON export/import.
*Acceptance:* daily totals recompute correctly when servings change.

## 10. Nutrition rule

Calories and macros are computed by multiplying stored per-100g values by portion weight. **Nothing else is permitted to produce a nutrition number** — no estimation, no heuristic, no model output. If an ingredient has null nutrition data, display the meal's figure as "—" rather than a guess. A wrong number the user trusts is worse than no number.

## 11. Tests that must exist

- Forward simulation: two recipes needing the same perishable cannot both be planned when stock covers only one.
- Decrement: cooking a half batch deducts exactly half.
- Undo: replaying a `cook_log` in reverse restores byte-identical pantry state.
- Alias resolution: an unknown token never silently creates an ingredient.
- Offline: every screen renders and every write succeeds with the network disabled.

## 12. Seed data

The user supplies 15 recipes they genuinely eat, before Phase 3. Not 200. Fifteen real dishes beat a large library of food nobody cooks, and an under-populated recipe table is the most likely reason this app gets abandoned.

---

## 13. Optional LLM layer

The app must be fully usable with no API key configured. This layer is a convenience, never a dependency.

### Where the LLM is permitted

1. **Alias resolution.** User types an unrecognised token ("bhaji", "tamatar"). The model proposes a mapping to an existing ingredient or a new ingredient record. **The user confirms before anything is written.** Never auto-commit a mapping.
2. **Recipe parsing.** User pastes freeform recipe text; the model returns the §8 JSON shape. The user reviews the parsed quantities before saving.

### Where the LLM is forbidden

- The planner (§6.2). It is deterministic code and must stay that way.
- The decrement (§6.3).
- Any nutrition figure (§10).
- Anything that runs without the user watching.

Reason: these three produce numbers the user acts on without re-checking. A hallucinated quantity in the planner silently corrupts the ledger and there is no point at which the user would catch it.

### Provider chain

```
1. Anthropic Claude API   (primary, user-supplied key)
2. Groq                   (fallback, user-supplied key)
3. Manual entry           (always available, always works)
```

Implementation requirements:

- Keys are entered in Settings and stored in IndexedDB on-device. Never bundled, never committed, never sent anywhere but the provider.
- A single `llmComplete(prompt, schema)` function wraps the chain. On HTTP 429, 5xx, timeout (8s), or network failure from Claude, fall through to Groq. On Groq failure, fall through to manual.
- "Manual" is not an error state. It is the normal path — the same form the user would have filled in anyway, with an inline note that AI assist is unavailable. No modal, no retry prompt, no red banner.
- Every model response is validated against the expected JSON schema before it reaches the UI. A malformed response is treated as a provider failure and falls through.
- Requests are per-user-action only. No background calls, no prefetching, no batch jobs.

### Test

Delete both API keys. Every feature in the app must still be reachable and complete. If any flow dead-ends, the layer has been built as a dependency and must be reworked.
