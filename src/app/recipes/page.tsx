"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Heart, Plus, Search, Clock, Users } from "lucide-react";
import { useData } from "@/lib/data-context";
import { recipeNutrition } from "@/lib/engine/nutrition";
import { recipeCost } from "@/lib/engine/budget";
import { isSafeFor, recipeAllergens, ALLERGEN_LABEL } from "@/lib/engine/allergens";
import { Badge, Button, Chips, Input, PageHeader, money, cn } from "@/components/ui";
import type { MealType } from "@/lib/types";

type Filter = "favorites" | "safe" | "kid-friendly" | "quick" | "high-protein" | "vegetarian" | "budget" | "mine";

export default function RecipesPage() {
  const data = useData();
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filter[]>([]);
  const [meal, setMeal] = useState<MealType | "all">("all");

  const rows = useMemo(() => data.recipes.map((r) => {
    const n = recipeNutrition(r, data.ctx.lookup).perServing;
    const c = recipeCost(r, data.ctx);
    return { r, n, c, safe: isSafeFor(r, data.members, data.ctx.lookup), allergens: recipeAllergens(r, data.ctx.lookup) };
  }), [data]);

  const shown = rows.filter(({ r, safe, c }) => {
    const s = q.trim().toLowerCase();
    if (s && !(`${r.name} ${r.description} ${r.tags.join(" ")}`.toLowerCase().includes(s) || r.ingredients.some((l) => data.ingredientMap.get(l.ingredientId)?.name.toLowerCase().includes(s)))) return false;
    if (meal !== "all" && !r.mealTypes.includes(meal)) return false;
    for (const f of filters) {
      if (f === "favorites" && !r.favorite) return false;
      if (f === "safe" && !safe) return false;
      if (f === "quick" && r.prepMinutes + r.cookMinutes > 30) return false;
      if (f === "mine" && r.source === "builtin") return false;
      if (f === "budget" && c.perServing > 2.5) return false;
      if ((f === "kid-friendly" || f === "high-protein" || f === "vegetarian") && !r.tags.includes(f)) return false;
    }
    return true;
  }).sort((a, b) => Number(!!b.r.favorite) - Number(!!a.r.favorite) || Number(!!a.r.excluded) - Number(!!b.r.excluded) || a.r.name.localeCompare(b.r.name));

  return (
    <div className="rise">
      <PageHeader eyebrow="Section 4" title="Recipes" subtitle={`${data.recipes.length} recipes · nutrition from USDA data`} action={<Link href="/recipes/new"><Button><Plus className="h-4 w-4" /> New</Button></Link>} />
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-3 left-3 h-5 w-5 text-ink-300" />
        <Input className="pl-10" placeholder="Search recipes or ingredients" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
        {(["all", "breakfast", "lunch", "dinner", "snack"] as const).map((m) => (
          <button key={m} onClick={() => setMeal(m)} className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize", meal === m ? "bg-ink text-cream-100" : "bg-cream-200 text-ink-600")}>{m}</button>
        ))}
      </div>
      <Chips<Filter> className="mb-5" values={filters} onChange={setFilters} options={[
        { value: "favorites", label: "♥ Favorites" },
        { value: "safe", label: "Safe for everyone" },
        { value: "kid-friendly", label: "Kid-friendly" },
        { value: "quick", label: "≤ 30 min" },
        { value: "high-protein", label: "High protein" },
        { value: "vegetarian", label: "Vegetarian" },
        { value: "budget", label: "≤ $2.50/serving" },
        { value: "mine", label: "My recipes" },
      ]} />

      <div className="grid gap-3 md:grid-cols-2">
        {shown.map(({ r, n, c, safe, allergens }) => (
          <Link key={r.id} href={`/recipes/view?id=${encodeURIComponent(r.id)}`} className={cn("group rounded-[var(--radius-card)] border border-ink/10 bg-cream-100 p-4 shadow-[var(--shadow-card)] transition hover:border-ink/25", r.excluded && "opacity-55")}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-display text-[19px] leading-snug font-semibold group-hover:text-forest">{r.name}</div>
                <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-600">{r.description}</p>
              </div>
              {r.favorite && <Heart className="h-5 w-5 shrink-0 fill-orange text-orange" />}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 border-t border-ink/8 pt-3 text-center">
              <div><div className="tnum font-semibold">{Math.round(n.kcal)}</div><div className="text-[10px] font-bold tracking-wider text-ink-400 uppercase">kcal</div></div>
              <div><div className="tnum font-semibold">{Math.round(n.protein)}g</div><div className="text-[10px] font-bold tracking-wider text-ink-400 uppercase">protein</div></div>
              <div><div className="tnum font-semibold">{Math.round(n.fiber)}g</div><div className="text-[10px] font-bold tracking-wider text-ink-400 uppercase">fiber</div></div>
              <div><div className="tnum font-semibold">{c.unpriced.length ? "—" : money(c.perServing)}</div><div className="text-[10px] font-bold tracking-wider text-ink-400 uppercase">{c.estimated ? "est./srv" : "/serving"}</div></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-xs text-ink-400"><Clock className="h-3.5 w-3.5" />{r.prepMinutes + r.cookMinutes}m</span>
              <span className="mr-1 inline-flex items-center gap-1 text-xs text-ink-400"><Users className="h-3.5 w-3.5" />{r.servings}</span>
              {!safe && data.members.length > 0 && <Badge tone="tomato">Conflicts with household</Badge>}
              {r.excluded && <Badge tone="ink">Excluded</Badge>}
              {r.source !== "builtin" && <Badge tone="gold">{r.source === "ai" ? "AI-assisted" : "Yours"}</Badge>}
              {allergens.slice(0, 3).map((a) => <Badge key={a} tone="outline">{ALLERGEN_LABEL[a]}</Badge>)}
            </div>
          </Link>
        ))}
      </div>
      {shown.length === 0 && <p className="py-10 text-center text-ink-400">No recipes match.</p>}
    </div>
  );
}
