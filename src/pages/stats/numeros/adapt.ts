// «Números»: production's data in the shape the NU- boards compute from (their prep-real.mjs, run on the page):
// one season's matches in jornada order with their events, the acta's ledger (minutes, stints, positions and the
// narrated counts), the partial analysis (coverage, passes sender → receiver, 5′ stretches), the MVP of each
// closed vote, the league table the captain publishes and the porra. Pure.
import type { ClubMatch, MatchEvent } from "../../../lib/clubData";
import type { MvpResult } from "../../../lib/vestuario";
import type { StandingRow } from "../../../lib/standings";
import type { StripSegment } from "../../../lib/derived/vidrio/strip";
import type { LRow, NMatch, NSeasonData, SquadP, StandRow, Tramo } from "./nd";
import { slug } from "./nd";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** The narrated families in plain Spanish (the boards' FAM). */
const FAM: Record<string, string> = {
  context: "Contexto", lineup: "Alineación", recovery: "Recuperaciones", pass: "Pases", duel: "Duelos", restart: "Reanudaciones", reception: "Recepciones",
  dribble: "Regates", interception: "Interceptaciones", goal: "Goles", clearance: "Despejes", shot: "Remates", save: "Paradas", discipline: "Disciplina",
  tackle: "Entradas", loss: "Pérdidas", control: "Controles", carry: "Conducciones", keeper: "Portero", distribution: "Saques del portero", pressure: "Presión",
  tactical: "Táctica", substitution: "Cambios", block: "Bloqueos", judgement: "Arbitraje",
};
const GOAL = new Set(["goal", "goal_penalty", "goal_freekick"]);
/** Narration v1: an event type → the observation it stands for. */
const V1_KIND: Record<string, string> = { pass: "pass", cross: "pass", shot: "shot", recovery: "recovery", turnover: "loss", save: "save" };

/** «Dom 25 oct», «25 de octubre», the month (1–12) and «14:00», on Madrid's clock. */
export function madridWhen(ms: number | null): { day: string; long: string; month: number; time: string } {
  if (ms == null || !Number.isFinite(ms)) return { day: "Fecha por confirmar", long: "fecha por confirmar", month: 0, time: "--:--" };
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(ms)
      .map((p) => [p.type, p.value]),
  );
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday ?? "");
  const d = Number(parts.day);
  const mo = Number(parts.month);
  return { day: `${DAYS[Math.max(0, wd)]} ${d} ${MON[mo - 1]}`, long: `${d} de ${MONL[mo - 1]}`, month: mo, time: `${parts.hour}:${parts.minute}` };
}

type Num = number | undefined;
const n0 = (v: Num | null): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** The acta's ledger line in the boards' keys (prep-real.mjs). */
function ledgerRow(l: Record<string, unknown>): LRow {
  const g = (k: string) => n0(l[k] as Num);
  const stints = Array.isArray(l.stints) ? (l.stints as { from?: number; to?: number }[]) : [];
  const pos = (l.positionsPlayed && typeof l.positionsPlayed === "object" ? l.positionsPlayed : {}) as Record<string, unknown>;
  return {
    min: g("minutes"), tit: l.started ? 1 : 0, ban: l.benched ? 1 : 0, nc: l.notCalled ? 1 : 0, pl: l.played ? 1 : 0, sin: g("subIn"), sout: g("subOut"),
    st: stints.filter((s) => isNum(s.from) && isNum(s.to)).map((s) => [s.from as number, s.to as number]),
    dy: g("doubleYellows"), pcm: g("penaltyCommitted"), prc: g("penaltyReceived"), psv: g("penaltySaved"), pms: g("penaltyMissed"), gpen: g("goalPenalty"), gfk: g("goalFreekick"),
    wood: g("woodwork"), ch: g("chances"), sv: g("saves"), f: g("fouls"), fr: g("foulsReceived"),
    pas: g("passes"), pok: g("passesCompleted"), pko: g("passesFailed"), kp: g("keyPasses"), cr: g("crosses"), sh: g("shots"), sot: g("shotsOnTarget"),
    tov: g("turnovers"), rec: g("recoveries"), int: g("interceptions"), tk: g("tackles"), cl: g("clearances"), bl: g("blocks"), du: g("duels"), duw: g("duelsWon"),
    dr: g("dribbles"), to: g("touches"),
    pos: Object.fromEntries(Object.entries(pos).filter(([, v]) => isNum(v) && v > 0)) as Record<string, number>,
  };
}

interface Obs {
  kind?: string;
  team?: string;
  actorId?: string;
  receiverId?: string;
  facts?: { outcome?: string };
  time?: { from?: number };
}

/** The partial analysis of a narrated acta: coverage per family, pass pairs, the ten 5′ stretches, the rival's counts. */
function analysisOf(m: ClubMatch) {
  const a = (m.analysis ?? {}) as { observations?: Obs[]; coverage?: { family?: string; team?: string; state?: string }[] };
  // the plays typed into the acta as events (narration v1) read like the observations
  const typed = (m.events ?? []).filter((e) => V1_KIND[e.type]).map((e): Obs => {
    const x = e as MatchEvent & { receiverId?: string; outcome?: string };
    return { kind: V1_KIND[e.type], team: e.type.startsWith("opponent_") ? "them" : "us", actorId: e.playerId, receiverId: x.receiverId, facts: { outcome: x.outcome }, time: isNum(e.minute) ? { from: e.minute * 60 } : undefined };
  });
  const obs = [...(Array.isArray(a.observations) ? a.observations : []), ...typed];
  const coverage = (Array.isArray(a.coverage) ? a.coverage : []).map((x): [string, "us" | "them", string] => [FAM[x.family ?? ""] ?? x.family ?? "", x.team === "us" ? "us" : "them", x.state ?? ""]);
  const pairs: Record<string, number> = {};
  obs
    .filter((o) => o.kind === "pass" && o.team === "us" && o.actorId && o.receiverId && o.facts?.outcome === "complete")
    .forEach((o) => {
      const k = `${o.actorId}>${o.receiverId}`;
      pairs[k] = (pairs[k] || 0) + 1;
    });
  const passPairs = Object.entries(pairs)
    .map(([k, n]): [string, string, number] => {
      const [x, y] = k.split(">");
      return [x, y, n];
    })
    .sort((x, y) => y[2] - x[2])
    .slice(0, 12);
  const tramos: Tramo[] = Array.from({ length: 10 }, () => ({ pas: 0, pok: 0, sh: 0, rec: 0, loss: 0, tsh: 0 }));
  obs.forEach((o) => {
    if (!o.time || !isNum(o.time.from)) return;
    const t = tramos[Math.max(0, Math.min(9, Math.floor(o.time.from / 300)))];
    if (o.team === "us") {
      if (o.kind === "pass") {
        t.pas++;
        if (o.facts?.outcome === "complete") t.pok++;
      }
      if (o.kind === "shot") t.sh++;
      if (o.kind === "recovery") t.rec++;
      if (o.kind === "loss") t.loss++;
    } else if (o.kind === "shot") t.tsh++;
  });
  const them = { pas: 0, sh: 0, rec: 0, loss: 0, sv: 0 };
  obs
    .filter((o) => o.team !== "us")
    .forEach((o) => {
      if (o.kind === "pass") them.pas++;
      if (o.kind === "shot") them.sh++;
      if (o.kind === "recovery") them.rec++;
      if (o.kind === "loss") them.loss++;
      if (o.kind === "save") them.sv++;
    });
  return { coverage, passPairs, tramos, them, note: typeof m.analysisNotes === "string" ? m.analysisNotes : "" };
}

export interface AdaptInput {
  /** The season's strip at now (seasonStrip): the one jornada numbering, each match's state and score. */
  segments: readonly StripSegment[];
  seasonId: string;
  seasonName: string;
  league: string;
  standings: readonly StandingRow[];
  /** MVP winners of each closed vote, by match id. */
  mvpOf: (m: ClubMatch) => string[];
  mvpResults: ReadonlyMap<string, MvpResult>;
  porra: NSeasonData["porra"];
  real: boolean;
  mvpDemo?: boolean;
}

/** One season, as the boards read it. A cancelled match is no jornada; tonight's (or one played without its acta)
 *  counts «si acaba así». */
export function seasonData(inp: AdaptInput): NSeasonData {
  const segs = inp.segments.filter((s) => s.state !== "suspendido");
  const matches = segs.map((s, i): NMatch => {
    const m = s.match;
    const ev: MatchEvent[] = (m.events ?? []).filter((e) => e && typeof e.type === "string");
    const finished = s.state === "jugado" && !s.provisional;
    const st: NMatch["st"] = finished ? "fin" : s.state === "directo" || (s.state === "jugado" && s.provisional) ? "live" : s.state === "aplazado" ? "apl" : "por";
    const who = (types: string[]) => ev.filter((e) => types.includes(e.type) && e.playerId).map((e): [string, number] => [e.playerId as string, n0(e.minute)]);
    const w = madridWhen(s.at);
    const goals = ev.filter((e) => GOAL.has(e.type) && e.playerId).map((e): [string, string | null, number] => [e.playerId as string, e.assistPlayerId || null, n0(e.minute)]);
    const c: NMatch = {
      id: m.id, j: s.jornada ?? i + 1, day: w.day, long: w.long, month: w.month, time: w.time, home: !!m.home, rival: m.rival ?? "", venue: m.venue ?? "", st,
      gf: st === "fin" || st === "live" ? (s.score?.gf ?? n0(m.goalsFor)) : null,
      ga: st === "fin" || st === "live" ? (s.score?.ga ?? n0(m.goalsAgainst)) : null,
      goals,
      opp: ev.filter((e) => e.type === "opponent_goal" || e.type === "own_goal").map((e) => n0(e.minute)),
      cards: who(["yellow_card", "double_yellow"]), reds: who(["red_card", "double_yellow"]),
      saves: who(["save"]), wood: who(["woodwork"]), chances: who(["chance"]), corners: who(["corner"]), fouls: who(["foul"]), frec: who(["foul_received"]),
      oppChances: ev.filter((e) => e.type === "opponent_chance").length, oppCorners: ev.filter((e) => e.type === "opponent_corner").length,
      oppCards: ev.filter((e) => e.type === "opponent_yellow").length,
      starters: [...(m.starters ?? [])], bench: [...(m.bench ?? [])], notCalled: [...(m.notCalled ?? [])],
      subs: ev.filter((e) => e.type === "substitution").length, minutes: null, mvp: null, system: m.system && m.system !== "libre" ? m.system : null,
    };
    if (st === "fin" && m.ledger) {
      c.ledger = {};
      c.minutes = {};
      for (const [pid, l] of Object.entries(m.ledger)) {
        const row = ledgerRow(l as unknown as Record<string, unknown>);
        c.ledger[pid] = row;
        c.minutes[pid] = row.min;
      }
      c.saves = Object.entries(c.ledger)
        .filter(([, l]) => l.sv)
        .map(([k, l]): [string, number] => [k, l.sv]);
      const a = analysisOf(m);
      c.coverage = a.coverage;
      c.passPairs = a.passPairs;
      c.tramos = a.tramos;
      c.them = a.them;
      c.analysisNote = a.note;
    }
    if (st === "fin") {
      const r = inp.mvpResults.get(m.id);
      c.vote = r ? { open: !!r.open, total: r.total || 0, eligible: r.eligible || 0 } : null;
      const won = inp.mvpOf(m);
      c.mvp = won[0] ?? null;
      c.mvps = won;
    }
    return c;
  });
  const standings: StandRow[] = inp.standings.map((r) => ({ team: r.team, pj: r.pj, g: r.g, e: r.e, p: r.p, gf: r.gf, gc: r.gc, pts: r.pts, us: !!r.isUs }));
  return { id: inp.seasonId, slug: slug(inp.seasonName), name: inp.seasonName, league: inp.league, real: inp.real, matches, standings, mvpDemo: !!inp.mvpDemo, porra: inp.porra };
}

/** The side of the pitch each spot is on in «El cielo de la temporada» (0 the left wing, our goal on the left). */
const SIDE: Record<string, number> = { POR: 50, LIB: 50, DFC: 50, LI: 16, LD: 84, MCD: 50, MI: 22, MC: 50, MD: 84, MCO: 40, EI: 14, ED: 86, DC: 50 };
const LINE_OF: Record<string, SquadP["pos"]> = {
  POR: "POR", LIB: "DEF", DFC: "DEF", LI: "DEF", LD: "DEF", MCD: "MED", MI: "MED", MC: "MED", MD: "MED", MCO: "MED", EI: "DEL", ED: "DEL", DC: "DEL",
};
/** Each line's column(s) across the pitch (x in %): a crowded line takes two. */
const COLS: Record<Exclude<SquadP["pos"], "">, number[]> = { POR: [6, 14], DEF: [22, 39], MED: [55, 71], DEL: [88, 80] };

export interface SquadInput {
  id: string;
  name: string;
  num: string;
  first: string;
  last: string;
  /** naturalPosition: POR · DEF · MED · DEL. */
  line: string;
  /** positions.main, then positions.also. */
  spots: string[];
}

/** The squad as the boards place it in «El cielo»: each one in his line (the spot he has played most in the actas,
 *  else his own positions, else his natural line), the line's players spread from one wing to the other by the side
 *  they play on, a crowded line in two columns. Nobody shares a point. */
export function squadOf(people: readonly SquadInput[], matches: readonly NMatch[]): SquadP[] {
  const played: Record<string, Record<string, number>> = {};
  matches.forEach((m) =>
    Object.entries(m.ledger ?? {}).forEach(([id, l]) =>
      Object.entries(l.pos).forEach(([c, v]) => {
        played[id] = played[id] ?? {};
        played[id][c] = (played[id][c] ?? 0) + v;
      }),
    ),
  );
  const sorted = [...people].sort((a, b) => (Number(a.num) || 999) - (Number(b.num) || 999));
  const placed = sorted.map((p) => {
    const own = Object.entries(played[p.id] ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0];
    const code = [own, ...p.spots].find((c): c is string => !!c && !!LINE_OF[c]) ?? null;
    const known = ["POR", "DEF", "MED", "DEL"].includes(p.line) ? (p.line as SquadP["pos"]) : "";
    return { p, line: (code ? LINE_OF[code] : known) as SquadP["pos"], side: code ? SIDE[code] : 50 };
  });
  // without any position, a player fills the outfield line with fewest
  const count = (l: SquadP["pos"]) => placed.filter((x) => x.line === l).length;
  placed.filter((x) => !x.line).forEach((x) => (x.line = (["DEF", "MED", "DEL"] as const).reduce((a, b) => (count(b) < count(a) ? b : a))));
  const out = new Map<string, SquadP>();
  (["POR", "DEF", "MED", "DEL"] as const).forEach((line) => {
    const inLine = placed.filter((x) => x.line === line).sort((a, b) => a.side - b.side);
    // a crowded line takes two columns, its players still one height each (staggered, so no two labels meet)
    const cols = inLine.length > 4 ? 2 : 1;
    inLine.forEach((x, i) => {
      const y = inLine.length === 1 ? x.side : Math.round(14 + (i * 72) / (inLine.length - 1));
      const known = ["POR", "DEF", "MED", "DEL"].includes(x.p.line) ? (x.p.line as SquadP["pos"]) : "";
      out.set(x.p.id, { id: x.p.id, n: Number(x.p.num) || "", name: x.p.name, pos: known, x: COLS[line][i % cols], y, first: x.p.first, last: x.p.last });
    });
  });
  return sorted.map((p) => out.get(p.id) as SquadP);
}
