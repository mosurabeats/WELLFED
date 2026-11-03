"use client";

import { useRef, useState } from "react";
import { FileImage, ClipboardPaste, Check, ExternalLink, Images, X } from "lucide-react";
import type { PriceEntry, Unit } from "@/lib/types";
import { useData } from "@/lib/data-context";
import { importFlyerDeals, savePrice, saveStore } from "@/lib/db/actions";
import { api } from "@/lib/api";
import { matchIngredient, mergeFlyerItems, parseFlyerText, supersededFlyerIds, type FlyerItem } from "@/lib/flyer";
import { prepareFlyerFile, readClipboardImage } from "@/lib/image";
import { CHAIN_INFO, flyerLink } from "@/lib/stores-osm";
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
type ApiFlyer = { items: (Omit<FlyerItem, "brand" | "regularPrice" | "promoNotes" | "loyaltyRequired" | "couponRequired"> & { brand: string | null; regularPrice: number | null; promoNotes: string | null; loyaltyRequired: boolean | null; couponRequired: boolean | null })[]; validFrom: string | null; validTo: string | null };

/**
 * Import a store's weekly flyer. Open the retailer's own weekly ad, then add
 * screenshots, photos or a PDF (AI reads them page by page) or paste the text
 * (parsed offline). Every row is reviewed before anything is saved.
 */
export function FlyerImport({ open, onClose, initialStoreId }: { open: boolean; onClose: () => void; initialStoreId?: string }) {
  const data = useData();
  const toast = useToast();
  const [mode, setMode] = useState<"file" | "text">("file");
  const [storeId, setStoreId] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<(Blob & { name?: string })[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [pageErrors, setPageErrors] = useState<string[]>([]);
  const [start, setStart] = useState(data.today);
  const [end, setEnd] = useState(addDays(data.today, 6));
  const [replace, setReplace] = useState(true);
  const [linkDraft, setLinkDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [wasOpen, setWasOpen] = useState(false); // false so opening via a link also initializes
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setRows(null);
      setErr("");
      setPageErrors([]);
      setFiles([]);
      setText("");
      setMode("file");
      setStart(data.today);
      setEnd(addDays(data.today, 6));
      setStoreId(initialStoreId ?? data.stores.find((s) => s.preferred)?.id ?? data.stores[0]?.id ?? "");
    }
  }

  const store = data.stores.find((s) => s.id === storeId);
  const link = store ? flyerLink(store) : null;
  const catalog = data.ingredients.map((i) => `${i.id}=${i.name}`).join("; ");
  const existingFlyer = store ? supersededFlyerIds(data.dbPrices, store.id, start, end).length : 0;

  function addFiles(list: FileList | (Blob & { name?: string })[] | null) {
    if (!list) return;
    const arr = Array.from(list);
    setFiles((f) => [...f, ...arr].slice(0, 12));
    setErr("");
  }

  async function pasteImage() {
    try {
      const img = await readClipboardImage();
      if (!img) return toast("No image on the clipboard — take a screenshot and tap Copy first", "error");
      addFiles([Object.assign(img, { name: `Pasted screenshot ${files.length + 1}` })]);
    } catch {
      toast("Clipboard access was blocked. Use “Add pages” instead.", "error");
    }
  }

  async function extract() {
    setErr("");
    setPageErrors([]);
    if (!store) return setErr("Choose a store first (add one under Household → Stores).");
    if (mode === "text") {
      const parsed = parseFlyerText(text, data.ingredients);
      if (!parsed.length) return setErr("Couldn't find any priced lines. Put one item per line, e.g. “Chicken thighs $1.99/lb”.");
      setRows(parsed.map((r) => ({ ...r, include: !!r.ingredientId })));
      return;
    }
    if (!files.length) return setErr("Add at least one flyer page.");
    setBusy(true);
    const valid = new Set(data.ingredients.map((i) => i.id));
    const pages: FlyerItem[][] = [];
    const failures: string[] = [];
    let from: string | null = null;
    let to: string | null = null;
    for (const [i, f] of files.entries()) {
      setProgress(`Reading page ${i + 1} of ${files.length}…`);
      try {
        const prepared = await prepareFlyerFile(f);
        const r = await api<ApiFlyer>("/api/ai/flyer", {
          method: "POST",
          body: JSON.stringify({ storeName: store.name, catalog, provider: data.settings.aiProvider, file: { mime: prepared.mime, data: prepared.data } }),
        });
        from = from ?? r.validFrom;
        to = to ?? r.validTo;
        pages.push(r.items.map((x) => ({
          productName: x.productName,
          brand: x.brand ?? undefined,
          price: x.price,
          regularPrice: x.regularPrice ?? undefined,
          packageQty: x.packageQty,
          packageUnit: x.packageUnit,
          ingredientId: x.ingredientId && valid.has(x.ingredientId) ? x.ingredientId : matchIngredient(x.productName, data.ingredients),
          loyaltyRequired: x.loyaltyRequired ?? undefined,
          couponRequired: x.couponRequired ?? undefined,
          promoNotes: x.promoNotes ?? undefined,
        })));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "failed";
        failures.push(`Page ${i + 1}: ${msg}`);
        // Configuration problems will fail every page — stop early.
        if (/AI key|API key|Access code|offline/i.test(msg)) break;
      }
    }
    setBusy(false);
    setProgress("");
    setPageErrors(failures);
    const merged = mergeFlyerItems(pages);
    if (!merged.length) {
      setErr(failures.length ? failures[0] : "No priced food items were found on these pages.");
      return;
    }
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) setStart(from);
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) setEnd(to);
    setRows(merged.map((r) => ({ ...r, include: !!r.ingredientId })));
  }

  async function save() {
    if (!store) return toast("Choose a store", "error");
    if (end < start) return toast("The end date is before the start date", "error");
    const chosen = (rows ?? []).filter((r) => r.include && r.ingredientId);
    const ok = chosen.filter((r) => {
      const ing = data.ingredientMap.get(r.ingredientId!);
      return ing && canConvert(r.packageUnit, ing) && r.price > 0 && r.packageQty > 0;
    });
    const res = await importFlyerDeals(store.id, ok.map((r) => ({
      storeId: store.id,
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
      sourceDetail: `${store.name} weekly flyer, reviewed by you`,
    })), start, end, replace);
    toast(`Saved ${res.saved} deal${res.saved === 1 ? "" : "s"}${res.replaced ? `, replaced ${res.replaced} older` : ""}${chosen.length > ok.length ? ` · ${chosen.length - ok.length} skipped (size doesn't fit item)` : ""}`);
    onClose();
  }

  async function saveLink() {
    if (!store || !/^https?:\/\//.test(linkDraft.trim())) return toast("Paste the full flyer address (starting with https://)", "error");
    await saveStore({ ...store, flyerUrl: linkDraft.trim() });
    setLinkDraft("");
    toast("Flyer link saved for this store");
  }

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const included = rows?.filter((r) => r.include && r.ingredientId).length ?? 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Import weekly flyer"
      wide
      footer={rows
        ? <Button className="w-full" onClick={save} disabled={!included}><Check className="h-4 w-4" /> Save {included} deal{included === 1 ? "" : "s"}</Button>
        : <Button className="w-full" onClick={extract} loading={busy} disabled={!store}>{busy ? progress || "Reading…" : mode === "file" ? `Read ${files.length || ""} page${files.length === 1 ? "" : "s"}` : "Read text"}</Button>}
    >
      <div className="space-y-3 pb-2">
        <Field label="Store">
          <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            {data.stores.length === 0 && <option value="">Add a store under Household first</option>}
            {data.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        {data.stores.length === 0 && <Notice tone="tomato">Add your store under <Link href="/household?tab=stores" className="font-bold underline">Household → Stores</Link> first.</Notice>}

        {!rows && store && (
          <div className="rounded-2xl border border-ink/10 bg-cream-100 p-3">
            <div className="text-[13px] font-semibold">Step 1 · Open {store.name}&apos;s weekly ad</div>
            {link ? (
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-center gap-2 rounded-full bg-forest px-4 py-2.5 text-[15px] font-semibold text-cream-100">
                <ExternalLink className="h-4 w-4" /> {link.exact ? "Open this week's flyer" : `Open ${CHAIN_INFO[store.chain].label} site`}
              </a>
            ) : <p className="mt-1 text-xs text-ink-400">Open your store&apos;s weekly ad in Safari.</p>}
            <p className="mt-2 text-xs leading-snug text-ink-600">
              {link && !link.exact ? `Tap "Weekly Flyer" there and pick your store. ` : ""}
              Screenshot each page (or save it as a PDF), then come back here.
            </p>
            {(!link || !link.exact) && (
              <div className="mt-2 flex gap-2">
                <Input className="h-9 text-sm" placeholder="Paste your store's flyer link to save it" value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} />
                <Button size="sm" variant="soft" onClick={saveLink}>Save</Button>
              </div>
            )}
          </div>
        )}

        {!rows && (
          <>
            <div className="text-[13px] font-semibold">Step 2 · Add the pages</div>
            <Segmented className="w-full" value={mode} onChange={setMode} options={[{ value: "file", label: <span className="inline-flex items-center gap-1"><FileImage className="h-4 w-4" /> Screenshots / PDF</span> }, { value: "text", label: <span className="inline-flex items-center gap-1"><ClipboardPaste className="h-4 w-4" /> Paste text</span> }]} />
            {mode === "file" ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => fileRef.current?.click()}><Images className="h-4 w-4" /> Add pages</Button>
                  <Button variant="outline" onClick={pasteImage}><ClipboardPaste className="h-4 w-4" /> Paste screenshot</Button>
                </div>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                {files.length > 0 ? (
                  <ul className="space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-sm">
                        <span className="truncate">Page {i + 1} · {f.name ?? "image"} <span className="text-ink-400">({Math.round(f.size / 1024)} KB)</span></span>
                        <button aria-label="Remove page" className="p-1 text-ink-300 hover:text-tomato" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-ink-400">Up to 12 pages: screenshots, photos of the paper flyer, or a PDF. Photos are shrunk on your phone before upload, then read by your AI provider. Nothing is saved until you review it.</p>
                )}
              </div>
            ) : (
              <Field label="Flyer text" hint="One item per line. Parsed on this device — no AI needed.">
                <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Boneless chicken thighs $1.99/lb\nBroccoli crowns $1.49 lb\nPasta 16 oz 2 for $3\nLarge eggs dozen $2.99 with card"} />
              </Field>
            )}
          </>
        )}
        {err && <Notice tone="tomato">{err}</Notice>}

        {rows && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Valid from"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
              <Field label="Valid through"><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
            </div>
            {existingFlyer > 0 && <Toggle checked={replace} onChange={setReplace} label={`Replace ${existingFlyer} earlier flyer deal${existingFlyer === 1 ? "" : "s"} for these dates`} hint="Prices you typed in yourself are never replaced." />}
            {pageErrors.length > 0 && <Notice>Some pages couldn&apos;t be read: {pageErrors.join("; ")}</Notice>}
            <div className="flex items-center justify-between text-xs text-ink-400">
              <span>{rows.length} items found · {included} will be saved. Only rows matched to an ingredient are saved.</span>
              <span className="flex gap-3 font-semibold text-orange-700">
                <button onClick={() => setRows(rows.map((r) => ({ ...r, include: !!r.ingredientId })))}>All</button>
                <button onClick={() => setRows(rows.map((r) => ({ ...r, include: false })))}>None</button>
              </span>
            </div>
            {rows.map((r, i) => (
              <div key={i} className={cn("rounded-2xl border p-3", r.include ? "border-forest/40 bg-forest-50/60" : "border-ink/10 opacity-70")}>
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} className="mt-1 h-5 w-5 accent-[var(--color-forest)]" aria-label="Include" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{r.productName}</span>
                      <span className="flex items-baseline gap-1">
                        <span className="text-sm text-ink-400">$</span>
                        <input inputMode="decimal" aria-label="Price" value={r.price} onChange={(e) => update(i, { price: Number(e.target.value) || 0 })} className="font-display tnum w-16 bg-transparent text-right text-lg font-semibold text-forest outline-none" />
                      </span>
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
