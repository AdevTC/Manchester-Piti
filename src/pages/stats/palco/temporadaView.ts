// «El palco» · Temporada: the place's view, ported from the prototype's temporada() (Numeros.dc.html) — la cinta
// (the replay, the casa/fuera and partidos dimming, the points line and its 1,5-points pace, the jornada card), the
// team's numbers, la carrera, the table with «¿Y si…?» re-sorting the whole league, los cromos and the side column.
// Pure: `v` is already cut by the page's filters (numeros/view.ts recomputes it for every upto); this only reads it.
import { result, slug, type NMatch } from "../numeros/nd";
import type { Act, NuState, NuView } from "../numeros/view";
import type { IconName } from "./icons";
import { initials, num, plural } from "./num";

const RACES = [
  ["goles", "Goles", "goles"],
  ["asist", "Asist.", "asistencias"],
  ["ga", "G+A", "goles y asistencias"],
] as const;
const CROMOS = [
  ["todos", "Todos"],
  ["goles", "Goles"],
  ["partidos", "Partidos"],
] as const;
const CROMO_KIND: Record<string, string> = { goles: "Goles", asist: "Asistencias", partidos: "Partidos" };
const f2 = (n: number) => n.toFixed(2);
const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);
const ptsOf = (m: Pick<NMatch, "gf" | "ga">) => ({ g: 3, e: 1, p: 0 })[result(m) ?? "p"];
/** A match with a score that counts: the acta's, or tonight's while it is live («si acaba así»). */
const isPlayed = (m: NMatch) => m.gf != null && (m.st === "fin" || m.st === "live");

type TblRow = NuView["tem"]["all"][number];
type YsiV = NonNullable<NuState["ysi"][string]>;

export interface SimRow {
  key: string;
  team: string;
  us: boolean;
  prov: boolean;
  /** Where it was in the league's table, and where our made-up results leave it. */
  was: number;
  pos: number;
  pj: number;
  g: number;
  e: number;
  p: number;
  dg: number;
  pts: number;
  /** One of our made-up games moved it (us, or the rival of a game). */
  sim: boolean;
  mv: string;
}

/** «¿Y si…?»: our made-up results (a 1–0 win, a draw, a 0–1 defeat) move us AND the rival of each game, and the
 *  whole league re-sorts. null with no result picked or no table. */
export function simulate(base: readonly TblRow[], ysi: NuState["ysi"], left: readonly { key: string; rival: string }[]): SimRow[] | null {
  const picks = left.flatMap((y) => {
    const v = ysi[y.key];
    return v ? [{ rival: y.rival, v }] : [];
  });
  if (!picks.length) return null;
  const tbl: SimRow[] = base
    .filter((r) => !r.gap)
    .map((r) => ({ key: r.key, team: r.team, us: r.us, prov: r.prov, was: r.pos, pos: r.pos, pj: num(r.pj), g: num(r.g), e: num(r.e), p: num(r.p), dg: num(r.dg), pts: num(r.pts), sim: false, mv: "" }));
  const us = tbl.find((r) => r.us);
  if (!us) return null;
  const play = (r: SimRow, v: YsiV) => {
    r.pj++;
    r.sim = true;
    if (v === "g") {
      r.g++;
      r.pts += 3;
      r.dg++;
    } else if (v === "e") {
      r.e++;
      r.pts++;
    } else {
      r.p++;
      r.dg--;
    }
  };
  const flip: Record<YsiV, YsiV> = { g: "p", e: "e", p: "g" };
  picks.forEach(({ rival, v }) => {
    play(us, v);
    const them = tbl.find((r) => !r.us && slug(r.team) === slug(rival));
    if (them) play(them, flip[v]);
  });
  tbl.sort((a, b) => b.pts - a.pts || b.dg - a.dg || a.was - b.was);
  tbl.forEach((r, i) => {
    r.pos = i + 1;
    const d = r.was - r.pos;
    r.mv = d > 0 ? `▲ sube al ${r.pos}º` : d < 0 ? `▼ baja al ${r.pos}º` : "";
  });
  return tbl;
}

/** The season's points today, from the actas (tonight's score counts while it is live). */
export const seasonPoints = (ms: readonly NMatch[]) => ms.reduce((s, m) => s + (isPlayed(m) ? ptsOf(m) : 0), 0);

export function temporadaView(v: NuView, st: NuState, act: Act) {
  const ms = v.se.matches;
  const N = Math.max(1, ms.length);
  const edge = v.edge;
  // the table and the replay: «Hasta la J…» or «Repasar» cut the season (with «Todas» there is no cut)
  const scrubbed = !v.all && v.upto < edge;
  const upTo = !v.all && (scrubbed || st.replay) ? v.upto : 0;
  const whereK = st.campo === "casa" ? "en casa" : st.campo === "fuera" ? "fuera" : "";
  const chosen = st.partidos;
  const labelOf = new Map(v.time.cols.map((c) => [c.key, c.label]));
  const iniOf = new Map(v.rivales.rows.map((r) => [r.rival, r.ini]));
  let maxG = 1;
  ms.forEach((m) => {
    if (m.gf != null) maxG = Math.max(maxG, m.gf, m.ga ?? 0);
  });
  let lastPlayed = "";
  ms.forEach((m) => {
    if (isPlayed(m)) lastPlayed = m.id;
  });
  const headKey = ms.find((m) => m.j === v.upto)?.id || lastPlayed || ms[0]?.id || "";
  const valid = (k: string | null | undefined): k is string => !!k && ms.some((m) => m.id === k);
  const jkey = st.playing ? headKey : valid(st.jkey) ? st.jkey : chosen.length === 1 && valid(chosen[0]) ? chosen[0] : headKey;

  // ---------- la cinta
  let acc = 0;
  let playedN = 0;
  const pts: { i: number; v: number; prov: boolean }[] = [];
  const accAt = new Map<string, number>();
  const metas = ms.map((m, i) => {
    const played = isPlayed(m);
    const prov = played && m.st === "live";
    const letter = played ? (result(m) ?? "e").toUpperCase() : "";
    const lcls = !played ? "vd-form__l--empty" : prov ? "vd-form__l--prov" : letter === "G" ? "vd-form__l--g" : letter === "P" ? "vd-form__l--p" : "";
    // a casa/fuera filter (or the matches picked) dims the other games, the same way the replay dims what has not come yet
    const away = (!!whereK && (st.campo === "casa" ? !m.home : m.home)) || (chosen.length > 0 && !chosen.includes(m.id));
    const ahead = (upTo > 0 && m.j > upTo) || away;
    const shown = played && !ahead;
    if (shown) {
      playedN++;
      acc += letter === "G" ? 3 : letter === "E" ? 1 : 0;
      pts.push({ i, v: acc, prov });
      accAt.set(m.id, acc);
    }
    return { m, j: `J${m.j}`, played, prov, letter, lcls, away, ahead, shown };
  });
  const cinta = metas.map(({ m, j, played, prov, letter, lcls, away, ahead, shown }) => {
    const label = labelOf.get(m.id) ?? j;
    const up = m.gf == null ? 0 : Math.round((m.gf / maxG) * 100);
    const dn = m.ga == null ? 0 : Math.round((m.ga / maxG) * 100);
    return {
      key: m.id, j, l: shown ? letter : "", lcls: shown ? lcls : "vd-form__l--empty",
      up: shown && up ? Math.max(8, up) : 0, dn: shown && dn ? Math.max(8, dn) : 0,
      ini: iniOf.get(m.rival) || initials(m.rival),
      cls: [played ? "is-played" : "is-future", prov ? "is-prov" : "", ahead ? "is-ahead" : ""].filter(Boolean).join(" "),
      on: m.id === jkey, now: m.id === headKey, nowT: upTo ? (st.replay ? "Repaso" : "Hasta aquí") : prov ? "En directo" : "Ahora",
      aria: away ? `${label}, no cuenta con este filtro` : ahead ? (st.replay ? `${j}, aún por llegar en el repaso` : `${j}, después de la J${upTo}`) : label,
      pick: () => act.set({ jkey: m.id }),
    };
  });
  // the points line: 100 is the top of the box, with room over the season's total
  const fullPts = seasonPoints(ms);
  const maxP = Math.max(3, fullPts, acc, 1.5 * N * 0.75) * 1.12;
  const P = pts.map((p) => [p.i + 0.5, 100 - (p.v / maxP) * 100] as const);
  const ptsLine = P.length > 1 ? `M${P.map((p) => `${f2(p[0])} ${f2(p[1])}`).join(" L")}` : "";
  const ptsArea = P.length > 1 ? `${ptsLine} L${f2(P[P.length - 1][0])} 100 L${f2(P[0][0])} 100 Z` : "";
  // a team that wins half its games and draws a quarter: 1,5 points a jornada, as a reference to read our line against
  const pace = `M0 100 L${f2(N)} ${f2(Math.max(0, 100 - ((1.5 * N) / maxP) * 100))}`;
  const ptsDots = P.map(([x, y], n) => ({ key: pts[n].i, left: f2((x / N) * 100), top: f2(8 + y * 0.72), cls: [pts[n].prov ? "is-prov" : "", n === P.length - 1 ? "is-head" : ""].filter(Boolean).join(" ") }));
  const lastP = P[P.length - 1];
  // (the label sits left of the last point; early in the season it would fall off the cinta, so it goes right of it)
  const ptsLab = lastP ? { left: f2((lastP[0] / N) * 100), top: f2(8 + lastP[1] * 0.72), v: plural(acc, "punto", "puntos"), after: lastP[0] / N < 0.25 } : null;

  // ---------- the jornada card
  const jm = metas.find((x) => x.m.id === jkey) ?? metas[0] ?? null;
  let jd = null;
  if (jm) {
    const m = jm.m;
    const jAhead = upTo > 0 && m.j > upTo;
    const res = m.gf == null ? "" : `${m.gf}–${m.ga}`;
    const word = jm.prov ? "Va" : jm.letter === "G" ? "Ganamos" : jm.letter === "E" ? "Empatamos" : jm.letter === "P" ? "Perdimos" : "Por jugar";
    const at = accAt.get(m.id);
    const who = v.tem.who[m.id] ?? "";
    jd = {
      l: jm.played && !jAhead ? jm.letter : "", lcls: jm.played && !jAhead ? jm.lcls : "vd-form__l--empty",
      big: jm.played && !jAhead ? res : jm.j,
      head: `${jm.j} · ${m.rival}`,
      line: jAhead
        ? st.replay
          ? "Aún no ha llegado en el repaso"
          : `Llega después de la J${upTo}`
        : jm.played
          ? [`${word} ${res}`, m.home ? "En casa" : "Fuera", at != null ? `${at} pts` : ""].filter(Boolean).join(" · ")
          : [m.home ? "En casa" : "Fuera", m.st === "apl" ? "aplazado" : `${m.day}, ${m.time}`].join(" · "),
      who, hasWho: jm.played && !!who && !jAhead,
      go: jm.played ? "Abrir el partido" : "Ver la previa",
      href: `/partidos/${m.id}`,
      canUpto: jm.played && !jm.prov && !v.all && m.j < edge && upTo !== m.j,
      upto: () => act.set({ upto: m.j, replay: false, playing: false }),
    };
  }

  // ---------- the replay's controls
  const off = v.time.off;
  const cur = upTo;
  const today = { upto: Number.POSITIVE_INFINITY, replay: false, playing: false, jkey: null } satisfies Partial<NuState>;
  const ctl = {
    playing: st.playing, playT: st.playing ? "Pausa" : st.replay ? "Seguir el repaso" : "Repasar la temporada", playIc: (st.playing ? "pause" : "play") as IconName,
    repJ: st.replay ? `J${v.upto} / ${edge}` : "", repCls: st.replay ? "is-on" : "", play: () => act.play(), playOff: off,
    prev: () => act.set({ upto: Math.max(1, (cur || edge) - 1), replay: true, playing: false, jkey: null }),
    next: () => act.set(cur && cur + 1 < edge ? { upto: cur + 1, replay: true, playing: false, jkey: null } : today),
    noPrev: off || (cur || edge) <= 1, noNext: !cur,
    hasBack: !!cur, back: () => act.set(today),
  };
  const cintaMeta = ms.length
    ? `${playedN} de ${ms.length} jornadas ${[upTo ? `hasta la J${upTo}` : "jugadas", whereK, chosen.length ? (chosen.length === 1 ? "en el partido elegido" : "en los partidos elegidos") : ""].filter(Boolean).join(" ")} · toca una`
    : "";

  // ---------- the team's numbers (already cut by every filter)
  const K = v.tem.kpis;
  const kf = (re: RegExp) => K.find((k) => re.test(k.t)) ?? { v: "–" as string | number, t: "", s: "" };
  const w = num(kf(/^victorias?$/).v);
  const e = num(kf(/^empates?$/).v);
  const l = num(kf(/^derrotas?$/).v);
  const gf = num(kf(/a favor/).v);
  const gc = num(kf(/en contra/).v);
  const gmax = Math.max(1, gf, gc);
  const fig = (k: { v: string | number; t: string; s?: string }) => ({ v: k.v, t: k.t + (k.s ? ` · ${k.s}` : "") });

  // ---------- la carrera
  const raceK = st.raceK;
  const raceRows = v.tem.race;
  const rMax = Math.max(1, ...raceRows.map((r) => r.val));
  const race = raceRows.slice(0, 8).map((r) => ({ key: r.key, rk: `${r.rank}º`, n: r.n, name: r.name, val: r.val, you: r.you, w: Math.round((r.val / rMax) * 100), cls: [r.rank === 1 && r.val ? "is-1" : "", !r.val ? "is-zero" : ""].filter(Boolean).join(" ") }));

  // ---------- the table, with «¿Y si…?»
  const hasTable = v.tem.n > 0;
  const showTable = v.tem.showTable && !scrubbed;
  const sim = hasTable ? simulate(v.tem.all, st.ysi, v.ysi.rows) : null;
  const simOn = !!sim && showTable;
  const picksN = v.ysi.rows.filter((y) => st.ysi[y.key]).length;
  let rows: { key: string; gap: boolean; gapT: string; pos: number; team: string; pj: number; g: number; e: number; p: number; dg: string; pts: number; us: boolean; prov: boolean; sim: boolean; mv: string }[];
  if (sim && simOn) {
    const u = sim.findIndex((x) => x.us);
    rows = (st.allTable ? sim : sim.filter((r, i) => i === 0 || Math.abs(i - u) <= 3 || r.sim)).map((r) => ({ ...r, gap: false, gapT: "", dg: sign(r.dg), prov: false }));
  } else rows = (st.allTable ? v.tem.all : v.tem.rows).map((r) => ({ key: r.key, gap: r.gap, gapT: r.gapT, pos: r.pos, team: r.team, pj: r.pj, g: r.g, e: r.e, p: r.p, dg: r.dg, pts: r.pts, us: r.us, prov: r.prov, sim: false, mv: "" }));
  const tRows = rows.map((r) => ({ ...r, prov: r.prov && r.us, cls: [r.us ? "us" : "", r.prov && r.us ? "prov" : "", r.sim ? "sim" : ""].filter(Boolean).join(" ") }));
  const simUs = sim?.find((r) => r.us) ?? null;
  const tableT = simOn ? "La clasificación, con tus resultados" : v.tem.tableT;
  const tableSub = simOn
    ? simUs
      ? `Acabaríamos ${simUs.pos}º con ${simUs.pts} puntos · de mentira`
      : ""
    : showTable
      ? v.tem.tableSub
      : hasTable && scrubbed
        ? `Sin tabla de la liga tras la J${v.upto}`
        : "La liga aún no la ha publicado";
  // the league keeps only today's table: during the replay the table waits, la cinta carries the points
  const calSub = hasTable && scrubbed ? `La liga solo guarda su tabla al día: tras la J${v.upto} llevábamos ${plural(acc, "punto", "puntos")}. Sigue el repaso o vuelve a hoy.` : v.tem.calSub;

  // ---------- the side column
  const team = v.records.team;
  const sMax = Math.max(4, ...team.map((r) => Math.max(r.best, r.cur)));
  const sysRows = v.campo.sysRows;
  const mostUsed = sysRows.slice().sort((a, b) => b.pj - a.pj)[0];

  return {
    kick: v.tem.kick, title: v.tem.title, sub: v.tem.sub, prov: v.tem.prov && !/si acaba as/i.test(v.tem.title), live: (st.playing ? "off" : "polite") as "off" | "polite",
    n: N, cinta, cintaMeta, ptsLine, ptsArea, pace, paceT: "Ritmo de 1,5 puntos por jornada", ptsDots, ptsLab, jd, ...ctl,
    teamMeta: v.time.scopeS,
    wdl: [
      { k: "g", L: "G", n: w },
      { k: "e", L: "E", n: e },
      { k: "p", L: "P", n: l },
    ].filter((x) => x.n > 0),
    wdlAria: `${w} ganados, ${e} empatados y ${l} perdidos`,
    pct: fig(kf(/^de victorias/)), pts: fig(kf(/^puntos?\b/)), pj: fig(kf(/^partidos?$/)), gpp: fig(kf(/por partido/)), cs: fig(kf(/porterías?/)),
    gf, gc, gfW: Math.round((gf / gmax) * 100), gcW: Math.round((gc / gmax) * 100),
    chips: [kf(/amarilla/), kf(/por jugar/)].filter((k) => k.t).map(fig),
    race, raceAria: `La carrera de ${(RACES.find((x) => x[0] === raceK) ?? RACES[0])[2]}`,
    raceOpts: RACES.map(([k, t]) => ({ key: k, t, on: raceK === k, pick: () => act.set({ raceK: k }) })),
    raceCap: [v.tem.raceCap, v.tem.raceSub].filter(Boolean),
    raceMeta: upTo ? `Tras la J${upTo}: quién iba delante` : "Quién va delante, y desde cuándo",
    showTable: showTable && tRows.length > 0, rows: tRows, tableT, tableSub, calSub,
    canAll: showTable && (v.tem.more || st.allTable), allT: st.allTable ? "Ver solo nuestra zona" : `Ver la tabla entera (${v.tem.n} equipos)`, toggleAll: () => act.set({ allTable: !st.allTable }),
    champ: showTable && v.tem.champ, champT: v.tem.champT,
    hasYsi: v.ysi.rows.length > 0 && !v.all,
    ysiT: picksN ? `¿Y si…? · ${plural(picksN, "resultado de mentira", "resultados de mentira")}` : "¿Y si…?", ysiCls: picksN ? "is-on" : "",
    ysiLine: hasTable ? "Pon resultados a lo que queda y la tabla se recoloca" : "Pon resultados a lo que queda: los puntos ya se cuentan",
    openYsi: () => act.open("ysi"),
    cromos: v.records.cromos.map((c) => ({ key: c.key, got: c.got, kind: CROMO_KIND[c.kind] ?? c.kind, title: c.title, value: c.value, unit: c.unit, who: c.who, sub: [c.vs, c.j].filter(Boolean).join(" · "), left: c.left, href: c.got && c.id ? `/partidos/${c.id}` : "" })),
    cromoMeta: `${v.records.cromoGot} de ${v.records.cromoN} conseguidos`,
    cromoOpts: CROMOS.map(([k, t]) => ({ key: k, t, on: st.cromoK === k, pick: () => act.set({ cromoK: k }) })),
    form: v.tem.form, mvpLine: v.tem.mvpLine,
    streaks: team.map((r) => ({ key: r.key, t: r.t, cur: r.cur, live: r.live, line: r.line, curW: Math.round((r.cur / sMax) * 100), bestW: Math.min(99, Math.round((r.best / sMax) * 100)) })),
    teamRec: v.records.teamRec,
    sys: sysRows.map((y) => ({
      key: y.key, label: y.label, line: `${plural(y.pj, "partido", "partidos")} · ${y.rec} · ${y.gfga} · ${y.ppg} pts/partido`,
      rows: [1].concat(String(y.label).split("-").map(Number).filter((n) => n > 0)).map((n) => n),
    })),
    sysMeta: mostUsed ? `El más usado: ${mostUsed.label}` : "Aún sin sistemas en las actas",
    said: v.tem.said,
    acc,
  };
}
export type TemporadaView = ReturnType<typeof temporadaView>;

/** «¿Y si…?»: the sheet's numbers — the points with our made-up results, where we would finish (moving the rival
 *  of each game too), and the games still to play. */
export function ysiView(v: NuView, st: NuState, act: Act) {
  const left = v.ysi.rows;
  const picks = left.filter((y) => st.ysi[y.key]);
  const anyY = picks.length > 0;
  const extra = picks.reduce((n, y) => n + ({ g: 3, e: 1, p: 0 } as const)[st.ysi[y.key] ?? "p"], 0);
  const hasTable = v.tem.n > 0;
  const sim = hasTable ? simulate(v.tem.all, st.ysi, left) : null;
  const simUs = sim?.find((r) => r.us) ?? null;
  const tableUs = v.tem.all.find((r) => r.us);
  const base = tableUs ? num(tableUs.pts) : seasonPoints(v.se.matches);
  return {
    lead: hasTable
      ? "Pon un resultado de mentira a lo que queda: la clasificación se recoloca al momento, sumando también al rival de cada partido."
      : "Pon un resultado de mentira a lo que queda: los puntos se suman ya; cuando la liga publique la tabla, también se recolocará.",
    proj: simUs ? simUs.pts : base + extra,
    projT: anyY ? "puntos con tus resultados de mentira" : `puntos ahora mismo${left.length ? ` · quedan ${left.length}` : ""}`,
    hasPos: anyY && !!simUs, pos: simUs ? `Acabaríamos ${simUs.pos}º` : "",
    rows: left,
    clear: () => act.set({ ysi: {} }), goT: hasTable ? "Ver la tabla" : "Hecho",
    all: v.ysi.fillG, allT: "Ganarlo todo",
  };
}
