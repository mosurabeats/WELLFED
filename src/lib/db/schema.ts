"use client";

import Dexie, { type Table } from "dexie";
import type { Ingredient, MealPlan, Member, PantryItem, PriceEntry, Recipe, Settings, Store } from "../types";

/** Per-recipe household state for built-in recipes (favorites, ratings, exclusions). */
export interface RecipeMeta {
  id: string;
  favorite?: boolean;
  excluded?: boolean;
  ratings?: Record<string, number>;
}

/**
 * All household data lives in this IndexedDB database on the device.
 * Nothing is sent anywhere unless the user explicitly uses an AI or
 * store-lookup feature.
 */
export class WellFedDB extends Dexie {
  members!: Table<Member, string>;
  recipes!: Table<Recipe, string>;
  recipeMeta!: Table<RecipeMeta, string>;
  ingredients!: Table<Ingredient, string>;
  prices!: Table<PriceEntry, string>;
  stores!: Table<Store, string>;
  pantry!: Table<PantryItem, string>;
  plans!: Table<MealPlan, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("wellfed");
    this.version(1).stores({
      members: "id",
      recipes: "id, source",
      recipeMeta: "id",
      ingredients: "id",
      prices: "id, ingredientId, storeId, source, endDate",
      stores: "id, chain",
      pantry: "id, ingredientId, expiresOn",
      plans: "id, updatedAt, active",
      settings: "id",
    });
  }
}

let _db: WellFedDB | null = null;
export function db(): WellFedDB {
  if (!_db) _db = new WellFedDB();
  return _db;
}

export const BACKUP_TABLES = ["members", "recipes", "recipeMeta", "ingredients", "prices", "stores", "pantry", "plans", "settings"] as const;
