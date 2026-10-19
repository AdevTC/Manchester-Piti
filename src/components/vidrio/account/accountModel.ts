// «Tú» from the avatar (V-Integracion «El club y la cuenta», «La cuenta en el móvil»), pure: the words of the
// head and of each row for a jugador, from the club's public data and his own documents. The hook (useAccount)
// reads; the sheet (AccountSheet) draws.
import type { ClubMatch } from "../../../lib/clubData";
import { OURS, scoreOf } from "../../../lib/partidos";
import { dateMillis, isVisibleMatch, matchPhase } from "../../../../functions/src/matchEngine";
import { lineupNow, parseMatchLineup } from "../../../lib/matchLineup";
import { settled } from "../../../lib/eventMeta";
import { positionLabel, resolvePositions, type PosCode } from "../../../lib/positions";
import { madridDate, madridTime } from "../../../lib/derived/madrid";

const WEEKDAY_DAY = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric" });

/** «J2» — the match's place in its season (visible matches by date), or null. */
export function jornadaOf(matches: readonly ClubMatch[], m: ClubMatch): number | null {
  const season = matches.filter((x) => isVisibleMatch(x) && x.seasonId === m.seasonId).sort((a, b) => dateMillis(a.date) - dateMillis(b.date));
  const i = season.findIndex((x) => x.id === m.id);
  return i < 0 ? null : i + 1;
}

/** «28, lateral derecho y capitán» (what is known of it). */
export function headLine(player: { number?: number; positions?: unknown; naturalPosition?: unknown } | null | undefined, captain: boolean, tonight?: PosCode | null): string {
  if (!player) return captain ? "Capitán" : "";
  const main = tonight ?? resolvePositions(player).main;
  const parts = [player.number ? String(player.number) : "", main ? positionLabel(main, "name").toLocaleLowerCase("es") : ""].filter(Boolean);
  const head = parts.join(", ");
  return captain ? (head ? `${head} y capitán` : "Capitán") : head;
}

/** «¿Vas el domingo 25 a Pitutis?» */
export function rsvpQuestion(m: ClubMatch): string {
  const at = dateMillis(m.date);
  const when = Number.isFinite(at) ? `el ${WEEKDAY_DAY.format(at)} ` : "";
  return `¿Vas ${when}a ${m.rival?.trim() || "el partido"}?`;
}

/** «J2 a las 14:00. Contestan 4 de 16.» */
export function rsvpSub(j: number | null, m: ClubMatch, answered: number, squad: number): string {
  const at = dateMillis(m.date);
  const time = Number.isFinite(at) ? `a las ${madridTime(at)}` : "";
  const head = [j ? `J${j}` : "", time].filter(Boolean).join(" ");
  const count = squad > 0 ? `Contestan ${answered} de ${squad}.` : "";
  return [head ? `${head}.` : "", count].filter(Boolean).join(" ");
}

/** The match of tonight for «Esta noche»: one being played, else today's (Madrid), else none. */
export function tonightMatch(matches: readonly ClubMatch[], now: number): ClubMatch | null {
  const today = madridDate(now);
  const visible = matches.filter(isVisibleMatch);
  const live = visible.find((m) => matchPhase(m, now) === "playing");
  if (live) return live;
  return visible.filter((m) => madridDate(dateMillis(m.date)) === today).sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0] ?? null;
}

/** «Esta noche»'s line for the jugador `me`. */
export function tonightLine(m: ClubMatch, me: string, now: number, captain: boolean): string | null {
  const phase = matchPhase(m, now);
  const lineup = parseMatchLineup((m as { lineup?: unknown }).lineup);
  const slots = lineup?.slots ?? (m.starters ?? []).map((playerId) => ({ playerId, code: "MC" as PosCode, x: 50, y: 50 }));
  const mine = slots.find((s) => s.playerId === me);
  const bench = (m.bench ?? []).includes(me);
  const events = m.events ?? [];
  if (phase === "scheduled") {
    if (mine) {
      const where = lineup ? `Juegas de ${positionLabel(mine.code, "name").toLocaleLowerCase("es")}` : "Estás en el siete";
      return `${where}${captain ? " y llevas el brazalete" : ""}.`;
    }
    if (bench) return "Empiezas en el banquillo.";
    return slots.length ? "Esta vez no estás en el siete." : null;
  }
  const { gf, ga } = scoreOf(m);
  const goals = events.filter((e) => OURS.has(e.type) && e.playerId === me).length;
  const passes = events.filter((e) => OURS.has(e.type) && e.assistPlayerId === me).length;
  const mark = goals ? (goals === 1 ? "Llevas un gol." : `Llevas ${goals} goles.`) : passes ? `El ${gf}–${ga} lleva tu pase.` : "";
  if (phase === "playing") {
    const field = lineupNow({ slots }, settled(events)).some((s) => s.playerId === me);
    const played = !!mine || events.some((e) => e.type === "substitution" && e.inPlayerId === me);
    if (field) return ["Estás en el campo.", mark].filter(Boolean).join(" ");
    if (played) return ["Ya has jugado.", mark].filter(Boolean).join(" ");
    return bench ? "Estás en el banquillo." : "Hoy lo ves desde fuera.";
  }
  const ledger = (m as { ledger?: Record<string, unknown> }).ledger;
  const playedIt = !!mine || (!!ledger && me in ledger);
  if (!playedIt) return m.status === "finished" ? "Ya está el acta del partido." : null;
  return [`Jugaste el ${gf}–${ga}.`, mark || (m.status === "finished" ? "Ya está el acta." : "La nota llega con el acta.")].join(" ");
}

/** «Tu porra: 3–1. Si acaba así, la clavas.» while the match runs; «Tu porra: 3–1.» before. */
export function porraLine(p: { gf: number; ga: number } | null, m: ClubMatch | null, now: number): string {
  if (!p) return "Aún no has hecho tu porra.";
  const base = `Tu porra: ${p.gf}–${p.ga}.`;
  if (!m) return base;
  const phase = matchPhase(m, now);
  if (phase === "scheduled") return base;
  const { gf, ga } = scoreOf(m);
  const exact = gf === p.gf && ga === p.ga;
  if (phase === "playing") return `${base} Si acaba así, ${exact ? "la clavas" : "no aciertas"}.`;
  return `${base} ${exact ? "La clavaste." : "Esta vez no."}`;
}
