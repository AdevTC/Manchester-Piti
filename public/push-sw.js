// Push notices for the club's service worker (imported by the Workbox-generated sw.js).
// The server sends { title, body, tag, url } and, on the notices that carry buttons, their `actions`
// with the `matchId` (functions/src/pushLogic.ts pushPayload): «Voy» / «No puedo» on the RSVP reminders,
// «Abrir el partido» / «Solo goles» on a goal. A goal on a device that chose «Vibrar con los goles» comes
// with `vibrate: true`. Browsers without notice buttons or vibration (iOS) just leave them out.
const GOAL_VIBRATE = [80, 40, 120];
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Manchester Piti", body: event.data ? event.data.text() : "" };
  }
  const actions = Array.isArray(data.actions) ? data.actions.filter((a) => a && typeof a.action === "string" && typeof a.title === "string") : [];
  const options = {
    body: data.body || "",
    icon: "/crest-icon.png",
    badge: "/crest-icon.png",
    tag: data.tag,
    renotify: !!data.tag,
    data: { url: data.url || "/", matchId: typeof data.matchId === "string" ? data.matchId : undefined },
  };
  if (actions.length && options.data.matchId) options.actions = actions;
  if (data.vibrate === true) options.vibrate = GOAL_VIBRATE;
  event.waitUntil(self.registration.showNotification(data.title || "Manchester Piti", options));
});

// Where a tap leads: the same function as src/lib/pushRoute.ts (pushRoute.test.ts runs both copies).
// <pushRoute>
const pushClickUrl = (data, action, nonce) => {
  const d = data || {};
  const matchId = typeof d.matchId === "string" ? d.matchId : "";
  if ((action === "yes" || action === "no") && matchId) return `/vestuario?rsvp=${action}&m=${encodeURIComponent(matchId)}${typeof nonce === "string" && nonce ? `&n=${encodeURIComponent(nonce)}` : ""}`;
  return typeof d.url === "string" && d.url ? d.url : "/";
};
// </pushRoute>

// The one-time ticket of a «Voy» / «No puedo» tap (src/lib/rsvpTicket.ts reads and spends it): only
// this worker can leave it, so a crafted link alone never answers for a member (the page only asks).
const RSVP_CACHE = "mp-rsvp";
const RSVP_TICKET_MS = 10 * 60_000;
const rsvpTicket = async (rsvp, m) => {
  const nonce = self.crypto.randomUUID();
  const cache = await caches.open(RSVP_CACHE);
  await cache.put("/rsvp/" + nonce, new Response(JSON.stringify({ rsvp, m, exp: Date.now() + RSVP_TICKET_MS }), { headers: { "content-type": "application/json" } }));
  return nonce;
};
// Tickets never used, dropped once expired: after the window opens (the click's permission to open one is short).
const sweepRsvpTickets = async () => {
  const cache = await caches.open(RSVP_CACHE);
  for (const req of await cache.keys()) {
    const old = await cache.match(req);
    const t = old ? await old.json().catch(() => null) : null;
    if (!t || !(t.exp > Date.now())) await cache.delete(req);
  }
};

// The browser renewed this device's subscription (its keys rotated, or the push service dropped the old
// one): subscribe again with the same key and tell the server, so the notices keep coming without
// opening the web. The worker has no sign-in, so it re-sends only the public topics, read from what the
// page left in the cache (src/lib/push.ts rememberForWorker); the personal ones (door, access,
// convocatoria) need the member's session: the worker leaves a «dirty» mark in the same cache and the
// app re-asserts the full set on its next open (reassertPush). The same endpoint the app registered:
// nothing to do. Anything failing here is left to that boot check.
const PUSH_KEY = "BAZRaiFp6DqaRb1e2ONwNyUivVNI6AqQCrb-ovbyBJ7c_BYYHRt9SrPbE96MjDZfasbQrRqDREKCG6z7Ug3uDYc";
const PUBLIC_TOPICS = ["start", "goals", "cards", "final", "mvp", "dates", "lineup", "tabla"];
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
      // (the endpoint the app registered, unchanged: the server already has it with all its topics)
      if (sub.endpoint === saved.endpoint) return;
      // The app owes the server the full set (personal topics, uid): it re-asserts on its next open.
      await cache.put("/__piti-push-dirty", new Response(String(Date.now())));
      if (old && old.endpoint && old.endpoint !== sub.endpoint && saved.unsubscribe) await callFn(saved.unsubscribe, { endpoint: old.endpoint }).catch(() => undefined);
      const topics = saved.topics.filter((t) => PUBLIC_TOPICS.includes(t));
      if (topics.length && saved.subscribe) await callFn(saved.subscribe, { subscription: sub.toJSON(), topics, vibrate: saved.vibrate === true });
    })().catch(() => undefined),
  );
});

// «Solo goles» on a goal notice: this device keeps only the goals (pushSetPreset, by its endpoint: the
// worker has no session). The page can't be told directly: the server's answer is left in the cache for
// the app to take on its next open (src/lib/push.ts syncFromWorker), and the worker's own state follows.
const soloGoles = async () => {
  const cache = await caches.open("piti-push");
  const hit = await cache.match("/__piti-push-state");
  const saved = hit ? await hit.json() : null;
  const sub = await self.registration.pushManager.getSubscription();
  if (!saved || !saved.setPreset || !sub) return;
  const res = await callFn(saved.setPreset, { endpoint: sub.endpoint, preset: "goles" });
  if (!res.ok) return;
  const body = await res.json().catch(() => null);
  const topics = body && body.result && Array.isArray(body.result.topics) ? body.result.topics : ["goals"];
  await cache.put("/__piti-push-preset", new Response(JSON.stringify({ topics, at: Date.now() }), { headers: { "content-type": "application/json" } }));
  await cache.put("/__piti-push-state", new Response(JSON.stringify({ ...saved, topics }), { headers: { "content-type": "application/json" } }));
};

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // A button («Voy» / «No puedo») opens the vestuario with the answer and its one-time ticket; the
  // signed-in app writes it (the worker has no session and never writes). A plain tap opens the
  // notice's link. Without a ticket (no Cache API, no randomUUID) the vestuario only asks.
  const data = event.notification.data;
  const action = event.action;
  const matchId = data && typeof data.matchId === "string" ? data.matchId : "";
  // «Solo goles»: nothing to open, the choice changes here («Abrir el partido» opens the notice's link).
  if (action === "solo-goles") {
    event.waitUntil(soloGoles().catch(() => undefined));
    return;
  }
  event.waitUntil(
    (async () => {
      let nonce = "";
      if ((action === "yes" || action === "no") && matchId) nonce = await rsvpTicket(action, matchId).catch(() => "");
      const url = new URL(pushClickUrl(data, action, nonce), self.location.origin).href;
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if ("focus" in w) {
          if ("navigate" in w) w.navigate(url);
          const focused = await w.focus();
          await sweepRsvpTickets().catch(() => {});
          return focused;
        }
      }
      const opened = await self.clients.openWindow(url);
      await sweepRsvpTickets().catch(() => {});
      return opened;
    })(),
  );
});
