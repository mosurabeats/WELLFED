import { describe, expect, it } from "vitest";
import { generatePlan, buildSlots, Planner } from "@/lib/engine/planner";
import { findConflicts, isSafeFor } from "@/lib/engine/allergens";
import { buildShoppingList, computeRequirements } from "@/lib/engine/shopping";
import { BUILTIN_RECIPES } from "@/data/recipes";
import { ctx, request, EVERYONE, FAMILY, adult, child, lookup, price, store, pantryItem } from "./helpers";

const R = (id: string) => BUILTIN_RECIPES.find((r) => r.id === id)!;

describe("allergy conflicts", () => {
  it("flags peanut in peanut noodles for a peanut-allergic child", () => {
    const kid = child("k", 7, { allergies: ["peanut"] });
    const c = findConflicts(R("peanut-noodles-chicken"), [kid], lookup);
    expect(c.some((x) => x.kind === "allergy" && x.ingredientId === "peanut-butter")).toBe(true);
    expect(isSafeFor(R("peanut-noodles-chicken"), [kid], lookup)).toBe(false);
  });
  it("flags hidden wheat in soy sauce for gluten-free eaters", () => {
    expect(isSafeFor(R("beef-broccoli"), [adult("a", { diets: ["gluten-free"] })], lookup)).toBe(false);
  });
  it("vegetarians can't have chicken broth", () => {
    expect(isSafeFor(R("chicken-noodle-soup"), [adult("a", { diets: ["vegetarian"] })], lookup)).toBe(false);
    expect(isSafeFor(R("lentil-veg-soup"), [adult("a", { diets: ["vegan"] })], lookup)).toBe(true);
  });
  it("an optional garnish conflict is reported but doesn't block", () => {
    const c = findConflicts(R("minestrone"), [adult("a", { allergies: ["milk"] })], lookup);
    expect(c[0].optionalOnly).toBe(true);
    expect(isSafeFor(R("minestrone"), [adult("a", { allergies: ["milk"] })], lookup)).toBe(true);
  });
  it("unverified (AI) ingredients block anyone with allergies", () => {
    const r = { ...R("minestrone"), unmatchedIngredients: ["mystery sauce"] };
    expect(isSafeFor(r, [adult("a", { allergies: ["soy"] })], lookup)).toBe(false);
  });
});

describe("meal plan generation", () => {
  it("builds the $90 / 4 people / 5 days / 2 meals scenario honestly", () => {
    const res = generatePlan({ request: request({ budget: 90 }), schedule: EVERYONE, ctx: ctx() });
    expect(res.meals).toHaveLength(10);
    const c = ctx();
    const list = buildShoppingList(computeRequirements(res.meals, c).reqs, c, { allowedStores: null, includeStaples: false, overrides: {} });
    // The planner's cost model and the shopping list agree within rounding buckets.
    expect(Math.abs(list.total - res.estimatedCost)).toBeLessThan(2);
    if (res.feasible) expect(res.estimatedCost).toBeLessThanOrEqual(90);
    else expect(res.shortfall!.gap).toBeGreaterThan(0);
  });

  it("never schedules an allergen for someone at that meal", () => {
    const fam = [adult("a1"), child("k1", 6, { allergies: ["peanut", "egg"] })];
    const res = generatePlan({ request: request({ budget: 200, mealTypes: ["breakfast", "lunch", "dinner"], includeSnacks: true }), schedule: EVERYONE, ctx: ctx({ members: fam }) });
    expect(res.meals.length).toBeGreaterThan(0);
    for (const m of res.meals) {
      const r = ctx().recipes.get(m.recipeId)!;
      expect(isSafeFor(r, fam, lookup), r.id).toBe(true);
    }
  });

  it("avoids repeating identical meals", () => {
    const res = generatePlan({ request: request({ budget: 250, days: 7 }), schedule: EVERYONE, ctx: ctx() });
    const counts = new Map<string, number>();
    res.meals.forEach((m) => counts.set(m.recipeId, (counts.get(m.recipeId) ?? 0) + 1));
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(1);
  });

  it("respects a maximum cooking time", () => {
    const res = generatePlan({ request: request({ budget: 200, maxCookMinutes: 30 }), schedule: EVERYONE, ctx: ctx() });
    for (const m of res.meals) {
      const r = ctx().recipes.get(m.recipeId)!;
      expect(r.prepMinutes + r.cookMinutes).toBeLessThanOrEqual(30);
    }
  });

  it("explains an impossible budget instead of fabricating a plan", () => {
    const res = generatePlan({ request: request({ budget: 15 }), schedule: EVERYONE, ctx: ctx() });
    expect(res.feasible).toBe(false);
    expect(res.shortfall).toBeDefined();
    expect(res.shortfall!.gap).toBeGreaterThan(0);
    expect(res.estimatedCost).toBeGreaterThan(15);
    expect(res.shortfall!.suggestions.join(" ")).toMatch(/Raise the budget/);
  });

  it("cost priority produces a cheaper plan than nutrition priority", () => {
    const cheap = generatePlan({ request: request({ budget: 400, priority: "cost" }), schedule: EVERYONE, ctx: ctx() });
    const nutri = generatePlan({ request: request({ budget: 400, priority: "nutrition" }), schedule: EVERYONE, ctx: ctx() });
    expect(cheap.estimatedCost).toBeLessThanOrEqual(nutri.estimatedCost);
  });

  it("favors recipes using discounted ingredients", () => {
    const deal = price({ storeId: "s1", ingredientId: "chicken-thigh", price: 2.97, regularPrice: 10.47, packageQty: 3, packageUnit: "lb", isSale: true, source: "flyer" });
    const res = generatePlan({ request: request({ budget: 200 }), schedule: EVERYONE, ctx: ctx({ prices: [...ctx().prices, deal], stores: [store("s1")] }) });
    const usesThigh = res.meals.filter((m) => ctx().recipes.get(m.recipeId)!.ingredients.some((i) => i.ingredientId === "chicken-thigh"));
    expect(usesThigh.length).toBeGreaterThanOrEqual(2);
  });

  it("uses pantry items that are about to expire", () => {
    const pantry = [pantryItem("lentils", 1, "lb", { expiresOn: "2026-11-05" })];
    const res = generatePlan({ request: request({ budget: 200 }), schedule: EVERYONE, ctx: ctx({ pantry }) });
    expect(res.meals.some((m) => m.recipeId === "lentil-veg-soup")).toBe(true);
  });
});

describe("household attendance", () => {
  it("only plans slots someone attends and scales to attendees", () => {
    // Mon (1) dinner: adults only; Tue (2) dinner: everyone; no lunches at all.
    const schedule = {
      1: { dinner: ["a1", "a2"], lunch: [] },
      2: { dinner: FAMILY.map((m) => m.id), lunch: [] },
      3: { lunch: [], dinner: ["a1", "a2"] },
      4: { lunch: [], dinner: FAMILY.map((m) => m.id) },
      5: { lunch: [], dinner: [] },
    };
    const slots = buildSlots(request({ days: 5 }), schedule, FAMILY);
    expect(slots).toHaveLength(4);
    expect(slots[0].attendees).toEqual(["a1", "a2"]);
  });
  it("changing attendance changes the shopping quantities", () => {
    const res = generatePlan({ request: request({ budget: 200, days: 1, mealTypes: ["dinner"] }), schedule: EVERYONE, ctx: ctx() });
    const c = ctx();
    const full = computeRequirements(res.meals, c).reqs;
    const fewer = computeRequirements(res.meals.map((m) => ({ ...m, attendees: ["a1"] })), c).reqs;
    const total = (r: typeof full) => [...r.values()].reduce((s, x) => s + x.grams, 0);
    expect(total(fewer)).toBeLessThan(total(full) * 0.5);
  });
});

describe("meal swapping", () => {
  it("offers safe replacements and recomputes the plan total", () => {
    const c = ctx();
    const req = request({ budget: 200 });
    const res = generatePlan({ request: req, schedule: EVERYONE, ctx: c });
    const planner = new Planner({ request: req, schedule: EVERYONE, ctx: c });
    const target = res.meals[0];
    const options = planner.replacements(res.meals, target.id);
    expect(options.length).toBeGreaterThan(3);
    expect(options.every((o) => o.profile.recipe.id !== target.recipeId)).toBe(true);
    const swapped = res.meals.map((m) => (m.id === target.id ? { ...m, recipeId: options[0].profile.recipe.id } : m));
    expect(planner.planCost(swapped)).toBeCloseTo(options[0].newTotal, 1);
  });
  it("can filter to kid-friendly and quick options", () => {
    const c = ctx();
    const req = request({ budget: 200 });
    const res = generatePlan({ request: req, schedule: EVERYONE, ctx: c });
    const planner = new Planner({ request: req, schedule: EVERYONE, ctx: c });
    const dinner = res.meals.find((m) => m.mealType === "dinner")!;
    const opts = planner.replacements(res.meals, dinner.id, { kidFriendly: true, maxMinutes: 30 });
    for (const o of opts) {
      expect(o.profile.recipe.tags).toContain("kid-friendly");
      expect(o.profile.totalMinutes).toBeLessThanOrEqual(30);
    }
  });
  it("reduce-to-budget lowers cost", () => {
    const c = ctx();
    const req = request({ budget: 400, priority: "nutrition" });
    const res = generatePlan({ request: req, schedule: EVERYONE, ctx: c });
    const planner = new Planner({ request: req, schedule: EVERYONE, ctx: c });
    const target = res.estimatedCost * 0.85;
    const reduced = planner.reduceToBudget(res.meals, target);
    expect(reduced.cost).toBeLessThan(res.estimatedCost);
    expect(reduced.changes.length).toBeGreaterThan(0);
  });
});
