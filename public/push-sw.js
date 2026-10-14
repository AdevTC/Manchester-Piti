// Push notices for the club's service worker (imported by the Workbox-generated sw.js).
// The server sends { title, body, tag, url } (functions/src/push.ts).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Manchester Piti", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Manchester Piti", {
      body: data.body || "",
      icon: "/crest-icon.png",
      badge: "/crest-icon.png",
      tag: data.tag,
      renotify: !!data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

// The browser renewed this device's subscription (its keys rotated, or the push service dropped the old
// one): subscribe again with the same key and tell the server, so the notices keep coming without
// opening the web. The worker has no sign-in, so it re-sends only the public topics, read from what the
// page left in the cache (src/lib/push.ts rememberForWorker); the personal ones (door, access,
// convocatoria) need the member's session: the app re-asserts them on its next open (reassertPush sees
// a subscription the server hasn't accepted yet). Anything failing here is left to that boot check.
const PUSH_KEY = "BAZRaiFp6DqaRb1e2ONwNyUivVNI6AqQCrb-ovbyBJ7c_BYYHRt9SrPbE96MjDZfasbQrRqDREKCG6z7Ug3uDYc";
const PUBLIC_TOPICS = ["start", "goals", "final", "mvp", "dates", "lineup"];
const pushKeyBytes = (base64) => {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const callFn = (url, data) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data }) });

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open("piti-push");
      const hit = await cache.match("/__piti-push-state");
      const saved = hit ? await hit.json() : null;
      // (no topics chosen on this device: nothing to keep alive)
      if (!saved || !Array.isArray(saved.topics) || !saved.topics.length) return;
      const old = event.oldSubscription;
      const key = (old && old.options && old.options.applicationServerKey) || pushKeyBytes(PUSH_KEY);
      const sub = event.newSubscription || (await self.registration.pushManager.getSubscription()) || (await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
      if (old && old.endpoint && old.endpoint !== sub.endpoint && saved.unsubscribe) await callFn(saved.unsubscribe, { endpoint: old.endpoint }).catch(() => undefined);
      const topics = saved.topics.filter((t) => PUBLIC_TOPICS.includes(t));
      if (topics.length && saved.subscribe) await callFn(saved.subscribe, { subscription: sub.toJSON(), topics });
    })().catch(() => undefined),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ("focus" in w) {
          if ("navigate" in w) w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
