import type { Allergen, Diet, FoodFlag, Member, Recipe } from "../types";
import type { IngredientLookup } from "./nutrition";

export const ALLERGEN_LABEL: Record<Allergen, string> = {
  milk: "Milk",
  egg: "Egg",
  fish: "Fish",
  shellfish: "Shellfish",
  "tree-nut": "Tree nuts",
  peanut: "Peanut",
  wheat: "Wheat",
  soy: "Soy",
  sesame: "Sesame",
};

export const DIET_LABEL: Record<Diet, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  "gluten-free": "Gluten-free",
  "dairy-free": "Dairy-free",
  "no-pork": "No pork",
  "no-beef": "No beef",
};

/** Flags that make an ingredient incompatible with a diet. */
const DIET_FORBIDS: Record<Diet, FoodFlag[]> = {
  vegetarian: ["meat", "poultry", "beef", "pork", "fish", "shellfish"],
  vegan: ["meat", "poultry", "beef", "pork", "fish", "shellfish", "dairy", "egg", "honey"],
  pescatarian: ["meat", "poultry", "beef", "pork"],
  "gluten-free": ["gluten"],
  "dairy-free": ["dairy"],
  "no-pork": ["pork"],
  "no-beef": ["beef"],
};

export interface Conflict {
  memberId: string;
  memberName: string;
  kind: "allergy" | "diet" | "dislike";
  ingredientId: string;
  ingredientName: string;
  detail: string;
  /** True when every offending line is optional, so it can simply be left out. */
  optionalOnly: boolean;
}

function lineIds(recipe: Pick<Recipe, "ingredients">, subs?: Record<string, string>) {
  return recipe.ingredients.map((l) => ({
    id: subs?.[l.ingredientId] ?? l.ingredientId,
    optional: !!l.optional,
  }));
}

export function recipeAllergens(
  recipe: Pick<Recipe, "ingredients">,
  lookup: IngredientLookup,
  subs?: Record<string, string>,
): Allergen[] {
  const set = new Set<Allergen>();
  for (const { id } of lineIds(recipe, subs)) lookup(id)?.allergens?.forEach((a) => set.add(a));
  return [...set].sort();
}

/** Diets the recipe satisfies (ignoring optional garnish lines). */
export function recipeDiets(
  recipe: Pick<Recipe, "ingredients">,
  lookup: IngredientLookup,
  subs?: Record<string, string>,
): Diet[] {
  const flags = new Set<FoodFlag>();
  for (const { id, optional } of lineIds(recipe, subs)) {
    if (optional) continue;
    lookup(id)?.flags?.forEach((f) => flags.add(f));
  }
  return (Object.keys(DIET_FORBIDS) as Diet[]).filter((d) => !DIET_FORBIDS[d].some((f) => flags.has(f)));
}

/**
 * Every allergy, diet and dislike conflict between a recipe and the people
 * eating it. Unknown ingredients count as conflicts for anyone with an
 * allergy, because their allergens cannot be verified.
 */
export function findConflicts(
  recipe: Pick<Recipe, "ingredients" | "unmatchedIngredients">,
  members: Member[],
  lookup: IngredientLookup,
  subs?: Record<string, string>,
): Conflict[] {
  const out: Conflict[] = [];
  const lines = lineIds(recipe, subs);
  for (const m of members) {
    const hits = new Map<string, Conflict & { allOptional: boolean }>();
    const add = (c: Omit<Conflict, "optionalOnly">, optional: boolean) => {
      const key = `${c.kind}:${c.ingredientId}:${c.detail}`;
      const prev = hits.get(key);
      if (prev) prev.allOptional = prev.allOptional && optional;
      else hits.set(key, { ...c, optionalOnly: optional, allOptional: optional });
    };
    for (const { id, optional } of lines) {
      const ing = lookup(id);
      if (!ing) {
        if (m.allergies.length)
          add({ memberId: m.id, memberName: m.name, kind: "allergy", ingredientId: id, ingredientName: id, detail: "Unverified ingredient — allergens unknown" }, optional);
        continue;
      }
      for (const a of m.allergies) {
        if (ing.allergens?.includes(a))
          add({ memberId: m.id, memberName: m.name, kind: "allergy", ingredientId: id, ingredientName: ing.name, detail: `${ALLERGEN_LABEL[a]} allergy` }, optional);
      }
      for (const d of m.diets) {
        if (DIET_FORBIDS[d].some((f) => ing.flags?.includes(f)))
          add({ memberId: m.id, memberName: m.name, kind: "diet", ingredientId: id, ingredientName: ing.name, detail: DIET_LABEL[d] }, optional);
      }
      if (m.dislikes.includes(id))
        add({ memberId: m.id, memberName: m.name, kind: "dislike", ingredientId: id, ingredientName: ing.name, detail: "Dislikes" }, optional);
    }
    if (m.allergies.length && recipe.unmatchedIngredients?.length) {
      for (const name of recipe.unmatchedIngredients)
        add({ memberId: m.id, memberName: m.name, kind: "allergy", ingredientId: name, ingredientName: name, detail: "Unverified ingredient — allergens unknown" }, false);
    }
    for (const h of hits.values()) {
      const { allOptional, ...c } = h;
      out.push({ ...c, optionalOnly: allOptional });
    }
  }
  return out;
}

/** A recipe is safe when no allergy/diet conflict exists outside optional lines. */
export function isSafeFor(
  recipe: Pick<Recipe, "ingredients" | "unmatchedIngredients">,
  members: Member[],
  lookup: IngredientLookup,
  subs?: Record<string, string>,
): boolean {
  return !findConflicts(recipe, members, lookup, subs).some(
    (c) => (c.kind === "allergy" || c.kind === "diet") && !c.optionalOnly,
  );
}
