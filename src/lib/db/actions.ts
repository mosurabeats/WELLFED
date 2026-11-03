"use client";

import { db, BACKUP_TABLES } from "./schema";
import { DEFAULT_SETTINGS, demoData, uid } from "./defaults";
import type { MealPlan, Member, PantryItem, PlannedMeal, PlanRequest, PriceEntry, Recipe, Settings, ShoppingOverride, Store } from "../types";
import type { PlanContext } from "../engine/shopping";
import { generatePlan, Planner, type PlanResult } from "../engine/planner";
import { isoDate } from "../engine/pricing";

// ── Settings ──────────────────────────────────────────────────────
export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await db().settings.get("settings")) ?? {}) };
}
export async function updateSettings(patch: Partial<Settings>) {
  const cur = await getSettings();
  await db().settings.put({ ...cur, ...patch, id: "settings" });
}

// ── Members ───────────────────────────────────────────────────────
export async function saveMember(m: Member) {
  await db().members.put(m);
}
export async function deleteMember(id: string) {
  await db().transaction("rw", db().members, db().settings, db().plans, async () => {
    await db().members.delete(id);
    const s = await getSettings();
    const schedule = Object.fromEntries(
      Object.entries(s.schedule).map(([d, meals]) => [d, Object.fromEntries(Object.entries(meals).map(([t, ids]) => [t, (ids ?? []).filter((x) => x !== id)]))]),
    );
    await db().settings.put({ ...s, schedule });
    const plans = await db().plans.toArray();
    for (const p of plans) {
      await db().plans.put({ ...p, meals: p.meals.map((m) => ({ ...m, attendees: m.attendees.filter((x) => x !== id) })) });
    }
  });
}

// ── Recipes ───────────────────────────────────────────────────────
export async function saveRecipe(r: Recipe) {
  await db().recipes.put({ ...r, createdAt: r.createdAt ?? new Date().toISOString() });
}
export async function deleteRecipe(id: string) {
  await db().recipes.delete(id);
}
export async function setRecipeMeta(id: string, patch: { favorite?: boolean; excluded?: boolean; rating?: { memberId: string; value: number } }, isBuiltin: boolean) {
  if (isBuiltin) {
    const cur = (await db().recipeMeta.get(id)) ?? { id };
    const ratings = { ...(cur.ratings ?? {}) };
    if (patch.rating) ratings[patch.rating.memberId] = patch.rating.value;
    await db().recipeMeta.put({ ...cur, ...(patch.favorite !== undefined ? { favorite: patch.favorite } : {}), ...(patch.excluded !== undefined ? { excluded: patch.excluded } : {}), ratings });
  } else {
    const cur = await db().recipes.get(id);
    if (!cur) return;
    const ratings = { ...(cur.ratings ?? {}) };
    if (patch.rating) ratings[patch.rating.memberId] = patch.rating.value;
    await db().recipes.put({ ...cur, ...(patch.favorite !== undefined ? { favorite: patch.favorite } : {}), ...(patch.excluded !== undefined ? { excluded: patch.excluded } : {}), ratings });
  }
}

// ── Pantry ────────────────────────────────────────────────────────
export async function savePantryItem(p: Omit<PantryItem, "id" | "addedAt"> & { id?: string; addedAt?: string }) {
  await db().pantry.put({ ...p, id: p.id ?? uid("pan"), addedAt: p.addedAt ?? new Date().toISOString() });
}
export async function deletePantryItem(id: string) {
  await db().pantry.delete(id);
}

// ── Prices & stores ───────────────────────────────────────────────
export async function savePrice(p: Omit<PriceEntry, "id"> & { id?: string }) {
  await db().prices.put({ ...p, id: p.id ?? uid("price"), verifiedAt: p.verifiedAt ?? new Date().toISOString() });
}
export async function savePrices(list: Omit<PriceEntry, "id">[]) {
  const now = new Date().toISOString();
  await db().prices.bulkPut(list.map((p) => ({ ...p, id: uid("price"), verifiedAt: p.verifiedAt ?? now })));
}
export async function deletePrice(id: string) {
  await db().prices.delete(id);
}
export async function purgeExpiredPrices(today = isoDate()) {
  const all = await db().prices.toArray();
  const expired = all.filter((p) => p.endDate && p.endDate < today).map((p) => p.id);
  await db().prices.bulkDelete(expired);
  return expired.length;
}
export async function saveStore(s: Store) {
  await db().stores.put(s);
}
export async function deleteStore(id: string) {
  await db().transaction("rw", db().stores, db().prices, async () => {
    await db().stores.delete(id);
    const ids = (await db().prices.where("storeId").equals(id).toArray()).map((p) => p.id);
    await db().prices.bulkDelete(ids);
  });
}
export async function loadDemoData() {
  const { stores, prices } = demoData();
  await db().stores.bulkPut(stores);
  await db().prices.bulkPut(prices);
}
export async function clearDemoData() {
  await db().transaction("rw", db().stores, db().prices, async () => {
    await db().prices.where("source").equals("demo").delete();
    await db().stores.bulkDelete(["demo-store-a", "demo-store-b"]);
  });
}

// ── Plans ─────────────────────────────────────────────────────────
export async function savePlan(plan: MealPlan) {
  await db().plans.put({ ...plan, updatedAt: new Date().toISOString() });
}

export async function setActivePlan(id: string) {
  await db().transaction("rw", db().plans, async () => {
    const all = await db().plans.toArray();
    for (const p of all) await db().plans.put({ ...p, active: p.id === id });
  });
}

export async function deletePlan(id: string) {
  await db().plans.delete(id);
}

export function planName(req: PlanRequest): string {
  const [y, m, d] = req.startDate.split("-").map(Number);
  const start = new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Week of ${start}`;
}

/** Run the planner and persist the result as the active plan. */
export async function createPlan(request: PlanRequest, ctx: PlanContext, schedule: Settings["schedule"], prev?: MealPlan): Promise<{ plan: MealPlan; result: PlanResult }> {
  const result = generatePlan({
    request,
    schedule,
    ctx,
    locked: prev?.meals.filter((m) => m.locked),
    substitutions: prev?.substitutions,
  });
  const now = new Date().toISOString();
  const plan: MealPlan = {
    id: prev?.id ?? uid("plan"),
    name: prev?.name ?? planName(request),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    request,
    meals: result.meals,
    shopping: prev?.shopping ?? {},
    notes: [...result.notes, ...(result.shortfall ? [shortfallText(result)] : [])],
    extras: prev?.extras,
    substitutions: prev?.substitutions,
    active: true,
  };
  await db().transaction("rw", db().plans, async () => {
    const all = await db().plans.toArray();
    for (const p of all) if (p.active && p.id !== plan.id) await db().plans.put({ ...p, active: false });
    await db().plans.put(plan);
  });
  return { plan, result };
}

export function shortfallText(r: PlanResult): string {
  const s = r.shortfall!;
  return `Over budget: the lowest-cost plan found is $${s.cheapestPossible.toFixed(2)} ($${s.cheapestPerServing.toFixed(2)}/serving) against a $${s.budget.toFixed(2)} budget ($${s.budgetPerServing.toFixed(2)}/serving) — $${s.gap.toFixed(2)} short.`;
}

export async function updateMeal(plan: MealPlan, mealId: string, patch: Partial<PlannedMeal>) {
  await savePlan({ ...plan, meals: plan.meals.map((m) => (m.id === mealId ? { ...m, ...patch } : m)) });
}

export async function removeMeal(plan: MealPlan, mealId: string) {
  await savePlan({ ...plan, meals: plan.meals.filter((m) => m.id !== mealId) });
}

export async function setShoppingOverride(plan: MealPlan, ingredientId: string, patch: Partial<ShoppingOverride> | null) {
  const shopping = { ...plan.shopping };
  if (patch === null) delete shopping[ingredientId];
  else shopping[ingredientId] = { ...(shopping[ingredientId] ?? {}), ...patch };
  await savePlan({ ...plan, shopping });
}

export async function reducePlanToBudget(plan: MealPlan, ctx: PlanContext, schedule: Settings["schedule"]) {
  const planner = new Planner({ request: plan.request, schedule, ctx, substitutions: plan.substitutions });
  const res = planner.reduceToBudget(plan.meals, plan.request.budget);
  await savePlan({ ...plan, meals: res.meals });
  return res;
}

// ── Backup ────────────────────────────────────────────────────────
export interface Backup {
  app: "wellfed";
  version: 1;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

export async function exportBackup(): Promise<Backup> {
  const data: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) data[t] = await db().table(t).toArray();
  return { app: "wellfed", version: 1, exportedAt: new Date().toISOString(), data };
}

export async function importBackup(b: Backup, mode: "replace" | "merge" = "replace") {
  if (b?.app !== "wellfed" || !b.data) throw new Error("This file is not a WellFed backup.");
  await db().transaction("rw", BACKUP_TABLES.map((t) => db().table(t)), async () => {
    for (const t of BACKUP_TABLES) {
      const rows = b.data[t];
      if (!Array.isArray(rows)) continue;
      if (mode === "replace") await db().table(t).clear();
      await db().table(t).bulkPut(rows);
    }
  });
}

export async function wipeAll() {
  await db().transaction("rw", BACKUP_TABLES.map((t) => db().table(t)), async () => {
    for (const t of BACKUP_TABLES) await db().table(t).clear();
  });
}
