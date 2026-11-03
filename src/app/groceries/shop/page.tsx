"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X, Check, WifiOff, RotateCcw } from "lucide-react";
import { useData } from "@/lib/data-context";
import { usePlanDerived } from "@/lib/use-plan";
import { savePlan, setShoppingOverride } from "@/lib/db/actions";
import { displayGrams } from "@/lib/engine/units";
import type { ShoppingItem } from "@/lib/engine/shopping";
import { Bar, Button, Empty, Segmented, money, cn } from "@/components/ui";
import { packageText } from "@/components/groceries/item-sheet";
import { CATEGORY_LABEL } from "@/components/bits";

/** Distraction-free, thumb-sized checklist for the store aisle. Works offline. */
export default function ShoppingMode() {
  const data = useData();
  const plan = data.activePlan;
  const derived = usePlanDerived(plan);
  const [online, setOnline] = useState(true);
  const [storeFilter, setStoreFilter] = useState<string>("all");

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    // Keep the screen awake while shopping where supported.
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      lock?.release().catch(() => {});
    };
  }, []);

  if (!plan || !derived) return <div className="pt-10"><Empty title="No list yet" action={<Link href="/plan"><Button>Plan meals</Button></Link>} /></div>;
  const items = derived.list.items.filter((i) => i.status !== "on-hand" && i.status !== "owned");
  const stores = [...new Set(items.map((i) => i.storeId ?? "none"))];
  const shown = items.filter((i) => storeFilter === "all" || (i.storeId ?? "none") === storeFilter);
  const done = shown.filter((i) => i.override.checked).length;
  const todo = shown.filter((i) => !i.override.checked);
  const groups = new Map<string, ShoppingItem[]>();
  for (const i of todo) groups.set(CATEGORY_LABEL[i.category], [...(groups.get(CATEGORY_LABEL[i.category]) ?? []), i]);
  const inCart = shown.filter((i) => i.override.checked);

  const toggle = (i: ShoppingItem) => {
    if (navigator.vibrate) navigator.vibrate(10);
    setShoppingOverride(plan, i.ingredient.id, { checked: !i.override.checked });
  };
  const reset = async () => {
    if (!confirm("Uncheck everything?")) return;
    const shopping = Object.fromEntries(Object.entries(plan.shopping).map(([k, v]) => [k, { ...v, checked: false }]));
    await savePlan({ ...plan, shopping });
  };

  return (
    <div className="pt-[calc(8px+var(--safe-top))]">
      <div className="sticky top-0 z-20 -mx-4 bg-cream/95 px-4 pt-2 pb-3 backdrop-blur md:mx-0">
        <div className="flex items-center justify-between">
          <Link href="/groceries" aria-label="Exit shopping mode" className="flex h-11 w-11 items-center justify-center rounded-full bg-cream-200"><X className="h-6 w-6" /></Link>
          <div className="text-center">
            <div className="font-display text-xl font-semibold text-forest">Shopping</div>
            <div className="tnum text-xs text-ink-400">{done} of {shown.length} · est. {money(shown.reduce((s, i) => s + i.cost, 0))}</div>
          </div>
          <button aria-label="Reset checks" onClick={reset} className="flex h-11 w-11 items-center justify-center rounded-full bg-cream-200"><RotateCcw className="h-5 w-5" /></button>
        </div>
        <Bar className="mt-3 h-2.5" value={done} max={Math.max(shown.length, 1)} />
        {!online && <div className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-ink-600"><WifiOff className="h-3.5 w-3.5" /> Offline — checks are saved on this phone</div>}
        {stores.length > 1 && (
          <div className="no-scrollbar mt-3 overflow-x-auto">
            <Segmented size="sm" value={storeFilter} onChange={setStoreFilter} options={[{ value: "all", label: "All" }, ...stores.map((s) => ({ value: s, label: data.stores.find((x) => x.id === s)?.name ?? "Any store" }))]} />
          </div>
        )}
      </div>

      {todo.length === 0 && (
        <div className="rise flex flex-col items-center py-16 text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-forest text-cream-100"><Check className="h-9 w-9" strokeWidth={3} /></div>
          <div className="font-display text-2xl font-semibold text-forest">All done!</div>
          <p className="mt-1 text-sm text-ink-600">Enter what you actually paid on the list to track spending.</p>
          <Link href="/groceries" className="mt-4"><Button variant="soft">Back to list</Button></Link>
        </div>
      )}

      {[...groups.entries()].map(([name, list]) => (
        <section key={name} className="mt-4">
          <div className="eyebrow mb-2">{name}</div>
          <div className="space-y-2">
            {list.map((i) => (
              <button key={i.ingredient.id} onClick={() => toggle(i)} className="flex min-h-[68px] w-full items-center gap-4 rounded-2xl border-2 border-ink/10 bg-cream-100 px-4 py-3 text-left active:scale-[0.99]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[3px] border-ink/30 bg-white" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[18px] leading-tight font-semibold">{i.ingredient.name}</span>
                  <span className="block text-[14px] text-ink-600">{i.purchase ? packageText(i) : displayGrams(i.toBuyGrams, i.ingredient)}</span>
                </span>
                <span className="tnum text-[15px] font-semibold text-ink-600">{i.cost ? money(i.cost) : ""}</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {inCart.length > 0 && (
        <section className="mt-6 pb-8">
          <div className="eyebrow mb-2">In the cart</div>
          <div className="space-y-1.5">
            {inCart.map((i) => (
              <button key={i.ingredient.id} onClick={() => toggle(i)} className={cn("flex w-full items-center gap-4 rounded-2xl px-4 py-2.5 text-left text-ink-400")}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest text-cream-100"><Check className="h-5 w-5" strokeWidth={3} /></span>
                <span className="flex-1 text-[16px] line-through">{i.ingredient.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
