import type { Ingredient, Nutrients, Recipe, RecipeIngredient } from "../types";
import { tryToGrams } from "./units";

export const ZERO: Nutrients = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  satFat: 0,
  fiber: 0,
  sodium: 0,
  addedSugar: 0,
};

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    satFat: a.satFat + b.satFat,
    fiber: a.fiber + b.fiber,
    sodium: a.sodium + b.sodium,
    addedSugar: (a.addedSugar ?? 0) + (b.addedSugar ?? 0),
  };
}

export function scaleNutrients(n: Nutrients, f: number): Nutrients {
  return {
    kcal: n.kcal * f,
    protein: n.protein * f,
    carbs: n.carbs * f,
    fat: n.fat * f,
    satFat: n.satFat * f,
    fiber: n.fiber * f,
    sodium: n.sodium * f,
    addedSugar: n.addedSugar == null ? null : n.addedSugar * f,
  };
}

export function roundNutrients(n: Nutrients): Nutrients {
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    kcal: Math.round(n.kcal),
    protein: r1(n.protein),
    carbs: r1(n.carbs),
    fat: r1(n.fat),
    satFat: r1(n.satFat),
    fiber: r1(n.fiber),
    sodium: Math.round(n.sodium),
    addedSugar: n.addedSugar == null ? null : r1(n.addedSugar),
  };
}

/** Nutrients contained in `grams` of purchased ingredient (applies edible yield). */
export function nutrientsForGrams(ing: Ingredient, grams: number): Nutrients {
  const edible = grams * (ing.yield ?? 1);
  return scaleNutrients(ing.per100g, edible / 100);
}

export interface RecipeNutrition {
  total: Nutrients;
  perServing: Nutrients;
  /** Ingredient lines that could not be converted or are not in the catalog. */
  incomplete: string[];
  /** True when every ingredient has a known added-sugar figure. */
  addedSugarComplete: boolean;
  /** Grams of produce (fruit/veg, purchased weight) per serving. */
  produceGramsPerServing: number;
}

export type IngredientLookup = (id: string) => Ingredient | undefined;

export function lineGrams(line: RecipeIngredient, lookup: IngredientLookup): number | null {
  const ing = lookup(line.ingredientId);
  if (!ing) return null;
  return tryToGrams(line.qty, line.unit, ing);
}

/**
 * Compute nutrition from structured ingredient data only. Lines whose weight
 * cannot be determined are reported in `incomplete` rather than estimated.
 */
export function recipeNutrition(
  recipe: Pick<Recipe, "ingredients" | "servings">,
  lookup: IngredientLookup,
  substitutions?: Record<string, string>,
): RecipeNutrition {
  let total = { ...ZERO };
  const incomplete: string[] = [];
  let sugarComplete = true;
  let produce = 0;
  for (const line of recipe.ingredients) {
    const id = substitutions?.[line.ingredientId] ?? line.ingredientId;
    const ing = lookup(id);
    if (!ing) {
      incomplete.push(line.ingredientId);
      continue;
    }
    const grams = tryToGrams(line.qty, line.unit, ing);
    if (grams == null) {
      incomplete.push(ing.name);
      continue;
    }
    const n = nutrientsForGrams(ing, grams);
    if (ing.per100g.addedSugar == null && !isNaturallySugarFree(ing)) sugarComplete = false;
    total = addNutrients(total, n);
    if ((ing.category === "produce" || ing.category === "frozen") && ing.protein !== "tofu") {
      produce += grams * (ing.yield ?? 1);
    }
  }
  const servings = Math.max(recipe.servings, 0.0001);
  return {
    total,
    perServing: scaleNutrients(total, 1 / servings),
    incomplete,
    addedSugarComplete: sugarComplete,
    produceGramsPerServing: produce / servings,
  };
}

/**
 * Whole foods with no added sugar by definition (meat, eggs, produce, plain
 * grains, oils, spices). Processed items (sauces, bread) remain unknown.
 */
function isNaturallySugarFree(ing: Ingredient): boolean {
  return ["meat", "seafood", "eggs", "produce", "frozen", "oils", "spices"].includes(ing.category) ||
    ["white-rice", "brown-rice", "quinoa", "pasta", "egg-noodles", "oats", "flour", "lentils", "milk", "cheddar", "monterey-jack", "mozzarella", "parmesan", "feta", "greek-yogurt", "yogurt-plain", "butter", "diced-tomatoes", "tomato-paste", "tuna-canned", "black-beans", "chickpeas", "kidney-beans", "pinto-beans", "coconut-milk", "cornstarch", "peanuts"].includes(ing.id);
}

/** Return a copy of the recipe scaled to a new number of servings. */
export function scaleRecipe<T extends Pick<Recipe, "ingredients" | "servings">>(recipe: T, servings: number): T {
  const f = servings / recipe.servings;
  return {
    ...recipe,
    servings,
    ingredients: recipe.ingredients.map((l) => ({ ...l, qty: l.qty * f })),
  };
}

/** Share of calories from protein/carbs/fat (Atwater 4/4/9). */
export function macroSplit(n: Nutrients): { protein: number; carbs: number; fat: number } {
  const p = n.protein * 4;
  const c = n.carbs * 4;
  const f = n.fat * 9;
  const t = p + c + f || 1;
  return { protein: p / t, carbs: c / t, fat: f / t };
}
