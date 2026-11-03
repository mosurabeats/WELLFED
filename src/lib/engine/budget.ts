import type { Member, PlannedMeal } from "../types";
import { findConflicts } from "./allergens";
import { nutrientsForGrams, type IngredientLookup } from "./nutrition";
import { choosePrice, mealServings, round2, type PlanContext, type ShoppingList } from "./shopping";
import { tryToGrams as tryToGramsSafe } from "./units";

export interface BudgetSummary {
  budget: number;
  total: number;
  remaining: number;
  overBy: number;
  meals: number;
  servings: number;
  perMeal: number;
  perServing: number;
  /** Cost of what each meal actually uses (package leftovers excluded). */
  byMeal: { mealId: string; recipeId: string; cost: number; perServing: number }[];
  byStore: ShoppingList["byStore"];
  /** Value of food left over in packages after the plan (rice, spices, etc.). */
  leftoverValue: number;
  estimateShare: number;
}

export function summarizeBudget(
  budget: number,
  meals: PlannedMeal[],
  list: ShoppingList,
  members: Member[],
): BudgetSummary {
  const servings = meals.reduce((s, m) => s + mealServings(m, members), 0);
  const byMealMap = new Map<string, number>();
  let leftoverValue = 0;
  for (const item of list.items) {
    if (!item.purchase || item.cost <= 0) continue;
    const buyGrams = item.purchase.purchasedGrams || 1;
    const costPerGram = item.cost / buyGrams;
    // Pantry covers the first grams; allocate the purchased remainder to meals pro rata.
    const pantryShare = item.neededGrams > 0 ? item.pantryGrams / item.neededGrams : 0;
    for (const use of item.uses) {
      const bought = use.grams * (1 - pantryShare);
      byMealMap.set(use.mealId, (byMealMap.get(use.mealId) ?? 0) + bought * costPerGram);
    }
    leftoverValue += item.leftoverGrams * costPerGram;
  }
  const byMeal = meals.map((m) => {
    const cost = round2(byMealMap.get(m.id) ?? 0);
    const sv = mealServings(m, members);
    return { mealId: m.id, recipeId: m.recipeId, cost, perServing: round2(cost / Math.max(sv, 0.01)) };
  });
  const total = list.total;
  return {
    budget,
    total,
    remaining: round2(budget - total),
    overBy: round2(Math.max(0, total - budget)),
    meals: meals.length,
    servings: round2(servings),
    perMeal: round2(total / Math.max(meals.length, 1)),
    perServing: round2(total / Math.max(servings, 1)),
    byMeal,
    byStore: list.byStore,
    leftoverValue: round2(leftoverValue),
    estimateShare: total > 0 ? list.estimateTotal / total : 0,
  };
}

// ── Ingredient substitutions ──────────────────────────────────────

export interface Substitution {
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  /** Estimated dollars saved on this plan's shopping list. */
  savings: number;
  /** Change in protein grams across the plan (negative = less). */
  proteinDelta: number;
  note: string;
}

/**
 * Cheaper swaps within substitute groups (beef→turkey, fresh→frozen veg),
 * filtered to ingredients safe for every household member.
 */
export function suggestSubstitutions(
  list: ShoppingList,
  ctx: PlanContext,
  allIngredients: { id: string; substituteGroup?: string }[],
  allowedStores: string[] | null,
  existing: Record<string, string> = {},
): Substitution[] {
  const out: Substitution[] = [];
  const lookup: IngredientLookup = ctx.lookup;
  for (const item of list.items) {
    const ing = item.ingredient;
    if (!ing.substituteGroup || item.cost <= 0 || item.toBuyGrams <= 0) continue;
    if (Object.values(existing).includes(ing.id)) continue;
    const peers = allIngredients.filter((x) => x.substituteGroup === ing.substituteGroup && x.id !== ing.id);
    for (const peer of peers) {
      const to = lookup(peer.id);
      if (!to) continue;
      const fake = { ingredients: [{ ingredientId: to.id, qty: 1, unit: "g" as const }] };
      if (findConflicts(fake, ctx.members, lookup).some((c) => c.kind !== "dislike")) continue;
      const choice = choosePrice(to.id, item.toBuyGrams, ctx, allowedStores);
      if (!choice) continue;
      const savings = round2(item.cost - choice.purchase.cost);
      if (savings < 0.5) continue;
      const proteinDelta = round2(
        nutrientsForGrams(to, item.neededGrams).protein - nutrientsForGrams(ing, item.neededGrams).protein,
      );
      const verified = choice.source !== "estimate" && item.status !== "estimate";
      out.push({
        fromId: ing.id,
        toId: to.id,
        fromName: ing.name,
        toName: to.name,
        savings,
        proteinDelta,
        note: verified ? "Based on store prices" : "Based on estimated prices",
      });
    }
  }
  return out.sort((a, b) => b.savings - a.savings).slice(0, 8);
}

// ── Recipe cost ───────────────────────────────────────────────────

export interface RecipeCost {
  /** Value of the ingredient amounts the recipe actually uses. */
  usedCost: number;
  perServing: number;
  /** Cost to buy every ingredient in whole packages from scratch. */
  packageCost: number;
  unpriced: string[];
  estimated: boolean;
}

/** Cost of one batch of a recipe, using the cheapest known price for each ingredient. */
export function recipeCost(
  recipe: { ingredients: { ingredientId: string; qty: number; unit: import("../types").Unit }[]; servings: number },
  ctx: Pick<PlanContext, "prices" | "lookup" | "today">,
  opts: { includeStaples?: boolean; substitutions?: Record<string, string> } = {},
): RecipeCost {
  let used = 0;
  let pkg = 0;
  let estimated = false;
  const unpriced: string[] = [];
  for (const line of recipe.ingredients) {
    const id = opts.substitutions?.[line.ingredientId] ?? line.ingredientId;
    const ing = ctx.lookup(id);
    if (!ing) {
      unpriced.push(line.ingredientId);
      continue;
    }
    if (ing.staple && !opts.includeStaples) continue;
    const grams = tryToGramsSafe(line.qty, line.unit, ing);
    if (grams == null) {
      unpriced.push(ing.name);
      continue;
    }
    const choice = choosePrice(id, grams, ctx, null);
    if (!choice) {
      unpriced.push(ing.name);
      continue;
    }
    if (choice.source === "estimate") estimated = true;
    used += (choice.purchase.cost / choice.purchase.purchasedGrams) * grams;
    pkg += choice.purchase.cost;
  }
  return { usedCost: round2(used), perServing: round2(used / Math.max(recipe.servings, 1)), packageCost: round2(pkg), unpriced, estimated };
}
