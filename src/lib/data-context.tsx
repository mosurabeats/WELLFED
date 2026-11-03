"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db/schema";
import { DEFAULT_SETTINGS } from "./db/defaults";
import { BUILTIN_INGREDIENTS } from "@/data/ingredients";
import { BUILTIN_RECIPES } from "@/data/recipes";
import { ESTIMATED_PRICES } from "@/data/estimated-prices";
import type { Ingredient, MealPlan, Member, PantryItem, PriceEntry, Recipe, Settings, Store } from "./types";
import type { PlanContext } from "./engine/shopping";
import { isoDate } from "./engine/pricing";

export interface AppData {
  ready: boolean;
  settings: Settings;
  members: Member[];
  recipes: Recipe[];
  recipeMap: Map<string, Recipe>;
  ingredients: Ingredient[];
  ingredientMap: Map<string, Ingredient>;
  /** Store prices + deals from the database plus built-in estimates. */
  prices: PriceEntry[];
  dbPrices: PriceEntry[];
  stores: Store[];
  pantry: PantryItem[];
  plans: MealPlan[];
  activePlan: MealPlan | null;
  today: string;
  ctx: PlanContext;
}

const Ctx = createContext<AppData | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const raw = useLiveQuery(async () => {
    const d = db();
    const [settings, members, recipes, recipeMeta, ingredients, prices, stores, pantry, plans] = await Promise.all([
      d.settings.get("settings"),
      d.members.toArray(),
      d.recipes.toArray(),
      d.recipeMeta.toArray(),
      d.ingredients.toArray(),
      d.prices.toArray(),
      d.stores.toArray(),
      d.pantry.toArray(),
      d.plans.orderBy("updatedAt").reverse().toArray(),
    ]);
    return { settings, members, recipes, recipeMeta, ingredients, prices, stores, pantry, plans };
  }, []);

  const value = useMemo<AppData>(() => {
    const today = isoDate();
    const settings = { ...DEFAULT_SETTINGS, ...(raw?.settings ?? {}) };
    const meta = new Map((raw?.recipeMeta ?? []).map((m) => [m.id, m]));
    const builtin = BUILTIN_RECIPES.map((r) => ({ ...r, ...(meta.get(r.id) ?? {}) }));
    const recipes = [...builtin, ...(raw?.recipes ?? [])];
    const ingredients = [...BUILTIN_INGREDIENTS, ...(raw?.ingredients ?? [])];
    const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));
    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    const dbPrices = raw?.prices ?? [];
    const prices = [...ESTIMATED_PRICES, ...dbPrices];
    const members = (raw?.members ?? []).sort((a, b) => (a.kind === b.kind ? b.age - a.age : a.kind === "adult" ? -1 : 1));
    const stores = raw?.stores ?? [];
    const pantry = raw?.pantry ?? [];
    const plans = raw?.plans ?? [];
    const ctx: PlanContext = { lookup: (id) => ingredientMap.get(id), recipes: recipeMap, members, prices, stores, pantry, today };
    return {
      ready: !!raw,
      settings,
      members,
      recipes,
      recipeMap,
      ingredients,
      ingredientMap,
      prices,
      dbPrices,
      stores,
      pantry,
      plans,
      activePlan: plans.find((p) => p.active) ?? plans[0] ?? null,
      today,
      ctx,
    };
  }, [raw]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData must be used inside <DataProvider>");
  return v;
}
