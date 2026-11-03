"use client";

import Link from "next/link";
import { Clock, Flame, AlertTriangle, Lock } from "lucide-react";
import type { Category, Member, MealType, Nutrients, PlannedMeal, Recipe } from "@/lib/types";
import { Badge, cn, money } from "./ui";
import { useData } from "@/lib/data-context";
import { recipeNutrition, roundNutrients } from "@/lib/engine/nutrition";
import { findConflicts } from "@/lib/engine/allergens";

const PALETTE = ["#D67B42", "#344B35", "#E5B65A", "#8B5E3C", "#5E7F62", "#B84A3A", "#6B7FA3", "#A0705A"];

export function memberColor(m: Member, idx = 0) {
  return m.color ?? PALETTE[idx % PALETTE.length];
}

export function Avatar({ member, size = 28, idx = 0, ring }: { member: Member; size?: number; idx?: number; ring?: boolean }) {
  return (
    <span
      title={member.name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white", ring && "ring-2 ring-cream-100")}
      style={{ width: size, height: size, background: memberColor(member, idx), fontSize: size * 0.42 }}
    >
      {member.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function AvatarStack({ ids, size = 24 }: { ids: string[]; size?: number }) {
  const { members } = useData();
  const list = members.map((m, i) => ({ m, i })).filter(({ m }) => ids.includes(m.id));
  return (
    <span className="inline-flex -space-x-1.5">
      {list.map(({ m, i }) => (
        <Avatar key={m.id} member={m} idx={i} size={size} ring />
      ))}
    </span>
  );
}

export const MEAL_LABEL: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

export function MealCard({ meal, recipe, cost, subs, onClick, right, compact }: { meal: PlannedMeal; recipe: Recipe; cost?: number; subs?: Record<string, string>; onClick?: () => void; right?: React.ReactNode; compact?: boolean }) {
  const { ctx } = useData();
  const n = roundNutrients(recipeNutrition(recipe, ctx.lookup, subs).perServing);
  const attendees = ctx.members.filter((m) => meal.attendees.includes(m.id));
  const conflicts = findConflicts(recipe, attendees, ctx.lookup, subs).filter((c) => c.kind !== "dislike");
  const body = (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="eyebrow !text-[10px]">{MEAL_LABEL[meal.mealType]}</span>
          {meal.locked && <Lock className="h-3 w-3 text-ink-400" aria-label="Locked" />}
        </div>
        <div className={cn("font-display leading-snug font-semibold text-ink", compact ? "text-[16px]" : "text-[18px]")}>{recipe.name}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-400">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{recipe.prepMinutes + recipe.cookMinutes} min</span>
          <span className="inline-flex items-center gap-1 tnum"><Flame className="h-3.5 w-3.5" />{n.kcal} kcal · {Math.round(n.protein)}g protein</span>
          {cost != null && <span className="tnum font-semibold text-ink-600">{money(cost)}</span>}
        </div>
        {conflicts.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-[12px] font-semibold text-tomato">
            <AlertTriangle className="h-3.5 w-3.5" />
            {conflicts.map((c) => `${c.optionalOnly ? "Omit " : ""}${c.ingredientName} (${c.memberName})`).join(", ")}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-2">
        <AvatarStack ids={meal.attendees} />
        {right}
      </div>
    </div>
  );
  if (onClick)
    return (
      <button onClick={onClick} className="block w-full rounded-2xl border border-ink/10 bg-cream-100 p-3.5 text-left shadow-[var(--shadow-card)] transition hover:border-ink/25 active:scale-[0.99]">
        {body}
      </button>
    );
  return <div className="rounded-2xl border border-ink/10 bg-cream-100 p-3.5 shadow-[var(--shadow-card)]">{body}</div>;
}

export function RecipeLink({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={`/recipes/view?id=${encodeURIComponent(id)}`} className={className}>
      {children}
    </Link>
  );
}

function FactsRow({ label, value, pct, bold, indent }: { label: string; value: string; pct?: string; bold?: boolean; indent?: boolean }) {
  return (
    <div className={cn("rule flex justify-between py-[3px] text-[13px]", indent && "pl-4")}>
      <span>
        {bold ? <b>{label}</b> : label} {value}
      </span>
      {pct && <b>{pct}</b>}
    </div>
  );
}

/** FDA-style Nutrition Facts panel, values from USDA FoodData Central. */
export function NutritionFacts({ n, servingLabel, incomplete, sugarComplete }: { n: Nutrients; servingLabel: string; incomplete?: string[]; sugarComplete?: boolean }) {
  const r = roundNutrients(n);
  const dv = (v: number, d: number) => `${Math.round((v / d) * 100)}%`;
  return (
    <div className="facts max-w-xs">
      <div className="font-display text-[30px] leading-none font-black tracking-tight">Nutrition Facts</div>
      <div className="rule mt-1 pt-1 text-[13px]">
        <b>Serving size</b> {servingLabel}
      </div>
      <div className="rule-thick mt-1" />
      <div className="text-[11px] font-bold">Amount per serving</div>
      <div className="flex items-end justify-between">
        <span className="font-display text-[26px] font-black">Calories</span>
        <span className="font-display tnum text-[34px] leading-none font-black">{r.kcal}</span>
      </div>
      <div className="rule-mid mt-1" />
      <div className="py-0.5 text-right text-[11px] font-bold">% Daily Value*</div>
      <FactsRow label="Total Fat" value={`${r.fat}g`} pct={dv(r.fat, 78)} bold />
      <FactsRow label="Saturated Fat" value={`${r.satFat}g`} pct={dv(r.satFat, 20)} indent />
      <FactsRow label="Sodium" value={`${r.sodium}mg`} pct={dv(r.sodium, 2300)} bold />
      <FactsRow label="Total Carbohydrate" value={`${r.carbs}g`} pct={dv(r.carbs, 275)} bold />
      <FactsRow label="Dietary Fiber" value={`${r.fiber}g`} pct={dv(r.fiber, 28)} indent />
      <FactsRow
        label={sugarComplete ? "Added Sugars" : "Added Sugars (from sweeteners)"}
        value={r.addedSugar == null ? "n/a" : `${sugarComplete ? "" : "≥"}${r.addedSugar}g`}
        pct={r.addedSugar == null ? undefined : dv(r.addedSugar, 50)}
        indent
      />
      <FactsRow label="Protein" value={`${r.protein}g`} bold />
      <div className="rule-mid mt-1" />
      <p className="pt-1 text-[10px] leading-snug">
        *Percent Daily Values are based on a 2,000 calorie diet. Calculated from USDA FoodData Central (SR Legacy) using ingredient weights.
        {incomplete && incomplete.length > 0 && <b> Incomplete: {incomplete.join(", ")} not included.</b>}
      </p>
    </div>
  );
}

export function PriceStatusBadge({ status }: { status: "verified" | "estimate" | "demo" | "missing" | "owned" | "on-hand" }) {
  const map = {
    verified: { tone: "forest", text: "Store price" },
    estimate: { tone: "gold", text: "Estimate" },
    demo: { tone: "orange", text: "DEMO" },
    missing: { tone: "tomato", text: "No price" },
    owned: { tone: "ink", text: "Have it" },
    "on-hand": { tone: "ink", text: "On hand" },
  } as const;
  const v = map[status];
  return <Badge tone={v.tone}>{v.text}</Badge>;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  produce: "Produce", meat: "Meat & poultry", seafood: "Seafood", dairy: "Dairy", eggs: "Eggs", bakery: "Bakery",
  frozen: "Frozen", grains: "Grains & pasta", canned: "Canned & jarred", condiments: "Condiments", spices: "Spices", oils: "Oils",
};
