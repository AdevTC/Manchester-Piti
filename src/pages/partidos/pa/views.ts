// Partidos «Vidrio» (PA- boards): what each screen says and lays out, pure — the board's renderVals over the
// season (season.ts). The identity (the three screens' live headlines, the count, the rival search), Jornadas (the
// minimap, the ribbon's window and tiles, the lens: Previa · Directo · Acta · Aplazado), Tabla (el camino, the
// table in focus or entera, «La tabla, mientras llega», «¿Y si…?») and Balance (the columns, the readout, the
// seven facets). Handlers live in the components; these return words, numbers and ids.
import { clockTime as hhmm, daysBetween, distanceText, longDay, shortDay, tinyDay, untilText, postponedLine, newDateLine } from "../vidrio/model";
import { MONTHS_SHORT, madridDate } from "../../../lib/derived/madrid";
import { homeFirst } from "../../../lib/derived/words";
import { capW as cap, grad, listW, onPitch, ourLine, pluralW as plural, scorers, signed, simulate, slugW, stretches, streaks, tableOf, type Ev, type Letter, type PMatch, type PSeason, type TRow } from "./season";
import type { StandingRow } from "../../../lib/standings";
import { matchVideoHref } from "../../../../functions/src/matchVideo";
import { actaNotas, myNota, notaBadge, type NotaOf } from "./notas";

export type Screen = "jornadas" | "tabla" | "balance";
export const SCREENS: readonly Screen[] = ["jornadas", "tabla", "balance"];
export const SCREEN_LABEL: Record<Screen, string> = { jornadas: "Jornadas", tabla: "Tabla", balance: "Balance" };
export const SCREEN_ICON = { jornadas: "fixtures", tabla: "trophy", balance: "chart" } as const;
export type Lente = "previa" | "directo" | "acta";
export type Filt = "todos" | "proximos" | "resultados";
export const FACETS = ["goles", "minutos", "rachas", "porteria", "tarjetas", "cuando", "rivales"] as const;
export type Facet = (typeof FACETS)[number];
export const FACET_LABEL: Record<Facet, string> = { goles: "Goles", minutos: "Minutos", rachas: "Rachas", porteria: "Portería", tarjetas: "Tarjetas", cuando: "Cuándo", rivales: "Rivales" };
export type Picks = Record<string, Letter>;
export type Preset = "nada" | "asi" | "g" | "e" | null;

export interface Ctx {
  /** The page's width (the board's breakpoints: 700, 1100, 1800). */
  w: number;
  q: string;
  nm: (id: string) => string;
  num: (id: string) => string;
  known: (id: string) => boolean;
  myId: string | null;
  member: boolean;
  captain: boolean;
  seasonName: string;
  league: string;
  /** The published table (null: the league has not published it). */
  standings: { rows: StandingRow[]; prev: StandingRow[] | null; jornada: number | null; updatedAt: number; by: string } | null;
  /** The match page of a jornada. */
  matchPath: (m: PMatch) => string;
  /** A player's nota in a match (the season's «valoración Piti»; null without one). */
  notaOf: NotaOf;
}

const MES = MONTHS_SHORT;
const monthOf = (at: number) => Number(madridDate(at).slice(5, 7)) - 1;
const dayOf = (at: number) => Number(madridDate(at).slice(8, 10));
const scoreT = (m: PMatch) => (m.score ? `${m.score.gf}–${m.score.ga}` : "");
const whereUs = (m: PMatch) => (m.home ? "En casa" : "Fuera");
const VERB: Record<Letter, string> = { G: "Ganamos", E: "Empatamos", P: "Perdimos" };
const vs = (m: PMatch) => (m.home ? "contra " : "en casa de ");

// ───────────────────────── the identity ─────────────────────────

export function identityView(se: PSeason, ctx: Ctx) {
  const ms = se.matches;
  const ourL = ourLine(ms, true);
  const remaining = ms.filter((m) => m.state !== "jugado" && m.state !== "directo" && m.state !== "pendiente").length;
  const countLine = `${plural(ms.length, "jornada")}; ${plural(se.played.length, "jugada")}${se.live ? ", una en directo" : ""} y ${remaining} por jugar`;
  const tbl = tableOf(ctx.standings?.rows ?? null, ctx.standings?.jornada ?? null, se, true);
  const usRow = tbl?.find((r) => r.us) ?? null;
  const lastJ = se.played.length ? se.played[se.played.length - 1].j : 0;
  const heads: Record<Screen, string> = {
    jornadas: se.live
      ? `J${se.live.j} en directo, ${scoreT(se.live)}`
      : se.next
        ? `J${se.next.j}: ${shortDay(se.next.at, se.now).replace(/^(\w+) /, (_a, b: string) => `${b.toLowerCase()} `)}`
        : ms.length
          ? "Temporada cerrada"
          : "Sin calendario",
    tabla: !tbl || !usRow ? "Sin publicar" : usRow.prov ? `${usRow.pos}${se.live ? "º si acaba así" : `º con la J${lastJ}`}` : `${usRow.pos}º con ${usRow.pts} puntos`,
    balance: se.played.length || se.live ? `${ourL.gf}–${ourL.gc} en ${plural(ourL.pj, "partido")}` : "Aún sin jugar",
  };
  const qn = ctx.q.trim().toLowerCase();
  const found = qn ? ms.filter((m) => m.rival.toLowerCase().includes(qn)) : [];
  const find = {
    open: !!qn,
    none: !!qn && !found.length,
    items: found.slice(0, 8).map((m) => ({ j: m.j, t: `J${m.j} · ${m.rival}`, sub: `${m.score ? `${m.state === "directo" ? "En directo, " : ""}${scoreT(m)} · ` : ""}${shortDay(m.at)} · ${whereUs(m).toLowerCase()}` })),
  };
  return { countLine, heads, find, tbl, usRow };
}

// ───────────────────────── JORNADAS ─────────────────────────

export interface JorState {
  sel: number | null;
  lente: Lente | null;
  filt: Filt;
  win: number | null;
}

export const winSizeFor = (w: number): number => (w >= 1800 ? 10 : w >= 1300 ? 7 : w >= 700 ? 6 : 99);

export function selectedOf(se: PSeason, sel: number | null): PMatch | null {
  return (sel !== null ? se.matches.find((m) => m.j === sel) : null) ?? se.focus;
}

export function jornadasView(se: PSeason, st: JorState, ctx: Ctx) {
  const ms = se.matches;
  const sel = selectedOf(se, st.sel);
  if (!sel) return null;
  const winSize = winSizeFor(ctx.w);
  let filtered = ms.filter((m) => (st.filt === "todos" ? true : st.filt === "proximos" ? m.state !== "jugado" && m.state !== "pendiente" : m.state === "jugado" || m.state === "directo" || m.state === "pendiente"));
  if (!filtered.length) filtered = ms;
  const selIdx = Math.max(0, filtered.indexOf(sel));
  let start = st.win ?? Math.max(0, Math.min(filtered.length - winSize, selIdx - Math.floor(winSize / 2) + (winSize > 6 ? 1 : 0)));
  if (winSize >= 99) start = 0;
  start = Math.max(0, Math.min(start, Math.max(0, filtered.length - winSize)));
  const visible = filtered.slice(start, start + winSize);
  const nAll = ms.length;
  const mw = Math.min(8, 72 / Math.max(1, nAll));
  const markX = (i: number) => (nAll > 1 ? Math.round((i / (nAll - 1)) * (100 - mw) * 100) / 100 : 0);
  const marks = ms.map((m, i) => ({
    j: m.j,
    x: markX(i),
    w: Math.round(mw * 100) / 100,
    bg: grad(m.paint.a),
    l: m.letter && m.state === "jugado" ? m.letter : m.state === "directo" ? "•" : "",
    cls: [visible.includes(m) ? "is-win" : "", m === sel ? "is-sel" : "", filtered.includes(m) ? "" : "is-dim", m.state === "aplazado" ? "is-pp" : "", m.state === "directo" ? "is-live" : ""].filter(Boolean).join(" "),
  }));
  const months: { x: number; t: string }[] = [];
  let lastMo = -1;
  ms.forEach((m, i) => {
    const mo = monthOf(m.at);
    if (mo !== lastMo) {
      lastMo = mo;
      months.push({ x: markX(i), t: MES[mo] ?? "" });
    }
  });
  const firstVis = ms.indexOf(visible[0]);
  const lastVis = ms.indexOf(visible[visible.length - 1]);
  const nowIdx = Math.max(0, ms.filter((m) => m.at <= se.now + 3 * 3_600_000).length - 1);
  const tiles = visible.map((m, k) => {
    const prev = k > 0 ? visible[k - 1] : null;
    const days = prev ? Math.round((m.at - prev.at) / 86_400_000) : 7;
    const christmas = !!prev && (monthOf(prev.at) === 11 || monthOf(m.at) === 0) && monthOf(prev.at) !== monthOf(m.at);
    const gapL = !prev ? "" : days >= 21 ? (christmas ? "Navidad" : `${plural(Math.round(days / 7) - 1, "semana")} sin partido`) : days >= 14 ? `${dayOf(prev.at + 7 * 86_400_000)} ${MES[monthOf(prev.at + 7 * 86_400_000)]}, sin partido` : "";
    const isSel = m === sel;
    const s = m.state;
    const pa = m.paint;
    // (the viewer's own nota, a player's only: «Tú 4,9»)
    const tu = s === "jugado" ? myNota(m.id, ctx.myId, ctx.notaOf) : null;
    return {
      j: m.j,
      gap: k > 0,
      gapU: Math.round(Math.max(1, Math.min(3.2, days / 7)) * 100) / 100,
      gapL,
      rd: k * 60,
      slotCls: `${isSel ? "is-sel " : ""}${s === "directo" ? "is-live " : ""}${s === "jugado" ? "is-done" : ""}`.trim(),
      paintCls: `${isSel ? "is-sel " : ""}${s === "aplazado" ? "is-pp" : ""}`.trim(),
      ga: grad(pa.a),
      gb: grad(pa.b),
      m0: pa.m0,
      m1: pa.m1,
      sun: !!pa.sun && s !== "aplazado",
      sunCls: pa.sun?.noon ? "pa-pnoon" : "pa-psun",
      sunX: pa.sun?.x ?? 0,
      sunY: pa.sun?.y ?? 0,
      floods: pa.floods && s !== "aplazado",
      segCls: s === "directo" ? "pa-seg--live" : s === "aplazado" ? "pa-seg--pp" : "",
      sel: isSel,
      day: shortDay(m.at, se.now),
      tiny: tinyDay(m.at, se.now),
      light: s === "hoy" || s === "proximo" || s === "directo" ? pa.line : "",
      cd: s === "hoy" ? untilText(m.at, se.now) : "",
      scoreT: m.score ? scoreT(m) : "",
      liveMin: s === "directo" ? m.minute : null,
      letter: s === "jugado" ? (m.letter ?? "") : "",
      lc: (m.letter ?? "").toLowerCase(),
      pp: s === "aplazado",
      pend: s === "pendiente",
      video: !!matchVideoHref(m.match.videoUrl),
      tu,
      rival: m.rival,
      where: whereUs(m),
      aria: `J${m.j}, ${longDay(m.at)}, ${vs(m)}${m.rival}. ${s === "jugado" && m.letter ? `Jugado: ${scoreT(m)}, ${VERB[m.letter].toLowerCase()}` : s === "directo" ? `En directo: ${scoreT(m)}${m.minute !== null ? `, minuto ${m.minute}` : ""}` : s === "aplazado" ? "Aplazado" : s === "pendiente" ? "Pendiente del acta" : s === "hoy" ? `Hoy a las ${hhmm(m.at)}` : "Por jugar"}${tu ? `. Tu nota: ${tu.t}, ${tu.word}` : ""}${matchVideoHref(m.match.videoUrl) ? ". Con vídeo en YouTube" : ""}`,
    };
  });
  return {
    sel,
    filtered,
    start,
    winSize,
    tiles,
    marks,
    months,
    n: nAll,
    winTxt: `de la J${visible[0].j} a la J${visible[visible.length - 1].j}`,
    ribLabel: `Jornadas de la J${visible[0].j} a la J${visible[visible.length - 1].j}. Las flechas te mueven entre jornadas.`,
    winX: markX(firstVis),
    winW: Math.round((markX(lastVis) + mw - markX(firstVis)) * 100) / 100,
    hoyX: Math.round((markX(nowIdx) + mw / 2) * 100) / 100,
    noPrev: start <= 0,
    noNext: start + winSize >= filtered.length,
    hoyOff: sel === se.focus,
    markCenter: (i: number) => (markX(i) + mw / 2) / 100,
  };
}

// ── the lens

export function lensTabsOf(m: PMatch): [Lente, string][] {
  if (m.state === "jugado") return [["previa", "Previa"], ["directo", "Directo"], ["acta", "Acta"]];
  if (m.state === "directo" || m.state === "hoy") return [["previa", "Previa"], ["directo", "Directo"]];
  return [];
}
export const initialLente = (m: PMatch): Lente => (m.state === "jugado" ? "acta" : m.state === "directo" ? "directo" : "previa");

export function lenteOf(m: PMatch, asked: Lente | null): Lente | "pp" {
  if (m.state === "aplazado") return "pp";
  const lt = lensTabsOf(m);
  return asked && lt.some((t) => t[0] === asked) && !(m.state === "hoy" && asked === "directo") ? asked : initialLente(m);
}

const GHOST: [number, number][] = [[50, 88], [20, 66], [50, 70], [80, 66], [30, 42], [70, 42], [50, 18]];

export function lensView(se: PSeason, sel: PMatch, asked: Lente | null, ctx: Ctx) {
  const ms = se.matches;
  const { nm } = ctx;
  const lente = lenteOf(sel, asked);
  const lt = lensTabsOf(sel);
  const lens = {
    j: sel.j,
    ini: sel.ini,
    logo: sel.logo,
    /** At home: the board puts the home side on the left (homeFirst). */
    home: sel.home,
    rival: sel.rival,
    venue: sel.venue,
    lente,
    title: `${sel.home ? "Contra " : "En casa de "}${sel.rival}`,
    aria: `Jornada ${sel.j}, ${vs(sel)}${sel.rival}`,
    when: `${daysBetween(se.now, sel.at) === 0 ? `Hoy, ${longDay(sel.at)}` : cap(longDay(sel.at))}, a las ${hhmm(sel.at)}. ${sel.venue}.`,
    tabs: lt.map(([id, t]) => {
      const off = sel.state === "hoy" && id === "directo";
      return { id, t, on: lente === id, off, live: sel.state === "directo" && id === "directo", small: off ? `a las ${hhmm(sel.at)}` : "" };
    }),
    only: lt.length ? "" : sel.state === "aplazado" ? "Aplazado" : sel.state === "pendiente" ? "Sin acta" : "Previa",
    href: ctx.matchPath(sel),
    /** El vídeo del partido (YouTube), null without one. */
    video: matchVideoHref(sel.match.videoUrl),
    usWhere: whereUs(sel),
    themWhere: sel.home ? "Fuera" : "En casa",
  };
  // previa
  const wd = longDay(sel.at).split(" ")[0];
  const playedLineup = (sel.state === "jugado" || sel.state === "directo") && sel.raw.lineup.length > 0;
  const prevMeet = ms.find((m) => m.rival === sel.rival && m.j < sel.j && m.score);
  const kitKey = sel.kit;
  const fc = sel.raw.fc;
  const pre = {
    time: hhmm(sel.at),
    day: cap(longDay(sel.at)),
    dist:
      sel.state === "jugado"
        ? `Se jugó. ${sel.raw.wx ? `Hizo ${sel.raw.wx.t}°${sel.raw.wx.l ? `, ${sel.raw.wx.l.toLowerCase()}` : ""}.` : ""}`.trim()
        : sel.state === "directo"
          ? "Se está jugando."
          : sel.state === "pendiente"
            ? "Se jugó; falta el acta."
            : distanceText(sel.at, se.now),
    sunAria: `El sol a la hora del partido: ${sel.paint.line.toLowerCase()}.`,
    hasFc: !!fc && fc.length > 0,
    light: sel.paint.line,
    fc: (fc ?? []).map((f) => ({ h: f.h, t: f.t, cls: f.ko ? "is-ko" : "" })),
    ghosts: playedLineup ? [] : GHOST.map(([x, y]) => ({ x, y })),
    ghostNote: playedLineup ? `El siete de la J${sel.j}${sel.raw.system ? ` (${sel.raw.system})` : ""}: ${listW(sel.raw.lineup.map(nm))}.` : "Aún sin el siete: el capitán lo saca de la pizarra la víspera.",
    pitchAria: playedLineup ? "El siete que salió" : "El campo, aún sin el siete",
    open: sel.state === "hoy" || sel.state === "proximo",
    wd,
    convNote: "La convocatoria es del vestuario; el siete sale aquí en cuanto el capitán lo publique.",
    h2hT: prevMeet?.letter ? `En la ida: ${VERB[prevMeet.letter].toLowerCase()} ${scoreT(prevMeet)}` : `La primera vez contra ${sel.rival}`,
    h2hS: prevMeet ? `J${prevMeet.j}, ${whereUs(prevMeet).toLowerCase()}.` : "Sin partidos anteriores en la app.",
    place: `${sel.home ? "En casa" : "Fuera"}, en Puente de Vallecas`,
    kitKey,
    kitAlt: kitKey === "home" ? "La primera equipación, celeste" : "La segunda equipación, negra y roja",
    kitT: kitKey === "home" ? "Primera equipación" : "Segunda equipación",
    kitS: kitKey === "home" ? "La celeste" : "La de fuera",
  };
  // directo (live, or the replay of a played one)
  const dm = sel.state === "directo" ? (sel.minute ?? 0) : sel.dur;
  const keyEv = sel.ev.filter((e) => e.k !== "s" && e.min <= dm);
  let gf = 0;
  let ga = 0;
  const playsAsc = keyEv.map((e) => {
    if (e.k === "g") gf++;
    if (e.k === "r") ga++;
    return { ...playOf(e, sel, nm), s: e.k === "r" ? `Se pone ${gf}–${ga}` : e.k === "g" ? `${e.with ? `Pase de ${nm(e.with)}` : "Sin asistencia: jugada suya"}. ${gf}–${ga}` : playOf(e, sel, nm).s };
  });
  const plays = playsAsc.reverse();
  const showN = ctx.w >= 1100 ? 5 : 4;
  const fieldIds = onPitch(sel, Math.min(dm, sel.dur - 0.5));
  const benchIds = [...sel.raw.starters, ...sel.raw.bench].filter((id) => !fieldIds.includes(id));
  const subsTill = sel.ev.filter((e) => e.k === "s" && e.min <= dm).length;
  const dir = {
    gf: sel.score?.gf ?? 0,
    ga: sel.score?.ga ?? 0,
    live: sel.state === "directo",
    min: sel.minute,
    aria: `Marcador: ${homeFirst(sel.home, `Manchester Piti ${sel.score?.gf ?? 0}`, `${sel.rival} ${sel.score?.ga ?? 0}`).join(", ")}`,
    half: sel.state === "directo" ? ((sel.minute ?? 0) > sel.dur / 2 ? "de la segunda parte" : "de la primera parte") : "Final. El partido entero, jugada a jugada.",
    playedW: Math.round((dm / sel.dur) * 1000) / 10,
    durT: `${sel.dur}′`,
    marks: keyEv.filter((e) => e.k === "g" || e.k === "r" || e.k === "y" || e.k === "ry" || e.k === "rd").map((e, i) => ({ i, x: Math.round(Math.min(100, (e.min / sel.dur) * 100) * 10) / 10, cls: e.k === "g" ? "is-gold" : e.k === "r" ? "is-them" : `is-card${e.k === "ry" ? " is-down" : ""}` })),
    momAria: `Los goles en el tiempo: arriba los nuestros, abajo los de ${sel.rival}.`,
    mesa: sel.state === "directo" ? `Lo anota la mesa, jugada a jugada.${subsTill ? ` ${plural(subsTill, "cambio")} hasta ahora.` : ""}` : `Lo anotó la mesa: ${plural(sel.raw.subs || subsTill, "cambio")} en el partido.`,
    plays: plays.slice(0, showN),
    more: plays.length > showN && keyEv.length ? `${plural(plays.length - showN, "jugada más", "jugadas más")} desde el minuto ${keyEv[0].min}` : "",
    fieldT: sel.state === "directo" ? "En el campo ahora" : "En el campo al final",
    field: fieldIds.length ? `${listW(fieldIds.map(nm))}.` : "Sin el siete apuntado.",
    bench: benchIds.length ? `En el banquillo: ${listW(benchIds.map(nm))}.` : "",
  };
  // acta
  const ourGoals = sel.ev.filter((e) => e.k === "g");
  const theirs = sel.ev.filter((e) => e.k === "r");
  const goals: { cls: string; min: string; t: string; s: string; at: number }[] = ourGoals.map((e) => ({ cls: "is-gold", min: `${e.min}′`, t: e.who ? nm(e.who) : "Gol en propia", s: e.with ? `Pase de ${nm(e.with)}` : e.who ? "Sin asistencia" : `de ${sel.rival}`, at: e.min }));
  if (theirs.length > 3) goals.push({ cls: "is-them", min: String(theirs.length), t: sel.rival, s: theirs.map((e) => `${e.min}′`).join(", "), at: theirs[0].min });
  else for (const e of theirs) goals.push({ cls: "is-them", min: `${e.min}′`, t: sel.rival, s: "", at: e.min });
  goals.sort((a, b) => a.at - b.at);
  const mvp = sel.raw.mvp;
  const mvpOpen = !!mvp?.open;
  const winners = mvp?.winners ?? [];
  const closes = mvp?.closes ? `Se vota hasta el ${longDay(mvp.closes)} a las ${hhmm(mvp.closes)}.` : "";
  const mins = sel.raw.min ? Object.keys(sel.raw.min).sort((a, b) => (sel.raw.min?.[b] ?? 0) - (sel.raw.min?.[a] ?? 0)) : sel.raw.starters;
  // las notas (public; only a played acta has them, and only who played 10′ or more)
  const notas = actaNotas(sel.id, sel.state === "jugado" ? [...mins, ...sel.raw.starters, ...sel.raw.bench] : [], ctx.notaOf, nm, ctx.myId);
  const notaIn = new Map(notas.rows.map((r) => [r.id, r]));
  const act = {
    gf: sel.score?.gf ?? 0,
    ga: sel.score?.ga ?? 0,
    aria: `Resultado final: ${homeFirst(sel.home, `Manchester Piti ${sel.score?.gf ?? 0}`, `${sel.rival} ${sel.score?.ga ?? 0}`).join(", ")}`,
    final: sel.letter ? `${sel.provisional ? "A falta del acta" : "Final"} · ${{ G: "Victoria", E: "Empate", P: "Derrota" }[sel.letter]}` : "Final",
    goals,
    mvpCls: mvpOpen || !winners.length ? "is-open" : "",
    mvpK: mvpOpen ? "El MVP, votándose" : winners.length ? "MVP de la jornada" : "El MVP",
    mvpT: mvpOpen ? (mvp?.votes != null ? `${mvp.votes}${mvp.of ? ` de ${mvp.of}` : ""} ${mvp.votes === 1 && !mvp.of ? "voto" : "votos"}` : "Votándose") : winners.length ? listW(winners.map(nm)) : sel.provisional ? "Tras el acta" : "Sin votos",
    mvpS: mvpOpen ? closes : winners.length ? "Lo votó el vestuario." : sel.provisional ? "Se vota cuando se publique el acta." : "Nadie votó esta jornada.",
    vote: mvpOpen && !!ctx.myId,
    voteHref: `${ctx.matchPath(sel)}/vestuario`,
    cronT: sel.raw.narrated ? "El acta narrada" : "La crónica",
    cron: sel.raw.narrated
      ? `La mesa lo narró jugada a jugada: ${plural(sel.raw.subs, "cambio")}, ${plural(theirs.length, "gol", "goles")} en contra y ${ourGoals.length === 1 ? `el gol de ${ourGoals[0].who ? nm(ourGoals[0].who) : "rebote"} en el ${ourGoals[0].min}` : ourGoals.length ? `${ourGoals.length} nuestros` : "ninguno nuestro"}.${sel.match.analysisCoverage === "partial" ? " Cobertura parcial: pases y duelos, a medias." : ""}`
      : sel.letter
        ? `${VERB[sel.letter]} ${scoreT(sel)}${sel.home ? " en casa" : " fuera"}${ourGoals.length ? `: ${listW(ourGoals.map((e) => `${e.who ? nm(e.who) : "un gol en propia"} en el ${e.min}`))}.` : "."}`
        : "",
    facts: [
      ...(sel.raw.subs ? [{ icon: "swap" as const, t: `${sel.raw.subs} cambios.`, s: "En F7 se entra y se sale." }] : []),
      ...(sel.raw.saves ? [{ icon: "glove" as const, t: plural(sel.raw.saves, "parada"), s: `de ${listW(Object.keys(sel.raw.savesBy).map(nm))}.` }] : []),
      ...sel.ev.filter((e) => e.k === "pc").map((e) => ({ icon: "whistle" as const, t: "Penalti en contra", s: `en el ${e.min}${e.who ? `, de ${nm(e.who)}` : ""}.` })),
      ...sel.ev.filter((e) => e.k === "y" || e.k === "rd").map((e) => ({ icon: "flag" as const, t: e.k === "rd" ? "Roja" : "Amarilla", s: `a ${e.who ? nm(e.who) : "uno de los nuestros"}, en el ${e.min}.` })),
      ...(sel.raw.wx ? [{ icon: "sun" as const, t: `Hizo ${sel.raw.wx.t}°`, s: `${sel.raw.wx.l ? `${sel.raw.wx.l.toLowerCase()}, ` : ""}al pitido.` }] : []),
    ].slice(0, 4),
    /** «Las notas»: the best three, the viewer's own under them when he is not among them, and the way to all. */
    notas: notas.n ? { top: notas.top, mine: notas.mine, href: `${ctx.matchPath(sel)}/siete?vista=notas` } : null,
    minT: notas.n ? "Los minutos y la nota" : sel.raw.min ? "Quién jugó cuánto" : "El siete y el banquillo",
    mins: mins.slice(0, ctx.w >= 1100 ? 10 : 7).map((id) => {
      const stn: [number, number][] = sel.raw.stints?.[id] ?? (sel.raw.starters.includes(id) ? [[0, sel.dur]] : [[sel.dur * 0.6, sel.dur]]);
      // (a match with notas: each row its badge; under 10′, «—», sin nota)
      const nota = notas.n ? (notaIn.get(id) ?? notaBadge(null)) : null;
      return { id, n: ctx.num(id), name: nm(id), me: id === ctx.myId, nota, v: sel.raw.min ? (sel.raw.min[id] ?? 0) : Math.round(stn.reduce((a, s) => a + s[1] - s[0], 0)), stints: stn.map(([a, b]) => ({ x: (a / sel.dur) * 100, w: Math.max(1.5, ((b - a) / sel.dur) * 100) })) };
    }),
    minS: sel.raw.min ? `Cada barra, un rato en el campo: ${plural(Object.keys(sel.raw.min).length, "jugador")} para ${sel.dur} minutos.` : "Sin los minutos de la mesa en este partido: el siete, entero.",
  };
  const pp = {
    line: sel.raw.postponedReason ? postponedLine(sel.raw.postponedReason) : "Aplazado.",
    sub: sel.raw.postponedTo ? `${newDateLine(sel.raw.postponedTo)}.` : "La nueva fecha la pone la liga. En cuanto la haya, sale aquí y en el calendario.",
  };
  return { lens, pre, dir, act, pp };
}

function playOf(e: Ev, m: PMatch, nm: (id: string) => string) {
  const who = e.who ? nm(e.who) : "";
  const k = e.k;
  return {
    min: e.min,
    cls: k === "g" ? "is-gold" : k === "r" ? "is-them" : k === "y" || k === "ry" || k === "rd" ? "is-card" : "",
    icon: (k === "g" || k === "r" ? "ball" : k === "y" || k === "ry" || k === "rd" ? "flag" : k === "pc" ? "whistle" : k === "sv" ? "glove" : k === "w" ? "post" : "ball") as "ball" | "flag" | "whistle" | "glove" | "post",
    t: k === "g" ? (who ? `¡Gol de ${who}!` : "¡Gol! En propia") : k === "r" ? `Gol de ${m.rival}` : k === "y" ? `Amarilla a ${who}` : k === "rd" ? `Roja a ${who}` : k === "ry" ? `Tarjeta para ${m.rival}` : k === "pc" ? "Penalti en contra" : k === "sv" ? `Parada de ${who}` : k === "w" ? "Al palo" : "",
    s: k === "pc" ? (who ? `Lo comete ${who}` : "") : k === "w" ? (who ? `Disparo de ${who}` : "") : k === "ry" ? m.rival : "",
  };
}

// ───────────────────────── TABLA ─────────────────────────

export interface TbState {
  picks: Picks;
  preset: Preset;
  asi: boolean;
  all: boolean;
}

const isOpen = (m: PMatch) => m.state === "hoy" || m.state === "proximo" || m.state === "aplazado";

export function presetPicks(se: PSeason, id: Exclude<Preset, null>): Picks {
  const formCycle = se.played.map((m) => m.letter).filter((l): l is Letter => !!l);
  const o: Picks = {};
  se.open.forEach((m, i) => {
    const l: Letter | null = id === "nada" ? null : id === "asi" ? (formCycle.length ? formCycle[i % formCycle.length] : "E") : id === "g" ? "G" : "E";
    if (l) o[m.id] = l;
  });
  return o;
}

export function tablaView(se: PSeason, st: TbState, ctx: Ctx) {
  const ms = se.matches;
  const live = se.live;
  const isLive = !!live;
  const S = ctx.standings;
  const tbl = tableOf(S?.rows ?? null, S?.jornada ?? null, se, true);
  const tblPub = tableOf(S?.rows ?? null, S?.jornada ?? null, se, false);
  const ourL = ourLine(ms, true);
  const openMs = ms.filter(isOpen);
  const picks = Object.fromEntries(Object.entries(st.picks).filter(([id, l]) => l && openMs.some((m) => m.id === id))) as Picks;
  const nPicks = Object.keys(picks).length;
  const baseRows = tbl ? (st.asi || !isLive ? tbl : tblPub) : null;
  const simRows = baseRows && nPicks ? simulate(baseRows, picks) : baseRows;
  const pubPos: Record<string, number> = {};
  tblPub?.forEach((r) => (pubPos[r.team] = r.pos));
  const played = se.played;
  const lastPlayedJ = played.length ? played[played.length - 1].j : 0;
  const qn = ctx.q.trim().toLowerCase();
  const sameTeam = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const vsOf = (team: string) =>
    ms
      .filter((m) => sameTeam(m.rival, team))
      .map((m) => (m.score ? `${m.state === "directo" ? "ahora " : ""}${scoreT(m)}` : m.state === "aplazado" ? "aplazado" : `J${m.j}`))
      .join(" · ");
  const iniOf = (team: string) => ms.find((m) => sameTeam(m.rival, team))?.ini ?? team.slice(0, 2).toUpperCase();
  const logoOf = (team: string) => ms.find((m) => sameTeam(m.rival, team))?.logo;
  const provJ = (() => {
    const extra = ms.filter((m) => m.state === "jugado" && S?.jornada != null && m.j > S.jornada);
    return extra.length ? extra[extra.length - 1].j : lastPlayedJ;
  })();
  const mkRow = (r: TRow) => {
    const mv = pubPos[r.team] && (r.prov || r.sim) ? pubPos[r.team] - r.pos : 0;
    return {
      key: r.team,
      team: r.team,
      pos: r.pos,
      pj: r.pj,
      g: r.g,
      e: r.e,
      p: r.p,
      gf: r.gf,
      gc: r.gc,
      dg: signed(r.gf - r.gc),
      pts: r.pts,
      us: r.us,
      ini: r.us ? "MP" : iniOf(r.team),
      logo: r.us ? undefined : logoOf(r.team),
      cls: [r.us ? "is-us" : "", r.prov ? "is-prov" : "", r.sim ? "is-sim" : "", qn && r.team.toLowerCase().includes(qn) ? "is-found" : ""].filter(Boolean).join(" "),
      prov: !!(r.prov || r.sim),
      provTag: !r.us && !!(r.prov || r.sim),
      provT: r.sim ? "De mentira" : isLive ? "Si acaba así" : `Con la J${provJ}`,
      mv: mv ? (mv > 0 ? `↑${mv}` : `↓${-mv}`) : "",
      mvCls: mv > 0 ? "is-up" : "is-down",
      mvAria: mv > 0 ? `sube ${mv}` : `baja ${-mv}`,
      vs: r.us ? "" : vsOf(r.team),
      vt: `pa-row-${slugW(r.team)}`,
    };
  };
  type Row = ReturnType<typeof mkRow>;
  const rows: ({ gap: true; key: string; gapT: string } | ({ gap: false } & Row))[] = [];
  if (simRows) {
    const ui = simRows.findIndex((r) => r.us);
    if (st.all || ctx.w >= 1800 || ui < 0) simRows.forEach((r) => rows.push({ gap: false, ...mkRow(r) }));
    else {
      const a = Math.max(0, ui - 3);
      const b = Math.min(simRows.length, ui + 4);
      if (a > 0) rows.push({ gap: true, key: "above", gapT: `${plural(a, "equipo")} por encima` });
      simRows.slice(a, b).forEach((r) => rows.push({ gap: false, ...mkRow(r) }));
      if (b < simRows.length) rows.push({ gap: true, key: "below", gapT: `${plural(simRows.length - b, "equipo")} por debajo` });
    }
  }
  const us2 = simRows?.find((r) => r.us) ?? null;
  const leader = simRows?.[0] ?? null;
  const above = simRows && us2 && us2.pos > 1 ? simRows[us2.pos - 2] : null;
  const formSrc = ms.filter((m) => (m.state === "jugado" || m.state === "directo") && m.letter).slice(-6);
  const split = (["home", "away"] as const).map((k) => {
    const gs = ms.filter((m) => m.score && (k === "home") === m.home);
    let pts = 0;
    let g = 0;
    let e = 0;
    let p = 0;
    let f = 0;
    let c = 0;
    for (const m of gs) {
      if (!m.score) continue;
      f += m.score.gf;
      c += m.score.ga;
      if (m.letter === "G") {
        g++;
        pts += 3;
      } else if (m.letter === "E") {
        e++;
        pts++;
      } else p++;
    }
    return { t: k === "home" ? "En casa" : "Fuera", pts, rec: `${g}G ${e}E ${p}P`, goals: `${f}–${c}`, w: gs.length ? Math.round((pts / (gs.length * 3)) * 100) : 0 };
  });
  const near =
    simRows && us2
      ? simRows
          .filter((r) => !r.us && Math.abs(r.pts - us2.pts) <= 3)
          .slice(0, 4)
          .map((r) => {
            const nx = ms.find((m) => sameTeam(m.rival, r.team) && isOpen(m));
            return { team: r.team, ini: iniOf(r.team), logo: logoOf(r.team), s: `${r.pts} pts · ${r.pos}º`, d: nx ? `J${nx.j}${nx.state === "aplazado" ? ", aplazado" : `, ${nx.home ? "en casa" : "fuera"}`}` : "Ya jugados" };
          })
      : [];
  const maxPts = ourL.pts + openMs.length * 3;
  const simPts = ourL.pts + Object.values(picks).reduce((a, l) => a + (l === "G" ? 3 : l === "E" ? 1 : 0), 0);
  const cam = ms.map((m) => {
    const open = isOpen(m);
    return {
      j: m.j,
      id: m.id,
      ini: m.state === "aplazado" ? "Apl." : m.ini,
      ga: grad(m.paint.a),
      gb: grad(m.paint.b),
      m0: m.paint.m0,
      m1: m.paint.m1,
      cls: [m.state === "directo" ? "is-live" : "", m.state === "aplazado" ? "is-pp" : "", open ? "is-open" : "", picks[m.id] ? "is-picked" : ""].filter(Boolean).join(" "),
      res: !!m.score && !!m.letter,
      letter: m.letter ?? "",
      lc: (m.letter ?? "").toLowerCase(),
      scoreT: scoreT(m),
      sim: open,
      aria: `J${m.j}, ${vs(m)}${m.rival}${m.score ? `: ${scoreT(m)}${m.state === "directo" ? ", en directo" : ""}` : m.state === "aplazado" ? ", aplazado. ¿Y si…?" : open ? ". ¿Y si…?" : ""}`,
      opts: (["G", "E", "P"] as const).map((l) => ({ l, on: picks[m.id] === l, aria: `${{ G: "Ganamos", E: "Empatamos", P: "Perdemos" }[l]} en la J${m.j}` })),
    };
  });
  // the table's position after each published table we know of (the one before, and this one)
  const posSeries: { j: number; p: number }[] = [];
  if (S && us2) {
    const prevUs = S.prev ? [...S.prev].sort((a, b) => b.pts - a.pts || b.gf - b.gc - (a.gf - a.gc)).findIndex((r) => r.isUs) : -1;
    const pubUs = tblPub?.find((r) => r.us);
    if (prevUs >= 0 && S.jornada) posSeries.push({ j: S.jornada - 1, p: prevUs + 1 });
    if (pubUs) posSeries.push({ j: S.jornada ?? lastPlayedJ, p: pubUs.pos });
    if (us2.prov || us2.sim) posSeries.push({ j: (posSeries[posSeries.length - 1]?.j ?? 0) + 1, p: us2.pos });
  }
  const pubDate = S?.updatedAt ? `el ${longDay(S.updatedAt)}` : "";
  const ghost: ({ us: true; tag: string; pj: number; g: number; e: number; p: number; gf: number; gc: number; dg: string; pts: number } | { us: false; team: string; ini: string; logo?: string; vt: string; cls: string; l: string; lc: string; vs: string })[] = [
    { us: true, tag: isLive ? "Si acaba así" : "Lo nuestro", pj: ourL.pj, g: ourL.g, e: ourL.e, p: ourL.p, gf: ourL.gf, gc: ourL.gc, dg: signed(ourL.gf - ourL.gc), pts: ourL.pts },
  ];
  const seen = new Set<string>();
  for (const m of ms) {
    const key = m.rival.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ghost.push({
      us: false,
      team: m.rival,
      ini: m.ini,
      logo: m.logo,
      vt: `pa-row-${slugW(m.rival)}`,
      cls: qn && m.rival.toLowerCase().includes(qn) ? "is-found" : "",
      l: m.score && m.letter ? m.letter : `J${m.j}`,
      lc: m.score && m.letter ? m.letter.toLowerCase() : "j",
      vs:
        m.score && m.letter
          ? `${m.state === "directo" ? "Ahora, " : ""}${m.letter === "P" ? `nos gana ${m.score.ga}–${m.score.gf}` : m.letter === "G" ? `le ganamos ${scoreT(m)}` : `empate ${scoreT(m)}`} en la J${m.j}, ${whereUs(m).toLowerCase()}`
          : `${m.state === "aplazado" ? "Aplazado" : shortDay(m.at)} · ${whereUs(m).toLowerCase()}`,
    });
  }
  const rivalsN = seen.size;
  const usSim = !!us2?.sim;
  return {
    has: !!tbl,
    kick: `${ctx.seasonName}${ctx.league ? ` · ${ctx.league}` : ""}`,
    title: tbl && us2 ? (us2.sim ? "Así quedaría" : us2.prov ? (isLive ? "La clasificación" : `La tabla, con la J${provJ}`) : "La clasificación") : "La tabla, mientras llega",
    prov: !!(tbl && isLive && st.asi && us2?.prov && !us2.sim),
    sub: tbl && us2
      ? usSim
        ? "Con tus resultados de mentira en las jornadas que faltan. Solo cambian nuestros puntos: los demás no se mueven."
        : isLive && st.asi && live
          ? `Con el ${scoreT(live)} de ahora contra ${live.rival}: nuestra fila y la suya se mueven con el marcador.`
          : us2.prov
            ? `La liga la publicó tras la J${S?.jornada ?? ""}. Nuestra fila y la de ${ms.find((m) => m.j === provJ)?.rival ?? "su rival"} ya suman la J${provJ}, a falta de que la liga la confirme.`
            : `Publicada por la liga${S?.jornada ? ` tras la J${S.jornada}` : ""}${pubDate ? `, ${pubDate}` : ""}.${S?.by ? ` La subió ${S.by}.` : ""}`
      : "Lo que ya sabemos de la liga: los equipos de nuestro calendario, lo nuestro y lo que queda.",
    liveToggle: !!(tbl && isLive),
    camT: tbl ? "El camino" : "Nuestro camino",
    camS: openMs.length ? (nPicks ? `${plural(nPicks, "resultado")} de mentira · solo lo ves tú` : "Toca G, E o P en lo que falta: «¿Y si…?»") : "La temporada, entera",
    cam,
    tableT: usSim ? "La clasificación, de mentira" : "La clasificación",
    tableS: tbl ? `${plural(tbl.length, "equipo")} · ${st.all || ctx.w >= 1800 ? "la tabla entera" : "nosotros y los tres de cada lado"}` : "",
    tblCls: `${st.all ? "is-all " : ""}${ctx.w >= 1800 ? "is-wide" : ""}`.trim(),
    rows,
    summary: tbl
      ? st.all
        ? `Toda la liga: ${tbl.length} equipos.`
        : (() => {
            const shown = rows.filter((r): r is { gap: false } & Row => !r.gap);
            return shown.length ? `Del ${shown[0].pos}º al ${shown[shown.length - 1].pos}º de ${tbl.length}.` : "";
          })()
      : "",
    canGrow: ctx.w < 1800 && !!tbl && tbl.length > 7,
    allT: st.all ? "Volver a lo nuestro" : "Ver la tabla entera",
    allIcon: (st.all ? "collapse" : "expand") as "collapse" | "expand",
    pos: us2 ? `${us2.pos}º` : "",
    posT: us2 ? `${us2.pts} puntos${us2.sim ? ", de mentira" : us2.prov ? (isLive ? ", si acaba así" : `, con la J${provJ}`) : ""}` : "",
    posS: us2 ? (us2.pos === 1 ? `Líderes${simRows?.[1] ? `, a ${us2.pts - simRows[1].pts} del segundo` : ""}` : above && leader ? `A ${above.pts - us2.pts} del ${above.pos}º y a ${leader.pts - us2.pts} del líder` : "") : "",
    form: formSrc.map((m) => ({ j: m.j, t: m.letter ?? "", cls: m.state === "directo" ? "vd-form__l--prov" : `vd-form__l--${(m.letter ?? "e").toLowerCase()}`, aria: `J${m.j}, ${{ G: "ganado", E: "empate", P: "perdido" }[m.letter ?? "E"]}${m.state === "directo" ? ", provisional" : ""}` })),
    split,
    posSeries,
    teams: tbl?.length ?? 14,
    posAria: `Nuestra posición tras cada tabla: ${posSeries.map((p) => `J${p.j}, ${p.p}º`).join("; ")}.`,
    near,
    ptsAria: `Nuestros puntos: ${ourL.pts} tras ${plural(ourL.pj, "jornada")}; como mucho ${maxPts}.`,
    picks,
    ysiP: openMs.length ? (nPicks ? "Con lo que has tocado en el camino:" : "Toca G, E o P en las jornadas que faltan, arriba, y mira cómo queda.") : "No queda nada por jugar.",
    ysiBig: tbl && us2 ? `${us2.pos}º` : String(simPts),
    ysiT: tbl && us2 ? `${us2.pts} puntos${nPicks ? ", de mentira" : ""}` : `${simPts === 1 ? "punto" : "puntos"}${nPicks ? " con tus resultados" : ", de momento"}`,
    ysiS: `Como mucho ${maxPts} de ${ourL.pj * 3 + openMs.length * 3} posibles${tbl ? `; ${nPicks ? "el resto de la liga, quieto." : "si ganas todo lo que queda."}` : "."}`,
    presets: [
      ["nada", "Nada"],
      ["asi", "Como hasta ahora"],
      ["g", "Todo victorias"],
      ["e", "Todo empates"],
    ] as [Exclude<Preset, null>, string][],
    waitS: "En cuanto la liga la publique, el capitán la copia aquí y aparece con nuestra posición, la forma y casa y fuera. Mientras, esto es lo que sabemos.",
    ghost,
    ghostFoot: `${plural(ms.length, "jornada")}, ${ms.length > rivalsN ? "ida y vuelta contra cada rival" : "una contra cada rival"}. Los puntos de los demás, la posición y la forma llegan con la tabla de la liga.`,
    will: [
      { icon: "trophy" as const, t: "La clasificación entera", s: "Con nosotros en el centro y los tres de cada lado; la tabla entera, a un toque." },
      { icon: "chart" as const, t: "Nuestra posición, jornada a jornada", s: "Cada tabla que se publique queda guardada y dibuja la línea." },
      { icon: "home" as const, t: "En casa y fuera, y la forma", s: "Con las letras de los últimos seis partidos." },
      { icon: "bolt" as const, t: "Si acaba así", s: "Mientras se juega, nuestra fila se mueve con el marcador." },
    ],
    publishT: tbl ? "Actualizar la clasificación" : "Publicar la clasificación",
    capT: "Tú eres el capitán",
    capS: "Cuando la liga la publique, pégala en la Sala de control: la app lee la tabla de la web de la liga y la deja aquí. Es un minuto.",
  };
}

// ───────────────────────── BALANCE ─────────────────────────

export interface BalState {
  bal: number | null;
  hover: number | null;
  facet: Facet;
  all: boolean;
}

export function balanceView(se: PSeason, st: BalState, ctx: Ctx, usRow: TRow | null) {
  const { nm } = ctx;
  const ms = se.matches;
  const live = se.live;
  const isLive = !!live;
  const ourL = ourLine(ms, true);
  const withScore = ms.filter((m) => m.score);
  const played = se.played;
  const remaining = ms.filter((m) => isOpen(m)).length;
  const fN = withScore.filter((m) => m.state !== "directo").length;
  const pickedJ = st.hover ?? st.bal;
  const picked = pickedJ !== null ? (ms.find((m) => m.j === pickedJ) ?? null) : null;
  const scopeMs = picked?.score ? [picked] : withScore;
  const scopeJ = !!picked?.score;
  const maxG = Math.max(4, withScore.reduce((a, m) => Math.max(a, m.score?.gf ?? 0, m.score?.ga ?? 0), 0));
  const desk = ctx.w >= 1100;
  const cols = ms.map((m) => {
    const on = picked === m;
    return {
      j: m.j,
      ga: grad(m.paint.a),
      gb: grad(m.paint.b),
      m0: m.paint.m0,
      m1: m.paint.m1,
      sel: on,
      live: m.state === "directo",
      sun: !!m.paint.sun && m.state !== "aplazado",
      sunY: m.paint.sun ? Math.max(8, Math.min(52, m.paint.sun.y)) : 0,
      cls: [on ? "is-sel" : "", m.score ? "is-played" : "is-open", m.state === "directo" ? "is-live" : "", m.state === "aplazado" ? "is-pp" : ""].filter(Boolean).join(" "),
      letter: m.score && m.state !== "directo" ? (m.letter ?? "") : "",
      lc: (m.letter ?? "").toLowerCase(),
      us: m.score?.gf ?? 0,
      them: m.score?.ga ?? 0,
      sc: m.score ? scoreT(m) : m.state === "aplazado" ? "Apl." : `${dayOf(m.at)} ${MES[monthOf(m.at)]}`,
      ppT: m.state === "aplazado" ? "Aplazado" : "",
      aria: `J${m.j}, ${m.rival}${m.score ? `: ${plural(m.score.gf, "gol nuestro", "goles nuestros")}, ${plural(m.score.ga, "suyo")}${m.state === "directo" ? ", en directo" : ""}` : m.state === "aplazado" ? ", aplazado" : `, por jugar el ${longDay(m.at)}`}`,
    };
  });
  const sc = scorers(scopeMs, ctx.known, nm);
  const scAll = scorers(withScore, ctx.known, nm);
  const mvpWord = (m: PMatch) => (m.state === "directo" ? "Al acabar" : m.raw.mvp?.open ? "Votándose" : m.raw.mvp?.winners.length ? listW(m.raw.mvp.winners.map(nm)) : "Sin votar");
  let rd;
  if (picked) {
    const pg = picked.ev.filter((e) => e.k === "g");
    const pr = picked.ev.filter((e) => e.k === "r");
    const ida = ms.find((x) => x.rival === picked.rival && x.j < picked.j && x.score);
    rd = {
      isJ: true,
      kick: `J${picked.j} · ${shortDay(picked.at)} · ${whereUs(picked).toLowerCase()}`,
      tag: picked.state === "directo" ? `En directo, ${picked.minute ?? 0}′` : "",
      title: `${picked.home ? "Contra " : "En casa de "}${picked.rival}`,
      big: picked.score ? scoreT(picked) : hhmm(picked.at),
      bigCls: picked.score ? "" : "is-time",
      word: picked.score && picked.letter ? (picked.state === "directo" ? `Va ${{ G: "ganando", E: "empatando", P: "perdiendo" }[picked.letter]}` : { G: "Victoria", E: "Empate", P: "Derrota" }[picked.letter]) : picked.state === "aplazado" ? "Aplazado" : picked.state === "pendiente" ? "Sin acta" : "Por jugar",
      sub: picked.score
        ? picked.state === "directo"
          ? `Si acaba así, ${picked.letter === "G" ? "3 puntos" : picked.letter === "E" ? "1 punto" : "0 puntos"}`
          : picked.letter === "G"
            ? "3 puntos"
            : picked.letter === "E"
              ? "1 punto"
              : "Sin puntos"
        : picked.state === "aplazado"
          ? picked.raw.postponedTo
            ? newDateLine(picked.raw.postponedTo)
            : "Sin fecha nueva todavía"
          : distanceText(picked.at, se.now).replace(/\.$/, ""),
      sky: grad(picked.paint.a),
      light: `${picked.paint.line}${picked.raw.wx ? `. Hizo ${picked.raw.wx.t}°${picked.raw.wx.l ? `, ${picked.raw.wx.l.toLowerCase()}` : ""}` : ""}`,
      facts: picked.score
        ? [
            { t: "Nuestros goles", v: pg.length ? pg.map((e) => `${e.who ? nm(e.who) : "En propia"} ${e.min}′`).join(", ") : "Ninguno", cls: "is-us" },
            { t: `Los de ${picked.rival}`, v: pr.length ? pr.map((e) => `${e.min}′`).join(", ") : "Ninguno", cls: "is-them" },
            { t: "El MVP", v: mvpWord(picked), cls: "" },
            ...(picked.raw.subs ? [{ t: "Cambios", v: String(picked.raw.subs), cls: "" }] : []),
          ]
        : [
            { t: "El pitido", v: `${cap(longDay(picked.at))}, ${hhmm(picked.at)}`, cls: "" },
            { t: "Dónde", v: `${picked.venue}, ${whereUs(picked).toLowerCase()}`, cls: "" },
            { t: "La ida", v: ida?.letter ? `${VERB[ida.letter]} ${scoreT(ida)} (J${ida.j})` : "La primera vez", cls: "" },
          ],
      href: ctx.matchPath(picked),
      hint: "",
    };
  } else {
    rd = {
      isJ: false,
      kick: `${ctx.seasonName}${ctx.league ? ` · ${ctx.league}` : ""}${fN && played.length ? ` · tras la J${played[played.length - 1].j}` : ""}`,
      tag: isLive && live ? `Con la J${live.j} en juego` : "",
      title: withScore.length ? "La temporada, jornada a jornada" : "La temporada, por estrenar",
      big: withScore.length ? `${ourL.gf}–${ourL.gc}` : "0–0",
      bigCls: "is-season",
      word: withScore.length ? `${plural(ourL.pts, "punto")} de ${ourL.pj * 3}` : "Ni un minuto todavía",
      sub: withScore.length ? story(se, ourL, scAll.goals, nm, usRow) : ms.length ? `La J1 es el ${longDay(ms[0].at)}, a las ${hhmm(ms[0].at)}.` : "El calendario aún no está.",
      sky: "",
      light: "",
      facts: [
        { t: "Goles a favor", v: String(ourL.gf), cls: "is-us" },
        { t: "En contra", v: String(ourL.gc), cls: "is-them" },
        { t: "Diferencia", v: signed(ourL.gf - ourL.gc), cls: "" },
        { t: "Por jugar", v: plural(remaining, "jornada"), cls: "" },
      ],
      href: "",
      hint: desk ? "Pasa por una jornada y la pantalla entera la cuenta; tócala para dejarla fija." : "Toca una jornada y la pantalla entera la cuenta.",
    };
  }
  // the facets
  const scopeT = !withScore.length ? "" : scopeJ && picked ? `En la J${picked.j}:` : picked ? `La J${picked.j} está por jugar; en la temporada:` : "En la temporada:";
  const people: Record<string, { g: number; a: number }> = {};
  for (const r of sc.goals) people[r.id] = { g: r.v, a: 0 };
  for (const r of sc.assists) (people[r.id] ??= { g: 0, a: 0 }).a = r.v;
  const pIds = Object.keys(people).sort((a, b) => people[b].g - people[a].g || people[b].a - people[a].a || nm(a).localeCompare(nm(b), "es"));
  const goalsN = sc.goals.reduce((a, r) => a + r.v, 0);
  const asN = sc.assists.reduce((a, r) => a + r.v, 0);
  const minsAll: Record<string, number> = {};
  const apps: Record<string, number> = {};
  for (const m of scopeMs) {
    if (m.raw.min) for (const [id, v] of Object.entries(m.raw.min)) minsAll[id] = (minsAll[id] ?? 0) + v;
    for (const id of [...m.raw.starters, ...m.raw.bench]) if (ctx.known(id)) apps[id] = (apps[id] ?? 0) + 1;
  }
  const narrated = scopeMs.filter((m) => m.raw.min);
  const stintsOne = narrated.length === 1 ? narrated[0] : null;
  const fin = withScore.filter((m) => m.state !== "directo");
  const stk = streaks(fin);
  const cleanMs = scopeMs.filter((m) => m.score?.ga === 0 && m.state !== "directo");
  const savesBy: Record<string, number> = {};
  for (const m of scopeMs) {
    for (const [k, v] of Object.entries(m.raw.savesBy)) savesBy[k] = (savesBy[k] ?? 0) + v;
    if (!Object.keys(m.raw.savesBy).length) for (const e of m.ev) if (e.k === "sv" && e.who) savesBy[e.who] = (savesBy[e.who] ?? 0) + 1;
  }
  const savesN = Object.values(savesBy).reduce((a, b) => a + b, 0);
  const cardEv: { m: PMatch; e: Ev }[] = [];
  for (const m of scopeMs) for (const e of m.ev) if (e.k === "y" || e.k === "rd" || e.k === "ry" || e.k === "pc") cardEv.push({ m, e });
  const stre = stretches(scopeMs);
  const stMax = Math.max(1, ...stre.us, ...stre.them);
  const rivals: string[] = [];
  for (const m of ms) if (!rivals.includes(m.rival)) rivals.push(m.rival);
  const twoLegs = ms.length > rivals.length;
  const facet = st.facet;
  const yN = cardEv.filter((x) => x.e.k === "y").length;
  const heads: Record<Facet, string> = {
    goles: `${plural(goalsN, "gol", "goles")} · ${plural(asN, "asist.", "asist.")}`,
    minutos: Object.keys(minsAll).length
      ? (() => {
          const top = Object.keys(minsAll).sort((a, b) => minsAll[b] - minsAll[a])[0];
          return `${nm(top)}, ${minsAll[top]}′`;
        })()
      : "Convocatorias",
    rachas: stk.cur ? `${stk.n} ${{ G: stk.n === 1 ? "victoria" : "victorias", E: stk.n === 1 ? "empate" : "empates", P: stk.n === 1 ? "derrota" : "derrotas" }[stk.cur]}` : "Por empezar",
    porteria: `${plural(savesN, "parada")} · ${cleanMs.length} a cero`,
    tarjetas: `${plural(yN, "amarilla")}${cardEv.some((x) => x.e.k === "pc") ? " · penalti" : ""}`,
    cuando: "Por tramos de 5′",
    rivales: `${plural(rivals.length, "rival", "rivales")}${twoLegs ? " · ida y vuelta" : ""}`,
  };
  const capN = desk ? (st.all ? 99 : ctx.w >= 1800 ? 8 : 6) : st.all ? 99 : 5;
  const fc = {
    id: facet,
    scope: scopeT,
    line: "",
    canGrow: false,
    growT: "",
    growIcon: "expand" as "expand" | "collapse",
    note: "",
    noteIcon: "chart" as "chart" | "shirt" | "ball" | "swap" | "glove",
    door: "",
    doorPath: "",
    tiles: [] as { icon: "bolt" | "shield" | "trophy" | "ball" | "glove"; v: string; t: string; s: string }[],
    formT: "",
    form: [] as { j: number; t: string; cls: string; aria: string }[],
    cards: [] as { id: string; name: string; you: boolean; s: string; g: number; gT: string; a: number; aT: string; num: string }[],
    list: [] as { key: string; min: string; cls: string; icon: "ball" | "flag" | "whistle" | "glove"; t: string; s: string }[],
    mins: [] as { id: string; n: string; name: string; v: string; stints: { x: number; w: number }[] }[],
    stretch: [] as { u: number; d: number }[],
    whenAria: "",
    mx: [] as { rival: string; ini: string; logo?: string; cls: string; legs: { j: number; cls: string; l: string; lc: string; t: string; aria: string }[] }[],
  };
  const growTo = (n: number, what: string, lim = capN) => {
    if (n > lim || st.all) {
      fc.canGrow = true;
      fc.growT = st.all ? "Volver" : `Ver ${what} (${n})`;
      fc.growIcon = st.all ? "collapse" : "expand";
    }
  };
  const evRow = (m: PMatch, e: Ev, i: number) => {
    const k = e.k;
    const who = e.who ? nm(e.who) : "";
    return {
      key: `${m.j}-${i}-${e.min}-${k}`,
      min: `${e.min}′`,
      cls: k === "g" ? "is-gold" : k === "r" ? "is-them" : k === "y" || k === "ry" || k === "rd" ? "is-card" : "",
      icon: (k === "g" || k === "r" ? "ball" : k === "y" || k === "ry" || k === "rd" ? "flag" : k === "pc" ? "whistle" : "glove") as "ball" | "flag" | "whistle" | "glove",
      t: k === "g" ? (who ? `Gol de ${who}` : "Gol en propia") : k === "r" ? `Gol de ${m.rival}` : k === "y" ? `Amarilla a ${who}` : k === "rd" ? `Roja a ${who}` : k === "ry" ? `Tarjeta para ${m.rival}` : k === "pc" ? `Penalti en contra${who ? `, de ${who}` : ""}` : `Parada de ${who}`,
      s: `${scopeJ ? "" : `J${m.j} · `}${k === "g" ? (e.with ? `pase de ${nm(e.with)}` : "sin asistencia") : k === "pc" ? (m.ev.some((x) => x.k === "r" && x.min >= e.min && x.min <= e.min + 2) ? `y gol de ${m.rival} al minuto` : "sin gol") : k === "r" || k === "ry" ? m.rival : ""}`,
    };
  };
  if (facet === "goles") {
    if (scopeJ && picked) {
      const gEv = picked.ev.filter((e) => e.k === "g" || e.k === "r");
      fc.line = gEv.length ? `${plural(gEv.filter((e) => e.k === "g").length, "gol nuestro", "goles nuestros")} y ${plural(gEv.filter((e) => e.k === "r").length, "suyo")}, minuto a minuto.` : "Sin goles.";
      const all = gEv.map((e, i) => evRow(picked, e, i));
      growTo(all.length, "los goles");
      fc.list = all.slice(0, st.all ? 99 : capN);
    } else if (pIds.length) {
      fc.line = `${plural(goalsN, "gol", "goles")} de ${plural(sc.goals.length, "jugador", "jugadores")}${asN ? ` y ${plural(asN, "asistencia")}` : ""}.`;
      growTo(pIds.length, "a todos");
      fc.cards = pIds.slice(0, capN).map((id) => {
        const f = sc.first[id];
        return { id, name: nm(id), num: ctx.num(id), you: id === ctx.myId, s: f ? `Su primer gol: J${f.j}, ${f.min}′` : "Pases de gol", g: people[id].g, gT: people[id].g === 1 ? "gol" : "goles", a: people[id].a, aT: people[id].a === 1 ? "asistencia" : "asistencias" };
      });
      if (!asN) {
        fc.note = `Ninguna asistencia todavía: ${goalsN === 1 ? `el gol de ${nm(sc.goals[0].id)} fue jugada suya.` : "todos los goles fueron jugadas individuales."} Cada pase de gol aparecerá en la camiseta de quien lo dé.`;
        fc.noteIcon = "shirt";
      }
    } else {
      fc.line = "Aún sin goles nuestros.";
      fc.note = "El primer gol de la temporada saldrá aquí, con la camiseta de quien lo marque, el minuto y el pase.";
      fc.noteIcon = "ball";
    }
    fc.door = "Todos los jugadores, en Estadísticas";
    fc.doorPath = "/estadisticas/jugadores";
  } else if (facet === "minutos") {
    if (stintsOne?.raw.min) {
      const mm = stintsOne;
      const min = mm.raw.min ?? {};
      const ids = Object.keys(min).sort((a, b) => min[b] - min[a]);
      fc.line = `Cada barra, un rato en el campo en la J${mm.j}: ${plural(mm.raw.subs, "cambio")}. En F7 se entra y se sale.`;
      growTo(ids.length, `a los ${ids.length}`, desk ? capN * 2 : capN);
      fc.mins = ids.slice(0, desk && !st.all ? capN * 2 : capN).map((id) => {
        const stn = mm.raw.stints?.[id] ?? [[0, mm.dur]];
        return { id, n: ctx.num(id), name: nm(id), v: `${min[id]}′`, stints: stn.map(([a, b]) => ({ x: (a / mm.dur) * 100, w: Math.max(1.5, ((b - a) / mm.dur) * 100) })) };
      });
      if (!scopeJ && withScore.length > 1) {
        fc.note = `Solo la J${mm.j} tiene los minutos de la mesa; el resto de jornadas, en cuanto se narren.`;
        fc.noteIcon = "swap";
      }
    } else if (Object.keys(minsAll).length > 0) {
      const ids = Object.keys(minsAll).sort((a, b) => minsAll[b] - minsAll[a]);
      const mx = Math.max(...ids.map((id) => minsAll[id]));
      fc.line = `Minutos en ${plural(narrated.length, "partido narrado", "partidos narrados")} de ${scopeMs.length}.`;
      growTo(ids.length, `a los ${ids.length}`, desk ? capN * 2 : capN);
      fc.mins = ids.slice(0, desk && !st.all ? capN * 2 : capN).map((id) => ({ id, n: ctx.num(id), name: nm(id), v: `${minsAll[id]}′`, stints: [{ x: 0, w: (minsAll[id] / mx) * 100 }] }));
    } else if (Object.keys(apps).length) {
      const vals = Object.values(apps);
      const vMin = Math.min(...vals);
      const vMax = Math.max(...vals);
      const same = vMax - vMin <= 1;
      fc.line =
        same && vMin !== vMax
          ? `Los ${vals.length} de siempre: el siete y el banquillo, convocados a ${vMin} o ${vMax} de los ${scopeMs.length} partidos. Nada que separar aquí.`
          : same
            ? `Los ${vals.length} de siempre: el siete y el banquillo fueron convocados a ${vals[0] === scopeMs.length && scopeMs.length > 1 ? `los ${vals[0]} partidos` : plural(vals[0], "partido")}.`
            : `Convocatorias en ${plural(scopeMs.length, "partido")}.`;
      fc.note = "Los minutos de cada uno, tramo a tramo, llegan cuando la mesa narra el partido.";
      fc.noteIcon = "swap";
      if (!same) {
        fc.mins = Object.keys(apps)
          .sort((a, b) => apps[b] - apps[a])
          .slice(0, capN * 2)
          .map((id) => ({ id, n: ctx.num(id), name: nm(id), v: String(apps[id]), stints: [{ x: 0, w: (apps[id] / vMax) * 100 }] }));
      }
    } else {
      fc.line = "Aún sin minutos.";
      fc.note = "Cuando la mesa narre la primera jornada, aquí estarán los minutos de cada uno, tramo a tramo.";
      fc.noteIcon = "swap";
    }
  } else if (facet === "rachas") {
    fc.formT = "Jornada a jornada";
    fc.form = fin.length ? withScore.slice(-(desk ? 16 : 8)).map((m) => ({ j: m.j, t: m.letter ?? "", cls: m.state === "directo" ? "vd-form__l--prov" : `vd-form__l--${(m.letter ?? "e").toLowerCase()}`, aria: `J${m.j}, ${{ G: "ganado", E: "empate", P: "perdido" }[m.letter ?? "E"]}` })) : [];
    if (fin.length < 3) {
      fc.line = fin.length && fin[0].letter ? `Una jornada no hace racha: empezamos con ${{ G: "una victoria", E: "un empate", P: "una derrota" }[fin[0].letter]}. Las rachas salen aquí desde la tercera.` : "Las rachas empiezan con el primer pitido.";
      if (fin.length === 2) fc.line = "Dos jornadas no hacen racha: las rachas salen aquí desde la tercera.";
    } else {
      fc.line = `Rachas de ${plural(fin.length, "partido")} terminado${fin.length === 1 ? "" : "s"}${isLive && live ? ` (la J${live.j}, aún no)` : ""}.`;
      fc.tiles = [
        { icon: "bolt", v: String(stk.n), t: stk.cur === "G" ? (stk.n === 1 ? "victoria" : "victorias seguidas") : stk.cur === "E" ? (stk.n === 1 ? "empate" : "empates seguidos") : stk.n === 1 ? "derrota" : "derrotas seguidas", s: "La racha de ahora" },
        { icon: "shield", v: String(stk.best.unb), t: "sin perder", s: "La mejor racha" },
        { icon: "trophy", v: String(stk.best.G), t: stk.best.G === 1 ? "victoria" : "victorias seguidas", s: "La mejor tanda ganando" },
        { icon: "ball", v: String(stk.best.sc), t: "marcando seguidos", s: "Partidos con gol nuestro" },
      ];
    }
    fc.door = "Rachas y marcas, en Récords";
    fc.doorPath = "/estadisticas/records";
  } else if (facet === "porteria") {
    const gaSum = scopeMs.reduce((a, m) => a + (m.score?.ga ?? 0), 0);
    fc.line = scopeMs.length ? `${plural(gaSum, "gol encajado", "goles encajados")} en ${plural(scopeMs.length, "partido")}.` : "Por estrenar.";
    if (scopeMs.length)
      fc.tiles = [
        { icon: "glove", v: String(cleanMs.length), t: cleanMs.length === 1 ? "portería a cero" : "porterías a cero", s: cleanMs.length ? cleanMs.map((m) => `J${m.j}`).join(", ") : "Ninguna todavía" },
        { icon: "glove", v: String(savesN), t: savesN === 1 ? "parada" : "paradas", s: Object.keys(savesBy).length ? `De ${listW(Object.keys(savesBy).map((k) => nm(k) + (Object.keys(savesBy).length > 1 ? ` (${savesBy[k]})` : "")))}, según la mesa` : "La mesa aún no apunta paradas" },
        { icon: "ball", v: String(Math.round((gaSum / scopeMs.length) * 10) / 10).replace(".", ","), t: "encajados por partido", s: scopeMs.length > 1 ? "De media" : "En el único jugado" },
      ];
    if (!savesN && scopeMs.length) {
      fc.note = "Las paradas salen de lo que anota la mesa: solo en los partidos narrados.";
      fc.noteIcon = "glove";
    }
  } else if (facet === "tarjetas") {
    const ryl = cardEv.filter((x) => x.e.k === "ry").length;
    const rdl = cardEv.filter((x) => x.e.k === "rd").length;
    const pcl = cardEv.filter((x) => x.e.k === "pc").length;
    fc.line = scopeMs.length ? (yN || ryl || pcl || rdl ? `${plural(yN, "amarilla")} nuestra${yN === 1 ? "" : "s"}, ${rdl ? plural(rdl, "roja") : "ninguna roja"}${ryl ? `; ${plural(ryl, "tarjeta")} para el rival` : ""}${pcl ? `; ${plural(pcl, "penalti")} en contra` : ""}.` : "Ni una tarjeta ni un penalti: partidos limpios.") : "Por estrenar.";
    const all = cardEv.map((x, i) => evRow(x.m, x.e, i));
    growTo(all.length, "todas", desk ? capN * 2 : capN);
    fc.list = all.slice(0, desk && !st.all ? capN * 2 : st.all ? 99 : capN);
  } else if (facet === "cuando") {
    const usT = stre.us.reduce((a, b) => a + b, 0);
    const thT = stre.them.reduce((a, b) => a + b, 0);
    const best = stre.us.indexOf(Math.max(...stre.us));
    const first15 = stre.them[0] + stre.them[1] + stre.them[2];
    fc.line = usT + thT ? (thT ? `Encajamos ${first15} de ${thT} en los primeros quince minutos${usT ? `; marcamos sobre todo entre el ${best * 5}′ y el ${best * 5 + 5}′.` : "."}` : `Nuestros goles caen sobre todo entre el ${best * 5}′ y el ${best * 5 + 5}′.`) : "Sin goles todavía.";
    fc.whenAria = `Goles por tramos de cinco minutos. Nuestros: ${stre.us.join(", ")}. Suyos: ${stre.them.join(", ")}.`;
    if (usT + thT > 0) fc.stretch = stre.us.map((u, i) => ({ u: Math.round((u / stMax) * 44), d: Math.round((stre.them[i] / stMax) * 44) }));
    fc.door = "Cómo se juega, en El juego";
    fc.doorPath = "/estadisticas/juego";
  } else {
    const mxRows = rivals.map((rv) => {
      const gs = ms.filter((m) => m.rival === rv);
      return {
        rival: rv,
        ini: gs[0].ini,
        logo: gs[0].logo,
        cls: picked && picked.rival === rv ? "is-sel" : "",
        legs: gs.map((m) => ({
          j: m.j,
          cls: [m.score && m.letter ? `is-${m.letter.toLowerCase()}` : "is-open", m.state === "directo" ? "is-live" : "", m.state === "aplazado" ? "is-pp" : "", picked === m ? "is-sel" : ""].filter(Boolean).join(" "),
          l: m.score && m.letter ? m.letter : `J${m.j}`,
          lc: m.score && m.letter ? m.letter.toLowerCase() : "j",
          t: m.score ? scoreT(m) : m.state === "aplazado" ? "Apl." : `${dayOf(m.at)} ${MES[monthOf(m.at)]}`,
          aria: `J${m.j}, ${whereUs(m).toLowerCase()}, contra ${rv}: ${m.score ? scoreT(m) : m.state === "aplazado" ? "aplazado" : "por jugar"}. Verla en Jornadas`,
        })),
      };
    });
    fc.line = `${twoLegs ? "Ida y vuelta contra cada uno." : "Una vez contra cada uno."} Toca un partido y vuela a Jornadas.`;
    const mxCap = desk ? (ctx.w >= 1800 ? 15 : 8) : 6;
    growTo(mxRows.length, `los ${mxRows.length}`, mxCap);
    fc.mx = mxRows.slice(0, st.all ? 99 : mxCap);
    fc.door = "Rival a rival, en Estadísticas";
    fc.doorPath = "/estadisticas/rivales";
  }
  return {
    picked,
    rd,
    cols,
    bs: Math.max(8, Math.min(ctx.w >= 1800 ? 16 : 14, Math.floor((ctx.w >= 1800 ? 120 : 96) / maxG) - 3)),
    desk,
    facets: FACETS.map((id) => ({ id, label: FACET_LABEL[id], head: heads[id], on: id === facet })),
    fc,
  };
}

/** The season in a sentence (Balance's lede). */
function story(se: PSeason, L: TRow, goals: { id: string; v: number }[], nm: (id: string) => string, usRow: TRow | null): string {
  const p = se.played;
  const first = p[0] ?? se.live;
  const verbs: Record<Letter, string> = { G: "ganando", E: "empatando", P: "perdiendo" };
  if (p.length <= 1 && first?.score && first.letter) {
    const g = first.ev.find((e) => e.k === "g" && e.who);
    return `${first.state === "directo" ? `La temporada arranca ahora mismo: ${first.score.gf}–${first.score.ga} contra ${first.rival}.` : `Empezamos ${verbs[first.letter]} ${first.score.gf}–${first.score.ga} ${first.home ? "en casa ante " : "en casa de "}${first.rival}.`}${g?.who ? ` ${nm(g.who)} marcó el primer gol de la temporada, en el ${g.min}.` : ""}`;
  }
  const top = goals[0];
  const tie = goals[1] && top && goals[1].v === top.v ? goals[1] : null;
  return `${usRow ? cap(`${usRow.pos}º${usRow.prov ? (se.live ? " si acaba así" : ` con la J${p[p.length - 1]?.j ?? ""}`) : ""}: `) : ""}${plural(L.g, "victoria")}, ${plural(L.e, "empate")} y ${plural(L.p, "derrota")}.${top ? ` ${nm(top.id)}${tie ? ` y ${nm(tie.id)} van` : " va"} a la cabeza con ${plural(top.v, "gol", "goles")}.` : ""}`;
}

// ───────────────────────── the cartel ─────────────────────────

export function cartelView(sel: PMatch, seasonName: string) {
  return {
    k: `J${sel.j} · ${seasonName}`,
    t: `Manchester Piti ${sel.home ? "contra" : "en casa de"} ${sel.rival}`,
    big: sel.score ? scoreT(sel) : hhmm(sel.at),
    s: `${cap(longDay(sel.at))} · ${sel.venue}`,
    ga: grad(sel.paint.a),
  };
}

export { hhmm, daysBetween };
