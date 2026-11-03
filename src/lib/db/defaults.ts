import type { PriceEntry, Settings, Store } from "../types";
import { isoDate } from "../engine/pricing";
import { addDays } from "../engine/planner";

export const DEFAULT_SETTINGS: Settings = {
  id: "settings",
  radiusKm: 25,
  maxStores: 2,
  oneStoreMode: false,
  weeklyBudget: 150,
  priority: "balanced",
  mealTypes: ["dinner"],
  includeSnacks: false,
  includeStaples: false,
  days: 7,
  schedule: {},
  onboarded: false,
  aiProvider: "anthropic",
};

export function uid(prefix = ""): string {
  const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}-${r}` : r;
}

/**
 * DEMONSTRATION DATA ONLY. Two fictional stores and invented sale prices so
 * the deal and store-comparison features can be explored before real prices
 * are entered. Every entry is tagged source "demo" and shown with a DEMO badge.
 */
export function demoData(today = isoDate()): { stores: Store[]; prices: PriceEntry[] } {
  const end = addDays(today, 6);
  const stores: Store[] = [
    { id: "demo-store-a", chain: "other", name: "Demo Store A (fictional)", source: "user" },
    { id: "demo-store-b", chain: "other", name: "Demo Store B (fictional)", source: "user" },
  ];
  const d = (storeId: string, ingredientId: string, productName: string, packageQty: number, packageUnit: PriceEntry["packageUnit"], price: number, regularPrice?: number, extra: Partial<PriceEntry> = {}): PriceEntry => ({
    id: `demo-${storeId}-${ingredientId}`,
    storeId,
    ingredientId,
    productName,
    packageQty,
    packageUnit,
    price,
    regularPrice,
    isSale: regularPrice != null,
    startDate: today,
    endDate: end,
    source: "demo",
    sourceDetail: "Fictional demo price — not from any real store",
    ...extra,
  });
  const prices = [
    d("demo-store-a", "chicken-thigh", "Boneless chicken thighs, family pack", 3, "lb", 5.97, 10.47, { loyaltyRequired: true }),
    d("demo-store-a", "broccoli", "Broccoli crowns", 1, "lb", 1.49, 2.29),
    d("demo-store-a", "ground-turkey", "Ground turkey 93%", 1, "lb", 3.99, 5.49),
    d("demo-store-a", "pasta", "Pasta, 1 lb", 1, "lb", 1.0, 1.69, { promoNotes: "Limit 6" }),
    d("demo-store-a", "egg", "Large eggs, dozen", 12, "each", 3.49),
    d("demo-store-a", "white-rice", "Long-grain rice, 2 lb", 2, "lb", 2.79),
    d("demo-store-a", "potato", "Russet potatoes, 5 lb", 5, "lb", 3.99),
    d("demo-store-b", "ground-beef", "Ground beef 85%, 3 lb", 3, "lb", 13.47, 17.49),
    d("demo-store-b", "salmon", "Atlantic salmon fillet", 1, "lb", 8.99, 11.99, { couponRequired: true, promoNotes: "Digital coupon" }),
    d("demo-store-b", "sweet-potato", "Sweet potatoes", 1, "lb", 0.89, 1.29),
    d("demo-store-b", "black-beans", "Black beans, 15 oz", 1, "each", 0.79, 1.19, { promoNotes: "10 for $7.90" }),
    d("demo-store-b", "egg", "Large eggs, dozen", 12, "each", 2.99),
    d("demo-store-b", "potato", "Russet potatoes, 5 lb", 5, "lb", 3.49),
    d("demo-store-b", "chicken-thigh", "Boneless chicken thighs", 1.25, "lb", 4.49),
  ];
  return { stores, prices };
}
