// HOY Y PARTIDOS · what a match is, said the same way in Hoy, the season's table, Archivados and the stations (the
// boards' partidos.js helpers on the app's data): its state in a word, whether it shows a score (never an «E 0–0»
// nobody wrote, B-HOY-11), its group for the filters, whether it is yours to do. Pure.
import type { AdminMatch } from "../../data/adminLogic";
import type { CarrilPhase, StationView } from "../../partido/carril";

const D = 86_400_000;

export const isLive = (p: CarrilPhase): boolean => p === "juego" || p === "descanso";
export const isPlayed = (p: CarrilPhase): boolean => p === "final" || p === "publicado";
export const isOff = (p: CarrilPhase): boolean => p === "aplazado" || p === "cancelado";
/** Only in the drafts: never published to the calendar. */
export const isDraftOnly = (m: Pick<AdminMatch, "published">): boolean => !m.published;
/** A score is shown only for what was played or is being played (a match that never reached la mesa has none). */
export const hasScore = (p: CarrilPhase): boolean => isPlayed(p) || isLive(p);

/** «J3», «Borrador» (only in the drafts), «Sin jornada». */
export const jWord = (m: Pick<AdminMatch, "jornada" | "published">): string => (m.jornada ? `J${m.jornada}` : isDraftOnly(m) ? "Borrador" : "Sin jornada");
/** «J3 · Red Demons». */
export const shortTitle = (m: Pick<AdminMatch, "jornada" | "rival">): string => `${m.jornada ? `J${m.jornada} · ` : ""}${m.rival || "Rival por confirmar"}`;

/** The match's state in words for a row and its head (B-PAR-03: a cancelled draft is never «Publicado»). */
export function stateWord(p: CarrilPhase, m: Pick<AdminMatch, "published" | "draft">): string {
  if (p === "cancelado") return isDraftOnly(m) ? "Cancelado · borrador" : "Cancelado";
  if (p === "aplazado") return "Aplazado";
  if (isDraftOnly(m)) return "Borrador";
  if (isLive(p)) return p === "descanso" ? "En juego · descanso" : "En juego";
  if (p === "publicado") return m.draft ? "Publicada · corrección en borrador" : "Publicada";
  if (p === "final") return "Final · sin publicar";
  if (p === "pendiente") return "Sin acta";
  return "En el calendario";
}

export type Group = "jugar" | "jugados" | "fuera";
/** The filters' groups: por jugar (and en juego), jugados (and «¿Se jugó?»), fuera (aplazado, cancelado). */
export function groupOf(p: CarrilPhase): Group {
  if (isOff(p)) return "fuera";
  if (p === "antes" || isLive(p)) return "jugar";
  return "jugados";
}

/** «Te toca» for a row of the season: an acta to do, «¿Se jugó?», the después of a published one, or the next
 *  match within four days whose convocatoria or mesa is the captain's to do. */
export function rowToca(o: { phase: CarrilPhase; stations: readonly StationView[]; date: number; isNext: boolean; now: number }): boolean {
  const { phase, stations } = o;
  if (phase === "pendiente" || phase === "final") return true;
  const st = (id: StationView["id"]) => stations.find((s) => s.id === id)?.state;
  if (phase === "publicado") return st("acta") === "toca" || st("despues") === "toca";
  if (o.isNext && Number.isFinite(o.date) && o.date - o.now < 4 * D) return st("convocatoria") === "toca" || st("en-juego") === "toca";
  return false;
}

/** The kicker of a match's hero in Hoy. */
export function heroKicker(p: CarrilPhase): string {
  if (isLive(p)) return "Ahora mismo";
  if (p === "final") return "Recién pitado";
  if (p === "pendiente") return "No llegó a la mesa";
  if (p === "publicado") return "La última jornada";
  return "El próximo partido";
}

/** A safe view-transition name for a match's title (rows ↔ the match's head ↔ Hoy's hero). */
export const matchVt = (id: string): string => `sc-m-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

/** The competitions a match is played in (Nuevo partido, Datos). */
export const COMPETITIONS = ["Liga", "Copa", "Amistoso"] as const;
