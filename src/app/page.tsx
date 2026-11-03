"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CalendarPlus, ChefHat, Tag, Users, Timer, Sparkles } from "lucide-react";
import { useData } from "@/lib/data-context";
import { usePlanDerived } from "@/lib/use-plan";
import { Badge, Bar, Button, Card, Empty, Ring, SectionTitle, money } from "@/components/ui";
import { Avatar, MealCard, MEAL_LABEL } from "@/components/bits";
import { PlanGenerator } from "@/components/plan-generator";
import { memberTargets, MEAL_SHARE } from "@/lib/engine/targets";
import { addDays } from "@/lib/engine/planner";
import { discountPct, isActive, unitPriceLabel } from "@/lib/engine/pricing";
import { MEAL_TYPES } from "@/lib/types";

export default function TodayPage() {
  const data = useData();
  const plan = data.activePlan;
  const derived = usePlanDerived(plan);
  const [genOpen, setGenOpen] = useState(false);
  const today = data.today;
  const tomorrow = addDays(today, 1);
  const todays = (plan?.meals ?? []).filter((m) => m.date === today).sort((a, b) => MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType));
  const tomorrows = (plan?.meals ?? []).filter((m) => m.date === tomorrow);
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const deals = data.dbPrices
    .filter((p) => p.isSale && isActive(p, today))
    .map((p) => ({ p, ing: data.ingredientMap.get(p.ingredientId), d: discountPct(p) ?? 0 }))
    .filter((x) => x.ing)
    .sort((a, b) => b.d - a.d)
    .slice(0, 4);

  if (!data.members.length) return <Welcome />;

  const costByMeal = new Map(derived?.budget.byMeal.map((b) => [b.mealId, b.cost]));
  const todayNutrition = derived?.dailyByMember.get(today);
  const todayShare = todays.reduce((s, m) => s + MEAL_SHARE[m.mealType], 0);

  return (
    <div className="rise space-y-7 pt-3">
      <header>
        <div className="eyebrow">{dateLabel}</div>
        <h1 className="font-display text-[34px] leading-tight font-semibold text-forest md:text-[42px]">{greeting}.</h1>
      </header>

      {/* Today's meals */}
      <section>
        <SectionTitle eyebrow="No. 1" title="Today's table" action={plan && <Link href="/plan" className="text-sm font-semibold text-orange-700">Full week →</Link>} />
        {todays.length ? (
          <div className="space-y-2.5">
            {todays.map((m) => {
              const r = data.recipeMap.get(m.recipeId);
              if (!r) return null;
              return (
                <Link key={m.id} href={`/recipes/view?id=${r.id}&plan=${plan!.id}&meal=${m.id}`} className="block">
                  <MealCard meal={m} recipe={r} cost={costByMeal.get(m.id)} subs={plan?.substitutions} />
                </Link>
              );
            })}
          </div>
        ) : (
          <Empty
            icon={<ChefHat className="h-9 w-9" />}
            title={plan ? "Nothing planned for today" : "No meal plan yet"}
            body={plan ? `Your current plan starts ${plan.request.startDate}.` : "Set a budget and WellFed will plan your week around nutrition, prices and who's home."}
            action={<Button onClick={() => setGenOpen(true)}><CalendarPlus className="h-4 w-4" /> Plan meals</Button>}
          />
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Budget */}
        <Card className="p-5">
          <div className="eyebrow mb-3">This week&apos;s budget</div>
          {derived && plan ? (
            <div className="flex items-center gap-5">
              <Ring value={derived.budget.total} max={plan.request.budget} tone={derived.budget.overBy > 0 ? "tomato" : "forest"} size={116}>
                <div className="font-display tnum text-xl font-semibold">{money(derived.budget.total, { cents: false })}</div>
                <div className="text-[11px] text-ink-400">of {money(plan.request.budget, { cents: false })}</div>
              </Ring>
              <div className="space-y-2">
                <div>
                  <div className={`font-display tnum text-2xl font-semibold ${derived.budget.overBy > 0 ? "text-tomato" : "text-forest"}`}>
                    {derived.budget.overBy > 0 ? `${money(derived.budget.overBy)} over` : `${money(derived.budget.remaining)} left`}
                  </div>
                  <div className="text-xs text-ink-400">Estimated grocery spend</div>
                </div>
                <div className="tnum text-[13px] text-ink-600">
                  {money(derived.budget.perServing)} / serving · {money(derived.budget.perMeal)} / meal
                </div>
                {derived.list.estimateTotal > 0 && <Badge tone="gold">{Math.round(derived.budget.estimateShare * 100)}% from estimates</Badge>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-600">Weekly budget: <b>{money(data.settings.weeklyBudget)}</b>. Generate a plan to see spending.</p>
          )}
        </Card>

        {/* Nutrition */}
        <Card className="p-5">
          <div className="eyebrow mb-3">Today&apos;s nutrition</div>
          {todayNutrition && todayShare > 0 ? (
            <div className="space-y-3">
              {data.members.map((m, i) => {
                const n = todayNutrition.get(m.id);
                const t = memberTargets(m);
                if (!n) return (
                  <div key={m.id} className="flex items-center gap-2 text-[13px] text-ink-400"><Avatar member={m} idx={i} size={22} /> {m.name} isn&apos;t eating planned meals today</div>
                );
                return (
                  <div key={m.id}>
                    <div className="mb-1 flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-2 font-semibold"><Avatar member={m} idx={i} size={22} />{m.name}</span>
                      <span className="tnum text-ink-400">{Math.round(n.kcal)} / {Math.round(t.kcal * todayShare)} kcal · {Math.round(n.protein)}g protein</span>
                    </div>
                    <Bar value={n.kcal} max={t.kcal * todayShare} tone={n.kcal > t.kcal * todayShare * 1.2 ? "orange" : "forest"} />
                  </div>
                );
              })}
              <p className="text-[11px] text-ink-400">Targets scaled to the meals planned today ({Math.round(todayShare * 100)}% of a day).</p>
            </div>
          ) : (
            <p className="text-sm text-ink-600">Nutrition appears once today has planned meals.</p>
          )}
        </Card>
      </div>

      {/* Upcoming prep */}
      {tomorrows.length > 0 && (
        <section>
          <SectionTitle eyebrow="No. 2" title="Coming up tomorrow" />
          <div className="grid gap-2.5 md:grid-cols-2">
            {tomorrows.map((m) => {
              const r = data.recipeMap.get(m.recipeId);
              if (!r) return null;
              const total = r.prepMinutes + r.cookMinutes;
              const tip = r.tags.includes("slow-cooker") ? "Slow cooker: start in the morning" : r.tags.includes("make-ahead") ? "Make ahead tonight" : total >= 60 ? `Takes ${Math.round(total / 6) / 10} hours` : null;
              return (
                <Link key={m.id} href={`/recipes/view?id=${r.id}`} className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-cream-100 p-3">
                  <Timer className="h-5 w-5 text-orange" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-ink-400 uppercase">{MEAL_LABEL[m.mealType]}</div>
                    <div className="truncate font-semibold">{r.name}</div>
                    {tip && <div className="text-xs font-semibold text-orange-700">{tip}</div>}
                  </div>
                  <ArrowRight className="h-4 w-4 text-ink-300" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Deals */}
      <section>
        <SectionTitle eyebrow="No. 3" title="Notable deals" action={<Link href="/groceries?tab=deals" className="text-sm font-semibold text-orange-700">All deals →</Link>} />
        {deals.length ? (
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {deals.map(({ p, ing, d }) => (
              <div key={p.id} className="w-48 shrink-0 rounded-2xl border border-ink/10 bg-cream-100 p-3.5">
                <div className="flex items-center justify-between">
                  {d > 0 ? <Badge tone="orange">{Math.round(d * 100)}% off</Badge> : <Badge tone="forest">Sale</Badge>}
                  {p.source === "demo" && <Badge tone="tomato">DEMO</Badge>}
                </div>
                <div className="mt-2 line-clamp-2 text-[14px] leading-snug font-semibold">{p.productName}</div>
                <div className="mt-1 font-display tnum text-xl font-semibold text-forest">{money(p.price)}</div>
                <div className="tnum text-xs text-ink-400">{unitPriceLabel(p, ing!)} · {data.stores.find((s) => s.id === p.storeId)?.name ?? "Store"}</div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="flex items-center gap-3 p-4">
            <Tag className="h-6 w-6 shrink-0 text-orange" />
            <p className="text-sm text-ink-600">No current deals entered. Import this week&apos;s flyer or add sale prices under <Link className="font-semibold text-forest underline" href="/groceries?tab=deals">Groceries → Deals</Link>.</p>
          </Card>
        )}
      </section>

      <PlanGenerator open={genOpen} onClose={() => setGenOpen(false)} />
    </div>
  );
}

function Welcome() {
  return (
    <div className="rise mx-auto max-w-xl pt-6">
      <div className="stripes-h mb-6 h-2 w-24 rounded-full" />
      <div className="eyebrow">Welcome to WellFed</div>
      <h1 className="font-display text-[40px] leading-[1.05] font-semibold text-forest">Nutrition first.<br />Budget second.<br /><span className="text-orange italic">Convenience always.</span></h1>
      <p className="mt-4 text-[16px] leading-relaxed text-ink-600">
        Tell WellFed who you&apos;re feeding and what you can spend. It plans the week, totals the groceries using real package sizes, and shows exactly where every price comes from.
      </p>
      <div className="mt-6 grid gap-3">
        <Link href="/household?setup=1"><Button size="lg" className="w-full"><Users className="h-5 w-5" /> Set up your household</Button></Link>
        <Link href="/assistant"><Button size="lg" variant="outline" className="w-full"><Sparkles className="h-5 w-5" /> Or just ask: &ldquo;$90 for four people, five days&rdquo;</Button></Link>
      </div>
      <ul className="mt-8 space-y-2 text-[13px] text-ink-600">
        <li>• Everything is stored privately on this device — no account.</li>
        <li>• Nutrition comes from USDA FoodData Central, not guesses.</li>
        <li>• Prices are labeled: store price, flyer deal, or estimate.</li>
      </ul>
    </div>
  );
}
