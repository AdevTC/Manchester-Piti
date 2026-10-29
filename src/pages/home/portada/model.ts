// Inicio, «La portada»: what the page says, moment by moment and for whoever looks (the boards' renderVals,
// IN-Inicio390…1920, over production's data). The lens (the score, «La moviola», «La tarde», «El último» or the
// still), the headline with its line for you, the actions and the weather; the score capsule of the screens and
// the floating score. Pure: HomePage gathers the data and the components draw what this returns.
import { SCORE_DASH, homeFirst, scoreText } from "../../../lib/derived/words";
import { KEY_PLAY, isCard, scoreAt, stintsAt, onFieldAt, type Partido, type Play, type PlayK } from "./partido";

/** The moments the boards draw. */
export type Fase = "semana" | "antes" | "pitido" | "directo" | "descanso" | "final" | "acta" | "aplazado" | "pendiente";
/** Who looks: the fans (no account), a socia, a player, the player who keeps la mesa today. */
export type Quien = "fan" | "socio" | "jugador" | "anotador";

export const isLiveF = (f: Fase) => f === "directo" || f === "descanso";
/** A match whose plays and score the page tells. */
export const isPlayedF = (f: Fase) => f === "directo" || f === "descanso" || f === "final" || f === "acta";
export const isPreF = (f: Fase) => f === "antes" || f === "pitido";

export interface Fixture {
  matchId: string;
  /** Its jornada, when the calendar numbers it. */
  j: number | null;
  rival: string;
  /** The rival's crest letters («OR»). */
  code: string;
  /** The rival's escudo, when an acta saved one (rivalLogos). */
  logo?: string;
  home: boolean;
  kickoff: number | null;
  /** «Domingo 18 de octubre». */
  dayLong: string;
  /** «domingo». */
  dow: string;
  /** 25. */
  day: number;
  /** «19:00». */
  time: string;
  /** «Liga». */
  competition: string;
}

export interface Names {
  /** «Adrián T.C.» (a sentence's name). */
  name: (id: string) => string;
  /** «ADRIÁN T.C.» (the shirt's). */
  short: (id: string) => string;
  num: (id: string) => string;
}

export interface Ctx {
  fase: Fase;
  quien: Quien;
  /** The viewer's player id (a jugador or the anotador). */
  me: string | null;
  /** «Jordi», «Marta». */
  meName: string;
  /** The match the lens and the pitch are about (between matches, the last one played); null before any. */
  P: Partido | null;
  /** P's fixture. */
  M: Fixture | null;
  /** The next match (between matches the lens counts down to it). */
  N: Fixture | null;
  /** The moviola's minute and the furthest it can go (live: the clock; after: the whole match). */
  m: number;
  edge: number;
  /** The match's own score at the edge (scoreOf: an acta's result, the live score). */
  score: { us: number; them: number } | null;
  names: Names;
  now: number;
  /** «19:29» / «19:10» (null: the whole match with daylight) for P's kick-off; and N's. */
  sunset: string;
  lights: string | null;
  lightsFromStart: boolean;
  nextLights: string | null | "dia";
  /** «Faltan 3 días», «Mañana», «Hoy». */
  nextLeft: string;
  /** «2 h 14 min» left to P's kick-off (antes). */
  kickLeft: string;
  /** The weather words for the line under the actions (null: no forecast yet). */
  weather: { t: number; label: string; rain: number | null } | null;
  /** The headline's first-match flavour («el estreno»). */
  estreno: boolean;
  /** The MVP vote of P: open (with its closing words) or not. */
  mvp: { open: boolean; closes: string; total: number | null; eligible: number | null };
  /** «El CDM cerró el campo…»: the admin's words for a postponement. */
  postponed: string;
  /** «Hoy» line: «Jueves 22 de octubre». */
  todayLine: string;
  /** The viewer's porra for the match the porra is about, when there is one. */
  porra: { us: number; them: number } | null;
  /** The viewer's convocatoria answer (0 voy, 1 duda, 2 no voy) when there is one to give. */
  rsvp: 0 | 1 | 2 | null;
  /** He has voted the MVP (the name), or not. */
  mvpVoted: string | null;
  /** «Avisarme…» is on for this moment's topic. */
  alerts: boolean;
  /** «Sacar el marcador» is out. */
  pip: boolean;
  /** The match page's address. */
  matchHref: string | null;
  nextHref: string | null;
}

export const member = (q: Quien) => q !== "fan";
export const playerQ = (q: Quien) => q === "jugador" || q === "anotador";
export const hasGameOf = (c: Pick<Ctx, "fase" | "P">) => !!c.P && (isPlayedF(c.fase) || c.fase === "semana");
export const draggedOf = (c: Pick<Ctx, "fase" | "P" | "m" | "edge">) => hasGameOf(c) && c.m < c.edge;
const NUMF = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];
const COUNT = ["", "Un", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez"];
export const countWord = (n: number) => COUNT[n] ?? String(n);
const TRAMOS = ["", "un tramo", "dos tramos", "tres tramos", "cuatro tramos", "cinco tramos", "seis tramos"];
export const tramosWord = (n: number) => TRAMOS[n] ?? `${n} tramos`;
export const andList = (xs: readonly string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const jOf = (f: Fixture | null) => (f?.j ? `J${f.j}` : "");
const lowerFirst = (s: string) => s.charAt(0).toLocaleLowerCase("es") + s.slice(1);

/** The score at the moviola's minute: the match's own at the edge, the plays' before it. */
export function scoreNow(c: Ctx): { us: number; them: number } {
  if (!c.P) return { us: 0, them: 0 };
  if (c.m >= c.edge && c.score) return c.score;
  return scoreAt(c.P.plays, c.m);
}
export const scoreEdge = (c: Ctx) => c.score ?? (c.P ? scoreAt(c.P.plays, c.edge) : { us: 0, them: 0 });

// ───────────────────────── the lens ─────────────────────────

export interface LensView {
  kicker: string;
  rival: string;
  code: string;
  logo?: string;
  /** At home: the board puts the home side on the left (homeFirst). */
  home: boolean;
  usWhere: string;
  themWhere: string;
  face: "score" | "time" | "word";
  us: number;
  them: number;
  time: string;
  word: string;
  live: boolean;
  clock: string | null;
  status: string;
  ours: { m: string; name: string; later: boolean }[];
  theirs: string;
  rivalShort: string;
  hasScorers: boolean;
  scoreLabel: string;
  aria: string;
  pre: boolean;
  off: boolean;
}

export function lensOf(c: Ctx): LensView {
  const f = c.fase;
  const live = isLiveF(f);
  const played = isPlayedF(f);
  const pre = isPreF(f);
  const semana = f === "semana";
  const off = f === "aplazado" || f === "pendiente";
  const dragged = draggedOf(c);
  const F = semana ? (c.N ?? c.M) : c.M;
  const rival = F?.rival ?? "";
  const sc = scoreNow(c);
  const half = c.edge > (c.P?.duration ?? 50) / 2 ? "de la segunda parte" : "de la primera parte";
  const time = F?.time ?? "";
  const status: Record<Fase, string> = {
    semana: F ? `${F.home ? "En Palomeras" : `En casa de ${F.rival}`}. ${c.nextLeft}` : "",
    antes: `Hoy a las ${time}. Faltan ${c.kickLeft}`,
    pitido: "Pendiente del pitido inicial",
    directo: dragged ? `en directo; estás viendo el minuto ${c.m}` : half,
    descanso: dragged ? `Descanso. Estás viendo el minuto ${c.m}` : "Descanso",
    final: dragged ? `Final. Estás viendo el minuto ${c.m}` : "Final. El acta llega en unos minutos",
    acta: dragged ? `Final. Estás viendo el minuto ${c.m}` : "Final. El acta ya está publicada",
    aplazado: c.postponed ? "Aplazado. Sin fecha nueva todavía" : "Aplazado. Sin fecha nueva todavía",
    pendiente: "Pendiente del acta: la mesa no llegó a arrancar el reloj",
  };
  const ours: LensView["ours"] = [];
  const theirs: string[] = [];
  for (const p of c.P?.plays ?? []) {
    if (!played || p.m > c.edge) continue;
    if (p.k === "gol") ours.push({ m: `${p.m}′`, name: p.who ? c.names.name(p.who) : "En propia", later: p.m > c.m });
    if (p.k === "rival" && p.m <= c.m) theirs.push(`${p.m}′`);
  }
  const word = !F ? "Pretemporada" : f === "aplazado" ? "Aplazado" : "Sin acta";
  const faceKind: LensView["face"] = played ? "score" : (pre || semana) && F ? "time" : "word";
  return {
    kicker: F ? `${jOf(F) ? `${jOf(F)} · ` : ""}${F.dayLong} · ${F.competition}` : "Manchester Piti",
    rival,
    code: F?.code ?? "",
    logo: F?.logo,
    home: F ? F.home : true,
    usWhere: F ? (F.home ? "En casa" : "Fuera") : "",
    themWhere: F ? (F.home ? "Fuera" : "En casa") : "",
    face: faceKind,
    us: sc.us,
    them: sc.them,
    time,
    word,
    live: live && f !== "descanso" && !dragged,
    clock: live && f !== "descanso" ? `${c.edge}′` : null,
    status: F ? status[f] : "La temporada empieza pronto",
    ours,
    theirs: theirs.join(" "),
    rivalShort: rival.replace(/ fc$/i, ""),
    hasScorers: played && ours.length + theirs.length > 0,
    scoreLabel: played ? `${homeFirst(F?.home, `Manchester Piti ${sc.us}`, `${rival} ${sc.them}`).join(", ")}${dragged ? `, en el minuto ${c.m}` : live ? ", en directo" : ""}` : faceKind === "time" ? `Pitido inicial a las ${time}` : word,
    aria: semana ? "El próximo partido" : "El partido de hoy",
    pre: pre || semana,
    off: off || !F,
  };
}

// ───────────────────────── «La moviola», «La tarde», «El último», the still ─────────────────────────

/** Catmull-Rom through the points, as the boards draw the ribbon. */
export function smooth(pts: readonly [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)},${c2x.toFixed(1)} ${c2y.toFixed(1)},${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** The two halves of the ribbon (ours above the axis, theirs below) up to minute `upto`, on a 500 × 74 box. */
export function ribbon(pulse: readonly number[], upto: number, duration: number): { us: string; them: string } {
  const sx = 500 / duration;
  const us: [number, number][] = [[0, 37]];
  const them: [number, number][] = [[0, 37]];
  for (let i = 0; i <= upto; i++) {
    const v = pulse[i] ?? 0;
    us.push([i * sx, 37 - Math.max(0, v) * 3.3]);
    them.push([i * sx, 37 + Math.max(0, -v) * 3.3]);
  }
  us.push([upto * sx, 37]);
  them.push([upto * sx, 37]);
  return { us: `${smooth(us)} Z`, them: `${smooth(them)} Z` };
}

export type MarkIcon = "ball" | "card" | "post" | "glove" | "swap";
export interface MovMark {
  id: string;
  m: number;
  cls: string;
  left: number;
  top: number;
  icon: MarkIcon;
  label: string;
}
export interface MovSub {
  left: number;
  n: number;
  later: boolean;
}

export const ICON: Record<PlayK, string> = {
  gol: "ball",
  rival: "ball",
  amarilla: "",
  roja: "",
  rivalAmarilla: "",
  rivalRoja: "",
  cambio: "swap",
  penalti: "whistle",
  parada: "glove",
  paradaPenalti: "glove",
  palo: "post",
  ocasion: "arrow",
  rivalOcasion: "arrow",
  corner: "flag",
  rivalCorner: "flag",
  falta: "whistle",
  faltaRecibida: "whistle",
  otro: "whistle",
};

export interface MovView {
  kind: "match" | "tarde" | "last" | "still" | "none";
  live: boolean;
  half: boolean;
  usD: string;
  themD: string;
  /** The played part, 0–500. */
  playedW: number;
  marks: MovMark[];
  subs: MovSub[];
  showLive: boolean;
  livePct: number;
  headPct: number;
  minute: number;
  max: number;
  duration: number;
  tip: string;
  tipCls: string;
  valueText: string;
  playLabel: string;
  hint: string;
  backable: boolean;
  backLabel: string;
  ribLabel: string;
  // «La tarde»
  tarde: TardeView | null;
  // «El último»
  last: { when: string; score: string; code: string; logo?: string; home: boolean; aria: string; title: string; sub: string } | null;
  still: { icon: "cal" | "mesa"; t: string; d: string } | null;
}

export interface TardeMark {
  left: number;
  h: string;
  t: string;
  cls: string;
}
export interface TardeView {
  sunD: string;
  sunX: number;
  sunY: number;
  marks: TardeMark[];
  top: TardeMark[];
  winL: number;
  winW: number;
  ticks: number[];
  label: string;
}

const HM = (t: number) => {
  const h = Math.floor(t / 60);
  const m = Math.round(t % 60);
  return `${h}:${m < 10 ? "0" : ""}${m}`;
};
const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** «La tarde»: the evening over the CDM from 2½ h before the kick-off to 1½ h after, the sun's arc and its set,
 *  the match's window, «Ahora», the quedada. `nowMin`/`koMin`: Madrid minutes of the day. */
export function tardeOf(o: { koMin: number; endMin: number; nowMin: number; sunset: string; lights: string | null; meet: string | null; pitido: boolean; showMeet: boolean }): TardeView {
  const T0 = o.koMin - 150;
  const T1 = o.koMin + 90;
  const tx = (t: number) => ((t - T0) / (T1 - T0)) * 100;
  const sunset = toMin(o.sunset);
  const lights = o.lights ? toMin(o.lights) : null;
  const elev = (t: number) => {
    const h = (t - sunset) / 60;
    return -9.4 * h - 0.9 * h * h;
  };
  const pts: [number, number][] = [];
  for (let t = T0; t <= T1; t += 10) pts.push([tx(t) * 5, 56 - elev(t) * 1.9]);
  const now = Math.max(T0, Math.min(T1, o.nowMin));
  const mk = (t: number, h: string, lab: string, cls: string): TardeMark => ({ left: Number(tx(t).toFixed(2)), h, t: lab, cls });
  const marks = [mk(now, HM(now), o.pitido ? "Ahora, a punto" : "Ahora", `is-now${!o.pitido && tx(now) < 12 ? " is-start" : ""}`), mk(o.koMin, HM(o.koMin), "Pitido", `is-key${o.pitido ? " is-hide" : ""}`), mk(o.endMin, HM(o.endMin), "Final", "")];
  const meetMin = o.meet ? toMin(o.meet) : null;
  const top: TardeMark[] = [];
  if (meetMin !== null) top.push(mk(meetMin, o.meet ?? "", "Quedada", o.showMeet && meetMin >= T0 ? "" : "is-hide"));
  if (sunset >= T0 && sunset <= T1) top.push(mk(sunset, o.sunset, "Se pone el sol", `is-minor is-sun${o.showMeet && meetMin !== null && Math.abs(sunset - meetMin) < 50 ? " is-hide" : ""}${lights !== null && sunset > lights ? " is-start" : " is-end"}`));
  const hours: number[] = [];
  for (let h = Math.ceil(T0 / 60); h * 60 <= T1; h++) hours.push(Number(tx(h * 60).toFixed(2)));
  return {
    sunD: smooth(pts),
    sunX: Number(tx(now).toFixed(2)),
    sunY: Number(Math.max(4, Math.min(96, ((56 - elev(now) * 1.9) / 74) * 100)).toFixed(1)),
    marks,
    top,
    winL: Number(tx(o.koMin).toFixed(2)),
    winW: Number((tx(o.endMin) - tx(o.koMin)).toFixed(2)),
    ticks: hours,
    label: `La tarde del partido: el sol se pone a las ${o.sunset}; ${o.lights === null ? "se juega con luz de día" : `con focos desde las ${o.lights}`}.`,
  };
}

export function movOf(c: Ctx, tarde: TardeView | null, playing: boolean): MovView {
  const f = c.fase;
  const P = c.P;
  const D = P?.duration ?? 50;
  const live = isLiveF(f);
  const played = isPlayedF(f);
  const semana = f === "semana";
  const dragged = draggedOf(c);
  const m = c.m;
  const edge = c.edge;
  const kind: MovView["kind"] = played && P ? "match" : isPreF(f) && tarde ? "tarde" : semana && P && c.M ? "last" : f === "aplazado" || f === "pendiente" ? "still" : "none";
  const R = P ? ribbon(P.pulse, kind === "last" ? D : edge, D) : { us: "", them: "" };
  let keyAt: Play | null = null;
  for (const p of P?.plays ?? []) if (p.m === m && KEY_PLAY.has(p.k)) keyAt = p;
  const marks: MovMark[] = played && P
    ? P.plays
        .filter((p) => p.m <= edge && KEY_PLAY.has(p.k))
        .map((p) => {
          const card = isCard(p.k);
          const icon: MarkIcon = card ? "card" : p.k === "gol" || p.k === "rival" ? "ball" : p.k === "palo" ? "post" : p.k === "paradaPenalti" ? "glove" : "swap";
          let cls = `vd-ribbon__mark--${icon}`;
          if (p.k === "roja" || p.k === "rivalRoja") cls += " vd-ribbon__mark--red";
          if (p.side === "them") cls += " vd-ribbon__mark--them";
          if (p.k === "gol" && p.m <= m) cls += " vd-ribbon__mark--gold";
          if (p.m > m) cls += " is-later";
          if (keyAt && keyAt.id === p.id) cls += " is-at";
          return { id: p.id, m: p.m, cls, left: Number(((p.m / D) * 100).toFixed(2)), top: p.side === "them" ? 76 : 24, icon, label: `Minuto ${p.m}, ${lowerFirst(p.title)}` };
        })
    : [];
  const subsBy = new Map<number, number>();
  for (const p of P?.plays ?? []) if (played && p.k === "cambio" && p.m <= edge) subsBy.set(p.m, (subsBy.get(p.m) ?? 0) + 1);
  const subs = [...subsBy].map(([x, n]) => ({ left: Number(((x / D) * 100).toFixed(2)), n, later: x > m }));
  const sc = scoreNow(c);
  const sm = subsBy.get(m);
  const tip = keyAt ? keyAt.title : m === 0 ? "Pitido inicial" : m === D / 2 ? "Descanso" : m === D ? "Final" : live && m === edge ? "Ahora" : sm ? (sm > 1 ? `${countWord(sm)} cambios` : "Cambio") : "";
  const scE = scoreEdge(c);
  const rival = c.M?.rival ?? "";
  const J = jOf(c.M);
  return {
    kind,
    live,
    half: f === "descanso",
    usD: R.us,
    themD: R.them,
    playedW: Number(((m / D) * 500).toFixed(1)),
    marks,
    subs,
    showLive: live,
    livePct: Number(((edge / D) * 100).toFixed(2)),
    headPct: Number(((m / D) * 100).toFixed(2)),
    minute: m,
    max: edge,
    duration: D,
    tip,
    tipCls: [m < D * 0.14 ? "is-start" : m > D * 0.86 ? "is-end" : "", keyAt?.k === "gol" ? "is-gold" : keyAt?.k === "rival" ? "is-them" : ""].join(" ").trim(),
    valueText: `Minuto ${m}${keyAt ? `, ${keyAt.title}` : ""}. Marcador ${sc.us} a ${sc.them}`,
    playLabel: playing ? "Pausa" : f === "descanso" ? "Repasar la primera parte" : "Repasar el partido",
    hint: live && f !== "descanso" ? `Arrastra para volver a cualquier minuto; el directo sigue en el ${edge}. Las rayas de abajo son los cambios.` : "Arrastra o toca una jugada: el marcador, el cielo y el campo vuelven a ese minuto. Las rayas de abajo son los cambios.",
    backable: dragged && played,
    backLabel: live ? "Volver al directo" : "Ir al final",
    ribLabel: `El partido minuto a minuto: arriba aprieta el Piti, abajo ${rival}. Toca una jugada para ir a ese minuto.`,
    tarde: kind === "tarde" ? tarde : null,
    last:
      kind === "last" && c.M
        ? {
            when: `${J ? `${J} · ` : ""}${c.M.dayLong}`,
            score: scoreText(...homeFirst(c.M.home, scE.us, scE.them)),
            code: c.M.code,
            logo: c.M.logo,
            home: c.M.home,
            aria: homeFirst(c.M.home, `Manchester Piti ${scE.us}`, `${rival} ${scE.them}`).join(", "),
            title: `${scE.us > scE.them ? "Ganamos" : scE.us < scE.them ? "Perdimos" : "Empatamos"} ante ${rival}`,
            sub: `${c.M.home ? "En casa" : "Fuera"} · el acta ya está publicada`,
          }
        : null,
    still:
      kind === "still"
        ? f === "aplazado"
          ? { icon: "cal", t: "Aplazado, sin fecha nueva todavía", d: `${c.postponed ? `${c.postponed} ` : ""}La liga pondrá la fecha; te avisamos en cuanto la haya.` }
          : { icon: "mesa", t: "Nadie arrancó el reloj en la mesa", d: "No hubo marcador en directo: el resultado, los goles y los minutos llegan con el acta." }
        : null,
  };
}

// ───────────────────────── the headline, your line, the actions, the weather ─────────────────────────

export type ActId = "mesa" | "previa" | "llegar" | "alerts" | "abrir" | "pip" | "acta" | "cartel" | "calendario" | "avisar";
export interface Act {
  id: ActId;
  t: string;
  pri: boolean;
  icon: string;
  /** A link out of Inicio (else a button here). */
  out: boolean;
  pressed: boolean | null;
  desk?: boolean;
}

export interface HeroView {
  kicker: string;
  h1: string;
  lede: string;
  me: string;
  meIni: string;
  acts: Act[];
  wxIcon: string;
  wx: string;
}

const lightPhrase = (lights: string | null, fromStart: boolean) => (lights === null ? "Se juega con luz de día." : fromStart ? "Se juega con focos todo el partido." : "Empezamos con luz de tarde y acabamos con focos.");

export function heroOf(c: Ctx): HeroView {
  const f = c.fase;
  const P = c.P;
  const M = c.M;
  const N = c.N;
  const live = isLiveF(f);
  const pre = isPreF(f);
  const semana = f === "semana";
  const mem = member(c.quien);
  const rival = M?.rival ?? "";
  const J = jOf(M);
  const nm = (id: string | null) => (id ? c.names.name(id) : "");
  const scE = scoreEdge(c);
  const sc = scoreNow(c);
  const plays = P?.plays ?? [];
  const goalsOurs = plays.filter((p) => p.k === "gol" && p.m <= c.edge);
  const estreno = c.estreno;
  const D = P?.duration ?? 50;
  const result = (us: number, them: number) => {
    if (us > them) {
      const s2 = goalsOurs.map((g) => nm(g.who) || "En propia");
      if (f === "acta" && s2.length > 1 && s2[0] !== s2[s2.length - 1]) return `${s2[0]} abre, ${s2[s2.length - 1]} cierra: ${scoreText(us, them)}`;
      return `Ganamos ${scoreText(us, them)}${estreno ? " el estreno" : ""}`;
    }
    if (us < them) return `Perdemos ${scoreText(us, them)}${estreno ? " el estreno" : ""}`;
    return `Empate a ${us === 0 ? "cero" : (NUMF[us] ?? String(us))}${estreno ? " en el estreno" : ""}`;
  };
  let lastGoal: Play | null = null;
  for (const p of plays) if ((p.k === "gol" || p.k === "rival") && p.m <= c.m) lastGoal = p;
  const themMins = (upto: number) => plays.filter((p) => p.k === "rival" && p.m <= upto).map((p) => `${p.m}`);
  const h: HeroView = { kicker: "", h1: "", lede: "", me: "", meIni: c.meName.charAt(0), acts: [], wxIcon: "cal", wx: "" };
  if (semana && N) {
    h.kicker = c.todayLine;
    h.h1 = N.home ? `El ${N.dow}, ${N.rival} en Palomeras` : `El ${N.dow}, a casa de ${N.rival}`;
    h.lede = `A las ${N.time} contra ${N.rival}${N.home ? " en el CDM Palomeras" : ", en su campo"}. ${c.nextLights === "dia" ? "Se juega con luz de día." : c.nextLights ? `Con focos desde las ${c.nextLights}.` : "Se juega con focos todo el partido."}${P && M ? ` El último, ${scoreText(scE.us, scE.them)} ante ${M.rival}.` : ""}`;
  } else if (semana) {
    h.kicker = c.todayLine;
    h.h1 = "Manchester Piti";
    h.lede = "El calendario de la temporada sale pronto. Mientras, la plantilla y el club.";
  } else if (f === "antes") {
    h.kicker = `Hoy · ${J ? `${J} de ` : ""}${M?.competition.toLocaleLowerCase("es") ?? "liga"}`;
    h.h1 = estreno ? "Hoy debuta el Piti" : M?.home ? `${rival} viene a Palomeras` : `Hoy, a casa de ${rival}`;
    h.lede = `${M?.j ? `Jornada ${M.j} a las ` : "A las "}${M?.time} contra ${rival}${M?.home ? " en el CDM Palomeras" : ", en su campo"}. ${lightPhrase(c.lights, c.lightsFromStart)}`;
  } else if (f === "pitido") {
    h.kicker = `Hoy${J ? ` · ${J}` : ""}`;
    h.h1 = M?.home ? "Todo listo en Palomeras" : `Todo listo en casa de ${rival}`;
    h.lede = `Son más de las ${M?.time}. En cuanto la mesa arranque el reloj, empieza el directo.`;
  } else if (live) {
    h.kicker = `${f === "descanso" ? "Descanso" : "En directo"}${J ? ` · ${J}` : ""}`;
    if (f === "descanso") {
      const sH = scoreAt(plays, D / 2);
      h.h1 = `Descanso con ${scoreText(sH.us, sH.them)}`;
      const tm = themMins(D / 2);
      const og = plays.filter((p) => p.k === "gol" && p.m <= D / 2).map((p) => nm(p.who) || "En propia");
      h.lede = `${og.length ? `Marcó ${andList(og)}. ` : ""}${tm.length ? `${rival} marcó en el ${andList(tm)}. ` : ""}La segunda parte, en unos minutos.`;
    } else if (lastGoal) {
      const s2 = scoreAt(plays, lastGoal.m);
      h.h1 = lastGoal.k === "gol" ? `${nm(lastGoal.who) || "El Piti"} pone el ${scoreText(s2.us, s2.them)}` : s2.us === s2.them ? `Empata ${rival}` : `Marca ${rival}`;
      const tm2 = themMins(c.m);
      const og2 = plays.filter((p) => p.k === "gol" && p.m <= c.m);
      h.lede = `Minuto ${lastGoal.m}${lastGoal.assist ? `, a pase de ${nm(lastGoal.assist)}` : ""}. ${og2.length && lastGoal.k !== "gol" ? `Nuestro, el de ${nm(og2[0].who) || "la propia"} en el ${og2[0].m}. ` : og2.length > 1 ? `${nm(og2[0].who) || "El Piti"} abrió en el ${og2[0].m}. ` : ""}${tm2.length ? `Los de ${rival}, en el ${andList(tm2)}.` : ""}`.trim();
    } else {
      h.h1 = M?.home ? "Rueda el balón en Palomeras" : `Rueda el balón en casa de ${rival}`;
      h.lede = `La mesa arrancó el reloj a las ${M?.time}.`;
    }
  } else if (f === "final" || f === "acta") {
    h.kicker = `${f === "final" ? "Final" : "El acta"}${J ? ` · ${J}` : ""}`;
    h.h1 = result(scE.us, scE.them);
    const os = goalsOurs.map((g) => nm(g.who) || "en propia");
    if (f === "final") h.lede = `${os.length ? `${os.length > 1 ? "Goles de " : "Gol de "}${andList(os)}. ` : ""}El acta llega en unos minutos: la está cerrando la mesa.`;
    else h.lede = `${estreno ? "Primer partido de la temporada. Todos los que jugaron desbloquean «Debut»." : scE.us > scE.them ? "Tres puntos más." : scE.us === scE.them ? "Un punto más." : "Esta vez no."}${c.mvp.open ? (mem ? " Ya se puede votar al MVP." : " Los socios votan al MVP; el ganador sale aquí.") : ""}`;
  } else if (f === "aplazado") {
    h.kicker = `${J ? `${J} · ` : ""}${M?.dayLong ?? ""}`;
    h.h1 = "Hoy no se juega";
    h.lede = `El partido ante ${rival} queda aplazado. La nueva fecha saldrá aquí y en los avisos; la convocatoria se guarda.`;
  } else if (f === "pendiente") {
    h.kicker = `${J ? `${J} · ` : ""}${M?.dayLong ?? ""}`;
    h.h1 = "Falta el acta del partido";
    h.lede = `Contra ${rival}: el resultado, los goles y los minutos salen con el acta.`;
  }

  // the member's own line
  const me = c.me;
  const meSlot = me && P ? (P.lineup.find((s) => s.id === me) ?? null) : null;
  const meL = me && P ? P.ledger[me] : undefined;
  const meNow = me && P ? stintsAt(meL, c.m) : null;
  const porraTxt = c.porra ? scoreText(c.porra.us, c.porra.them) : "";
  const nd = N?.dow ?? "";
  const n = c.meName;
  if (c.quien === "jugador") {
    if (semana) h.me = c.rsvp === null ? (N ? `${n}, la convocatoria del ${nd} te espera.` : "") : `${n}, ${["vas el ", "estás en duda para el ", "no vas el "][c.rsvp]}${nd}.`;
    else if (pre) h.me = meSlot ? `${n}, sales en el siete de ${POSN[meSlot.code] ?? meSlot.code.toLocaleLowerCase("es")}.${c.porra ? ` Tu porra: ${porraTxt}.` : " Tu porra, sin poner: se cierra con el pitido."}` : P?.match.bench?.includes(me ?? "") ? `${n}, empiezas en el banquillo.` : `${n}, esta vez desde la grada.`;
    else if (live) h.me = meL && meNow ? (onFieldAt(meL, c.m, D) ? `${n}, estás en el campo: llevas ${meNow.min} minutos.` : `${n}, ahora en el banquillo: llevas ${meNow.min} minutos.`) : `${n}, esta vez desde la grada.`;
    else if (f === "final" || f === "acta") h.me = meL ? `${n}, jugaste ${meL.min} minutos en ${tramosWord(meL.st.length)}.${f === "acta" && c.mvp.open && !c.mvpVoted ? ` Vota al MVP ${c.mvp.closes ? `hasta ${c.mvp.closes}` : "antes de que cierre"}.` : ""}` : `${n}, esta vez desde la grada.`;
    else if (f === "aplazado") h.me = c.rsvp === 0 ? `${n}, tu «voy» se queda para la nueva fecha.` : `${n}, tu respuesta se queda para la nueva fecha.`;
    else h.me = `${n}, tus minutos salen con el acta.`;
  } else if (c.quien === "anotador") {
    h.me = pre || live || f === "final" ? `${n}, hoy anotas tú en la mesa.` : f === "pendiente" ? `${n}, el acta te espera en la mesa.` : semana ? (N ? `${n}, la convocatoria del ${nd} te espera.` : "") : f === "acta" ? `${n}, el acta que cerraste ya está publicada.` : `${n}, la mesa se queda para la nueva fecha.`;
  } else if (c.quien === "socio") {
    h.me =
      (pre || semana) && c.porra
        ? `${n}, tu porra: ${porraTxt}. Se cierra con el pitido.`
        : (pre || semana) && N
          ? `${n}, tu porra, sin poner: se cierra con el pitido.`
          : live && c.porra
            ? `${n}, tu porra, ${porraTxt}, ${sc.us === c.porra.us && sc.them === c.porra.them ? "la clavas de momento." : "se te escapa."}`
            : f === "acta" && c.mvp.open && !c.mvpVoted
              ? `${n}, ya puedes votar al MVP${c.mvp.closes ? ` hasta ${c.mvp.closes}` : ""}.`
              : "";
  }

  // the actions
  const A = (id: ActId, t: string, o: Partial<Act> = {}) => h.acts.push({ id, t, pri: false, icon: "", out: true, pressed: null, ...o });
  const mesaFirst = c.quien === "anotador" && (pre || live || f === "pendiente" || f === "final");
  if (mesaFirst) A("mesa", f === "pendiente" || f === "final" ? "Publicar el acta" : "Abrir la mesa", { pri: true, icon: "mesa" });
  if (semana && N) {
    A("previa", N.j ? `La previa de la J${N.j}` : "La previa", { pri: !mesaFirst });
    A("llegar", "Cómo llegar", { icon: "away" });
  }
  if (pre) {
    A("previa", "La previa", { pri: !mesaFirst });
    A("llegar", "Cómo llegar", { icon: "away" });
    A("alerts", c.alerts ? "Te avisamos del pitido" : "Avisarme del pitido", { out: false, icon: c.alerts ? "check" : "bell", pressed: c.alerts });
  }
  if (live) {
    A("abrir", "Abrir el partido", { pri: !mesaFirst });
    A("pip", c.pip ? "Traer el marcador" : "Sacar el marcador", { out: false, icon: "pip", pressed: c.pip, desk: true });
    A("alerts", c.alerts ? "Te avisamos de los goles" : "Avisarme de los goles", { out: false, icon: c.alerts ? "check" : "bell", pressed: c.alerts });
  }
  if (f === "final" || f === "pendiente") A("abrir", "Abrir el partido", { pri: !mesaFirst });
  if (f === "acta") {
    A("acta", "Leer el acta", { pri: true });
    A("cartel", "Compartir el cartel", { out: false, icon: "share" });
  }
  if (f === "aplazado") {
    A("calendario", "Ver el calendario", { pri: true });
    A("avisar", c.alerts ? "Te avisamos de la fecha" : "Avísame cuando haya fecha", { out: false, icon: c.alerts ? "check" : "bell", pressed: c.alerts });
  }

  // the weather, or what comes next
  const wx = c.weather;
  const wxWords = wx ? `${wx.t}°, ${wx.label.toLocaleLowerCase("es")}${wx.rain !== null && wx.rain >= 40 ? `, lluvia ${wx.rain} %` : ", sin lluvia"}` : "";
  if (semana && N) {
    h.wxIcon = "sun";
    h.wx = wx ? `El ${N.dow} a las ${N.time}: ${wxWords}.` : "";
  } else if (pre && M) {
    h.wxIcon = wx && /nub|cubiert/i.test(wx.label) ? "cloud" : "sun";
    h.wx = `${wx ? `A las ${M.time}: ${wxWords}. ` : ""}El sol se pone a las ${c.sunset}${c.lights ? `; focos desde las ${c.lights}` : ""}.`;
  } else if (live) {
    h.wxIcon = "moon";
    h.wx = `${wx ? `${wx.t}°, ${wx.label.toLocaleLowerCase("es")}. ` : ""}${c.lights === null ? "Con luz de día." : c.lightsFromStart ? "Con focos todo el partido." : `Con focos desde las ${c.lights}.`}`;
  } else if (N) {
    h.wxIcon = "cal";
    h.wx = `Próximo: ${N.dow} ${N.day}, ${N.time}${N.home ? ", en Palomeras." : `, en casa de ${N.rival}.`}`;
  }
  return h;
}

export const POSN: Record<string, string> = { POR: "portero", LI: "lateral izquierdo", LD: "lateral derecho", DFC: "central", MC: "medio", DC: "delantero", LIB: "líbero", MCD: "pivote", MCO: "mediapunta", ED: "extremo derecho", EI: "extremo izquierdo" };

// ───────────────────────── the screens' capsule and the floating score ─────────────────────────

export interface CapView {
  score: string;
  code: string;
  logo?: string;
  home: boolean;
  word: boolean;
  when: string;
  live: boolean;
  showProg: boolean;
  prog: number;
  aria: string;
}

export function capOf(c: Ctx): CapView {
  const f = c.fase;
  const live = isLiveF(f);
  const played = isPlayedF(f);
  const pre = isPreF(f);
  const semana = f === "semana";
  const hasGame = hasGameOf(c);
  const dragged = draggedOf(c);
  const sc = scoreNow(c);
  const scE = scoreEdge(c);
  const F = c.M;
  const J = jOf(F);
  const rival = F?.rival ?? "";
  const score = played ? scoreText(...homeFirst(F?.home, sc.us, sc.them)) : semana && c.P ? scoreText(...homeFirst(F?.home, scE.us, scE.them)) : pre ? (F?.time ?? "") : f === "aplazado" ? "Aplazado" : F ? "Sin acta" : "Piti";
  return {
    score,
    code: F?.code ?? "",
    logo: F?.logo,
    home: F ? F.home : true,
    word: f === "aplazado" || f === "pendiente" || !F,
    when: live ? (dragged ? `Viendo el ${c.m}′` : f === "descanso" ? "Descanso" : `${c.edge}′`) : semana && c.P ? `${J ? `${J} · ` : ""}final` : f === "final" || f === "acta" ? (dragged ? `Viendo el ${c.m}′` : "Final") : pre ? (f === "pitido" ? "A punto" : "Hoy") : "",
    live: live && f !== "descanso" && !dragged,
    showProg: hasGame,
    prog: Number(((c.m / (c.P?.duration ?? 50)) * 100).toFixed(2)),
    aria: `Volver a Inicio: ${hasGame ? homeFirst(F?.home, `Manchester Piti ${played ? sc.us : scE.us}`, `${rival} ${played ? sc.them : scE.them}`).join(", ") : pre ? `hoy a las ${F?.time ?? ""} contra ${rival}` : f === "aplazado" ? "aplazado" : F ? "pendiente del acta" : "la portada"}`,
  };
}

export const SCORE_SEP = SCORE_DASH;
