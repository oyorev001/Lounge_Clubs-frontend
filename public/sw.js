const CACHE_NAME = "osf-cache-v1";
const OFFLINE_URL = "/offline.html";
const APP_SHELL = ["/", OFFLINE_URL, "/favicon.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

// Navigations: try the network first (so signed-in state and live data stay fresh),
// cache a copy of every successful page for offline reuse, and fall back to the
// last cached copy of that page — or the offline shell — when the network fails.
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    void cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached ?? (await cache.match(OFFLINE_URL));
  }
}

// Same-origin static assets (JS/CSS/images/fonts): cache-first, refreshed in the
// background, so repeat visits and offline use don't re-download every asset.
async function handleAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      void cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached ?? (await network) ?? Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (["script", "style", "image", "font"].includes(request.destination)) {
    event.respondWith(handleAsset(request));
  }
});
