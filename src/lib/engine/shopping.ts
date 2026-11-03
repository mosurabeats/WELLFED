import type {
  Category,
  Ingredient,
  Member,
  PantryItem,
  PlannedMeal,
  PriceEntry,
  PriceSource,
  Recipe,
  ShoppingOverride,
  Store,
} from "../types";
import type { IngredientLookup } from "./nutrition";
import { cheapestPurchase, isActive, type Purchase } from "./pricing";
import { portionFactor } from "./targets";
import { tryToGrams } from "./units";

export interface PlanContext {
  lookup: IngredientLookup;
  recipes: Map<string, Recipe>;
  members: Member[];
  prices: PriceEntry[];
  stores: Store[];
  pantry: PantryItem[];
  today: string;
}

// ── Servings & requirements ───────────────────────────────────────

/** Standard servings needed for a meal: the sum of each attendee's portion. */
export function mealServings(meal: Pick<PlannedMeal, "attendees" | "portionOverrides">, members: Member[]): number {
  let s = 0;
  for (const id of meal.attendees) {
    const m = members.find((x) => x.id === id);
    if (!m) continue;
    s += meal.portionOverrides?.[id] ?? portionFactor(m);
  }
  return Math.round(s * 100) / 100;
}

export interface Use {
  mealId: string;
  recipeId: string;
  grams: number;
}

export interface Requirement {
  ingredientId: string;
  grams: number;
  uses: Use[];
}

/**
 * Total grams of each ingredient required across all meals, scaled to the
 * number of servings each meal actually needs.
 */
export function computeRequirements(
  meals: PlannedMeal[],
  ctx: Pick<PlanContext, "recipes" | "members" | "lookup">,
  substitutions: Record<string, string> = {},
  extras: Record<string, number> = {},
): { reqs: Map<string, Requirement>; problems: string[] } {
  const reqs = new Map<string, Requirement>();
  const problems: string[] = [];
  const add = (id: string, grams: number, use?: Use) => {
    const r = reqs.get(id) ?? { ingredientId: id, grams: 0, uses: [] };
    r.grams += grams;
    if (use) r.uses.push(use);
    reqs.set(id, r);
  };
  for (const meal of meals) {
    const recipe = ctx.recipes.get(meal.recipeId);
    if (!recipe) {
      problems.push(`Recipe ${meal.recipeId} not found`);
      continue;
    }
    const servings = mealServings(meal, ctx.members);
    if (servings <= 0) continue;
    const scale = servings / recipe.servings;
    for (const line of recipe.ingredients) {
      const id = substitutions[line.ingredientId] ?? line.ingredientId;
      const ing = ctx.lookup(id);
      if (!ing) {
        problems.push(`${recipe.name}: unknown ingredient "${id}"`);
        continue;
      }
      const g = tryToGrams(line.qty * scale, line.unit, ing);
      if (g == null) {
        problems.push(`${recipe.name}: can't measure ${line.unit} of ${ing.name}`);
        continue;
      }
      add(id, g, { mealId: meal.id, recipeId: recipe.id, grams: g });
    }
  }
  for (const [id, g] of Object.entries(extras)) if (g > 0) add(id, g);
  return { reqs, problems };
}

/** Grams of each ingredient on hand in the pantry. */
export function pantryGrams(pantry: PantryItem[], lookup: IngredientLookup): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of pantry) {
    const ing = lookup(p.ingredientId);
    if (!ing) continue;
    const g = tryToGrams(p.qty, p.unit, ing);
    if (g == null) continue;
    out.set(p.ingredientId, (out.get(p.ingredientId) ?? 0) + g);
  }
  return out;
}

// ── Offer selection ────────────────────────────────────────────────

export interface PriceChoice {
  purchase: Purchase;
  storeId: string | null;
  source: PriceSource;
}

/**
 * Pick the cheapest real offer among the allowed stores. Store-agnostic
 * estimates are used only when no store-specific price exists, because an
 * estimate is not something you can actually buy.
 */
export function choosePrice(
  ingredientId: string,
  grams: number,
  ctx: Pick<PlanContext, "prices" | "lookup" | "today">,
  allowedStores: string[] | null,
  forcedStore?: string | null,
): PriceChoice | null {
  const ing = ctx.lookup(ingredientId);
  if (!ing || grams <= 0) return null;
  const offers = ctx.prices.filter((p) => p.ingredientId === ingredientId && isActive(p, ctx.today));
  const storeOffers = offers.filter((p) => {
    if (p.storeId == null || p.source === "estimate") return false;
    if (forcedStore !== undefined) return p.storeId === forcedStore;
    return allowedStores == null || allowedStores.includes(p.storeId);
  });
  let best: PriceChoice | null = null;
  const byStore = new Map<string, PriceEntry[]>();
  for (const o of storeOffers) byStore.set(o.storeId!, [...(byStore.get(o.storeId!) ?? []), o]);
  for (const [storeId, list] of byStore) {
    const p = cheapestPurchase(grams, list, ing);
    if (p && (!best || p.cost < best.purchase.cost)) best = { purchase: p, storeId, source: p.picks[0].entry.source };
  }
  if (best) return best;
  const estimates = offers.filter((p) => p.source === "estimate");
  const p = cheapestPurchase(grams, estimates, ing);
  return p ? { purchase: p, storeId: null, source: "estimate" } : null;
}

/** Fast cost lookup used by the planner (memoised per ingredient + grams bucket). */
export class CostModel {
  private cache = new Map<string, number>();
  constructor(
    private ctx: Pick<PlanContext, "prices" | "lookup" | "today">,
    private allowedStores: string[] | null,
    private pantry: Map<string, number>,
    private skip: (id: string) => boolean,
  ) {}

  /** Cost to buy enough for `grams` total of an ingredient after pantry. */
  cost(id: string, grams: number): number {
    if (this.skip(id)) return 0;
    const need = Math.max(0, grams - (this.pantry.get(id) ?? 0));
    if (need <= 0.5) return 0;
    const bucket = Math.ceil(need / 5) * 5; // 5 g resolution keeps the cache small
    const key = `${id}|${bucket}`;
    let v = this.cache.get(key);
    if (v === undefined) {
      const c = choosePrice(id, bucket, this.ctx, this.allowedStores);
      v = c ? c.purchase.cost : NaN;
      this.cache.set(key, v);
    }
    return v;
  }

  hasPrice(id: string): boolean {
    return !Number.isNaN(this.cost(id, 100)) || this.skip(id);
  }

  total(reqs: Map<string, number>): number {
    let t = 0;
    for (const [id, g] of reqs) {
      const c = this.cost(id, g);
      if (!Number.isNaN(c)) t += c;
    }
    return t;
  }
}

// ── Shopping list ─────────────────────────────────────────────────

export type PriceStatus = "verified" | "estimate" | "demo" | "missing" | "owned" | "on-hand";

export interface ShoppingItem {
  ingredient: Ingredient;
  category: Category;
  neededGrams: number;
  pantryGrams: number;
  toBuyGrams: number;
  purchase: Purchase | null;
  storeId: string | null;
  source: PriceSource | null;
  status: PriceStatus;
  cost: number;
  leftoverGrams: number;
  uses: Use[];
  override: ShoppingOverride;
  /** Staple assumed already in the kitchen because staples are excluded from the budget. */
  assumedOnHand: boolean;
}

export interface ShoppingList {
  items: ShoppingItem[];
  total: number;
  verifiedTotal: number;
  estimateTotal: number;
  demoTotal: number;
  missing: ShoppingItem[];
  byStore: { storeId: string | null; total: number; count: number }[];
  actualTotal: number;
  actualCount: number;
  problems: string[];
}

export interface ListOptions {
  allowedStores: string[] | null;
  includeStaples: boolean;
  overrides: Record<string, ShoppingOverride>;
}

export function buildShoppingList(
  reqs: Map<string, Requirement>,
  ctx: PlanContext,
  opts: ListOptions,
  problems: string[] = [],
): ShoppingList {
  const pantry = pantryGrams(ctx.pantry, ctx.lookup);
  const items: ShoppingItem[] = [];
  for (const r of reqs.values()) {
    const ing = ctx.lookup(r.ingredientId);
    if (!ing) continue;
    const override = opts.overrides[r.ingredientId] ?? {};
    const have = pantry.get(r.ingredientId) ?? 0;
    const pantryUsed = Math.min(have, r.grams);
    const toBuy = Math.max(0, r.grams - pantryUsed);
    const assumedOnHand = !!ing.staple && !opts.includeStaples;
    const base = {
      ingredient: ing,
      category: ing.category,
      neededGrams: r.grams,
      pantryGrams: pantryUsed,
      toBuyGrams: toBuy,
      uses: r.uses,
      override,
      assumedOnHand,
    };
    if (override.owned || assumedOnHand || toBuy <= 0.5) {
      items.push({
        ...base,
        toBuyGrams: override.owned || assumedOnHand ? 0 : toBuy,
        purchase: null,
        storeId: null,
        source: null,
        status: override.owned ? "owned" : "on-hand",
        cost: 0,
        leftoverGrams: 0,
      });
      continue;
    }
    let choice = choosePrice(r.ingredientId, toBuy, ctx, opts.allowedStores, override.storeId);
    if (!choice && override.storeId !== undefined) choice = choosePrice(r.ingredientId, toBuy, ctx, opts.allowedStores);
    if (choice && override.packages != null && choice.purchase.picks.length) {
      const entry = choice.purchase.picks[0].entry;
      const g = tryToGrams(entry.packageQty, entry.packageUnit, ing) ?? 0;
      choice = {
        ...choice,
        purchase: {
          picks: [{ entry, count: override.packages }],
          cost: entry.price * override.packages,
          purchasedGrams: g * override.packages,
        },
      };
    }
    if (!choice) {
      items.push({ ...base, purchase: null, storeId: null, source: null, status: "missing", cost: 0, leftoverGrams: 0 });
      continue;
    }
    const status: PriceStatus =
      choice.source === "estimate" ? "estimate" : choice.source === "demo" ? "demo" : "verified";
    items.push({
      ...base,
      purchase: choice.purchase,
      storeId: choice.storeId,
      source: choice.source,
      status,
      cost: choice.purchase.cost,
      leftoverGrams: Math.max(0, choice.purchase.purchasedGrams - toBuy),
    });
  }

  const order: Category[] = ["produce", "meat", "seafood", "dairy", "eggs", "bakery", "frozen", "grains", "canned", "condiments", "oils", "spices"];
  items.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.ingredient.name.localeCompare(b.ingredient.name));

  const sum = (f: (i: ShoppingItem) => boolean) => round2(items.filter(f).reduce((s, i) => s + i.cost, 0));
  const storeMap = new Map<string | null, { storeId: string | null; total: number; count: number }>();
  for (const i of items) {
    if (!i.purchase) continue;
    const s = storeMap.get(i.storeId) ?? { storeId: i.storeId, total: 0, count: 0 };
    s.total = round2(s.total + i.cost);
    s.count++;
    storeMap.set(i.storeId, s);
  }
  const actual = items.filter((i) => i.override.actualPrice != null);
  return {
    items,
    total: sum(() => true),
    verifiedTotal: sum((i) => i.status === "verified"),
    estimateTotal: sum((i) => i.status === "estimate"),
    demoTotal: sum((i) => i.status === "demo"),
    missing: items.filter((i) => i.status === "missing"),
    byStore: [...storeMap.values()].sort((a, b) => b.total - a.total),
    actualTotal: round2(actual.reduce((s, i) => s + (i.override.actualPrice ?? 0), 0)),
    actualCount: actual.length,
    problems,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Store comparison ──────────────────────────────────────────────

export interface StoreComparison {
  single: { storeId: string; total: number; pricedAtStore: number; fallback: number }[];
  bestSingle: { storeId: string; total: number } | null;
  bestMulti: { storeIds: string[]; total: number } | null;
  /** Savings of the best multi-store plan vs the best single store. */
  multiSavings: number;
  unpriced: string[];
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...rest] = arr;
  return [...combinations(rest, k - 1).map((c) => [head, ...c]), ...combinations(rest, k)];
}

export function compareStores(
  reqs: Map<string, Requirement>,
  ctx: PlanContext,
  opts: Omit<ListOptions, "allowedStores"> & { maxStores: number },
): StoreComparison {
  const pricedStores = [...new Set(ctx.prices.filter((p) => p.storeId && p.source !== "estimate" && isActive(p, ctx.today)).map((p) => p.storeId!))]
    .filter((id) => ctx.stores.some((s) => s.id === id));
  const noOverrides = Object.fromEntries(
    Object.entries(opts.overrides).map(([k, v]) => [k, { ...v, storeId: undefined, packages: undefined }]),
  );
  const listFor = (stores: string[]) =>
    buildShoppingList(reqs, ctx, { ...opts, overrides: noOverrides, allowedStores: stores });
  const single = pricedStores.map((storeId) => {
    const l = listFor([storeId]);
    return {
      storeId,
      total: l.total,
      pricedAtStore: l.items.filter((i) => i.storeId === storeId).length,
      fallback: l.items.filter((i) => i.status === "estimate" || i.status === "missing").length,
    };
  }).sort((a, b) => a.total - b.total);
  let bestMulti: StoreComparison["bestMulti"] = null;
  for (let k = 2; k <= Math.min(opts.maxStores, pricedStores.length); k++) {
    for (const combo of combinations(pricedStores, k).slice(0, 300)) {
      const l = listFor(combo);
      const used = [...new Set(l.items.filter((i) => i.storeId).map((i) => i.storeId!))];
      if (!bestMulti || l.total < bestMulti.total - 0.005) bestMulti = { storeIds: used, total: l.total };
    }
  }
  const bestSingle = single[0] ? { storeId: single[0].storeId, total: single[0].total } : null;
  if (bestMulti && bestSingle && bestMulti.total >= bestSingle.total - 0.005) bestMulti = null;
  const all = listFor(pricedStores);
  return {
    single,
    bestSingle,
    bestMulti,
    multiSavings: bestMulti && bestSingle ? round2(bestSingle.total - bestMulti.total) : 0,
    unpriced: all.missing.map((i) => i.ingredient.name),
  };
}
