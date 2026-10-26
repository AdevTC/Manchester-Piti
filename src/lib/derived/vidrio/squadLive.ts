// «Vidrio» · the squad on match day (V-Vivo / V-Integracion, Plantilla's percha and the match page's pitch):
// for every player of the season, what tonight's match says about him — before the whistle «En el siete» /
// «Convocado» / «No juega hoy»; while it is played «En el campo», «En el campo desde el 30′», «En el
// banquillo», «Salió en el 30′»; after it «Jugó», «Logro «Debut»» once the acta is out, «MVP del partido»
// once the vote has closed — and the marks of the night (his goals, passes, cards, the change he came in with,
// a saved penalty). Only the plays that stand count (no pending duplicate). Pure: the page passes the match
// day (lib/derived/matchday) and who won the vote.
import type { ClubMatch, MatchEvent } from "../../clubData";
import type { MatchdayModel } from "../matchday";
import { eventMetaOf, settled } from "../../eventMeta";
import { eventSeconds } from "../../../../functions/src/matchAnalysis";
import { dateMillis, isVisibleMatch } from "../../../../functions/src/matchEngine";
import { lineupWalk, parseMatchLineup, type LineupSlot } from "../../matchLineup";
import { playerGame } from "../../clubAnalytics";
import { rotationOf } from "./rotation";
import { TonightWord } from "../madrid";

export type SquadStage = "pre" | "live" | "after";
/** on: in the seven / on the pitch / MVP (celeste dot) · bench: called up, left, played · off: not today (dimmed). */
export type SquadTone = "on" | "bench" | "off";

export interface LiveTag {
  kind: "gol" | "asis" | "amarilla" | "roja" | "cambio" | "parada" | "minutos";
  /** «21′» (a play's minute), «35 min» (his minutes on the pitch). */
  text: string;
  /** Our latest goal while the match is on (gold is only our goal). */
  gold: boolean;
  /** «Gol en el 21». */
  label: string;
}

export interface SquadLiveRow {
  status: string;
  tone: SquadTone;
  tags: LiveTag[];
}

export interface SquadLive {
  stage: SquadStage | null;
  /** Every player of `squad` with something to say (all of them when there is a stage). */
  rows: Map<string, SquadLiveRow>;
  /** The page's line under its title («Los 16 de la temporada. Ahora, siete en el campo.»). */
  lede: string;
  /** The phone's shorter one («Ahora, siete en el campo.»). */
  ledeShort: string;
  /** Who is on the pitch now (live), the seven (pre), who played (after). */
  onPitch: string[];
}

const NUM = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis"];
const word = (n: number) => NUM[n] ?? String(n);
const Word = (n: number) => {
  const w = word(n);
  return w.charAt(0).toLocaleUpperCase("es") + w.slice(1);
};
const minuteOf = (e: { elapsedSeconds?: number | null; minute?: number | null }) => Math.max(1, Math.ceil(eventSeconds({ elapsedSeconds: e.elapsedSeconds ?? undefined, minute: e.minute ?? undefined }) / 60));

/** The seven's slots: the published lineup's, else the convocatoria's titulares (keeper first) at no spot. */
export function sevenSlots(match: ClubMatch): LineupSlot[] {
  const lineup = parseMatchLineup((match as ClubMatch & { lineup?: unknown }).lineup);
  if (lineup) return lineup.slots;
  return (match.starters ?? []).slice(0, 7).map((id, i) => ({ playerId: id, code: i === 0 ? "POR" : "MC", x: 50, y: 50 }));
}

/** «Jugó 35 minutos» / «35 minutos jugados hasta ahora», as a chip «35 min». */
export function minutesTag(n: number, live: boolean): LiveTag {
  const words = `${n} ${n === 1 ? "minuto" : "minutos"}`;
  return { kind: "minutos", text: `${n} min`, gold: false, label: live ? `${words} ${n === 1 ? "jugado" : "jugados"} hasta ahora` : `Jugó ${words}` };
}

/** The marks of the night for each player (at most three each), from the plays that stand. With `minutes` (the
 *  match had changes: derived/vidrio/rotation) each player's minutes come first instead of a chip per change —
 *  F7's rolling changes would fill every column with arrows and push his goals out — then his first two marks. */
export function nightTags(events: readonly MatchEvent[], live: boolean, minutes?: ReadonlyMap<string, number> | null): Map<string, LiveTag[]> {
  const mins = minutes && minutes.size ? minutes : null;
  const cap = mins ? 2 : 3;
  const list = settled([...events]).sort((a, b) => eventSeconds(a) - eventSeconds(b));
  const goals = list.filter((e) => eventMetaOf(e).goal === "for");
  const lastGoal = live ? goals.at(-1)?.id : undefined;
  const out = new Map<string, LiveTag[]>();
  const add = (id: string | undefined, t: LiveTag) => {
    if (!id) return;
    const l = out.get(id) ?? [];
    if (l.length < cap) l.push(t);
    out.set(id, l);
  };
  for (const e of list) {
    const meta = eventMetaOf(e);
    const m = minuteOf(e);
    const text = `${m}′`;
    if (!mins && e.type === "substitution" && e.inPlayerId) add(e.inPlayerId, { kind: "cambio", text, gold: false, label: `Entró en el ${m}` });
    if (meta.goal === "for" && e.type !== "opponent_own_goal") {
      add(e.playerId, { kind: "gol", text, gold: e.id === lastGoal, label: `Gol en el ${m}` });
      add(e.assistPlayerId, { kind: "asis", text, gold: false, label: `Asistencia en el ${m}` });
    }
    if (meta.side === "us" && meta.card === "a") add(e.playerId, { kind: "amarilla", text, gold: false, label: `Amarilla en el ${m}` });
    if (meta.side === "us" && meta.card === "r") add(e.playerId, { kind: "roja", text, gold: false, label: `Roja en el ${m}` });
    if (e.type === "penalty_saved") add(e.playerId, { kind: "parada", text, gold: false, label: `Paró un penalti en el ${m}` });
  }
  if (mins) for (const [id, n] of mins) out.set(id, [minutesTag(n, live), ...(out.get(id) ?? [])]);
  return out;
}

const stageOf = (phase: MatchdayModel["phase"]): SquadStage | null => {
  if (phase === "antes" || phase === "pitido") return "pre";
  if (phase === "directo1" || phase === "descanso" || phase === "directo2") return "live";
  if (phase === "final" || phase === "acta" || phase === "despues") return "after";
  return null;
};

export interface SquadLiveInput {
  day: Pick<MatchdayModel, "phase" | "match" | "kickoff"> & Partial<Pick<MatchdayModel, "minute">>;
  /** The season's squad, page order. */
  squad: readonly string[];
  /** Every match (the debut: no earlier match played). */
  matches: readonly ClubMatch[];
  /** Who won the closed MVP vote of `day.match` (empty while open or without one). */
  mvp?: readonly string[];
}

/** The squad on match day; `stage: null` (and only the size in the lede) on any other day. */
export function squadLive({ day, squad, matches, mvp = [] }: SquadLiveInput): SquadLive {
  const n = squad.length;
  const base = `${n === 1 ? "El único" : `Los ${n}`} de la temporada.`;
  const match = day.match;
  const stage = match ? stageOf(day.phase) : null;
  const rows = new Map<string, SquadLiveRow>();
  const none: SquadLive = { stage: null, rows, lede: base, ledeShort: base, onPitch: [] };
  if (!match || !stage) return none;
  const slots = sevenSlots(match);
  const seven = slots.map((s) => s.playerId);
  const bench = (match.bench ?? []).filter((id) => !seven.includes(id));
  if (!seven.length) return none;
  const events = stage === "pre" ? [] : settled(match.events);
  // (with changes, each player's minutes instead of a chip per change: live, up to the minute being played)
  const rot = stage === "pre" ? null : rotationOf(match, events, (id) => id, stage === "live" ? (day.minute ?? Math.max(0, ...events.map((e) => minuteOf(e)))) : undefined);
  const tags = nightTags(events, stage === "live", rot?.changes ? rot.minutes : null);
  const walk = lineupWalk({ slots }, events);
  const entered = new Map<string, number>();
  const left = new Map<string, { m: number; red: boolean }>();
  for (const st of walk.steps) {
    // (a «Cambio de sitio» brings nobody on and takes nobody off)
    if (st.k === "swap") continue;
    const m = minuteOf(st.event);
    if (st.inId) entered.set(st.inId, m);
    left.set(st.outId, { m, red: st.k === "red" });
  }
  const tagsOf = (id: string) => tags.get(id) ?? [];

  if (stage === "pre") {
    for (const id of squad) {
      const inSeven = seven.includes(id);
      const called = bench.includes(id);
      rows.set(id, { status: inSeven ? "En el siete" : called ? "Convocado" : "No juega hoy", tone: inSeven ? "on" : called ? "bench" : "off", tags: [] });
    }
    const when = TonightWord(day.kickoff ?? dateMillis(match.date));
    const b = bench.length;
    const benchWords = b ? `${word(b)} en el banquillo` : "nadie en el banquillo";
    const line = `${when}, ${word(seven.length)} en el siete y ${benchWords}.`;
    return { stage, rows, lede: `${base} ${line}`, ledeShort: line, onPitch: seven };
  }

  if (stage === "live") {
    const on = walk.now.map((s) => s.playerId);
    for (const id of squad) {
      let row: SquadLiveRow;
      if (on.includes(id)) row = { status: entered.has(id) ? `En el campo desde el ${entered.get(id)}′` : "En el campo", tone: "on", tags: tagsOf(id) };
      else if (left.has(id)) row = { status: left.get(id)!.red ? `Expulsado en el ${left.get(id)!.m}′` : `Salió en el ${left.get(id)!.m}′`, tone: "bench", tags: tagsOf(id) };
      else if (bench.includes(id)) row = { status: "En el banquillo", tone: "bench", tags: tagsOf(id) };
      else row = { status: "No juega hoy", tone: "off", tags: [] };
      rows.set(id, row);
    }
    const line = `Ahora, ${word(on.length)} en el campo.`;
    return { stage, rows, lede: `${base} ${line}`, ledeShort: line, onPitch: on };
  }

  // after: who played (the acta's ledger once it is out, else the seven and who came in)
  const published = match.status === "finished";
  const playedIds = squad.filter((id) => (published && match.ledger ? playerGame(id, match).played : seven.includes(id) || entered.has(id)));
  const at = dateMillis(match.date);
  const earlier = matches.filter((m) => m.id !== match.id && isVisibleMatch(m) && m.status === "finished" && dateMillis(m.date) < at);
  const debut = (id: string) => published && !earlier.some((m) => playerGame(id, m).played);
  const firstOfSeason = !earlier.some((m) => m.seasonId === match.seasonId);
  for (const id of squad) {
    const played = playedIds.includes(id);
    let row: SquadLiveRow;
    if (mvp.includes(id)) row = { status: "MVP del partido", tone: "on", tags: tagsOf(id) };
    else if (played) row = { status: debut(id) ? "Logro «Debut»" : "Jugó", tone: "bench", tags: tagsOf(id) };
    else row = { status: "No jugó", tone: "off", tags: [] };
    rows.set(id, row);
  }
  const k = playedIds.length;
  const rival = match.rival ?? "el rival";
  const line = firstOfSeason ? `${Word(k)} ${k === 1 ? "jugó" : "jugaron"} el debut.` : `${Word(k)} ${k === 1 ? "jugó" : "jugaron"} contra ${rival}.`;
  return { stage, rows, lede: `${base} ${line}`, ledeShort: line, onPitch: playedIds };
}
