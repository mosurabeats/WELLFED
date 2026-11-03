import { describe, expect, it } from "vitest";
import { toGrams, fromGrams, formatQty, UnitConversionError } from "@/lib/engine/units";
import { recipeNutrition, scaleRecipe, nutrientsForGrams } from "@/lib/engine/nutrition";
import { memberTargets, portionFactor } from "@/lib/engine/targets";
import { BUILTIN_RECIPES } from "@/data/recipes";
import { lookup, adult, child, BUILTIN_INGREDIENTS } from "./helpers";

describe("unit conversion", () => {
  const rice = lookup("white-rice")!;
  const egg = lookup("egg")!;
  it("converts mass units exactly", () => {
    expect(toGrams(1, "lb", rice)).toBeCloseTo(453.592, 2);
    expect(toGrams(10, "oz", rice)).toBeCloseTo(283.495, 2);
    expect(fromGrams(907.18474, "lb", rice)).toBeCloseTo(2, 6);
  });
  it("converts volume via density", () => {
    // 1 cup of rice at 0.78 g/ml ≈ 184.5 g (USDA lists 185 g)
    expect(toGrams(1, "cup", rice)).toBeCloseTo(184.5, 0);
  });
  it("converts counts via each-weight", () => {
    expect(toGrams(12, "each", egg)).toBe(600);
  });
  it("refuses conversions it cannot do instead of guessing", () => {
    expect(() => toGrams(1, "cup", lookup("chicken-breast")!)).toThrow(UnitConversionError);
  });
  it("formats kitchen fractions", () => {
    expect(formatQty(1.5)).toBe("1½");
    expect(formatQty(0.25)).toBe("¼");
    expect(formatQty(2)).toBe("2");
  });
});

describe("nutrition", () => {
  it("every built-in ingredient has USDA data", () => {
    for (const ing of BUILTIN_INGREDIENTS) {
      expect(ing.nutritionSource).toBe("usda");
      expect(ing.fdcId).toBeTypeOf("number");
      expect(ing.per100g.kcal).toBeGreaterThanOrEqual(0);
    }
  });

  it("uses USDA values: 100 g raw chicken breast = 120 kcal, 22.5 g protein", () => {
    const n = nutrientsForGrams(lookup("chicken-breast")!, 100);
    expect(n.kcal).toBe(120);
    expect(n.protein).toBeCloseTo(22.5);
  });

  it("applies edible yield (a banana's weight is peeled; broccoli loses stems)", () => {
    const broc = lookup("broccoli")!;
    const n = nutrientsForGrams(broc, 100);
    expect(n.kcal).toBeCloseTo(broc.per100g.kcal * (broc.yield ?? 1));
  });

  it("every built-in recipe resolves to complete nutrition", () => {
    for (const r of BUILTIN_RECIPES) {
      const n = recipeNutrition(r, lookup);
      expect(n.incomplete, r.id).toEqual([]);
      expect(n.perServing.kcal, r.id).toBeGreaterThan(50);
      expect(n.perServing.kcal, r.id).toBeLessThan(1200);
    }
  });

  it("per-serving nutrition is total / servings and is invariant to scaling", () => {
    const r = BUILTIN_RECIPES.find((x) => x.id === "beef-bean-chili")!;
    const base = recipeNutrition(r, lookup);
    const doubled = recipeNutrition(scaleRecipe(r, r.servings * 2), lookup);
    expect(doubled.total.kcal).toBeCloseTo(base.total.kcal * 2, 6);
    expect(doubled.perServing.protein).toBeCloseTo(base.perServing.protein, 6);
  });

  it("scales recipe quantities linearly", () => {
    const r = BUILTIN_RECIPES.find((x) => x.id === "sheet-pan-chicken")!;
    const s = scaleRecipe(r, 6);
    expect(s.servings).toBe(6);
    expect(s.ingredients[0].qty).toBeCloseTo(r.ingredients[0].qty * 1.5);
  });

  it("reports unknown ingredients instead of inventing numbers", () => {
    const n = recipeNutrition({ servings: 1, ingredients: [{ ingredientId: "dragonfruit-powder", qty: 1, unit: "cup" }] }, lookup);
    expect(n.incomplete).toEqual(["dragonfruit-powder"]);
    expect(n.total.kcal).toBe(0);
  });

  it("derives added sugar for pure sweeteners only", () => {
    expect(lookup("sugar")!.per100g.addedSugar).toBeGreaterThan(95);
    expect(lookup("bbq-sauce")!.per100g.addedSugar).toBeNull();
  });
});

describe("targets & portions", () => {
  it("children get age-based targets and ignore adult goals", () => {
    const kid = child("k", 6, { goal: "lose" });
    const t = memberTargets(kid);
    expect(t.kcal).toBe(1400);
    expect(t.protein).toBe(19);
  });
  it("muscle-building adults get more protein and a bigger portion", () => {
    const base = adult("a", { sex: "male", weightKg: 80, heightCm: 180 });
    const lifter = { ...base, goal: "muscle" as const };
    expect(memberTargets(lifter).protein).toBe(128);
    expect(portionFactor(lifter)).toBeGreaterThan(portionFactor(base));
  });
  it("explicit adult targets override computed values", () => {
    expect(memberTargets(adult("a", { targets: { kcal: 1800 } })).kcal).toBe(1800);
  });
  it("a young child's portion is smaller than an adult's", () => {
    expect(portionFactor(child("k", 5))).toBeCloseTo(0.7);
    expect(portionFactor(adult("a"))).toBeCloseTo(1.1);
  });
});
