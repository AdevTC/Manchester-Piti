import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { RsvpFromNotice } from "./useRsvpFromNotice";

// «Responder desde el aviso»: /vestuario?rsvp=&m= writes the answer once (the RSVP switch's own write),
// toasts it with «Deshacer», and clears the params. The write and the toasts are stubbed.
const state = vi.hoisted(() => ({
  setAvailability: vi.fn(async (..._args: unknown[]) => undefined),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("./writes", () => ({ setAvailability: state.setAvailability }));
vi.mock("sonner", () => ({ toast: state.toast }));

const { useRsvpFromNotice, rsvpToastText } = await import("./useRsvpFromNotice");

const NOW = Date.UTC(2026, 9, 16, 10);
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

const base = (over: Partial<RsvpFromNotice> = {}): RsvpFromNotice => ({
  rsvp: "yes",
  m: "j3",
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
  state.setAvailability.mockClear();
  state.toast.mockClear();
  state.toast.success.mockClear();
  state.toast.error.mockClear();
});

type ToastOpts = { duration?: number; action?: { label: string; onClick: () => void } };
const lastSuccess = () => state.toast.success.mock.calls.at(-1) as [string, ToastOpts] | undefined;

describe("answering from a notice", () => {
  it("writes the answer once, toasts it and clears the params", () => {
    const args = base();
    const { rerender } = renderHook((p: RsvpFromNotice) => useRsvpFromNotice(p), { initialProps: args });
    // re-renders before the URL clears (new objects, a clock tick) never write again
    rerender({ ...args, me: { ...ME }, now: NOW + 60_000 });
    rerender({ ...args, previous: { loading: false, answer: "yes" } });
    expect(state.setAvailability).toHaveBeenCalledTimes(1);
    expect(state.setAvailability).toHaveBeenCalledWith(ME, "j3", "yes");
    expect(args.clear).toHaveBeenCalledTimes(1);
    const [text, opts] = lastSuccess()!;
    expect(text).toBe("Apuntado: Voy · J4 vs MAD SKY");
    expect(opts.action?.label).toBe("Deshacer");
    expect(state.toast.success).toHaveBeenCalledTimes(1);
  });

  it("«No puedo» says so", () => {
    renderHook(() => useRsvpFromNotice(base({ rsvp: "no" })));
    expect(state.setAvailability).toHaveBeenCalledWith(ME, "j3", "no");
    expect(lastSuccess()![0]).toBe("Apuntado: No puedo · J4 vs MAD SKY");
  });

  it("«Deshacer» puts back the previous answer", async () => {
    renderHook(() => useRsvpFromNotice(base({ rsvp: "no", previous: { loading: false, answer: "yes" } })));
    await act(async () => lastSuccess()![1].action!.onClick());
    expect(state.setAvailability).toHaveBeenCalledTimes(2);
    expect(state.setAvailability).toHaveBeenLastCalledWith(ME, "j3", "yes");
    expect(state.toast).toHaveBeenCalledWith("Vuelves a «Voy»");
  });

  it("nothing to undo without a different previous answer (the rules never delete an answer)", () => {
    renderHook(() => useRsvpFromNotice(base({ previous: { loading: false, answer: undefined } })));
    expect(state.setAvailability).toHaveBeenCalledTimes(1);
    expect(lastSuccess()![1].action).toBeUndefined();
  });

  it("waits for the previous answer before writing", () => {
    const args = base({ previous: { loading: true, answer: undefined } });
    const { rerender } = renderHook((p: RsvpFromNotice) => useRsvpFromNotice(p), { initialProps: args });
    expect(state.setAvailability).not.toHaveBeenCalled();
    expect(args.clear).not.toHaveBeenCalled();
    rerender({ ...args, previous: { loading: false, answer: "no" } });
    expect(state.setAvailability).toHaveBeenCalledTimes(1);
    expect(lastSuccess()![1].action?.label).toBe("Deshacer");
  });

  it("waits for the matches", () => {
    const args = base({ matches: [], matchesLoading: true });
    const { rerender } = renderHook((p: RsvpFromNotice) => useRsvpFromNotice(p), { initialProps: args });
    expect(args.clear).not.toHaveBeenCalled();
    rerender({ ...args, matches: MATCHES, matchesLoading: false });
    expect(state.setAvailability).toHaveBeenCalledTimes(1);
  });

  it("a closed convocatoria: «ya está cerrada», no write, params cleared", () => {
    const args = base({ m: "gone" });
    renderHook(() => useRsvpFromNotice(args));
    expect(state.setAvailability).not.toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalledWith("La convocatoria ya está cerrada");
    expect(args.clear).toHaveBeenCalledTimes(1);
  });

  it("not a member: nothing at all", () => {
    const args = base({ member: false });
    renderHook(() => useRsvpFromNotice(args));
    const noProfile = base({ me: null });
    renderHook(() => useRsvpFromNotice(noProfile));
    expect(state.setAvailability).not.toHaveBeenCalled();
    expect(state.toast).not.toHaveBeenCalled();
    expect(state.toast.success).not.toHaveBeenCalled();
    expect(args.clear).not.toHaveBeenCalled();
  });

  it("an unknown match or half a link: no write, the params leave the URL", () => {
    const unknown = base({ m: "nope" });
    renderHook(() => useRsvpFromNotice(unknown));
    const half = base({ rsvp: undefined });
    renderHook(() => useRsvpFromNotice(half));
    expect(state.setAvailability).not.toHaveBeenCalled();
    expect(unknown.clear).toHaveBeenCalledTimes(1);
    expect(half.clear).toHaveBeenCalledTimes(1);
  });

  it("a plain /vestuario does nothing", () => {
    const args = base({ rsvp: undefined, m: undefined });
    renderHook(() => useRsvpFromNotice(args));
    expect(args.clear).not.toHaveBeenCalled();
    expect(state.setAvailability).not.toHaveBeenCalled();
  });

  it("a failed write says so", async () => {
    state.setAvailability.mockRejectedValueOnce(new Error("permission-denied"));
    await act(async () => {
      renderHook(() => useRsvpFromNotice(base()));
    });
    expect(state.toast.error).toHaveBeenCalledWith("No se ha podido guardar tu respuesta. Prueba desde el partido.");
  });
});

describe("the toast's words", () => {
  it("without a jornada, just the rival", () => {
    expect(rsvpToastText("yes", { rival: "MAD SKY" }, null)).toBe("Apuntado: Voy · vs MAD SKY");
    expect(rsvpToastText("no", { rival: undefined }, 5)).toBe("Apuntado: No puedo · J5 vs Rival");
  });
});
