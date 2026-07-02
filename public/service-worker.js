// NEXUS AI Skills Academy — Service Worker
// v4: switched scripts/styles to network-first to prevent stale-shell blank screens.
// Bump this string any time you need all clients to get fresh assets immediately.
const CACHE_VERSION = "nexus-ai-v4";

const APP_SHELL = ["/", "/offline.html", "/manifest.webmanifest", "/favicon.ico"];

// ── Install: cache the app shell, then take over immediately ──────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())   // don't wait — replace old SW now
  );
});

// ── Activate: delete every old cache version ──────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())  // take control of all open tabs now
  );
});

// ── Fetch: strategy depends on asset type ─────────────────────────
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // NAVIGATION (HTML pages) — network-first
  // Try the network; fall back to cached "/" shell; last resort: offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const shell = await caches.match("/");
          if (shell) return shell;
          return caches.match("/offline.html");
        })
    );
    return;
  }

  // SCRIPTS & STYLES — network-first (CRITICAL: cache-first caused blank screens)
  // Always try the network first so users get new JS/CSS immediately.
  // Cache is only used when the network is genuinely unavailable (offline).
  if (request.destination === "script" || request.destination === "style" || request.destination === "worker") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))  // offline fallback only
    );
    return;
  }

  // IMAGES & FONTS — cache-first (safe; they don't change frequently)
  if (request.destination === "image" || request.destination === "font") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});
