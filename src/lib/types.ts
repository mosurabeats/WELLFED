/**
 * WellFed domain types. Pure data shapes shared by the engine, storage and UI.
 * Engine code must not import anything browser-specific so it stays testable.
 */

export type MassUnit = "g" | "kg" | "oz" | "lb";
export type VolumeUnit = "ml" | "l" | "tsp" | "tbsp" | "cup" | "floz";
export type CountUnit = "each";
export type Unit = MassUnit | VolumeUnit | CountUnit;

export type Category =
  | "produce"
  | "meat"
  | "seafood"
  | "dairy"
  | "eggs"
  | "bakery"
  | "frozen"
  | "grains"
  | "canned"
  | "condiments"
  | "spices"
  | "oils";

/** The nine major US allergens (FALCPA + FASTER Act). */
export type Allergen =
  | "milk"
  | "egg"
  | "fish"
  | "shellfish"
  | "tree-nut"
  | "peanut"
  | "wheat"
  | "soy"
  | "sesame";

/** Properties used to decide whether an ingredient fits a diet. */
export type FoodFlag =
  | "meat" // any land-animal flesh
  | "poultry"
  | "beef"
  | "pork"
  | "fish"
  | "shellfish"
  | "dairy"
  | "egg"
  | "gluten"
  | "honey";

export type Diet =
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "gluten-free"
  | "dairy-free"
  | "no-pork"
  | "no-beef";

export type ProteinGroup =
  | "chicken"
  | "turkey"
  | "beef"
  | "pork"
  | "fish"
  | "shellfish"
  | "egg"
  | "legume"
  | "tofu"
  | "dairy";

export interface Nutrients {
  kcal: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  satFat: number; // g
  fiber: number; // g
  sodium: number; // mg
  /** null when the source database has no value (SR Legacy often lacks it). */
  addedSugar: number | null; // g
}

export interface Ingredient {
  id: string;
  name: string;
  category: Category;
  /** USDA FoodData Central id the nutrient values come from. */
  fdcId?: number;
  fdcDescription?: string;
  /** Nutrients per 100 g of edible portion. */
  per100g: Nutrients;
  /** "usda" values come from FoodData Central; "user" were typed in by a person. */
  nutritionSource: "usda" | "user";
  /** Grams for one "each" (one egg, one medium onion, one can drained). */
  gramsPerEach?: number;
  eachLabel?: string;
  /** g per ml, used to convert volume measures. */
  density?: number;
  /** Fraction of purchased weight that is edible (peels, stems, cores). */
  yield?: number;
  allergens?: Allergen[];
  flags?: FoodFlag[];
  protein?: ProteinGroup;
  /** Oils, salt and spices most kitchens already hold. */
  staple?: boolean;
  /** Ingredients in the same group can substitute for each other. */
  substituteGroup?: string;
  /** How shopping quantities are shown. */
  shopUnit: Unit;
  shelfDays?: number;
  custom?: boolean;
}

export interface RecipeIngredient {
  ingredientId: string;
  qty: number;
  unit: Unit;
  note?: string;
  optional?: boolean;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  mealTypes: MealType[];
  ingredients: RecipeIngredient[];
  steps: string[];
  tags: string[]; // kid-friendly, high-protein, one-pan, etc.
  storage: string;
  leftovers: string;
  source: "builtin" | "user" | "ai";
  favorite?: boolean;
  excluded?: boolean;
  /** memberId -> 1..5 */
  ratings?: Record<string, number>;
  /** Names of ingredients the AI suggested that are not in the catalog. */
  unmatchedIngredients?: string[];
  createdAt?: string;
}

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very-active";
export type AdultGoal =
  | "general"
  | "maintain"
  | "lose"
  | "muscle"
  | "lower-fat"
  | "higher-fiber";

export interface Member {
  id: string;
  name: string;
  kind: "adult" | "child";
  age: number;
  sex?: "female" | "male";
  heightCm?: number;
  weightKg?: number;
  activity: ActivityLevel;
  goal: AdultGoal; // ignored for children
  allergies: Allergen[];
  diets: Diet[];
  /** Ingredient ids this person avoids. */
  dislikes: string[];
  /** Ingredient ids or recipe tags this person enjoys. */
  likes: string[];
  /** Adult-only explicit daily targets; override computed values. */
  targets?: Partial<Pick<Nutrients, "kcal" | "protein" | "carbs" | "fat" | "fiber">>;
  color?: string;
}

export interface DailyTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  satFatMax: number;
  fiber: number;
  sodiumMax: number;
  addedSugarMax: number;
}

/** weekday (0=Sun) -> meal -> member ids eating */
export type WeeklySchedule = Record<number, Partial<Record<MealType, string[]>>>;

export type Chain =
  | "hannaford"
  | "shaws"
  | "price-chopper"
  | "walmart"
  | "aldi"
  | "other";

export interface Store {
  id: string;
  chain: Chain;
  name: string;
  address?: string;
  lat?: number;
  lon?: number;
  distanceKm?: number;
  source: "osm" | "user";
  preferred?: boolean;
  /** Your store's weekly-ad link, overriding the chain default. */
  flyerUrl?: string;
}

/**
 * - estimate: typical price, not tied to a store or date. Never "current".
 * - user: typed by a household member from a shelf tag or receipt.
 * - flyer: extracted from a weekly ad and confirmed by a person.
 * - api: returned by an authorized retailer/data-provider API.
 * - demo: sample data shipped for trying the app. Never real.
 */
export type PriceSource = "estimate" | "user" | "flyer" | "api" | "demo";

export interface PriceEntry {
  id: string;
  /** null for store-agnostic estimates. */
  storeId: string | null;
  ingredientId: string;
  productName: string;
  brand?: string;
  packageQty: number;
  packageUnit: Unit;
  price: number;
  regularPrice?: number;
  isSale?: boolean;
  promoNotes?: string; // "Buy 2 get 1", "Limit 4"
  loyaltyRequired?: boolean;
  couponRequired?: boolean;
  startDate?: string; // ISO date
  endDate?: string; // ISO date, inclusive
  source: PriceSource;
  sourceDetail?: string;
  verifiedAt?: string; // ISO timestamp
}

export type StorageLocation = "pantry" | "fridge" | "freezer";

export interface PantryItem {
  id: string;
  ingredientId: string;
  qty: number;
  unit: Unit;
  expiresOn?: string;
  location: StorageLocation;
  addedAt: string;
}

export type Priority = "nutrition" | "balanced" | "cost";

export interface PlanRequest {
  startDate: string; // ISO date
  days: number;
  mealTypes: MealType[];
  includeSnacks: boolean;
  budget: number;
  priority: Priority;
  /** Price staples (oil, salt, spices) instead of assuming they are on hand. */
  includeStaples: boolean;
  maxCookMinutes?: number;
  preferIngredients?: string[];
  avoidIngredients?: string[];
  /** Restrict to one store's prices when shopping one store. */
  storeId?: string | null;
  allowRepeats?: boolean;
  seed?: number;
}

export interface PlannedMeal {
  id: string;
  date: string; // ISO date
  mealType: MealType;
  recipeId: string;
  attendees: string[];
  /** memberId -> portion multiplier override */
  portionOverrides?: Record<string, number>;
  locked?: boolean;
}

export interface ShoppingOverride {
  checked?: boolean;
  owned?: boolean;
  /** Packages to buy, replacing the computed count. */
  packages?: number;
  storeId?: string | null;
  priceEntryId?: string;
  actualPrice?: number;
}

export interface MealPlan {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  request: PlanRequest;
  meals: PlannedMeal[];
  shopping: Record<string, ShoppingOverride>;
  notes: string[];
  /** Extra items added to the list by hand: ingredientId -> grams */
  extras?: Record<string, number>;
  /** Plan-wide ingredient swaps: fromId -> toId */
  substitutions?: Record<string, string>;
  active?: boolean;
}

export interface Settings {
  id: "settings";
  zip?: string;
  town?: string;
  radiusKm: number;
  maxStores: number;
  oneStoreMode: boolean;
  weeklyBudget: number;
  priority: Priority;
  mealTypes: MealType[];
  includeSnacks: boolean;
  includeStaples: boolean;
  days: number;
  maxCookMinutes?: number;
  schedule: WeeklySchedule;
  onboarded: boolean;
  /** Required by the server when APP_ACCESS_CODE is set. */
  accessCode?: string;
  aiProvider?: "anthropic" | "openai" | "none";
}
