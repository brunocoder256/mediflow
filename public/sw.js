/* MediFlow Offline Service Worker — app-shell + offline fallback.
   Scope: same origin. Registered from src/app/layout.tsx.

   Strategy:
   - navigation requests      → network-first, cache-then-offline.html fallback
   - /_next/static + assets   → cache-first (immutable build assets)
   - GET /api/*               → stale-while-revalidate (serves the last good
                                catalog/read response when offline)
   - non-GET                  → network only (writes are queued by the app)
*/
const CACHE = "mediflow-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isNavigate = (request) => request.mode === "navigate";
const isStatic = (url) =>
  url.pathname.startsWith("/_next/static") ||
  /\.(?:js|css|png|jpg|jpeg|svg|ico|webp|woff2?)$/.test(url.pathname) ||
  url.pathname === "/manifest.json";
const isApi = (url) => url.pathname.startsWith("/api/") || url.pathname === "/api/health";

async function serveNavigation(request) {
  try {
    const network = await fetch(request);
    if (network && network.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, network.clone());
      return network;
    }
    throw new Error("navigation fetch failed");
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match(OFFLINE_URL);
  }
}

async function serveStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const network = await fetch(request);
  if (network && network.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, network.clone());
  }
  return network;
}

async function serveApi(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  try {
    // Revalidate against the network; never fail the read if it succeeds.
    const network = await fetch(request);
    if (network && network.ok) cache.put(request, network.clone());
    return network;
  } catch {
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // mutations go through the app's sync queue

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isNavigate(request)) event.respondWith(serveNavigation(request));
  else if (isStatic(url)) event.respondWith(serveStatic(request));
  else if (isApi(url)) event.respondWith(serveApi(request));
});