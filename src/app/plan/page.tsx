"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, TrendingDown, AlertTriangle, CalendarPlus, Info, ShoppingBasket, History } from "lucide-react";
import { useData } from "@/lib/data-context";
import { memberWeekAverage, usePlanDerived } from "@/lib/use-plan";
import { reducePlanToBudget, setActivePlan, deletePlan } from "@/lib/db/actions";
import { Badge, Bar, Button, Card, Empty, Notice, PageHeader, SectionTitle, Sheet, money } from "@/components/ui";
import { Avatar, MealCard } from "@/components/bits";
import { PlanGenerator } from "@/components/plan-generator";
import { MealSheet } from "@/components/meal-sheet";
import { MEAL_TYPES, type PlannedMeal } from "@/lib/types";
import { useToast } from "@/components/toast";
import { goalLabel } from "@/lib/engine/targets";

export default function PlanPage() {
  const data = useData();
  const plan = data.activePlan;
  const derived = usePlanDerived(plan);
  const toast = useToast();
  const [genOpen, setGenOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [reducing, setReducing] = useState(false);

  if (!plan || !derived) {
    return (
      <div className="rise">
        <PageHeader eyebrow="Section 2" title="Meal Plan" />
        <Empty icon={<CalendarPlus className="h-10 w-10" />} title="No plan yet" body="Choose a budget, days and meals. WellFed balances nutrition, cost, deals and your pantry." action={<Button size="lg" onClick={() => setGenOpen(true)}><Sparkles className="h-5 w-5" /> Generate a plan</Button>} />
        <PlanGenerator open={genOpen} onClose={() => setGenOpen(false)} />
      </div>
    );
  }

  const byDate = new Map<string, PlannedMeal[]>();
  for (const m of [...plan.meals].sort((a, b) => a.date.localeCompare(b.date) || MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType))) {
    byDate.set(m.date, [...(byDate.get(m.date) ?? []), m]);
  }
  const costByMeal = new Map(derived.budget.byMeal.map((b) => [b.mealId, b.cost]));
  const b = derived.budget;
  const selectedMeal = plan.meals.find((m) => m.id === selected) ?? null;

  async function reduce() {
    setReducing(true);
    await new Promise((r) => setTimeout(r, 30));
    const res = await reducePlanToBudget(plan!, data.ctx, data.settings.schedule);
    setReducing(false);
    if (!res.changes.length) toast("No cheaper safe swaps found — see suggestions below", "error");
    else toast(`Swapped ${res.changes.length} meal${res.changes.length > 1 ? "s" : ""}, saved ${money(res.changes.reduce((s, c) => s + c.saved, 0))}`);
  }

  return (
    <div className="rise space-y-6">
      <PageHeader
        eyebrow="Section 2"
        title={plan.name}
        subtitle={`${plan.meals.length} meals · ${plan.request.priority === "cost" ? "lowest cost" : plan.request.priority} priority`}
        action={<div className="flex gap-2"><Button size="icon" variant="ghost" aria-label="Plan history" onClick={() => setHistoryOpen(true)}><History className="h-5 w-5" /></Button><Button onClick={() => setGenOpen(true)}><Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Regenerate</span><span className="sm:hidden">New</span></Button></div>}
      />

      {/* Budget strip */}
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">Estimated</div>
            <div className="font-display tnum text-2xl font-semibold">{money(b.total)}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">{b.overBy > 0 ? "Over by" : "Remaining"}</div>
            <div className={`font-display tnum text-2xl font-semibold ${b.overBy > 0 ? "text-tomato" : "text-forest"}`}>{money(b.overBy > 0 ? b.overBy : b.remaining)}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">Per serving</div>
            <div className="font-display tnum text-2xl font-semibold">{money(b.perServing)}</div>
          </div>
        </div>
        <Bar className="mt-3" value={b.total} max={plan.request.budget} tone={b.overBy > 0 ? "tomato" : "forest"} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-400">
          <span>Budget {money(plan.request.budget)} · {b.servings} servings</span>
          <Link href="/groceries" className="inline-flex items-center gap-1 font-semibold text-forest"><ShoppingBasket className="h-3.5 w-3.5" /> Shopping list</Link>
        </div>
        {b.overBy > 0 && (
          <Button variant="accent" className="mt-3 w-full" onClick={reduce} loading={reducing}><TrendingDown className="h-4 w-4" /> Reduce to budget</Button>
        )}
      </Card>

      {plan.notes.length > 0 && (
        <div className="space-y-2">
          {plan.notes.map((n, i) => (
            <Notice key={i} tone={n.startsWith("Over budget") || n.startsWith("No safe") ? "tomato" : "gold"} icon={n.startsWith("Over budget") ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}>{n}</Notice>
          ))}
          {b.overBy > 0 && (
            <Notice tone="forest" icon={<Info className="h-4 w-4" />}>
              <b>Ways to close the gap:</b> swap meals using &ldquo;Cheaper&rdquo;, apply the substitutions on the Groceries → Budget tab, add pantry items you already own, or enter this week&apos;s actual store prices — the plan currently uses {Math.round(b.estimateShare * 100)}% estimated prices.
            </Notice>
          )}
        </div>
      )}
      {derived.list.missing.length > 0 && (
        <Notice tone="tomato" icon={<AlertTriangle className="h-4 w-4" />}>No price available for: {derived.list.missing.map((i) => i.ingredient.name).join(", ")}. Totals exclude these until you add a price.</Notice>
      )}

      {/* Calendar */}
      <section className="space-y-5">
        {[...byDate.entries()].map(([date, meals]) => {
          const d = new Date(date + "T12:00");
          const isToday = date === data.today;
          return (
            <div key={date} className="grid gap-2 md:grid-cols-[120px_1fr] md:gap-4">
              <div className="flex items-baseline gap-2 md:flex-col md:gap-0">
                <span className={`font-display text-xl font-semibold ${isToday ? "text-orange" : "text-forest"}`}>{d.toLocaleDateString(undefined, { weekday: "long" })}</span>
                <span className="text-sm text-ink-400">{d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}{isToday && " · today"}</span>
              </div>
              <div className="grid gap-2.5">
                {meals.map((m) => {
                  const r = data.recipeMap.get(m.recipeId);
                  if (!r) return <div key={m.id} className="rounded-2xl border border-dashed p-3 text-sm text-tomato">Recipe missing — tap to swap.</div>;
                  return <MealCard key={m.id} meal={m} recipe={r} cost={costByMeal.get(m.id)} subs={plan.substitutions} onClick={() => setSelected(m.id)} />;
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* Weekly nutrition */}
      <section>
        <SectionTitle eyebrow="Nutrition" title="Daily averages from this plan" />
        <div className="grid gap-3 md:grid-cols-2">
          {data.members.map((m, i) => {
            const { avg, targets: t, share, days } = memberWeekAverage(derived, m);
            if (!days) return null;
            const rows = [
              { label: "Calories", v: avg.kcal, t: t.kcal * share, unit: "" },
              { label: "Protein", v: avg.protein, t: t.protein * share, unit: "g" },
              { label: "Fiber", v: avg.fiber, t: t.fiber * share, unit: "g" },
              { label: "Sodium", v: avg.sodium, t: t.sodiumMax * share, unit: "mg", max: true },
              { label: "Sat. fat", v: avg.satFat, t: t.satFatMax * share, unit: "g", max: true },
            ];
            return (
              <Card key={m.id} className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Avatar member={m} idx={i} size={28} />
                  <span className="font-semibold">{m.name}</span>
                  <Badge tone="outline">{goalLabel(m)}</Badge>
                </div>
                <div className="space-y-2">
                  {rows.map((r) => (
                    <div key={r.label}>
                      <div className="flex justify-between text-[12.5px]">
                        <span className="text-ink-600">{r.label}{r.max ? " (limit)" : ""}</span>
                        <span className="tnum text-ink-400">{Math.round(r.v)}{r.unit} / {Math.round(r.t)}{r.unit}</span>
                      </div>
                      <Bar value={r.v} max={r.t} tone={r.max ? (r.v > r.t ? "tomato" : "gold") : r.v >= r.t * 0.9 ? "forest" : "orange"} />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-ink-400">On days with planned meals; targets scaled to the planned meals ({Math.round(share * 100)}% of a day).</p>
              </Card>
            );
          })}
        </div>
      </section>

      <PlanGenerator open={genOpen} onClose={() => setGenOpen(false)} initial={{ startDate: plan.request.startDate, days: plan.request.days, mealTypes: plan.request.mealTypes, budget: plan.request.budget, priority: plan.request.priority, includeSnacks: plan.request.includeSnacks }} />
      <MealSheet plan={plan} meal={selectedMeal} onClose={() => setSelected(null)} />
      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="Saved plans">
        <div className="space-y-2 pb-2">
          {data.plans.map((p) => (
            <div key={p.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${p.id === plan.id ? "border-forest bg-forest-50" : "border-ink/10"}`}>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-ink-400">{p.meals.length} meals · budget {money(p.request.budget)} · saved {new Date(p.updatedAt).toLocaleDateString()}</div>
              </div>
              {p.id !== plan.id && <Button size="sm" variant="soft" onClick={async () => { await setActivePlan(p.id); setHistoryOpen(false); }}>Open</Button>}
              <Button size="sm" variant="ghost" onClick={() => confirm(`Delete ${p.name}?`) && deletePlan(p.id)}>Delete</Button>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
