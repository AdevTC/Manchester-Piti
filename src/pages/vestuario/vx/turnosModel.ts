// «Turnos» as the canvas prototype draws it (SalaTurnos.dc.html), pure: the match the turns are for, the jobs as tiles
// (his big: «Te toca», «Tú, Kevin», «Marcar como hecho» once played), «La rueda» (who carries each job over the next
// jornadas) and his turns to come, and the head's status in words in every state.
//
// The wheel is derived the way the backend hands turns out (functions/src/rota.ts: each played match is frozen with
// rotaLogic.turnsFor over the season's history, then becomes history for the next): the next match's turns as the
// page has them, then each later one computed with turnsFor over the history plus the matches before it as projected,
// with the captains' pins (rotaTurns) and the absences known today. Nobody's future «No puedo» is known yet, so a
// later column is what happens if nothing changes.
import { dateMillis, type ClubMatch } from "../../../lib/clubData";
import { jobApplies, playedTurns, rotaHistory, rotaPlayed, turnsFor, type Rota, type RotaAbsence, type RotaIconId, type RotaJob, type RotaMatch, type RotaTurnsDoc, type Turn } from "../../../lib/derived/rota";
import { madridDate } from "../../../lib/derived/madrid";
import type { VIcon } from "./icons";

/** A rota icon as the room's glyph. */
export const ROTA_VICON: Record<RotaIconId, VIcon> = { shirt: "shirt", ball: "ball", car: "car", bottle: "bottle", bag: "bag", key: "key" };

/** «Lavar la equipación» → «lavar la equipación» (for «Te toca: …»). */
export const lower1 = (s: string) => (s ? s.charAt(0).toLocaleLowerCase("es") + s.slice(1) : s);

/** The match has been played (or kicked off): his turn can be marked done. Never a cancelled or postponed one. */
export function turnPlayed(m: Pick<ClubMatch, "status" | "date"> | undefined, now: number): boolean {
  if (!m || m.status === "cancelled" || m.status === "postponed") return false;
  if (m.status === "finished") return true;
  const ko = dateMillis(m.date);
  return Number.isFinite(ko) && ko <= now;
}

/** Who does a turn, in words: «Tú, Kevin» / «Kevin» / «Nadie disponible», and a captain's swap
 *  («cambio del capitán (le tocaba a Erik)»). */
export function turnWho(t: Pick<Turn, "playerId" | "pinned" | "swappedFrom">, me: string | null, nameOf: (id: string) => string): { who: string; sub: string; mine: boolean } {
  const mine = !!me && t.playerId === me;
  const name = t.playerId ? nameOf(t.playerId) : "Nadie disponible";
  return { who: mine ? `Tú, ${name}` : name, sub: t.pinned && t.swappedFrom ? `cambio del capitán (le tocaba a ${nameOf(t.swappedFrom)})` : "", mine };
}

export interface TurnTile {
  key: string;
  job: string;
  icon: VIcon;
  /** His (drawn big, first). */
  mine: boolean;
  /** A job that doesn't go to this match (the car at home). */
  off: boolean;
  who: string;
  sub: string;
  /** Dorsal for the shirt ("" without one; none drawn when nobody or off). */
  playerId: string | null;
}

/**
 * The tiles of the match: his first, then the rota's order; the jobs that don't apply to it (away-only at home) as
 * «Nadie esta vez · Este partido es en casa». `turns`: the match's (turnsFor's, in the rota's job order).
 */
export function turnTiles(jobs: readonly RotaJob[], turns: readonly Turn[], match: Pick<RotaMatch, "home">, me: string | null, nameOf: (id: string) => string): TurnTile[] {
  const tiles: TurnTile[] = [];
  for (const job of jobs) {
    const t = turns.find((x) => x.job.id === job.id);
    if (t) {
      const w = turnWho(t, me, nameOf);
      tiles.push({ key: job.id, job: job.name, icon: ROTA_VICON[job.icon], mine: w.mine, off: false, who: w.who, sub: w.sub, playerId: t.playerId });
    } else if (!jobApplies(job, match)) {
      tiles.push({ key: job.id, job: job.name, icon: ROTA_VICON[job.icon], mine: false, off: true, who: "Nadie esta vez", sub: "Este partido es en casa", playerId: null });
    }
  }
  const i = tiles.findIndex((x) => x.mine);
  if (i > 0) tiles.unshift(...tiles.splice(i, 1));
  return tiles;
}

/** The matches of the wheel: `next` first, then the season's later ones to play (dated, not cancelled or postponed),
 *  by date then id, `cols` at most. */
export function ruedaMatches(next: RotaMatch, all: readonly RotaMatch[], now: number, cols: number): RotaMatch[] {
  if (next.date === null) return [next];
  const after = all
    .filter((m) => m.id !== next.id && m.date !== null && m.status !== "cancelled" && m.status !== "postponed" && !rotaPlayed(m, now))
    .filter((m) => !next.seasonId || !m.seasonId || m.seasonId === next.seasonId)
    .filter((m) => (m.date as number) > (next.date as number) || (m.date === next.date && m.id > next.id))
    .sort((a, b) => (a.date as number) - (b.date as number) || (a.id < b.id ? -1 : 1));
  return [next, ...after].slice(0, cols);
}

/**
 * Each wheel match with its turns: the first is `nextTurns` (the page's, with the match's answers), each later one
 * turnsFor over the season's history plus the ones before it as projected (their pins kept; `absences`: the ones
 * known today, which may cover their days).
 */
export function ruedaSchedule(
  matches: readonly RotaMatch[],
  nextTurns: readonly Turn[],
  all: readonly RotaMatch[],
  rota: Rota,
  docs: Readonly<Record<string, RotaTurnsDoc | undefined>>,
  absences: readonly RotaAbsence[],
  now: number,
): { m: RotaMatch; turns: readonly Turn[] }[] {
  if (!matches.length) return [];
  const history = rotaHistory(matches[0], all, docs, rota, now);
  return matches.map((m, i) => {
    const turns = i === 0 ? nextTurns : turnsFor(m, rota, history, [], absences, docs[m.id]);
    history.push({ id: m.id, turns: playedTurns(turns) });
    return { m, turns };
  });
}

/** A wheel match as a column head: «J4», «Pitutis», «fuera · 8 nov». */
export interface RuedaCol {
  id: string;
  j: string;
  rival: string;
  where: string;
  /** «J4 · en casa de Pitutis · dom 8 nov» (his turns' line). */
  line: string;
}
export interface RuedaCell {
  key: string;
  j: string;
  /** No turn of this job in that match (away-only, at home). */
  off: boolean;
  playerId: string | null;
  name: string;
  me: boolean;
  aria: string;
}

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const shortDay = (ms: number | null) => {
  if (ms === null) return "sin fecha";
  const d = madridDate(ms);
  const wd = DOW[new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))).getUTCDay()];
  return `${wd} ${Number(d.slice(8, 10))} ${MES[Number(d.slice(5, 7)) - 1]}`;
};

/** The wheel in rows (one per job of the rota) and its column heads; `info` names each match. */
export function ruedaRows(
  jobs: readonly RotaJob[],
  sched: readonly { m: RotaMatch; turns: readonly Turn[] }[],
  info: (id: string) => { j: string; rival: string },
  me: string | null,
  nameOf: (id: string) => string,
) {
  const cols: RuedaCol[] = sched.map(({ m }) => {
    const { j, rival } = info(m.id);
    const day = shortDay(m.date);
    return { id: m.id, j, rival, where: `${m.home === false ? "fuera" : "en casa"} · ${day.replace(/^\S+ /, "")}`, line: `${j} · ${m.home === false ? `en casa de ${rival}` : `${rival}, en casa`} · ${day}` };
  });
  const rows = jobs.map((job) => {
    const cells: RuedaCell[] = sched.map(({ m, turns }, i) => {
      const j = cols[i].j;
      if (!jobApplies(job, m)) return { key: m.id, j, off: true, playerId: null, name: "en casa", me: false, aria: `${j}: en casa, no hay` };
      const p = turns.find((t) => t.job.id === job.id)?.playerId ?? null;
      const mine = !!p && p === me;
      return { key: m.id, j, off: !p, playerId: p, name: !p ? "Nadie" : mine ? "Tú" : nameOf(p), me: mine, aria: `${j}: ${!p ? "nadie disponible" : mine ? "te toca a ti" : nameOf(p)}` };
    });
    return { key: job.id, job: job.name, icon: ROTA_VICON[job.icon], cells, aria: `${job.name}: ${cells.map((c) => c.aria).join(", ")}` };
  });
  // his turns to come, soonest first
  const mine = sched.flatMap(({ m, turns }, i) => turns.filter((t) => !!me && t.playerId === me).map((t) => ({ key: `${m.id}-${t.job.id}`, i, job: t.job.name, icon: ROTA_VICON[t.job.icon], line: cols[i].line })));
  return { cols, rows, mine };
}

/** «Ahora» / «En 2 jornadas» for one of his turns (the next match's, once played: «Hecho» / «Sin marcar»). */
export const mineWhen = (i: number, played: boolean, done: boolean): string => (i === 0 ? (played ? (done ? "Hecho" : "Sin marcar") : "Ahora") : `En ${i} ${i === 1 ? "jornada" : "jornadas"}`);

/** The match's state chip: «Aplazado» / «Cancelado», «Jugado», or how far it is («Hoy», «Mañana», «En 3 días»). */
export function matchChip(m: Pick<ClubMatch, "status" | "date">, now: number): { t: string; cls: "is-warn" | "is-ok" | "is-off" } {
  if (m.status === "postponed") return { t: "Aplazado", cls: "is-warn" };
  if (m.status === "cancelled") return { t: "Cancelado", cls: "is-warn" };
  if (turnPlayed(m, now)) return { t: "Jugado", cls: "is-ok" };
  const at = dateMillis(m.date);
  if (!Number.isFinite(at)) return { t: "Sin fecha", cls: "is-off" };
  const ms = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  const days = Math.round((ms(madridDate(at)) - ms(madridDate(now))) / 86_400_000);
  return { t: days <= 0 ? "Hoy" : days === 1 ? "Mañana" : `En ${days} días`, cls: "is-off" };
}

export type TurnosState = "nomatch" | "off" | "loading" | "error" | "norota" | "noturns" | "turns";

/** The head: the room's status in words in each state («Te toca: el agua», «Turnos de la J3: 4 trabajos»…). */
export function turnosHead(a: {
  state: TurnosState;
  /** «J3» ("" without a number). */
  j: string;
  rival: string;
  cancelled: boolean;
  cap: boolean;
  socio: boolean;
  myJob: string | null;
  played: boolean;
  done: boolean;
  /** «domingo 25 a las 14:00» ("" without a date). */
  when: string;
  home: boolean;
  jobs: number;
}): { title: string; sub: string } {
  const la = a.j ? `la ${a.j}` : "el partido";
  const turnosDe = a.j ? `Turnos de la ${a.j}` : "Turnos";
  switch (a.state) {
    case "error":
      return { title: turnosDe, sub: "No se han podido cargar los turnos." };
    case "loading":
      return { title: turnosDe, sub: "Cargando los turnos…" };
    case "nomatch":
      return { title: "Sin partido a la vista", sub: "Los turnos salen con el próximo partido." };
    case "off":
      return { title: "Sin turnos esta jornada", sub: `${a.j ? `La ${a.j}` : "El partido"} contra ${a.rival} está ${a.cancelled ? (a.j ? "cancelada" : "cancelado") : a.j ? "aplazada" : "aplazado"}.` };
    case "norota":
      return {
        title: "Sin turnos esta temporada",
        sub: a.cap ? "Crea los trabajos y el orden de la rueda: cada partido le toca a alguien distinto." : "Los reparten los capitanes. Cuando los creen, verás aquí qué te toca en cada partido.",
      };
    case "noturns":
      return { title: `${turnosDe}: ninguno`, sub: "Este partido no tiene turnos. Si hacen falta, los pone un capitán." };
    default:
      break;
  }
  if (a.myJob) {
    if (a.played) return { title: `${a.myJob}: ${a.done ? "hecho" : "¿hecho?"}`, sub: `${cap1(la)} ya se jugó. Marca tu turno como hecho para que el equipo lo vea.` };
    const vs = a.j ? `${a.j} contra ${a.rival}` : `Contra ${a.rival}`;
    return { title: `Te toca: ${lower1(a.myJob)}`, sub: `${vs}${a.home ? ", en casa" : ", fuera"}${a.when ? ` · ${a.when}` : ""}. Tú llevas ${lower1(a.myJob)}; los demás trabajos, al lado.` };
  }
  return {
    title: `${turnosDe}: ${a.jobs === 1 ? "1 trabajo" : `${a.jobs} trabajos`}`,
    sub: a.socio ? "Sin ficha no entras en la rueda. Vincula tu ficha y te tocará como a todos." : "Esta vez no te toca nada. Mira abajo cuándo te llega.",
  };
}
const cap1 = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
