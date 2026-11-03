"use client";

import { useMemo } from "react";
import type { MealPlan, Member, Nutrients } from "./types";
import { useData } from "./data-context";
import { buildShoppingList, computeRequirements, compareStores, mealServings, type ShoppingList, type StoreComparison } from "./engine/shopping";
import { summarizeBudget, suggestSubstitutions, type BudgetSummary, type Substitution } from "./engine/budget";
import { addNutrients, recipeNutrition, scaleNutrients, ZERO } from "./engine/nutrition";
import { memberTargets, portionFactor, MEAL_SHARE } from "./engine/targets";

export interface PlanDerived {
  list: ShoppingList;
  budget: BudgetSummary;
  comparison: StoreComparison;
  substitutions: Substitution[];
  /** date -> memberId -> nutrients eaten */
  dailyByMember: Map<string, Map<string, Nutrients>>;
  /** Share of a full day's targets the planned meal types represent. */
  plannedShare: number;
  allowedStores: string[] | null;
}

/** Everything computed from a plan: shopping list, budget, nutrition. Recomputes on any change. */
export function usePlanDerived(plan: MealPlan | null): PlanDerived | null {
  const data = useData();
  return useMemo(() => {
    if (!plan) return null;
    const { ctx, settings, ingredients } = data;
    const { reqs, problems } = computeRequirements(plan.meals, ctx, plan.substitutions, plan.extras);
    const allowedStores = plan.request.storeId ? [plan.request.storeId] : settings.oneStoreMode && preferredStore(data) ? [preferredStore(data)!] : null;
    const listOpts = { allowedStores, includeStaples: plan.request.includeStaples, overrides: plan.shopping };
    const list = buildShoppingList(reqs, ctx, listOpts, problems);
    const budget = summarizeBudget(plan.request.budget, plan.meals, list, ctx.members);
    const comparison = compareStores(reqs, ctx, { includeStaples: plan.request.includeStaples, overrides: plan.shopping, maxStores: settings.maxStores });
    const substitutions = suggestSubstitutions(list, ctx, ingredients, allowedStores, plan.substitutions);

    const dailyByMember = new Map<string, Map<string, Nutrients>>();
    for (const meal of plan.meals) {
      const r = ctx.recipes.get(meal.recipeId);
      if (!r) continue;
      const per = recipeNutrition(r, ctx.lookup, plan.substitutions).perServing;
      const day = dailyByMember.get(meal.date) ?? new Map<string, Nutrients>();
      for (const id of meal.attendees) {
        const m = ctx.members.find((x) => x.id === id);
        if (!m) continue;
        const f = meal.portionOverrides?.[id] ?? portionFactor(m);
        day.set(id, addNutrients(day.get(id) ?? ZERO, scaleNutrients(per, f)));
      }
      dailyByMember.set(meal.date, day);
    }
    const types = new Set(plan.request.mealTypes);
    if (plan.request.includeSnacks) types.add("snack");
    const plannedShare = [...types].reduce((s, t) => s + MEAL_SHARE[t], 0);
    return { list, budget, comparison, substitutions, dailyByMember, plannedShare, allowedStores };
  }, [plan, data]);
}

function preferredStore(data: ReturnType<typeof useData>): string | undefined {
  return data.stores.find((s) => s.preferred)?.id;
}

/** Average daily nutrients for a member across the plan, vs their targets scaled to planned meals. */
export function memberWeekAverage(derived: PlanDerived, member: Member) {
  let total = { ...ZERO };
  let days = 0;
  for (const day of derived.dailyByMember.values()) {
    const n = day.get(member.id);
    if (n) {
      total = addNutrients(total, n);
      days++;
    }
  }
  const avg = days ? scaleNutrients(total, 1 / days) : ZERO;
  const t = memberTargets(member);
  const share = derived.plannedShare || 1;
  return { avg, targets: t, share, days };
}

export function servingsFor(meal: { attendees: string[]; portionOverrides?: Record<string, number> }, members: Member[]) {
  return mealServings(meal, members);
}
