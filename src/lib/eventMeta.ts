// One map of how every event type reads, wherever a play is shown: its label, its icon, whose play it is
// (us / them), the Directo filter it falls under (Goles · Ocasiones y palos · Faltas y tarjetas · Cambios ·
// otros), the broadcast strap's word, and the sentence that tells it («Gol de Mario», «Falta de Atlético»).
// The match page's Directo, the last-play lines (board, island, Hoy, vestuario) and the score all read it,
// so a new type (functions/src/matchEngine EVENT_LABELS) only has to be described here once.
import { EVENT_LABELS, eventMinute, type EventType, type MatchEvent } from "../../functions/src/matchEngine";
import { MESA_TYPES } from "../../functions/src/liveRules";

export type EventSide = "us" | "them";
export type EventGroup = "goles" | "ocasiones" | "faltas" | "cambios" | "otros";
/** The Directo icons (pages/match/PlayIcon draws them). Cards are not icons: `card` says which. */
export type EventGlyph = "ball" | "palo" | "ocasion" | "parada" | "faltaH" | "faltaR" | "cambio" | "corner" | "offside" | "penalti" | "tocado" | "accion";

export interface EventMeta {
  type: EventType;
  /** The type's own name (EVENT_LABELS): «Falta del rival», «Tocado». */
  label: string;
  /** Whose play it is: an analysis action of the rival (`team: "opponent"`) turns to «them» in eventMetaOf. */
  side: EventSide;
  group: EventGroup;
  glyph: EventGlyph;
  /** A card shows as a card, «A» or «R», never as an icon. */
  card: "a" | "r" | null;
  /** Whether it moves the score, and for whom: an own goal of ours counts for them, theirs for us. */
  goal: "for" | "against" | null;
  /** The broadcast strap's word: «GOL», «PALO», «FALTA». */
  tag: string;
}

type Def = Omit<EventMeta, "type" | "label" | "card" | "goal"> & Partial<Pick<EventMeta, "card" | "goal">>;
const us = (group: EventGroup, glyph: EventGlyph, tag: string, more: Partial<Def> = {}): Def => ({ side: "us", group, glyph, tag, ...more });
const them = (group: EventGroup, glyph: EventGlyph, tag: string, more: Partial<Def> = {}): Def => ({ side: "them", group, glyph, tag, ...more });
const action = (tag: string): Def => us("otros", "accion", tag);

const DEFS: Record<EventType, Def> = {
  // goals
  goal: us("goles", "ball", "GOL", { goal: "for" }),
  goal_penalty: us("goles", "ball", "GOL", { goal: "for" }),
  goal_freekick: us("goles", "ball", "GOL", { goal: "for" }),
  opponent_own_goal: them("goles", "ball", "AUTOGOL", { goal: "for" }),
  opponent_goal: them("goles", "ball", "GOL", { goal: "against" }),
  own_goal: us("goles", "ball", "EN PROPIA", { goal: "against" }),
  // chances, woodwork, saves and penalties that didn't go in
  chance: us("ocasiones", "ocasion", "OCASIÓN"),
  opponent_chance: them("ocasiones", "ocasion", "OCASIÓN"),
  woodwork: us("ocasiones", "palo", "PALO"),
  opponent_woodwork: them("ocasiones", "palo", "PALO"),
  save: us("ocasiones", "parada", "PARADA"),
  penalty_saved: us("ocasiones", "parada", "PARADA"),
  penalty_missed: us("ocasiones", "penalti", "PENALTI"),
  opponent_penalty_missed: them("ocasiones", "penalti", "PENALTI"),
  shot: us("ocasiones", "ocasion", "REMATE"),
  // fouls, cards and the penalties they give
  foul: us("faltas", "faltaH", "FALTA"),
  foul_received: us("faltas", "faltaR", "FALTA"),
  opponent_foul: them("faltas", "faltaH", "FALTA"),
  yellow_card: us("faltas", "faltaH", "AMARILLA", { card: "a" }),
  double_yellow: us("faltas", "faltaH", "ROJA", { card: "r" }),
  red_card: us("faltas", "faltaH", "ROJA", { card: "r" }),
  opponent_yellow: them("faltas", "faltaH", "AMARILLA", { card: "a" }),
  opponent_red: them("faltas", "faltaH", "ROJA", { card: "r" }),
  penalty_received: us("faltas", "penalti", "PENALTI"),
  penalty_committed: us("faltas", "penalti", "PENALTI"),
  // changes
  substitution: us("cambios", "cambio", "CAMBIO"),
  position_swap: us("cambios", "cambio", "SITIO"),
  // the rest
  corner: us("otros", "corner", "CÓRNER"),
  opponent_corner: them("otros", "corner", "CÓRNER"),
  opponent_offside: them("otros", "offside", "FUERA DE JUEGO"),
  injury: us("otros", "tocado", "TOCADO"),
  assist: us("otros", "accion", "ASISTENCIA"),
  match_played: us("otros", "accion", "JUGÓ"),
  // the narrated analysis actions (the acta's «Análisis»): never live, always «otros»
  pass: action("PASE"),
  cross: action("CENTRO"),
  dribble: action("REGATE"),
  tackle: action("ENTRADA"),
  interception: action("INTERCEPCIÓN"),
  recovery: action("RECUPERACIÓN"),
  possession_lost: action("PÉRDIDA"),
  clearance: action("DESPEJE"),
  block: action("BLOQUEO"),
  duel: action("DUELO"),
  aerial_duel: action("DUELO"),
  throw_in: action("BANDA"),
  goal_kick: action("SAQUE"),
  kickoff: action("SAQUE"),
  offside: us("otros", "offside", "FUERA DE JUEGO"),
  carry: action("CONDUCCIÓN"),
  touch: action("CONTROL"),
  possession: action("POSESIÓN"),
  other_action: action("JUGADA"),
};

const META = new Map<string, EventMeta>(
  (Object.keys(DEFS) as EventType[]).map((type) => [type, { type, label: EVENT_LABELS[type], card: null, goal: null, ...DEFS[type] }]),
);
const UNKNOWN: Omit<EventMeta, "type"> = { label: "Jugada", side: "us", group: "otros", glyph: "accion", card: null, goal: null, tag: "JUGADA" };

/** Every event type there is (the ones EVENT_LABELS names). */
export const EVENT_TYPES = [...META.keys()] as EventType[];

/** A type's meta; an unknown one (an older or newer app) reads as a plain «Jugada» of ours. */
export function eventMeta(type: string): EventMeta {
  return META.get(type) ?? { ...UNKNOWN, type: type as EventType };
}

/** An event's meta: an analysis action marked `team: "opponent"` is theirs. */
export function eventMetaOf(e: Pick<MatchEvent, "type" | "team">): EventMeta {
  const m = eventMeta(e.type);
  return e.team === "opponent" && m.side === "us" && !m.goal ? { ...m, side: "them" } : m;
}

/** The plays la mesa records live (functions/src/liveRules MESA_TYPES): the only ones a last-play line or
 *  the Directo shows (the narrated passes and tackles stay in Estadísticas). */
const LIVE = new Set<string>(MESA_TYPES);
export const isMesaType = (type: string): boolean => LIVE.has(type);

/** A possible duplicate still unresolved (another scorer, same play): shown and counted once, as the
 *  earlier one, until someone says «Son dos». The server counts the score the same way. */
export const isPendingDup = (e: Pick<MatchEvent, "dupOf" | "dupOk">): boolean => !!e.dupOf && e.dupOk !== true;

/** The events that stand: every one but the pending duplicates. */
export function settled<E extends Pick<MatchEvent, "dupOf" | "dupOk">>(events: readonly E[] | undefined): E[] {
  return (events ?? []).filter((e) => !isPendingDup(e));
}

/** The Directo filters, in order, with their names. */
export const EVENT_FILTERS: readonly { id: "all" | Exclude<EventGroup, "otros">; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "goles", label: "Goles" },
  { id: "ocasiones", label: "Ocasiones y palos" },
  { id: "faltas", label: "Faltas y tarjetas" },
  { id: "cambios", label: "Cambios" },
];
export type EventFilter = (typeof EVENT_FILTERS)[number]["id"];

/** The rival's name in a sentence: its first word when that says enough («Atlético Demo» → «Atlético»),
 *  the whole name otherwise («CD Ejemplo»). Goals use the whole name. */
export function rivalShortName(rival: string): string {
  const words = rival.trim().split(/\s+/);
  return words.length > 1 && words[0].length >= 4 ? words[0] : rival.trim();
}

/** The rival's three-letter code on the scoreboard and its tags: `override` (the match's own), or the first
 *  3 letters of its main word, uppercase («Atlético Demo» → ATL, «CD Ejemplo» → EJE). */
export function rivalCode(rival: string, override?: string | null): string {
  if (override?.trim()) return override.trim().toLocaleUpperCase("es").slice(0, 4);
  const words = rival.trim().split(/\s+/).filter(Boolean);
  const main = words.find((w) => w.length >= 3 && !/^(c\.?d\.?|c\.?f\.?|u\.?d\.?|s\.?d\.?|a\.?d\.?|club|real|deportivo|atl\.?)$/i.test(w)) ?? words[0] ?? "RIV";
  const plain = main.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "");
  return (plain.slice(0, 3) || "RIV").toLocaleUpperCase("es");
}

export interface SentenceContext {
  /** Names one of ours (a guest as «Rafa (invitado)»). */
  nameOf: (id: string) => string;
  rival: string;
}

export interface EventSentence {
  /** «Gol de Mario», «Falta de Atlético», «Entra Hugo, sale Pablo». */
  title: string;
  /** The detail under it: the assist, the note, or what is still to be filled in; "" when nothing. */
  sub: string;
  /** Ours it names, in order (the page links them). */
  people: string[];
}

/**
 * How a play is told, as one title and one detail line. Ours by name, theirs by the rival's name; a goal
 * without a scorer («Lo apunto luego») says so. Every EventType has its sentence.
 */
export function eventSentence(e: Pick<MatchEvent, "type" | "playerId" | "assistPlayerId" | "inPlayerId" | "note" | "team">, { nameOf, rival }: SentenceContext): EventSentence {
  const meta = eventMetaOf(e);
  const p = e.playerId ? nameOf(e.playerId) : "";
  const short = rivalShortName(rival);
  const people = [e.playerId, e.inPlayerId, e.assistPlayerId].filter((id): id is string => !!id);
  const note = e.note?.trim() ?? "";
  const say = (title: string, sub = note): EventSentence => ({ title, sub, people });
  const of = (what: string, fallback: string) => (p ? `${what} de ${p}` : fallback);
  switch (e.type) {
    case "goal":
    case "goal_penalty":
    case "goal_freekick": {
      const how = e.type === "goal_penalty" ? ", de penalti" : e.type === "goal_freekick" ? ", de falta" : "";
      const assist = e.assistPlayerId ? `Asistencia de ${nameOf(e.assistPlayerId)}` : "";
      if (!p) return say(`Gol del Piti${how}`, assist || note || "Goleador por confirmar");
      return say(`Gol de ${p}${how}`, assist || note);
    }
    case "opponent_own_goal":
      return say(`Autogol de ${rival}`, note || "Cuenta para el Piti");
    case "opponent_goal":
      return say(`Gol de ${rival}`);
    case "own_goal":
      return say(p ? `Gol en propia de ${p}` : "Gol en propia", note || `Cuenta para ${short}`);
    case "chance":
      return say(of("Ocasión", "Ocasión del Piti"));
    case "opponent_chance":
      return say(`Ocasión de ${short}`);
    case "woodwork":
      return say(p ? `Al palo, ${p}` : "Al palo, el Piti");
    case "opponent_woodwork":
      return say(`Al palo, ${short}`);
    case "save":
      return say(of("Parada", "Parada del Piti"));
    case "penalty_saved":
      return say(p ? `Penalti parado por ${p}` : "Penalti parado", note || `Lo tiraba ${short}`);
    case "penalty_missed":
      return say(p ? `Penalti fallado por ${p}` : "Penalti fallado");
    case "opponent_penalty_missed":
      return say(`Penalti fallado por ${short}`);
    case "foul":
      return say(of("Falta", "Falta del Piti"));
    case "foul_received":
      return say(p ? `Le hacen falta a ${p}` : `Falta de ${short}`);
    case "opponent_foul":
      return say(`Falta de ${short}`);
    case "yellow_card":
      return say(p ? `Amarilla a ${p}` : "Amarilla");
    case "double_yellow":
      return say(p ? `Roja a ${p}` : "Segunda amarilla", note || "Segunda amarilla");
    case "red_card":
      return say(p ? `Roja a ${p}` : "Roja directa", note || "Roja directa");
    case "opponent_yellow":
      return say(`Amarilla a ${short}`);
    case "opponent_red":
      return say(`Roja a ${short}`);
    case "penalty_received":
      return say("Penalti a favor", note || (p ? `Sobre ${p}` : ""));
    case "penalty_committed":
      return say(`Penalti para ${short}`, note || (p ? `Lo comete ${p}` : ""));
    case "substitution": {
      const inn = e.inPlayerId ? nameOf(e.inPlayerId) : "";
      if (inn && p) return say(`Entra ${inn}, sale ${p}`);
      return say(inn ? `Entra ${inn}` : p ? `Sale ${p}` : "Cambio");
    }
    case "position_swap": {
      const other = e.inPlayerId ? nameOf(e.inPlayerId) : "";
      return say(p && other ? `${p} y ${other} se cambian el sitio` : "Cambio de sitio");
    }
    case "corner":
      return say("Córner para el Piti", note || (p ? `Lo saca ${p}` : ""));
    case "opponent_corner":
      return say(`Córner para ${short}`);
    case "opponent_offside":
      return say(`Fuera de juego de ${short}`);
    case "injury":
      return say(p ? `${p}, tocado` : "Un jugador tocado", note || "Sigue en el campo");
    case "assist":
      return say(of("Asistencia", "Asistencia"));
    case "match_played":
      return say(of("Jugó", "Participación"));
    default:
      // the narrated actions and anything unknown: «Pase de Mario», «Despeje de Atlético»
      return say(meta.side === "them" ? `${meta.label} de ${short}` : p ? `${meta.label} de ${p}` : meta.label);
  }
}

const ORDINAL = ["", "El primero suyo hoy", "El segundo suyo hoy", "¡Hat-trick!"];
/** For a goal of ours with a scorer and nothing else to say: which of his it is today, «El segundo suyo
 *  hoy» (counting the plays that stand, by time of play); "" otherwise. */
export function goalOrdinal(events: readonly MatchEvent[] | undefined, e: MatchEvent): string {
  if (!e.playerId || eventMeta(e.type).goal !== "for" || e.type === "opponent_own_goal") return "";
  const secs = (x: MatchEvent) => x.elapsedSeconds ?? (x.minute ?? 0) * 60;
  const mine = settled(events).filter((x) => x.playerId === e.playerId && eventMeta(x.type).goal === "for" && x.type !== "opponent_own_goal");
  const n = mine.filter((x) => secs(x) < secs(e) || x.id === e.id).length;
  return ORDINAL[n] ?? `Su ${n}.º gol hoy`;
}

/** A play's minute to show, «19′», or "" when it has none. */
export function minuteText(e: Pick<MatchEvent, "minute" | "elapsedSeconds">): string {
  const m = eventMinute(e);
  return m === null ? "" : `${m}′`;
}
