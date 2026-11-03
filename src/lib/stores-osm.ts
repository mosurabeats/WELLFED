import type { Chain } from "./types";

/** Supported chains and how to recognise them in OpenStreetMap tags. */
export const CHAIN_INFO: Record<Chain, { label: string; pattern: RegExp; deals: string }> = {
  hannaford: {
    label: "Hannaford",
    pattern: /hannaford/i,
    deals: "Weekly flyer on hannaford.com (no public API). Import the flyer as an image/PDF or enter prices.",
  },
  shaws: {
    label: "Shaw's",
    pattern: /shaw'?s/i,
    deals: "Weekly ad and digital coupons on shaws.com (Albertsons; no public API). Import the flyer or enter prices.",
  },
  "price-chopper": {
    label: "Price Chopper / Market 32",
    pattern: /price\s*chopper|market\s*32/i,
    deals: "Weekly flyer on pricechopper.com (no public API). Import the flyer or enter prices.",
  },
  walmart: {
    label: "Walmart",
    pattern: /walmart/i,
    deals: "Walmart offers an affiliate product API only to approved partners. Without one, enter prices or import a screenshot.",
  },
  aldi: {
    label: "Aldi",
    pattern: /\baldi\b/i,
    deals: "Weekly ad on aldi.us (no public API). Import the ad or enter prices.",
  },
  other: { label: "Other store", pattern: /$^/, deals: "Enter prices or import a flyer." },
};

export function classifyChain(name = "", brand = ""): Chain {
  const s = `${brand} ${name}`;
  for (const [chain, info] of Object.entries(CHAIN_INFO) as [Chain, (typeof CHAIN_INFO)[Chain]][]) {
    if (chain !== "other" && info.pattern.test(s)) return chain;
  }
  return "other";
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface FoundStore {
  osmId: string;
  name: string;
  chain: Chain;
  address?: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Turn an Overpass API response into a sorted, de-duplicated store list. */
export function parseOverpass(json: { elements?: OverpassElement[] }, origin: { lat: number; lon: number }): FoundStore[] {
  const out: FoundStore[] = [];
  for (const el of json.elements ?? []) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const tags = el.tags ?? {};
    if (lat == null || lon == null || !tags.name) continue;
    const address = [
      [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
      tags["addr:city"],
    ].filter(Boolean).join(", ");
    out.push({
      osmId: `${el.type}/${el.id}`,
      name: tags.name,
      chain: classifyChain(tags.name, tags.brand),
      address: address || undefined,
      lat,
      lon,
      distanceKm: Math.round(haversineKm(origin, { lat, lon }) * 10) / 10,
    });
  }
  const seen = new Set<string>();
  return out
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .filter((s) => {
      const k = `${s.name}|${s.address ?? ""}|${Math.round(s.lat * 500)}|${Math.round(s.lon * 500)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}
