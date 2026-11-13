/* LumenPulse service worker: offline app shell, static asset cache, Web Push. */
const VERSION = "lp-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const SHELL_URLS = ["/flashlights/offline", "/flashlights/manifest.json", "/flashlights/icons/icon-192.png", "/flashlights/icons/icon-512.png", "/flashlights/icons/badge-72.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const req of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(req);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache APIs, cron, RSS or RSC/server-action traffic.
  if (url.pathname.startsWith("/api/") || req.headers.get("RSC") || req.headers.get("Next-Router-Prefetch") || url.searchParams.has("_rsc")) return;

  // Immutable build assets + icons: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/flashlights/icons/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Navigations: network-first, fall back to the last cached copy, then the offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && res.type === "basic") {
            const cache = await caches.open(PAGE_CACHE);
            cache.put(req, res.clone());
            trimCache(PAGE_CACHE, 30);
          }
          return res;
        } catch {
          const cached = (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true }));
          return cached || (await caches.match("/flashlights/offline")) || Response.error();
        }
      })(),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "LumenPulse", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "LumenPulse";
  const options = {
    body: data.body || "",
    icon: data.icon || "/flashlights/icons/icon-192.png",
    badge: data.badge || "/flashlights/icons/badge-72.png",
    image: data.image || undefined,
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || "/flashlights" },
    actions: [{ action: "open", title: "View light" }],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/flashlights", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url === target && "focus" in w) return w.focus();
      }
      const any = wins.find((w) => "navigate" in w);
      if (any) return any.navigate(target).then((w) => w && w.focus());
      return self.clients.openWindow(target);
    }),
  );
});

// Browsers may rotate subscriptions; re-subscribe with the same VAPID key and re-register.
self.addEventListener("pushsubscriptionchange", (event) => {
  const key = event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey;
  if (!key) return;
  event.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).then((sub) =>
      fetch("/api/flashlights/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(sub.toJSON()),
      }),
    ),
  );
});
