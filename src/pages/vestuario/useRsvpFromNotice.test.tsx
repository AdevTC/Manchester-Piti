import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { RSVP_CACHE, RSVP_TICKET_MS, rsvpTicketPath } from "../../lib/rsvpTicket";
import type { RsvpFromNotice } from "./useRsvpFromNotice";

// «Responder desde el aviso»: /vestuario?rsvp=&m=&n= writes the answer once (the RSVP switch's own
// write) only with the worker's one-time ticket (the «mp-rsvp» cache, here a fake Cache API), toasts it
// with «Deshacer», and clears the params; a link without a valid ticket only asks. The write and the
// toasts are stubbed.
const state = vi.hoisted(() => ({
  setAvailability: vi.fn(async (..._args: unknown[]) => undefined),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("./writes", () => ({ setAvailability: state.setAvailability }));
vi.mock("../../lib/toast", () => ({ toast: state.toast }));

const { useRsvpFromNotice, rsvpToastText, rsvpAskText } = await import("./useRsvpFromNotice");

const NOW = Date.now();
const HOUR = 3_600_000;
const match = (id: string, date: number, extra: Partial<ClubMatch> = {}) => ({ id, seasonId: "t1", version: 2, status: "scheduled", rival: "MAD SKY", date, ...extra }) as unknown as ClubMatch;
// j1, j2 played; «gone» kicked off an hour ago; j3 the one to answer (its jornada: J4)
const MATCHES = [
  match("j1", NOW - 14 * 24 * HOUR, { status: "finished" }),
  match("j2", NOW - 7 * 24 * HOUR, { status: "finished" }),
  match("j3", NOW + 48 * HOUR),
  match("gone", NOW - HOUR, { status: "scheduled" }),
];
const ME = { uid: "u1", name: "erik", playerId: "erik" };
const N = "3f2b8c1e-9a4d-4e2f-8b1a-0c9d7e6f5a4b";

// ---- a fake Cache API: what the worker leaves (public/push-sw.js rsvpTicket)
const store = new Map<string, string>();
const fakeCaches = {
  open: async (name: string) => {
    expect(name).toBe(RSVP_CACHE);
    return {
      match: async (key: string) => (store.has(key) ? { json: async () => JSON.parse(store.get(key)!) as unknown } : undefined),
      delete: async (key: string) => store.delete(key),
    };
  },
};
const ticket = (nonce: string, t: { rsvp: string; m: string; exp: number }) => store.set(rsvpTicketPath(nonce), JSON.stringify(t));

const base = (over: Partial<RsvpFromNotice> = {}): RsvpFromNotice => ({
  rsvp: "yes",
  m: "j3",
  n: N,
  member: true,
  me: ME,
  matches: MATCHES,
  matchesLoading: false,
  previous: { loading: false, answer: "maybe" },
  now: NOW,
  clear: vi.fn(),
  ...over,
});

beforeEach(() => {
  store.clear();
  vi.stubGlobal("caches", fakeCaches);
  state.setAvailability.mockClear();
  state.toast.mockClear();
  state.toast.success.mockClear();
  state.toast.error.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

type ToastOpts = { duration?: number; action?: { label: string; onClick: () => void } };
const lastSuccess = () => state.toast.success.mock.calls.at(-1) as [string, ToastOpts] | undefined;
const lastPlain = () => state.toast.mock.calls.at(-1) as [string, ToastOpts?] | undefined;
const settle = () => act(async () => new Promise((ok) => setTimeout(ok, 0)));

describe("answering from a notice, with the worker's ticket", () => {
  it("a valid ticket writes once, toasts it, spends the ticket and clears the params", async () => {
    ticket(N, { rsvp: "yes", m: "j3", exp: Date.now() + RSVP_TICKET_MS });
    const args = base();
    const { rerender } = renderHook((p: RsvpFromNotice) => useRsvpFromNotice(p), { initialProps: args });
    // re-renders before the URL clears (new objects, a clock tick) never write again
    rerender({ ...args, me: { ...ME }, now: NOW + 60_000 });
    rerender({ ...args, previous: { loading: false, answer: "yes" } });
    await waitFor(() => expect(state.toast.success).toHaveBeenCalled());
    await settle();
    expect(state.setAvailability).toHaveBeenCalledTimes(1);
    expect(state.setAvailability).toHaveBeenCalledWith(ME, "j3", "yes");
    expect(args.clear).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(0);
    const [text, opts] = lastSuccess()!;
    expect(text).toBe("Apuntado: Voy · J4 vs MAD SKY");
    expect(opts.action?.label).toBe("Deshacer");
    expect(state.toast.success).toHaveBeenCalledTimes(1);
  });

  it("«No puedo» says so", async () => {
    ticket(N, { rsvp: "no", m: "j3", exp: Date.now() + RSVP_TICKET_MS });
    renderHook(() => useRsvpFromNotice(base({ rsvp: "no" })));
    await waitFor(() => expect(state.setAvailability).toHaveBeenCalledWith(ME, "j3", "no"));
    expect(lastSuccess()![0]).toBe("Apuntado: No puedo · J4 vs MAD SKY");
  });

  it("«Deshacer» puts back the previous answer", async () => {
    ticket(N, { rsvp: "no", m: "j3", exp: Date.now() + RSVP_TICKET_MS });
    renderHook(() => useRsvpFromNotice(base({ rsvp: "no", previous: { loading: false, answer: "yes" } })));
    await waitFor(() => expect(state.toast.success).toHaveBeenCalled());
    await act(async () => lastSuccess()![1].action!.onClick());
    expect(state.setAvailability).toHaveBeenCalledTimes(2);
    expect(state.setAvailability).toHaveBeenLastCalledWith(ME, "j3", "yes");
    expect(state.toast).toHaveBeenCalledWith("Vuelves a «Voy»");
  });

  it("no earlier answer to put back (the rules never delete one): a mis-tap can step back to «Duda»", async () => {
    ticket(N, { rsvp: "yes", m: "j3", exp: Date.now() + RSVP_TICKET_MS });
    renderHook(() => useRsvpFromNotice(base({ previous: { loading: false, answer: undefined } })));
    await waitFor(() => expect(state.toast.success).toHaveBeenCalled());
    expect(state.setAvailability).toHaveBeenCalledTimes(1);
    const action = lastSuccess()![1].action as { label: string; onClick: () => void };
    expect(action.label).toBe("Mejor «Duda»");
    action.onClick();
    expect(state.setAvailability).toHaveBeenLastCalledWith(expect.anything(), "j3", "maybe");
  });

  it("waits for the previous answer and the matches before anything", async () => {
    ticket(N, { rsvp: "yes", m: "j3", exp: Date.now() + RSVP_TICKET_MS });
    const args = base({ previous: { loading: true, answer: undefined }, matches: [], matchesLoading: true });
    const { rerender } = renderHook((p: RsvpFromNotice) => useRsvpFromNotice(p), { initialProps: args });
    rerender({ ...args, matches: MATCHES, matchesLoading: false });
    await settle();
    expect(state.setAvailability).not.toHaveBeenCalled();
    expect(args.clear).not.toHaveBeenCalled();
    expect(store.size).toBe(1);
    rerender({ ...args, matches: MATCHES, matchesLoading: false, previous: { loading: false, answer: "no" } });
    await waitFor(() => expect(state.setAvailability).toHaveBeenCalledTimes(1));
    expect(lastSuccess()![1].action?.label).toBe("Deshacer");
  });

  it("a failed write says so", async () => {
    ticket(N, { rsvp: "yes", m: "j3", exp: Date.now() + RSVP_TICKET_MS });
    state.setAvailability.mockRejectedValueOnce(new Error("permission-denied"));
    renderHook(() => useRsvpFromNotice(base()));
    await waitFor(() => expect(state.toast.error).toHaveBeenCalledWith("No se ha podido guardar tu respuesta. Prueba desde el partido."));
  });
});

describe("a link without a valid ticket only asks", () => {
  const asks = async (args: RsvpFromNotice, text = "¿Apuntarte como Voy · J4 vs MAD SKY?") => {
    await waitFor(() => expect(state.toast).toHaveBeenCalled());
    await settle();
    expect(state.setAvailability).not.toHaveBeenCalled();
    expect(state.toast.success).not.toHaveBeenCalled();
    expect(args.clear).toHaveBeenCalledTimes(1);
    const [said, opts] = lastPlain()!;
    expect(said).toBe(text);
    expect(opts?.action?.label).toBe("Apuntarme");
    return opts!.action!;
  };

  it("a missing ticket (a crafted link) asks; «Apuntarme» writes on tap", async () => {
    const args = base({ rsvp: "no", n: undefined });
    renderHook(() => useRsvpFromNotice(args));
    const apuntarme = await asks(args, "¿Apuntarte como No puedo · J4 vs MAD SKY?");
    await act(async () => apuntarme.onClick());
    expect(state.setAvailability).toHaveBeenCalledTimes(1);
    expect(state.setAvailability).toHaveBeenCalledWith(ME, "j3", "no");
    expect(lastSuccess()![0]).toBe("Apuntado: No puedo · J4 vs MAD SKY");
  });

  it("a reused ticket (the same link opened again) asks", async () => {
    ticket(N, { rsvp: "yes", m: "j3", exp: Date.now() + RSVP_TICKET_MS });
    renderHook(() => useRsvpFromNotice(base()));
    await waitFor(() => expect(state.setAvailability).toHaveBeenCalledTimes(1));
    state.setAvailability.mockClear();
    state.toast.success.mockClear();
    const again = base();
    renderHook(() => useRsvpFromNotice(again));
    await asks(again);
  });

  it("an expired ticket asks (and is spent)", async () => {
    ticket(N, { rsvp: "yes", m: "j3", exp: Date.now() - 1 });
    const args = base();
    renderHook(() => useRsvpFromNotice(args));
    await asks(args);
    expect(store.size).toBe(0);
  });

  it("a ticket for another answer or match asks", async () => {
    ticket(N, { rsvp: "no", m: "j3", exp: Date.now() + RSVP_TICKET_MS });
    const other = base();
    renderHook(() => useRsvpFromNotice(other));
    await asks(other);
    ticket(N, { rsvp: "yes", m: "j1", exp: Date.now() + RSVP_TICKET_MS });
    state.toast.mockClear();
    const otherMatch = base();
    renderHook(() => useRsvpFromNotice(otherMatch));
    await asks(otherMatch);
  });

  it("no Cache API: asks", async () => {
    vi.stubGlobal("caches", undefined);
    const args = base();
    renderHook(() => useRsvpFromNotice(args));
    await asks(args);
  });
});

describe("what never writes nor asks", () => {
  it("a closed convocatoria: «ya está cerrada», params cleared", async () => {
    ticket(N, { rsvp: "yes", m: "gone", exp: Date.now() + RSVP_TICKET_MS });
    const args = base({ m: "gone" });
    renderHook(() => useRsvpFromNotice(args));
    await settle();
    expect(state.setAvailability).not.toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalledTimes(1);
    expect(state.toast).toHaveBeenCalledWith("La convocatoria ya está cerrada");
    expect(args.clear).toHaveBeenCalledTimes(1);
  });

  it("not a member: nothing at all", async () => {
    ticket(N, { rsvp: "yes", m: "j3", exp: Date.now() + RSVP_TICKET_MS });
    const args = base({ member: false });
    renderHook(() => useRsvpFromNotice(args));
    const noProfile = base({ me: null });
    renderHook(() => useRsvpFromNotice(noProfile));
    await settle();
    expect(state.setAvailability).not.toHaveBeenCalled();
    expect(state.toast).not.toHaveBeenCalled();
    expect(state.toast.success).not.toHaveBeenCalled();
    expect(args.clear).not.toHaveBeenCalled();
    expect(store.size).toBe(1);
  });

  it("an unknown match or half a link: the params leave the URL", async () => {
    const unknown = base({ m: "nope" });
    renderHook(() => useRsvpFromNotice(unknown));
    const half = base({ rsvp: undefined });
    renderHook(() => useRsvpFromNotice(half));
    await settle();
    expect(state.setAvailability).not.toHaveBeenCalled();
    expect(state.toast).not.toHaveBeenCalled();
    expect(unknown.clear).toHaveBeenCalledTimes(1);
    expect(half.clear).toHaveBeenCalledTimes(1);
  });

  it("a plain /vestuario does nothing", async () => {
    const args = base({ rsvp: undefined, m: undefined, n: undefined });
    renderHook(() => useRsvpFromNotice(args));
    await settle();
    expect(args.clear).not.toHaveBeenCalled();
    expect(state.setAvailability).not.toHaveBeenCalled();
  });
});

describe("the toasts' words", () => {
  it("without a jornada, just the rival", () => {
    expect(rsvpToastText("yes", { rival: "MAD SKY" }, null)).toBe("Apuntado: Voy · vs MAD SKY");
    expect(rsvpToastText("no", { rival: undefined }, 5)).toBe("Apuntado: No puedo · J5 vs Rival");
    expect(rsvpAskText("no", { rival: "Rival" }, 5)).toBe("¿Apuntarte como No puedo · J5 vs Rival?");
  });
});
