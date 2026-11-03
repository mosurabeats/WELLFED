import type { Ingredient } from "@/lib/types";
import { INGREDIENT_SPECS } from "./ingredient-specs";
import usda from "./usda-nutrients.json";

type UsdaFood = {
  description: string;
  per100g: Ingredient["per100g"];
  totalSugar: number | null;
};

const foods = usda.foods as unknown as Record<string, UsdaFood>;

/** Pure sweeteners: every gram of sugar in them counts as added sugar. */
const SWEETENERS = new Set(["sugar", "brown-sugar", "honey", "maple-syrup"]);

export const NUTRITION_SOURCE = {
  name: usda.source,
  url: usda.url,
  basis: usda.basis,
};

export const BUILTIN_INGREDIENTS: Ingredient[] = INGREDIENT_SPECS.map((spec) => {
  const food = foods[String(spec.fdcId)];
  if (!food) throw new Error(`Missing USDA data for ${spec.id} (fdcId ${spec.fdcId})`);
  const per100g = { ...food.per100g };
  if (per100g.addedSugar == null && SWEETENERS.has(spec.id)) {
    per100g.addedSugar = food.totalSugar ?? null;
  }
  return {
    ...spec,
    per100g,
    fdcDescription: food.description,
    nutritionSource: "usda" as const,
  };
});

export const BUILTIN_INGREDIENT_MAP = new Map(BUILTIN_INGREDIENTS.map((i) => [i.id, i]));
