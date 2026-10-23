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
  const obs = Array.isArray(a.observations) ? a.observations : [];
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
      if (m.analysis) {
        const a = analysisOf(m);
        c.coverage = a.coverage;
        c.passPairs = a.passPairs;
        c.tramos = a.tramos;
        c.them = a.them;
        c.analysisNote = a.note;
      }
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

/** Where each spot sits in «El cielo de la temporada»: a horizontal pitch, our goal on the left (x, y in %). */
const SKY_SPOT: Record<string, [number, number]> = {
  POR: [6, 50], LIB: [14, 50], DFC: [22, 50], LI: [22, 16], LD: [22, 84], MCD: [39, 50], MI: [55, 22], MC: [55, 50], MD: [52, 86],
  MCO: [71, 36], EI: [88, 14], ED: [88, 86], DC: [88, 50],
};
const LINE_SPOT: Record<string, string> = { POR: "POR", DEF: "DFC", MED: "MC", DEL: "DC" };
const LINE_OF: Record<string, SquadP["pos"]> = {
  POR: "POR", LIB: "DEF", DFC: "DEF", LI: "DEF", LD: "DEF", MCD: "MED", MI: "MED", MC: "MED", MD: "MED", MCO: "MED", EI: "DEL", ED: "DEL", DC: "DEL",
};

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

/** The squad as the boards place it: each one at the spot he has played most (the actas' positions), else his own
 *  main position, else his line; two on one spot step apart so every star shows. */
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
  const taken: Record<string, number> = {};
  const sorted = [...people].sort((a, b) => (Number(a.num) || 999) - (Number(b.num) || 999));
  return sorted.map((p): SquadP => {
    const own = Object.entries(played[p.id] ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0];
    const code = [own, ...p.spots, LINE_SPOT[p.line]].find((c): c is string => !!c && !!SKY_SPOT[c]) ?? "MC";
    const k = taken[code] ?? 0;
    taken[code] = k + 1;
    const [x0, y0] = SKY_SPOT[code];
    // the second on a spot sits a little back and to one side, the third to the other
    const step = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2);
    const y = Math.max(8, Math.min(92, y0 + step * 16 * (y0 > 60 ? -1 : 1)));
    const x = Math.max(4, Math.min(92, x0 - (k ? 6 : 0)));
    const pos = (["POR", "DEF", "MED", "DEL"].includes(p.line) ? p.line : LINE_OF[code] ?? "") as SquadP["pos"];
    return { id: p.id, n: Number(p.num) || "", name: p.name, pos, x, y, first: p.first, last: p.last };
  });
}
