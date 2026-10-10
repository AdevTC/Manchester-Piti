// The match workspace's words and states (pure, tested in workspaceModel.test.ts), as on the canvas
// (stats-gen/ad-v2-full.mjs `detail`, ad-v2-full-logic.js «the match workspace»): where the match stands
// (to play, being played, played, cancelled / postponed), the header's kicker, the tabs' ✓ / !, the
// footer (state + concrete reason + which buttons), the goal rows' words, «La cuenta», the crónica's
// headline, and the Campo fields (name · address, kept in the one `venue` string).
import { dateMillis } from "../../../../functions/src/matchEngine";
import { clockTime, shortDate, type ActaReview } from "../data/adminLogic";
import { matchMoment, type MomentMatch } from "../data/moments";
import type { MatchTab } from "../shell/nav";
import type { GoalRow, MatchSheet } from "../acta/sheetModel";

/** antes = to play · juego = being played · jugado = played (acta to write or published) · off = cancelled / postponed. */
export type Phase = "antes" | "juego" | "jugado" | "off";
export function phaseOf(m: MomentMatch, now: number, whistled: boolean): Phase {
  if (m.status === "cancelled" || m.status === "postponed") return "off";
  const mo = matchMoment(m, now, whistled);
  return mo === "antes" ? "antes" : mo === "juego" ? "juego" : "jugado";
}

/**
 * The sheet the review and the save see: a played match still «Programado» is finished (pitar el final →
 * the acta; there is no separate «mark it finished» step).
 */
export function effectiveSheet(sheet: MatchSheet, phase: Phase): MatchSheet {
  return phase === "jugado" && sheet.status === "scheduled" ? { ...sheet, status: "finished" } : sheet;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export const whereWord = (home: boolean) => (home ? "en casa" : "fuera");

/** «J7 · Liga · dom 1 nov · 10:00 · en casa». */
export function kickerOf(j: string, sheet: Pick<MatchSheet, "competition" | "date" | "home">): string {
  const t = sheet.date;
  const when = Number.isFinite(t) ? [shortDate(t), clockTime(t)] : ["sin fecha"];
  return [j, sheet.competition.trim(), ...when, whereWord(sheet.home)].filter(Boolean).join(" · ");
}

export type TabMark = "ok" | "wn" | "";
/** The ✓ / ! of each tab. */
export function tabMarks(o: { phase: Phase; review: ActaReview; starters: number; published: boolean }): Record<MatchTab, TabMark> {
  const step = (k: string) => o.review.steps.find((s) => s.key === k)?.tone ?? "";
  const mark = (t: string): TabMark => (t === "warn" ? "wn" : t === "ok" ? "ok" : "");
  return {
    encuentro: mark(step("encuentro")),
    convocatoria: o.phase === "off" ? "" : o.phase === "antes" ? (o.starters < 7 ? "wn" : "ok") : mark(step("convocatoria")),
    acta: o.phase === "jugado" ? mark(step("acta")) : "",
    publicar: o.published ? "ok" : "",
  };
}

/**
 * Which footer: `calendario` (to play, in the calendar: «Guardar»), `borrador` (to play, only a draft:
 * «Guardar borrador» + «Publicar en el calendario»), `juego` («Abrir En juego»), `acta` (played, not
 * published: «Guardar borrador» + «Publicar acta») or `publicada` («Guardar cambios»).
 */
export type FooterMode = "calendario" | "borrador" | "juego" | "acta" | "publicada";
export interface FooterView {
  mode: FooterMode;
  tone: "ok" | "warn" | "neu";
  /** The concrete reason («No cuadra: falta el goleador de 1 gol», «Por jugar · dom 8 nov 12:00»…). */
  why: string;
}
export interface FooterInput {
  phase: Phase;
  /** matches/{id} exists (the public calendar has it). */
  inCalendar: boolean;
  /** A draft is waiting over it. */
  draft: boolean;
  status: string;
  date: number;
  review: ActaReview;
}
/** «No cuadra: falta el goleador de 1 gol» / the first reason. */
export function notSquareWhy(r: ActaReview): string {
  return r.missingScorers ? `No cuadra: falta el goleador de ${plural(r.missingScorers, "gol", "goles")}` : `No cuadra: ${r.reasons[0] ?? "revisa el acta"}`;
}
/** The lower third when «Publicar» is pressed and it doesn't square. */
export function blockedWhy(r: ActaReview): string {
  return r.missingScorers ? `Para publicar falta el goleador de ${plural(r.missingScorers, "gol", "goles")}` : `Para publicar: ${r.reasons[0] ?? "revisa el acta"}`;
}
export function footerOf(o: FooterInput): FooterView {
  if (o.phase === "juego") return { mode: "juego", tone: "neu", why: "En juego · apunta desde «En juego»: llega aquí solo" };
  if (o.phase === "jugado") {
    const published = o.inCalendar && !o.draft && o.status === "finished";
    if (!o.review.cuadra) return { mode: published ? "publicada" : "acta", tone: "warn", why: notSquareWhy(o.review) };
    if (published) return { mode: "publicada", tone: "ok", why: "Publicada · la web ya lo cuenta" };
    const gf = o.review.goalsFor;
    return { mode: "acta", tone: "ok", why: `Cuadra · ${gf === 0 ? "sin goles del Piti" : gf === 1 ? "1 gol, con goleador" : `${gf} goles, todos con goleador`}` };
  }
  const mode: FooterMode = o.inCalendar && !o.draft ? "calendario" : "borrador";
  if (o.status === "cancelled") return { mode, tone: "neu", why: "Cancelado · no cuenta para las estadísticas" };
  if (o.status === "postponed") return { mode, tone: "neu", why: "Aplazado · pon la nueva fecha en Encuentro" };
  if (!o.inCalendar) return { mode, tone: "warn", why: "Sin publicar · aún no sale en el calendario" };
  if (o.draft) return { mode, tone: "warn", why: "Borrador · el calendario aún no tiene estos cambios" };
  return { mode, tone: "neu", why: Number.isFinite(o.date) ? `Por jugar · ${shortDate(o.date)} ${clockTime(o.date)}` : "Por jugar · sin fecha" };
}

/** «Guardado 12:04 · hora de Madrid» / «● Cambios sin guardar». */
export function savedLine(o: { dirty: boolean; savedAt: number | null; published: boolean; now: number }): string {
  if (o.dirty) return "● Cambios sin guardar";
  if (o.savedAt) return `Guardado ${shortDate(o.savedAt) === shortDate(o.now) ? "" : `${shortDate(o.savedAt)}, `}${clockTime(o.savedAt)} · hora de Madrid`;
  return o.published ? "Guardado · hora de Madrid" : "Sin guardar todavía";
}

// ───────────────────────── the acta's rows ─────────────────────────
/** A goal row's big line: the scorer, «Autogol de RIVAL» or «¿Quién marcó?». */
export function goalWho(g: GoalRow, rival: string, nameOf: (id: string) => string): string {
  return g.kind === "og" ? `Autogol de ${rival}` : g.scorer ? nameOf(g.scorer) : "¿Quién marcó?";
}
/** «Gol 1 · pase de HUBEROSKI», «Gol 3 · falta quién marcó», «Gol 2 de penalti · sin asistencia». */
export function goalSub(g: GoalRow, nameOf: (id: string) => string): string {
  const kind = g.kind === "goal_penalty" ? " de penalti" : g.kind === "goal_freekick" ? " de falta" : "";
  const base = `Gol ${g.n}${kind}`;
  if (g.open) return `${base} · falta quién marcó`;
  if (g.kind === "og") return `${base} · cuenta para el Piti`;
  return g.assist ? `${base} · pase de ${nameOf(g.assist)}` : `${base} · sin asistencia`;
}

export interface CuentaRow {
  title: string;
  value: string;
  /** One dot per goal: on (sky), miss (amber ring) or "" (empty ring). */
  dots: ("on" | "miss" | "")[];
}
/** «La cuenta»: the score, how many have their scorer (the missing ones amber) and their pass (optional). */
export function cuentaOf(rows: readonly GoalRow[]): CuentaRow[] {
  const n = rows.length;
  const named = rows.filter((r) => !r.open).length;
  const passed = rows.filter((r) => r.assist).length;
  const dots = (on: number, rest: "miss" | "") => Array.from({ length: n }, (_, i) => (i < on ? "on" : rest) as "on" | "miss" | "");
  return [
    { title: "Marcador", value: plural(n, "gol", "goles"), dots: dots(n, "") },
    { title: "Con goleador", value: `${named} de ${n}`, dots: dots(named, "miss") },
    { title: "Con pase (opcional)", value: `${passed} de ${n}`, dots: dots(passed, "") },
  ];
}

/** The crónica card's headline: «El Piti gana 3–1 en casa ante FUSION 7». */
export function cronicaHeadline(gf: number, ga: number, home: boolean, rival: string): string {
  const verb = gf > ga ? "El Piti gana" : gf === ga ? "Empate" : "El Piti cae";
  return `${verb} ${gf}–${ga} ${home ? `en casa ante ${rival}` : `en el campo de ${rival}`}`;
}
/** «CRÓNICA · J7 · 1 NOV». */
export function cronicaKicker(j: string, date: number, day: (ms: number) => string): string {
  return ["CRÓNICA", j, Number.isFinite(date) ? day(date).toLocaleUpperCase("es") : ""].filter(Boolean).join(" · ");
}

// ───────────────────────── Campo: name · address in `venue` ─────────────────────────
const SEP = " · ";
/** The field's name and address, from the one `venue` string («Campo X · Calle Y»). */
export function splitVenue(venue: string): { name: string; address: string } {
  const i = venue.indexOf(SEP);
  return i < 0 ? { name: venue, address: "" } : { name: venue.slice(0, i), address: venue.slice(i + SEP.length) };
}
/** Back to `venue` (kept as typed while editing; tidyVenue() cleans it when saving). */
export function joinVenue(name: string, address: string): string {
  return address ? `${name}${SEP}${address}` : name;
}
/** The venue as it is saved: no empty halves, no stray separators. */
export function tidyVenue(venue: string): string {
  const { name, address } = splitVenue(venue);
  return [name.trim(), address.trim()].filter(Boolean).join(SEP);
}

/** The MVP vote's close («el martes, 14:00»), Madrid. */
export function closesWords(ms: number): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long" }).formatToParts(ms).map((x) => [x.type, x.value]));
  return `el ${p.weekday}, ${clockTime(ms)}`;
}
/** A match's MVP close (stored, else 48 h from `from`). */
export const voteCloses = (voteClosesAt: unknown, from: number) => {
  const t = dateMillis(voteClosesAt);
  return Number.isFinite(t) ? t : from + 48 * 3600_000;
};
