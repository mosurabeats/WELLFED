"use client";

import { useRef, useState } from "react";
import { FileImage, ClipboardPaste, Check } from "lucide-react";
import type { PriceEntry, Unit } from "@/lib/types";
import { useData } from "@/lib/data-context";
import { savePrice, savePrices } from "@/lib/db/actions";
import { api } from "@/lib/api";
import { parseFlyerText, type FlyerItem } from "@/lib/flyer";
import { addDays } from "@/lib/engine/planner";
import { canConvert } from "@/lib/engine/units";
import { IngredientPicker } from "../ingredient-picker";
import { Button, Field, Input, Notice, Segmented, Select, Sheet, Textarea, Toggle, money, cn } from "../ui";
import { useToast } from "../toast";
import Link from "next/link";

const UNITS: Unit[] = ["lb", "oz", "each", "floz", "g", "kg"];

/** Enter one shelf price or sale price by hand. */
export function PriceForm({ open, onClose, initialIngredient }: { open: boolean; onClose: () => void; initialIngredient?: string }) {
  const data = useData();
  const toast = useToast();
  const blank = () => ({
    ingredient: initialIngredient ? [initialIngredient] : ([] as string[]),
    storeId: data.stores.find((s) => s.preferred)?.id ?? data.stores[0]?.id ?? "",
    productName: "",
    brand: "",
    packageQty: "1",
    packageUnit: "lb" as Unit,
    price: "",
    regularPrice: "",
    isSale: false,
    loyalty: false,
    coupon: false,
    promo: "",
    start: data.today,
    end: addDays(data.today, 6),
  });
  const [f, setF] = useState(blank);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setF(blank());
  }
  const ing = f.ingredient[0] ? data.ingredientMap.get(f.ingredient[0]) : undefined;
  const set = <K extends keyof ReturnType<typeof blank>>(k: K, v: ReturnType<typeof blank>[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    if (!ing) return toast("Pick an ingredient", "error");
    if (!f.storeId) return toast("Add a store first (Household → Stores)", "error");
    const price = Number(f.price);
    const qty = Number(f.packageQty);
    if (!(price > 0) || !(qty > 0)) return toast("Enter a price and package size", "error");
    if (!canConvert(f.packageUnit, ing)) return toast(`Can't weigh ${ing.name} by ${f.packageUnit}`, "error");
    const entry: Omit<PriceEntry, "id"> = {
      storeId: f.storeId,
      ingredientId: ing.id,
      productName: f.productName.trim() || ing.name,
      brand: f.brand || undefined,
      packageQty: qty,
      packageUnit: f.packageUnit,
      price,
      regularPrice: f.regularPrice ? Number(f.regularPrice) : undefined,
      isSale: f.isSale,
      loyaltyRequired: f.loyalty || undefined,
      couponRequired: f.coupon || undefined,
      promoNotes: f.promo || undefined,
      startDate: f.isSale ? f.start : undefined,
      endDate: f.isSale ? f.end : undefined,
      source: "user",
      sourceDetail: "Entered by you",
    };
    await savePrice(entry);
    toast("Price saved");
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add a price" footer={<Button className="w-full" onClick={save}>Save price</Button>}>
      <div className="space-y-3 pb-2">
        {data.stores.length === 0 && <Notice tone="tomato">Add a store under <Link href="/household?tab=stores" className="font-bold underline">Household → Stores</Link> first.</Notice>}
        <Field label="Ingredient"><IngredientPicker single selected={f.ingredient} onChange={(v) => { set("ingredient", v); const i = v[0] ? data.ingredientMap.get(v[0]) : undefined; if (i) set("packageUnit", i.shopUnit === "floz" ? "floz" : i.shopUnit); }} /></Field>
        <Field label="Store">
          <Select value={f.storeId} onChange={(e) => set("storeId", e.target.value)}>
            {data.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Product (as labeled)"><Input value={f.productName} placeholder={ing?.name} onChange={(e) => set("productName", e.target.value)} /></Field>
          <Field label="Brand"><Input value={f.brand} onChange={(e) => set("brand", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-2">
          <Field label="Size"><Input inputMode="decimal" value={f.packageQty} onChange={(e) => set("packageQty", e.target.value)} /></Field>
          <Field label="Unit">
            <Select value={f.packageUnit} onChange={(e) => set("packageUnit", e.target.value as Unit)}>
              {UNITS.filter((u) => !ing || canConvert(u, ing)).map((u) => <option key={u} value={u}>{u === "each" ? "count" : u}</option>)}
            </Select>
          </Field>
          <Field label="Price ($)"><Input inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} /></Field>
        </div>
        <Toggle checked={f.isSale} onChange={(v) => set("isSale", v)} label="This is a sale / deal" />
        {f.isSale && (
          <div className="space-y-3 rounded-2xl bg-orange-100/50 p-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Regular price"><Input inputMode="decimal" value={f.regularPrice} onChange={(e) => set("regularPrice", e.target.value)} /></Field>
              <Field label="Promo notes"><Input value={f.promo} placeholder="2 for $5, limit 4…" onChange={(e) => set("promo", e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Starts"><Input type="date" value={f.start} onChange={(e) => set("start", e.target.value)} /></Field>
              <Field label="Ends"><Input type="date" value={f.end} onChange={(e) => set("end", e.target.value)} /></Field>
            </div>
            <Toggle checked={f.loyalty} onChange={(v) => set("loyalty", v)} label="Loyalty card required" />
            <Toggle checked={f.coupon} onChange={(v) => set("coupon", v)} label="Coupon required" />
          </div>
        )}
      </div>
    </Sheet>
  );
}

type Row = FlyerItem & { include: boolean };

/** Import a weekly flyer: image/PDF via AI, or pasted text via the offline parser. Every row is reviewed before saving. */
export function FlyerImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const toast = useToast();
  const [mode, setMode] = useState<"file" | "text">("file");
  const [storeId, setStoreId] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [start, setStart] = useState(data.today);
  const [end, setEnd] = useState(addDays(data.today, 6));
  const fileRef = useRef<HTMLInputElement>(null);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setRows(null);
      setErr("");
      setStoreId(data.stores.find((s) => s.preferred)?.id ?? data.stores[0]?.id ?? "");
    }
  }

  const catalog = data.ingredients.map((i) => `${i.id}=${i.name}`).join("; ");
  const storeName = data.stores.find((s) => s.id === storeId)?.name ?? "store";

  async function extract() {
    setErr("");
    if (mode === "text") {
      const parsed = parseFlyerText(text, data.ingredients);
      if (!parsed.length) return setErr("Couldn't find any priced lines. Put one item per line, e.g. “Chicken thighs $1.99/lb”.");
      setRows(parsed.map((r) => ({ ...r, include: !!r.ingredientId })));
      return;
    }
    if (!file) return setErr("Choose a flyer photo, screenshot or PDF.");
    if (file.size > 10 * 1024 * 1024) return setErr("That file is over 10 MB — try a screenshot of one page.");
    setBusy(true);
    try {
      const data64 = await toBase64(file);
      const r = await api<{ items: (FlyerItem & { brand: string | null })[]; validFrom: string | null; validTo: string | null }>("/api/ai/flyer", {
        method: "POST",
        body: JSON.stringify({ storeName, catalog, provider: data.settings.aiProvider, file: { mime: file.type || "image/jpeg", data: data64 } }),
      });
      if (r.validFrom) setStart(r.validFrom);
      if (r.validTo) setEnd(r.validTo);
      const valid = new Set(data.ingredients.map((i) => i.id));
      setRows(r.items.map((x) => {
        const ingredientId = x.ingredientId && valid.has(x.ingredientId) ? x.ingredientId : null;
        return { ...x, brand: x.brand ?? undefined, regularPrice: x.regularPrice ?? undefined, promoNotes: x.promoNotes ?? undefined, loyaltyRequired: x.loyaltyRequired ?? undefined, couponRequired: x.couponRequired ?? undefined, ingredientId, include: !!ingredientId };
      }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!storeId) return toast("Choose a store", "error");
    const chosen = (rows ?? []).filter((r) => r.include && r.ingredientId);
    const ok = chosen.filter((r) => {
      const ing = data.ingredientMap.get(r.ingredientId!);
      return ing && canConvert(r.packageUnit, ing) && r.price > 0;
    });
    await savePrices(ok.map((r) => ({
      storeId,
      ingredientId: r.ingredientId!,
      productName: r.productName,
      brand: r.brand,
      packageQty: r.packageQty,
      packageUnit: r.packageUnit,
      price: r.price,
      regularPrice: r.regularPrice,
      isSale: true,
      loyaltyRequired: r.loyaltyRequired,
      couponRequired: r.couponRequired,
      promoNotes: r.promoNotes,
      startDate: start,
      endDate: end,
      source: "flyer" as const,
      sourceDetail: `${storeName} weekly flyer, reviewed by you`,
    })));
    toast(`Saved ${ok.length} deal${ok.length === 1 ? "" : "s"}${chosen.length > ok.length ? ` (${chosen.length - ok.length} skipped: size unit doesn't fit)` : ""}`);
    onClose();
  }

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Sheet open={open} onClose={onClose} title="Import weekly flyer" wide footer={rows ? <Button className="w-full" onClick={save}><Check className="h-4 w-4" /> Save {rows.filter((r) => r.include && r.ingredientId).length} deals</Button> : <Button className="w-full" onClick={extract} loading={busy}>Read flyer</Button>}>
      <div className="space-y-3 pb-2">
        <Field label="Store">
          <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            {data.stores.length === 0 && <option value="">Add a store under Household first</option>}
            {data.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Valid from"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Valid through"><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        {!rows && (
          <>
            <Segmented className="w-full" value={mode} onChange={setMode} options={[{ value: "file", label: <span className="inline-flex items-center gap-1"><FileImage className="h-4 w-4" /> Photo / PDF</span> }, { value: "text", label: <span className="inline-flex items-center gap-1"><ClipboardPaste className="h-4 w-4" /> Paste text</span> }]} />
            {mode === "file" ? (
              <div>
                <button onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-ink/20 bg-white/50 px-4 py-8 text-center">
                  <FileImage className="h-8 w-8 text-orange" />
                  <span className="font-semibold">{file ? file.name : "Take a photo or choose a flyer"}</span>
                  <span className="text-xs text-ink-400">JPG, PNG, WebP or PDF · read by your AI provider · you review every item</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            ) : (
              <Field label="Flyer text" hint="One item per line. Works offline, no AI needed.">
                <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Boneless chicken thighs $1.99/lb\nBroccoli crowns $1.49 lb\nPasta 16 oz 2 for $3\nLarge eggs dozen $2.99 with card"} />
              </Field>
            )}
          </>
        )}
        {err && <Notice tone="tomato">{err}</Notice>}
        {rows && (
          <div className="space-y-2">
            <p className="text-xs text-ink-400">Check each item. Only rows matched to an ingredient are saved. Prices are saved exactly as shown, labeled &ldquo;Weekly flyer&rdquo;.</p>
            {rows.map((r, i) => (
              <div key={i} className={cn("rounded-2xl border p-3", r.include ? "border-forest/40 bg-forest-50/60" : "border-ink/10 opacity-70")}>
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} className="mt-1 h-5 w-5 accent-[var(--color-forest)]" aria-label="Include" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{r.productName}</span>
                      <span className="tnum shrink-0 font-display text-lg font-semibold text-forest">{money(r.price)}</span>
                    </div>
                    <div className="grid grid-cols-[1fr_70px_80px] gap-2">
                      <Select value={r.ingredientId ?? ""} onChange={(e) => update(i, { ingredientId: e.target.value || null, include: !!e.target.value })} aria-label="Ingredient">
                        <option value="">— not matched —</option>
                        {data.ingredients.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </Select>
                      <Input inputMode="decimal" value={r.packageQty} onChange={(e) => update(i, { packageQty: Number(e.target.value) || 0 })} aria-label="Size" />
                      <Select value={r.packageUnit} onChange={(e) => update(i, { packageUnit: e.target.value as Unit })} aria-label="Unit">
                        {UNITS.map((u) => <option key={u} value={u}>{u === "each" ? "count" : u}</option>)}
                      </Select>
                    </div>
                    <div className="text-xs text-ink-400">{[r.regularPrice && `reg. ${money(r.regularPrice)}`, r.promoNotes, r.loyaltyRequired && "card price", r.couponRequired && "coupon"].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setRows(null)}>Start over</Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function toBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Couldn't read the file"));
    r.readAsDataURL(f);
  });
}
