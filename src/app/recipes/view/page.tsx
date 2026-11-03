"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Heart, Ban, Star, Trash2, Pencil, AlertTriangle, Minus, Plus, Clock, Snowflake, Repeat, Copy } from "lucide-react";
import { useData } from "@/lib/data-context";
import { recipeNutrition, scaleRecipe } from "@/lib/engine/nutrition";
import { recipeCost } from "@/lib/engine/budget";
import { findConflicts, recipeAllergens, recipeDiets, ALLERGEN_LABEL, DIET_LABEL } from "@/lib/engine/allergens";
import { formatAmount } from "@/lib/engine/units";
import { deleteRecipe, saveRecipe, setRecipeMeta } from "@/lib/db/actions";
import { uid } from "@/lib/db/defaults";
import { mealServings } from "@/lib/engine/shopping";
import { Badge, Button, Card, Empty, Notice, money, cn } from "@/components/ui";
import { Avatar, NutritionFacts } from "@/components/bits";
import { useToast } from "@/components/toast";

export default function RecipeViewPage() {
  return (
    <Suspense>
      <RecipeView />
    </Suspense>
  );
}

function RecipeView() {
  const params = useSearchParams();
  const router = useRouter();
  const data = useData();
  const toast = useToast();
  const id = params.get("id") ?? "";
  const recipe = data.recipeMap.get(id);
  const plan = params.get("plan") ? data.plans.find((p) => p.id === params.get("plan")) : null;
  const meal = plan?.meals.find((m) => m.id === params.get("meal"));
  const planServings = meal ? mealServings(meal, data.members) : null;
  const [servings, setServings] = useState<number | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const s = servings ?? (planServings ? Math.max(1, Math.round(planServings * 2) / 2) : recipe?.servings ?? 4);
  const subs = plan?.substitutions;

  const derived = useMemo(() => {
    if (!recipe) return null;
    const scaled = scaleRecipe(recipe, s);
    return {
      scaled,
      nutrition: recipeNutrition(recipe, data.ctx.lookup, subs),
      cost: recipeCost(scaled, data.ctx, { substitutions: subs, includeStaples: true }),
      allergens: recipeAllergens(recipe, data.ctx.lookup, subs),
      diets: recipeDiets(recipe, data.ctx.lookup, subs),
      conflicts: findConflicts(recipe, data.members, data.ctx.lookup, subs),
    };
  }, [recipe, s, data, subs]);

  if (!recipe || !derived) return <Empty title="Recipe not found" action={<Link href="/recipes"><Button>All recipes</Button></Link>} />;
  const builtin = recipe.source === "builtin";
  const { nutrition: n, cost } = derived;

  async function duplicate() {
    const copy = { ...recipe!, id: uid("r"), name: `${recipe!.name} (my version)`, source: "user" as const, favorite: false, ratings: {}, createdAt: undefined };
    await saveRecipe(copy);
    router.push(`/recipes/new?edit=${copy.id}`);
  }

  return (
    <div className="rise pb-6">
      <button onClick={() => router.back()} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-600"><ArrowLeft className="h-4 w-4" /> Back</button>
      <div className="eyebrow">{recipe.mealTypes.join(" · ")}</div>
      <h1 className="font-display text-[32px] leading-[1.08] font-semibold text-forest md:text-[40px]">{recipe.name}</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-ink-600">{recipe.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="ink"><Clock className="h-3 w-3" /> {recipe.prepMinutes} prep + {recipe.cookMinutes} cook</Badge>
        <Badge tone="ink">{recipe.difficulty}</Badge>
        {derived.diets.filter((d) => ["vegetarian", "vegan", "gluten-free", "dairy-free"].includes(d)).map((d) => <Badge key={d} tone="forest">{DIET_LABEL[d]}</Badge>)}
        {recipe.tags.filter((t) => !["vegetarian", "vegan", "gluten-free", "dairy-free"].includes(t)).map((t) => <Badge key={t} tone="outline">{t}</Badge>)}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant={recipe.favorite ? "accent" : "soft"} onClick={() => setRecipeMeta(recipe.id, { favorite: !recipe.favorite }, builtin)}><Heart className={cn("h-4 w-4", recipe.favorite && "fill-current")} /> {recipe.favorite ? "Favorite" : "Save"}</Button>
        <Button size="sm" variant="soft" onClick={() => { setRecipeMeta(recipe.id, { excluded: !recipe.excluded }, builtin); toast(recipe.excluded ? "Recipe can be planned again" : "Won't be planned"); }}><Ban className="h-4 w-4" /> {recipe.excluded ? "Allow in plans" : "Exclude"}</Button>
        {builtin ? <Button size="sm" variant="soft" onClick={duplicate}><Copy className="h-4 w-4" /> Customize</Button> : <Link href={`/recipes/new?edit=${recipe.id}`}><Button size="sm" variant="soft"><Pencil className="h-4 w-4" /> Edit</Button></Link>}
        {!builtin && <Button size="sm" variant="danger" onClick={async () => { if (confirm("Delete this recipe?")) { await deleteRecipe(recipe.id); router.push("/recipes"); } }}><Trash2 className="h-4 w-4" /></Button>}
      </div>

      {derived.conflicts.filter((c) => c.kind !== "dislike").length > 0 && (
        <Notice tone="tomato" className="mt-4" icon={<AlertTriangle className="h-4 w-4" />}>
          {derived.conflicts.filter((c) => c.kind !== "dislike").map((c, i) => (
            <div key={i}><b>{c.memberName}:</b> {c.ingredientName} — {c.detail}{c.optionalOnly ? ". It's optional: leave it out." : ""}</div>
          ))}
        </Notice>
      )}
      {recipe.unmatchedIngredients?.length ? <Notice className="mt-3">Unverified ingredients (no USDA match, not in nutrition or allergen checks): {recipe.unmatchedIngredients.join(", ")}.</Notice> : null}
      {subs && Object.keys(subs).some((k) => recipe.ingredients.some((l) => l.ingredientId === k)) && <Notice tone="forest" className="mt-3">This plan substitutes {Object.entries(subs).filter(([k]) => recipe.ingredients.some((l) => l.ingredientId === k)).map(([k, v]) => `${data.ingredientMap.get(v)?.name} for ${data.ingredientMap.get(k)?.name}`).join(", ")}.</Notice>}

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-display text-xl font-semibold text-forest">Ingredients</div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="soft" aria-label="Fewer servings" onClick={() => setServings(Math.max(0.5, s - (s > 2 ? 1 : 0.5)))}><Minus className="h-4 w-4" /></Button>
                <div className="w-20 text-center"><div className="font-display tnum text-xl font-semibold">{s}</div><div className="text-[10px] font-bold text-ink-400 uppercase">servings</div></div>
                <Button size="icon" variant="soft" aria-label="More servings" onClick={() => setServings(s + (s >= 2 ? 1 : 0.5))}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            {planServings && <p className="mb-2 text-xs text-ink-400">Scaled for this meal&apos;s eaters ({planServings} standard servings).</p>}
            <ul className="divide-y divide-ink/8">
              {derived.scaled.ingredients.map((l, i) => {
                const ing = data.ingredientMap.get(subs?.[l.ingredientId] ?? l.ingredientId);
                return (
                  <li key={i} className="flex items-baseline justify-between gap-3 py-2 text-[15px]">
                    <span>
                      {ing?.name ?? l.ingredientId}
                      {l.note && <span className="text-ink-400">, {l.note}</span>}
                      {l.optional && <span className="text-ink-400"> (optional)</span>}
                    </span>
                    <span className="tnum shrink-0 font-semibold text-ink-600">{formatAmount(l.qty, l.unit, ing)}</span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div>
            <div className="font-display mb-3 text-xl font-semibold text-forest">Method</div>
            <ol className="space-y-3">
              {recipe.steps.map((step, i) => (
                <li key={i}>
                  <button onClick={() => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))} className={cn("flex w-full gap-3 text-left transition", done.includes(i) && "opacity-45")}>
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display font-semibold", done.includes(i) ? "bg-forest text-cream-100" : "bg-orange-100 text-orange-700")}>{i + 1}</span>
                    <span className={cn("pt-1 text-[15.5px] leading-relaxed", done.includes(i) && "line-through")}>{step}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-4"><div className="mb-1 flex items-center gap-2 font-semibold"><Snowflake className="h-4 w-4 text-forest" /> Storage</div><p className="text-sm text-ink-600">{recipe.storage}</p></Card>
            <Card className="p-4"><div className="mb-1 flex items-center gap-2 font-semibold"><Repeat className="h-4 w-4 text-forest" /> Leftovers</div><p className="text-sm text-ink-600">{recipe.leftovers}</p></Card>
          </div>

          {data.members.length > 0 && (
            <Card className="p-4">
              <div className="mb-2 font-semibold">Family ratings</div>
              <div className="space-y-2">
                {data.members.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <Avatar member={m} idx={i} size={26} />
                    <span className="flex-1 text-sm font-semibold">{m.name}</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button key={v} aria-label={`${v} stars`} onClick={() => setRecipeMeta(recipe.id, { rating: { memberId: m.id, value: v } }, builtin)} className="p-0.5">
                          <Star className={cn("h-5 w-5", (recipe.ratings?.[m.id] ?? 0) >= v ? "fill-gold text-gold" : "text-ink-300")} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-400">Ratings nudge the planner toward meals your family likes.</p>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <div className="eyebrow mb-2">Cost</div>
            {cost.unpriced.length ? <p className="text-sm text-tomato">No price for: {cost.unpriced.join(", ")}</p> : (
              <>
                <div className="flex items-baseline justify-between"><span className="text-sm text-ink-600">Per serving</span><span className="font-display tnum text-2xl font-semibold">{money(cost.usedCost / s)}</span></div>
                <div className="flex items-baseline justify-between text-sm"><span className="text-ink-600">Ingredients used ({s} srv)</span><span className="tnum font-semibold">{money(cost.usedCost)}</span></div>
                <div className="flex items-baseline justify-between text-sm"><span className="text-ink-600">Buying full packages</span><span className="tnum font-semibold">{money(cost.packageCost)}</span></div>
                <p className="mt-2 text-[11px] text-ink-400">{cost.estimated ? "Includes estimated prices. " : ""}Cheapest known price per ingredient; staples included.</p>
              </>
            )}
          </Card>
          <NutritionFacts n={n.perServing} servingLabel={`1 of ${recipe.servings} (standard adult portion)`} incomplete={n.incomplete} sugarComplete={n.addedSugarComplete} />
          {derived.allergens.length > 0 && (
            <div>
              <div className="text-xs font-bold">Contains: {derived.allergens.map((a) => ALLERGEN_LABEL[a]).join(", ")}</div>
              <p className="text-[11px] text-ink-400">From the ingredient catalog. Always check product labels for cross-contact.</p>
            </div>
          )}
          {data.members.length > 0 && (
            <Card className="p-4">
              <div className="eyebrow mb-2">Portions</div>
              <PortionTable recipeId={recipe.id} mealAttendees={meal?.attendees} overrides={meal?.portionOverrides} />
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function PortionTable({ recipeId, mealAttendees, overrides }: { recipeId: string; mealAttendees?: string[]; overrides?: Record<string, number> }) {
  const data = useData();
  const recipe = data.recipeMap.get(recipeId)!;
  const per = recipeNutrition(recipe, data.ctx.lookup).perServing;
  const people = data.members.filter((m) => !mealAttendees || mealAttendees.includes(m.id));
  return (
    <div className="space-y-1.5 text-[13px]">
      {people.map((m) => {
        const f = overrides?.[m.id] ?? mealServings({ attendees: [m.id] }, data.members);
        return (
          <div key={m.id} className="flex justify-between">
            <span className="font-semibold">{m.name}</span>
            <span className="tnum text-ink-600">{f}× · {Math.round(per.kcal * f)} kcal · {Math.round(per.protein * f)}g protein</span>
          </div>
        );
      })}
    </div>
  );
}
