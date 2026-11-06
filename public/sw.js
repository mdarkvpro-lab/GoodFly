/* GoodFly service worker: shows booking alerts sent by the server (Web Push). Nothing is cached. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  // Only a page of this site ("/..." but never "//other-site" or "/\other-site").
  const url = typeof data.url === "string" && /^\/(?![/\\])/.test(data.url) ? data.url : "/fr/espace/reservations";
  event.waitUntil(
    self.registration.showNotification(String(data.title || "GoodFly"), {
      body: String(data.body || ""),
      tag: String(data.tag || "goodfly"),
      icon: "/icon.png",
      badge: "/icon.png",
      data: { url },
      requireInteraction: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let url = new URL(event.notification.data?.url || "/fr/espace/reservations", self.location.origin);
  if (url.origin !== self.location.origin) url = new URL("/fr/espace/reservations", self.location.origin);
  url = url.href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
