import type { Ingredient } from "../types";
import { EMPTY_ACTION, type Action, type AssistantResult } from "./schema";
import { matchIngredient } from "../flyer";

const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1 };
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function num(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) ? n : NUM[s.toLowerCase()] ?? null;
}

/**
 * Offline understanding of common requests, used when no AI key is set.
 * It recognises budgets, days, people, meals, time limits, weekdays, stores
 * and ingredients — enough for every example request in the brief.
 */
export function parseLocally(message: string, ingredients: Pick<Ingredient, "id" | "name">[]): AssistantResult {
  const m = message.toLowerCase();
  const a: Action = { ...EMPTY_ACTION };
  const W = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)";

  const budget = m.match(/\$\s?(\d+(?:\.\d+)?)/) ?? m.match(/(\d+(?:\.\d+)?)\s*(?:dollars|bucks)/);
  if (budget) a.budget = Number(budget[1]);
  const days = m.match(new RegExp(`${W}\\s*(?:-\\s*)?days?`));
  if (days) a.days = num(days[1]);
  else if (/\b(a|the|this|next)\s+week\b|weekly/.test(m)) a.days = 7;
  const people = m.match(new RegExp(`(?:feed|for)\\s+${W}\\s*(?:people|persons|of us)?`)) ?? m.match(new RegExp(`${W}\\s+(?:people|persons)`));
  if (people) a.people = num(people[1]);
  const perDay = m.match(new RegExp(`${W}\\s*meals?\\s*(?:a|per)\\s*day`));
  const mealTypes: ("breakfast" | "lunch" | "dinner")[] = [];
  if (/breakfast/.test(m)) mealTypes.push("breakfast");
  if (/lunch/.test(m)) mealTypes.push("lunch");
  if (/dinner|supper/.test(m)) mealTypes.push("dinner");
  if (perDay) {
    const n = num(perDay[1]) ?? 2;
    a.mealTypes = n >= 3 ? ["breakfast", "lunch", "dinner"] : n === 2 ? ["lunch", "dinner"] : ["dinner"];
  }
  if (/snack/.test(m)) a.includeSnacks = true;
  const mins = m.match(/(?:under|less than|within|in|max(?:imum)?|no more than)\s*(\d+)\s*(?:min|minutes)/) ?? m.match(/(\d+)\s*(?:min|minutes)\s*or less/);
  if (mins) a.maxCookMinutes = Number(mins[1]);
  if (/cheap|lowest cost|save money|tight budget/.test(m)) a.priority = "cost";
  else if (/balanced/.test(m)) a.priority = "balanced";
  else if (/nutritio|healthy|healthiest/.test(m)) a.priority = "nutrition";

  if (/hannaford/.test(m)) a.storeChain = "hannaford";
  else if (/shaw/.test(m)) a.storeChain = "shaws";
  else if (/price chopper|market 32/.test(m)) a.storeChain = "price-chopper";
  else if (/walmart/.test(m)) a.storeChain = "walmart";
  else if (/aldi/.test(m)) a.storeChain = "aldi";

  // "use the chicken and potatoes already in my refrigerator"
  const useMatch = m.match(/\buse (?:up )?(?:the |my |some )?(.+?)(?: (?:already |that'?s |we have|i have|in my|in the|from the|before)|[.?!]|$)/);
  if (useMatch) {
    const ids = useMatch[1].split(/,|\band\b|&/).map((w) => matchIngredient(w.trim(), ingredients)).filter((x): x is string => !!x);
    if (ids.length) a.preferIngredients = [...new Set(ids)];
  }
  const avoid = m.match(/\b(?:no|without|avoid)\s+([a-z ]+?)(?:[.,!?]|$)/);
  if (avoid) {
    const id = matchIngredient(avoid[1], ingredients);
    if (id) a.avoidIngredients = [id];
  }

  const dayIdx = DAYS.findIndex((d) => m.includes(d));
  const rel = /tomorrow/.test(m) ? "tomorrow" : /tonight|today/.test(m) ? "today" : null;
  const swap = /\b(replace|swap|change|instead of|different)\b/.test(m);
  const kid = /kid|child|children|picky/.test(m);

  if (swap && (dayIdx >= 0 || rel)) {
    a.type = "swap_meal";
    a.weekday = dayIdx >= 0 ? dayIdx : null;
    a.relativeDay = rel;
    a.mealType = mealTypes[0] ?? (/snack/.test(m) ? "snack" : "dinner");
    a.kidFriendly = kid || null;
    a.highProtein = /protein/.test(m) || null;
    a.cheaper = /cheap/.test(m) || null;
    return { reply: `Looking for a ${kid ? "kid-friendly " : ""}replacement for ${rel ?? DAYS[dayIdx]}'s ${a.mealType}.`, actions: [a] };
  }
  if ((dayIdx >= 0 || rel) && a.maxCookMinutes && !/plan/.test(m)) {
    a.type = "swap_meal";
    a.weekday = dayIdx >= 0 ? dayIdx : null;
    a.relativeDay = rel;
    a.mealType = mealTypes[0] ?? "dinner";
    return { reply: `Finding a ${rel ?? DAYS[dayIdx]} ${a.mealType} that takes ${a.maxCookMinutes} minutes or less.`, actions: [a] };
  }
  const explicitPlan = /\b(build|create|generate|new)\b.*\b(plan|meals?|week|days?)\b|\bplan (my |our |the )?(meals|week)|meal plan for/.test(m);
  const adjustIntent = (/protein/.test(m) && /(more|higher|increase|boost|up)/.test(m)) || /cheaper|less expensive|save money|lower cost|alternatives/.test(m) || /faster|quicker/.test(m);
  const isNewPlan = !(adjustIntent && a.budget == null && !explicitPlan) && (explicitPlan || /\bmake\b.*\bplan\b/.test(m) || a.budget != null || (a.days != null && !/this week'?s/.test(m)) || !!a.storeChain);
  if (!isNewPlan) {
    if (/protein/.test(m) && /(more|higher|increase|boost|up)/.test(m)) {
      a.type = "adjust_plan";
      a.goal = "higher-protein";
      return { reply: "Swapping in higher-protein meals where it fits the budget.", actions: [a] };
    }
    if (/cheap|less expensive|save|lower cost|alternatives/.test(m)) {
      a.type = "adjust_plan";
      a.goal = "cheaper";
      a.keepProtein = /protein/.test(m) || null;
      return { reply: `Looking for cheaper meals${a.keepProtein ? " without giving up much protein" : ""}.`, actions: [a] };
    }
    if (a.maxCookMinutes || /faster|quicker|quick/.test(m)) {
      a.type = "adjust_plan";
      a.goal = "faster";
      a.maxCookMinutes = a.maxCookMinutes ?? 30;
      return { reply: `Replacing meals that take longer than ${a.maxCookMinutes} minutes.`, actions: [a] };
    }
    if (a.preferIngredients?.length) {
      a.type = "generate_plan";
      return { reply: "Re-planning around what you already have.", actions: [a] };
    }
    return { reply: "I can build a plan (\"$90 for five days\"), swap a meal (\"replace Wednesday's dinner\"), or adjust the week (\"more protein\", \"cheaper\", \"under 30 minutes\"). What would you like?", actions: [] };
  }
  a.type = "generate_plan";
  if (mealTypes.length && !a.mealTypes) a.mealTypes = mealTypes;
  const bits = [a.days && `${a.days} days`, a.budget != null && `$${a.budget}`, a.mealTypes && a.mealTypes.join(" & "), a.storeChain && `around ${a.storeChain} deals`].filter(Boolean);
  return { reply: `Building a plan${bits.length ? ` (${bits.join(", ")})` : ""}.`, actions: [a] };
}
