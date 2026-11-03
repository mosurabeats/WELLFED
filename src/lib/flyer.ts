import type { Ingredient, Unit } from "./types";

export interface FlyerItem {
  productName: string;
  brand?: string;
  price: number;
  regularPrice?: number;
  packageQty: number;
  packageUnit: Unit;
  ingredientId: string | null;
  loyaltyRequired?: boolean;
  couponRequired?: boolean;
  promoNotes?: string;
}

const STOP = new Set(["fresh", "boneless", "skinless", "family", "pack", "value", "store", "brand", "assorted", "select", "varieties", "the", "and", "or", "with", "of", "in", "lb", "oz", "ct", "each", "per", "large", "medium", "small", "organic", "natural", "all", "grade"]);

/** Synonyms that map common flyer wording to catalog ingredient ids. */
const ALIASES: [RegExp, string][] = [
  [/chicken\s+breast/i, "chicken-breast"],
  [/chicken\s+thigh/i, "chicken-thigh"],
  [/drumstick/i, "chicken-drumstick"],
  [/ground\s+(beef|chuck|round)|hamburg/i, "ground-beef"],
  [/ground\s+turkey/i, "ground-turkey"],
  [/ground\s+pork/i, "ground-pork"],
  [/pork\s+(loin\s+)?chop/i, "pork-chop"],
  [/pork\s+(shoulder|butt)/i, "pork-shoulder"],
  [/italian\s+sausage/i, "italian-sausage"],
  [/stew\s+(beef|meat)/i, "beef-stew-meat"],
  [/top\s+round/i, "beef-top-round"],
  [/bacon/i, "bacon"],
  [/salmon/i, "salmon"],
  [/tilapia/i, "tilapia"],
  [/tuna/i, "tuna-canned"],
  [/shrimp/i, "shrimp"],
  [/\beggs?\b/i, "egg"],
  [/\bmilk\b/i, "milk"],
  [/cheddar/i, "cheddar"],
  [/mozzarella/i, "mozzarella"],
  [/parmesan/i, "parmesan"],
  [/greek\s+yogurt/i, "greek-yogurt"],
  [/\byogurt\b/i, "yogurt-plain"],
  [/butter(?!\s*milk)/i, "butter"],
  [/black\s+beans/i, "black-beans"],
  [/chick\s?peas|garbanzo/i, "chickpeas"],
  [/kidney\s+beans/i, "kidney-beans"],
  [/pinto\s+beans/i, "pinto-beans"],
  [/peanut\s+butter/i, "peanut-butter"],
  [/brown\s+rice/i, "brown-rice"],
  [/\brice\b/i, "white-rice"],
  [/pasta|spaghetti|penne|rigatoni|ziti|macaroni|linguine/i, "pasta"],
  [/egg\s+noodles/i, "egg-noodles"],
  [/\boats?\b|oatmeal/i, "oats"],
  [/tortilla/i, "flour-tortilla"],
  [/bread\b/i, "wheat-bread"],
  [/buns?\b/i, "buns"],
  [/sweet\s+potato/i, "sweet-potato"],
  [/potato/i, "potato"],
  [/onion/i, "onion"],
  [/broccoli/i, "broccoli"],
  [/carrot/i, "carrot"],
  [/celery/i, "celery"],
  [/spinach/i, "spinach"],
  [/romaine|lettuce/i, "romaine"],
  [/tomato(es)?\b(?!\s*(sauce|paste))/i, "tomato"],
  [/red\s+(bell\s+)?pepper/i, "red-pepper"],
  [/green\s+(bell\s+)?pepper|bell\s+pepper/i, "green-pepper"],
  [/zucchini/i, "zucchini"],
  [/cucumber/i, "cucumber"],
  [/mushroom/i, "mushrooms"],
  [/green\s+beans/i, "green-beans"],
  [/cabbage/i, "cabbage"],
  [/banana/i, "banana"],
  [/apple(?!\s*cider)/i, "apple"],
  [/strawberr/i, "strawberries"],
  [/blueberr/i, "frozen-blueberries"],
  [/avocado/i, "avocado"],
  [/marinara|pasta\s+sauce/i, "marinara"],
  [/diced\s+tomatoes|canned\s+tomatoes/i, "diced-tomatoes"],
  [/chicken\s+(broth|stock)/i, "chicken-broth"],
  [/salsa/i, "salsa"],
  [/olive\s+oil/i, "olive-oil"],
  [/canola|vegetable\s+oil/i, "vegetable-oil"],
  [/frozen\s+(mixed\s+)?vegetables/i, "frozen-mixed-veg"],
  [/frozen\s+peas|\bpeas\b/i, "frozen-peas"],
  [/frozen\s+corn|\bcorn\b/i, "frozen-corn"],
  [/hummus/i, "hummus"],
  [/tofu/i, "tofu-firm"],
  [/lentil/i, "lentils"],
];

/** Best-effort mapping of a product name to a catalog ingredient (null if unsure). */
export function matchIngredient(name: string, ingredients: Pick<Ingredient, "id" | "name">[]): string | null {
  const ids = new Set(ingredients.map((i) => i.id));
  for (const [re, id] of ALIASES) if (re.test(name) && ids.has(id)) return id;
  const words = name.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  let best: { id: string; score: number } | null = null;
  for (const ing of ingredients) {
    const iw = ing.name.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
    const score = words.filter((w) => iw.some((x) => x.startsWith(w) || w.startsWith(x))).length / Math.max(iw.length, 1);
    if (score > 0.5 && (!best || score > best.score)) best = { id: ing.id, score };
  }
  return best?.id ?? null;
}

const UNIT_WORDS: Record<string, Unit> = { lb: "lb", lbs: "lb", pound: "lb", oz: "oz", ounce: "oz", "fl oz": "floz", floz: "floz", ct: "each", count: "each", pk: "each", ea: "each", each: "each", g: "g", kg: "kg", gal: "floz", gallon: "floz", qt: "floz" };

/**
 * Deterministic parser for pasted flyer text, one item per line. Handles
 * "$2.99/lb", "2 for $5", "16 oz ... $1.00", "Was $4.99". Lines it can't
 * read confidently are skipped rather than guessed.
 */
export function parseFlyerText(text: string, ingredients: Pick<Ingredient, "id" | "name">[]): FlyerItem[] {
  const out: FlyerItem[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    let price: number | null = null;
    let packageQty = 1;
    let packageUnit: Unit = "each";
    let promoNotes: string | undefined;

    const multi = line.match(/(\d+)\s*(?:for|\/)\s*\$\s?(\d+(?:\.\d{1,2})?)/i);
    const perUnit = line.match(/\$\s?(\d+(?:\.\d{1,2})?)\s*(?:\/|per\s+|a\s+)(lb|lbs|pound|oz|ea|each)\b/i);
    const cents = line.match(/\b(\d{2})\s*¢/);
    const plain = [...line.matchAll(/\$\s?(\d+(?:\.\d{1,2})?)/g)].map((m) => Number(m[1]));
    const was = line.match(/(?:was|reg\.?|regular)\s*\$\s?(\d+(?:\.\d{1,2})?)/i);

    if (multi) {
      price = Number(multi[2]) / Number(multi[1]);
      promoNotes = `${multi[1]} for $${multi[2]}`;
    } else if (perUnit) {
      price = Number(perUnit[1]);
      packageUnit = UNIT_WORDS[perUnit[2].toLowerCase()] ?? "each";
    } else if (cents) {
      price = Number(cents[1]) / 100;
    } else if (plain.length) {
      price = plain[0];
    }
    if (price == null || !(price > 0) || price > 500) continue;

    if (!perUnit) {
      const size = line.match(/(\d+(?:\.\d+)?)\s*-?\s*(fl\.?\s?oz|oz|lbs?|pound|ct|count|pk|g|kg|gal|gallon|qt)\b/i);
      if (size) {
        const u = size[2].toLowerCase().replace(/\./g, "").replace(/\s/g, "");
        const unit = UNIT_WORDS[u === "floz" ? "floz" : u] ?? "each";
        let q = Number(size[1]);
        if (u.startsWith("gal")) q *= 128;
        if (u === "qt") q *= 32;
        packageQty = q;
        packageUnit = unit;
      }
    }
    const productName = line
      .replace(/(\d+)\s*(?:for|\/)\s*\$\s?\d+(?:\.\d{1,2})?/gi, "")
      .replace(/(?:was|reg\.?|regular)\s*\$\s?\d+(?:\.\d{1,2})?/gi, "")
      .replace(/\$\s?\d+(?:\.\d{1,2})?\s*(?:\/|per\s+)?\s*(lb|lbs|oz|ea|each)?/gi, "")
      .replace(/\b\d{2}\s*¢/g, "")
      .replace(/[–—-]\s*$/, "")
      .trim();
    if (productName.length < 3) continue;
    out.push({
      productName,
      price: Math.round(price * 100) / 100,
      regularPrice: was ? Number(was[1]) : undefined,
      packageQty,
      packageUnit,
      ingredientId: matchIngredient(productName, ingredients),
      loyaltyRequired: /card|loyalty|rewards|my\s*hannaford|just\s*for\s*u|advantedge/i.test(line) || undefined,
      couponRequired: /coupon|digital/i.test(line) || undefined,
      promoNotes,
    });
  }
  return out;
}
