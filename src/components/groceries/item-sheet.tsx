"use client";

import { useState } from "react";
import type { MealPlan } from "@/lib/types";
import type { ShoppingItem } from "@/lib/engine/shopping";
import { useData } from "@/lib/data-context";
import { setShoppingOverride } from "@/lib/db/actions";
import { cheapestPurchase, isActive, SOURCE_LABEL, unitPriceLabel } from "@/lib/engine/pricing";
import { displayGrams } from "@/lib/engine/units";
import { Badge, Button, Field, Input, Sheet, Toggle, money, cn } from "../ui";
import { PriceStatusBadge, MEAL_LABEL } from "../bits";

export function packageText(item: ShoppingItem) {
  if (!item.purchase) return "";
  return item.purchase.picks.map((p) => `${p.count} × ${p.entry.productName}`).join(" + ");
}

export function ItemSheet({ plan, item, onClose }: { plan: MealPlan; item: ShoppingItem | null; onClose: () => void }) {
  const data = useData();
  const [actual, setActual] = useState("");
  const [forId, setForId] = useState<string | null>(null);
  const itemId = item?.ingredient.id ?? null;
  if (itemId !== forId) {
    setForId(itemId);
    setActual(item?.override.actualPrice != null ? String(item.override.actualPrice) : "");
  }
  if (!item) return null;
  const ing = item.ingredient;
  const ov = item.override;
  const set = (patch: Parameters<typeof setShoppingOverride>[2]) => setShoppingOverride(plan, ing.id, patch);

  // Best purchase at each store that has a price for this item, plus the estimate.
  const offers = data.prices.filter((p) => p.ingredientId === ing.id && isActive(p, data.today));
  const groups = new Map<string | null, typeof offers>();
  for (const o of offers) {
    const key = o.source === "estimate" ? null : o.storeId;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  const options = [...groups.entries()].map(([storeId, list]) => ({ storeId, purchase: cheapestPurchase(Math.max(item.toBuyGrams, 1), list, ing), list }));
  const pkgCount = item.purchase?.picks.reduce((s, p) => s + p.count, 0) ?? 0;

  return (
    <Sheet open={!!item} onClose={onClose} title={ing.name}>
      <div className="space-y-4 pb-3">
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-cream-200/70 p-3 text-center text-[13px]">
          <div><div className="text-[11px] font-bold text-ink-400 uppercase">Needed</div><div className="font-semibold">{displayGrams(item.neededGrams, ing)}</div></div>
          <div><div className="text-[11px] font-bold text-ink-400 uppercase">In pantry</div><div className="font-semibold">{item.pantryGrams > 0 ? displayGrams(item.pantryGrams, ing) : "—"}</div></div>
          <div><div className="text-[11px] font-bold text-ink-400 uppercase">Leftover</div><div className="font-semibold">{item.leftoverGrams > 1 ? displayGrams(item.leftoverGrams, ing) : "—"}</div></div>
        </div>

        <Toggle checked={!!ov.owned} onChange={(v) => set({ owned: v })} label="I already have this" hint="Removes it from the bill." />

        {item.purchase && (
          <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-cream-100 p-3">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">{packageText(item)}</div>
              <div className="text-xs text-ink-400">{money(item.cost)} · <PriceStatusBadge status={item.status} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="soft" aria-label="Fewer packages" onClick={() => set({ packages: Math.max(0, pkgCount - 1) })}>−</Button>
              <span className="font-display tnum w-6 text-center text-xl font-semibold">{pkgCount}</span>
              <Button size="icon" variant="soft" aria-label="More packages" onClick={() => set({ packages: pkgCount + 1 })}>+</Button>
            </div>
          </div>
        )}
        {ov.packages != null && <button className="-mt-2 text-xs font-semibold text-orange-700" onClick={() => set({ packages: undefined })}>Reset to calculated amount</button>}

        <div>
          <div className="mb-1.5 text-[13px] font-semibold text-ink-600">Buy at</div>
          <div className="space-y-1.5">
            {options.map(({ storeId, purchase, list }) => {
              const store = data.stores.find((s) => s.id === storeId);
              const chosen = item.storeId === storeId && item.purchase;
              const best = list.reduce((a, b) => (a.price / a.packageQty < b.price / b.packageQty ? a : b));
              return (
                <button key={storeId ?? "est"} onClick={() => set({ storeId, packages: undefined })} className={cn("flex w-full items-center gap-3 rounded-xl border-2 p-2.5 text-left", chosen ? "border-forest bg-forest-50" : "border-ink/10 bg-white/60")}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold">{store?.name ?? "Typical price (estimate)"}</div>
                    <div className="text-xs text-ink-400">{unitPriceLabel(best, ing)} · {SOURCE_LABEL[best.source]}{best.isSale ? " · sale" : ""}{best.endDate ? ` · until ${best.endDate}` : ""}</div>
                  </div>
                  <div className="tnum font-semibold">{purchase ? money(purchase.cost) : "—"}</div>
                </button>
              );
            })}
            {options.length === 0 && <p className="text-sm text-tomato">No prices for this item. Add one under Deals.</p>}
          </div>
        </div>

        <Field label="Actual price paid" hint="Track real spending against the plan.">
          <div className="flex gap-2">
            <Input inputMode="decimal" placeholder={item.cost ? item.cost.toFixed(2) : "0.00"} value={actual} onChange={(e) => setActual(e.target.value)} />
            <Button variant="soft" onClick={() => set({ actualPrice: actual === "" ? undefined : Number(actual) })}>Save</Button>
          </div>
        </Field>

        {item.uses.length > 0 && (
          <div>
            <div className="mb-1 text-[13px] font-semibold text-ink-600">Used in</div>
            <ul className="space-y-1 text-[13px] text-ink-600">
              {item.uses.map((u, i) => {
                const meal = plan.meals.find((m) => m.id === u.mealId);
                const r = data.recipeMap.get(u.recipeId);
                return (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{meal ? `${new Date(meal.date + "T12:00").toLocaleDateString(undefined, { weekday: "short" })} ${MEAL_LABEL[meal.mealType].toLowerCase()}` : ""} · {r?.name}</span>
                    <span className="tnum shrink-0 text-ink-400">{displayGrams(u.grams, ing)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {ing.staple && item.assumedOnHand && <Badge tone="ink">Pantry staple — assumed on hand (change in plan settings)</Badge>}
      </div>
    </Sheet>
  );
}
