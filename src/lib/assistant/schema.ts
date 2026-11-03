import { z } from "zod";

/**
 * The assistant's only output: a short reply plus actions for the app's
 * deterministic engine. Flat objects (every field nullable) work reliably
 * with both providers' structured-output modes.
 */
export const ActionSchema = z.object({
  type: z.enum(["generate_plan", "swap_meal", "adjust_plan", "none"]),
  budget: z.number().nullable().describe("Grocery budget in dollars"),
  days: z.number().int().nullable(),
  people: z.number().int().nullable().describe("Number of people the user mentioned, if any"),
  mealTypes: z.array(z.enum(["breakfast", "lunch", "dinner"])).nullable(),
  includeSnacks: z.boolean().nullable(),
  priority: z.enum(["nutrition", "balanced", "cost"]).nullable(),
  maxCookMinutes: z.number().int().nullable(),
  preferIngredients: z.array(z.string()).nullable().describe("Catalog ingredient ids to use up or prioritize"),
  avoidIngredients: z.array(z.string()).nullable().describe("Catalog ingredient ids to avoid"),
  storeChain: z.enum(["hannaford", "shaws", "price-chopper", "walmart", "aldi"]).nullable(),
  weekday: z.number().int().min(0).max(6).nullable().describe("0=Sunday … 6=Saturday, for swap_meal"),
  relativeDay: z.enum(["today", "tomorrow"]).nullable(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable(),
  kidFriendly: z.boolean().nullable(),
  highProtein: z.boolean().nullable(),
  cheaper: z.boolean().nullable(),
  goal: z.enum(["higher-protein", "cheaper", "faster", "use-pantry"]).nullable().describe("For adjust_plan"),
  keepProtein: z.boolean().nullable().describe("When making cheaper, avoid reducing protein much"),
});

export const AssistantSchema = z.object({
  reply: z.string().describe("One or two friendly sentences describing what will happen. Never state prices, calories or other numbers you were not given."),
  actions: z.array(ActionSchema),
});

export type Action = z.infer<typeof ActionSchema>;
export type AssistantResult = z.infer<typeof AssistantSchema>;

export const EMPTY_ACTION: Action = {
  type: "none", budget: null, days: null, people: null, mealTypes: null, includeSnacks: null, priority: null, maxCookMinutes: null,
  preferIngredients: null, avoidIngredients: null, storeChain: null, weekday: null, relativeDay: null, mealType: null,
  kidFriendly: null, highProtein: null, cheaper: null, goal: null, keepProtein: null,
};

export const FlyerSchema = z.object({
  items: z.array(z.object({
    productName: z.string(),
    brand: z.string().nullable(),
    price: z.number().describe("Price for ONE package/unit after the advertised deal. For '2 for $5' use 2.50."),
    regularPrice: z.number().nullable(),
    packageQty: z.number().describe("Package size number, e.g. 16 for 16 oz; 1 with unit lb for per-pound prices"),
    packageUnit: z.enum(["g", "kg", "oz", "lb", "floz", "each"]),
    ingredientId: z.string().nullable().describe("Matching catalog id, or null if none fits"),
    loyaltyRequired: z.boolean().nullable(),
    couponRequired: z.boolean().nullable(),
    promoNotes: z.string().nullable(),
  })),
  validFrom: z.string().nullable().describe("YYYY-MM-DD if printed"),
  validTo: z.string().nullable().describe("YYYY-MM-DD if printed"),
});

export const RecipeDraftSchema = z.object({
  name: z.string(),
  description: z.string(),
  servings: z.number().int(),
  prepMinutes: z.number().int(),
  cookMinutes: z.number().int(),
  mealTypes: z.array(z.enum(["breakfast", "lunch", "dinner", "snack"])),
  ingredients: z.array(z.object({
    ingredientId: z.string().nullable().describe("Catalog id; null if no catalog item fits"),
    name: z.string(),
    qty: z.number(),
    unit: z.enum(["g", "kg", "oz", "lb", "ml", "l", "tsp", "tbsp", "cup", "floz", "each"]),
    note: z.string().nullable(),
  })),
  steps: z.array(z.string()),
  tags: z.array(z.string()),
  storage: z.string(),
  leftovers: z.string(),
});
export type RecipeDraft = z.infer<typeof RecipeDraftSchema>;
