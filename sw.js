// FexaFY — Service Worker
// Handles offline caching AND is push-notification-ready: once you connect
// a backend (see README.txt -> "ADDING TRUE BACKGROUND PUSH NOTIFICATIONS"),
// that backend can send a push message here and this file will show a
// system notification even while the app itself is fully closed.
//
// TO SHIP A NEW VERSION: bump APP_VERSION below (one line). Everything
// else — the cache name, and cleaning up the old cache on every
// installed device — follows automatically. index.html listens for the
// new service worker and shows a "new version ready, tap to refresh"
// banner to the user automatically; nothing else to wire up.
const APP_VERSION = "v18";
const CACHE = "money-control-" + APP_VERSION;
const ASSETS = ["./", "./index.html", "./manifest.json", "./privacy-policy.html", "./terms.html", "./icon.svg", "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});

// ---- Local notifications (triggered by the app itself while it's open
// or backgrounded in a tab) are shown via registration.showNotification()
// directly from index.html — no extra code needed here for that part.

// ---- True background PUSH (works even with the app fully closed) —
// only fires once you wire up a real push backend (e.g. the free
// Vercel + Upstash setup in push-backend/) and it sends a message to
// this device's push subscription.
// This handler is inert (does nothing) until that's set up.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {
    data = { title: "FexaFY", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "FexaFY";
  const options = {
    body: data.body || "",
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: data.tag || "money-control",
    data: { url: data.url || "./" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
