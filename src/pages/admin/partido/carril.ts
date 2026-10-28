// The jornada's carril (r12, M-03): six stations — Convocatoria · Datos · La mesa · Acta · Publicar · Después —
// each saying in words how it goes (hecho · te toca · ahora · luego), the navigation of a match and, small, a
// column of the season and Hoy's hero. Ported from the boards' SCM.stations (piti-diseno/src/admin/src/admin/
// model.js) onto the app's data. Pure: the match, the instant, its acta review and what the frame knows.
import { dateMillis } from "../../../../functions/src/matchEngine";
import { STATIONS, type Station } from "../../../lib/adminUrls";
import type { VIconName } from "../../../components/vidrio/VIcon";
import { clockTime, shortDate, type ActaReview, type AdminMatch, type RsvpCounts } from "../data/adminLogic";
import { isUnwhistled, matchMoment } from "../data/moments";
import { resultLetter, resultWord } from "../kit/result";

/** The match's phase as the sala tells it (the boards' `m.phase`). `pendiente` = its date passed and it never
 *  reached la mesa: «¿Se jugó?» (B-HOY-11: never an «E 0–0» nobody wrote). */
export type CarrilPhase = "antes" | "juego" | "descanso" | "final" | "pendiente" | "publicado" | "aplazado" | "cancelado";
export type StationState = "hecho" | "toca" | "ahora" | "luego";
export interface StationView {
  id: Station;
  name: string;
  icon: VIconName;
  state: StationState;
  /** Its state in words («Sin mandar · 7 colgados», «Falta 1 goleador», «En la web»). */
  word: string;
  /** Its screen: /admin/partidos/<id>/<station>. */
  path: string;
}
export interface CarrilInput {
  match: AdminMatch;
  now: number;
  /** A captain pressed «Pitar el final» on this device (whistleStore). */
  whistled?: boolean;
  /** Its acta review (data.reviewOf). */
  review: Pick<ActaReview, "goalsFor" | "goalsAgainst" | "missingScorers" | "cuadra">;
  /** The answers to its convocatoria, when known (the next match's). */
  rsvp?: RsvpCounts | null;
  /** «MVP abierto» while its vote is open. */
  mvpOpen?: boolean;
  /** The calendar's copy is a finished acta (see carrilPhase). */
  publishedFinal?: boolean;
}

const D = 86_400_000;
const NAME: Record<Station, string> = { convocatoria: "Convocatoria", datos: "Datos", "en-juego": "La mesa", acta: "Acta", publicar: "Publicar", despues: "Después" };
const ICON: Record<Station, VIconName> = { convocatoria: "shirt", datos: "cal", "en-juego": "mesa", acta: "post", publicar: "share", despues: "star" };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** `publishedFinal`: the calendar's own copy is a finished acta (data.published), so a draft over it is a correction
 *  (the merged match cannot tell: the draft's status wins). */
export function carrilPhase(m: AdminMatch, now: number, whistled = false, publishedFinal = false): CarrilPhase {
  if (m.status === "cancelled") return "cancelado";
  if (m.status === "postponed") return "aplazado";
  // (a published acta with a correction in a draft is still the web's: «publicado», never «final sin publicar»)
  if (publishedFinal && m.published) return "publicado";
  const mo = matchMoment(m, now, whistled);
  if (mo === "publicado") return "publicado";
  if (mo === "juego") return m.clock?.phase === "halftime" ? "descanso" : "juego";
  // (past its window, never on la mesa — no clock started, nothing written, not marked finished: «¿Se jugó?»)
  const untouched = m.status !== "finished" && !(m.events ?? []).length && (!m.clock || m.clock.phase === "ready" || isUnwhistled(m, now));
  if (mo === "final") return untouched ? "pendiente" : "final";
  return "antes";
}

/** The station that matters now (a match's address without a station opens it). */
export function stationOf(phase: CarrilPhase): Station {
  if (phase === "juego" || phase === "descanso") return "en-juego";
  if (phase === "final" || phase === "pendiente") return "acta";
  if (phase === "publicado") return "despues";
  if (phase === "aplazado" || phase === "cancelado") return "datos";
  return "convocatoria";
}

export function stationsOf({ match: m, now, whistled = false, review, rsvp, mvpOpen, publishedFinal = false }: CarrilInput): StationView[] {
  const ph = carrilPhase(m, now, whistled, publishedFinal);
  const played = ph === "final" || ph === "publicado" || ph === "pendiente";
  const live = ph === "juego" || ph === "descanso";
  const off = ph === "aplazado" || ph === "cancelado";
  const called = (m.starters?.length ?? 0) + (m.bench?.length ?? 0);
  const notified = !!m.convocatoriaNotifiedAt;
  const changed = notified && (m.convocatoriaAt ?? 0) > (m.convocatoriaNotifiedAt ?? 0);
  const t = dateMillis(m.date);
  const hasDate = Number.isFinite(t);
  const out: { id: Station; state: StationState; word: string }[] = [];
  // 1 · la convocatoria
  out.push({
    id: "convocatoria",
    state: off ? "luego" : played || live ? "hecho" : notified ? (changed ? "toca" : "hecho") : "toca",
    word: off
      ? "No hace falta"
      : played || live
        ? called
          ? plural(called, "convocado", "convocados")
          : "Sin convocatoria"
        : notified
          ? changed
            ? "Ha cambiado: avisa otra vez"
            : rsvp
              ? `${rsvp.yes} vienen · ${rsvp.none} sin responder`
              : "Mandada"
          : called
            ? `Sin mandar · ${called} colgados`
            : "Sin mandar",
  });
  // 2 · los datos
  const lacks = [!m.venue ? "el campo" : "", !hasDate ? "la fecha" : ""].filter(Boolean);
  out.push({
    id: "datos",
    state: off || lacks.length ? "toca" : "hecho",
    word: ph === "aplazado" ? "Aplazado" : ph === "cancelado" ? "Cancelado" : lacks.length ? `Falta ${lacks.join(" y ")}` : `${shortDate(t)} · ${clockTime(t)}`,
  });
  // 3 · la mesa
  const scorer = m.mesa?.name ?? "";
  out.push({
    id: "en-juego",
    state: live ? "ahora" : played ? "hecho" : off ? "luego" : !scorer && hasDate && t - now < 3 * D ? "toca" : "luego",
    // (a clock left at «ready» never ran: the acta was written by hand, as the board's «Sin reloj»)
    word: live ? (ph === "descanso" ? "Descanso" : "En juego") : ph === "pendiente" ? "No llegó a la mesa" : played ? (m.clock && m.clock.phase !== "ready" ? "Pitado" : "Sin reloj") : scorer ? `Anota ${scorer}` : "Sin anotador",
  });
  // 4 · el acta
  const miss = review.missingScorers;
  const fix = ph === "publicado" && m.draft;
  const score = `${review.goalsFor}–${review.goalsAgainst}`;
  out.push({
    id: "acta",
    state: fix ? "toca" : ph === "publicado" ? "hecho" : ph === "final" || ph === "pendiente" ? "toca" : "luego",
    word: fix
      ? "Corrección en borrador"
      : ph === "publicado"
        ? `${score} · ${resultWord(resultLetter(review.goalsFor, review.goalsAgainst)).toLowerCase()}`
        : ph === "pendiente"
          ? "¿Se jugó?"
          : ph === "final"
            ? miss
              ? `Falta ${plural(miss, "goleador", "goleadores")}`
              : review.cuadra
                ? "Cuadra"
                : "Por completar"
            : live
              ? "Llega de la mesa"
              : "Después del partido",
  });
  // 5 · publicar
  out.push({
    id: "publicar",
    state: fix ? (review.cuadra ? "toca" : "luego") : ph === "publicado" ? "hecho" : ph === "final" && review.cuadra ? "toca" : "luego",
    word: fix ? "La web cuenta la anterior" : ph === "publicado" ? "En la web" : ph === "final" ? (review.cuadra ? "Lista" : "Antes, el acta") : "Cuando cuadre",
  });
  // 6 · después
  out.push({
    id: "despues",
    state: ph !== "publicado" ? "luego" : "hecho",
    word: ph !== "publicado" ? "MVP, notas, caja" : mvpOpen ? "MVP abierto" : "Al día",
  });
  return out.map((s) => ({ ...s, name: NAME[s.id], icon: ICON[s.id], path: `/admin/partidos/${m.id}/${s.id}` }));
}

/** A station's accessible name: «2 de 6 · Datos: dom 8 nov · 18:00 · hecho». */
export function stationLabel(s: StationView): string {
  const i = STATIONS.indexOf(s.id) + 1;
  const tail = s.state === "toca" ? " · te toca" : s.state === "hecho" ? " · hecho" : s.state === "ahora" ? " · ahora" : "";
  return `${i} de ${STATIONS.length} · ${s.name}: ${s.word}${tail}`;
}

/** The station before / after (← →), or null at either end. */
export function stepStation(current: Station, key: "ArrowLeft" | "ArrowRight"): Station | null {
  const i = STATIONS.indexOf(current) + (key === "ArrowRight" ? 1 : -1);
  return i >= 0 && i < STATIONS.length ? STATIONS[i] : null;
}

/** The match's state in one word for its head («En juego», «Final sin publicar», «¿Se jugó?»…). */
export function phaseWord(phase: CarrilPhase, m: Pick<AdminMatch, "published" | "draft">): string {
  switch (phase) {
    case "juego":
      return "En juego";
    case "descanso":
      return "Descanso";
    case "final":
      return "Final · sin publicar";
    case "pendiente":
      return "¿Se jugó?";
    case "publicado":
      return m.draft ? "Publicado · con una corrección en borrador" : "Publicado";
    case "aplazado":
      return "Aplazado";
    case "cancelado":
      return "Cancelado";
    default:
      return m.published ? "En el calendario" : "Borrador · aún no sale en el calendario";
  }
}
