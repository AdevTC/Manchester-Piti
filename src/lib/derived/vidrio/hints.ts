// «Vidrio» · the shelf's hints: one short live line under each of Inicio's places — Hoy («2–1, minuto 23»),
// Temporada («4º si acaba así»), Club («Huberoski cumple el 27») and Tú («2 cosas pendientes», only for a
// jugador). Pure: it words what the match day (derived/matchday), the table and the squad already say.
import { dateMillis, matchPhase } from "../../../../functions/src/matchEngine";
import type { MatchdayModel } from "../matchday";
import { AWAITING_ACTA } from "../kickoff";
import { madridDate, madridTime } from "../madrid";
import { resultLetter } from "../result";
import { capital, plural } from "../words";

const DAY = 86_400_000;
const WEEKDAY = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short" });

export interface PlaceHintsInput {
  day: Pick<MatchdayModel, "phase" | "match" | "minute" | "score" | "kickoff">;
  now: number;
  /** Our place in the table: `projected` when it counts the live score (projectTable). Null: no table. */
  table?: { position: number | null; points: number | null; projected: boolean } | null;
  /** Without a table: jornadas played and in all (seasonStrip counts). */
  season?: { played: number; total: number } | null;
  /** The squad's next birthdays, soonest first (lib/home upcomingBirthdays). */
  birthdays?: readonly { name: string; days: number; label: string }[];
  squadSize?: number;
  /** Things waiting on the jugador (RSVP, porra, turnos, caja, encuestas…); null or absent: no «Tú». */
  pending?: number | null;
}

export interface PlaceHints {
  hoy: string;
  temporada: string;
  club: string;
  /** Null when the viewer has no «Tú». */
  tu: string | null;
}

const madridDays = (from: number, to: number) => {
  const n = (ms: number) => {
    const [y, m, d] = madridDate(ms).split("-").map(Number);
    return Date.UTC(y, m - 1, d) / DAY;
  };
  return n(to) - n(from);
};

/** «Dom 25, 14:00» · «Mañana, 14:00» · «Hoy, 19:00» for a kick-off seen from `now`. */
export function kickoffHint(at: number, now: number): string {
  const days = madridDays(now, at);
  const time = madridTime(at);
  if (days === 0) return `Hoy, ${time}`;
  if (days === 1) return `Mañana, ${time}`;
  const [, , d] = madridDate(at).split("-").map(Number);
  return `${capital(WEEKDAY.format(at).replace(".", ""))} ${d}, ${time}`;
}

const score = (s: { gf: number; ga: number }) => `${s.gf}–${s.ga}`;
const RESULT_VERB = { G: "Ganamos", E: "Empate", P: "Perdimos" } as const;

function hoyHint(day: PlaceHintsInput["day"], now: number): string {
  const s = day.score;
  switch (day.phase) {
    case "directo1":
    case "directo2":
      return s ? `${score(s)}, minuto ${day.minute ?? 1}` : "En juego";
    case "descanso":
      return s ? `${score(s)}, al descanso` : "Descanso";
    case "pitido":
      return "Pendiente del pitido";
    case "antes":
      return day.kickoff !== null ? `Hoy, ${madridTime(day.kickoff)}` : "Hoy";
    case "final":
      return s ? `Final, ${score(s)}` : "Final";
    case "pendiente":
      return AWAITING_ACTA;
    case "acta":
    case "despues":
      return s ? `${RESULT_VERB[resultLetter(s.gf, s.ga)]} ${score(s)}` : "Jugado";
    case "aplazado":
      return day.match && matchPhase(day.match, now) === "cancelled" ? "Suspendido" : "Aplazado";
    case "semana": {
      if (!day.match) return "Sin partidos a la vista";
      const at = dateMillis(day.match.date);
      return Number.isFinite(at) ? kickoffHint(at, now) : "Fecha por confirmar";
    }
    default:
      return "Pretemporada";
  }
}

/** The four hints. */
export function placeHints(input: PlaceHintsInput): PlaceHints {
  const { table, season, birthdays, squadSize, pending, now } = input;
  let temporada: string;
  if (table && table.position !== null) {
    temporada = table.projected ? `${table.position}º si acaba así` : `${table.position}º con ${plural(table.points ?? 0, "punto", "puntos")}`;
  } else if (season && season.total > 0) {
    temporada = season.played > 0 ? `${season.played} de ${plural(season.total, "jornada", "jornadas")}` : "Empieza la temporada";
  } else temporada = "Sin calendario todavía";

  const soon = birthdays?.find((b) => b.days <= 30);
  let club: string;
  if (soon) {
    const dayOfMonth = soon.label.split(" ")[0];
    club = soon.days === 0 ? `${soon.name} cumple hoy` : soon.days === 1 ? `${soon.name} cumple mañana` : `${soon.name} cumple el ${dayOfMonth}`;
  } else club = squadSize ? `${squadSize} en la plantilla` : "El club";

  const tu = pending === null || pending === undefined ? null : pending > 0 ? plural(pending, "cosa pendiente", "cosas pendientes") : "Todo al día";
  return { hoy: hoyHint(input.day, now), temporada, club, tu };
}
