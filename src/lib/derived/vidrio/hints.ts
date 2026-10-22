// «Vidrio» · the shelf's hints: one short live line under each of Inicio's places — Hoy («19:00, Orduña fc»,
// «2–1, minuto 23», «3–1, acta lista», «3–1, MVP Alcides»),
// Temporada («4º si acaba así»), Club («Huberoski cumple el 27») and Tú («2 cosas pendientes», only for a
// jugador). Pure: it words what the match day (derived/matchday), the table and the squad already say.
import { dateMillis, matchPhase } from "../../../../functions/src/matchEngine";
import type { MatchdayModel } from "../matchday";
import { AWAITING_ACTA } from "../kickoff";
import { madridDate, madridTime, MONTHS_SHORT } from "../madrid";
import { capital, plural, scoreText } from "../words";

const DAY = 86_400_000;
const WEEKDAY = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short" });

export interface PlaceHintsInput {
  day: Pick<MatchdayModel, "phase" | "match" | "minute" | "score" | "kickoff">;
  now: number;
  /** Our place in the table: `projected` when it counts the live score (projectTable). Null: no table. */
  table?: { position: number | null; points: number | null; projected: boolean } | null;
  /** Jornadas played and in all (seasonStrip counts), and tonight's (or the next) jornada. */
  season?: { played: number; total: number; jornada?: number | null } | null;
  /** The MVP once the vote has closed («3–1, MVP Alcides»); ties: every name. */
  mvp?: readonly string[] | null;
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

const score = (s: { gf: number; ga: number }) => scoreText(s.gf, s.ga);

function hoyHint(day: PlaceHintsInput["day"], now: number, mvp: readonly string[] | null | undefined): string {
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
      return day.kickoff !== null ? `${madridTime(day.kickoff)}, ${day.match?.rival?.trim() || "hoy"}` : "Hoy";
    case "final":
      return s ? `Final, ${score(s)}` : "Final";
    case "pendiente":
      return AWAITING_ACTA;
    case "acta":
    case "despues":
      if (!s) return "Jugado";
      return mvp?.length ? `${score(s)}, MVP ${mvp.length === 1 ? mvp[0] : "compartido"}` : `${score(s)}, acta lista`;
    case "aplazado": {
      if (day.match && matchPhase(day.match, now) === "cancelled") return "Suspendido";
      // (with its new date: «Aplazado al 14 ene»)
      const to = day.match?.postponedTo;
      return typeof to === "number" && Number.isFinite(to) ? `Aplazado al ${Number(madridDate(to).slice(8))} ${MONTHS_SHORT[Number(madridDate(to).slice(5, 7)) - 1] ?? ""}`.trim() : "Aplazado";
    }
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
  const ahead = input.day.phase === "antes" || input.day.phase === "pitido";
  let temporada: string;
  if (table && table.position !== null) {
    // (before tonight's whistle: the place and the jornada about to be played, «6º, J17 de 26»)
    temporada = table.projected
      ? `${table.position}º si acaba así`
      : ahead && season?.jornada && season.total
        ? `${table.position}º, J${season.jornada} de ${season.total}`
        : `${table.position}º con ${plural(table.points ?? 0, "punto", "puntos")}`;
  } else if (season && season.total > 0) {
    temporada =
      season.played > 0
        ? `${season.played} de ${plural(season.total, "jornada", "jornadas")}`
        : ahead && input.day.kickoff !== null
          ? Number(madridTime(input.day.kickoff).slice(0, 2)) >= 16
            ? "Empieza esta noche"
            : "Empieza hoy"
          : "Empieza la temporada";
  } else temporada = "Sin calendario todavía";

  const soon = birthdays?.find((b) => b.days <= 30);
  let club: string;
  if (soon) {
    const dayOfMonth = soon.label.split(" ")[0];
    club = soon.days === 0 ? `${soon.name} cumple hoy` : soon.days === 1 ? `${soon.name} cumple mañana` : `${soon.name} cumple el ${dayOfMonth}`;
  } else club = squadSize ? `${squadSize} en la plantilla` : "El club";

  const tu = pending === null || pending === undefined ? null : pending > 0 ? plural(pending, "cosa pendiente", "cosas pendientes") : "Todo al día";
  return { hoy: hoyHint(input.day, now, input.mvp), temporada, club, tu };
}
