"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Search, Star, Trash2, Plus, Info, ExternalLink, FileImage } from "lucide-react";
import type { Chain, Store } from "@/lib/types";
import { useData } from "@/lib/data-context";
import { deleteStore, saveStore, updateSettings } from "@/lib/db/actions";
import { uid } from "@/lib/db/defaults";
import { api } from "@/lib/api";
import { CHAIN_INFO, flyerLink, type FoundStore } from "@/lib/stores-osm";
import { Badge, Button, Card, Field, Input, Notice, Select, Toggle, cn } from "../ui";
import { useToast } from "../toast";

export function StoreSettings() {
  const data = useData();
  const toast = useToast();
  const s = data.settings;
  const [zip, setZip] = useState(s.zip ?? "");
  const [found, setFound] = useState<FoundStore[] | null>(null);
  const [place, setPlace] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [manual, setManual] = useState<{ chain: Chain; name: string; address: string }>({ chain: "hannaford", name: "", address: "" });
  const [showAll, setShowAll] = useState(false);

  async function search() {
    setBusy(true);
    setErr("");
    try {
      await updateSettings({ zip });
      const r = await api<{ stores: FoundStore[]; origin: { place: string }; error?: string }>(`/api/stores?zip=${zip}&radiusKm=${s.radiusKm}`);
      setFound(r.stores);
      setPlace(r.origin.place);
      await updateSettings({ town: r.origin.place });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Search failed");
      setFound(null);
    } finally {
      setBusy(false);
    }
  }

  async function addFound(f: FoundStore) {
    await saveStore({ id: uid("store"), chain: f.chain, name: f.name, address: f.address, lat: f.lat, lon: f.lon, distanceKm: f.distanceKm, source: "osm", preferred: data.stores.length === 0 });
    toast(`Added ${f.name}`);
  }

  async function addManual() {
    const name = manual.name.trim() || CHAIN_INFO[manual.chain].label;
    await saveStore({ id: uid("store"), chain: manual.chain, name: manual.address ? `${name} — ${manual.address}` : name, address: manual.address || undefined, source: "user", preferred: data.stores.length === 0 });
    setManual({ ...manual, name: "", address: "" });
    toast(`Added ${name}`);
  }

  async function makePreferred(st: Store) {
    for (const x of data.stores) if (x.preferred !== (x.id === st.id)) await saveStore({ ...x, preferred: x.id === st.id });
  }

  const visible = (found ?? []).filter((f) => showAll || f.chain !== "other");
  const added = new Set(data.stores.map((x) => `${x.lat?.toFixed(4)},${x.lon?.toFixed(4)}`));

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-4">
        <div className="font-display text-lg font-semibold text-forest">Find nearby stores</div>
        <div className="grid grid-cols-[1fr_110px_auto] gap-2">
          <Input inputMode="numeric" maxLength={5} placeholder="ZIP code" value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} />
          <Select value={s.radiusKm} onChange={(e) => updateSettings({ radiusKm: Number(e.target.value) })} aria-label="Search radius">
            {[8, 16, 25, 40, 60].map((k) => <option key={k} value={k}>{Math.round(k / 1.609)} mi</option>)}
          </Select>
          <Button onClick={search} loading={busy} disabled={zip.length !== 5} aria-label="Search"><Search className="h-4 w-4" /></Button>
        </div>
        <p className="text-xs text-ink-400">Sends only the ZIP code to api.zippopotam.us and the OpenStreetMap directory. Distances are straight-line, not driving.</p>
        {err && <Notice tone="tomato">{err}</Notice>}
        {found && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-ink-400">
              <span>{visible.length} {showAll ? "supermarkets" : "supported chains"} near {place}</span>
              <button className="font-semibold text-orange-700" onClick={() => setShowAll(!showAll)}>{showAll ? "Supported chains only" : "Show all supermarkets"}</button>
            </div>
            {visible.length === 0 && <p className="text-sm text-ink-600">None found in range — widen the radius or add one manually.</p>}
            {visible.map((f) => {
              const isAdded = added.has(`${f.lat.toFixed(4)},${f.lon.toFixed(4)}`);
              return (
                <div key={f.osmId} className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2">
                  <MapPin className="h-4 w-4 shrink-0 text-orange" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold">{f.name}</div>
                    <div className="truncate text-xs text-ink-400">{f.address ?? "Address not listed"} · {(f.distanceKm / 1.609).toFixed(1)} mi</div>
                  </div>
                  <Button size="sm" variant={isAdded ? "ghost" : "soft"} disabled={isAdded} onClick={() => addFound(f)}>{isAdded ? "Added" : "Add"}</Button>
                </div>
              );
            })}
            <p className="text-[10px] text-ink-300">Store data © OpenStreetMap contributors (ODbL)</p>
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div className="font-display text-lg font-semibold text-forest">Add a store manually</div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={manual.chain} onChange={(e) => setManual({ ...manual, chain: e.target.value as Chain })}>
            {(Object.keys(CHAIN_INFO) as Chain[]).map((c) => <option key={c} value={c}>{CHAIN_INFO[c].label}</option>)}
          </Select>
          <Input placeholder="Town / location" value={manual.address} onChange={(e) => setManual({ ...manual, address: e.target.value })} />
        </div>
        {manual.chain === "other" && <Input placeholder="Store name" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />}
        <Button variant="soft" className="w-full" onClick={addManual}><Plus className="h-4 w-4" /> Add store</Button>
      </Card>

      <div>
        <div className="eyebrow mb-2">Your stores</div>
        {data.stores.length === 0 && <p className="text-sm text-ink-600">No stores yet. Plans use estimated prices until you add stores and prices.</p>}
        <div className="space-y-2">
          {data.stores.map((st) => (
            <div key={st.id} className="rounded-2xl border border-ink/10 bg-cream-100 p-3">
              <div className="flex items-center gap-3">
                <button aria-label="Preferred store" onClick={() => makePreferred(st)} className={cn("rounded-full p-1.5", st.preferred ? "text-gold" : "text-ink-300 hover:text-ink-400")}>
                  <Star className="h-5 w-5" fill={st.preferred ? "currentColor" : "none"} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{st.name}</div>
                  <div className="text-xs text-ink-400">
                    {CHAIN_INFO[st.chain].label}{st.distanceKm != null && ` · ${(st.distanceKm / 1.609).toFixed(1)} mi`} · {data.dbPrices.filter((p) => p.storeId === st.id).length} prices
                  </div>
                </div>
                {st.id.startsWith("demo-") && <Badge tone="tomato">DEMO</Badge>}
                <button aria-label="Remove store" onClick={() => confirm(`Remove ${st.name} and its prices?`) && deleteStore(st.id)} className="rounded-full p-2 text-ink-300 hover:bg-tomato-100 hover:text-tomato"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex gap-1.5 text-[11.5px] leading-snug text-ink-400"><Info className="mt-px h-3.5 w-3.5 shrink-0" />{CHAIN_INFO[st.chain].deals}</div>
              {!st.id.startsWith("demo-") && (
                <div className="mt-2 flex gap-2 pl-10">
                  {flyerLink(st) && (
                    <a href={flyerLink(st)!.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-full bg-forest-50 px-3 text-sm font-semibold text-forest">
                      <ExternalLink className="h-3.5 w-3.5" /> {flyerLink(st)!.exact ? "Weekly flyer" : "Store site"}
                    </a>
                  )}
                  <Link href={`/groceries?tab=deals&import=${st.id}`} className="inline-flex h-8 items-center gap-1 rounded-full bg-orange-100 px-3 text-sm font-semibold text-orange-700">
                    <FileImage className="h-3.5 w-3.5" /> Import flyer
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Card className="p-4">
        <div className="font-display mb-1 text-lg font-semibold text-forest">Shopping trips</div>
        <Toggle checked={s.oneStoreMode} onChange={(v) => updateSettings({ oneStoreMode: v })} label="One-store shopping" hint="Plan and price everything at your starred store." />
        <Field label="Max stores per trip (for multi-store savings)">
          <Select value={s.maxStores} onChange={(e) => updateSettings({ maxStores: Number(e.target.value) })}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
      </Card>
    </div>
  );
}
