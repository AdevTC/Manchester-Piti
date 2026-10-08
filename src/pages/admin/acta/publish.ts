// What publishing an acta does, in words (pure): the scorers' chips of the «¿Publicar el acta?» modal,
// its consequence lines, and the MVP status (not editable: the vote opens by itself when a finished
// acta is published, closes 48 h later on the server, and has a winner once closed).
import { clockTime, shortDate } from "../data/adminLogic";
import { goalRows, type MatchSheet } from "./sheetModel";

export const MVP_WINDOW_MS = 48 * 3600_000;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
/** «mar 3 nov, 12:06». */
export const dayTime = (ms: number) => `${shortDate(ms)}, ${clockTime(ms)}`;

/** «ADRIÁN T.C. 9′ (HUBEROSKI)», «Autogol de FUSION 7 46′», «Gol 3 sin goleador». */
export function scorerChips(sheet: MatchSheet, nameOf: (id: string) => string): string[] {
  const rival = sheet.rival.trim() || "el rival";
  return goalRows(sheet).map((g) => {
    const who = g.kind === "og" ? `Autogol de ${rival}` : g.scorer ? nameOf(g.scorer) : `Gol ${g.n} sin goleador`;
    const kind = g.kind === "goal_penalty" ? " de penalti" : g.kind === "goal_freekick" ? " de falta" : "";
    return `${who}${g.minute !== undefined ? ` ${g.minute}′` : ""}${kind}${g.assist ? ` (${nameOf(g.assist)})` : ""}`;
  });
}

export interface MvpState {
  /** The match is (or is being published as) finished. */
  finished: boolean;
  /** Published and clean (no pending draft). */
  published: boolean;
  /** The vote's close time, once published. */
  voteClosesAt?: number | null;
  /** Winners' names once closed, and their votes. */
  winners: string[];
  votes: number;
  total: number;
}
/** The «MVP:» line of the Publicar tab. */
export function mvpStatus(s: MvpState, now: number): string {
  if (!s.finished) return "la votación se abre sola cuando se publique el acta del partido, y dura 48 h.";
  if (!s.voteClosesAt) return "la votación se abre sola al publicar el acta y dura 48 h.";
  if (s.voteClosesAt > now) return `votación abierta · cierra el ${shortDate(s.voteClosesAt)} a las ${clockTime(s.voteClosesAt)}. Se abrió sola al publicar.`;
  if (!s.winners.length) return `votación cerrada el ${shortDate(s.voteClosesAt)} · ${s.total ? "sin ganador" : "nadie votó"}.`;
  return `votación cerrada · ${s.winners.length > 1 ? `empate entre ${andList(s.winners)}` : `ganó ${s.winners[0]}`} con ${plural(s.votes, "voto", "votos")}.`;
}

export interface Consequence {
  tone: "r" | "o" | "g" | "";
  text: string;
}
/** The modal's list: what the web will show and what happens with the MVP vote. */
export function publishConsequences(o: { finished: boolean; starters: number; bench: number; voteClosesAt?: number | null; firstTime: boolean; now: number }): Consequence[] {
  if (!o.finished)
    return [
      { tone: "o", text: o.firstTime ? "Sale en el calendario de la web con su fecha, hora y campo" : "Se actualizan el calendario y la ficha del partido" },
      { tone: "o", text: o.starters ? `Convocatoria: ${plural(o.starters, "titular", "titulares")} y ${plural(o.bench, "suplente", "suplentes")}` : "Sin convocatoria todavía: se puede hacer después" },
      { tone: "", text: "Se puede corregir después; cada cambio queda a la vista de los capitanes" },
    ];
  const closes = o.voteClosesAt ?? o.now + MVP_WINDOW_MS;
  return [
    { tone: "o", text: `Convocatoria: ${plural(o.starters, "titular", "titulares")} y ${plural(o.bench, "suplente", "suplentes")} · minutos calculados` },
    { tone: "o", text: "Se actualizan calendario, perfiles y estadísticas" },
    o.voteClosesAt
      ? { tone: "g", text: o.voteClosesAt > o.now ? `La votación del MVP sigue abierta hasta el ${dayTime(closes)}` : "La votación del MVP ya se cerró: los votos de quien deje de haber jugado se descartan" }
      : { tone: "g", text: `La votación del MVP se abre ahora y cierra en 48 h (${dayTime(closes)})` },
    { tone: "", text: "Se puede corregir después; cada cambio queda a la vista de los capitanes" },
  ];
}
