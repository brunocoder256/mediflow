// MediFlow Service Worker — offline shell, do not cache private data indiscriminately
const CACHE_NAME = "mediflow-v1";
const SHELL = ["/", "/dashboard", "/offline", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Never cache API or supabase auth
  if (req.url.includes("/api/") || req.url.includes("supabase") || req.url.includes("/auth/")) return;
  event.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req)
          .then((res) => {
            // Cache shell only
            if (SHELL.some((s) => req.url.endsWith(s))) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, clone));
            }
            return res;
          })
          .catch(() => caches.match("/offline") || cached)
      );
    })
  );
});
