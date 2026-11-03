"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Lock, LockOpen, Trash2, BookOpen } from "lucide-react";
import type { MealPlan, PlannedMeal } from "@/lib/types";
import { useData } from "@/lib/data-context";
import { removeMeal, updateMeal } from "@/lib/db/actions";
import { Planner } from "@/lib/engine/planner";
import { portionFactor } from "@/lib/engine/targets";
import { recipeNutrition } from "@/lib/engine/nutrition";
import { Badge, Button, Chips, Segmented, Sheet, money, cn } from "./ui";
import { Avatar, MEAL_LABEL } from "./bits";
import { useToast } from "./toast";

type Filter = "kid" | "quick" | "protein" | "cheaper";

export function MealSheet({ plan, meal, onClose }: { plan: MealPlan; meal: PlannedMeal | null; onClose: () => void }) {
  const data = useData();
  const toast = useToast();
  const [tab, setTab] = useState<"swap" | "people">("swap");
  const [filters, setFilters] = useState<Filter[]>([]);
  const recipe = meal ? data.recipeMap.get(meal.recipeId) : undefined;

  const planner = useMemo(() => new Planner({ request: plan.request, schedule: data.settings.schedule, ctx: data.ctx, substitutions: plan.substitutions }), [plan, data]);
  const currentTotal = useMemo(() => planner.planCost(plan.meals), [planner, plan.meals]);
  const options = useMemo(() => {
    if (!meal) return [];
    return planner.replacements(plan.meals, meal.id, {
      kidFriendly: filters.includes("kid"),
      maxMinutes: filters.includes("quick") ? 30 : undefined,
      highProtein: filters.includes("protein"),
      cheaper: filters.includes("cheaper"),
    }).slice(0, 12);
  }, [planner, plan.meals, meal, filters]);

  if (!meal || !recipe) return null;
  const date = new Date(meal.date + "T12:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  async function swap(recipeId: string, name: string) {
    await updateMeal(plan, meal!.id, { recipeId });
    toast(`Swapped in ${name}`);
    onClose();
  }

  return (
    <Sheet open={!!meal} onClose={onClose} title={`${date} · ${MEAL_LABEL[meal.mealType]}`} wide>
      <div className="space-y-4 pb-3">
        <div className="rounded-2xl border border-ink/10 bg-cream-100 p-3.5">
          <div className="font-display text-xl font-semibold">{recipe.name}</div>
          <p className="mt-0.5 text-[13px] text-ink-600">{recipe.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/recipes/view?id=${recipe.id}&plan=${plan.id}&meal=${meal.id}`}><Button size="sm" variant="soft"><BookOpen className="h-4 w-4" /> Recipe</Button></Link>
            <Button size="sm" variant="soft" onClick={() => updateMeal(plan, meal.id, { locked: !meal.locked })}>
              {meal.locked ? <><LockOpen className="h-4 w-4" /> Unlock</> : <><Lock className="h-4 w-4" /> Lock</>}
            </Button>
            <Button size="sm" variant="danger" onClick={async () => { await removeMeal(plan, meal.id); onClose(); }}><Trash2 className="h-4 w-4" /> Remove</Button>
          </div>
        </div>

        <Segmented className="w-full" value={tab} onChange={setTab} options={[{ value: "swap", label: "Swap meal" }, { value: "people", label: "Who's eating" }]} />

        {tab === "swap" ? (
          <div className="space-y-3">
            <Chips<Filter> values={filters} onChange={setFilters} options={[{ value: "kid", label: "Kids will like" }, { value: "quick", label: "≤ 30 min" }, { value: "protein", label: "Higher protein" }, { value: "cheaper", label: "Cheaper" }]} />
            {options.length === 0 && <p className="py-6 text-center text-sm text-ink-400">No safe alternatives match these filters.</p>}
            {options.map((o) => {
              const r = o.profile.recipe;
              const delta = o.newTotal - currentTotal;
              const n = recipeNutrition(r, data.ctx.lookup, plan.substitutions).perServing;
              return (
                <button key={r.id} onClick={() => swap(r.id, r.name)} className="flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-white/60 p-3 text-left transition hover:border-forest/40 hover:bg-white">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{r.name}</div>
                    <div className="tnum text-xs text-ink-400">{o.profile.totalMinutes} min · {Math.round(n.kcal)} kcal · {Math.round(n.protein)}g protein</div>
                    {o.reasons.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{o.reasons.map((x) => <Badge key={x} tone="forest">{x}</Badge>)}</div>}
                  </div>
                  <div className="text-right">
                    <div className={cn("tnum flex items-center justify-end gap-0.5 text-sm font-bold", delta > 0.005 ? "text-orange-700" : "text-forest")}>
                      {delta > 0.005 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      {delta >= 0 ? "+" : "−"}{money(Math.abs(delta))}
                    </div>
                    <div className="tnum text-[11px] text-ink-400">plan {money(o.newTotal)}{o.newTotal > plan.request.budget ? " · over" : ""}</div>
                  </div>
                </button>
              );
            })}
            <p className="text-[11px] text-ink-400">Only recipes safe for everyone at this meal are shown. Cost changes include package sharing with the rest of the week.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.members.map((m, i) => {
              const on = meal.attendees.includes(m.id);
              const f = meal.portionOverrides?.[m.id] ?? portionFactor(m);
              return (
                <div key={m.id} className={cn("rounded-2xl border-2 p-3 transition", on ? "border-forest/40 bg-forest-50" : "border-ink/10")}>
                  <div className="flex items-center gap-3">
                    <Avatar member={m} idx={i} size={32} />
                    <span className="flex-1 font-semibold">{m.name}</span>
                    <Button size="sm" variant={on ? "primary" : "outline"} onClick={() => updateMeal(plan, meal.id, { attendees: on ? meal.attendees.filter((x) => x !== m.id) : [...meal.attendees, m.id] })}>
                      {on ? "Eating" : "Away"}
                    </Button>
                  </div>
                  {on && (
                    <div className="mt-2 flex items-center gap-2 pl-11">
                      <span className="text-xs text-ink-400">Portion</span>
                      {[0.5, 0.75, 1, 1.25, 1.5].map((v) => (
                        <button key={v} onClick={() => updateMeal(plan, meal.id, { portionOverrides: { ...(meal.portionOverrides ?? {}), [m.id]: v } })} className={cn("tnum rounded-full px-2 py-1 text-xs font-bold", Math.abs(f - v) < 0.01 ? "bg-forest text-cream-100" : "bg-cream-200 text-ink-600")}>
                          {v}×
                        </button>
                      ))}
                      {meal.portionOverrides?.[m.id] != null && (
                        <button className="text-xs font-semibold text-orange-700" onClick={() => { const p = { ...(meal.portionOverrides ?? {}) }; delete p[m.id]; updateMeal(plan, meal.id, { portionOverrides: p }); }}>Auto ({portionFactor(m)}×)</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <p className="pt-1 text-[11px] text-ink-400">Shopping quantities, costs and nutrition update instantly.</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
