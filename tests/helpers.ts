import { BUILTIN_INGREDIENTS, BUILTIN_INGREDIENT_MAP } from "@/data/ingredients";
import { BUILTIN_RECIPES } from "@/data/recipes";
import { ESTIMATED_PRICES } from "@/data/estimated-prices";
import type { Member, PantryItem, PlanRequest, PriceEntry, Recipe, Store, WeeklySchedule } from "@/lib/types";
import type { PlanContext } from "@/lib/engine/shopping";

export const lookup = (id: string) => BUILTIN_INGREDIENT_MAP.get(id);
export { BUILTIN_INGREDIENTS };

export function adult(id: string, extra: Partial<Member> = {}): Member {
  return { id, name: id, kind: "adult", age: 38, activity: "moderate", goal: "general", allergies: [], diets: [], dislikes: [], likes: [], ...extra };
}
export function child(id: string, age: number, extra: Partial<Member> = {}): Member {
  return { id, name: id, kind: "child", age, activity: "moderate", goal: "general", allergies: [], diets: [], dislikes: [], likes: [], ...extra };
}

export const FAMILY: Member[] = [
  adult("a1", { sex: "female" }),
  adult("a2", { sex: "male" }),
  child("k1", 7),
  child("k2", 10),
];

export function ctx(over: Partial<PlanContext> = {}): PlanContext {
  return {
    lookup,
    recipes: new Map<string, Recipe>(BUILTIN_RECIPES.map((r) => [r.id, r])),
    members: FAMILY,
    prices: ESTIMATED_PRICES,
    stores: [],
    pantry: [],
    today: "2026-11-03",
    ...over,
  };
}

export function request(over: Partial<PlanRequest> = {}): PlanRequest {
  return {
    startDate: "2026-11-09",
    days: 5,
    mealTypes: ["lunch", "dinner"],
    includeSnacks: false,
    budget: 150,
    priority: "balanced",
    includeStaples: false,
    seed: 7,
    ...over,
  };
}

export const EVERYONE: WeeklySchedule = {};

export function store(id: string): Store {
  return { id, chain: "other", name: id, source: "user" };
}

export function price(over: Partial<PriceEntry> & Pick<PriceEntry, "ingredientId" | "price" | "packageQty" | "packageUnit">): PriceEntry {
  return { id: `p-${Math.random()}`, storeId: "s1", productName: over.ingredientId, source: "user", ...over };
}

export function pantryItem(ingredientId: string, qty: number, unit: PantryItem["unit"], extra: Partial<PantryItem> = {}): PantryItem {
  return { id: `pan-${ingredientId}`, ingredientId, qty, unit, location: "pantry", addedAt: "2026-11-01", ...extra };
}
