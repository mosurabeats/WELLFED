# WellFed

**Nutrition first. Budget second. Convenience always.**

WellFed is a private, mobile-first family meal planner. Tell it who you're feeding, what you can spend and who's home for each meal. It plans the week, calculates nutrition from USDA data, builds one shopping list using real package sizes, and labels where every price comes from.

It's built for one household, not as a SaaS product. There are no accounts, ads or analytics. Household data stays on the device in IndexedDB.

---

## What it does

| Area | What works today |
|---|---|
| **Household** | Profiles for adults and children: age, optional height and weight, activity, allergies (all 9 US major allergens), diets, likes and dislikes, adult goals and custom targets. A weekly attendance schedule sets who eats which meal, and you can override any single meal. |
| **Nutrition** | Every value is computed from **USDA FoodData Central (SR Legacy)** using ingredient weights and edible yield. Tracks kcal, protein, carbs, fat, saturated fat, fiber, sodium and added sugar (from sweeteners). Portions scale per person: a 6-year-old eats about 0.7 of a serving and an adult building muscle about 1.35. |
| **Planner** | A deterministic optimizer balances nutrition quality, your goals, marginal cost (reusing a package that's already bought is nearly free), deals, expiring pantry items, ratings, variety and cooking time. Allergens and diets are hard filters. If the budget is too low, it says so and shows the numbers. |
| **Budget** | Budget slider and dollar input. Shows total, remaining, per meal, per serving, cost by meal and by store, and the value of leftover packages. Includes *Reduce to budget*, cheaper ingredient substitutions (with the protein impact), and planned-versus-actual spending. |
| **Shopping list** | Consolidated across recipes, with the pantry subtracted and whole packages bought (a 2-lb bag, not 10 oz of rice). Group by aisle or store. Check items off, change package counts, mark items as owned, switch store, and enter what you actually paid. Shopping mode has large checkboxes, keeps the screen awake and works offline. |
| **Deals & stores** | ZIP-code store search (OpenStreetMap). You can add prices by hand or import a weekly flyer: the AI reads a photo or PDF, or pasted text is parsed offline, and you confirm every row. Handles sale, regular, loyalty and coupon prices, start and end dates, and expiry. Compares unit prices, shows the cheapest single store and the best multi-store trip, and flags unpriced items. |
| **Recipes** | 49 built-in recipes with precise quantities. Includes Nutrition Facts panels, cost per serving, allergen and household conflict checks, scaling, favorites, per-person ratings, exclusions, a recipe editor, paste-import, and AI drafting. |
| **Assistant** | Plain-English requests such as "$90 for four people, five days", "make it higher protein", "replace Wednesday's dinner with something the kids will like", "use the chicken and potatoes", "under 30 minutes" or "around this week's Hannaford specials". The AI (Claude or OpenAI) only translates the request into actions. The engine executes them. With no API key, a built-in parser handles these requests. |
| **PWA** | Can be installed on iPhone (Share → Add to Home Screen). The service worker caches the app shell, so the plan, recipes and shopping list work offline. |
| **Privacy** | JSON backup, restore and erase-all. AI calls send an anonymized summary (for example "Adult 1, age 38" and never names), and only when you use the AI. An optional access code protects the server routes. |

---

## Quick start

Requires Node 20+.

```bash
npm install
cp .env.example .env.local   # optional: add an AI key
npm run dev                  # http://localhost:3000
```

Production:

```bash
npm run build && npm start
```

### Using it on your iPhone

Service workers and "Add to Home Screen" need **HTTPS** (except on `localhost`). Pick one:

1. **Vercel (simplest, free tier).** Import the repo and set the environment variables below. **Set `APP_ACCESS_CODE`** so strangers can't use your AI key. Your household data still lives only in your phone's browser, not on Vercel.
2. **A home computer with Tailscale.** Run `npm run build && npm start`, then `tailscale serve 3000` to get a private HTTPS URL that only your devices can reach.
3. Any host that runs Node and has HTTPS (Fly.io, Render, a Raspberry Pi behind Caddy, and so on).

On the phone, open the URL in Safari, tap **Share → Add to Home Screen**, and open WellFed from the icon.

> Data is per-device and per-browser. To move it to another phone, use **Household → Data & privacy → Export** and then **Import** on the new device.

### Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enables Claude for the assistant, flyer reading and recipe drafting. Default model `claude-opus-5-5`; override with `ANTHROPIC_MODEL`. |
| `OPENAI_API_KEY` | Alternative provider (`OPENAI_MODEL`, default `gpt-4o-mini`). Choose the provider in Household → Data & privacy. |
| `APP_ACCESS_CODE` | If set, every `/api/*` call must send this code. Enter it in the app once. |
| `OVERPASS_URL` | Optional alternative OpenStreetMap Overpass endpoint. |

Every variable is optional. With none set, everything works except AI flyer photo and PDF reading and AI recipe drafting, which say so clearly.

---

## Architecture

```
src/
  lib/
    types.ts             domain model
    engine/              pure, deterministic, unit-tested — no browser APIs
      units.ts           mass/volume/count conversion via density and each-weights
      nutrition.ts       USDA-based recipe nutrition, scaling
      targets.ts         adult (Mifflin–St Jeor) and child (DGA) targets, portion factors
      allergens.ts       allergen / diet / dislike conflict detection
      pricing.ts         unit prices, deal status, cheapest whole-package purchase
      shopping.ts        requirements, pantry deduction, list building, store comparison, cost model
      planner.ts         slot building, scoring, greedy plan + reduce-to-budget + nutrition upgrade, swaps
      budget.ts          budget summary, cost allocation, substitutions, recipe cost
    db/                  Dexie (IndexedDB) schema and actions — the "repository" layer
    assistant/           AI action schema, offline parser, action executor
    server/              server-only: AI provider abstraction, access guard
    flyer.ts             flyer text parser + ingredient matching
    stores-osm.ts        chain classification, Overpass parsing
  data/
    ingredient-specs.ts  121 ingredients: FDC ids, allergens, diet flags, densities, yields
    usda-nutrients.json  generated from USDA SR Legacy by scripts/build-nutrients.py
    recipes.ts           built-in recipes
    estimated-prices.ts  clearly-labeled typical prices (fallback only)
  app/                   Next.js App Router pages + API routes
  components/            UI (hand-built shadcn-style primitives on Tailwind v4)
public/sw.js             service worker
tests/                   Vitest suites
scripts/                 nutrient build, smoke test
```

### Key decisions and tradeoffs

- **IndexedDB (Dexie) instead of SQLite or Postgres with Prisma.** For one family, the most private and truly local-first option is keeping the data on the phone. It works offline, needs no database server, and lets the app deploy for free with nothing to maintain. The tradeoffs: no automatic sync between devices (use export and import), and clearing Safari website data deletes it. The engine is storage-agnostic, so adding a server database later only changes `lib/db`.
- **The deterministic engine is the authority.** Prices, package math, nutrition and allergen checks never come from the AI. The AI returns a Zod-validated action list (or flyer rows, or a recipe draft) that the engine executes or that you review. AI-drafted ingredients that aren't in the catalog are marked *unverified*: they're excluded from nutrition, and the recipe is kept out of plans for anyone with allergies.
- **The optimizer is greedy construction plus local search, not an ILP solver.** It's fast enough to run instantly on a phone and transparent enough to explain. It finds good plans, not provably optimal ones. The shortfall message says "lowest-cost plan *found*".
- **The planner's cost model** buys whole packages at the cheapest known store price, falling back to estimates. The shopping list uses the same pricing (rounded to 5 g buckets in the planner), so the two agree within cents.
- **shadcn/ui components were hand-written** in the same style (cva, tailwind-merge) instead of generated with the CLI. That keeps dependencies minimal and lets the design match the 1970s co-op look.
- **Next.js 16** is used without Cache Components. The app is client-rendered over IndexedDB, so server caching adds nothing.

---

## Where prices come from (and don't)

I researched what each target retailer actually offers:

| Retailer | Public pricing API? | What WellFed does |
|---|---|---|
| Hannaford | No. The weekly flyer is on hannaford.com. | Flyer import (photo, PDF or text) or manual entry |
| Shaw's (Albertsons) | No. Weekly ad and digital coupons sit behind the site. | Flyer import or manual entry |
| Price Chopper / Market 32 | No. Weekly flyer on the site. | Flyer import or manual entry |
| Walmart | Only an affiliate product API, for approved partners | Manual entry or screenshot import. An adapter could be added if you get affiliate credentials. |
| Aldi | No. Weekly ad on aldi.us. | Flyer import or manual entry |

WellFed **does not scrape** these sites or bypass logins, CAPTCHAs or bot protection, and it doesn't use undocumented flyer back-ends.

Every price carries a **source label**:

- **Store price / You entered.** Typed from a shelf tag or receipt, with a timestamp.
- **Weekly flyer.** Extracted from a flyer and confirmed by you, with start and end dates.
- **Estimate.** A hand-compiled typical Northeast US regular price for a common package. It isn't tied to any store or date, and it's used only when no real price exists. The UI always shows how much of a total comes from estimates.
- **DEMO.** Two fictional stores with invented prices. They're loaded only when you tap *Load demo deals* and can be removed in one tap.

Expired deals are ignored automatically. Upcoming deals are shown but not used yet.

## Nutrition data

`src/data/usda-nutrients.json` is generated from the **USDA FoodData Central SR Legacy** release (public domain). Each catalog ingredient references an exact FDC id, and the build script fails if any id is missing. To regenerate:

```bash
curl -LO https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
unzip FoodData_Central_sr_legacy_food_csv_2018-04.zip
npm run build:nutrients -- FoodData_Central_sr_legacy_food_csv_2018-04
```

SR Legacy has no "added sugars" field. WellFed counts pure sweeteners (sugar, brown sugar, honey and maple syrup) as added sugar and labels the figure as "from sweeteners", so sauces and breads may add more.

---

## Testing

```bash
npm test            # 63 unit tests (Vitest)
npm run typecheck
npm run lint
npm run build && npm start &  npm run smoke   # end-to-end in an emulated iPhone (Playwright)
```

The unit tests cover recipe scaling, nutrition math against USDA values, unit conversion, package rounding, cheapest package combinations, list consolidation, shared packages counted once, pantry deduction, staples, budget allocation, expired deals, missing prices (flagged, never invented), store comparison, substitutions that respect diets, allergy and diet conflicts (including hidden wheat in soy sauce), optional garnish conflicts, unverified AI ingredients, attendance changes, meal swaps, reduce-to-budget, max cook time, deal and pantry preference, and **budgets too low to meet the request** (explained, not faked). There are also tests for the flyer, assistant, recipe-import and store-lookup parsers.

The smoke test walks through household setup with a peanut allergy, a $90 / 5-day / 2-meal plan, a swap, the list, deals, store comparison, budget, shopping mode, a recipe, the assistant, and persistence across a reload.

## Known limitations

- **No live store prices without your input.** No target chain offers a lawful public price API (see above). Totals are only as good as the prices you add, and until then they lean on labeled estimates.
- **Store search** depends on public OpenStreetMap services. If they're down, add stores manually. Distances are straight-line; no routing service is used.
- **Single device.** There's no cloud sync, so use backup and restore.
- **Recipe library.** 49 recipes, enough for variety, but with tight budgets and strict diets the planner may repeat meals (it says when it does). You can add your own recipes or use AI drafts.
- **Ingredient catalog.** Recipes can only use the 121 catalog ingredients for verified nutrition. Adding custom USDA-backed ingredients in the UI is a natural next step.
- **Targets are estimates** (Mifflin–St Jeor and the Dietary Guidelines energy levels). This isn't medical or dietetic advice.
- Allergen detection is based on catalog ingredients, not on brand-specific labels or cross-contact. Always read labels.
