// The design's match night (BRIEF2): the real squad against Orduña fc on Sunday 18 Oct 2026 at 19:00, its
// convocatoria, its plays and its acta, built into FrontRows through frontRowOf. The tests and the dev
// harness read the same scenes.
import { readyClock, transitionClock } from "../../../../functions/src/matchClock";
import { calculateLedger } from "../../../../functions/src/matchEngine";
import type { ClubMatch, MatchEvent } from "../../../lib/clubData";
import { frontRowOf, type FrontRowInput } from "../../../lib/derived/frontRow";
import type { MatchdayModel, MatchdayPhase, ViewerRole } from "../../../lib/derived/matchday";
import type { LightKey } from "../../../lib/derived/sun";
import type { MvpResult } from "../../../lib/vestuario";
import type { Me } from "../../../pages/vestuario/writes";
import type { PrimeraFilaProps } from "./PrimeraFila";

const MIN = 60_000;
const HOUR = 60 * MIN;
export const KO = Date.UTC(2026, 9, 18, 17); // Sunday 18 Oct 2026, 19:00 Madrid
const ts = (ms: number) => ({ seconds: Math.floor(ms / 1000), nanoseconds: 0 });

export const SQUAD = (
  [
    ["evans", 1, "Evans", "POR"], ["illescas", 4, "Illescas", "DFC"], ["alcides", 7, "Alcides", "DC"], ["josito", 8, "Josito", "MC"],
    ["erik", 9, "Erik", "DC"], ["adrian", 10, "Adrián T.C.", "MC"], ["kevin", 11, "Kevin", "ED"], ["fer", 12, "Fer", "LI"],
    ["huberoski", 14, "Huberoski", "MC"], ["andia", 19, "Andia", "DFC"], ["pellete", 20, "Pellete", "MC"], ["almachi", 21, "Almachi", "EI"],
    ["eguzquiza", 22, "Eguzquiza", "MC"], ["jordi", 28, "Jordi", "LD"], ["jorge", 30, "Jorge", "DFC"], ["brawan", 33, "Brawan", "DC"],
  ] as const
).map(([id, n, name, position]) => ({ id, dorsal: String(n), name, position }));
export const SEVEN = ["evans", "fer", "illescas", "jordi", "adrian", "eguzquiza", "alcides"];
export const BENCH = ["erik", "kevin", "jorge", "brawan"];
const LINEUP = {
  system: "2-3-1",
  boardId: "b1",
  setBy: "uid-capi",
  setAt: KO - 3 * HOUR,
  slots: [
    { playerId: "evans", code: "POR", x: 50, y: 95 },
    { playerId: "fer", code: "LI", x: 15, y: 70 },
    { playerId: "illescas", code: "DFC", x: 50, y: 75 },
    { playerId: "jordi", code: "LD", x: 85, y: 70 },
    { playerId: "adrian", code: "MC", x: 35, y: 45 },
    { playerId: "eguzquiza", code: "MC", x: 65, y: 45 },
    { playerId: "alcides", code: "DC", x: 50, y: 15 },
  ],
};

const at = (m: number) => (m - 1) * 60 + 20;
const play = (id: string, type: MatchEvent["type"], m: number, period: 1 | 2, extra: Partial<MatchEvent> = {}): MatchEvent => ({ id, type, elapsedSeconds: at(m), minute: m - 1, period, byUid: "uid-hube", ...extra });
const FIRST_HALF: MatchEvent[] = [
  play("e1", "goal", 6, 1, { playerId: "alcides", assistPlayerId: "adrian", assistReviewed: true }),
  play("e2", "opponent_goal", 11, 1),
  play("e3", "yellow_card", 15, 1, { playerId: "eguzquiza" }),
  play("e4", "woodwork", 18, 1, { playerId: "adrian" }),
  play("e5", "goal", 21, 1, { playerId: "adrian", assistPlayerId: "jordi", assistReviewed: true }),
];
const SECOND_HALF: MatchEvent[] = [
  play("e6", "substitution", 30, 2, { playerId: "illescas", inPlayerId: "erik" }),
  play("e7", "penalty_saved", 34, 2, { playerId: "evans" }),
  play("e8", "substitution", 35, 2, { playerId: "eguzquiza", inPlayerId: "kevin" }),
  play("e9", "goal", 44, 2, { playerId: "kevin", assistReviewed: true }),
];
export const EVENTS = { FIRST_HALF, SECOND_HALF, red: play("r1", "red_card", 40, 2, { playerId: "fer" }), knock: [play("i1", "injury", 20, 1, { playerId: "illescas" }), play("i2", "substitution", 20, 1, { playerId: "illescas", inPlayerId: "erik" })] };

const started = transitionClock(readyClock(), "start", KO);
const half = transitionClock(started, "halftime", KO + 25 * MIN);
const second = transitionClock(half, "second", KO + 32 * MIN);
const ended = transitionClock(second, "finish", KO + 57 * MIN);
const WHISTLE = KO + 57 * MIN;

export const BASE: ClubMatch = {
  id: "j1",
  seasonId: "t1",
  version: 2,
  status: "scheduled",
  rival: "Orduña fc",
  date: ts(KO),
  duration: 50,
  home: true,
  venue: "Palomeras",
  clock: readyClock(),
  starters: SEVEN,
  bench: BENCH,
  notCalled: ["josito", "huberoski", "pellete", "almachi", "andia"],
  events: [],
};
const withLineup = (m: ClubMatch): ClubMatch => ({ ...m, lineup: LINEUP }) as ClubMatch;
const allEvents = [...FIRST_HALF, ...SECOND_HALF];
const ledger = calculateLedger({ starters: SEVEN, bench: BENCH, notCalled: BASE.notCalled ?? [], events: allEvents, duration: 50 }, false).players;
ledger.erik = { ...ledger.erik, minutes: 20 };
export const ACTA: ClubMatch = withLineup({ ...BASE, clock: ended, events: allEvents, status: "finished", goalsFor: 3, goalsAgainst: 1, liveEndedAt: WHISTLE, voteClosesAt: WHISTLE + 48 * HOUR, ledger });
const NEXT: ClubMatch = { ...BASE, id: "j2", rival: "Pitutis", home: false, date: ts(KO + 7 * 24 * HOUR), starters: [], bench: [], notCalled: [] };

export const ANSWERS: NonNullable<FrontRowInput["answers"]> = [
  { playerId: "adrian", response: "yes" },
  { playerId: "jordi", response: "yes" },
  { playerId: "brawan", response: "yes" },
  { playerId: "erik", response: "yes" },
];

const PLAYER_OF: Record<ViewerRole, string | null> = { titular: "jordi", suplente: "erik", noconvocado: "josito", ausente: "andia", anotador: "huberoski", aficionado: null };
export const meOf = (viewer: ViewerRole): Me | null => {
  const id = PLAYER_OF[viewer];
  if (!id) return null;
  const p = SQUAD.find((s) => s.id === id);
  return { uid: `u-${id}`, name: p?.name ?? id, playerId: id };
};

export interface SceneOpts {
  viewer?: ViewerRole;
  answers?: FrontRowInput["answers"];
  seven?: readonly string[];
  light?: LightKey;
  myVote?: string;
  status?: PrimeraFilaProps["status"];
  variant?: "roja" | "lesion" | "subs";
}

/** One scene of the design at a phase, for a viewer: the props PrimeraFila takes. */
export function scene(phase: MatchdayPhase, o: SceneOpts = {}): PrimeraFilaProps {
  const viewer = o.viewer ?? "titular";
  const member = viewer !== "aficionado";
  const me = meOf(viewer);
  let match: ClubMatch | null = withLineup(BASE);
  let now = KO - 2 * HOUR;
  let minute: number | null = null;
  let added: number | null = null;
  let score: MatchdayModel["score"] = null;
  let seven = o.seven ?? SEVEN;
  let mvpVoteOpen = false;
  let mvpResults: Map<string, MvpResult> | undefined;
  let history: ClubMatch[] | undefined;
  let next: ClubMatch | null = null;
  if (phase === "pretemporada") {
    match = null;
    seven = [];
  } else if (phase === "semana") {
    now = KO - 4 * 24 * HOUR;
    seven = o.seven ?? [];
    match = { ...BASE, starters: [], bench: [], notCalled: [] };
  } else if (phase === "aplazado") {
    match = withLineup({ ...BASE, status: "postponed" });
  } else if (phase === "pitido") {
    now = KO + 3 * MIN;
  } else if (phase === "directo1" || phase === "descanso" || phase === "directo2") {
    const events = phase === "directo2" ? (o.variant === "roja" ? [...allEvents, EVENTS.red] : allEvents) : o.variant === "lesion" ? [...FIRST_HALF, ...EVENTS.knock] : FIRST_HALF;
    const clock = phase === "directo1" ? started : phase === "descanso" ? half : second;
    match = withLineup({ ...BASE, clock, events });
    now = phase === "directo1" ? KO + 22 * MIN : phase === "descanso" ? KO + 28 * MIN : KO + 52 * MIN;
    minute = phase === "directo1" ? 21 : phase === "descanso" ? 25 : 50;
    added = phase === "directo2" ? 2 : null;
    score = phase === "directo2" ? { gf: 3, ga: 1 } : { gf: 2, ga: 1 };
  } else if (phase === "final") {
    match = withLineup({ ...BASE, clock: ended, events: allEvents });
    now = WHISTLE + 5 * MIN;
    score = { gf: 3, ga: 1 };
  } else if (phase === "acta" || phase === "despues") {
    match = ACTA;
    history = [ACTA];
    score = { gf: 3, ga: 1 };
    if (phase === "acta") {
      now = WHISTLE + HOUR;
      mvpVoteOpen = true;
      mvpResults = new Map();
    } else {
      now = WHISTLE + 49 * HOUR;
      mvpResults = new Map([["j1", { id: "j1", counts: { alcides: 5, kevin: 2 }, total: 7 }]]);
      next = NEXT;
    }
  }
  const answers = member ? (o.answers ?? (phase === "semana" ? ANSWERS.slice(0, 2) : ANSWERS)) : null;
  const row = frontRowOf({
    match,
    phase,
    squad: SQUAD,
    seven,
    answers,
    absentIds: ["andia"],
    viewerPlayerId: me?.playerId ?? null,
    scorerIds: ["huberoski"],
    mvpVoteOpen,
    now,
    history,
    mvpResults,
  });
  const mine = me?.playerId ? answers?.find((a) => a.playerId === me.playerId)?.response ?? null : null;
  return {
    row,
    day: { phase, match, next, minute, added, score },
    viewer,
    light: o.light ?? (phase === "semana" || phase === "despues" || phase === "pretemporada" ? "tarde" : phase === "antes" || phase === "pitido" ? "dorada" : phase === "directo1" || phase === "descanso" ? "ocaso" : "noche"),
    me,
    myAnswer: mine,
    myVote: o.myVote ?? "",
    now,
    status: o.status,
    staleSince: o.status === "offline" ? now - 2 * MIN : null,
  };
}
