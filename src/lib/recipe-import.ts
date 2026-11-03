import type { Ingredient, RecipeIngredient, Unit } from "./types";
import { matchIngredient } from "./flyer";

const UNIT_MAP: Record<string, Unit> = {
  g: "g", gram: "g", grams: "g", kg: "kg", oz: "oz", ounce: "oz", ounces: "oz", lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  ml: "ml", l: "l", liter: "l", tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp", tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  cup: "cup", cups: "cup", "fl oz": "floz", can: "each", cans: "each", clove: "each", cloves: "each", slice: "each", slices: "each",
  large: "each", medium: "each", small: "each", whole: "each",
};
const FRAC: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };

function parseNumber(s: string): number | null {
  s = s.trim();
  for (const [k, v] of Object.entries(FRAC)) s = s.replace(k, ` ${v}`);
  const parts = s.split(/\s+/).filter(Boolean);
  let total = 0;
  for (const p of parts) {
    if (/^\d+\/\d+$/.test(p)) {
      const [a, b] = p.split("/").map(Number);
      total += a / b;
    } else if (/^\d*\.?\d+$/.test(p)) total += Number(p);
    else return null;
  }
  return total || null;
}

export interface ParsedRecipeText {
  name: string;
  ingredients: (RecipeIngredient & { raw: string })[];
  unmatched: string[];
  steps: string[];
}

/**
 * Offline import of a pasted recipe. Lines like "1 ½ cups rice" become
 * ingredient rows matched to the catalog; numbered or long lines become steps.
 */
export function parseRecipeText(text: string, ingredients: Pick<Ingredient, "id" | "name">[]): ParsedRecipeText {
  const lines = text.split(/\n+/).map((l) => l.replace(/^[\s•*-]+/, "").trim()).filter(Boolean);
  const out: ParsedRecipeText = { name: "", ingredients: [], unmatched: [], steps: [] };
  for (const line of lines) {
    if (!out.name && !/\d/.test(line) && line.length < 70 && !/ingredients|directions|method|instructions/i.test(line)) {
      out.name = line;
      continue;
    }
    if (/^(ingredients|directions|method|instructions|steps)[:]?$/i.test(line)) continue;
    const m = line.match(/^(\d+\s*[½¼¾⅓⅔⅛]|\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+|[½¼¾⅓⅔⅛])\s*(fl oz|[a-zA-Z]+)?\.?\s+(?:of\s+)?(.+)$/);
    const isStep = /^\d+[.)]\s/.test(line) || line.split(" ").length > 12;
    if (m && !isStep) {
      const qty = parseNumber(m[1]);
      const unitWord = (m[2] ?? "").toLowerCase();
      const unit = UNIT_MAP[unitWord];
      const rest = unit ? m[3] : `${m[2] ?? ""} ${m[3]}`.trim();
      const id = matchIngredient(rest, ingredients);
      if (qty && id) out.ingredients.push({ ingredientId: id, qty, unit: unit ?? "each", raw: line });
      else out.unmatched.push(line);
      continue;
    }
    out.steps.push(line.replace(/^\d+[.)]\s*/, ""));
  }
  return out;
}
