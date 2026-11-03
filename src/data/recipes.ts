import type { MealType, Recipe, RecipeIngredient, Unit } from "@/lib/types";

/**
 * Built-in recipe library. Quantities are purchased weights/measures for the
 * listed servings. Nutrition, cost and allergens are never stored here — they
 * are calculated from the ingredient catalog (USDA data) and current prices.
 */
const i = (ingredientId: string, qty: number, unit: Unit, note?: string, optional?: boolean): RecipeIngredient => ({
  ingredientId,
  qty,
  unit,
  ...(note ? { note } : {}),
  ...(optional ? { optional } : {}),
});

type Def = Omit<Recipe, "source" | "difficulty" | "storage" | "leftovers"> &
  Partial<Pick<Recipe, "difficulty" | "storage" | "leftovers">>;

const B: MealType[] = ["breakfast"];
const LD: MealType[] = ["lunch", "dinner"];
const D: MealType[] = ["dinner"];
const L: MealType[] = ["lunch"];
const S: MealType[] = ["snack"];

const defs: Def[] = [
  // ── Breakfast ─────────────────────────────────────────────────────
  {
    id: "overnight-oats", name: "Berry Overnight Oats", servings: 4, prepMinutes: 10, cookMinutes: 0, mealTypes: B,
    description: "Oats soaked overnight in milk and yogurt with blueberries and a little maple. Grab-and-go.",
    ingredients: [i("oats", 2, "cup"), i("milk", 2, "cup"), i("greek-yogurt", 1, "cup"), i("frozen-blueberries", 1.5, "cup"), i("maple-syrup", 2, "tbsp"), i("cinnamon", 0.5, "tsp")],
    steps: ["Stir oats, milk, yogurt, maple and cinnamon together.", "Divide into 4 jars and top with blueberries.", "Cover and refrigerate at least 6 hours or overnight."],
    tags: ["kid-friendly", "make-ahead", "vegetarian", "high-fiber"], storage: "Refrigerate up to 4 days.", leftovers: "Made to be eaten over several mornings.",
  },
  {
    id: "veggie-scramble", name: "Veggie Scramble & Toast", servings: 4, prepMinutes: 10, cookMinutes: 10, mealTypes: B,
    description: "Soft eggs scrambled with spinach, peppers and cheddar, with whole-wheat toast.",
    ingredients: [i("egg", 8, "each"), i("milk", 0.25, "cup"), i("spinach", 3, "oz"), i("red-pepper", 1, "each"), i("cheddar", 2, "oz"), i("butter", 1, "tbsp"), i("wheat-bread", 4, "each"), i("salt", 0.25, "tsp"), i("black-pepper", 0.25, "tsp")],
    steps: ["Dice the pepper; whisk eggs with milk, salt and pepper.", "Melt butter in a nonstick skillet over medium; cook pepper 3 minutes, add spinach until wilted.", "Pour in eggs and stir gently until just set. Fold in cheddar.", "Serve with toast."],
    tags: ["kid-friendly", "vegetarian", "high-protein", "quick"], storage: "Best fresh.", leftovers: "Wrap leftovers in a tortilla for lunch.",
  },
  {
    id: "yogurt-parfait", name: "Greek Yogurt Parfaits", servings: 4, prepMinutes: 5, cookMinutes: 0, mealTypes: B,
    description: "Protein-rich Greek yogurt layered with banana, berries, toasted oats and honey.",
    ingredients: [i("greek-yogurt", 3, "cup"), i("banana", 2, "each"), i("strawberries", 8, "oz"), i("oats", 0.5, "cup"), i("honey", 2, "tbsp")],
    steps: ["Toast oats in a dry pan 3–4 minutes until fragrant.", "Slice banana and strawberries.", "Layer yogurt, fruit and oats; drizzle with honey."],
    tags: ["kid-friendly", "vegetarian", "high-protein", "quick"], storage: "Assemble fresh; fruit keeps cut 1 day.", leftovers: "Keep oats separate so they stay crunchy.",
  },
  {
    id: "banana-pancakes", name: "Banana Oat Pancakes", servings: 4, prepMinutes: 10, cookMinutes: 15, mealTypes: B,
    description: "Fluffy weekend pancakes with mashed banana and oats for extra fiber.",
    ingredients: [i("flour", 1, "cup"), i("oats", 0.5, "cup"), i("baking-powder", 2, "tsp"), i("salt", 0.25, "tsp"), i("egg", 2, "each"), i("milk", 1.25, "cup"), i("banana", 2, "each"), i("butter", 2, "tbsp"), i("maple-syrup", 0.25, "cup", "to serve")],
    steps: ["Whisk flour, oats, baking powder and salt.", "Mash bananas; whisk with eggs, milk and 1 tbsp melted butter.", "Stir wet into dry until just combined.", "Cook ¼-cup portions on a buttered griddle over medium, 2 minutes per side.", "Serve with maple syrup."],
    tags: ["kid-friendly", "vegetarian"], storage: "Freeze cooled pancakes up to 2 months.", leftovers: "Reheat in the toaster.",
  },
  {
    id: "pb-banana-toast", name: "Peanut Butter Banana Toast", servings: 4, prepMinutes: 5, cookMinutes: 3, mealTypes: B,
    description: "Whole-wheat toast with peanut butter, sliced banana and cinnamon.",
    ingredients: [i("wheat-bread", 8, "each"), i("peanut-butter", 0.5, "cup"), i("banana", 2, "each"), i("cinnamon", 0.5, "tsp")],
    steps: ["Toast the bread.", "Spread with peanut butter, top with banana slices and a pinch of cinnamon."],
    tags: ["kid-friendly", "vegetarian", "vegan", "quick"], storage: "Best fresh.", leftovers: "—",
  },
  {
    id: "egg-muffins", name: "Spinach Cheddar Egg Muffins", servings: 4, prepMinutes: 10, cookMinutes: 22, mealTypes: B,
    description: "Make-ahead baked egg bites with spinach, pepper and cheddar. Three per serving.",
    ingredients: [i("egg", 10, "each"), i("milk", 0.25, "cup"), i("spinach", 3, "oz"), i("red-pepper", 1, "each"), i("cheddar", 3, "oz"), i("vegetable-oil", 1, "tsp"), i("salt", 0.25, "tsp")],
    steps: ["Heat oven to 350°F and oil a 12-cup muffin tin.", "Chop spinach and pepper; divide among cups with cheddar.", "Whisk eggs, milk and salt; pour over the vegetables.", "Bake 20–22 minutes until set."],
    tags: ["make-ahead", "vegetarian", "high-protein", "gluten-free"], storage: "Refrigerate 4 days or freeze 2 months.", leftovers: "Microwave 30–45 seconds.",
  },
  {
    id: "breakfast-burritos", name: "Bean & Egg Breakfast Burritos", servings: 4, prepMinutes: 10, cookMinutes: 10, mealTypes: ["breakfast", "lunch"],
    description: "Scrambled eggs, black beans, salsa and cheddar rolled in flour tortillas. Freezer friendly.",
    ingredients: [i("egg", 6, "each"), i("black-beans", 1, "each", "drained, rinsed"), i("salsa", 0.5, "cup"), i("cheddar", 3, "oz"), i("flour-tortilla", 4, "each"), i("butter", 1, "tsp")],
    steps: ["Warm beans with salsa in a small pan.", "Scramble eggs in butter until just set.", "Fill warm tortillas with eggs, beans and cheese; roll tightly."],
    tags: ["kid-friendly", "vegetarian", "high-fiber", "make-ahead"], storage: "Wrap and freeze up to 2 months.", leftovers: "Microwave from frozen 2 minutes, turning once.",
  },
  {
    id: "apple-oatmeal", name: "Cinnamon Apple Oatmeal", servings: 4, prepMinutes: 5, cookMinutes: 10, mealTypes: B,
    description: "Stovetop oats cooked in milk with diced apple, cinnamon and a spoon of peanut butter.",
    ingredients: [i("oats", 2, "cup"), i("milk", 2, "cup"), i("apple", 2, "each"), i("cinnamon", 1, "tsp"), i("brown-sugar", 2, "tbsp"), i("peanut-butter", 4, "tbsp"), i("salt", 0.125, "tsp")],
    steps: ["Dice apples.", "Simmer milk, 1½ cups water, oats, apple, cinnamon and salt 6–8 minutes, stirring.", "Top each bowl with brown sugar and a tablespoon of peanut butter."],
    tags: ["kid-friendly", "vegetarian", "high-fiber"], storage: "Refrigerate 3 days.", leftovers: "Loosen with milk when reheating.",
  },

  // ── Lunch & dinner ────────────────────────────────────────────────
  {
    id: "sheet-pan-chicken", name: "Sheet-Pan Chicken Thighs, Potatoes & Broccoli", servings: 4, prepMinutes: 15, cookMinutes: 35, mealTypes: D,
    description: "Paprika-garlic chicken thighs roasted on one pan with crispy potatoes and broccoli.",
    ingredients: [i("chicken-thigh", 1.5, "lb"), i("potato", 1.5, "lb"), i("broccoli", 1, "lb"), i("olive-oil", 3, "tbsp"), i("paprika", 2, "tsp"), i("garlic-powder", 1, "tsp"), i("salt", 1, "tsp"), i("black-pepper", 0.5, "tsp"), i("lemon", 1, "each", "for serving", true)],
    steps: ["Heat oven to 425°F.", "Cut potatoes into 1-inch chunks; toss with 1½ tbsp oil and half the seasonings. Roast 15 minutes.", "Toss chicken with remaining oil and seasonings; add to the pan. Roast 10 minutes.", "Add broccoli florets and roast 10–12 minutes more, until chicken reaches 175°F.", "Squeeze lemon over to serve."],
    tags: ["kid-friendly", "one-pan", "high-protein", "gluten-free", "dairy-free"], storage: "Refrigerate up to 3 days.", leftovers: "Reheat in a 400°F oven or air fryer to re-crisp.",
  },
  {
    id: "chicken-broccoli-stirfry", name: "Chicken & Broccoli Stir-Fry", servings: 4, prepMinutes: 15, cookMinutes: 15, mealTypes: D,
    description: "Tender chicken and broccoli in a garlic-ginger soy glaze over rice.",
    ingredients: [i("chicken-breast", 1.25, "lb"), i("broccoli", 1, "lb"), i("carrot", 2, "each"), i("garlic", 3, "each"), i("ginger", 1, "tbsp", "grated"), i("soy-sauce", 3, "tbsp"), i("honey", 1, "tbsp"), i("cornstarch", 1, "tbsp"), i("vegetable-oil", 2, "tbsp"), i("white-rice", 1.5, "cup")],
    steps: ["Cook rice according to package.", "Slice chicken thin; toss with cornstarch. Whisk soy, honey and ¼ cup water.", "Sear chicken in 1 tbsp oil over high heat until browned; remove.", "Stir-fry broccoli and sliced carrot in remaining oil 4 minutes; add garlic and ginger 30 seconds.", "Return chicken, add sauce and toss until glossy. Serve over rice."],
    tags: ["kid-friendly", "high-protein", "dairy-free", "quick"], storage: "Refrigerate 3 days.", leftovers: "Great packed for lunch.",
  },
  {
    id: "turkey-taco-bowls", name: "Turkey Taco Rice Bowls", servings: 4, prepMinutes: 10, cookMinutes: 20, mealTypes: LD,
    description: "Seasoned ground turkey with rice, black beans, corn, salsa and cheese.",
    ingredients: [i("ground-turkey", 1, "lb"), i("white-rice", 1, "cup"), i("black-beans", 1, "each", "drained"), i("frozen-corn", 1, "cup"), i("salsa", 0.75, "cup"), i("cheddar", 2, "oz"), i("romaine", 0.5, "each"), i("chili-powder", 1, "tbsp"), i("cumin", 1, "tsp"), i("garlic-powder", 0.5, "tsp"), i("salt", 0.5, "tsp"), i("vegetable-oil", 1, "tsp"), i("lime", 1, "each", "wedges", true)],
    steps: ["Cook rice.", "Brown turkey in oil, breaking it up. Add spices, salt and ⅓ cup water; simmer 3 minutes.", "Warm beans and corn together.", "Build bowls: rice, turkey, beans and corn, shredded romaine, salsa and cheese. Add lime."],
    tags: ["kid-friendly", "high-protein", "high-fiber", "gluten-free", "build-your-own"], storage: "Store components separately up to 4 days.", leftovers: "Turns into burritos or nachos.",
  },
  {
    id: "beef-bean-chili", name: "Beef & Bean Chili", servings: 6, prepMinutes: 15, cookMinutes: 40, mealTypes: LD,
    description: "A hearty pot of chili with ground beef, two kinds of beans and peppers.",
    ingredients: [i("ground-beef", 1, "lb"), i("onion", 1, "each"), i("green-pepper", 1, "each"), i("garlic", 3, "each"), i("kidney-beans", 1, "each"), i("black-beans", 1, "each"), i("diced-tomatoes", 2, "each"), i("tomato-sauce", 1, "each"), i("chili-powder", 2, "tbsp"), i("cumin", 2, "tsp"), i("salt", 1, "tsp"), i("cheddar", 2, "oz", "to top", true), i("sour-cream", 0.5, "cup", "to top", true)],
    steps: ["Brown beef in a large pot; drain excess fat.", "Add diced onion and pepper; cook 5 minutes. Add garlic and spices 1 minute.", "Add beans, tomatoes and sauce. Simmer covered 30 minutes, stirring now and then.", "Season and serve with cheese and sour cream."],
    tags: ["kid-friendly", "high-protein", "high-fiber", "gluten-free", "freezer-friendly", "batch"], storage: "Refrigerate 4 days or freeze 3 months.", leftovers: "Tastes better the next day; plan it for lunch.",
  },
  {
    id: "spaghetti-turkey-sauce", name: "Spaghetti with Turkey Meat Sauce", servings: 4, prepMinutes: 10, cookMinutes: 25, mealTypes: D,
    description: "Weeknight spaghetti with a lean turkey and vegetable tomato sauce.",
    ingredients: [i("pasta", 12, "oz"), i("ground-turkey", 1, "lb"), i("marinara", 24, "oz"), i("onion", 0.5, "each"), i("carrot", 1, "each", "finely grated"), i("garlic", 2, "each"), i("olive-oil", 1, "tbsp"), i("oregano", 1, "tsp"), i("parmesan", 1, "oz"), i("salt", 0.5, "tsp")],
    steps: ["Boil pasta in salted water.", "Cook diced onion and grated carrot in oil 5 minutes; add garlic.", "Add turkey and brown, breaking it up. Stir in marinara and oregano; simmer 10 minutes.", "Toss with drained pasta; top with parmesan."],
    tags: ["kid-friendly", "high-protein"], storage: "Refrigerate 4 days; sauce freezes 3 months.", leftovers: "Sauce doubles easily for another night.",
  },
  {
    id: "salmon-sweet-potato", name: "Baked Salmon, Sweet Potatoes & Green Beans", servings: 4, prepMinutes: 10, cookMinutes: 30, mealTypes: D,
    description: "Lemon-garlic salmon with roasted sweet potatoes and green beans. Omega-3 rich.",
    ingredients: [i("salmon", 1.25, "lb"), i("sweet-potato", 1.5, "lb"), i("green-beans", 1, "lb"), i("olive-oil", 2, "tbsp"), i("lemon", 1, "each"), i("garlic", 2, "each"), i("salt", 0.75, "tsp"), i("black-pepper", 0.25, "tsp")],
    steps: ["Heat oven to 425°F. Cube sweet potatoes, toss with 1 tbsp oil and salt; roast 15 minutes.", "Add green beans to the pan with remaining oil.", "Nestle salmon on the pan; top with minced garlic, lemon zest and juice.", "Roast 12–15 minutes until salmon flakes (145°F)."],
    tags: ["high-protein", "gluten-free", "dairy-free", "one-pan"], storage: "Refrigerate 2 days.", leftovers: "Flake cold salmon over a salad.",
  },
  {
    id: "lentil-veg-soup", name: "Lentil Vegetable Soup", servings: 6, prepMinutes: 15, cookMinutes: 35, mealTypes: LD,
    description: "Thick, budget-friendly soup with lentils, carrots, celery, tomatoes and spinach.",
    ingredients: [i("lentils", 1.5, "cup"), i("onion", 1, "each"), i("carrot", 3, "each"), i("celery", 2, "each"), i("garlic", 3, "each"), i("diced-tomatoes", 1, "each"), i("spinach", 4, "oz"), i("olive-oil", 2, "tbsp"), i("cumin", 1, "tsp"), i("thyme", 1, "tsp"), i("salt", 1.5, "tsp"), i("lemon", 1, "each")],
    steps: ["Cook diced onion, carrot and celery in oil 6 minutes. Add garlic and spices.", "Add rinsed lentils, tomatoes, 7 cups water and salt. Simmer 25–30 minutes until lentils are tender.", "Stir in spinach and lemon juice."],
    tags: ["vegetarian", "vegan", "high-fiber", "gluten-free", "dairy-free", "freezer-friendly", "batch", "lower-fat", "budget"], storage: "Refrigerate 5 days or freeze 3 months.", leftovers: "Thickens overnight — add water when reheating.",
  },
  {
    id: "chickpea-curry", name: "Chickpea & Spinach Coconut Curry", servings: 4, prepMinutes: 10, cookMinutes: 25, mealTypes: D,
    description: "Mild, creamy curry with chickpeas, tomatoes and spinach over rice.",
    ingredients: [i("chickpeas", 2, "each"), i("coconut-milk", 1, "each"), i("diced-tomatoes", 1, "each"), i("onion", 1, "each"), i("garlic", 3, "each"), i("ginger", 1, "tbsp"), i("curry-powder", 1.5, "tbsp"), i("spinach", 5, "oz"), i("vegetable-oil", 1, "tbsp"), i("salt", 0.75, "tsp"), i("white-rice", 1.5, "cup")],
    steps: ["Cook rice.", "Soften diced onion in oil 5 minutes; add garlic, ginger and curry powder 1 minute.", "Add tomatoes, coconut milk, chickpeas and salt; simmer 15 minutes.", "Stir in spinach until wilted. Serve over rice."],
    tags: ["vegetarian", "vegan", "high-fiber", "gluten-free", "dairy-free"], storage: "Refrigerate 4 days.", leftovers: "Freezes well without the rice.",
  },
  {
    id: "black-bean-quesadillas", name: "Black Bean & Corn Quesadillas", servings: 4, prepMinutes: 10, cookMinutes: 15, mealTypes: LD,
    description: "Crispy quesadillas filled with black beans, corn, peppers and Monterey Jack.",
    ingredients: [i("flour-tortilla", 8, "each"), i("black-beans", 1, "each"), i("frozen-corn", 1, "cup"), i("red-pepper", 1, "each"), i("monterey-jack", 6, "oz"), i("cumin", 1, "tsp"), i("salsa", 0.5, "cup"), i("greek-yogurt", 0.5, "cup", "instead of sour cream")],
    steps: ["Mash half the beans; mix with whole beans, corn, diced pepper and cumin.", "Spread on 4 tortillas, top with cheese and remaining tortillas.", "Cook in a dry skillet over medium 3 minutes per side.", "Cut into wedges; serve with salsa and yogurt."],
    tags: ["kid-friendly", "vegetarian", "high-fiber", "quick"], storage: "Filling keeps 4 days.", leftovers: "Re-crisp in a skillet.",
  },
  {
    id: "chicken-fajitas", name: "Chicken Fajitas", servings: 4, prepMinutes: 15, cookMinutes: 15, mealTypes: D,
    description: "Sizzling chicken with peppers and onions in warm tortillas.",
    ingredients: [i("chicken-breast", 1.25, "lb"), i("red-pepper", 1, "each"), i("green-pepper", 1, "each"), i("onion", 1, "each"), i("flour-tortilla", 8, "each"), i("chili-powder", 2, "tsp"), i("cumin", 1, "tsp"), i("paprika", 1, "tsp"), i("lime", 1, "each"), i("vegetable-oil", 2, "tbsp"), i("salt", 0.75, "tsp"), i("salsa", 0.5, "cup"), i("greek-yogurt", 0.5, "cup")],
    steps: ["Slice chicken, peppers and onion into strips. Toss chicken with spices, salt and lime juice.", "Sear chicken in 1 tbsp oil over high heat 6 minutes; remove.", "Cook vegetables in remaining oil until charred at edges, 5 minutes. Return chicken.", "Serve in warm tortillas with salsa and yogurt."],
    tags: ["kid-friendly", "high-protein", "quick", "build-your-own"], storage: "Refrigerate 3 days.", leftovers: "Fajita bowls with rice for lunch.",
  },
  {
    id: "pork-chops-apples", name: "Pork Chops with Apples & Roasted Carrots", servings: 4, prepMinutes: 10, cookMinutes: 25, mealTypes: D,
    description: "Seared pork chops with a cider-thyme apple pan sauce and honey-roasted carrots.",
    ingredients: [i("pork-chop", 1.5, "lb"), i("apple", 2, "each"), i("carrot", 1, "lb"), i("onion", 0.5, "each"), i("cider-vinegar", 2, "tbsp"), i("chicken-broth", 0.5, "cup"), i("thyme", 1, "tsp"), i("honey", 1, "tbsp"), i("olive-oil", 2, "tbsp"), i("salt", 1, "tsp"), i("black-pepper", 0.5, "tsp")],
    steps: ["Heat oven to 425°F. Toss carrot sticks with 1 tbsp oil, honey and salt; roast 20–25 minutes.", "Season chops; sear in remaining oil 4 minutes per side until 145°F. Rest on a plate.", "Cook sliced onion and apples in the pan 4 minutes. Add vinegar, broth and thyme; simmer 3 minutes.", "Spoon apples and sauce over chops."],
    tags: ["high-protein", "gluten-free", "dairy-free"], storage: "Refrigerate 3 days.", leftovers: "Slice pork for sandwiches.",
  },
  {
    id: "fish-tacos", name: "Crispy Fish Tacos with Lime Slaw", servings: 4, prepMinutes: 15, cookMinutes: 12, mealTypes: D,
    description: "Spiced baked tilapia in corn tortillas with crunchy cabbage-lime slaw.",
    ingredients: [i("tilapia", 1.25, "lb"), i("corn-tortilla", 12, "each"), i("cabbage", 0.5, "lb"), i("carrot", 1, "each"), i("lime", 2, "each"), i("greek-yogurt", 0.5, "cup"), i("chili-powder", 1, "tsp"), i("cumin", 1, "tsp"), i("garlic-powder", 0.5, "tsp"), i("olive-oil", 1, "tbsp"), i("salt", 0.75, "tsp"), i("cilantro", 0.5, "each", undefined, true), i("avocado", 1, "each", undefined, true)],
    steps: ["Heat oven to 425°F. Rub fish with oil, spices and half the salt. Bake 10–12 minutes.", "Shred cabbage and carrot; toss with juice of 1 lime, yogurt and remaining salt.", "Warm tortillas. Fill with flaked fish, slaw, avocado and cilantro."],
    tags: ["high-protein", "gluten-free", "quick"], storage: "Store fish and slaw separately 2 days.", leftovers: "Fish keeps for a taco salad.",
  },
  {
    id: "shrimp-fried-rice", name: "Shrimp Fried Rice", servings: 4, prepMinutes: 10, cookMinutes: 15, mealTypes: D,
    description: "Better-than-takeout fried rice with shrimp, eggs, peas and carrots.",
    ingredients: [i("shrimp", 0.75, "lb"), i("white-rice", 1.5, "cup", "cooked a day ahead is best"), i("egg", 3, "each"), i("frozen-peas", 1, "cup"), i("carrot", 2, "each"), i("green-onion", 4, "each"), i("garlic", 2, "each"), i("soy-sauce", 3, "tbsp"), i("sesame-oil", 1, "tsp"), i("vegetable-oil", 2, "tbsp")],
    steps: ["Cook rice and spread to cool (or use leftover rice).", "Scramble eggs in 1 tsp oil; remove.", "Sear shrimp in 1 tbsp oil 2 minutes; remove.", "Stir-fry diced carrot, peas and garlic 3 minutes. Add rice and remaining oil; fry 4 minutes.", "Add soy, sesame oil, eggs, shrimp and green onions; toss."],
    tags: ["high-protein", "dairy-free", "quick"], storage: "Refrigerate 3 days.", leftovers: "Reheat in a hot skillet.",
  },
  {
    id: "veg-egg-fried-rice", name: "Vegetable Egg Fried Rice", servings: 4, prepMinutes: 10, cookMinutes: 12, mealTypes: LD,
    description: "Budget fried rice with eggs and mixed vegetables — a great leftover-rice rescue.",
    ingredients: [i("white-rice", 1.5, "cup"), i("egg", 5, "each"), i("frozen-mixed-veg", 2, "cup"), i("green-onion", 3, "each"), i("garlic", 2, "each"), i("soy-sauce", 3, "tbsp"), i("sesame-oil", 1, "tsp"), i("vegetable-oil", 2, "tbsp")],
    steps: ["Cook and cool rice.", "Scramble eggs in a little oil; remove.", "Stir-fry vegetables and garlic 3 minutes; add rice and fry 4 minutes.", "Add soy, sesame oil, eggs and green onions."],
    tags: ["kid-friendly", "vegetarian", "dairy-free", "quick", "budget"], storage: "Refrigerate 3 days.", leftovers: "Packs well for lunch.",
  },
  {
    id: "chicken-noodle-soup", name: "Chicken Noodle Soup", servings: 6, prepMinutes: 15, cookMinutes: 30, mealTypes: LD,
    description: "Classic comforting soup with chicken thighs, egg noodles, carrots and celery.",
    ingredients: [i("chicken-thigh", 1, "lb"), i("egg-noodles", 6, "oz"), i("carrot", 3, "each"), i("celery", 3, "each"), i("onion", 1, "each"), i("garlic", 2, "each"), i("chicken-broth", 64, "floz"), i("thyme", 1, "tsp"), i("olive-oil", 1, "tbsp"), i("salt", 0.5, "tsp"), i("black-pepper", 0.25, "tsp")],
    steps: ["Cook diced onion, carrot and celery in oil 6 minutes; add garlic.", "Add broth, thyme and whole chicken thighs. Simmer 20 minutes.", "Remove chicken and shred. Add noodles and cook 7 minutes.", "Return chicken; season."],
    tags: ["kid-friendly", "high-protein", "dairy-free", "batch"], storage: "Refrigerate 4 days. Freeze without noodles.", leftovers: "Noodles soften; add a splash of broth.",
  },
  {
    id: "beef-stew", name: "Beef Stew with Potatoes & Carrots", servings: 6, prepMinutes: 20, cookMinutes: 120, mealTypes: D, difficulty: "medium",
    description: "Slow-simmered chuck stew with potatoes, carrots and peas. A cold-night classic.",
    ingredients: [i("beef-stew-meat", 1.5, "lb"), i("potato", 1.5, "lb"), i("carrot", 4, "each"), i("onion", 1, "each"), i("celery", 2, "each"), i("garlic", 3, "each"), i("tomato-paste", 2, "tbsp"), i("chicken-broth", 32, "floz"), i("flour", 3, "tbsp"), i("frozen-peas", 1, "cup"), i("thyme", 1, "tsp"), i("vegetable-oil", 2, "tbsp"), i("salt", 1, "tsp"), i("black-pepper", 0.5, "tsp")],
    steps: ["Toss beef with flour, salt and pepper. Brown in batches in oil; set aside.", "Cook onion, celery and garlic 5 minutes. Stir in tomato paste.", "Add broth, thyme and beef. Cover and simmer 1 hour.", "Add potatoes and carrots in chunks; simmer 45 minutes more. Stir in peas."],
    tags: ["high-protein", "dairy-free", "freezer-friendly", "batch"], storage: "Refrigerate 4 days or freeze 3 months.", leftovers: "Even better the next day.",
  },
  {
    id: "tuna-salad-sandwich", name: "Tuna Salad Sandwiches & Carrot Sticks", servings: 4, prepMinutes: 10, cookMinutes: 0, mealTypes: L,
    description: "Light tuna salad made with Greek yogurt, celery and pickles on whole-wheat bread.",
    ingredients: [i("tuna-canned", 3, "each"), i("greek-yogurt", 0.5, "cup"), i("celery", 2, "each"), i("dill-pickles", 2, "oz"), i("mustard", 1, "tbsp"), i("lemon", 0.5, "each"), i("wheat-bread", 8, "each"), i("romaine", 0.25, "each"), i("carrot", 4, "each")],
    steps: ["Mix drained tuna, yogurt, diced celery and pickles, mustard and lemon juice.", "Build sandwiches with lettuce.", "Serve with carrot sticks."],
    tags: ["high-protein", "quick", "no-cook"], storage: "Tuna salad keeps 2 days.", leftovers: "Pack salad separate from bread.",
  },
  {
    id: "turkey-burgers", name: "Turkey Burgers & Sweet Potato Wedges", servings: 4, prepMinutes: 15, cookMinutes: 25, mealTypes: D,
    description: "Juicy turkey burgers on buns with oven sweet potato wedges.",
    ingredients: [i("ground-turkey", 1.25, "lb"), i("buns", 4, "each"), i("sweet-potato", 1.5, "lb"), i("breadcrumbs", 0.25, "cup"), i("egg", 1, "each"), i("garlic-powder", 1, "tsp"), i("paprika", 1, "tsp"), i("olive-oil", 2, "tbsp"), i("salt", 1, "tsp"), i("romaine", 0.25, "each"), i("tomato", 1, "each"), i("mustard", 4, "tsp", undefined, true)],
    steps: ["Heat oven to 425°F. Cut sweet potatoes into wedges, toss with oil, paprika and half the salt; roast 25 minutes.", "Mix turkey, breadcrumbs, egg, garlic powder and remaining salt; form 4 patties.", "Cook in a skillet 5–6 minutes per side to 165°F.", "Serve on buns with lettuce, tomato and mustard."],
    tags: ["kid-friendly", "high-protein", "dairy-free"], storage: "Cooked patties keep 3 days.", leftovers: "Freeze raw patties between parchment.",
  },
  {
    id: "baked-ziti", name: "Baked Ziti with Spinach & Ricotta", servings: 6, prepMinutes: 15, cookMinutes: 30, mealTypes: D,
    description: "Cheesy baked pasta with marinara, ricotta, mozzarella and spinach.",
    ingredients: [i("pasta", 1, "lb"), i("marinara", 24, "oz"), i("ricotta", 15, "oz"), i("mozzarella", 6, "oz"), i("parmesan", 1, "oz"), i("frozen-spinach", 10, "oz"), i("egg", 1, "each"), i("garlic-powder", 0.5, "tsp"), i("basil-dried", 1, "tsp")],
    steps: ["Heat oven to 375°F. Boil pasta 2 minutes short of package time.", "Thaw and squeeze spinach. Mix with ricotta, egg, garlic powder and basil.", "Toss pasta with marinara and the ricotta mixture; spread in a 9×13 dish.", "Top with mozzarella and parmesan. Bake 25 minutes until bubbling."],
    tags: ["kid-friendly", "vegetarian", "batch", "freezer-friendly"], storage: "Refrigerate 4 days or freeze 2 months.", leftovers: "Reheat covered at 350°F.",
  },
  {
    id: "tofu-veg-stirfry", name: "Crispy Tofu & Vegetable Stir-Fry", servings: 4, prepMinutes: 15, cookMinutes: 30, mealTypes: D,
    description: "Pan-crisped tofu with broccoli, peppers and carrots in a ginger-soy sauce over brown rice.",
    ingredients: [i("tofu-firm", 14, "oz"), i("brown-rice", 1.5, "cup"), i("frozen-broccoli", 12, "oz"), i("red-pepper", 1, "each"), i("carrot", 2, "each"), i("garlic", 3, "each"), i("ginger", 1, "tbsp"), i("soy-sauce", 3, "tbsp"), i("maple-syrup", 1, "tbsp"), i("cornstarch", 1, "tbsp"), i("vegetable-oil", 2, "tbsp"), i("sesame-seeds", 1, "tbsp", undefined, true)],
    steps: ["Cook brown rice (about 40 minutes, start first).", "Press tofu, cube and toss with cornstarch. Fry in oil until golden on all sides; remove.", "Stir-fry vegetables 5 minutes; add garlic and ginger.", "Add soy, maple and 2 tbsp water; return tofu and toss. Sprinkle with sesame."],
    tags: ["vegetarian", "vegan", "high-fiber", "dairy-free"], storage: "Refrigerate 3 days.", leftovers: "Tofu softens but tastes great.",
  },
  {
    id: "chicken-caesar-wraps", name: "Chicken Caesar Wraps", servings: 4, prepMinutes: 15, cookMinutes: 12, mealTypes: L,
    description: "Grilled chicken, romaine and parmesan with a lemony yogurt Caesar dressing.",
    ingredients: [i("chicken-breast", 1, "lb"), i("romaine", 1, "each"), i("parmesan", 1, "oz"), i("greek-yogurt", 0.5, "cup"), i("lemon", 1, "each"), i("garlic", 1, "each"), i("mustard", 1, "tsp"), i("olive-oil", 1, "tbsp"), i("flour-tortilla", 4, "each"), i("salt", 0.5, "tsp"), i("black-pepper", 0.25, "tsp")],
    steps: ["Season chicken and cook in oil 5–6 minutes per side to 165°F; slice.", "Whisk yogurt, lemon juice, grated garlic, mustard, half the parmesan and pepper.", "Toss chopped romaine with dressing. Fill tortillas with lettuce, chicken and remaining parmesan."],
    tags: ["high-protein", "quick"], storage: "Store dressing separately 3 days.", leftovers: "Chicken keeps for salads.",
  },
  {
    id: "minestrone", name: "Hearty Minestrone", servings: 6, prepMinutes: 15, cookMinutes: 30, mealTypes: LD,
    description: "Italian vegetable soup with kidney beans, small pasta, zucchini and spinach.",
    ingredients: [i("onion", 1, "each"), i("carrot", 2, "each"), i("celery", 2, "each"), i("zucchini", 1, "each"), i("garlic", 3, "each"), i("diced-tomatoes", 1, "each"), i("kidney-beans", 1, "each"), i("pasta", 4, "oz"), i("spinach", 3, "oz"), i("olive-oil", 2, "tbsp"), i("oregano", 1, "tsp"), i("basil-dried", 1, "tsp"), i("salt", 1.5, "tsp"), i("parmesan", 1, "oz", "to serve", true)],
    steps: ["Cook diced onion, carrot and celery in oil 6 minutes. Add garlic and herbs.", "Add tomatoes, 6 cups water and salt; simmer 10 minutes.", "Add diced zucchini, beans and pasta; simmer 10 minutes.", "Stir in spinach. Serve with parmesan."],
    tags: ["vegetarian", "high-fiber", "lower-fat", "budget", "batch"], storage: "Refrigerate 4 days.", leftovers: "Pasta absorbs broth; add water.",
  },
  {
    id: "pulled-pork-slaw", name: "BBQ Pulled Pork Sandwiches & Slaw", servings: 8, prepMinutes: 15, cookMinutes: 480, mealTypes: D, difficulty: "easy",
    description: "Slow-cooker pork shoulder in barbecue sauce, piled on buns with tangy cabbage slaw.",
    ingredients: [i("pork-shoulder", 3, "lb"), i("bbq-sauce", 1.5, "cup"), i("onion", 1, "each"), i("brown-sugar", 1, "tbsp"), i("paprika", 1, "tbsp"), i("garlic-powder", 1, "tsp"), i("salt", 1.5, "tsp"), i("buns", 8, "each"), i("cabbage", 1, "lb"), i("carrot", 2, "each"), i("greek-yogurt", 0.5, "cup"), i("cider-vinegar", 2, "tbsp")],
    steps: ["Rub pork with sugar, paprika, garlic powder and salt. Place on sliced onion in a slow cooker.", "Cook on low 8 hours (or high 5) until it shreds easily.", "Shred pork, discard fat, and toss with BBQ sauce.", "Mix shredded cabbage and carrot with yogurt and vinegar. Serve pork and slaw on buns."],
    tags: ["kid-friendly", "high-protein", "batch", "slow-cooker", "freezer-friendly"], storage: "Refrigerate 4 days; freeze pork 3 months.", leftovers: "Planned leftovers: nachos or quesadillas.",
  },
  {
    id: "bbq-drumsticks", name: "BBQ Drumsticks, Corn & Green Beans", servings: 4, prepMinutes: 10, cookMinutes: 40, mealTypes: D,
    description: "Oven-baked sticky barbecue drumsticks with buttered corn and green beans.",
    ingredients: [i("chicken-drumstick", 2.5, "lb"), i("bbq-sauce", 0.5, "cup"), i("paprika", 1, "tsp"), i("garlic-powder", 1, "tsp"), i("salt", 0.75, "tsp"), i("frozen-corn", 2, "cup"), i("green-beans", 0.75, "lb"), i("butter", 1, "tbsp")],
    steps: ["Heat oven to 425°F. Season drumsticks and bake on a rack 30 minutes.", "Brush with BBQ sauce and bake 10 minutes more (to 175°F).", "Steam green beans and corn; toss with butter."],
    tags: ["kid-friendly", "high-protein", "gluten-free", "budget"], storage: "Refrigerate 3 days.", leftovers: "Great cold for lunch.",
  },
  {
    id: "greek-chicken-bowls", name: "Greek Chicken Rice Bowls", servings: 4, prepMinutes: 20, cookMinutes: 20, mealTypes: LD,
    description: "Lemon-oregano chicken with rice, cucumber, tomato, feta and tzatziki-style yogurt.",
    ingredients: [i("chicken-thigh", 1.25, "lb"), i("white-rice", 1, "cup"), i("cucumber", 1, "each"), i("tomato", 2, "each"), i("onion", 0.25, "each", "red or yellow"), i("feta", 3, "oz"), i("greek-yogurt", 0.75, "cup"), i("lemon", 1, "each"), i("garlic", 2, "each"), i("oregano", 2, "tsp"), i("olive-oil", 2, "tbsp"), i("salt", 1, "tsp")],
    steps: ["Marinate chicken in lemon juice, 1 tbsp oil, oregano, garlic and salt (10+ minutes).", "Cook rice.", "Cook chicken in remaining oil 5–6 minutes per side; slice.", "Grate a third of the cucumber into the yogurt; dice the rest with tomato and onion.", "Build bowls with rice, chicken, salad, feta and yogurt sauce."],
    tags: ["high-protein", "gluten-free", "meal-prep"], storage: "Refrigerate components 4 days.", leftovers: "Ideal for packed lunches.",
  },
  {
    id: "sausage-peppers-pasta", name: "Sausage, Peppers & Onions Pasta", servings: 4, prepMinutes: 10, cookMinutes: 25, mealTypes: D,
    description: "Italian sausage with sweet peppers and onions tossed with penne and tomatoes.",
    ingredients: [i("italian-sausage", 1, "lb"), i("pasta", 12, "oz"), i("red-pepper", 1, "each"), i("green-pepper", 1, "each"), i("onion", 1, "each"), i("garlic", 2, "each"), i("diced-tomatoes", 1, "each"), i("olive-oil", 1, "tbsp"), i("parmesan", 1, "oz"), i("oregano", 1, "tsp")],
    steps: ["Boil pasta.", "Brown sliced sausage in oil; add sliced peppers and onion and cook 8 minutes.", "Add garlic, oregano and tomatoes; simmer 8 minutes.", "Toss with pasta and a splash of pasta water; top with parmesan."],
    tags: ["kid-friendly"], storage: "Refrigerate 3 days.", leftovers: "Reheat with a splash of water.",
  },
  {
    id: "beef-broccoli", name: "Beef & Broccoli", servings: 4, prepMinutes: 15, cookMinutes: 15, mealTypes: D,
    description: "Thin-sliced top round and broccoli in a savory garlic sauce over rice.",
    ingredients: [i("beef-top-round", 1, "lb"), i("broccoli", 1.25, "lb"), i("garlic", 3, "each"), i("ginger", 1, "tbsp"), i("soy-sauce", 3, "tbsp"), i("brown-sugar", 1, "tbsp"), i("cornstarch", 1, "tbsp"), i("vegetable-oil", 2, "tbsp"), i("white-rice", 1.5, "cup"), i("sesame-seeds", 1, "tsp", undefined, true)],
    steps: ["Cook rice. Slice beef very thin against the grain; toss with cornstarch.", "Whisk soy, sugar and ⅓ cup water.", "Sear beef in batches in 1 tbsp oil over high heat; remove.", "Stir-fry broccoli 4 minutes with a splash of water; add garlic and ginger.", "Return beef with sauce; toss until thickened."],
    tags: ["high-protein", "dairy-free", "quick"], storage: "Refrigerate 3 days.", leftovers: "Reheat gently to keep beef tender.",
  },
  {
    id: "peanut-noodles-chicken", name: "Peanut Noodles with Chicken & Veggies", servings: 4, prepMinutes: 15, cookMinutes: 15, mealTypes: LD,
    description: "Spaghetti tossed in a creamy peanut-lime sauce with chicken, cabbage and carrots.",
    ingredients: [i("pasta", 10, "oz"), i("chicken-breast", 1, "lb"), i("peanut-butter", 0.33, "cup"), i("soy-sauce", 3, "tbsp"), i("lime", 1, "each"), i("honey", 1, "tbsp"), i("garlic", 2, "each"), i("cabbage", 0.5, "lb"), i("carrot", 2, "each"), i("cucumber", 1, "each"), i("green-onion", 3, "each"), i("vegetable-oil", 1, "tbsp")],
    steps: ["Boil pasta; reserve ½ cup water.", "Cook seasoned chicken in oil to 165°F; slice.", "Whisk peanut butter, soy, lime juice, honey, garlic and hot pasta water until smooth.", "Toss pasta with sauce, shredded cabbage and carrot, cucumber, chicken and green onion."],
    tags: ["kid-friendly", "high-protein", "dairy-free"], storage: "Refrigerate 3 days.", leftovers: "Delicious cold.",
  },
  {
    id: "lemon-chicken-quinoa", name: "Lemon-Garlic Chicken, Quinoa & Zucchini", servings: 4, prepMinutes: 10, cookMinutes: 25, mealTypes: D,
    description: "Bright lemon-garlic chicken breast with fluffy quinoa and sautéed zucchini.",
    ingredients: [i("chicken-breast", 1.5, "lb"), i("quinoa", 1, "cup"), i("zucchini", 2, "each"), i("lemon", 2, "each"), i("garlic", 4, "each"), i("olive-oil", 2, "tbsp"), i("oregano", 1, "tsp"), i("chicken-broth", 2, "cup", "for quinoa"), i("salt", 0.75, "tsp"), i("black-pepper", 0.25, "tsp")],
    steps: ["Simmer rinsed quinoa in broth 15 minutes; rest covered 5.", "Season chicken; cook in 1 tbsp oil 6 minutes per side to 165°F. Add garlic, lemon juice and zest to the pan.", "Sauté sliced zucchini in remaining oil 5 minutes.", "Serve chicken over quinoa with zucchini and pan juices."],
    tags: ["high-protein", "gluten-free", "dairy-free", "lower-fat"], storage: "Refrigerate 3 days.", leftovers: "Meal-prep friendly.",
  },
  {
    id: "turkey-stuffed-peppers", name: "Turkey & Rice Stuffed Peppers", servings: 4, prepMinutes: 15, cookMinutes: 40, mealTypes: D,
    description: "Bell peppers filled with ground turkey, rice, tomatoes and melted cheese.",
    ingredients: [i("green-pepper", 2, "each"), i("red-pepper", 2, "each"), i("ground-turkey", 1, "lb"), i("white-rice", 0.5, "cup"), i("onion", 0.5, "each"), i("diced-tomatoes", 1, "each"), i("tomato-sauce", 1, "each"), i("mozzarella", 3, "oz"), i("oregano", 1, "tsp"), i("garlic-powder", 0.5, "tsp"), i("salt", 0.75, "tsp"), i("olive-oil", 1, "tsp")],
    steps: ["Heat oven to 375°F. Cook rice.", "Brown turkey and diced onion in oil; add diced tomatoes, half the sauce, rice and seasonings.", "Halve peppers and remove seeds. Fill with mixture; top with remaining sauce.", "Cover and bake 30 minutes; top with cheese and bake 10 more."],
    tags: ["high-protein", "gluten-free"], storage: "Refrigerate 4 days.", leftovers: "Freeze individually.",
  },
  {
    id: "turkey-shepherds-pie", name: "Turkey Shepherd's Pie", servings: 6, prepMinutes: 20, cookMinutes: 40, mealTypes: D, difficulty: "medium",
    description: "Savory turkey and vegetable filling under a fluffy mashed-potato crust.",
    ingredients: [i("ground-turkey", 1.25, "lb"), i("potato", 2, "lb"), i("frozen-mixed-veg", 12, "oz"), i("onion", 1, "each"), i("garlic", 2, "each"), i("tomato-paste", 2, "tbsp"), i("chicken-broth", 1, "cup"), i("flour", 1, "tbsp"), i("milk", 0.5, "cup"), i("butter", 2, "tbsp"), i("thyme", 1, "tsp"), i("salt", 1.25, "tsp"), i("black-pepper", 0.5, "tsp")],
    steps: ["Boil peeled potatoes until tender; mash with milk, butter and half the salt.", "Heat oven to 400°F. Brown turkey with onion and garlic.", "Stir in flour and tomato paste, then broth, thyme, vegetables and remaining salt; simmer 5 minutes.", "Spread in a baking dish, top with potatoes, and bake 20 minutes until golden."],
    tags: ["kid-friendly", "high-protein", "gluten-free", "batch", "freezer-friendly"], storage: "Refrigerate 4 days or freeze 2 months.", leftovers: "Reheat covered at 350°F.",
  },
  {
    id: "hummus-veggie-wraps", name: "Hummus Veggie Wraps", servings: 4, prepMinutes: 10, cookMinutes: 0, mealTypes: L,
    description: "Soft wraps with hummus, chickpeas, crunchy vegetables and feta.",
    ingredients: [i("flour-tortilla", 4, "each"), i("hummus", 8, "oz"), i("chickpeas", 1, "each"), i("cucumber", 1, "each"), i("carrot", 2, "each"), i("red-pepper", 1, "each"), i("spinach", 2, "oz"), i("feta", 2, "oz")],
    steps: ["Spread tortillas with hummus.", "Layer spinach, smashed chickpeas, sliced vegetables and feta.", "Roll tightly and halve."],
    tags: ["vegetarian", "high-fiber", "no-cook", "quick"], storage: "Best within a day.", leftovers: "Wrap in foil for lunches.",
  },
  {
    id: "broccoli-mac-cheese", name: "Broccoli Mac & Cheese", servings: 6, prepMinutes: 10, cookMinutes: 20, mealTypes: LD,
    description: "Stovetop mac and cheese with real cheddar and plenty of broccoli folded in.",
    ingredients: [i("pasta", 1, "lb"), i("cheddar", 8, "oz"), i("milk", 2.5, "cup"), i("butter", 3, "tbsp"), i("flour", 3, "tbsp"), i("frozen-broccoli", 12, "oz"), i("mustard", 1, "tsp"), i("salt", 0.75, "tsp")],
    steps: ["Boil pasta, adding broccoli for the last 3 minutes; drain.", "Melt butter, whisk in flour 1 minute, then milk; simmer until thickened.", "Off heat, stir in cheddar, mustard and salt until smooth.", "Fold in pasta and broccoli."],
    tags: ["kid-friendly", "vegetarian"], storage: "Refrigerate 3 days.", leftovers: "Reheat with a splash of milk.",
  },
  {
    id: "tuna-pasta-salad", name: "Lemony Tuna Pasta Salad", servings: 4, prepMinutes: 15, cookMinutes: 10, mealTypes: L,
    description: "Cold pasta salad with tuna, peas, celery and a lemon-yogurt dressing.",
    ingredients: [i("pasta", 8, "oz"), i("tuna-canned", 2, "each"), i("frozen-peas", 1, "cup"), i("celery", 2, "each"), i("greek-yogurt", 0.5, "cup"), i("lemon", 1, "each"), i("olive-oil", 1, "tbsp"), i("mustard", 1, "tsp"), i("salt", 0.5, "tsp")],
    steps: ["Cook pasta, adding peas for the last minute; rinse cold.", "Whisk yogurt, lemon juice, oil, mustard and salt.", "Toss pasta with tuna, diced celery and dressing."],
    tags: ["high-protein", "make-ahead", "meal-prep"], storage: "Refrigerate 3 days.", leftovers: "Made for lunch boxes.",
  },
  {
    id: "black-bean-sweet-potato-tacos", name: "Sweet Potato & Black Bean Tacos", servings: 4, prepMinutes: 15, cookMinutes: 25, mealTypes: LD,
    description: "Roasted chili sweet potatoes and black beans in corn tortillas with avocado.",
    ingredients: [i("sweet-potato", 1.5, "lb"), i("black-beans", 1, "each"), i("corn-tortilla", 12, "each"), i("avocado", 1, "each"), i("lime", 1, "each"), i("chili-powder", 2, "tsp"), i("cumin", 1, "tsp"), i("olive-oil", 2, "tbsp"), i("salt", 0.75, "tsp"), i("salsa", 0.5, "cup"), i("cilantro", 0.5, "each", undefined, true)],
    steps: ["Heat oven to 425°F. Dice sweet potatoes; toss with oil, spices and salt. Roast 25 minutes.", "Warm beans with a pinch of cumin.", "Fill warm tortillas with sweet potato, beans, avocado, salsa, cilantro and lime."],
    tags: ["vegetarian", "vegan", "high-fiber", "gluten-free", "dairy-free", "budget"], storage: "Filling keeps 4 days.", leftovers: "Turns into a burrito bowl.",
  },
  {
    id: "egg-potato-hash", name: "Potato, Pepper & Egg Hash", servings: 4, prepMinutes: 10, cookMinutes: 25, mealTypes: ["breakfast", "dinner"],
    description: "Crispy skillet potatoes with peppers and onions, topped with fried eggs.",
    ingredients: [i("potato", 1.5, "lb"), i("red-pepper", 1, "each"), i("onion", 1, "each"), i("egg", 8, "each"), i("olive-oil", 3, "tbsp"), i("paprika", 1, "tsp"), i("salt", 1, "tsp"), i("black-pepper", 0.25, "tsp"), i("spinach", 2, "oz")],
    steps: ["Dice potatoes small; cook in oil in a large skillet over medium-high 12 minutes, stirring occasionally.", "Add diced pepper and onion, paprika and salt; cook 8 minutes until crisp.", "Stir in spinach. Make 8 wells, crack in eggs, cover and cook 4–5 minutes until set."],
    tags: ["vegetarian", "gluten-free", "dairy-free", "budget", "one-pan"], storage: "Best fresh.", leftovers: "Hash reheats well without eggs.",
  },

  // ── Snacks ────────────────────────────────────────────────────────
  {
    id: "apple-pb", name: "Apple Slices & Peanut Butter", servings: 4, prepMinutes: 5, cookMinutes: 0, mealTypes: S,
    description: "Crisp apple slices with peanut butter for dipping.",
    ingredients: [i("apple", 2, "each"), i("peanut-butter", 4, "tbsp")],
    steps: ["Core and slice apples.", "Serve with a tablespoon of peanut butter each."],
    tags: ["kid-friendly", "vegan", "vegetarian", "gluten-free", "no-cook"], storage: "Toss slices with lemon to prevent browning.", leftovers: "—",
  },
  {
    id: "veggies-hummus", name: "Veggie Sticks & Hummus", servings: 4, prepMinutes: 10, cookMinutes: 0, mealTypes: S,
    description: "Carrot, cucumber and pepper sticks with hummus.",
    ingredients: [i("carrot", 3, "each"), i("cucumber", 1, "each"), i("red-pepper", 1, "each"), i("hummus", 6, "oz")],
    steps: ["Cut vegetables into sticks.", "Serve with hummus."],
    tags: ["kid-friendly", "vegan", "vegetarian", "gluten-free", "no-cook", "high-fiber"], storage: "Cut veggies keep 4 days in water.", leftovers: "—",
  },
  {
    id: "yogurt-berries-snack", name: "Yogurt & Berries Cup", servings: 4, prepMinutes: 3, cookMinutes: 0, mealTypes: S,
    description: "Greek yogurt with thawed blueberries and a drizzle of honey.",
    ingredients: [i("greek-yogurt", 2, "cup"), i("frozen-blueberries", 1, "cup"), i("honey", 4, "tsp")],
    steps: ["Divide yogurt into cups; top with berries and honey."],
    tags: ["kid-friendly", "vegetarian", "high-protein", "gluten-free"], storage: "Refrigerate 2 days.", leftovers: "—",
  },
  {
    id: "boiled-eggs-orange", name: "Hard-Boiled Eggs & Orange", servings: 4, prepMinutes: 2, cookMinutes: 12, mealTypes: S,
    description: "A protein-packed snack: one hard-boiled egg and an orange each.",
    ingredients: [i("egg", 4, "each"), i("orange", 4, "each"), i("salt", 0.125, "tsp")],
    steps: ["Cover eggs with cold water, bring to a boil, cover and rest off heat 10 minutes.", "Chill in ice water and peel. Serve with orange segments."],
    tags: ["kid-friendly", "vegetarian", "high-protein", "gluten-free", "dairy-free", "make-ahead"], storage: "Eggs keep 1 week refrigerated.", leftovers: "—",
  },
  {
    id: "peanut-banana-snack", name: "Banana & Roasted Peanuts", servings: 4, prepMinutes: 2, cookMinutes: 0, mealTypes: S,
    description: "Half a banana and a small handful of peanuts.",
    ingredients: [i("banana", 2, "each"), i("peanuts", 4, "oz")],
    steps: ["Halve bananas; portion 1 oz peanuts per person."],
    tags: ["vegan", "vegetarian", "gluten-free", "no-cook"], storage: "—", leftovers: "—",
  },
];

export const BUILTIN_RECIPES: Recipe[] = defs.map((d) => ({
  difficulty: "easy",
  storage: "Refrigerate in an airtight container up to 3 days.",
  leftovers: "Reheat until hot throughout.",
  ...d,
  source: "builtin" as const,
}));
