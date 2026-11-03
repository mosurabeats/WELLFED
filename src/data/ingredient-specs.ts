import type { Ingredient } from "@/lib/types";

/**
 * Built-in ingredient catalog. Nutrient values are NOT typed here: they are
 * generated from the USDA FoodData Central SR Legacy dataset by
 * `scripts/build-nutrients.py` into `usda-nutrients.json`, keyed by fdcId.
 *
 * gramsPerEach / density / yield are kitchen conversions (USDA household
 * measures where available, otherwise standard US package/produce weights).
 */
export type IngredientSpec = Omit<Ingredient, "per100g" | "nutritionSource" | "fdcDescription"> & {
  fdcId: number;
};

const W: IngredientSpec["allergens"] = ["wheat"];

export const INGREDIENT_SPECS: IngredientSpec[] = [
  // ── Meat & poultry ───────────────────────────────────────────────
  { id: "chicken-breast", name: "Chicken breast, boneless skinless", category: "meat", fdcId: 171077, flags: ["meat", "poultry"], protein: "chicken", substituteGroup: "chicken-cut", shopUnit: "lb", shelfDays: 2 },
  { id: "chicken-thigh", name: "Chicken thighs, boneless skinless", category: "meat", fdcId: 173627, flags: ["meat", "poultry"], protein: "chicken", substituteGroup: "chicken-cut", shopUnit: "lb", shelfDays: 2 },
  { id: "chicken-drumstick", name: "Chicken drumsticks", category: "meat", fdcId: 172373, flags: ["meat", "poultry"], protein: "chicken", yield: 0.7, substituteGroup: "chicken-bone-in", shopUnit: "lb", shelfDays: 2 },
  { id: "ground-beef", name: "Ground beef 85% lean", category: "meat", fdcId: 171796, flags: ["meat", "beef"], protein: "beef", substituteGroup: "ground-meat", shopUnit: "lb", shelfDays: 2 },
  { id: "ground-turkey", name: "Ground turkey 93% lean", category: "meat", fdcId: 172850, flags: ["meat", "poultry"], protein: "turkey", substituteGroup: "ground-meat", shopUnit: "lb", shelfDays: 2 },
  { id: "ground-pork", name: "Ground pork", category: "meat", fdcId: 167902, flags: ["meat", "pork"], protein: "pork", substituteGroup: "ground-meat", shopUnit: "lb", shelfDays: 2 },
  { id: "pork-chop", name: "Pork loin chops, boneless", category: "meat", fdcId: 168263, flags: ["meat", "pork"], protein: "pork", substituteGroup: "lean-chop", shopUnit: "lb", shelfDays: 3 },
  { id: "pork-shoulder", name: "Pork shoulder (Boston butt)", category: "meat", fdcId: 167849, flags: ["meat", "pork"], protein: "pork", substituteGroup: "braise-meat", shopUnit: "lb", shelfDays: 3 },
  { id: "italian-sausage", name: "Italian sausage, mild", category: "meat", fdcId: 171631, flags: ["meat", "pork"], protein: "pork", gramsPerEach: 113, eachLabel: "link", shopUnit: "lb", shelfDays: 3 },
  { id: "beef-stew-meat", name: "Beef chuck stew meat", category: "meat", fdcId: 171206, flags: ["meat", "beef"], protein: "beef", substituteGroup: "braise-meat", shopUnit: "lb", shelfDays: 2 },
  { id: "beef-top-round", name: "Beef top round steak", category: "meat", fdcId: 171757, flags: ["meat", "beef"], protein: "beef", substituteGroup: "lean-chop", shopUnit: "lb", shelfDays: 3 },
  { id: "bacon", name: "Bacon", category: "meat", fdcId: 168277, flags: ["meat", "pork"], protein: "pork", gramsPerEach: 28, eachLabel: "slice (raw)", shopUnit: "oz", shelfDays: 7 },

  // ── Seafood ──────────────────────────────────────────────────────
  { id: "salmon", name: "Salmon fillet, Atlantic", category: "seafood", fdcId: 175167, allergens: ["fish"], flags: ["fish"], protein: "fish", substituteGroup: "fish-fillet", shopUnit: "lb", shelfDays: 2 },
  { id: "tilapia", name: "Tilapia fillet", category: "seafood", fdcId: 175176, allergens: ["fish"], flags: ["fish"], protein: "fish", substituteGroup: "fish-fillet", shopUnit: "lb", shelfDays: 2 },
  { id: "tuna-canned", name: "Tuna, light, canned in water", category: "canned", fdcId: 173709, allergens: ["fish"], flags: ["fish"], protein: "fish", gramsPerEach: 113, eachLabel: "5-oz can, drained", shopUnit: "each", shelfDays: 900 },
  { id: "shrimp", name: "Shrimp, raw, peeled", category: "seafood", fdcId: 175179, allergens: ["shellfish"], flags: ["shellfish"], protein: "shellfish", shopUnit: "lb", shelfDays: 2 },

  // ── Eggs, dairy, tofu ────────────────────────────────────────────
  { id: "egg", name: "Eggs, large", category: "eggs", fdcId: 171287, allergens: ["egg"], flags: ["egg"], protein: "egg", gramsPerEach: 50, eachLabel: "large egg", shopUnit: "each", shelfDays: 28 },
  { id: "milk", name: "Milk, 2%", category: "dairy", fdcId: 171267, allergens: ["milk"], flags: ["dairy"], density: 1.03, shopUnit: "floz", shelfDays: 10 },
  { id: "cheddar", name: "Cheddar cheese", category: "dairy", fdcId: 173414, allergens: ["milk"], flags: ["dairy"], density: 0.48, substituteGroup: "melting-cheese", shopUnit: "oz", shelfDays: 30 },
  { id: "monterey-jack", name: "Monterey Jack cheese", category: "dairy", fdcId: 170844, allergens: ["milk"], flags: ["dairy"], density: 0.48, substituteGroup: "melting-cheese", shopUnit: "oz", shelfDays: 30 },
  { id: "mozzarella", name: "Mozzarella, part-skim", category: "dairy", fdcId: 170847, allergens: ["milk"], flags: ["dairy"], density: 0.47, substituteGroup: "melting-cheese", shopUnit: "oz", shelfDays: 21 },
  { id: "parmesan", name: "Parmesan, grated", category: "dairy", fdcId: 171247, allergens: ["milk"], flags: ["dairy"], density: 0.42, shopUnit: "oz", shelfDays: 60 },
  { id: "feta", name: "Feta cheese", category: "dairy", fdcId: 173420, allergens: ["milk"], flags: ["dairy"], density: 0.63, shopUnit: "oz", shelfDays: 21 },
  { id: "ricotta", name: "Ricotta, part-skim", category: "dairy", fdcId: 171248, allergens: ["milk"], flags: ["dairy"], density: 1.04, shopUnit: "oz", shelfDays: 10 },
  { id: "greek-yogurt", name: "Greek yogurt, plain nonfat", category: "dairy", fdcId: 170894, allergens: ["milk"], flags: ["dairy"], density: 1.06, substituteGroup: "yogurt", shopUnit: "oz", shelfDays: 21 },
  { id: "yogurt-plain", name: "Yogurt, plain whole milk", category: "dairy", fdcId: 171284, allergens: ["milk"], flags: ["dairy"], density: 1.03, substituteGroup: "yogurt", shopUnit: "oz", shelfDays: 21 },
  { id: "butter", name: "Butter, salted", category: "dairy", fdcId: 173410, allergens: ["milk"], flags: ["dairy"], density: 0.96, shopUnit: "oz", shelfDays: 60 },
  { id: "sour-cream", name: "Sour cream", category: "dairy", fdcId: 171257, allergens: ["milk"], flags: ["dairy"], density: 0.97, shopUnit: "oz", shelfDays: 21 },
  { id: "cream-cheese", name: "Cream cheese", category: "dairy", fdcId: 173418, allergens: ["milk"], flags: ["dairy"], density: 0.98, shopUnit: "oz", shelfDays: 21 },
  { id: "tofu-firm", name: "Tofu, firm", category: "produce", fdcId: 172475, allergens: ["soy"], protein: "tofu", shopUnit: "oz", shelfDays: 14 },

  // ── Legumes ──────────────────────────────────────────────────────
  { id: "black-beans", name: "Black beans, canned", category: "canned", fdcId: 175188, protein: "legume", gramsPerEach: 425, eachLabel: "15-oz can", density: 1.0, substituteGroup: "canned-bean", shopUnit: "each", shelfDays: 900 },
  { id: "chickpeas", name: "Chickpeas, canned, drained", category: "canned", fdcId: 173800, protein: "legume", gramsPerEach: 255, eachLabel: "15-oz can, drained", density: 0.64, substituteGroup: "canned-bean", shopUnit: "each", shelfDays: 900 },
  { id: "kidney-beans", name: "Kidney beans, canned, drained", category: "canned", fdcId: 174285, protein: "legume", gramsPerEach: 255, eachLabel: "15-oz can, drained", density: 0.68, substituteGroup: "canned-bean", shopUnit: "each", shelfDays: 900 },
  { id: "pinto-beans", name: "Pinto beans, canned, rinsed", category: "canned", fdcId: 173797, protein: "legume", gramsPerEach: 255, eachLabel: "15-oz can, drained", density: 0.68, substituteGroup: "canned-bean", shopUnit: "each", shelfDays: 900 },
  { id: "lentils", name: "Lentils, dry", category: "grains", fdcId: 172420, protein: "legume", density: 0.81, shopUnit: "lb", shelfDays: 365 },
  { id: "peanut-butter", name: "Peanut butter, smooth", category: "condiments", fdcId: 174266, allergens: ["peanut"], density: 1.08, shopUnit: "oz", shelfDays: 180 },
  { id: "peanuts", name: "Peanuts, dry-roasted", category: "condiments", fdcId: 174262, allergens: ["peanut"], density: 0.6, shopUnit: "oz", shelfDays: 180 },
  { id: "hummus", name: "Hummus", category: "dairy", fdcId: 174289, allergens: ["sesame"], density: 1.0, shopUnit: "oz", shelfDays: 10 },

  // ── Grains & bakery ──────────────────────────────────────────────
  { id: "white-rice", name: "White rice, long-grain", category: "grains", fdcId: 168877, density: 0.78, substituteGroup: "rice", shopUnit: "lb", shelfDays: 720 },
  { id: "brown-rice", name: "Brown rice, long-grain", category: "grains", fdcId: 169703, density: 0.78, substituteGroup: "rice", shopUnit: "lb", shelfDays: 270 },
  { id: "quinoa", name: "Quinoa", category: "grains", fdcId: 168874, density: 0.72, shopUnit: "oz", shelfDays: 365 },
  { id: "pasta", name: "Pasta, dry (spaghetti, penne…)", category: "grains", fdcId: 169736, allergens: W, flags: ["gluten"], shopUnit: "lb", shelfDays: 720 },
  { id: "egg-noodles", name: "Egg noodles, dry", category: "grains", fdcId: 169731, allergens: ["wheat", "egg"], flags: ["gluten", "egg"], shopUnit: "oz", shelfDays: 720 },
  { id: "oats", name: "Rolled oats", category: "grains", fdcId: 173904, density: 0.34, shopUnit: "oz", shelfDays: 365 },
  { id: "flour", name: "All-purpose flour", category: "grains", fdcId: 168894, allergens: W, flags: ["gluten"], density: 0.53, shopUnit: "lb", shelfDays: 365, staple: true },
  { id: "breadcrumbs", name: "Breadcrumbs, plain", category: "grains", fdcId: 174928, allergens: W, flags: ["gluten"], density: 0.46, shopUnit: "oz", shelfDays: 180 },
  { id: "wheat-bread", name: "Whole-wheat bread", category: "bakery", fdcId: 172688, allergens: W, flags: ["gluten"], gramsPerEach: 32, eachLabel: "slice", shopUnit: "each", shelfDays: 7 },
  { id: "buns", name: "Hamburger buns", category: "bakery", fdcId: 172796, allergens: W, flags: ["gluten"], gramsPerEach: 44, eachLabel: "bun", shopUnit: "each", shelfDays: 7 },
  { id: "bagel", name: "Bagels, plain", category: "bakery", fdcId: 174899, allergens: W, flags: ["gluten"], gramsPerEach: 105, eachLabel: "bagel", shopUnit: "each", shelfDays: 6 },
  { id: "flour-tortilla", name: "Flour tortillas (8-inch)", category: "bakery", fdcId: 175037, allergens: W, flags: ["gluten"], gramsPerEach: 49, eachLabel: "8-inch tortilla", substituteGroup: "tortilla", shopUnit: "each", shelfDays: 21 },
  { id: "corn-tortilla", name: "Corn tortillas (6-inch)", category: "bakery", fdcId: 175036, gramsPerEach: 26, eachLabel: "6-inch tortilla", substituteGroup: "tortilla", shopUnit: "each", shelfDays: 21 },

  // ── Produce ──────────────────────────────────────────────────────
  { id: "onion", name: "Yellow onion", category: "produce", fdcId: 170000, gramsPerEach: 150, eachLabel: "medium onion", density: 0.67, yield: 0.9, shopUnit: "lb", shelfDays: 30 },
  { id: "garlic", name: "Garlic", category: "produce", fdcId: 169230, gramsPerEach: 3, eachLabel: "clove", density: 0.57, yield: 0.87, shopUnit: "each", shelfDays: 60 },
  { id: "ginger", name: "Ginger root", category: "produce", fdcId: 169231, density: 0.4, yield: 0.9, shopUnit: "oz", shelfDays: 21 },
  { id: "carrot", name: "Carrots", category: "produce", fdcId: 170393, gramsPerEach: 61, eachLabel: "medium carrot", density: 0.54, yield: 0.89, shopUnit: "lb", shelfDays: 28 },
  { id: "celery", name: "Celery", category: "produce", fdcId: 169988, gramsPerEach: 40, eachLabel: "stalk", density: 0.51, yield: 0.89, shopUnit: "each", shelfDays: 14 },
  { id: "potato", name: "Russet potatoes", category: "produce", fdcId: 170027, gramsPerEach: 213, eachLabel: "medium potato", density: 0.63, substituteGroup: "potato", shopUnit: "lb", shelfDays: 30 },
  { id: "sweet-potato", name: "Sweet potatoes", category: "produce", fdcId: 168482, gramsPerEach: 180, eachLabel: "medium sweet potato", density: 0.56, yield: 0.85, substituteGroup: "potato", shopUnit: "lb", shelfDays: 21 },
  { id: "broccoli", name: "Broccoli", category: "produce", fdcId: 170379, gramsPerEach: 600, eachLabel: "bunch (~1.3 lb)", density: 0.37, yield: 0.75, substituteGroup: "green-veg", shopUnit: "lb", shelfDays: 5 },
  { id: "cauliflower", name: "Cauliflower", category: "produce", fdcId: 169986, gramsPerEach: 840, eachLabel: "medium head", density: 0.45, yield: 0.6, shopUnit: "each", shelfDays: 7 },
  { id: "spinach", name: "Baby spinach", category: "produce", fdcId: 168462, density: 0.13, substituteGroup: "leafy-green", shopUnit: "oz", shelfDays: 5 },
  { id: "kale", name: "Kale", category: "produce", fdcId: 168421, density: 0.07, yield: 0.72, substituteGroup: "leafy-green", shopUnit: "oz", shelfDays: 6 },
  { id: "romaine", name: "Romaine lettuce", category: "produce", fdcId: 169247, gramsPerEach: 626, eachLabel: "head", density: 0.2, yield: 0.94, shopUnit: "each", shelfDays: 7 },
  { id: "tomato", name: "Tomatoes", category: "produce", fdcId: 170457, gramsPerEach: 123, eachLabel: "medium tomato", density: 0.76, shopUnit: "lb", shelfDays: 6 },
  { id: "red-pepper", name: "Red bell pepper", category: "produce", fdcId: 170108, gramsPerEach: 164, eachLabel: "medium pepper", density: 0.6, yield: 0.82, substituteGroup: "bell-pepper", shopUnit: "each", shelfDays: 7 },
  { id: "green-pepper", name: "Green bell pepper", category: "produce", fdcId: 170427, gramsPerEach: 164, eachLabel: "medium pepper", density: 0.6, yield: 0.82, substituteGroup: "bell-pepper", shopUnit: "each", shelfDays: 7 },
  { id: "zucchini", name: "Zucchini", category: "produce", fdcId: 169291, gramsPerEach: 196, eachLabel: "medium zucchini", density: 0.53, yield: 0.95, shopUnit: "lb", shelfDays: 6 },
  { id: "cucumber", name: "Cucumber", category: "produce", fdcId: 168409, gramsPerEach: 300, eachLabel: "medium cucumber", density: 0.55, yield: 0.97, shopUnit: "each", shelfDays: 7 },
  { id: "mushrooms", name: "White mushrooms", category: "produce", fdcId: 169251, density: 0.3, yield: 0.97, shopUnit: "oz", shelfDays: 6 },
  { id: "green-beans", name: "Green beans", category: "produce", fdcId: 169961, density: 0.46, yield: 0.88, substituteGroup: "green-veg", shopUnit: "lb", shelfDays: 6 },
  { id: "cabbage", name: "Green cabbage", category: "produce", fdcId: 169975, gramsPerEach: 900, eachLabel: "medium head", density: 0.37, yield: 0.8, shopUnit: "lb", shelfDays: 30 },
  { id: "lemon", name: "Lemons", category: "produce", fdcId: 167747, gramsPerEach: 48, eachLabel: "lemon (juiced, ~3 tbsp)", density: 1.03, shopUnit: "each", shelfDays: 21 },
  { id: "lime", name: "Limes", category: "produce", fdcId: 168156, gramsPerEach: 30, eachLabel: "lime (juiced, ~2 tbsp)", density: 1.02, shopUnit: "each", shelfDays: 21 },
  { id: "banana", name: "Bananas", category: "produce", fdcId: 173944, gramsPerEach: 118, eachLabel: "medium banana (peeled)", density: 0.95, shopUnit: "lb", shelfDays: 5 },
  { id: "apple", name: "Apples", category: "produce", fdcId: 171688, gramsPerEach: 182, eachLabel: "medium apple", density: 0.53, yield: 0.9, shopUnit: "lb", shelfDays: 30 },
  { id: "orange", name: "Oranges, navel", category: "produce", fdcId: 169917, gramsPerEach: 140, eachLabel: "medium orange (peeled)", shopUnit: "each", shelfDays: 21 },
  { id: "strawberries", name: "Strawberries", category: "produce", fdcId: 167762, density: 0.64, yield: 0.94, shopUnit: "oz", shelfDays: 4 },
  { id: "pineapple", name: "Pineapple", category: "produce", fdcId: 169124, gramsPerEach: 905, eachLabel: "pineapple (trimmed flesh)", density: 0.7, shopUnit: "each", shelfDays: 5 },
  { id: "cilantro", name: "Cilantro", category: "produce", fdcId: 169997, density: 0.07, yield: 0.85, shopUnit: "each", gramsPerEach: 60, eachLabel: "bunch", shelfDays: 7 },
  { id: "green-onion", name: "Green onions", category: "produce", fdcId: 170005, gramsPerEach: 15, eachLabel: "scallion", density: 0.42, yield: 0.96, shopUnit: "each", shelfDays: 7 },
  { id: "avocado", name: "Avocados", category: "produce", fdcId: 171705, gramsPerEach: 150, eachLabel: "avocado (flesh)", shopUnit: "each", shelfDays: 4 },

  // ── Frozen ───────────────────────────────────────────────────────
  { id: "frozen-peas", name: "Peas, frozen", category: "frozen", fdcId: 170016, density: 0.57, substituteGroup: "frozen-veg", shopUnit: "oz", shelfDays: 240 },
  { id: "frozen-corn", name: "Corn, frozen", category: "frozen", fdcId: 168398, density: 0.57, substituteGroup: "frozen-veg", shopUnit: "oz", shelfDays: 240 },
  { id: "frozen-mixed-veg", name: "Mixed vegetables, frozen", category: "frozen", fdcId: 170471, density: 0.57, substituteGroup: "frozen-veg", shopUnit: "oz", shelfDays: 240 },
  { id: "frozen-broccoli", name: "Broccoli, frozen", category: "frozen", fdcId: 169968, density: 0.38, substituteGroup: "green-veg", shopUnit: "oz", shelfDays: 240 },
  { id: "frozen-spinach", name: "Spinach, frozen", category: "frozen", fdcId: 169287, density: 0.66, substituteGroup: "leafy-green", shopUnit: "oz", shelfDays: 240 },
  { id: "frozen-blueberries", name: "Blueberries, frozen", category: "frozen", fdcId: 173950, density: 0.65, shopUnit: "oz", shelfDays: 240 },

  // ── Canned & jarred ──────────────────────────────────────────────
  { id: "diced-tomatoes", name: "Diced tomatoes, canned", category: "canned", fdcId: 170051, gramsPerEach: 411, eachLabel: "14.5-oz can", density: 1.02, shopUnit: "each", shelfDays: 720 },
  { id: "tomato-sauce", name: "Tomato sauce, canned", category: "canned", fdcId: 170054, gramsPerEach: 227, eachLabel: "8-oz can", density: 1.03, shopUnit: "each", shelfDays: 720 },
  { id: "tomato-paste", name: "Tomato paste", category: "canned", fdcId: 170459, gramsPerEach: 170, eachLabel: "6-oz can", density: 1.1, shopUnit: "each", shelfDays: 720 },
  { id: "marinara", name: "Marinara / pasta sauce", category: "canned", fdcId: 171192, density: 1.05, shopUnit: "oz", shelfDays: 720 },
  { id: "chicken-broth", name: "Chicken broth", category: "canned", fdcId: 174536, flags: ["meat", "poultry"], density: 1.0, shopUnit: "floz", shelfDays: 720 },
  { id: "coconut-milk", name: "Coconut milk, canned", category: "canned", fdcId: 170173, gramsPerEach: 400, eachLabel: "13.5-oz can", density: 1.0, shopUnit: "each", shelfDays: 720 },
  { id: "salsa", name: "Salsa", category: "condiments", fdcId: 174524, density: 1.05, shopUnit: "oz", shelfDays: 30 },

  // ── Condiments, sweeteners ───────────────────────────────────────
  { id: "soy-sauce", name: "Soy sauce", category: "condiments", fdcId: 174277, allergens: ["soy", "wheat"], flags: ["gluten"], density: 1.15, shopUnit: "floz", shelfDays: 720, staple: true },
  { id: "honey", name: "Honey", category: "condiments", fdcId: 169640, flags: ["honey"], density: 1.42, shopUnit: "oz", shelfDays: 720, staple: true },
  { id: "maple-syrup", name: "Maple syrup", category: "condiments", fdcId: 169661, density: 1.32, shopUnit: "floz", shelfDays: 365 },
  { id: "brown-sugar", name: "Brown sugar", category: "condiments", fdcId: 168833, density: 0.93, shopUnit: "lb", shelfDays: 720, staple: true },
  { id: "sugar", name: "Granulated sugar", category: "condiments", fdcId: 169655, density: 0.85, shopUnit: "lb", shelfDays: 720, staple: true },
  { id: "bbq-sauce", name: "Barbecue sauce", category: "condiments", fdcId: 174523, density: 1.12, shopUnit: "oz", shelfDays: 180 },
  { id: "mustard", name: "Yellow mustard", category: "condiments", fdcId: 172234, density: 1.05, shopUnit: "oz", shelfDays: 365, staple: true },
  { id: "cider-vinegar", name: "Apple cider vinegar", category: "condiments", fdcId: 173469, density: 1.0, shopUnit: "floz", shelfDays: 720, staple: true },
  { id: "dill-pickles", name: "Dill pickles", category: "condiments", fdcId: 168558, density: 0.65, shopUnit: "oz", shelfDays: 90 },
  { id: "sesame-seeds", name: "Sesame seeds", category: "spices", fdcId: 170150, allergens: ["sesame"], density: 0.6, shopUnit: "oz", shelfDays: 365 },
  { id: "cornstarch", name: "Cornstarch", category: "grains", fdcId: 169698, density: 0.54, shopUnit: "oz", shelfDays: 720, staple: true },
  { id: "baking-powder", name: "Baking powder", category: "spices", fdcId: 172803, density: 0.97, shopUnit: "oz", shelfDays: 365, staple: true },

  // ── Oils ─────────────────────────────────────────────────────────
  { id: "olive-oil", name: "Olive oil", category: "oils", fdcId: 171413, density: 0.91, shopUnit: "floz", shelfDays: 540, staple: true },
  { id: "vegetable-oil", name: "Canola / vegetable oil", category: "oils", fdcId: 172336, density: 0.92, shopUnit: "floz", shelfDays: 540, staple: true },
  { id: "sesame-oil", name: "Toasted sesame oil", category: "oils", fdcId: 171016, allergens: ["sesame"], density: 0.92, shopUnit: "floz", shelfDays: 365 },

  // ── Spices (density as g/ml of the ground spice) ─────────────────
  { id: "salt", name: "Salt", category: "spices", fdcId: 173468, density: 1.22, shopUnit: "oz", shelfDays: 3650, staple: true },
  { id: "black-pepper", name: "Black pepper, ground", category: "spices", fdcId: 170931, density: 0.47, shopUnit: "oz", shelfDays: 1095, staple: true },
  { id: "cumin", name: "Cumin, ground", category: "spices", fdcId: 170923, density: 0.43, shopUnit: "oz", shelfDays: 1095, staple: true },
  { id: "chili-powder", name: "Chili powder", category: "spices", fdcId: 171319, density: 0.54, shopUnit: "oz", shelfDays: 1095, staple: true },
  { id: "paprika", name: "Paprika", category: "spices", fdcId: 171329, density: 0.46, shopUnit: "oz", shelfDays: 1095, staple: true },
  { id: "oregano", name: "Oregano, dried", category: "spices", fdcId: 171328, density: 0.2, shopUnit: "oz", shelfDays: 1095, staple: true },
  { id: "basil-dried", name: "Basil, dried", category: "spices", fdcId: 171317, density: 0.15, shopUnit: "oz", shelfDays: 1095, staple: true },
  { id: "thyme", name: "Thyme, dried", category: "spices", fdcId: 170938, density: 0.2, shopUnit: "oz", shelfDays: 1095, staple: true },
  { id: "garlic-powder", name: "Garlic powder", category: "spices", fdcId: 171325, density: 0.66, shopUnit: "oz", shelfDays: 1095, staple: true },
  { id: "cinnamon", name: "Cinnamon, ground", category: "spices", fdcId: 171320, density: 0.53, shopUnit: "oz", shelfDays: 1095, staple: true },
  { id: "ground-ginger", name: "Ginger, ground", category: "spices", fdcId: 170926, density: 0.37, shopUnit: "oz", shelfDays: 1095, staple: true },
  { id: "curry-powder", name: "Curry powder", category: "spices", fdcId: 170924, density: 0.42, shopUnit: "oz", shelfDays: 1095, staple: true },
];
