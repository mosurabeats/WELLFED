import type { Ingredient, Unit } from "../types";

/** Grams per unit for mass units. */
export const MASS_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
};

/** Millilitres per unit for volume units (US customary). */
export const VOLUME_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  floz: 29.5735295625,
  cup: 236.5882365,
};

export const UNIT_LABEL: Record<Unit, string> = {
  g: "g",
  kg: "kg",
  oz: "oz",
  lb: "lb",
  ml: "ml",
  l: "L",
  tsp: "tsp",
  tbsp: "tbsp",
  cup: "cup",
  floz: "fl oz",
  each: "",
};

export function isMass(u: Unit): boolean {
  return u in MASS_G;
}
export function isVolume(u: Unit): boolean {
  return u in VOLUME_ML;
}

export class UnitConversionError extends Error {
  constructor(
    public ingredientId: string,
    public unit: Unit,
  ) {
    super(`Cannot convert ${unit} of ${ingredientId} to grams (missing density or each weight)`);
  }
}

type ConvertibleIngredient = Pick<Ingredient, "id" | "density" | "gramsPerEach">;

/** Convert a quantity of an ingredient to grams of purchased weight. */
export function toGrams(qty: number, unit: Unit, ing: ConvertibleIngredient): number {
  if (unit in MASS_G) return qty * MASS_G[unit];
  if (unit in VOLUME_ML) {
    if (!ing.density) throw new UnitConversionError(ing.id, unit);
    return qty * VOLUME_ML[unit] * ing.density;
  }
  if (unit === "each") {
    if (!ing.gramsPerEach) throw new UnitConversionError(ing.id, unit);
    return qty * ing.gramsPerEach;
  }
  throw new UnitConversionError(ing.id, unit);
}

/** Convert grams of an ingredient into another unit. */
export function fromGrams(grams: number, unit: Unit, ing: ConvertibleIngredient): number {
  return grams / toGrams(1, unit, ing);
}

/** Like toGrams but returns null instead of throwing. */
export function tryToGrams(qty: number, unit: Unit, ing: ConvertibleIngredient): number | null {
  try {
    return toGrams(qty, unit, ing);
  } catch {
    return null;
  }
}

export function canConvert(unit: Unit, ing: ConvertibleIngredient): boolean {
  return tryToGrams(1, unit, ing) != null;
}

/** Round up to a sensible kitchen precision. */
export function niceQty(n: number): number {
  if (n >= 100) return Math.round(n);
  if (n >= 10) return Math.round(n * 2) / 2;
  if (n >= 1) return Math.round(n * 4) / 4;
  return Math.round(n * 100) / 100;
}

const FRACTIONS: [number, string][] = [
  [0.125, "⅛"],
  [0.25, "¼"],
  [0.333, "⅓"],
  [0.5, "½"],
  [0.667, "⅔"],
  [0.75, "¾"],
];

/** Format a quantity using kitchen fractions (1.5 -> "1½"). */
export function formatQty(n: number): string {
  if (!isFinite(n)) return "?";
  if (n >= 20) return String(Math.round(n));
  const whole = Math.floor(n);
  const frac = n - whole;
  for (const [v, s] of FRACTIONS) {
    if (Math.abs(frac - v) < 0.04) return whole ? `${whole}${s}` : s;
  }
  if (frac < 0.04) return String(whole || (n > 0 ? "<⅛" : 0));
  if (frac > 0.96) return String(whole + 1);
  return n.toFixed(1).replace(/\.0$/, "");
}

export function formatAmount(qty: number, unit: Unit, ing?: Pick<Ingredient, "eachLabel">): string {
  if (unit === "each") {
    const label = ing?.eachLabel ? ` ${ing.eachLabel}${qty > 1.05 && !/\(|,/.test(ing.eachLabel) ? "s" : ""}` : "";
    return `${formatQty(qty)}${label}`;
  }
  return `${formatQty(qty)} ${UNIT_LABEL[unit]}`;
}

/** Best human-readable shopping amount for a weight in grams. */
export function displayGrams(grams: number, ing: Ingredient): string {
  const u = ing.shopUnit;
  if (u === "lb" || u === "oz") {
    const lb = grams / MASS_G.lb;
    if (lb >= 1) return `${niceQty(lb)} lb`;
    return `${niceQty(grams / MASS_G.oz)} oz`;
  }
  if (canConvert(u, ing)) return formatAmount(niceQty(fromGrams(grams, u, ing)), u, ing);
  return `${Math.round(grams)} g`;
}
