import type { Ingredient, PriceEntry, PriceSource } from "../types";
import { MASS_G, tryToGrams } from "./units";

/** ISO date (YYYY-MM-DD) in local time. */
export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type OfferStatus = "active" | "expired" | "upcoming";

export function offerStatus(e: PriceEntry, today: string): OfferStatus {
  if (e.endDate && e.endDate < today) return "expired";
  if (e.startDate && e.startDate > today) return "upcoming";
  return "active";
}

export function isActive(e: PriceEntry, today: string): boolean {
  return offerStatus(e, today) === "active";
}

/** Sources that represent a real, store-specific price someone checked. */
export function isVerifiedSource(s: PriceSource): boolean {
  return s === "user" || s === "flyer" || s === "api";
}

export const SOURCE_LABEL: Record<PriceSource, string> = {
  estimate: "Estimate",
  user: "You entered",
  flyer: "Weekly flyer",
  api: "Store data",
  demo: "Demo data",
};

export function packageGrams(e: PriceEntry, ing: Ingredient): number | null {
  return tryToGrams(e.packageQty, e.packageUnit, ing);
}

/** Dollars per gram of purchased product, or null if the package can't be weighed. */
export function pricePerGram(e: PriceEntry, ing: Ingredient): number | null {
  const g = packageGrams(e, ing);
  return g && g > 0 ? e.price / g : null;
}

/** Human-facing unit price string like "$2.49/lb" or "$0.28/each". */
export function unitPriceLabel(e: PriceEntry, ing: Ingredient): string {
  const ppg = pricePerGram(e, ing);
  if (ppg == null) return `$${(e.price / e.packageQty).toFixed(2)}/${e.packageUnit}`;
  if (ing.shopUnit === "each" && ing.gramsPerEach) return `$${(ppg * ing.gramsPerEach).toFixed(2)}/each`;
  if (ing.shopUnit === "floz") return `$${(ppg * (tryToGrams(1, "floz", ing) ?? 29.57)).toFixed(2)}/fl oz`;
  if (ing.category === "spices" || ing.shopUnit === "oz") return `$${(ppg * MASS_G.oz).toFixed(2)}/oz`;
  return `$${(ppg * MASS_G.lb).toFixed(2)}/lb`;
}

/** Percent saved vs. regular price, if both are known. */
export function discountPct(e: PriceEntry): number | null {
  if (!e.regularPrice || e.regularPrice <= e.price) return null;
  return (e.regularPrice - e.price) / e.regularPrice;
}

export interface PackagePick {
  entry: PriceEntry;
  count: number;
}

export interface Purchase {
  picks: PackagePick[];
  cost: number;
  purchasedGrams: number;
}

/**
 * Cheapest way to buy at least `needGrams` from a set of offers. Considers each
 * package size alone, and every two-size combination (e.g. one 5-lb bag plus
 * one 1-lb bag). Packages are whole — you cannot buy 0.6 of a bag.
 */
export function cheapestPurchase(needGrams: number, offers: PriceEntry[], ing: Ingredient): Purchase | null {
  const sized = offers
    .map((entry) => ({ entry, g: packageGrams(entry, ing) }))
    .filter((o): o is { entry: PriceEntry; g: number } => !!o.g && o.g > 0);
  if (!sized.length || needGrams <= 0) return null;
  let best: Purchase | null = null;
  const consider = (picks: PackagePick[]) => {
    const cost = picks.reduce((s, p) => s + p.entry.price * p.count, 0);
    const grams = picks.reduce((s, p) => s + (packageGrams(p.entry, ing) ?? 0) * p.count, 0);
    if (grams + 1e-6 < needGrams) return;
    if (!best || cost < best.cost - 1e-9 || (Math.abs(cost - best.cost) < 1e-9 && grams < best.purchasedGrams)) {
      best = { picks: picks.filter((p) => p.count > 0), cost, purchasedGrams: grams };
    }
  };
  for (const a of sized) {
    consider([{ entry: a.entry, count: Math.ceil(needGrams / a.g - 1e-9) }]);
  }
  for (const a of sized) {
    for (const b of sized) {
      if (a === b) continue;
      const maxA = Math.ceil(needGrams / a.g);
      for (let k = 1; k < maxA && k <= 12; k++) {
        const rest = needGrams - k * a.g;
        consider([
          { entry: a.entry, count: k },
          { entry: b.entry, count: Math.ceil(rest / b.g - 1e-9) },
        ]);
      }
    }
  }
  return best;
}
