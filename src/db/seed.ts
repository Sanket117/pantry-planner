import { db } from './db'
import type { Ingredient } from './types'

type SeedIngredient = Pick<Ingredient, 'id' | 'canonical_name' | 'aliases' | 'tier' | 'default_unit'>

// Nutrition fields are intentionally left null here — populating them
// accurately is Phase 5 work (SPEC.md §9, §10), not a Phase 2 guess.
const SEED_INGREDIENTS: SeedIngredient[] = [
  // staples
  { id: 'atta', canonical_name: 'Atta', aliases: ['wheat flour', 'gehun ka atta'], tier: 'staple', default_unit: 'g' },
  { id: 'rice', canonical_name: 'Rice', aliases: ['chawal'], tier: 'staple', default_unit: 'g' },
  { id: 'toor-dal', canonical_name: 'Toor Dal', aliases: ['arhar dal', 'tuvar dal', 'pigeon pea'], tier: 'staple', default_unit: 'g' },
  { id: 'moong-dal', canonical_name: 'Moong Dal', aliases: ['mung dal'], tier: 'staple', default_unit: 'g' },
  { id: 'chana-dal', canonical_name: 'Chana Dal', aliases: ['split chickpea'], tier: 'staple', default_unit: 'g' },
  { id: 'sugar', canonical_name: 'Sugar', aliases: ['chini'], tier: 'staple', default_unit: 'g' },
  { id: 'salt', canonical_name: 'Salt', aliases: ['namak'], tier: 'staple', default_unit: 'g' },
  { id: 'cooking-oil', canonical_name: 'Cooking Oil', aliases: ['tel', 'oil'], tier: 'staple', default_unit: 'ml' },
  { id: 'ghee', canonical_name: 'Ghee', aliases: ['clarified butter'], tier: 'staple', default_unit: 'g' },
  { id: 'turmeric-powder', canonical_name: 'Turmeric Powder', aliases: ['haldi'], tier: 'staple', default_unit: 'g' },
  { id: 'red-chilli-powder', canonical_name: 'Red Chilli Powder', aliases: ['lal mirch powder'], tier: 'staple', default_unit: 'g' },
  { id: 'garam-masala', canonical_name: 'Garam Masala', aliases: [], tier: 'staple', default_unit: 'g' },
  { id: 'cumin-seeds', canonical_name: 'Cumin Seeds', aliases: ['jeera'], tier: 'staple', default_unit: 'g' },
  { id: 'mustard-seeds', canonical_name: 'Mustard Seeds', aliases: ['rai', 'sarson'], tier: 'staple', default_unit: 'g' },
  { id: 'coriander-powder', canonical_name: 'Coriander Powder', aliases: ['dhania powder'], tier: 'staple', default_unit: 'g' },
  { id: 'tea-leaves', canonical_name: 'Tea Leaves', aliases: ['chai patti'], tier: 'staple', default_unit: 'g' },
  { id: 'besan', canonical_name: 'Besan', aliases: ['gram flour', 'chickpea flour'], tier: 'staple', default_unit: 'g' },
  { id: 'poha', canonical_name: 'Poha', aliases: ['flattened rice'], tier: 'staple', default_unit: 'g' },
  { id: 'rava', canonical_name: 'Rava', aliases: ['sooji', 'semolina'], tier: 'staple', default_unit: 'g' },
  { id: 'maida', canonical_name: 'Maida', aliases: ['refined flour', 'all-purpose flour'], tier: 'staple', default_unit: 'g' },

  // perishables
  { id: 'onion', canonical_name: 'Onion', aliases: ['pyaz', 'kanda'], tier: 'perishable', default_unit: 'g' },
  { id: 'tomato', canonical_name: 'Tomato', aliases: ['tamatar'], tier: 'perishable', default_unit: 'g' },
  { id: 'potato', canonical_name: 'Potato', aliases: ['aloo'], tier: 'perishable', default_unit: 'g' },
  { id: 'paneer', canonical_name: 'Paneer', aliases: ['panir', 'cottage cheese'], tier: 'perishable', default_unit: 'g' },
  { id: 'milk', canonical_name: 'Milk', aliases: ['doodh'], tier: 'perishable', default_unit: 'ml' },
  { id: 'curd', canonical_name: 'Curd', aliases: ['dahi', 'yogurt'], tier: 'perishable', default_unit: 'g' },
  { id: 'green-chilli', canonical_name: 'Green Chilli', aliases: ['hari mirch'], tier: 'perishable', default_unit: 'g' },
  { id: 'ginger', canonical_name: 'Ginger', aliases: ['adrak'], tier: 'perishable', default_unit: 'g' },
  { id: 'garlic', canonical_name: 'Garlic', aliases: ['lehsun'], tier: 'perishable', default_unit: 'g' },
  { id: 'coriander-leaves', canonical_name: 'Coriander Leaves', aliases: ['dhania', 'cilantro'], tier: 'perishable', default_unit: 'g' },
  { id: 'cauliflower', canonical_name: 'Cauliflower', aliases: ['gobhi', 'phool gobhi'], tier: 'perishable', default_unit: 'g' },
  { id: 'capsicum', canonical_name: 'Capsicum', aliases: ['bell pepper', 'shimla mirch'], tier: 'perishable', default_unit: 'g' },
  { id: 'carrot', canonical_name: 'Carrot', aliases: ['gajar'], tier: 'perishable', default_unit: 'g' },
  { id: 'beans', canonical_name: 'Beans', aliases: ['french beans', 'phalli'], tier: 'perishable', default_unit: 'g' },
  { id: 'spinach', canonical_name: 'Spinach', aliases: ['palak'], tier: 'perishable', default_unit: 'g' },
  { id: 'cabbage', canonical_name: 'Cabbage', aliases: ['patta gobhi'], tier: 'perishable', default_unit: 'g' },
  { id: 'lemon', canonical_name: 'Lemon', aliases: ['nimbu'], tier: 'perishable', default_unit: 'piece' },
  { id: 'banana', canonical_name: 'Banana', aliases: ['kela'], tier: 'perishable', default_unit: 'piece' },
  { id: 'apple', canonical_name: 'Apple', aliases: ['seb'], tier: 'perishable', default_unit: 'piece' },
  { id: 'bread', canonical_name: 'Bread', aliases: ['pav', 'toast bread'], tier: 'perishable', default_unit: 'piece' },
  { id: 'eggs', canonical_name: 'Eggs', aliases: ['anda', 'egg'], tier: 'perishable', default_unit: 'piece' },
  { id: 'butter', canonical_name: 'Butter', aliases: ['makhan'], tier: 'perishable', default_unit: 'g' },
  { id: 'cheese-slices', canonical_name: 'Cheese Slices', aliases: ['cheese'], tier: 'perishable', default_unit: 'piece' },
]

export async function seedIfEmpty(): Promise<void> {
  // Runs inside a single readwrite transaction so two overlapping callers
  // (e.g. React StrictMode's double-invoked effect) serialize instead of
  // both seeing count === 0 and racing on bulkAdd's primary keys.
  await db.transaction('rw', db.ingredients, async () => {
    const count = await db.ingredients.count()
    if (count > 0) return

    await db.ingredients.bulkAdd(
      SEED_INGREDIENTS.map((i) => ({
        ...i,
        kcal_per_100g: null,
        protein_g: null,
        carb_g: null,
        fat_g: null,
      })),
    )
  })
}
