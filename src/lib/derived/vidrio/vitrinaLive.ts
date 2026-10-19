// «Vidrio» · El club's vitrina (V-Integracion «El club y la cuenta», V-Vivo phone «Club»): a glass case with two
// shelves — the foundation, tonight's match in its live slot (its kick-off before, the score while it is
// played, the result after), the first cup still to come («Aquí irá»), the first victory (a dashed slot «Se
// juega ahora» until it arrives), the latest milestone, the «Debut» achievement — and beside it the next
// birthday told as a line. Pure: the page passes the match day, the club's content and the squad.
import type { ClubMatch } from "../../clubData";
import type { MatchdayModel } from "../matchday";
import { dateMillis, isVisibleMatch, matchPhase } from "../../../../functions/src/matchEngine";
import { madridDate, madridTime } from "../madrid";
import { playerGame } from "../../clubAnalytics";
import { resultOf } from "../../partidos";

export type PieceArt = "medal" | "ball" | "trophy" | "score" | null;
export interface VitrinaPiece {
  id: string;
  art: PieceArt;
  /** The big figure of the live slot («2–1», «19:00»). */
  score?: string;
  title: string;
  sub: string;
  /** A dashed empty slot (still to win). */
  empty?: boolean;
  /** The live slot. */
  live?: boolean;
}

export interface VitrinaInput {
  day: Pick<MatchdayModel, "phase" | "match" | "minute" | "score" | "jornada" | "next">;
  matches: readonly ClubMatch[];
  seasonId: string;
  now: number;
  founded: string;
  location: string;
  milestones: readonly { year: string; title: string; text: string }[];
}

const LIVE = new Set(["directo1", "descanso", "directo2"]);
const dash = (gf: number, ga: number) => `${gf}–${ga}`;
const SHORT_MONTH = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** The slot of tonight's match (or the next one, on any other day). */
function liveSlot(day: VitrinaInput["day"], now: number): VitrinaPiece {
  const m = day.match;
  const j = day.jornada ? `Jornada ${day.jornada}` : "El partido";
  const rival = m?.rival ?? "el rival";
  if (m && (day.phase === "antes" || day.phase === "pitido")) {
    const at = dateMillis(m.date);
    return { id: "hoy", art: "score", score: Number.isFinite(at) ? madridTime(at) : "Hoy", title: j, sub: `Hoy, contra ${rival}`, live: true };
  }
  if (m && day.score && LIVE.has(day.phase)) {
    const s = dash(day.score.gf, day.score.ga);
    return { id: "hoy", art: "score", score: s, title: j, sub: day.phase === "descanso" ? `Descanso, ${s}` : `${s}, minuto ${day.minute ?? 0}`, live: true };
  }
  if (m && day.score && (day.phase === "final" || day.phase === "acta")) {
    const s = dash(day.score.gf, day.score.ga);
    return { id: "hoy", art: "score", score: s, title: j, sub: `Final, ${s}`, live: true };
  }
  const next = day.phase === "despues" || day.phase === "aplazado" ? day.next : (day.match ?? day.next);
  if (next) {
    const at = dateMillis(next.date);
    const when = Number.isFinite(at) ? (madridDate(at) === madridDate(now) ? madridTime(at) : `${Number(madridDate(at).slice(8))} ${SHORT_MONTH[Number(madridDate(at).slice(5, 7)) - 1]}`) : "Pronto";
    return { id: "hoy", art: "score", score: when, title: "Lo próximo", sub: `Contra ${next.rival ?? "el rival"}` };
  }
  return { id: "hoy", art: null, title: "Lo próximo", sub: "Fecha por publicar", empty: true };
}

export function vitrinaPieces({ day, matches, seasonId, now, founded, location, milestones }: VitrinaInput): { top: VitrinaPiece[]; bottom: VitrinaPiece[] } {
  const visible = matches.filter(isVisibleMatch).sort((a, b) => dateMillis(a.date) - dateMillis(b.date));
  const finished = visible.filter((m) => matchPhase(m, now) === "finished");
  const season = finished.filter((m) => m.seasonId === seasonId);
  const where = location.trim();
  const since = founded.trim();
  const foundation: VitrinaPiece = { id: "fundacion", art: "medal", title: "La fundación", sub: [where, since].filter(Boolean).join(", ") || "Desde el primer balón" };
  const firstCup: VitrinaPiece = { id: "copa", art: null, title: "La primera copa", sub: "Aquí irá", empty: true };

  const win = season.find((m) => resultOf(m) === "G");
  const playing = LIVE.has(day.phase);
  const victory: VitrinaPiece = win
    ? { id: "victoria", art: "ball", title: "Primera victoria", sub: `${dash(win.goalsFor ?? 0, win.goalsAgainst ?? 0)} a ${win.rival ?? "el rival"}` }
    : { id: "victoria", art: null, title: "Primera victoria", sub: playing ? "Se juega ahora" : "Aquí irá", empty: true };

  const last = [...milestones].reverse().find((m) => m && m.title?.trim());
  const milestone: VitrinaPiece | null = last ? { id: "hito", art: "trophy", title: last.title.trim(), sub: last.year?.trim() || last.text?.trim() || "" } : null;

  // «Debut»: the season's first match; it arrives with its acta, held by everyone who played it
  const first = season[0];
  const firstLive = !first && !!day.match && day.match.seasonId === seasonId && (playing || day.phase === "final" || day.phase === "pitido" || day.phase === "antes");
  const players = first ? new Set([...(first.starters ?? []), ...(first.bench ?? []), ...Object.keys(first.ledger ?? {})].filter((id) => playerGame(id, first).played)).size : 0;
  const debut: VitrinaPiece = first
    ? { id: "debut", art: "medal", title: "Logro «Debut»", sub: players ? `Lo tienen los ${players} que jugaron` : "Lo tienen los que jugaron" }
    : { id: "debut", art: "medal", title: "Logro «Debut»", sub: firstLive ? "Llega con el acta" : "Llega con la jornada 1", empty: false };

  return { top: [foundation, liveSlot(day, now), firstCup], bottom: [victory, milestone ?? { id: "gol", art: null, title: "El primer título", sub: "Aquí irá", empty: true }, debut] };
}

const WEEKDAY = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** «Huberoski cumple 31 el martes 27. Tarta en el vestuario después de la J2.» — the next birthday (within
 *  `days`), and the first match from that day on within a week. Null when none is near. */
export function birthdayLine(squad: readonly { name: string; birthDate?: string }[], matches: readonly ClubMatch[], jornadaOf: (id: string) => number | null, now: number, days = 45): string | null {
  const today = madridDate(now);
  const [ty, tm, td] = today.split("-").map(Number);
  const base = Date.UTC(ty, tm - 1, td);
  const next = squad
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate ?? ""))
    .map((p) => {
      const [by, bm, bd] = p.birthDate!.split("-").map(Number);
      let at = Date.UTC(ty, bm - 1, bd);
      if (at < base) at = Date.UTC(ty + 1, bm - 1, bd);
      return { name: p.name, at, age: new Date(at).getUTCFullYear() - by };
    })
    .sort((a, b) => a.at - b.at)[0];
  if (!next || next.at - base > days * 86_400_000) return null;
  const d = new Date(next.at);
  const when = next.at === base ? "hoy" : next.at - base === 86_400_000 ? "mañana" : `el ${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()}`;
  const dayStr = d.toISOString().slice(0, 10);
  const after = matches
    .filter((m) => isVisibleMatch(m) && Number.isFinite(dateMillis(m.date)) && madridDate(dateMillis(m.date)) >= dayStr && dateMillis(m.date) - next.at < 8 * 86_400_000)
    .sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0];
  const j = after ? jornadaOf(after.id) : null;
  return `${next.name} cumple ${next.age} ${when}.${after ? ` Tarta en el vestuario después de ${j ? `la J${j}` : `el partido contra ${after.rival ?? "el rival"}`}.` : ""}`;
}
