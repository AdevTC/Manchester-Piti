// «Números» (the NU- boards, round 3): the season as the boards read it and the pure helpers every screen is
// computed from — a port of the boards' data.js (ND), fed by production's data through adapt.ts instead of the
// boards' generated file. Every number here is the boards' arithmetic, unchanged.

import type { ClubMatch } from "../../../lib/clubData";
export type MatchSt = "fin" | "live" | "apl" | "por";
export type Res = "g" | "e" | "p";

/** One player's line of a match's ledger (the acta's minutes, stints, positions and narrated counts). */
export interface LRow {
  min: number;
  tit: number;
  ban: number;
  nc: number;
  pl: number;
  sin: number;
  sout: number;
  /** [from, to] minutes on the pitch. */
  st: [number, number][];
  dy: number;
  pcm: number;
  prc: number;
  psv: number;
  pms: number;
  gpen: number;
  gfk: number;
  wood: number;
  ch: number;
  sv: number;
  f: number;
  fr: number;
  pas: number;
  pok: number;
  pko: number;
  punk?: number;
  kp: number;
  cr: number;
  sh: number;
  sot: number;
  tov: number;
  rec: number;
  int: number;
  tk: number;
  cl: number;
  bl: number;
  du: number;
  duw: number;
  dr: number;
  to: number;
  pos: Record<string, number>;
}

export interface Tramo {
  pas: number;
  pok: number;
  sh: number;
  rec: number;
  loss: number;
  tsh: number;
}

export interface NMatch {
  /** Original acta: filtering and catalogue calculations use the shared domain engine. */
  source?: ClubMatch;
  technicalAvailable?: boolean;
  technicalRows?: Record<string, LRow>;
  id: string;
  j: number;
  day: string;
  long: string;
  month: number;
  time: string;
  home: boolean;
  rival: string;
  venue: string;
  st: MatchSt;
  gf: number | null;
  ga: number | null;
  /** [scorer, assistant, minute] */
  goals: [string, string | null, number][];
  opp: number[];
  cards: [string, number][];
  reds: [string, number][];
  saves: [string, number][];
  wood: [string, number][];
  chances: [string, number][];
  corners: [string, number][];
  fouls: [string, number][];
  frec: [string, number][];
  oppChances: number;
  oppCorners: number;
  oppCards: number;
  starters: string[];
  bench: string[];
  notCalled: string[];
  subs: number;
  minutes: Record<string, number> | null;
  mvp: string | null;
  /** Every winner of a closed vote (ties share it); mvp is the first. */
  mvps?: string[];
  system: string | null;
  ledger?: Record<string, LRow>;
  coverage?: [string, "us" | "them", string][];
  analysisNote?: string;
  passPairs?: [string, string, number][];
  tramos?: Tramo[];
  them?: { pas: number; sh: number; rec: number; loss: number; sv: number };
  vote?: { open: boolean; total: number; eligible: number } | null;
}

export interface StandRow {
  team: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  pts: number;
  us: boolean;
}

/** A squad member as the boards place him: dorsal, name, natural line and his spot in «El cielo» (attacking right). */
export interface SquadP {
  id: string;
  n: number | "";
  name: string;
  pos: "POR" | "DEF" | "MED" | "DEL" | "";
  x: number;
  y: number;
  first: string;
  last: string;
}

export interface NSeasonData {
  id: string;
  slug: string;
  name: string;
  league: string;
  real: boolean;
  matches: NMatch[];
  standings: StandRow[];
  mvpDemo: boolean;
  /** The season's porra (members only): [id, points]; ids outside the squad are members without a player file. */
  porra: { rows: [string, number][]; demo: boolean; names: Record<string, string> } | null;
}

export interface Moment {
  edge: number;
  live: boolean;
  closed: boolean;
}

export interface Se {
  S: NSeasonData;
  matches: NMatch[];
  jornadas: number;
  edge: number;
  live: boolean;
  closed: boolean;
}

export interface PRow {
  id: string;
  name: string;
  n: number | "";
  pj: number;
  tit: number;
  g: number;
  a: number;
  yc: number;
  rc: number;
  saves: number;
  wood: number;
  chances: number;
  fouls: number;
  frec: number;
  min: number;
  tracked: number;
  mvp: number;
  wins: number;
  games: NMatch[];
  perGame: Record<string, number>;
  links: Record<string, number>;
  pos: Record<string, number>;
  ledgered: number;
  ban: number;
  nc: number;
  sin: number;
  sout: number;
  dy: number;
  pcm: number;
  prc: number;
  psv: number;
  pms: number;
  gpen: number;
  gfk: number;
  pas: number;
  pok: number;
  pko: number;
  punk: number;
  kp: number;
  cr: number;
  sh: number;
  sot: number;
  tov: number;
  rec: number;
  int: number;
  tk: number;
  cl: number;
  bl: number;
  du: number;
  duw: number;
  dr: number;
  to: number;
  ga: number;
  minKnown: boolean;
  tech: boolean;
  passPct: number | null;
  braces: number;
  hats: number;
  partner: string | null;
  partnerN: number;
  winPct: number;
  per50: string;
  gStreak: Streak;
  aStreak: Streak;
  caStreak: Streak;
  pStreak: Streak;
  cStreak: Streak;
  next: number;
  mainPos: string | null;
  rank: number;
  val: number;
}

export interface Streak {
  best: number;
  cur: number;
  from: NMatch | null;
  to: NMatch | null;
}

export interface TeamT {
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  ga: number;
  cs: number;
  pts: number;
  keepers: Record<string, number>;
  yc: number;
  dg: number;
}

export const strip = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export function slug(t: string | number): string {
  return strip(String(t).toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export function list(names: string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}
export const pct = (a: number, b: number): number => (b ? Math.round((a / b) * 100) : 0);
export const dec = (x: number): string => (Math.round(x * 10) / 10).toFixed(1).replace(".", ",");
export function result(m: Pick<NMatch, "gf" | "ga">): Res | null {
  if (m.gf == null || m.ga == null) return null;
  return m.gf > m.ga ? "g" : m.gf === m.ga ? "e" : "p";
}
/** The result of a match that has a score (played or tonight's). */
export const res = (m: Pick<NMatch, "gf" | "ga">): Res => result(m) ?? "e";

/** The 13 exact spots of fútbol 7 (clubPositions) on the boards' vertical pitch. */
export const ALLPOS: [string, string, number, number][] = [
  ["POR", "Portero", 50, 92], ["LIB", "Líbero", 50, 80], ["DFC", "Central", 50, 70], ["LI", "Lateral izquierdo", 15, 66], ["LD", "Lateral derecho", 85, 66],
  ["MCD", "Mediocentro defensivo", 50, 56], ["MI", "Interior izquierdo", 20, 44], ["MC", "Medio centro", 50, 44], ["MD", "Interior derecho", 80, 44],
  ["MCO", "Mediapunta", 50, 32], ["EI", "Extremo izquierdo", 18, 20], ["ED", "Extremo derecho", 82, 20], ["DC", "Delantero centro", 50, 14],
];
export const POSNAME: Record<string, string> = Object.fromEntries(ALLPOS.map((p) => [p[0], p[1]]));

/** The helpers bound to one squad (names and dorsals as the season prints them). */
export function makeND(squadList: readonly SquadP[], people: Record<string, string> = {}) {
  const SQUAD: Record<string, SquadP> = Object.fromEntries(squadList.map((p) => [p.id, p]));
  const IDS = squadList.map((p) => p.id);
  const name = (id: string): string => SQUAD[id]?.name ?? people[id] ?? id;
  const num = (id: string): number | "" => SQUAD[id]?.n ?? "";

  function season(S: NSeasonData, M: Moment): Se {
    let ms = S.matches.map((m) => {
      const c = { ...m };
      if (M.closed && c.st === "live") c.st = "por";
      return c;
    });
    if (M.closed) ms = ms.filter((m) => m.j <= M.edge);
    return { S, matches: ms, jornadas: ms.length, edge: M.edge, live: M.live, closed: M.closed };
  }
  /** The matches that count: played (and tonight's, provisional) up to jornada «upto», on the chosen ground. */
  function games(se: Se, upto: number, campo: string, withLive: boolean): NMatch[] {
    return se.matches.filter((m) => {
      if (m.j > upto) return false;
      if (!(m.st === "fin" || (withLive && m.st === "live"))) return false;
      if (campo === "casa" && !m.home) return false;
      if (campo === "fuera" && m.home) return false;
      return true;
    });
  }
  function team(gs: NMatch[]): TeamT {
    const t: TeamT = { pj: gs.length, g: 0, e: 0, p: 0, gf: 0, ga: 0, cs: 0, pts: 0, keepers: {}, yc: 0, dg: 0 };
    gs.forEach((m) => {
      t[res(m)]++;
      t.gf += m.gf ?? 0;
      t.ga += m.ga ?? 0;
      if (m.ga === 0) {
        t.cs++;
        const k = m.starters[0] || "";
        if (k) t.keepers[k] = (t.keepers[k] || 0) + 1;
      }
      t.yc += m.cards.length;
    });
    t.pts = t.g * 3 + t.e;
    t.dg = t.gf - t.ga;
    return t;
  }
  function streaks(gs: NMatch[], test: (m: NMatch) => boolean): Streak {
    let best = 0;
    let run = 0;
    let from: NMatch | null = null;
    let bestFrom: NMatch | null = null;
    let bestTo: NMatch | null = null;
    gs.forEach((m) => {
      if (test(m)) {
        if (!run) from = m;
        run++;
        if (run > best) {
          best = run;
          bestFrom = from;
          bestTo = m;
        }
      } else run = 0;
    });
    return { best, cur: run, from: bestFrom, to: bestTo };
  }
  function teamStreaks(gs: NMatch[]) {
    return [
      { k: "Victorias seguidas", s: streaks(gs, (m) => (m.gf ?? 0) > (m.ga ?? 0)) },
      { k: "Partidos sin perder", s: streaks(gs, (m) => (m.gf ?? 0) >= (m.ga ?? 0)) },
      { k: "Partidos marcando", s: streaks(gs, (m) => (m.gf ?? 0) > 0) },
      { k: "Porterías a cero", s: streaks(gs, (m) => m.ga === 0) },
    ];
  }
  const played = (m: NMatch, id: string) => (m.ledger ? !!m.ledger[id]?.pl : m.starters.includes(id) || m.bench.includes(id));
  /** One row per player for the period (clubAnalytics analysePlayer): from the ledger when the acta has one
   *  (minutes with rolling subs, entries and exits, the narrated counts), else from the convocatoria and the events. */
  function rows(gs: NMatch[], only?: string[]): PRow[] {
    const R: Record<string, PRow> = {};
    IDS.forEach((id) => {
      R[id] = {
        id, name: name(id), n: num(id), pj: 0, tit: 0, g: 0, a: 0, yc: 0, rc: 0, saves: 0, wood: 0, chances: 0, fouls: 0, frec: 0, min: 0, tracked: 0, mvp: 0, wins: 0,
        games: [], perGame: {}, links: {}, pos: {}, ledgered: 0, ban: 0, nc: 0, sin: 0, sout: 0, dy: 0, pcm: 0, prc: 0, psv: 0, pms: 0, gpen: 0, gfk: 0,
        pas: 0, pok: 0, pko: 0, punk: 0, kp: 0, cr: 0, sh: 0, sot: 0, tov: 0, rec: 0, int: 0, tk: 0, cl: 0, bl: 0, du: 0, duw: 0, dr: 0, to: 0,
        ga: 0, minKnown: false, tech: false, passPct: null, braces: 0, hats: 0, partner: null, partnerN: 0, winPct: 0, per50: "0,0",
        gStreak: NO_STREAK, aStreak: NO_STREAK, caStreak: NO_STREAK, pStreak: NO_STREAK, cStreak: NO_STREAK, next: 1, mainPos: null, rank: 0, val: 0,
      };
    });
    gs.forEach((m) => {
      const won = (m.gf ?? 0) > (m.ga ?? 0);
      if (m.ledger) {
        Object.keys(m.ledger).forEach((id) => {
          const r = R[id];
          const l = m.ledger?.[id];
          if (!r || !l) return;
          r.tracked++;
          r.ledgered++;
          if (l.pl) {
            r.pj++;
            r.games.push(m);
            if (won) r.wins++;
          }
          r.tit += l.tit; r.ban += l.ban; r.nc += l.nc; r.sin += l.sin; r.sout += l.sout; r.min += l.min;
          r.dy += l.dy; r.pcm += l.pcm; r.prc += l.prc; r.psv += l.psv; r.pms += l.pms; r.gpen += l.gpen; r.gfk += l.gfk;
          r.saves += l.sv; r.wood += l.wood; r.chances += l.ch; r.fouls += l.f; r.frec += l.fr;
          for (const k of TECH_KEYS) r[k] += l[k] || 0;
          Object.keys(l.pos || {}).forEach((c) => {
            r.pos[c] = (r.pos[c] || 0) + (l.pos[c] ?? 0);
          });
        });
      } else {
        m.starters.concat(m.bench).forEach((id) => {
          const r = R[id];
          if (!r) return;
          r.pj++;
          if (m.starters.includes(id)) r.tit++;
          else r.ban++;
          if (won) r.wins++;
          r.games.push(m);
          if (m.minutes) {
            r.min += m.minutes[id] || 0;
            r.tracked++;
          }
        });
        m.notCalled.forEach((id) => {
          if (R[id]) R[id].nc++;
        });
        m.saves.forEach((c) => R[c[0]] && R[c[0]].saves++);
        m.wood.forEach((c) => R[c[0]] && R[c[0]].wood++);
        m.chances.forEach((c) => R[c[0]] && R[c[0]].chances++);
        m.fouls.forEach((c) => R[c[0]] && R[c[0]].fouls++);
        m.frec.forEach((c) => R[c[0]] && R[c[0]].frec++);
      }
      if (!m.ledger) for (const [id, technical] of Object.entries(m.technicalRows ?? {})) {
        const r = R[id];
        if (!r) continue;
        for (const k of TECH_KEYS) r[k] += technical[k] || 0;
      }
      m.goals.forEach((g) => {
        const sc = R[g[0]];
        if (sc) {
          sc.g++;
          sc.perGame[m.id] = (sc.perGame[m.id] || 0) + 1;
        }
        const as = g[1] ? R[g[1]] : undefined;
        if (g[1] && as) {
          as.a++;
          as.links[g[0]] = (as.links[g[0]] || 0) + 1;
          if (sc) sc.links[g[1]] = (sc.links[g[1]] || 0) + 1;
        }
      });
      m.cards.forEach((c) => R[c[0]] && R[c[0]].yc++);
      m.reds.forEach((c) => R[c[0]] && R[c[0]].rc++);
      (m.mvps ?? (m.mvp ? [m.mvp] : [])).forEach((id) => R[id] && R[id].mvp++);
    });
    let all = IDS.map((id) => {
      const r = R[id];
      r.ga = r.g + r.a;
      r.minKnown = gs.length > 0 && r.tracked === gs.length;
      r.tech = r.games.some(m => m.technicalAvailable ?? !!m.ledger);
      r.passPct = r.pok + r.pko ? Math.round((r.pok / (r.pok + r.pko)) * 100) : null;
      Object.keys(r.perGame).forEach((k) => {
        if (r.perGame[k] >= 2) r.braces++;
        if (r.perGame[k] >= 3) r.hats++;
      });
      let bp: string | null = null;
      Object.keys(r.links).forEach((k) => {
        if (!bp || r.links[k] > r.links[bp]) bp = k;
      });
      r.partner = bp;
      r.partnerN = bp ? r.links[bp] : 0;
      r.winPct = pct(r.wins, r.pj);
      r.per50 = r.minKnown && r.min ? dec(r.ga / (r.min / 50)) : r.pj ? dec(r.ga / r.pj) : "0,0";
      r.gStreak = streaks(gs, (m) => m.goals.some((g) => g[0] === id));
      r.aStreak = streaks(gs, (m) => m.goals.some((g) => g[1] === id));
      r.caStreak = streaks(gs, (m) => m.goals.some((g) => g[0] === id || g[1] === id));
      r.pStreak = streaks(gs, (m) => played(m, id));
      r.cStreak = streaks(gs, (m) => played(m, id) && !m.cards.some((c) => c[0] === id));
      r.next = [1, 5, 10, 25, 50, 100, 250, 500].find((s) => s > r.g) ?? r.g + 1;
      let bestPos: string | null = null;
      Object.keys(r.pos).forEach((c) => {
        if (!bestPos || r.pos[c] > r.pos[bestPos]) bestPos = c;
      });
      r.mainPos = bestPos;
      return r;
    });
    if (only && only.length) all = all.filter((r) => only.includes(r.id));
    return all;
  }
  function metricOf(r: PRow, k: string): number {
    if (k === "min") return r.minKnown ? r.min : r.tit;
    const v = (r as unknown as Record<string, unknown>)[MK[k] ?? k];
    return typeof v === "number" ? v : 0;
  }
  function positions(rs: PRow[]) {
    return ALLPOS.map((p) => {
      const who = rs
        .filter((r) => r.pos[p[0]])
        .map((r) => ({ id: r.id, name: r.name, min: Math.round(r.pos[p[0]]), g: r.g, a: r.a }))
        .sort((x, y) => y.min - x.min);
      const min = who.reduce((s, x) => s + x.min, 0);
      return { code: p[0], name: p[1], x: p[2], y: p[3], min, who, owner: who[0] ?? null };
    });
  }
  function ranked(rs: PRow[], k: string): PRow[] {
    const s = rs.slice().sort((a, b) => metricOf(b, k) - metricOf(a, k) || b.g - a.g || nOrd(a) - nOrd(b));
    let pos = 0;
    let last: number | null = null;
    s.forEach((r, i) => {
      const v = metricOf(r, k);
      if (v !== last) {
        pos = i + 1;
        last = v;
      }
      r.rank = pos;
      r.val = v;
    });
    return s;
  }
  /** «La carrera»: how many jornadas each one led. */
  function inLead(se: Se, upto: number, k: string): Record<string, number> {
    const lead: Record<string, number> = {};
    se.matches.forEach((m) => {
      if (m.j > upto || m.st !== "fin") return;
      ranked(rows(games(se, m.j, "todo", false)), k)
        .filter((r) => r.rank === 1 && r.val > 0)
        .forEach((r) => {
          lead[r.id] = (lead[r.id] || 0) + 1;
        });
    });
    return lead;
  }
  /** «El cielo»: the assist → scorer links. */
  function links(gs: NMatch[]) {
    const L: Record<string, number> = {};
    gs.forEach((m) =>
      m.goals.forEach((g) => {
        if (!g[1]) return;
        const k = `${g[1]}>${g[0]}`;
        L[k] = (L[k] || 0) + 1;
      }),
    );
    return Object.keys(L)
      .map((k) => {
        const p = k.split(">");
        return { from: p[0], to: p[1], n: L[k] };
      })
      .sort((a, b) => b.n - a.n);
  }
  function arc(a: string, b: string): string {
    const A = SQUAD[a];
    const B = SQUAD[b];
    if (!A || !B) return "";
    const x1 = A.x * 3;
    const y1 = A.y * 1.4;
    const x2 = B.x * 3;
    const y2 = B.y * 1.4;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const cx = mx - dy * 0.18;
    const cy = my + dx * 0.18;
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  function rivals(se: Se, upto: number, gs: NMatch[]) {
    const R: Record<string, RivalRow> = {};
    se.matches.forEach((m) => {
      const r = (R[m.rival] = R[m.rival] || { rival: m.rival, pj: 0, g: 0, e: 0, p: 0, gf: 0, ga: 0, games: [], next: null });
      if (gs.includes(m)) {
        r.pj++;
        r[res(m)]++;
        r.gf += m.gf ?? 0;
        r.ga += m.ga ?? 0;
        r.games.push(m);
      }
      if (m.st === "live" && m.j <= upto) r.next = m;
      else if (!r.next && !gs.includes(m) && (m.st === "por" || m.st === "apl" || m.j > upto)) r.next = m;
    });
    return Object.keys(R).map((k) => R[k]);
  }
  function recordsOf(gs: NMatch[]) {
    const best = (f: (m: NMatch) => number) => {
      let b: NMatch | null = null;
      gs.forEach((m) => {
        if (!b || f(m) > f(b)) b = m;
      });
      return b as NMatch | null;
    };
    let bw: NMatch | null = null;
    gs.filter((m) => (m.gf ?? 0) > (m.ga ?? 0)).forEach((m) => {
      if (!bw || (m.gf ?? 0) - (m.ga ?? 0) > (bw.gf ?? 0) - (bw.ga ?? 0)) bw = m;
    });
    const ind: { goals: IndRec | null; asis: IndRec | null; ga: IndRec | null; early: IndRec | null } = { goals: null, asis: null, ga: null, early: null };
    gs.forEach((m) => {
      const pg: Record<string, number> = {};
      const pa: Record<string, number> = {};
      m.goals.forEach((g) => {
        pg[g[0]] = (pg[g[0]] || 0) + 1;
        if (g[1]) pa[g[1]] = (pa[g[1]] || 0) + 1;
        if (!ind.early || g[2] < ind.early.v) ind.early = { v: g[2], id: g[0], m };
      });
      Object.keys(pg).forEach((id) => {
        if (!ind.goals || pg[id] > ind.goals.v) ind.goals = { v: pg[id], id, m };
      });
      Object.keys(pa).forEach((id) => {
        if (!ind.asis || pa[id] > ind.asis.v) ind.asis = { v: pa[id], id, m };
      });
      const gaa: Record<string, number> = {};
      Object.keys(pg).forEach((id) => (gaa[id] = (gaa[id] || 0) + pg[id]));
      Object.keys(pa).forEach((id) => (gaa[id] = (gaa[id] || 0) + pa[id]));
      Object.keys(gaa).forEach((id) => {
        if (!ind.ga || gaa[id] > ind.ga.v) ind.ga = { v: gaa[id], id, m };
      });
    });
    return { bigWin: bw as NMatch | null, mostFor: best((m) => m.gf ?? 0), mostTotal: best((m) => (m.gf ?? 0) + (m.ga ?? 0)), mostAgainst: best((m) => m.ga ?? 0), ind };
  }
  /** «La colección»: the season's stickers, got or still a slot. */
  function collection(gs: NMatch[], rs: PRow[]): Cromo[] {
    const out: Cromo[] = [];
    let firstGoal: { m: NMatch; id: string } | null = null;
    let firstWin: NMatch | null = null;
    let firstCs: NMatch | null = null;
    let hat: { m: NMatch; id: string } | null = null;
    let goalsRun = 0;
    let g10: { m: NMatch; id: string } | null = null;
    let g25: { m: NMatch; id: string } | null = null;
    let g50: { m: NMatch; id: string } | null = null;
    let w5: NMatch | null = null;
    let w10: NMatch | null = null;
    let wins = 0;
    gs.forEach((m) => {
      m.goals.forEach((g) => {
        goalsRun++;
        if (!firstGoal) firstGoal = { m, id: g[0] };
        if (goalsRun === 10) g10 = { m, id: g[0] };
        if (goalsRun === 25) g25 = { m, id: g[0] };
        if (goalsRun === 50) g50 = { m, id: g[0] };
      });
      if ((m.gf ?? 0) > (m.ga ?? 0)) {
        wins++;
        if (!firstWin) firstWin = m;
        if (wins === 5) w5 = m;
        if (wins === 10) w10 = m;
      }
      if (m.ga === 0 && !firstCs) firstCs = m;
      const pg: Record<string, number> = {};
      m.goals.forEach((g) => {
        pg[g[0]] = (pg[g[0]] || 0) + 1;
        if (pg[g[0]] === 3 && !hat) hat = { m, id: g[0] };
      });
    });
    const got = (kind: string, title: string, value: string, unit: string, who: string, m: NMatch | null) =>
      out.push({ kind, got: true, title, value, unit, who, vs: m ? `${m.home ? "contra " : "en casa de "}${m.rival}` : "", j: m ? `J${m.j}` : "", id: m ? m.id : "", left: "" });
    const slot = (kind: string, title: string, left: string) => out.push({ kind, got: false, title, left, value: "", unit: "", who: "", vs: "", j: "", id: "" });
    const fg = firstGoal as { m: NMatch; id: string } | null;
    const fw = firstWin as NMatch | null;
    const fc = firstCs as NMatch | null;
    const ht = hat as { m: NMatch; id: string } | null;
    const t10 = g10 as { m: NMatch; id: string } | null;
    const t25 = g25 as { m: NMatch; id: string } | null;
    const t50 = g50 as { m: NMatch; id: string } | null;
    const v5 = w5 as NMatch | null;
    const v10 = w10 as NMatch | null;
    if (fg) got("goles", "Primer gol", "1", "gol", name(fg.id), fg.m);
    else slot("goles", "Primer gol", "falta 1 gol");
    if (fw) got("partidos", "Primera victoria", `${fw.gf}–${fw.ga}`, "", "El equipo", fw);
    else slot("partidos", "Primera victoria", "falta 1 victoria");
    if (t10) got("goles", "10 goles del equipo", "10", "goles", name(t10.id), t10.m);
    else slot("goles", "10 goles del equipo", `faltan ${10 - goalsRun} goles`);
    if (fc) got("partidos", "Primera portería a cero", `${fc.gf}–0`, "", fc.starters[0] ? name(fc.starters[0]) : "El equipo", fc);
    else slot("partidos", "Primera portería a cero", "falta 1 partido");
    if (v5) got("partidos", "5 victorias", "5", "victorias", "El equipo", v5);
    else slot("partidos", "5 victorias", `faltan ${5 - wins} victorias`);
    if (t25) got("goles", "25 goles del equipo", "25", "goles", name(t25.id), t25.m);
    else slot("goles", "25 goles del equipo", `faltan ${25 - goalsRun} goles`);
    const acc: Record<string, number> = {};
    let a5: { m: NMatch; id: string } | null = null;
    gs.forEach((m) =>
      m.goals.forEach((g) => {
        if (!g[1]) return;
        acc[g[1]] = (acc[g[1]] || 0) + 1;
        if (acc[g[1]] === 5 && !a5) a5 = { m, id: g[1] };
      }),
    );
    const topA = ranked(rs, "asist")[0];
    const as5 = a5 as { m: NMatch; id: string } | null;
    if (as5) got("asist", "5 asistencias", "5", "asistencias", name(as5.id), as5.m);
    else slot("asist", "5 asistencias de un jugador", `faltan ${5 - (topA ? topA.a : 0)}`);
    if (ht) got("goles", "Primer hat-trick", "3", "goles", name(ht.id), ht.m);
    else slot("goles", "Primer hat-trick", "aún nadie");
    if (v10) got("partidos", "10 victorias", "10", "victorias", "El equipo", v10);
    else slot("partidos", "10 victorias", `faltan ${10 - wins} victorias`);
    if (t50) got("goles", "50 goles del equipo", "50", "goles", name(t50.id), t50.m);
    else slot("goles", "50 goles del equipo", `faltan ${50 - goalsRun} goles`);
    return out;
  }
  /** The cumulative line of each player across the jornadas (the evolution chart, 600 × 160). */
  function evo(se: Se, upto: number, ids: string[], k: string) {
    const pl = se.matches.filter((m) => m.st === "fin" && m.j <= upto);
    let max = 1;
    const series: Record<string, [number, number][]> = {};
    ids.forEach((id) => {
      let acc = 0;
      const pts: [number, number][] = [[0, 0]];
      pl.forEach((m, i) => {
        if (k === "pj") {
          if (played(m, id)) acc++;
        } else if (k === "min") acc += m.minutes ? m.minutes[id] || 0 : 0;
        else
          m.goals.forEach((g) => {
            if ((k !== "asist" && g[0] === id) || (k !== "goles" && g[1] === id)) acc++;
          });
        pts.push([i + 1, acc]);
      });
      series[id] = pts;
      if (acc > max) max = acc;
    });
    const n = Math.max(1, pl.length);
    return {
      n,
      max,
      d: ids.map((id) => series[id].map((p, i) => `${i ? "L" : "M"}${((p[0] / n) * 600).toFixed(1)} ${(156 - (p[1] / max) * 146).toFixed(1)}`).join(" ")),
      last: ids.map((id) => series[id][series[id].length - 1][1]),
    };
  }
  return { SQUAD, IDS, name, num, season, games, team, streaks, teamStreaks, rows, metricOf, positions, ranked, inLead, links, arc, rivals, recordsOf, collection, evo };
}
export type ND = ReturnType<typeof makeND>;

export interface RivalRow {
  rival: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  ga: number;
  games: NMatch[];
  next: NMatch | null;
}
export interface IndRec {
  v: number;
  id: string;
  m: NMatch;
}
export interface Cromo {
  kind: string;
  got: boolean;
  title: string;
  value: string;
  unit: string;
  who: string;
  vs: string;
  j: string;
  id: string;
  left: string;
}

const NO_STREAK: Streak = { best: 0, cur: 0, from: null, to: null };
const nOrd = (r: { n: number | "" }) => (r.n === "" ? 999 : r.n);
const TECH_KEYS = ["pas", "pok", "pko", "punk", "kp", "cr", "sh", "sot", "tov", "rec", "int", "tk", "cl", "bl", "du", "duw", "dr", "to"] as const;
/** The app's 24 player metrics (clubAnalytics.metrics) + the narrated counts, by key → the row's field. */
const MK: Record<string, string> = {
  goles: "g", asist: "a", ga: "ga", pj: "pj", tit: "tit", ban: "ban", nc: "nc", sin: "sin", sout: "sout", yc: "yc", rc: "rc", dy: "dy", wood: "wood", ch: "chances", sv: "saves",
  f: "fouls", fr: "frec", psv: "psv", gpen: "gpen", gfk: "gfk", pms: "pms", pcm: "pcm", prc: "prc", mvp: "mvp",
  pas: "pas", pok: "pok", kp: "kp", cr: "cr", sh: "sh", sot: "sot", rec: "rec", tov: "tov", int: "int", tk: "tk", cl: "cl", bl: "bl", du: "du", dr: "dr",
};

/** The league table: sorted, with tonight's score applied while it is live («si acaba así»). */
export function table(se: Se, liveOn: boolean) {
  const rows_ = se.S.standings.map((r) => ({ ...r, prov: false, pos: 0, dg: 0 }));
  const live = se.live && liveOn ? (se.matches.find((m) => m.st === "live") ?? null) : null;
  if (live) {
    rows_.forEach((r) => {
      const mine = r.us;
      const theirs = !mine && sameTeam(r.team, live.rival);
      if (!mine && !theirs) return;
      const f = (mine ? live.gf : live.ga) ?? 0;
      const a = (mine ? live.ga : live.gf) ?? 0;
      r.pj++;
      r.gf += f;
      r.gc += a;
      if (f > a) {
        r.g++;
        r.pts += 3;
      } else if (f === a) {
        r.e++;
        r.pts++;
      } else r.p++;
      r.prov = true;
    });
    rows_.sort((a, b) => b.pts - a.pts || b.gf - b.gc - (a.gf - a.gc) || b.gf - a.gf || a.team.localeCompare(b.team));
  }
  rows_.forEach((r, i) => {
    r.pos = i + 1;
    r.dg = r.gf - r.gc;
  });
  return rows_;
}
export type TRow = ReturnType<typeof table>[number];
export function posWith(se: Se, extraPts: number, extraDg: number): number {
  const t = table(se, false).map((r) => (r.us ? { ...r, pts: r.pts + extraPts, dg: r.dg + extraDg } : { ...r }));
  t.sort((a, b) => b.pts - a.pts || b.dg - a.dg);
  let p = 0;
  t.forEach((r, i) => {
    if (r.us) p = i + 1;
  });
  return p;
}
const sameTeam = (a: string, b: string) => slug(a) === slug(b);
/** «Cuándo caen los goles»: ten stretches of 5′. */
export function clock(gs: NMatch[]) {
  const us = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const them = us.slice();
  gs.forEach((m) => {
    m.goals.forEach((g) => us[Math.min(9, Math.floor(g[2] / 5))]++);
    m.opp.forEach((x) => them[Math.min(9, Math.floor(x / 5))]++);
  });
  return { us, them };
}
