// Fixtures for the mesa screens' tests: a MesaView shaped like useMesa's, with spied actions and nav.
import { vi } from "vitest";
import type { MesaClock, MesaEvent, MesaPlayer, MesaView } from "../types";

export const T0 = new Date(2026, 9, 18, 10, 30).getTime();

export function player(id: string, name: string, number: string, extra: Partial<MesaPlayer> = {}): MesaPlayer {
  return {
    id, name, number, guest: false, keeper: false, minutes: 0,
    stickers: { goals: 0, assists: 0, yellow: false, red: false, injured: false },
    pending: 0, played: false, offAt: null, sentOff: false, stints: [], spot: null, ...extra,
  };
}

const on = (p: MesaPlayer, from: number, to: number | null = null, minutes = 0): MesaPlayer => ({ ...p, played: true, minutes, stints: [...p.stints, { from, to }] });

/** Álex (keeper), Mario, Sergio, Dani, Marcos, Pablo, David on the pitch; Hugo, Rubén, Iván on the bench. */
export function squad(mins = 0) {
  const field = [
    on(player("alex", "Álex", "1", { keeper: true, spot: { x: 50, y: 95 } }), 0, null, mins),
    on(player("mario", "Mario", "7", { spot: { x: 50, y: 22 } }), 0, null, mins),
    on(player("sergio", "Sergio", "5", { spot: { x: 50, y: 50 } }), 0, null, mins),
    on(player("dani", "Dani", "2", { spot: { x: 30, y: 74 } }), 0, null, mins),
    on(player("marcos", "Marcos", "3", { spot: { x: 70, y: 74 } }), 0, null, mins),
    on(player("pablo", "Pablo", "4", { spot: { x: 17, y: 49 } }), 0, null, mins),
    on(player("david", "David", "6", { spot: { x: 83, y: 49 } }), 0, null, mins),
  ];
  const bench = [player("hugo", "Hugo", "8"), player("ruben", "Rubén", "9"), player("ivan", "Iván", "10")];
  return { field, bench };
}

export function ev(id: string, type: MesaEvent["type"], minute: number, extra: Partial<MesaEvent> = {}): MesaEvent {
  const them = type.startsWith("opponent_") && type !== "opponent_own_goal";
  const goal = ["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"].includes(type) ? "us" : ["opponent_goal", "own_goal"].includes(type) ? "them" : null;
  return {
    id, type, side: them ? "them" : "us", minute, elapsedSeconds: (minute - 1) * 60 + 10, period: 1,
    playerId: null, playerName: null, assistId: null, assistName: null, inPlayerId: null, inName: null,
    text: id, tag: "", goal: goal as MesaEvent["goal"], pendingScorer: false, assistReviewed: false,
    byUid: "u-pablo", byName: "Pablo", editedByUid: null, editedByName: null, editedAt: null,
    dupOf: null, queued: false, local: false, mine: true, ...extra,
  };
}

export function clock(extra: Partial<MesaClock> = {}): MesaClock {
  return { phase: "ready", playing: false, held: false, elapsedSeconds: 0, periodSeconds: 0, period: 1, halfSeconds: 1500, added: 0, minute: 1, text: "00:00", revision: 1, breakSeconds: 0, kickoffAt: null, secondAt: null, ...extra };
}

export function makeView(over: Partial<Omit<MesaView, "match">> & { clock?: Partial<MesaClock>; match?: Partial<Omit<MesaView["match"], "clock">> } = {}): MesaView {
  const { clock: c, match: m, ...rest } = over;
  const { field, bench } = squad();
  const players = [...(rest.field ?? field), ...(rest.bench ?? bench)];
  return {
    match: {
      id: "m7", seasonId: "s1", rival: "Atlético Demo", rivalShort: "ATL", rivalInitials: "AD", competition: "Liga", round: null, lineup: { fromBoard: false, system: null }, hasStandings: false, home: true,
      date: T0, score: { us: 0, them: 0 }, queuedGoals: { us: 0, them: 0 }, clock: clock(c), published: false, pendingDuplicates: 0, ...m,
    },
    field, bench, events: [],
    presence: [
      { uid: "u-pablo", name: "Pablo", at: T0, fresh: true, me: true },
      { uid: "u-david", name: "David", at: T0, fresh: true, me: false },
    ],
    me: { uid: "u-pablo", name: "Pablo", admin: false },
    queue: { online: true, pending: 0, byPlayer: {}, items: [], review: [], lastTryAt: null },
    lastOwn: null, nextSub: null,
    nameOf: (id: string) => players.find((p) => p.id === id)?.name ?? id,
    notice: "",
    actions: {
      add: vi.fn(() => "live-x"),
      addMany: vi.fn((subs: readonly unknown[]) => subs.map((_, i) => `live-w-${i}`)),
      edit: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
      undo: vi.fn(async () => {}),
      clock: vi.fn(async () => {}),
      publish: vi.fn(async () => {}),
      reopen: vi.fn(async () => {}),
      resend: vi.fn(),
      discard: vi.fn(),
      retryNow: vi.fn(),
    },
    nav: { cronica: vi.fn(), mesa: vi.fn(), exit: vi.fn(), acta: vi.fn(), pizarra: vi.fn() },
    ...rest,
  };
}
