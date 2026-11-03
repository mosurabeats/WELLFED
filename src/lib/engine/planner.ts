import type { MealType, Member, PlannedMeal, PlanRequest, Recipe, WeeklySchedule } from "../types";
import { isSafeFor, findConflicts } from "./allergens";
import { recipeNutrition, macroSplit, type IngredientLookup } from "./nutrition";
import { isActive, discountPct } from "./pricing";
import { CostModel, mealServings, pantryGrams, round2, type PlanContext } from "./shopping";
import { tryToGrams } from "./units";

// ── Slots from schedule ───────────────────────────────────────────

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function weekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export interface Slot {
  date: string;
  mealType: MealType;
  attendees: string[];
}

/** Expand the request + recurring schedule into meal slots. Slots nobody attends are skipped. */
export function buildSlots(req: PlanRequest, schedule: WeeklySchedule, members: Member[]): Slot[] {
  const types: MealType[] = [...req.mealTypes.filter((t) => t !== "snack")];
  if (req.includeSnacks) types.push("snack");
  const slots: Slot[] = [];
  for (let i = 0; i < req.days; i++) {
    const date = addDays(req.startDate, i);
    const day = schedule[weekday(date)] ?? {};
    for (const t of types) {
      const attendees = (day[t] ?? members.map((m) => m.id)).filter((id) => members.some((m) => m.id === id));
      if (attendees.length) slots.push({ date, mealType: t, attendees });
    }
  }
  return slots;
}

// ── Recipe scoring ────────────────────────────────────────────────

export interface RecipeProfile {
  recipe: Recipe;
  /** 0..1 nutritional quality of one serving for a general eater. */
  quality: number;
  proteinPerServing: number;
  kcalPerServing: number;
  proteinGroups: string[];
  ingredientIds: string[];
  totalMinutes: number;
}

export function profileRecipe(recipe: Recipe, lookup: IngredientLookup): RecipeProfile {
  const n = recipeNutrition(recipe, lookup);
  const s = n.perServing;
  const split = macroSplit(s);
  const isSnack = recipe.mealTypes.length === 1 && recipe.mealTypes[0] === "snack";
  const kcal = s.kcal || 1;
  // Each component is 0..1; weights reflect Dietary Guidelines priorities.
  const proteinScore = Math.min(1, split.protein / 0.25);
  const fiberScore = Math.min(1, (s.fiber / kcal) * 1000 / 14);
  const produceScore = Math.min(1, n.produceGramsPerServing / (isSnack ? 120 : 200));
  const sodiumScore = 1 - Math.min(1, Math.max(0, s.sodium - (isSnack ? 200 : 600)) / 900);
  const satScore = 1 - Math.min(1, Math.max(0, (s.satFat * 9) / kcal - 0.1) / 0.1);
  const [lo, hi] = isSnack ? [100, 350] : recipe.mealTypes.includes("breakfast") && !recipe.mealTypes.includes("dinner") ? [250, 600] : [400, 800];
  const kcalScore = kcal < lo ? kcal / lo : kcal > hi ? Math.max(0, 1 - (kcal - hi) / hi) : 1;
  const quality = 0.25 * proteinScore + 0.2 * fiberScore + 0.25 * produceScore + 0.1 * sodiumScore + 0.1 * satScore + 0.1 * kcalScore;
  const ids = recipe.ingredients.map((l) => l.ingredientId);
  const groups = [...new Set(ids.map((id) => lookup(id)?.protein).filter(Boolean) as string[])];
  return {
    recipe,
    quality,
    proteinPerServing: s.protein,
    kcalPerServing: s.kcal,
    proteinGroups: groups,
    ingredientIds: ids,
    totalMinutes: recipe.prepMinutes + recipe.cookMinutes,
  };
}

/** Goal-specific adjustment to quality for the people at a meal. */
function goalFit(p: RecipeProfile, members: Member[]): number {
  let adj = 0;
  for (const m of members) {
    if (m.kind === "child") {
      if (p.recipe.tags.includes("kid-friendly")) adj += 0.08;
      continue;
    }
    const split = p.kcalPerServing ? (p.proteinPerServing * 4) / p.kcalPerServing : 0;
    if (m.goal === "muscle") adj += split >= 0.3 ? 0.1 : split < 0.18 ? -0.08 : 0;
    if (m.goal === "lose") adj += p.kcalPerServing <= 600 ? 0.05 : -0.05;
    if (m.goal === "higher-fiber") adj += p.recipe.tags.includes("high-fiber") ? 0.08 : 0;
    if (m.goal === "lower-fat") adj += p.recipe.tags.includes("lower-fat") ? 0.08 : 0;
  }
  return adj / Math.max(1, members.length);
}

function likeScore(recipe: Recipe, members: Member[]): number {
  let s = 0;
  for (const m of members) {
    const r = recipe.ratings?.[m.id];
    if (r) s += (r - 3) * 0.04;
    if (m.likes.some((l) => recipe.tags.includes(l) || recipe.ingredients.some((i) => i.ingredientId === l))) s += 0.05;
  }
  if (recipe.favorite) s += 0.06;
  return s;
}

// ── Planner ───────────────────────────────────────────────────────

export interface PlanResult {
  meals: PlannedMeal[];
  estimatedCost: number;
  budget: number;
  feasible: boolean;
  notes: string[];
  /** Present when the budget can't cover the request. */
  shortfall?: Shortfall;
}

export interface Shortfall {
  cheapestPossible: number;
  budget: number;
  gap: number;
  servings: number;
  budgetPerServing: number;
  cheapestPerServing: number;
  suggestions: string[];
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

export interface PlannerInput {
  request: PlanRequest;
  schedule: WeeklySchedule;
  ctx: PlanContext;
  /** Meals to keep (locked) when regenerating. */
  locked?: PlannedMeal[];
  substitutions?: Record<string, string>;
}

const PRIORITY_WEIGHTS = {
  nutrition: { quality: 0.7, cost: 0.3 },
  balanced: { quality: 0.5, cost: 0.5 },
  cost: { quality: 0.25, cost: 0.75 },
} as const;

export function makeCostModel(ctx: PlanContext, req: Pick<PlanRequest, "includeStaples" | "storeId">): CostModel {
  const pantry = pantryGrams(ctx.pantry, ctx.lookup);
  const allowed = req.storeId ? [req.storeId] : null;
  return new CostModel(ctx, allowed, pantry, (id) => !req.includeStaples && !!ctx.lookup(id)?.staple);
}

/** Grams of each ingredient the given meals need. */
export function gramsByIngredient(meals: Pick<PlannedMeal, "recipeId" | "attendees" | "portionOverrides">[], ctx: PlanContext, subs: Record<string, string> = {}): Map<string, number> {
  const out = new Map<string, number>();
  for (const meal of meals) {
    const r = ctx.recipes.get(meal.recipeId);
    if (!r) continue;
    const scale = mealServings(meal, ctx.members) / r.servings;
    for (const line of r.ingredients) {
      const id = subs[line.ingredientId] ?? line.ingredientId;
      const ing = ctx.lookup(id);
      if (!ing) continue;
      const g = tryToGrams(line.qty * scale, line.unit, ing);
      if (g != null) out.set(id, (out.get(id) ?? 0) + g);
    }
  }
  return out;
}

function addGrams(base: Map<string, number>, add: Map<string, number>, sign = 1): Map<string, number> {
  const out = new Map(base);
  for (const [k, v] of add) out.set(k, (out.get(k) ?? 0) + sign * v);
  return out;
}

export interface Candidate {
  profile: RecipeProfile;
  marginalCost: number;
  score: number;
  reasons: string[];
}

interface ScoreState {
  grams: Map<string, number>;
  used: Map<string, number>;
  lastProteinByType: Map<MealType, string[]>;
}

/** Context shared by generation, swapping and reduce-to-budget. */
export class Planner {
  readonly profiles: RecipeProfile[];
  readonly cost: CostModel;
  private dealBoost = new Map<string, number>();
  private expiring = new Set<string>();
  private weights: { quality: number; cost: number };

  constructor(
    private input: PlannerInput,
  ) {
    const { ctx, request } = input;
    this.cost = makeCostModel(ctx, request);
    this.weights = PRIORITY_WEIGHTS[request.priority];
    this.profiles = [...ctx.recipes.values()]
      .filter((r) => !r.excluded && !r.unmatchedIngredients?.length)
      .map((r) => profileRecipe(r, ctx.lookup));
    // Deals: active sale prices with a real discount boost recipes that use them.
    for (const p of ctx.prices) {
      if (!p.isSale || p.source === "estimate" || !isActive(p, ctx.today)) continue;
      if (request.storeId && p.storeId !== request.storeId) continue;
      const d = discountPct(p) ?? 0.15;
      this.dealBoost.set(p.ingredientId, Math.max(this.dealBoost.get(p.ingredientId) ?? 0, d));
    }
    const soon = addDays(ctx.today, 4);
    for (const item of ctx.pantry) if (item.expiresOn && item.expiresOn <= soon) this.expiring.add(item.ingredientId);
    for (const id of request.preferIngredients ?? []) this.expiring.add(id);
  }

  private get subs() {
    return this.input.substitutions ?? {};
  }

  attendeesOf(ids: string[]): Member[] {
    return this.input.ctx.members.filter((m) => ids.includes(m.id));
  }

  eligible(slot: Pick<Slot, "mealType" | "attendees">, opts: { maxMinutes?: number } = {}): RecipeProfile[] {
    const members = this.attendeesOf(slot.attendees);
    const avoid = new Set(this.input.request.avoidIngredients ?? []);
    const maxMin = opts.maxMinutes ?? this.input.request.maxCookMinutes;
    return this.profiles.filter((p) => {
      if (!p.recipe.mealTypes.includes(slot.mealType)) return false;
      if (maxMin && p.totalMinutes > maxMin && slot.mealType !== "snack") return false;
      if (p.ingredientIds.some((id) => avoid.has(this.subs[id] ?? id))) return false;
      if (!isSafeFor(p.recipe, members, this.input.ctx.lookup, this.subs)) return false;
      if (p.ingredientIds.some((id) => !this.cost.hasPrice(this.subs[id] ?? id))) return false;
      return true;
    });
  }

  /** Score one candidate given what's already in the plan. */
  scoreCandidate(p: RecipeProfile, slot: Pick<Slot, "mealType" | "attendees" | "date">, state: ScoreState, budgetPerServing: number, jitter = 0): Candidate {
    const members = this.attendeesOf(slot.attendees);
    const servings = mealServings({ attendees: slot.attendees }, this.input.ctx.members);
    const add = gramsByIngredient([{ recipeId: p.recipe.id, attendees: slot.attendees }], this.input.ctx, this.subs);
    let marginal = 0;
    for (const [id, g] of add) {
      const before = state.grams.get(id) ?? 0;
      marginal += this.cost.cost(id, before + g) - this.cost.cost(id, before);
    }
    const perServing = marginal / Math.max(servings, 0.5);
    const reasons: string[] = [];
    const costScore = Math.max(0, 1 - perServing / Math.max(budgetPerServing * 1.6, 0.5));
    let score = this.weights.quality * (p.quality + goalFit(p, members)) + this.weights.cost * costScore;
    score += likeScore(p.recipe, members);

    const dislikes = findConflicts(p.recipe, members, this.input.ctx.lookup, this.subs).filter((c) => c.kind === "dislike" && !c.optionalOnly);
    score -= 0.12 * dislikes.length;

    const deal = p.ingredientIds.reduce((m, id) => Math.max(m, this.dealBoost.get(id) ?? 0), 0);
    if (deal > 0) {
      score += Math.min(0.12, deal * 0.3);
      reasons.push("uses an advertised deal");
    }
    if (p.ingredientIds.some((id) => this.expiring.has(id))) {
      score += 0.1;
      reasons.push("uses pantry items to use up");
    }
    const reuse = p.ingredientIds.filter((id) => (state.grams.get(id) ?? 0) > 0 && !this.input.ctx.lookup(id)?.staple).length;
    if (reuse >= 2) reasons.push("shares ingredients with other meals");

    const times = state.used.get(p.recipe.id) ?? 0;
    if (times > 0) score -= this.input.request.allowRepeats ? 0.15 * times : 0.6 * times;
    const last = state.lastProteinByType.get(slot.mealType) ?? [];
    if (p.proteinGroups.some((g) => last.includes(g))) score -= 0.08;

    score += jitter;
    return { profile: p, marginalCost: round2(marginal), score, reasons };
  }

  /** Generate a plan for every slot, then repair it toward the budget. */
  generate(slots: Slot[]): PlanResult {
    const { request } = this.input;
    const random = rng(request.seed ?? 1);
    const locked = new Map((this.input.locked ?? []).map((m) => [`${m.date}|${m.mealType}`, m]));
    const totalServings = slots.reduce((s, sl) => s + mealServings(sl, this.input.ctx.members), 0);
    const budgetPerServing = request.budget / Math.max(totalServings, 1);
    const state: ScoreState = { grams: new Map(), used: new Map(), lastProteinByType: new Map() };
    const meals: PlannedMeal[] = [];
    const notes: string[] = [];

    for (const slot of slots) {
      const keep = locked.get(`${slot.date}|${slot.mealType}`);
      let recipeId: string | undefined = keep?.recipeId;
      if (!recipeId) {
        const options = this.eligible(slot)
          .map((p) => this.scoreCandidate(p, slot, state, budgetPerServing, random() * 0.06))
          .sort((a, b) => b.score - a.score);
        if (!options.length) {
          notes.push(`No safe ${slot.mealType} recipe for ${slot.date} with the current allergies, diets and time limit.`);
          continue;
        }
        recipeId = options[0].profile.recipe.id;
      }
      const meal: PlannedMeal = {
        id: keep?.id ?? `${slot.date}-${slot.mealType}`,
        date: slot.date,
        mealType: slot.mealType,
        recipeId,
        attendees: keep?.attendees ?? slot.attendees,
        portionOverrides: keep?.portionOverrides,
        locked: keep?.locked,
      };
      meals.push(meal);
      this.commit(state, meal);
    }

    let cost = this.cost.total(gramsByIngredient(meals, this.input.ctx, this.subs));
    if (cost > request.budget) {
      const reduced = this.reduceToBudget(meals, request.budget);
      meals.splice(0, meals.length, ...reduced.meals);
      cost = reduced.cost;
      if (reduced.changes.length) notes.push(`Swapped ${reduced.changes.length} meal(s) for cheaper options to fit the budget.`);
      if ([...countRecipes(meals).values()].some((n) => n > 1)) notes.push("Some meals repeat so they share ingredients and stay affordable — cook once, eat twice.");
    } else if (request.priority !== "cost") {
      const improved = this.improveNutrition(meals, request.budget);
      meals.splice(0, meals.length, ...improved.meals);
      cost = improved.cost;
    }

    const feasible = cost <= request.budget + 0.005;
    const result: PlanResult = { meals, estimatedCost: round2(cost), budget: request.budget, feasible, notes };
    if (!feasible) result.shortfall = this.explainShortfall(meals, slots, cost);
    return result;
  }

  private commit(state: ScoreState, meal: PlannedMeal) {
    const add = gramsByIngredient([meal], this.input.ctx, this.subs);
    state.grams = addGrams(state.grams, add);
    state.used.set(meal.recipeId, (state.used.get(meal.recipeId) ?? 0) + 1);
    const p = this.profiles.find((x) => x.recipe.id === meal.recipeId);
    if (p) state.lastProteinByType.set(meal.mealType, p.proteinGroups);
  }

  planCost(meals: PlannedMeal[]): number {
    return this.cost.total(gramsByIngredient(meals, this.input.ctx, this.subs));
  }

  /**
   * Plan-independent desirability of a recipe for the people at a meal:
   * nutrition quality, goal fit, ratings/likes, deals and pantry use.
   */
  valueOf(recipeId: string, attendees: string[]): number {
    const p = this.profiles.find((x) => x.recipe.id === recipeId);
    if (!p) return 0;
    const members = this.attendeesOf(attendees);
    let v = p.quality + goalFit(p, members) + likeScore(p.recipe, members);
    const deal = p.ingredientIds.reduce((m, id) => Math.max(m, this.dealBoost.get(id) ?? 0), 0);
    v += Math.min(0.12, deal * 0.3);
    if (p.ingredientIds.some((id) => this.expiring.has(id))) v += 0.1;
    const dislikes = findConflicts(p.recipe, members, this.input.ctx.lookup, this.subs).filter((c) => c.kind === "dislike" && !c.optionalOnly);
    return v - 0.12 * dislikes.length;
  }

  /**
   * Greedy local search: repeatedly make the single swap that saves the most
   * money per unit of nutrition lost, until under budget or no swap helps.
   */
  reduceToBudget(meals: PlannedMeal[], budget: number): { meals: PlannedMeal[]; cost: number; changes: { mealId: string; from: string; to: string; saved: number }[] } {
    let current = meals.map((m) => ({ ...m }));
    let cost = this.planCost(current);
    const changes: { mealId: string; from: string; to: string; saved: number }[] = [];
    for (let iter = 0; iter < 60 && cost > budget + 0.005; iter++) {
      let best: { idx: number; recipeId: string; cost: number; ratio: number } | null = null;
      current.forEach((meal, idx) => {
        if (meal.locked) return;
        const counts = countRecipes(current);
        for (const p of this.eligible(meal)) {
          if (p.recipe.id === meal.recipeId) continue;
          if (!this.input.request.allowRepeats && (counts.get(p.recipe.id) ?? 0) >= 2) continue;
          const trial = current.map((m, i) => (i === idx ? { ...m, recipeId: p.recipe.id } : m));
          const c = this.planCost(trial);
          const saved = cost - c;
          if (saved <= 0.01) continue;
          const qLoss = Math.max(0.02, this.valueOf(meal.recipeId, meal.attendees) - this.valueOf(p.recipe.id, meal.attendees) + 0.02);
          const ratio = saved / qLoss;
          if (!best || ratio > best.ratio) best = { idx, recipeId: p.recipe.id, cost: c, ratio };
        }
      });
      if (!best) break;
      const b = best as { idx: number; recipeId: string; cost: number };
      changes.push({ mealId: current[b.idx].id, from: current[b.idx].recipeId, to: b.recipeId, saved: round2(cost - b.cost) });
      current = current.map((m, i) => (i === b.idx ? { ...m, recipeId: b.recipeId } : m));
      cost = b.cost;
    }
    return { meals: current, cost: round2(cost), changes };
  }

  /**
   * Use leftover budget to upgrade meals. Each swap must improve value
   * (nutrition, goals, deals, pantry) by more than its extra cost is worth
   * under the chosen priority, and the plan must stay within budget.
   */
  improveNutrition(meals: PlannedMeal[], budget: number): { meals: PlannedMeal[]; cost: number } {
    let current = meals.map((m) => ({ ...m }));
    let cost = this.planCost(current);
    const perMeal = budget / Math.max(meals.length, 1);
    for (let iter = 0; iter < 20; iter++) {
      let best: { idx: number; recipeId: string; cost: number; gain: number } | null = null;
      current.forEach((meal, idx) => {
        if (meal.locked) return;
        const counts = countRecipes(current);
        const v0 = this.valueOf(meal.recipeId, meal.attendees);
        for (const p of this.eligible(meal)) {
          if (p.recipe.id === meal.recipeId) continue;
          if ((counts.get(p.recipe.id) ?? 0) >= 1 && !this.input.request.allowRepeats) continue;
          const dv = this.valueOf(p.recipe.id, meal.attendees) - v0;
          if (dv <= 0.03) continue;
          const trial = current.map((m, i) => (i === idx ? { ...m, recipeId: p.recipe.id } : m));
          const c = this.planCost(trial);
          if (c > budget) continue;
          const gain = this.weights.quality * dv - this.weights.cost * ((c - cost) / Math.max(perMeal, 1)) * 0.5;
          if (gain <= 0.01) continue;
          if (!best || gain > best.gain) best = { idx, recipeId: p.recipe.id, cost: c, gain };
        }
      });
      if (!best) break;
      const b = best as { idx: number; recipeId: string; cost: number };
      current = current.map((m, i) => (i === b.idx ? { ...m, recipeId: b.recipeId } : m));
      cost = b.cost;
    }
    return { meals: current, cost: round2(cost) };
  }

  /** Rank replacement options for one meal, given the rest of the plan. */
  replacements(meals: PlannedMeal[], mealId: string, opts: { maxMinutes?: number; kidFriendly?: boolean; highProtein?: boolean; cheaper?: boolean } = {}): (Candidate & { newTotal: number })[] {
    const target = meals.find((m) => m.id === mealId);
    if (!target) return [];
    const others = meals.filter((m) => m.id !== mealId);
    const state: ScoreState = { grams: gramsByIngredient(others, this.input.ctx, this.subs), used: countRecipes(others), lastProteinByType: new Map() };
    const totalServings = meals.reduce((s, m) => s + mealServings(m, this.input.ctx.members), 0);
    const bps = this.input.request.budget / Math.max(totalServings, 1);
    const currentProtein = this.profiles.find((p) => p.recipe.id === target.recipeId)?.proteinPerServing ?? 0;
    const currentCost = this.planCost(meals);
    return this.eligible(target, { maxMinutes: opts.maxMinutes })
      .filter((p) => p.recipe.id !== target.recipeId)
      .filter((p) => !opts.kidFriendly || p.recipe.tags.includes("kid-friendly"))
      .filter((p) => !opts.highProtein || p.proteinPerServing >= Math.max(30, currentProtein))
      .map((p) => {
        const c = this.scoreCandidate(p, target, state, bps);
        const newTotal = round2(this.planCost(meals.map((m) => (m.id === mealId ? { ...m, recipeId: p.recipe.id } : m))));
        return { ...c, newTotal };
      })
      .filter((c) => !opts.cheaper || c.newTotal < currentCost - 0.01)
      .sort((a, b) => (opts.cheaper ? a.newTotal - b.newTotal : b.score - a.score));
  }

  /** Cheapest possible plan for the slots, ignoring nutrition, to measure the gap honestly. */
  private explainShortfall(meals: PlannedMeal[], slots: Slot[], cost: number): Shortfall {
    const budget = this.input.request.budget;
    const servings = slots.reduce((s, sl) => s + mealServings(sl, this.input.ctx.members), 0);
    const suggestions: string[] = [];
    const gap = round2(cost - budget);
    suggestions.push(`Raise the budget to about $${Math.ceil(cost)} to cover these ${meals.length} meals.`);
    const perMeal = cost / Math.max(meals.length, 1);
    const fit = Math.floor(budget / perMeal);
    if (fit > 0 && fit < meals.length) suggestions.push(`Or plan about ${fit} of the ${meals.length} meals and cover the rest from your pantry.`);
    if (this.input.request.includeStaples) suggestions.push("Exclude pantry staples (oil, spices) if you already have them.");
    if (this.input.ctx.pantry.length === 0) suggestions.push("Add what's already in your kitchen to the Pantry — it is deducted from the list.");
    suggestions.push("Enter this week's store prices or flyer deals; estimates may be higher than your local sales.");
    return {
      cheapestPossible: round2(cost),
      budget,
      gap,
      servings: round2(servings),
      budgetPerServing: round2(budget / Math.max(servings, 1)),
      cheapestPerServing: round2(cost / Math.max(servings, 1)),
      suggestions,
    };
  }
}

function countRecipes(meals: PlannedMeal[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of meals) m.set(x.recipeId, (m.get(x.recipeId) ?? 0) + 1);
  return m;
}

export function generatePlan(input: PlannerInput): PlanResult {
  const slots = buildSlots(input.request, input.schedule, input.ctx.members);
  if (!input.ctx.members.length) {
    return { meals: [], estimatedCost: 0, budget: input.request.budget, feasible: false, notes: ["Add at least one household member first."] };
  }
  if (!slots.length) {
    return { meals: [], estimatedCost: 0, budget: input.request.budget, feasible: false, notes: ["No meals to plan — nobody is scheduled to eat for the selected days and meals."] };
  }
  return new Planner(input).generate(slots);
}

