import { afterEach, describe, expect, it, vi } from "vitest";
import { MesaQueue, isRejection, itemPlays, parseQueue, pendingByPlayer, queueKey, serializeQueue, type QueueItem } from "./queue";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};
const item = (requestId: string, over: Partial<QueueItem["payload"]> = {}): Omit<QueueItem, "status"> => ({
  requestId,
  matchId: "m1",
  createdAt: 1,
  text: `Jugada ${requestId}`,
  payload: { type: "foul", minute: 3, tappedElapsed: 200, period: 1, playerId: "p1", ...over },
});
const flushed = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const rejected = (message: string) => Object.assign(new Error(message), { code: "functions/failed-precondition" });
const offline = () => Object.assign(new Error("unavailable"), { code: "functions/unavailable" });

afterEach(() => vi.useRealTimers());

describe("la cola de la mesa", () => {
  it("sube las jugadas en el orden en que se tocaron", async () => {
    const sent: string[] = [];
    const q = new MesaQueue({ key: "k", storage: memory(), channel: null, isOnline: () => true, send: async (x) => void sent.push(x.requestId) });
    q.enqueue(item("a"));
    q.enqueue(item("b"));
    q.enqueue(item("c"));
    await flushed();
    expect(sent).toEqual(["a", "b", "c"]);
    expect(q.getSnapshot().items.map((x) => x.status)).toEqual(["sent", "sent", "sent"]);
    q.close();
  });

  it("una jugada que falla por falta de señal no frena las siguientes", async () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const q = new MesaQueue({
      key: "k",
      storage: memory(),
      channel: null,
      isOnline: () => true,
      send: async (x) => {
        if (x.requestId === "a") throw offline();
        sent.push(x.requestId);
      },
    });
    q.enqueue(item("a"));
    q.enqueue(item("b"));
    await flushed();
    expect(sent).toEqual(["b"]);
    expect(q.getSnapshot().offline).toBe(true);
    expect(q.getSnapshot().items.find((x) => x.requestId === "a")?.status).toBe("pending");
    q.close();
  });

  it("lo que el servidor rechaza pasa a «Por revisar» con su motivo, y se reenvía corregido o se descarta", async () => {
    const sent: QueueItem[] = [];
    const q = new MesaQueue({
      key: "k",
      storage: memory(),
      channel: null,
      isOnline: () => true,
      send: async (x) => {
        if (x.requestId === "a") throw rejected("Ese jugador ya no está en el campo.");
        sent.push(x);
      },
    });
    q.enqueue(item("a"));
    q.enqueue(item("b"));
    await flushed();
    const a = q.getSnapshot().items.find((x) => x.requestId === "a");
    expect(a?.status).toBe("review");
    expect(a?.reason).toBe("Ese jugador ya no está en el campo.");
    expect(sent.map((x) => x.requestId)).toEqual(["b"]);
    q.resend("a", { playerId: "p2", minute: 9 }, "a2");
    await flushed();
    const again = sent.find((x) => x.requestId === "a2");
    expect(again?.payload).toMatchObject({ playerId: "p2", minute: 8, tappedElapsed: 510 });
    q.close();
  });

  it("«Descartar» quita una jugada en revisión", async () => {
    const q = new MesaQueue({ key: "k", storage: memory(), channel: null, isOnline: () => true, send: async () => Promise.reject(rejected("El partido ya está cerrado.")) });
    q.enqueue(item("a"));
    await flushed();
    expect(q.drop("a")).toBe(true);
    expect(q.drop("nada")).toBe(false);
    expect(q.getSnapshot().items).toEqual([]);
    q.close();
  });

  it("guarda la cola en el móvil y otra pestaña (o la misma al volver) la recupera", async () => {
    const store = memory();
    const q = new MesaQueue({ key: "k", storage: store, channel: null, isOnline: () => false, send: async () => Promise.reject(offline()) });
    q.enqueue(item("a"));
    q.enqueue(item("b", { playerId: "p2" }));
    await flushed();
    q.close();
    const back = new MesaQueue({ key: "k", storage: store, channel: null, send: async () => Promise.reject(offline()) });
    expect(back.getSnapshot().items.map((x) => x.requestId)).toEqual(["a", "b"]);
    expect(pendingByPlayer(back.getSnapshot().items)).toEqual({ p1: 1, p2: 1 });
    back.close();
  });

  it("la confirmación es el documento en tiempo real con live-<requestId>", async () => {
    const q = new MesaQueue({ key: "k", storage: memory(), channel: null, isOnline: () => true, send: async () => undefined });
    q.enqueue(item("a"));
    q.enqueue(item("b"));
    await flushed();
    q.confirm(new Set(["live-a"]));
    expect(q.getSnapshot().items.map((x) => x.requestId)).toEqual(["b"]);
    q.close();
  });

  it("el pase de un gol tocado sin red cambia la jugada que espera", () => {
    const q = new MesaQueue({ key: "k", storage: memory(), channel: null, isOnline: () => false, send: () => new Promise(() => undefined) });
    q.enqueue(item("g", { type: "goal", playerId: "p1" }));
    q.enqueue(item("h", { type: "goal", playerId: "p3" }));
    // (g is uploading: it can't change here; h waits behind it)
    expect(q.amend("g", { assistPlayerId: "p2" })).toBe(false);
    expect(q.amend("h", { assistPlayerId: "p2", assistReviewed: true })).toBe(true);
    expect(q.getSnapshot().items[1].payload).toMatchObject({ playerId: "p3", assistPlayerId: "p2", assistReviewed: true });
    q.close();
  });

  it("un campo sin valor no toca la jugada; solo el texto vacío lo borra", () => {
    const q = new MesaQueue({ key: "k", storage: memory(), channel: null, isOnline: () => false, send: () => new Promise(() => undefined) });
    q.enqueue(item("a"));
    q.enqueue(item("g", { type: "goal", playerId: "p1", assistPlayerId: "p2" }));
    expect(q.amend("g", { type: undefined, playerId: undefined, assistPlayerId: "" })).toBe(true);
    const payload = q.getSnapshot().items[1].payload;
    expect(payload).toMatchObject({ type: "goal", playerId: "p1" });
    expect(payload).not.toHaveProperty("assistPlayerId");
    q.close();
  });

  it("avisa a las otras pestañas y relee cuando ellas cambian la cola", () => {
    const store = memory();
    const posts: unknown[] = [];
    const channel = { postMessage: (m: unknown) => void posts.push(m), close: () => undefined, onmessage: null as ((ev: MessageEvent) => void) | null };
    const q = new MesaQueue({ key: "k", storage: store, channel, isOnline: () => false, send: () => new Promise(() => undefined) });
    q.enqueue(item("a"));
    expect(posts.length).toBeGreaterThan(0);
    // another tab adds a play
    store.setItem("k", serializeQueue([...q.getSnapshot().items, { ...item("z"), status: "pending" }]));
    channel.onmessage?.(new MessageEvent("message", { data: { t: "sync" } }));
    expect(q.getSnapshot().items.map((x) => x.requestId)).toEqual(["a", "z"]);
    q.close();
  });

  it("descarta lo corrupto sin perder el resto, y la clave no lleva datos personales", () => {
    const good = { ...item("a"), status: "pending" };
    const raw = JSON.stringify({ version: 1, items: [good, { requestId: "", junk: true }, { ...good, requestId: "b", payload: { ...good.payload, type: "nope" } }] });
    expect(parseQueue(raw).map((x) => x.requestId)).toEqual(["a"]);
    expect(parseQueue("{not json")).toEqual([]);
    expect(parseQueue(JSON.stringify({ version: 2, items: [] }))).toEqual([]);
    expect(queueKey("uid 1", "m/1", "proj")).toBe("mp:mesa-queue:v1:proj:uid%201:m%2F1");
  });

  it("una tanda de cambios es una sola operación: sube una vez, se confirma entera y se quita cambio a cambio", async () => {
    const sent: QueueItem[] = [];
    const sub = (out: string, inn: string) => ({ type: "substitution" as const, minute: 25, tappedElapsed: 1500, period: 1 as const, playerId: out, inPlayerId: inn });
    const batch = [sub("a", "x"), sub("b", "y"), sub("c", "z")];
    const wave = { requestId: "w", matchId: "m1", createdAt: 1, text: "Tres cambios", payload: batch[0], batch };
    expect(itemPlays(wave).map((p) => p.id)).toEqual(["live-w-0", "live-w-1", "live-w-2"]);
    // offline: it waits, and one change can be taken out before it goes up
    const q = new MesaQueue({ key: "k", storage: memory(), channel: null, isOnline: () => true, send: async () => Promise.reject(offline()) });
    q.enqueue(wave);
    await flushed();
    expect(pendingByPlayer(q.getSnapshot().items)).toEqual({ a: 1, x: 1, b: 1, y: 1, c: 1, z: 1 });
    expect(q.drop("w", 1)).toBe(true);
    expect(q.getSnapshot().items[0].batch?.map((p) => p.playerId)).toEqual(["a", "c"]);
    expect(q.amend("w", { inPlayerId: "zz" }, 1)).toBe(true);
    expect(q.getSnapshot().items[0].batch?.[1].inPlayerId).toBe("zz");
    q.close();
    // online: one upload for the whole wave; any of its changes on the server confirms it
    const q2 = new MesaQueue({ key: "k2", storage: memory(), channel: null, isOnline: () => true, send: async (x) => void sent.push(x) });
    q2.enqueue(wave);
    await flushed();
    expect(sent).toHaveLength(1);
    expect(sent[0].batch).toHaveLength(3);
    q2.confirm(new Set(["live-w-2"]));
    expect(q2.getSnapshot().items).toEqual([]);
    q2.close();
  });

  it("una tanda rechazada se reenvía con otro minuto para todos sus cambios", async () => {
    const sub = (out: string, inn: string) => ({ type: "substitution" as const, minute: 25, tappedElapsed: 1500, period: 1 as const, playerId: out, inPlayerId: inn });
    const batch = [sub("a", "x"), sub("b", "y")];
    const q = new MesaQueue({ key: "k", storage: memory(), channel: null, isOnline: () => true, send: async (x) => { if (x.requestId === "w") throw rejected("Ese jugador ya no está en el campo."); } });
    q.enqueue({ requestId: "w", matchId: "m1", createdAt: 1, text: "Dos cambios", payload: batch[0], batch });
    await flushed();
    expect(q.getSnapshot().items[0].status).toBe("review");
    q.resend("w", { minute: 20, playerId: "nope" }, "w2");
    await flushed();
    const it = q.getSnapshot().items[0];
    expect(it.requestId).toBe("w2");
    expect(it.batch?.map((p) => [p.playerId, p.minute, p.tappedElapsed])).toEqual([["a", 19, 1170], ["b", 19, 1170]]);
    q.close();
  });

  it("B-MESA-06: settle espera a que acabe la subida en vuelo; después la jugada ya está arriba y se corrige allí", async () => {
    let finish: () => void = () => undefined;
    const q = new MesaQueue({ key: "k", storage: memory(), channel: null, isOnline: () => true, send: () => new Promise<void>((ok) => (finish = ok)) });
    q.enqueue(item("g", { type: "goal", playerId: "p1" }));
    await flushed();
    expect(q.isSending("g")).toBe(true);
    // (while it goes up, the queue can't change it: before the fix the edit went to the server with an id it didn't have yet)
    expect(q.amend("g", { assistPlayerId: "p2" })).toBe(false);
    let settled = false;
    const waiting = q.settle("g").then(() => (settled = true));
    await flushed();
    expect(settled).toBe(false);
    finish();
    await waiting;
    expect(q.isSending("g")).toBe(false);
    expect(q.getSnapshot().items[0].status).toBe("sent");
    await expect(q.settle("nada")).resolves.toBeUndefined();
    q.close();
  });

  it("corregir el minuto de una jugada que sigue en el móvil cambia su tiempo de juego", async () => {
    const q = new MesaQueue({ key: "k", storage: memory(), channel: null, isOnline: () => false, send: async () => { throw offline(); } });
    q.enqueue(item("a"));
    await flushed();
    expect(q.amend("a", { elapsedSeconds: 9 * 60 + 30 })).toBe(true);
    expect(q.getSnapshot().items[0].payload).toMatchObject({ minute: 9, tappedElapsed: 570, playerId: "p1" });
    q.close();
  });

  it("solo los códigos de rechazo van a revisar; la red se reintenta", () => {
    expect(isRejection(rejected("x"))).toBe(true);
    expect(isRejection({ code: "functions/invalid-argument" })).toBe(true);
    expect(isRejection(offline())).toBe(false);
    expect(isRejection({ code: "functions/aborted" })).toBe(false);
    expect(isRejection(new Error("boom"))).toBe(false);
  });
});
