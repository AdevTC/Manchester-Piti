// «Mis ausencias» as the CL- board words it (part-vestuario vx.g.ausencias): the matches an absence answers
// («1 partido en esas fechas: J3 contra Red Demons») and the team's line («En el equipo: Andia, hasta el 27
// (viaje).»). The counting rule is derived/absences' (the backend's own).
import { absenceRangeText, absenceUntilText, matchesInRange, type Absence, type MatchSlot } from "../../../lib/derived/absences";
import { joinEs } from "../../../lib/derived/polls";

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Matches named in a row before «y N más». */
const NAMED = 3;

/** «1 partido en esas fechas: J3 contra Red Demons» / «Sin partidos en esas fechas por ahora». */
export function ausenciasMatchesLine(
  slots: readonly MatchSlot[],
  range: Pick<Absence, "from" | "to">,
  now: number,
  matches: readonly { id: string; rival?: string | null }[],
  jornada: ReadonlyMap<string, number>,
): string {
  const hit = matchesInRange(slots, range, now);
  if (!hit.length) return "Sin partidos en esas fechas por ahora";
  const names = hit.slice(0, NAMED).map((s) => {
    const j = jornada.get(s.id);
    const rival = matches.find((m) => m.id === s.id)?.rival?.trim();
    return [j ? `J${j}` : "", rival ? `contra ${rival}` : ""].filter(Boolean).join(" ") || "un partido sin rival aún";
  });
  if (hit.length > NAMED) names.push(`${hit.length - NAMED} más`);
  return `${hit.length === 1 ? "1 partido" : `${hit.length} partidos`} en esas fechas: ${joinEs(names)}`;
}

/** When a teammate is away, seen from `today`: «hasta el 27» (under way, this month), «hasta el 9 nov»,
 *  «hasta hoy», or the dates when it is still to come («del 2 al 9 nov»). */
function awayText(a: Pick<Absence, "from" | "to">, today: string): string {
  if (a.from > today) return absenceRangeText(a.from, a.to);
  if (a.to === today) return "hasta hoy";
  if (a.to.slice(0, 7) === today.slice(0, 7)) return `hasta el ${Number(a.to.slice(8, 10))}`;
  return absenceUntilText(a.to).replace(/^hasta /, "hasta el ");
}

/** «En el equipo: Andia, hasta el 27 (viaje).» from everyone else's absences under way or to come (soonest
 *  first, as useAbsences gives them); "" when nobody else is away. */
export function ausenciasTeamLine(absences: readonly Absence[], uid: string, today: string, nameOf: (a: Absence) => string): string {
  const others = absences.filter((a) => a.uid !== uid && a.to >= today);
  if (!others.length) return "";
  const parts = others.map((a) => {
    const note = a.note?.trim().replace(/[.\s]+$/, "");
    return `${nameOf(a)}, ${awayText(a, today)}${note ? ` (${note})` : ""}`;
  });
  return `En el equipo: ${parts.join("; ")}.`;
}
