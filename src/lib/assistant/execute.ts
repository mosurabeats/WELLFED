"use client";

import type { AppData } from "../data-context";
import type { MealPlan, PlannedMeal } from "../types";
import type { Action } from "./schema";
import { createPlan, savePlan } from "../db/actions";
import { defaultRequest } from "@/components/plan-generator";
import { addDays, Planner, weekday } from "../engine/planner";
import { CHAIN_INFO } from "../stores-osm";
import { memberTargets } from "../engine/targets";
import { formatAmount } from "../engine/units";

export interface ExecResult {
  lines: string[];
  ok: boolean;
  goto?: string;
}

const $ = (n: number) => `$${n.toFixed(2)}`;

/** Anonymized context for the AI: roles, ages, diets — never names. */
export function buildContext(data: AppData): string {
  const lines: string[] = [];
  const dow = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  lines.push(`Today: ${data.today} (${dow[weekday(data.today)]})`);
  let a = 0, c = 0;
  lines.push("Household:");
  for (const m of data.members) {
    const label = m.kind === "adult" ? `Adult ${++a}` : `Child ${++c}`;
    lines.push(`- ${label}: age ${m.age}${m.kind === "adult" ? `, goal ${m.goal}` : ""}, ~${Math.round(memberTargets(m).kcal)} kcal/day${m.allergies.length ? `, allergies: ${m.allergies.join("/")}` : ""}${m.diets.length ? `, diets: ${m.diets.join("/")}` : ""}`);
  }
  const s = data.settings;
  lines.push(`Saved defaults: budget $${s.weeklyBudget}, ${s.days} days, meals ${s.mealTypes.join("+")}${s.includeSnacks ? "+snack" : ""}, priority ${s.priority}`);
  const p = data.activePlan;
  if (p) {
    lines.push(`Current plan (${p.request.startDate}, ${p.meals.length} meals, budget $${p.request.budget}):`);
    for (const m of p.meals) lines.push(`- ${dow[weekday(m.date)]} ${m.date} ${m.mealType}: ${data.recipeMap.get(m.recipeId)?.name ?? m.recipeId}`);
  } else lines.push("No current plan.");
  if (data.pantry.length) lines.push(`Pantry: ${data.pantry.map((x) => `${x.ingredientId} (${formatAmount(x.qty, x.unit)}${x.expiresOn ? `, use by ${x.expiresOn}` : ""})`).join("; ")}`);
  if (data.stores.length) lines.push(`Stores: ${data.stores.map((x) => `${x.name} [${x.chain}]`).join("; ")}`);
  lines.push(`Catalog ingredient ids: ${data.ingredients.map((i) => `${i.id}=${i.name}`).join("; ")}`);
  return lines.join("\n");
}

export async function executeActions(actions: Action[], data: AppData): Promise<ExecResult> {
  const lines: string[] = [];
  let goto: string | undefined;
  let ok = true;
  let plan = data.activePlan;
  for (const a of actions) {
    if (a.type === "none") continue;
    if (a.type === "generate_plan") {
      if (!data.members.length) return { ok: false, lines: ["Add your household first (Household → People) so portions and allergies are right."], goto: "/household?setup=1" };
      const req = defaultRequest(data, {
        ...(a.budget != null ? { budget: a.budget } : {}),
        ...(a.days ? { days: a.days } : {}),
        ...(a.mealTypes?.length ? { mealTypes: a.mealTypes } : {}),
        ...(a.includeSnacks != null ? { includeSnacks: a.includeSnacks } : {}),
        ...(a.priority ? { priority: a.priority } : {}),
        ...(a.maxCookMinutes ? { maxCookMinutes: a.maxCookMinutes } : {}),
        preferIngredients: (a.preferIngredients ?? []).filter((id) => data.ingredientMap.has(id)),
        avoidIngredients: (a.avoidIngredients ?? []).filter((id) => data.ingredientMap.has(id)),
      });
      if (a.storeChain) {
        const store = data.stores.find((s) => s.chain === a.storeChain);
        const deals = store ? data.dbPrices.filter((p) => p.storeId === store.id && p.isSale && (!p.endDate || p.endDate >= data.today)).length : 0;
        if (store) req.storeId = store.id;
        if (!store) lines.push(`You haven't added a ${CHAIN_INFO[a.storeChain].label} store yet, so this plan uses estimated prices. Add it under Household → Stores and import the flyer.`);
        else if (!deals) lines.push(`No current ${CHAIN_INFO[a.storeChain].label} deals are saved. Import this week's flyer under Groceries → Deals; until then other items use estimates.`);
        else lines.push(`Using ${deals} saved ${store.name} deal${deals > 1 ? "s" : ""}.`);
      }
      if (a.people && a.people !== data.members.length) lines.push(`Note: you said ${a.people} people; your household has ${data.members.length}. Portions follow your household and schedule.`);
      const { plan: np, result } = await createPlan(req, data.ctx, data.settings.schedule);
      plan = np;
      if (!result.meals.length) {
        ok = false;
        lines.push(result.notes[0] ?? "Couldn't build a plan.");
      } else if (result.feasible) {
        lines.push(`Planned ${result.meals.length} meals over ${req.days} days. Estimated groceries ${$(result.estimatedCost)} of ${$(req.budget)}.`);
      } else {
        ok = false;
        const s = result.shortfall!;
        lines.push(`${$(req.budget)} isn't enough for ${result.meals.length} meals here: the lowest-cost plan I found is ${$(s.cheapestPossible)} (${$(s.cheapestPerServing)}/serving vs ${$(s.budgetPerServing)} available) — ${$(s.gap)} short. I saved it so you can see it, marked over budget.`);
        lines.push(...s.suggestions.slice(0, 3).map((x) => `• ${x}`));
      }
      if (req.preferIngredients?.length) lines.push(`Prioritized: ${req.preferIngredients.map((id) => data.ingredientMap.get(id)?.name).join(", ")}.`);
      goto = "/plan";
      continue;
    }
    if (!plan) {
      return { ok: false, lines: ["There's no meal plan yet — ask me to build one first."] };
    }
    const planner = new Planner({ request: plan.request, schedule: data.settings.schedule, ctx: data.ctx, substitutions: plan.substitutions });
    const before = planner.planCost(plan.meals);

    if (a.type === "swap_meal") {
      const target = findMeal(plan, a, data.today);
      if (!target) {
        ok = false;
        lines.push(`I couldn't find that ${a.mealType ?? "meal"} in the current plan.`);
        continue;
      }
      const opts = planner.replacements(plan.meals, target.id, { kidFriendly: !!a.kidFriendly, maxMinutes: a.maxCookMinutes ?? undefined, highProtein: !!a.highProtein, cheaper: !!a.cheaper });
      const pick = opts.find((o) => o.newTotal <= Math.max(plan!.request.budget, before)) ?? opts[0];
      if (!pick) {
        ok = false;
        lines.push("No safe recipe matches all of that. Try loosening a filter.");
        continue;
      }
      const from = data.recipeMap.get(target.recipeId)?.name;
      plan = { ...plan, meals: plan.meals.map((m) => (m.id === target.id ? { ...m, recipeId: pick.profile.recipe.id } : m)) };
      await savePlan(plan);
      const delta = pick.newTotal - before;
      lines.push(`Swapped ${from} for ${pick.profile.recipe.name} (${pick.profile.totalMinutes} min). Plan total ${delta >= 0 ? "+" : "−"}${$(Math.abs(delta))} → ${$(pick.newTotal)}.`);
      goto = "/plan";
      continue;
    }

    if (a.type === "adjust_plan") {
      let meals = [...plan.meals];
      let cost = before;
      const changed: string[] = [];
      const budgetCap = Math.max(plan.request.budget, before);
      for (const meal of plan.meals) {
        if (meal.locked) continue;
        const cur = planner.profiles.find((p) => p.recipe.id === meal.recipeId);
        if (!cur) continue;
        let pick: ReturnType<Planner["replacements"]>[number] | undefined;
        if (a.goal === "higher-protein") {
          pick = planner.replacements(meals, meal.id, { highProtein: true }).find((o) => o.profile.proteinPerServing >= cur.proteinPerServing + 6 && o.newTotal <= budgetCap);
        } else if (a.goal === "cheaper") {
          pick = planner.replacements(meals, meal.id, { cheaper: true }).find((o) => o.newTotal < cost - 0.5 && (!a.keepProtein || o.profile.proteinPerServing >= cur.proteinPerServing * 0.85));
        } else if (a.goal === "faster") {
          const limit = a.maxCookMinutes ?? 30;
          if (cur.totalMinutes > limit) pick = planner.replacements(meals, meal.id, { maxMinutes: limit })[0];
        }
        if (pick) {
          meals = meals.map((m) => (m.id === meal.id ? { ...m, recipeId: pick!.profile.recipe.id } : m));
          cost = pick.newTotal;
          changed.push(`${cur.recipe.name} → ${pick.profile.recipe.name}`);
          if (a.goal === "cheaper" && changed.length >= 4) break;
        }
      }
      if (a.goal === "use-pantry") {
        return executeActions([{ ...a, type: "generate_plan", preferIngredients: a.preferIngredients ?? data.pantry.map((p) => p.ingredientId) }], data);
      }
      if (!changed.length) {
        lines.push(a.goal === "faster" ? "Every meal already fits that time." : "I couldn't find swaps that improve this without breaking the budget or safety rules.");
        continue;
      }
      await savePlan({ ...plan, meals });
      plan = { ...plan, meals };
      lines.push(`Made ${changed.length} change${changed.length > 1 ? "s" : ""}: ${changed.join("; ")}. Plan total ${$(before)} → ${$(cost)}.`);
      goto = "/plan";
    }
  }
  if (!lines.length) lines.push("Nothing to change.");
  return { lines, ok, goto };
}

function findMeal(plan: MealPlan, a: Action, today: string): PlannedMeal | undefined {
  const type = a.mealType ?? "dinner";
  let date: string | undefined;
  if (a.relativeDay === "today") date = today;
  else if (a.relativeDay === "tomorrow") date = addDays(today, 1);
  const candidates = plan.meals.filter((m) => m.mealType === type && (date ? m.date === date : a.weekday != null ? weekday(m.date) === a.weekday : true));
  return candidates.sort((x, y) => x.date.localeCompare(y.date))[0];
}
