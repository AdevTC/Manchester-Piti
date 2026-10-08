// /profile tests: the profile's data and callables as fakes (no Firebase), shared by the test files.
import { render } from "@testing-library/react";
import { vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import type { DoorRequestRow } from "../vestuario/live";
import type { SquadPlayer } from "../pizarra/v2/ratings";
import { buildCard, type FichaState } from "./card";
import { ProfileView, type ProfileActions } from "./ProfileView";
import type { ProfileData } from "./useProfileData";

export const DAY = 86_400_000;
let seq = 0;
const ev = (type: "match_played" | "goal", playerId: string, assistPlayerId?: string) => ({ id: `e${seq++}`, type, playerId, ...(assistPlayerId ? { assistPlayerId } : {}) });
export const match = (id: string, day: number, events: ClubMatch["events"], extra: Partial<ClubMatch> = {}): ClubMatch => ({ id, seasonId: "t1", rival: `Rival ${id}`, status: "finished", date: day * DAY, goalsFor: 1, goalsAgainst: 0, events, ...extra });
const player = (id: string, number: number, naturalPosition: string, shirtName: string): SquadPlayer => ({ id, shirtName, firstName: id, number, naturalPosition, injured: false, active: true });
export const SQUAD = [player("adri", 10, "DEL", "ADRI"), player("erik", 9, "DEL", "ERIK"), player("evans", 1, "POR", "EVANS"), player("illescas", 4, "DEF", "ILLESCAS")];
export const PLAYED = [match("j1", 10, [ev("match_played", "adri"), ev("match_played", "erik"), ev("goal", "adri", "erik")]), match("j2", 17, [ev("match_played", "adri"), ev("goal", "adri")])];
export const FUTURE = [match("j1", 500, [], { status: "scheduled", goalsFor: undefined, goalsAgainst: undefined, rival: "MAD SKY" })];

export function doorRow(i: number, extra: Partial<DoorRequestRow> = {}): DoorRequestRow {
  return { uid: "r" + i, status: "pending", googleName: "Google " + i, email: `r${i}@example.com`, photo: "", playerId: null, playerName: null, name: "Socio " + i, at: 400 * DAY - (i + 1) * 3_600_000, ...extra };
}

export function makeData(o: { state?: FichaState; captain?: boolean; superadmin?: boolean; started?: boolean; playerId?: string | null; doors?: number | DoorRequestRow[] } = {}): ProfileData {
  const state = o.state ?? "vinculada";
  const playerId = o.playerId !== undefined ? o.playerId : state === "sin-ficha" ? null : state === "pendiente" ? "erik" : "adri";
  const card = buildCard({
    state,
    playerId,
    nickname: "adrian_tc",
    captain: !!o.captain,
    squad: SQUAD,
    matches: o.started === false ? FUTURE : PLAYED,
    seasonId: "t1",
    seasonName: "Temporada 1",
    seasons: [{ id: "t1", name: "Temporada 1" }],
    mvpResults: new Map(),
    now: 400 * DAY,
  });
  return {
    loading: false,
    error: false,
    uid: "u1",
    nickname: "adrian_tc",
    role: o.captain ? "admin" : "user",
    isCaptain: !!o.captain,
    isSuperadmin: !!o.superadmin,
    google: { name: "Adrián", email: "adrian@example.com", photo: null },
    access: { since: 1, sinceText: "sep 2026", howIn: "Por invitación", whoOpened: "@capi" },
    seasonId: "t1",
    seasonName: "Temporada 1",
    ficha: { state, playerId, rejectedPlayerId: null, claim: null },
    shirt: { current: state === "vinculada" ? "ADRI" : "", number: state === "vinculada" ? "10" : "", squad: SQUAD.map((p) => ({ id: p.id, name: p.shirtName, number: p.number })), fullName: "Adrián Tello" },
    card,
    freeFichas: [{ id: "illescas", name: "ILLESCAS", number: "4", posLong: "Defensa", rating: 60 }],
    next: null,
    upcoming: [],
    stuff: { boards: { count: 0, last: null }, porra: null, convocatorias: { answered: 0, total: 0, yes: 0, maybe: 0, no: 0, next: null, nextId: null }, loading: false },
    captain: o.captain ? { doorRequests: Array.isArray(o.doors) ? o.doors : Array.from({ length: o.doors ?? 0 }, (_, i) => doorRow(i)), pendingClaims: [] } : null,
  };
}

export function fakeActions(over: Partial<ProfileActions> = {}): ProfileActions {
  return {
    setShirtName: vi.fn(async (name: string) => ({ shirtName: name, previous: "ADRI", changed: true })),
    setNickname: vi.fn(async (n: string) => n),
    nicknameTaken: vi.fn(async () => false),
    cancelClaim: vi.fn(async () => undefined),
    requestClaim: vi.fn(async () => ({ linked: false })),
    signOut: vi.fn(async () => undefined),
    leaveVestuario: vi.fn(async () => undefined),
    ...over,
  };
}

export const view = (data = makeData(), actions = fakeActions()) => render(<ProfileView data={data} actions={actions} now={400 * DAY} origin="https://manchesterpiti.test" />);
export const root = (c: HTMLElement) => c.querySelector(".pcv") as HTMLElement;
export const heroCard = (c: HTMLElement) => c.querySelector("button.cd") as HTMLElement;
export const noIntro = () => localStorage.setItem("mp_perfil_prefs", JSON.stringify({ intro: "nunca", tilt: true }));
export const setUrl = (hash: string) => window.history.replaceState(null, "", "/profile" + hash);

