/* WellFed service worker — offline app shell.
 * All household data lives in IndexedDB, so once pages and static assets are
 * cached the whole app (including the shopping list) works without a network.
 * API routes are never cached: they're live lookups (AI, store search).
 */
const VERSION = "wellfed-v1";
const SHELL = ["/", "/plan", "/groceries", "/groceries/shop", "/recipes", "/recipes/view", "/recipes/new", "/household", "/assistant", "/manifest.webmanifest", "/icon-192.png", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))))).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Immutable build assets: cache-first.
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
        return res;
      })),
    );
    return;
  }

  // Pages and RSC payloads: network-first, fall back to cache (ignoring the query string).
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === "navigate" || req.headers.get("RSC"))) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cache = await caches.open(VERSION);
        const hit = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
        if (hit) return hit;
        if (req.mode === "navigate") return (await cache.match(url.pathname, { ignoreSearch: true })) || (await cache.match("/")) || Response.error();
        return Response.error();
      }),
  );
});
