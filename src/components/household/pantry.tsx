"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Snowflake, Refrigerator, Package, Trash2, Plus } from "lucide-react";
import type { StorageLocation, Unit } from "@/lib/types";
import { useData } from "@/lib/data-context";
import { deletePantryItem, savePantryItem } from "@/lib/db/actions";
import { IngredientPicker } from "../ingredient-picker";
import { Badge, Button, Card, Empty, Field, Input, Segmented, Select } from "../ui";
import { canConvert, formatAmount } from "@/lib/engine/units";
import { addDays } from "@/lib/engine/planner";
import { useToast } from "../toast";

const LOC_ICON = { pantry: Package, fridge: Refrigerator, freezer: Snowflake };
const UNITS: Unit[] = ["each", "lb", "oz", "g", "kg", "cup", "tbsp", "tsp", "floz", "ml", "l"];

export function Pantry() {
  const data = useData();
  const toast = useToast();
  const [ing, setIng] = useState<string[]>([]);
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState<Unit>("lb");
  const [loc, setLoc] = useState<StorageLocation>("pantry");
  const [exp, setExp] = useState("");
  const soon = addDays(data.today, 4);
  const sel = ing[0] ? data.ingredientMap.get(ing[0]) : undefined;

  const items = [...data.pantry].sort((a, b) => (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999"));

  const suggestions = useMemo(() => {
    const have = new Set(data.pantry.map((p) => p.ingredientId));
    const expiring = new Set(data.pantry.filter((p) => p.expiresOn && p.expiresOn <= soon).map((p) => p.ingredientId));
    if (!have.size) return [];
    return data.recipes
      .filter((r) => !r.excluded)
      .map((r) => {
        const core = r.ingredients.filter((l) => !data.ingredientMap.get(l.ingredientId)?.staple);
        const hits = core.filter((l) => have.has(l.ingredientId));
        const exp = core.filter((l) => expiring.has(l.ingredientId)).length;
        return { r, hits: hits.length, share: hits.length / Math.max(core.length, 1), exp };
      })
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.exp - a.exp || b.share - a.share)
      .slice(0, 6);
  }, [data.pantry, data.recipes, data.ingredientMap, soon]);

  async function add() {
    if (!sel) return toast("Pick an ingredient", "error");
    const q = Number(qty);
    if (!(q > 0)) return toast("Enter a quantity", "error");
    if (!canConvert(unit, sel)) return toast(`Can't measure ${sel.name} in ${unit} — try weight`, "error");
    await savePantryItem({ ingredientId: sel.id, qty: q, unit, location: loc, expiresOn: exp || undefined });
    toast(`Added ${sel.name}`);
    setIng([]);
    setQty("1");
    setExp("");
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-4">
        <div className="font-display text-lg font-semibold text-forest">Add to pantry</div>
        <IngredientPicker
          single
          selected={ing}
          onChange={(v) => {
            setIng(v);
            const i = v[0] ? data.ingredientMap.get(v[0]) : undefined;
            if (i) {
              setUnit(i.shopUnit === "floz" ? "cup" : i.shopUnit);
              setLoc(["meat", "seafood", "dairy", "eggs", "produce"].includes(i.category) ? "fridge" : i.category === "frozen" ? "freezer" : "pantry");
            }
          }}
          placeholder="What do you have? (e.g. chicken, rice)"
        />
        <div className="grid grid-cols-[80px_1fr] gap-2">
          <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity" />
          <Select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} aria-label="Unit">
            {UNITS.filter((u) => !sel || canConvert(u, sel)).map((u) => <option key={u} value={u}>{u === "each" ? sel?.eachLabel ?? "each" : u}</option>)}
          </Select>
        </div>
        <Segmented className="w-full" size="sm" value={loc} onChange={setLoc} options={[{ value: "pantry", label: "Pantry" }, { value: "fridge", label: "Fridge" }, { value: "freezer", label: "Freezer" }]} />
        <Field label="Use by (optional)"><Input type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></Field>
        <Button className="w-full" onClick={add}><Plus className="h-4 w-4" /> Add</Button>
      </Card>

      {items.length ? (
        <div className="space-y-2">
          {items.map((p) => {
            const i = data.ingredientMap.get(p.ingredientId);
            const Icon = LOC_ICON[p.location];
            const expired = p.expiresOn && p.expiresOn < data.today;
            const expSoon = p.expiresOn && !expired && p.expiresOn <= soon;
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-cream-100 px-3 py-2.5">
                <Icon className="h-5 w-5 text-ink-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{i?.name ?? p.ingredientId}</div>
                  <div className="text-xs text-ink-400">{formatAmount(p.qty, p.unit, i)}{p.expiresOn && ` · use by ${p.expiresOn}`}</div>
                </div>
                {expired && <Badge tone="tomato">Expired</Badge>}
                {expSoon && <Badge tone="orange">Use soon</Badge>}
                <button aria-label="Remove" onClick={() => deletePantryItem(p.id)} className="rounded-full p-2 text-ink-300 hover:bg-tomato-100 hover:text-tomato"><Trash2 className="h-4 w-4" /></button>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty title="Pantry is empty" body="Add what's already in your kitchen. It's subtracted from shopping lists, and items about to expire are worked into the next plan." />
      )}

      {suggestions.length > 0 && (
        <div>
          <div className="eyebrow mb-2">Cook from what you have</div>
          <div className="grid gap-2 md:grid-cols-2">
            {suggestions.map(({ r, hits, exp }) => (
              <Link key={r.id} href={`/recipes/view?id=${r.id}`} className="rounded-2xl border border-ink/10 bg-cream-100 p-3 hover:border-ink/25">
                <div className="font-semibold">{r.name}</div>
                <div className="text-xs text-ink-400">Uses {hits} pantry item{hits > 1 ? "s" : ""}{exp ? ` · ${exp} expiring soon` : ""}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
