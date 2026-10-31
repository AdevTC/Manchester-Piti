// «Mis ausencias» as the CL- board words it (part-vestuario vx.g.ausencias): the matches an absence answers
// («1 partido en esas fechas: J3 contra Red Demons») and the team's line («En el equipo: Andia, hasta el 27
// (viaje).»). The counting rule is derived/absences' (the backend's own).
import { absenceFormProblem, absenceRangeText, absenceUntilText, covers, madridDate, matchesInRange, type Absence, type MatchSlot } from "../../../lib/derived/absences";
import { MONTHS_SHORT } from "../../../lib/derived/madrid";
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

// ── The room as the prototype draws it (SalaAusencias.dc.html): the head's status in words, the «cinta» of the
// next eight weeks (the jornadas to come as markers, the absences as bars), the form's live preview, the date chips
// of «Apuntadas» and the team's rows. Pure: dates are Madrid days (`YYYY-MM-DD`), the matches the answerable ones
// (matchesInRange: scheduled, kick-off still ahead), soonest first.

/** A match an absence can still answer, as the room names it. */
export interface UpMatch {
  id: string;
  /** «J3» («Partido» without a jornada number). */
  j: string;
  /** «J3 contra Red Demons». */
  name: string;
  /** Its Madrid day. */
  day: string;
}

/** Someone else away, as the room reads him. */
export interface TeamAway {
  key: string;
  name: string;
  /** His dorsal ("" without one). */
  num: string;
  from: string;
  to: string;
  note: string;
}

export const RIB_WEEKS = 8;
const RIB_DAYS = RIB_WEEKS * 7;
const DAY = 86_400_000;
const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const msOf = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10);
const dd = (s: string) => Number(s.slice(8, 10));
const mon = (s: string) => MONTHS_SHORT[Number(s.slice(5, 7)) - 1] ?? "";
const pct = (d: number) => `${((Math.max(0, Math.min(RIB_DAYS, d)) / RIB_DAYS) * 100).toFixed(3)}%`;
const inRange = (ms: readonly UpMatch[], from: string, to: string) => ms.filter((m) => covers({ from, to }, m.day));
/** «hasta el 27 nov» (under way) or the dates («del 2 al 9 nov»). */
const awayWords = (a: { from: string; to: string }, today: string) => (a.from <= today ? `hasta el ${dd(a.to)} ${mon(a.to)}` : absenceRangeText(a.from, a.to));

/** The matches an absence can answer, named: from the club's slots and their jornada numbers. */
export function upMatches(slots: readonly MatchSlot[], now: number, matches: readonly { id: string; rival?: string | null }[], jornada: ReadonlyMap<string, number>): UpMatch[] {
  return matchesInRange(slots, { from: "0000-01-01", to: "9999-12-31" }, now).map((s) => {
    const n = jornada.get(s.id);
    const rival = matches.find((m) => m.id === s.id)?.rival?.trim();
    const j = n ? `J${n}` : "Partido";
    return { id: s.id, j, name: rival ? `${j} contra ${rival}` : j, day: madridDate(s.date as number) };
  });
}

/** The room's title and line: «Fuera hasta el 27 nov y 1 más» + the matches answered for him, or how it works. */
export function ausenciasHead(mine: readonly Pick<Absence, "from" | "to">[], today: string, up: readonly UpMatch[]): { title: string; sub: string } {
  const first = mine[0];
  if (!first) return { title: "Ninguna ausencia apuntada", sub: "¿Te vas unos días? Dilo una vez y contestamos «No puedo» en los partidos de esas fechas. Luego puedes cambiar cualquiera a mano." };
  const title = `${first.from <= today ? `Fuera hasta el ${dd(first.to)} ${mon(first.to)}` : `Fuera ${absenceRangeText(first.from, first.to)}`}${mine.length > 1 ? ` y ${mine.length - 1} más` : ""}`;
  const no = up.filter((m) => mine.some((a) => covers(a, m.day)));
  const sub = no.length
    ? `Contestamos «No puedo» por ti en la ${joinEs(no.map((m) => m.name))}. Si al final puedes, cámbialo a mano en el partido.`
    : "No hay partidos en esas fechas todavía: si se publica alguno, contestamos «No puedo» por ti.";
  return { title, sub };
}

/** What «Añadir» would do, live: the problem (shown once both dates are there or after a try; before, a hint), or
 *  the preview of the matches it answers. */
export function ausenciasDraft(from: string, to: string, today: string, up: readonly UpMatch[], tried: boolean): { err: string; showErr: boolean; hint: boolean; k: string; text: string } {
  const err = absenceFormProblem(from, to, today) ?? "";
  if (err) {
    const showErr = tried || (!!from && !!to);
    return { err, showErr, hint: !showErr, k: "", text: "" };
  }
  const hit = inRange(up, from, to);
  const range = cap(absenceRangeText(from, to));
  return hit.length
    ? { err: "", showErr: false, hint: false, k: `${range} · lo que pasará`, text: `Contestaremos «No puedo» en: ${joinEs(hit.map((m) => m.name))}` }
    : { err: "", showErr: false, hint: false, k: `${range} · sin partidos`, text: "En esas fechas no hay partidos todavía: si se publica alguno, contestamos «No puedo» por ti." };
}

/** An absence's date chip: «12–16» over «nov» (one day: «12»; two months: «28–3» over «oct–nov»). */
export function absenceChip(a: Pick<Absence, "from" | "to">): { big: string; mon: string } {
  const same = a.from.slice(0, 7) === a.to.slice(0, 7);
  return { big: a.from === a.to ? String(dd(a.from)) : `${dd(a.from)}–${dd(a.to)}`, mon: same ? mon(a.to) : `${mon(a.from)}–${mon(a.to)}` };
}

/** The team's rows: «Hasta el 27 nov · viaje» and how many of the matches to come each one misses. */
export function teamRows(team: readonly TeamAway[], today: string, up: readonly UpMatch[]) {
  return team.map((x) => {
    const n = inRange(up, x.from < today ? today : x.from, x.to).length;
    return { key: x.key, name: x.name, num: x.num, line: cap(awayWords(x, today)) + (x.note ? ` · ${x.note}` : ""), miss: n ? (n === 1 ? "Falta a 1 partido" : `Falta a ${n} partidos`) : "Sin partidos" };
  });
}

export interface RibBar {
  key: string;
  who: string;
  t: string;
  /** Where the bar starts and how long it is (percentages of the ribbon). */
  bar: { left: string; width: string };
  /** The label, on the side that has room. */
  lbl: { left: string } | { right: string };
  /** Started before the ribbon (its left end cut). */
  cut: boolean;
}
export interface RibMark {
  id: string;
  j: string;
  day: string;
  left: string;
  /** One of his absences answers it «No puedo». */
  no: boolean;
  /** The draft would. */
  fresh: boolean;
  edge: "" | "is-start" | "is-end";
}

/**
 * The «cinta»: eight weeks from this week's Monday with today marked, the jornadas to come in it (with «No puedo»
 * where one of his absences, or the draft, answers it), his bars, the draft's and the team's (bars wholly outside
 * are left out), and the figure's description in words.
 */
export function ausenciasRibbon(today: string, up: readonly UpMatch[], mine: readonly Pick<Absence, "id" | "from" | "to">[], team: readonly TeamAway[], draft: { from: string; to: string } | null) {
  const start = msOf(today) - ((new Date(msOf(today)).getUTCDay() + 6) % 7) * DAY;
  const end = isoOf(start + (RIB_DAYS - 1) * DAY);
  const weeks = Array.from({ length: RIB_WEEKS }, (_, i) => {
    const a = isoOf(start + i * 7 * DAY);
    const b = isoOf(start + (i * 7 + 6) * DAY);
    return { t: i === 0 ? "Esta semana" : a.slice(5, 7) === b.slice(5, 7) ? `${dd(a)}–${dd(b)} ${mon(b)}` : `${dd(a)} ${mon(a)}–${dd(b)} ${mon(b)}`, now: i === 0 };
  });
  const off = (s: string) => (msOf(s) - start) / DAY;
  const bar = (key: string, who: string, t: string, from: string, to: string): RibBar | null => {
    const a = off(from);
    const b = off(to) + 1;
    if (b <= 0 || a >= RIB_DAYS) return null;
    const l = Math.max(0, a);
    const r = Math.min(RIB_DAYS, b);
    return {
      key,
      who,
      t,
      bar: { left: pct(l), width: `${(((r - l) / RIB_DAYS) * 100).toFixed(3)}%` },
      lbl: l / RIB_DAYS > 0.62 ? { right: `${(100 - (r / RIB_DAYS) * 100).toFixed(3)}%` } : { left: pct(l) },
      cut: a < 0,
    };
  };
  const inRib = up.filter((m) => m.day >= today && m.day <= end);
  const mineNo = (m: UpMatch) => mine.some((a) => covers(a, m.day));
  const marks: RibMark[] = inRib.map((m) => {
    const d = off(m.day) + 0.5;
    const no = mineNo(m);
    const fresh = !no && !!draft && covers(draft, m.day);
    return { id: m.id, j: m.j, day: `${DOW[new Date(msOf(m.day)).getUTCDay()]} ${dd(m.day)}`, left: pct(d), no, fresh, edge: d / RIB_DAYS > 0.95 ? "is-end" : d / RIB_DAYS < 0.05 ? "is-start" : "" };
  });
  const myBars = mine
    .map((a) => {
      const hit = inRange(up, a.from, a.to);
      return bar(a.id, "Tú", absenceRangeText(a.from, a.to) + (hit.length ? ` · No puedo en la ${joinEs(hit.map((m) => m.j))}` : ""), a.from, a.to);
    })
    .filter((b): b is RibBar => !!b);
  const newBar = draft ? bar("new", "Nueva", absenceRangeText(draft.from, draft.to), draft.from, draft.to) : null;
  const teamBars = team.map((x) => bar(x.key, x.name, awayWords(x, today) + (x.note ? ` · ${x.note}` : ""), x.from, x.to)).filter((b): b is RibBar => !!b);
  const aria = [
    `Las próximas ${RIB_WEEKS} semanas.`,
    inRib.length ? `Partidos: ${inRib.map((m) => `${m.j} el ${dd(m.day)} ${mon(m.day)}${mineNo(m) ? ", contestamos No puedo" : ""}`).join("; ")}.` : "Sin partidos.",
    mine.length ? `Tú: fuera ${joinEs(mine.map((a) => absenceRangeText(a.from, a.to)))}.` : "Tú: sin ausencias.",
    ...team.map((x) => `${x.name}: ${awayWords(x, today)}.`),
  ].join(" ");
  return {
    weeks,
    marks,
    myBars,
    newBar,
    teamBars,
    past: pct(off(today)),
    meta: `Hasta el ${dd(end)} ${mon(end)}${inRib.length ? ` · ${inRib.length === 1 ? "1 jornada" : `${inRib.length} jornadas`}` : ""}`,
    aria,
  };
}
