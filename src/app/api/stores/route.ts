import { checkAccess, fetchWithTimeout } from "@/lib/server/guard";
import { parseOverpass } from "@/lib/stores-osm";

const UA = "WellFed/1.0 (private family meal planner)";
const OVERPASS = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

/**
 * Find supermarkets near a US ZIP code using public, openly licensed data:
 *   1. ZIP → coordinates via api.zippopotam.us
 *   2. Supermarkets within the radius via the OpenStreetMap Overpass API
 * Only the ZIP code (and the derived coordinates) leave the server.
 */
export async function GET(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const zip = (url.searchParams.get("zip") ?? "").trim();
  const radiusKm = Math.min(80, Math.max(1, Number(url.searchParams.get("radiusKm")) || 25));
  if (!/^\d{5}$/.test(zip)) return Response.json({ error: "Enter a 5-digit ZIP code." }, { status: 400 });

  let origin: { lat: number; lon: number; place: string };
  try {
    const r = await fetchWithTimeout(`https://api.zippopotam.us/us/${zip}`, { headers: { "User-Agent": UA } }, 8000);
    if (!r.ok) return Response.json({ error: `ZIP ${zip} not found.` }, { status: 404 });
    const j = (await r.json()) as { places: { latitude: string; longitude: string; "place name": string; "state abbreviation": string }[] };
    const p = j.places[0];
    origin = { lat: Number(p.latitude), lon: Number(p.longitude), place: `${p["place name"]}, ${p["state abbreviation"]}` };
  } catch {
    return Response.json({ error: "Couldn't look up that ZIP code right now. Add stores manually instead." }, { status: 502 });
  }

  const query = `[out:json][timeout:20];nwr["shop"="supermarket"](around:${Math.round(radiusKm * 1000)},${origin.lat},${origin.lon});out center tags;`;
  try {
    const r = await fetchWithTimeout(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
      body: `data=${encodeURIComponent(query)}`,
    }, 20000);
    if (!r.ok) throw new Error(String(r.status));
    const stores = parseOverpass(await r.json(), origin);
    return Response.json({ origin, radiusKm, stores, source: "© OpenStreetMap contributors (ODbL)" });
  } catch {
    return Response.json({ origin, radiusKm, stores: [], error: "The OpenStreetMap store directory didn't respond. Try again later or add stores manually." }, { status: 502 });
  }
}
