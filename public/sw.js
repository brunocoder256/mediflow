// MediFlow IQ Service Worker — offline-capable PWA shell
//
// CACHING POLICY:
//  - App shell (HTML + hashed static assets): network-first for navigations,
//    cache-first for assets. Successful navigations are stored so every page
//    you visit while online is available offline later.
//  - GET /api/* (idempotent read endpoints used by POS / inventory): network-first
//    with Cache API fallback. The primary offline read-cache is the Dexie dataCache
//    (see src/lib/offline/cached-fetch.ts); this SW copy is a safety net.
//  - Non-GET (POST/PATCH/PUT/DELETE): never cached, never intercepted.
//  - supabase / auth: never cached.
//
// Offline fallback: a real, self-contained HTML document (public/offline.html)
// with an explicit text/html content-type, so browsers never try to download it.

const CACHE_NAME = "mediflow-v4";
const API_CACHE_NAME = "mediflow-api-v1";
// Only items that are GUARANTEED to resolve to HTTP 200 during install.
// /offline.html is a real static file with a proper HTML content-type — never
// use an extensionless public path (e.g. /offline) here, some servers serve
// it as octet-stream which makes the browser download it instead of rendering.
const SHELL = ["/offline.html", "/manifest.json", "/icon-192.png", "/icon-512.png", "/icon-32.png"];
const OFFLINE_URL = "/offline.html";

// The sign-in page is intentionally cacheable: logging out while offline must
// still land the user on a real sign-in page (network-first online, cached
// offline) instead of a dead-end fallback. The sign-up flow stays off the
// offline cache.
const NEVER_CACHE_NAV = ["/auth/signup"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          SHELL
            .map((url) =>
              cache.add(url).catch(function () {
                // Ignore a single failed item (e.g. a missing icon). One failing
                // resource must never abort offline support for the whole app.
              })
            )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Never cache supabase or auth.
  if (req.url.includes("supabase") || req.url.includes("/auth/")) return;

  const url = new URL(req.url);
  const isNavigate = req.mode === "navigate";

  // GET /api/* read endpoints: network-first with Cache API fallback.
  if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/health")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(API_CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || offlineResponse()))
    );
    return;
  }

  // Navigations: network-first so users always get the latest HTML when online.
  if (isNavigate) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const shouldCache =
            res &&
            res.status === 200 &&
            res.type === "basic" &&
            !NEVER_CACHE_NAV.some((p) => url.pathname.startsWith(p));
          if (shouldCache) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => navigationFallback(req))
    );
    return;
  }

  // Static assets (JS/CSS/fonts/images): cache-first for speed and offline use.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => offlineResponse());
    })
  );
});

// Offline navigation fallback. Priority:
//  1. A previously-cached copy of the exact page requested.
//  2. A cached copy of the MediFlow IQ app shell (/dashboard or /pos), so the user
//     stays inside the real React app — which is itself offline-capable (reads
//     from Dexie/IndexedDB, queues writes) — instead of seeing a dead-end page.
//  3. The static /offline.html page (real HTML content-type, never a download).
function navigationFallback(req) {
  var path = new URL(req.url).pathname;
  return caches
    .match(req)
    .then(function (exact) {
      if (exact) return exact;
      // Try the app shell so the user lands back in a working offline app.
      return caches.match("/dashboard").then(function (shell) {
        if (shell && path !== "/") return shell;
        return caches.match("/offline.html");
      });
    })
    .then(function (cached) {
      return cached || offlineResponse();
    });
}

// Returns the real offline HTML document. It has a text/html content-type,
// so the browser renders it instead of downloading it.
function offlineResponse() {
  return caches.match(OFFLINE_URL).then(function (cached) {
    if (cached) return cached;
    return new Response(
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline — MediFlow IQ</title></head><body style="font-family:system-ui;background:#0f766e;color:#fff;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh"><div style="text-align:center;padding:2rem"><h1 style="margin:0 0 .5rem">You are offline</h1><p>Check your connection and try again.</p><button onclick="location.reload()" style="margin-top:1rem;padding:.6rem 1.4rem;border:0;border-radius:6px;font-size:1rem;cursor:pointer">Retry</button></div></body></html>',
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  });
}
