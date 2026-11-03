"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShoppingCart, Plus, FileImage, Tag, Store as StoreIcon, Trash2, AlertTriangle, TrendingDown, ArrowRightLeft, Info, FlaskConical } from "lucide-react";
import { useData } from "@/lib/data-context";
import { usePlanDerived } from "@/lib/use-plan";
import { clearDemoData, deletePrice, loadDemoData, reducePlanToBudget, savePlan, setShoppingOverride } from "@/lib/db/actions";
import { discountPct, offerStatus, pricePerGram, SOURCE_LABEL, unitPriceLabel } from "@/lib/engine/pricing";
import { displayGrams } from "@/lib/engine/units";
import type { ShoppingItem } from "@/lib/engine/shopping";
import { Badge, Bar, BigCheck, Button, Card, Empty, Notice, PageHeader, SectionTitle, Segmented, Stat, money, cn } from "@/components/ui";
import { PriceStatusBadge, CATEGORY_LABEL } from "@/components/bits";
import { ItemSheet, packageText } from "@/components/groceries/item-sheet";
import { FlyerImport, PriceForm } from "@/components/groceries/deal-forms";
import { useToast } from "@/components/toast";
import { FlyerStatus } from "@/components/groceries/flyer-status";

type Tab = "list" | "deals" | "compare" | "budget";


export default function GroceriesPage() {
  return (
    <Suspense>
      <Groceries />
    </Suspense>
  );
}

function Groceries() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "list";
  return (
    <div className="rise">
      <PageHeader eyebrow="Section 3" title="Groceries" subtitle="Real package sizes, labeled prices, every deal checked by unit price." />
      <Segmented<Tab>
        className="mb-5 w-full md:w-auto"
        value={tab}
        onChange={(t) => router.replace(`/groceries?tab=${t}`, { scroll: false })}
        options={[{ value: "list", label: "List" }, { value: "deals", label: "Deals" }, { value: "compare", label: "Stores" }, { value: "budget", label: "Budget" }]}
      />
      {tab === "list" && <ListTab />}
      {tab === "deals" && <DealsTab />}
      {tab === "compare" && <CompareTab />}
      {tab === "budget" && <BudgetTab />}
    </div>
  );
}

function NoPlan() {
  return <Empty icon={<ShoppingCart className="h-9 w-9" />} title="No shopping list yet" body="Generate a meal plan and the list builds itself, with ingredients shared across recipes and your pantry subtracted." action={<Link href="/plan"><Button>Go to Meal Plan</Button></Link>} />;
}

function ListTab() {
  const data = useData();
  const plan = data.activePlan;
  const derived = usePlanDerived(plan);
  const [group, setGroup] = useState<"category" | "store">("category");
  const [selected, setSelected] = useState<string | null>(null);
  if (!plan || !derived) return <NoPlan />;
  const { list } = derived;
  const buy = list.items.filter((i) => i.status !== "on-hand" && i.status !== "owned");
  const have = list.items.filter((i) => i.status === "on-hand" || i.status === "owned");
  const checked = buy.filter((i) => i.override.checked).length;
  const groups = new Map<string, ShoppingItem[]>();
  for (const i of buy) {
    const k = group === "category" ? CATEGORY_LABEL[i.category] : (data.stores.find((s) => s.id === i.storeId)?.name ?? (i.status === "missing" ? "No price yet" : "Any store (estimated)"));
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  const selItem = list.items.find((i) => i.ingredient.id === selected) ?? null;

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Estimated" value={money(list.total)} sub={`${buy.length} items`} />
          <Stat label="Checked" value={`${checked}/${buy.length}`} sub={money(buy.filter((i) => i.override.checked).reduce((s, i) => s + i.cost, 0))} />
          <Stat label="Actual" value={list.actualCount ? money(list.actualTotal) : "—"} sub={list.actualCount ? `${list.actualCount} entered` : "enter at checkout"} />
        </div>
        <Bar className="mt-3" value={checked} max={Math.max(buy.length, 1)} />
        <div className="mt-3 flex gap-2">
          <Link href="/groceries/shop" className="flex-1"><Button className="w-full"><ShoppingCart className="h-4 w-4" /> Shopping mode</Button></Link>
          <Segmented size="sm" value={group} onChange={setGroup} options={[{ value: "category", label: "Aisle" }, { value: "store", label: "Store" }]} />
        </div>
      </Card>

      {list.estimateTotal > 0 && (
        <Notice icon={<Info className="h-4 w-4" />}>
          {money(list.estimateTotal)} of this total uses typical-price <b>estimates</b>, not current store prices. Add store prices or import a flyer under Deals to firm it up.
        </Notice>
      )}
      {list.demoTotal > 0 && <Notice tone="tomato" icon={<FlaskConical className="h-4 w-4" />}>{money(list.demoTotal)} comes from <b>fictional demo prices</b>. Clear them under Deals before relying on totals.</Notice>}
      {list.missing.length > 0 && <Notice tone="tomato" icon={<AlertTriangle className="h-4 w-4" />}>No price for {list.missing.map((i) => i.ingredient.name).join(", ")} — not included in the total.</Notice>}

      {[...groups.entries()].map(([name, items]) => (
        <section key={name}>
          <div className="eyebrow mb-2">{name}</div>
          <div className="divide-y divide-ink/8 overflow-hidden rounded-2xl border border-ink/10 bg-cream-100">
            {items.map((i) => (
              <div key={i.ingredient.id} className="flex items-center gap-3 px-3 py-2.5">
                <BigCheck checked={!!i.override.checked} label={i.ingredient.name} onChange={() => setShoppingOverride(plan, i.ingredient.id, { checked: !i.override.checked })} />
                <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(i.ingredient.id)}>
                  <div className={cn("font-semibold", i.override.checked && "text-ink-400 line-through")}>{i.ingredient.name}</div>
                  <div className="truncate text-xs text-ink-400">
                    Need {displayGrams(i.toBuyGrams, i.ingredient)}{i.purchase && ` · ${packageText(i)}`}
                    {i.pantryGrams > 0 && ` · ${displayGrams(i.pantryGrams, i.ingredient)} from pantry`}
                  </div>
                </button>
                <div className="text-right">
                  <div className="tnum font-semibold">{i.status === "missing" ? "—" : money(i.override.actualPrice ?? i.cost)}</div>
                  <PriceStatusBadge status={i.status} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {have.length > 0 && (
        <section>
          <div className="eyebrow mb-2">Already have</div>
          <div className="flex flex-wrap gap-1.5">
            {have.map((i) => (
              <button key={i.ingredient.id} onClick={() => setSelected(i.ingredient.id)} className="rounded-full bg-cream-200 px-3 py-1.5 text-[13px] text-ink-600">
                {i.ingredient.name}{i.assumedOnHand ? " (staple)" : i.status === "owned" ? " ✓" : " (pantry)"}
              </button>
            ))}
          </div>
        </section>
      )}
      <ItemSheet plan={plan} item={selItem} onClose={() => setSelected(null)} />
    </div>
  );
}

function DealsTab() {
  const data = useData();
  const toast = useToast();
  const [priceOpen, setPriceOpen] = useState(false);
  const params = useSearchParams();
  const router = useRouter();
  const importFor = params.get("import");
  const [flyerOpen, setFlyerOpen] = useState(!!importFor);
  const [flyerStore, setFlyerStore] = useState<string | undefined>(importFor ?? undefined);
  const openImport = (storeId?: string) => { setFlyerStore(storeId); setFlyerOpen(true); };
  const closeImport = () => { setFlyerOpen(false); if (importFor) router.replace("/groceries?tab=deals", { scroll: false }); };
  const [store, setStore] = useState<string>("all");
  const [show, setShow] = useState<"deals" | "all" | "expired">("deals");
  const hasDemo = data.dbPrices.some((p) => p.source === "demo");

  const rows = data.dbPrices
    .filter((p) => store === "all" || p.storeId === store)
    .filter((p) => {
      const st = offerStatus(p, data.today);
      if (show === "expired") return st === "expired";
      if (st === "expired") return false;
      return show === "all" || p.isSale;
    })
    .map((p) => {
      const ing = data.ingredientMap.get(p.ingredientId);
      return { p, ing, d: discountPct(p) };
    })
    .filter((x) => x.ing)
    .sort((a, b) => (b.d ?? 0) - (a.d ?? 0));

  // Lowest active unit price per ingredient across stores, to flag sales that aren't the best value.
  const bestPpg = new Map<string, number>();
  for (const p of data.dbPrices) {
    const ing = data.ingredientMap.get(p.ingredientId);
    if (!ing || offerStatus(p, data.today) !== "active") continue;
    const ppg = pricePerGram(p, ing);
    if (ppg != null && ppg < (bestPpg.get(p.ingredientId) ?? Infinity)) bestPpg.set(p.ingredientId, ppg);
  }
  const notBest = (p: (typeof data.dbPrices)[number]) => {
    const ing = data.ingredientMap.get(p.ingredientId);
    const ppg = ing ? pricePerGram(p, ing) : null;
    const best = bestPpg.get(p.ingredientId);
    return p.isSale && ppg != null && best != null && ppg > best * 1.02;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => openImport()}><FileImage className="h-4 w-4" /> Import flyer</Button>
        <Button variant="outline" onClick={() => setPriceOpen(true)}><Plus className="h-4 w-4" /> Add price</Button>
      </div>
      <FlyerStatus onImport={openImport} />
      <Card className="p-4 text-[13px] leading-relaxed text-ink-600">
        <div className="mb-1 flex items-center gap-2 font-semibold text-forest"><Info className="h-4 w-4" /> Where prices come from</div>
        None of Hannaford, Shaw&apos;s, Price Chopper/Market 32 or Aldi offer a public pricing API, and Walmart&apos;s product API is limited to approved affiliates. WellFed doesn&apos;t scrape or bypass store sites. Instead: photograph or download the weekly flyer and import it (AI reads it, you confirm every item), paste the flyer text (parsed offline), or type prices from the shelf or receipt. Anything else is shown as an <b>estimate</b>.
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented size="sm" value={show} onChange={setShow} options={[{ value: "deals", label: "Sales" }, { value: "all", label: "All prices" }, { value: "expired", label: "Expired" }]} />
        <select value={store} onChange={(e) => setStore(e.target.value)} className="h-9 rounded-full border border-ink/15 bg-white/70 px-3 text-sm" aria-label="Filter by store">
          <option value="all">All stores</option>
          {data.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty icon={<Tag className="h-9 w-9" />} title={show === "expired" ? "No expired deals" : "No deals entered"} body={show === "expired" ? undefined : "Import this week's flyer or add a sale price. Deals are matched to recipes when planning."} />
      ) : (
        <div className="space-y-2">
          {rows.map(({ p, ing, d }) => {
            const st = offerStatus(p, data.today);
            return (
              <div key={p.id} className={cn("rounded-2xl border border-ink/10 bg-cream-100 p-3", st === "expired" && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">{p.productName}</span>
                      {d != null && <Badge tone="orange">{Math.round(d * 100)}% off</Badge>}
                      {p.source === "demo" && <Badge tone="tomato">DEMO</Badge>}
                      {st === "upcoming" && <Badge tone="gold">Starts {p.startDate}</Badge>}
                      {st === "expired" && <Badge tone="ink">Expired</Badge>}
                      {st === "active" && notBest(p) && <Badge tone="tomato" title="Another store's regular price is cheaper per unit">Not the best unit price</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-400">
                      {data.stores.find((s) => s.id === p.storeId)?.name ?? "Store"} · {ing!.name} · {p.packageQty} {p.packageUnit === "each" ? "ct" : p.packageUnit}
                      {p.endDate && ` · through ${p.endDate}`}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone="outline">{SOURCE_LABEL[p.source]}</Badge>
                      {p.loyaltyRequired && <Badge tone="gold">Card price</Badge>}
                      {p.couponRequired && <Badge tone="gold">Coupon</Badge>}
                      {p.promoNotes && <Badge tone="ink">{p.promoNotes}</Badge>}
                      {p.verifiedAt && <span className="text-[11px] text-ink-300">checked {new Date(p.verifiedAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display tnum text-xl font-semibold text-forest">{money(p.price)}</div>
                    {p.regularPrice && <div className="tnum text-xs text-ink-400 line-through">{money(p.regularPrice)}</div>}
                    <div className="tnum text-xs font-semibold text-ink-600">{unitPriceLabel(p, ing!)}</div>
                  </div>
                  <button aria-label="Delete price" onClick={() => deletePrice(p.id)} className="rounded-full p-1.5 text-ink-300 hover:bg-tomato-100 hover:text-tomato"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card className="space-y-2 p-4">
        <div className="flex items-center gap-2 font-semibold"><FlaskConical className="h-4 w-4 text-orange" /> Demonstration data</div>
        <p className="text-[13px] text-ink-600">Load two <b>fictional</b> stores with invented sale prices to try deal matching and store comparison. Always labeled DEMO; never mixed up with real prices.</p>
        {hasDemo
          ? <Button variant="danger" size="sm" onClick={async () => { await clearDemoData(); toast("Demo data removed"); }}>Remove demo data</Button>
          : <Button variant="soft" size="sm" onClick={async () => { await loadDemoData(); toast("Demo stores loaded"); }}>Load demo deals</Button>}
      </Card>

      <PriceForm open={priceOpen} onClose={() => setPriceOpen(false)} />
      <FlyerImport open={flyerOpen} onClose={closeImport} initialStoreId={flyerStore} />
    </div>
  );
}

function CompareTab() {
  const data = useData();
  const plan = data.activePlan;
  const derived = usePlanDerived(plan);
  if (!plan || !derived) return <NoPlan />;
  const c = derived.comparison;
  const storeName = (id: string) => data.stores.find((s) => s.id === id)?.name ?? id;
  const dist = (id: string) => data.stores.find((s) => s.id === id)?.distanceKm;

  if (!c.single.length)
    return (
      <Empty
        icon={<StoreIcon className="h-9 w-9" />}
        title="No store prices to compare"
        body="Comparisons use store-specific prices only. Add stores under Household, then import a flyer or enter prices."
        action={<Link href="/household?tab=stores"><Button variant="soft">Set up stores</Button></Link>}
      />
    );

  return (
    <div className="space-y-4">
      <Notice icon={<Info className="h-4 w-4" />}>Each store total uses that store&apos;s saved prices; items it has no price for fall back to estimates, so the comparison only reflects items with real prices.</Notice>
      <SectionTitle eyebrow="One store" title="Cheapest single-store trip" />
      <div className="space-y-2">
        {c.single.map((s, idx) => (
          <Card key={s.storeId} className={cn("flex items-center gap-3 p-3.5", idx === 0 && "ring-2 ring-forest/30")}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold">{storeName(s.storeId)} {idx === 0 && <Badge tone="forest">Cheapest</Badge>}</div>
              <div className="text-xs text-ink-400">{s.pricedAtStore} items priced here · {s.fallback} estimated or missing{dist(s.storeId) != null && ` · ${(dist(s.storeId)! / 1.609).toFixed(1)} mi away (straight line)`}</div>
            </div>
            <div className="font-display tnum text-xl font-semibold">{money(s.total)}</div>
          </Card>
        ))}
      </div>

      <SectionTitle eyebrow="Several stores" title={`Best plan with up to ${data.settings.maxStores} stores`} />
      {c.bestMulti ? (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold"><ArrowRightLeft className="h-4 w-4 text-orange" /> {c.bestMulti.storeIds.map(storeName).join(" + ")}</div>
            <div className="font-display tnum text-xl font-semibold">{money(c.bestMulti.total)}</div>
          </div>
          <div className="mt-2 text-sm text-forest">Saves <b>{money(c.multiSavings)}</b> vs. the cheapest single store.</div>
          {(() => {
            const d = c.bestMulti.storeIds.map(dist);
            return d.every((x) => x != null) ? <div className="mt-1 text-xs text-ink-400">Stores are {d.map((x) => (x! / 1.609).toFixed(1)).join(" and ")} mi from your ZIP (straight line). Driving distance isn&apos;t calculated — no routing service is used.</div> : <div className="mt-1 text-xs text-ink-400">Add stores via ZIP search to see distances.</div>;
          })()}
        </Card>
      ) : (
        <p className="text-sm text-ink-600">Shopping one store is already cheapest with the prices you have{data.settings.maxStores < 2 ? " (max stores per trip is 1)" : ""}.</p>
      )}
      {c.unpriced.length > 0 && <Notice tone="tomato">No price anywhere for: {c.unpriced.join(", ")}.</Notice>}
      {plan.request.storeId && <p className="text-xs text-ink-400">This plan was built for one store. The list uses that store; comparisons still look at all stores.</p>}
    </div>
  );
}

function BudgetTab() {
  const data = useData();
  const toast = useToast();
  const plan = data.activePlan;
  const derived = usePlanDerived(plan);
  const [busy, setBusy] = useState(false);
  if (!plan || !derived) return <NoPlan />;
  const b = derived.budget;
  const byRecipe = [...b.byMeal].sort((x, y) => y.cost - x.cost);
  const maxMeal = Math.max(...byRecipe.map((x) => x.cost), 1);

  async function applySub(fromId: string, toId: string) {
    await savePlan({ ...plan!, substitutions: { ...(plan!.substitutions ?? {}), [fromId]: toId } });
    toast(`Using ${data.ingredientMap.get(toId)?.name} instead of ${data.ingredientMap.get(fromId)?.name}`);
  }
  async function removeSub(fromId: string) {
    const s = { ...(plan!.substitutions ?? {}) };
    delete s[fromId];
    await savePlan({ ...plan!, substitutions: s });
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Budget" value={money(b.budget)} />
          <Stat label="Estimated" value={money(b.total)} tone={b.overBy > 0 ? "tomato" : undefined} />
          <Stat label={b.overBy > 0 ? "Over" : "Remaining"} value={money(b.overBy > 0 ? b.overBy : b.remaining)} tone={b.overBy > 0 ? "tomato" : "forest"} />
          <Stat label="Per serving" value={money(b.perServing)} sub={`${money(b.perMeal)} per meal`} />
        </div>
        <Bar className="mt-4" value={b.total} max={b.budget} tone={b.overBy > 0 ? "tomato" : "forest"} />
        <div className="mt-2 flex justify-between text-xs text-ink-400">
          <span>{b.servings} servings · {b.meals} meals</span>
          <span>Leftover food value ≈ {money(b.leftoverValue)}</span>
        </div>
        {b.overBy > 0 && (
          <Button variant="accent" className="mt-4 w-full" loading={busy} onClick={async () => { setBusy(true); await new Promise((r) => setTimeout(r, 30)); const r = await reducePlanToBudget(plan, data.ctx, data.settings.schedule); setBusy(false); toast(r.changes.length ? `Swapped ${r.changes.length} meals · now ${money(r.cost)}` : "No cheaper safe swaps found", r.changes.length ? "ok" : "error"); }}>
            <TrendingDown className="h-4 w-4" /> Reduce to budget
          </Button>
        )}
        {derived.list.actualCount > 0 && (
          <div className="mt-4 rounded-2xl bg-cream-200/70 p-3 text-[13px]">
            <b>Planned vs. actual:</b> {derived.list.actualCount} items entered, spent {money(derived.list.actualTotal)} vs. planned {money(derived.list.items.filter((i) => i.override.actualPrice != null).reduce((s, i) => s + i.cost, 0))}.
          </div>
        )}
      </Card>

      <section>
        <SectionTitle eyebrow="Savings" title="Cheaper substitutions" />
        {Object.keys(plan.substitutions ?? {}).length > 0 && (
          <div className="mb-3 space-y-1.5">
            {Object.entries(plan.substitutions!).map(([from, to]) => (
              <div key={from} className="flex items-center justify-between rounded-xl bg-forest-50 px-3 py-2 text-sm">
                <span>Using <b>{data.ingredientMap.get(to)?.name}</b> instead of {data.ingredientMap.get(from)?.name}</span>
                <button className="text-xs font-semibold text-orange-700" onClick={() => removeSub(from)}>Undo</button>
              </div>
            ))}
          </div>
        )}
        {derived.substitutions.length ? (
          <div className="space-y-2">
            {derived.substitutions.map((s) => (
              <Card key={s.fromId + s.toId} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{s.fromName} → {s.toName}</div>
                  <div className="text-xs text-ink-400">
                    Save ≈ {money(s.savings)} · protein {s.proteinDelta >= 0 ? "+" : ""}{Math.round(s.proteinDelta)}g across the plan · {s.note}
                  </div>
                </div>
                <Button size="sm" variant="soft" onClick={() => applySub(s.fromId, s.toId)}>Apply</Button>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-600">No cheaper like-for-like swaps right now.</p>
        )}
      </section>

      <section>
        <SectionTitle eyebrow="Breakdown" title="Cost by meal" />
        <div className="space-y-2">
          {byRecipe.map((m) => {
            const meal = plan.meals.find((x) => x.id === m.mealId)!;
            return (
              <div key={m.mealId}>
                <div className="flex justify-between text-[13px]">
                  <span className="truncate pr-2">{new Date(meal.date + "T12:00").toLocaleDateString(undefined, { weekday: "short" })} · {data.recipeMap.get(m.recipeId)?.name}</span>
                  <span className="tnum shrink-0 text-ink-600">{money(m.cost)} <span className="text-ink-400">({money(m.perServing)}/srv)</span></span>
                </div>
                <Bar value={m.cost} max={maxMeal} tone="gold" />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-ink-400">Meal costs count only what each meal uses; unused package remainder is the leftover value above.</p>
      </section>

      {b.byStore.length > 0 && (
        <section>
          <SectionTitle eyebrow="Breakdown" title="Cost by store" />
          <div className="space-y-1.5">
            {b.byStore.map((s) => (
              <div key={s.storeId ?? "est"} className="flex justify-between rounded-xl bg-cream-100 px-3 py-2 text-sm">
                <span>{s.storeId ? data.stores.find((x) => x.id === s.storeId)?.name : "Estimated (no store)"} · {s.count} items</span>
                <span className="tnum font-semibold">{money(s.total)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
