import { describe, expect, it } from "vitest";
import { parseFlyerText, matchIngredient } from "@/lib/flyer";
import { parseLocally } from "@/lib/assistant/local-parser";
import { parseRecipeText } from "@/lib/recipe-import";
import { classifyChain, parseOverpass } from "@/lib/stores-osm";
import { BUILTIN_INGREDIENTS } from "./helpers";

describe("flyer text parser", () => {
  const items = parseFlyerText(
    ["Boneless Chicken Thighs $1.99/lb with card", "Broccoli Crowns $1.49 lb", "Barilla Pasta 16 oz 2 for $3", "Large Eggs dozen $2.99 was $3.79", "Store hours 7am-10pm"].join("\n"),
    BUILTIN_INGREDIENTS,
  );
  it("reads per-pound prices and loyalty flags", () => {
    expect(items[0]).toMatchObject({ ingredientId: "chicken-thigh", price: 1.99, packageQty: 1, packageUnit: "lb", loyaltyRequired: true });
    expect(items[1]).toMatchObject({ ingredientId: "broccoli", price: 1.49, packageUnit: "lb" });
  });
  it("turns multi-buys into a per-item price", () => {
    expect(items[2]).toMatchObject({ ingredientId: "pasta", price: 1.5, packageQty: 16, packageUnit: "oz", promoNotes: "2 for $3" });
  });
  it("captures regular price", () => {
    expect(items[3]).toMatchObject({ ingredientId: "egg", price: 2.99, regularPrice: 3.79 });
  });
  it("skips lines without a price instead of guessing", () => {
    expect(items).toHaveLength(4);
  });
  it("maps common names to catalog ingredients", () => {
    expect(matchIngredient("93% Lean Ground Turkey", BUILTIN_INGREDIENTS)).toBe("ground-turkey");
    expect(matchIngredient("Sweet Potatoes", BUILTIN_INGREDIENTS)).toBe("sweet-potato");
    expect(matchIngredient("Paper towels", BUILTIN_INGREDIENTS)).toBeNull();
  });
});

describe("offline assistant parser", () => {
  it("understands the headline request", () => {
    const r = parseLocally("I have $90 to feed four people for five days, two meals per day. Prioritize balanced nutrition and use local grocery deals.", BUILTIN_INGREDIENTS);
    expect(r.actions[0]).toMatchObject({ type: "generate_plan", budget: 90, days: 5, people: 4, mealTypes: ["lunch", "dinner"], priority: "balanced" });
  });
  it("swaps a weekday meal for kids", () => {
    const r = parseLocally("Replace Wednesday's dinner with something the kids will like.", BUILTIN_INGREDIENTS);
    expect(r.actions[0]).toMatchObject({ type: "swap_meal", weekday: 3, mealType: "dinner", kidFriendly: true });
  });
  it("adjusts protein and cost", () => {
    expect(parseLocally("Make this week's meals higher in protein.", BUILTIN_INGREDIENTS).actions[0]).toMatchObject({ type: "adjust_plan", goal: "higher-protein" });
    expect(parseLocally("Find cheaper alternatives without reducing protein too much.", BUILTIN_INGREDIENTS).actions[0]).toMatchObject({ type: "adjust_plan", goal: "cheaper", keepProtein: true });
  });
  it("handles time limits for a specific day", () => {
    expect(parseLocally("Make tomorrow's dinner take less than 30 minutes.", BUILTIN_INGREDIENTS).actions[0]).toMatchObject({ type: "swap_meal", relativeDay: "tomorrow", maxCookMinutes: 30 });
  });
  it("uses pantry ingredients and stores", () => {
    const r = parseLocally("Use the chicken and potatoes already in my refrigerator.", BUILTIN_INGREDIENTS);
    expect(r.actions[0].type).toBe("generate_plan");
    expect(r.actions[0].preferIngredients).toEqual(expect.arrayContaining(["potato"]));
    expect(parseLocally("Plan meals around this week's Hannaford specials.", BUILTIN_INGREDIENTS).actions[0]).toMatchObject({ type: "generate_plan", storeChain: "hannaford" });
  });
});

describe("recipe text import", () => {
  it("matches ingredient lines and keeps steps", () => {
    const r = parseRecipeText("Easy Rice Bowl\n1 ½ cups white rice\n2 tbsp soy sauce\n1 lb chicken breast\n3 cloves garlic\n1 pinch unicorn dust\n1. Cook the rice.\n2. Stir-fry the chicken with garlic and soy sauce.", BUILTIN_INGREDIENTS);
    expect(r.name).toBe("Easy Rice Bowl");
    expect(r.ingredients.map((i) => [i.ingredientId, i.qty, i.unit])).toEqual([
      ["white-rice", 1.5, "cup"],
      ["soy-sauce", 2, "tbsp"],
      ["chicken-breast", 1, "lb"],
      ["garlic", 3, "each"],
    ]);
    expect(r.unmatched).toEqual(["1 pinch unicorn dust"]);
    expect(r.steps).toHaveLength(2);
  });
});

describe("store lookup parsing", () => {
  it("classifies Vermont chains", () => {
    expect(classifyChain("Hannaford Supermarket")).toBe("hannaford");
    expect(classifyChain("Market 32")).toBe("price-chopper");
    expect(classifyChain("Shaw's")).toBe("shaws");
    expect(classifyChain("City Market, Onion River Co-op")).toBe("other");
  });
  it("parses Overpass results with distance, sorted and de-duplicated", () => {
    const origin = { lat: 44.484, lon: -73.2199 };
    const res = parseOverpass({
      elements: [
        { type: "way", id: 2, center: { lat: 44.5, lon: -73.2 }, tags: { name: "Hannaford", brand: "Hannaford", "addr:city": "Burlington" } },
        { type: "node", id: 1, lat: 44.485, lon: -73.22, tags: { name: "Shaw's" } },
        { type: "node", id: 3, lat: 44.485, lon: -73.22, tags: { name: "Shaw's" } },
        { type: "node", id: 4, lat: 44.4, lon: -73.1 },
      ],
    }, origin);
    expect(res.map((s) => s.chain)).toEqual(["shaws", "hannaford"]);
    expect(res[0].distanceKm).toBeLessThan(1);
  });
});

describe("flyer import helpers", () => {
  it("merges pages and drops exact repeats", async () => {
    const { mergeFlyerItems } = await import("@/lib/flyer");
    const a = { productName: "Broccoli Crowns", price: 1.49, packageQty: 1, packageUnit: "lb" as const, ingredientId: "broccoli" };
    const b = { productName: "Pasta", price: 1, packageQty: 16, packageUnit: "oz" as const, ingredientId: "pasta" };
    expect(mergeFlyerItems([[a, b], [{ ...a, productName: " broccoli crowns" }]])).toHaveLength(2);
  });
  it("replaces only overlapping flyer deals from the same store", async () => {
    const { supersededFlyerIds } = await import("@/lib/flyer");
    const prices = [
      { id: "old-week", storeId: "s1", source: "flyer", startDate: "2026-10-30", endDate: "2026-11-05" },
      { id: "last-month", storeId: "s1", source: "flyer", startDate: "2026-10-01", endDate: "2026-10-07" },
      { id: "typed", storeId: "s1", source: "user", startDate: "2026-11-01", endDate: "2026-11-07" },
      { id: "other-store", storeId: "s2", source: "flyer", startDate: "2026-11-01", endDate: "2026-11-07" },
    ];
    expect(supersededFlyerIds(prices, "s1", "2026-11-03", "2026-11-09")).toEqual(["old-week"]);
  });
  it("prefers a store's saved flyer link over the chain default", async () => {
    const { flyerLink } = await import("@/lib/stores-osm");
    expect(flyerLink({ chain: "shaws" })).toEqual({ url: "https://www.shaws.com/weeklyad", exact: true });
    expect(flyerLink({ chain: "hannaford" })?.exact).toBe(false);
    expect(flyerLink({ chain: "hannaford", flyerUrl: "https://example.test/ad" })).toEqual({ url: "https://example.test/ad", exact: true });
    expect(flyerLink({ chain: "other" })).toBeNull();
  });
});
