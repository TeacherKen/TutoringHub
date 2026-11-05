// 🔔 TutoringHub's helper on Mr Ken's phone: shows pop-ups sent by the server and opens the right page when tapped.
// It does nothing else (no caching), so the app always shows the newest version.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let n = { title: "TutoringHub", body: "", url: "/" };
  try {
    n = { ...n, ...e.data.json() };
  } catch {
    /* plain message */
  }
  e.waitUntil(
    self.registration.showNotification(n.title, {
      body: n.body,
      icon: "/icons/tutor-192.png",
      badge: "/icons/tutor-192.png",
      tag: n.tag || undefined,
      data: { url: n.url },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
