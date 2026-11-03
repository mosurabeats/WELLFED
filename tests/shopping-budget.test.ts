import { describe, expect, it } from "vitest";
import { cheapestPurchase, isActive, offerStatus, unitPriceLabel } from "@/lib/engine/pricing";
import { buildShoppingList, computeRequirements, compareStores, mealServings } from "@/lib/engine/shopping";
import { summarizeBudget, suggestSubstitutions } from "@/lib/engine/budget";
import type { PlannedMeal } from "@/lib/types";
import { ctx, lookup, price, pantryItem, store, FAMILY, adult, BUILTIN_INGREDIENTS } from "./helpers";

const meal = (id: string, recipeId: string, attendees = FAMILY.map((m) => m.id)): PlannedMeal => ({
  id, date: "2026-11-09", mealType: "dinner", recipeId, attendees,
});
const opts = { allowedStores: null, includeStaples: true, overrides: {} };

describe("package rounding", () => {
  const rice = lookup("white-rice")!;
  it("buys a whole 2-lb bag when a recipe needs 10 oz", () => {
    const bag = price({ ingredientId: "white-rice", price: 2.99, packageQty: 2, packageUnit: "lb" });
    const p = cheapestPurchase(283.5, [bag], rice)!;
    expect(p.picks).toEqual([{ entry: bag, count: 1 }]);
    expect(p.cost).toBe(2.99);
    expect(p.purchasedGrams).toBeCloseTo(907.2, 1);
  });
  it("chooses the cheapest combination of sizes", () => {
    const small = price({ ingredientId: "white-rice", price: 2.99, packageQty: 2, packageUnit: "lb" });
    const big = price({ ingredientId: "white-rice", price: 5.99, packageQty: 5, packageUnit: "lb" });
    // 6 lb: 5+2 = 8.98 beats 2+2+2 = 8.97? no: 3×2lb = 8.97 is cheaper.
    const p = cheapestPurchase(6 * 453.59, [small, big], rice)!;
    expect(p.cost).toBeCloseTo(8.97);
    // 4.5 lb: one 5-lb bag (5.99) beats three 2-lb bags (8.97)
    expect(cheapestPurchase(4.5 * 453.59, [small, big], rice)!.cost).toBe(5.99);
  });
  it("unit price compares actual value, not the sticker", () => {
    const e = price({ ingredientId: "chicken-thigh", price: 10.47, packageQty: 3, packageUnit: "lb" });
    expect(unitPriceLabel(e, lookup("chicken-thigh")!)).toBe("$3.49/lb");
  });
});

describe("shopping list consolidation", () => {
  it("merges an ingredient shared by two recipes into one purchase", () => {
    const meals = [meal("m1", "chicken-broccoli-stirfry"), meal("m2", "beef-broccoli")];
    const { reqs } = computeRequirements(meals, ctx());
    const broccoli = reqs.get("broccoli")!;
    expect(broccoli.uses).toHaveLength(2);
    const list = buildShoppingList(reqs, ctx(), opts);
    expect(list.items.filter((i) => i.ingredient.id === "broccoli")).toHaveLength(1);
    // Rice for both meals comes from one bag, not two.
    const rice = list.items.find((i) => i.ingredient.id === "white-rice")!;
    expect(rice.purchase!.picks.reduce((s, p) => s + p.count, 0)).toBe(1);
  });

  it("counts every package once even when used across meals", () => {
    const meals = [meal("m1", "turkey-taco-bowls"), meal("m2", "veg-egg-fried-rice")];
    const list = buildShoppingList(computeRequirements(meals, ctx()).reqs, ctx(), opts);
    const sum = list.items.reduce((s, i) => s + i.cost, 0);
    expect(list.total).toBeCloseTo(sum, 2);
  });

  it("scales quantities to who is actually eating", () => {
    const all = computeRequirements([meal("m", "sheet-pan-chicken")], ctx()).reqs.get("chicken-thigh")!.grams;
    const adultsOnly = computeRequirements([meal("m", "sheet-pan-chicken", ["a1", "a2"])], ctx()).reqs.get("chicken-thigh")!.grams;
    expect(adultsOnly).toBeLessThan(all);
    const servingsAll = mealServings({ attendees: FAMILY.map((m) => m.id) }, FAMILY);
    const servingsAdults = mealServings({ attendees: ["a1", "a2"] }, FAMILY);
    expect(adultsOnly / all).toBeCloseTo(servingsAdults / servingsAll, 5);
  });
});

describe("pantry deduction", () => {
  it("subtracts what's on hand before buying", () => {
    const meals = [meal("m", "sheet-pan-chicken")];
    const { reqs } = computeRequirements(meals, ctx());
    const need = reqs.get("potato")!.grams;
    const list = buildShoppingList(reqs, ctx({ pantry: [pantryItem("potato", 5, "lb")] }), opts);
    const potato = list.items.find((i) => i.ingredient.id === "potato")!;
    expect(potato.pantryGrams).toBeCloseTo(need);
    expect(potato.cost).toBe(0);
    expect(potato.status).toBe("on-hand");
  });
  it("buys only the shortfall when the pantry has some", () => {
    const meals = [meal("m", "sheet-pan-chicken")];
    const { reqs } = computeRequirements(meals, ctx());
    const list = buildShoppingList(reqs, ctx({ pantry: [pantryItem("potato", 100, "g")] }), opts);
    const potato = list.items.find((i) => i.ingredient.id === "potato")!;
    expect(potato.toBuyGrams).toBeCloseTo(reqs.get("potato")!.grams - 100);
  });
  it("treats staples as on hand when the budget excludes restocking", () => {
    const { reqs } = computeRequirements([meal("m", "sheet-pan-chicken")], ctx());
    const list = buildShoppingList(reqs, ctx(), { ...opts, includeStaples: false });
    expect(list.items.find((i) => i.ingredient.id === "salt")!.cost).toBe(0);
  });
});

describe("deals and missing prices", () => {
  it("ignores expired deals", () => {
    const expired = price({ ingredientId: "chicken-thigh", price: 0.99, packageQty: 1, packageUnit: "lb", isSale: true, endDate: "2026-11-01" });
    expect(offerStatus(expired, "2026-11-03")).toBe("expired");
    expect(isActive(expired, "2026-11-03")).toBe(false);
    const { reqs } = computeRequirements([meal("m", "sheet-pan-chicken")], ctx());
    const list = buildShoppingList(reqs, ctx({ prices: [...ctx().prices, expired], stores: [store("s1")] }), opts);
    const thigh = list.items.find((i) => i.ingredient.id === "chicken-thigh")!;
    expect(thigh.status).toBe("estimate");
  });
  it("prefers a real store price over an estimate", () => {
    const real = price({ ingredientId: "chicken-thigh", price: 7.5, packageQty: 3, packageUnit: "lb" });
    const { reqs } = computeRequirements([meal("m", "sheet-pan-chicken")], ctx());
    const list = buildShoppingList(reqs, ctx({ prices: [...ctx().prices, real], stores: [store("s1")] }), opts);
    const thigh = list.items.find((i) => i.ingredient.id === "chicken-thigh")!;
    expect(thigh.status).toBe("verified");
    expect(thigh.storeId).toBe("s1");
  });
  it("flags ingredients with no price instead of inventing one", () => {
    const { reqs } = computeRequirements([meal("m", "sheet-pan-chicken")], ctx());
    const noThighPrices = ctx().prices.filter((p) => p.ingredientId !== "chicken-thigh");
    const list = buildShoppingList(reqs, ctx({ prices: noThighPrices }), opts);
    expect(list.missing.map((i) => i.ingredient.id)).toContain("chicken-thigh");
    expect(list.items.find((i) => i.ingredient.id === "chicken-thigh")!.cost).toBe(0);
  });
});

describe("store comparison", () => {
  it("finds the cheapest single store and multi-store savings", () => {
    const stores = [store("s1"), store("s2")];
    const prices = [
      ...ctx().prices,
      price({ storeId: "s1", ingredientId: "chicken-thigh", price: 6, packageQty: 3, packageUnit: "lb" }),
      price({ storeId: "s2", ingredientId: "chicken-thigh", price: 9, packageQty: 3, packageUnit: "lb" }),
      price({ storeId: "s1", ingredientId: "potato", price: 6, packageQty: 5, packageUnit: "lb" }),
      price({ storeId: "s2", ingredientId: "potato", price: 3, packageQty: 5, packageUnit: "lb" }),
    ];
    const c = ctx({ prices, stores });
    const { reqs } = computeRequirements([meal("m", "sheet-pan-chicken")], c);
    const cmp = compareStores(reqs, c, { includeStaples: true, overrides: {}, maxStores: 2 });
    expect(cmp.bestSingle!.storeId).toBe("s1");
    expect(cmp.bestMulti!.storeIds.sort()).toEqual(["s1", "s2"]);
    expect(cmp.multiSavings).toBeCloseTo(3);
  });
});

describe("budget summary", () => {
  it("computes remaining, per-meal and per-serving costs", () => {
    const meals = [meal("m1", "sheet-pan-chicken"), meal("m2", "lentil-veg-soup")];
    const { reqs } = computeRequirements(meals, ctx());
    const list = buildShoppingList(reqs, ctx(), opts);
    const s = summarizeBudget(100, meals, list, FAMILY);
    expect(s.total).toBe(list.total);
    expect(s.remaining).toBeCloseTo(100 - list.total, 2);
    expect(s.perMeal).toBeCloseTo(list.total / 2, 2);
    // Allocated meal costs + leftover value add back up to the bill.
    const allocated = s.byMeal.reduce((a, m) => a + m.cost, 0);
    expect(allocated + s.leftoverValue).toBeCloseTo(list.total, 0);
  });

  it("suggests cheaper substitutions that respect diets", () => {
    const meals = [meal("m1", "beef-bean-chili")];
    const c = ctx();
    const list = buildShoppingList(computeRequirements(meals, c).reqs, c, opts);
    const subs = suggestSubstitutions(list, c, BUILTIN_INGREDIENTS, null);
    expect(subs.some((s) => s.fromId === "ground-beef")).toBe(true);
    const noPork = ctx({ members: [adult("a", { diets: ["no-pork"] })] });
    const subs2 = suggestSubstitutions(list, noPork, BUILTIN_INGREDIENTS, null);
    expect(subs2.some((s) => s.toId === "ground-pork")).toBe(false);
  });
});
