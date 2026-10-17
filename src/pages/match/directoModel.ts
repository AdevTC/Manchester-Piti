// The match page's live pieces, pure: the Directo's plays (filtered, split by half, latest first), the
// last-play strap, the pulse track's ticks and «Quién suma». Everything reads the plays that stand
// (eventMeta settled: a pending duplicate shows once) and tells them with eventMeta.
import { clockReading } from "../../../functions/src/matchClock";
import { eventSeconds } from "../../../functions/src/matchAnalysis";
import type { ClubMatch } from "../../lib/clubData";
import { EVENT_FILTERS, eventMetaOf, eventSentence, isMesaType, minuteText, rivalCode, settled, type EventFilter, type EventMeta } from "../../lib/eventMeta";
import { liveCounts, type LiveCounts } from "../../lib/ficha";
import type { MatchEvent } from "../../../functions/src/matchEngine";

export interface FeedItem {
  id: string;
  minute: string;
  seconds: number;
  half: 1 | 2;
  title: string;
  sub: string;
  people: string[];
  meta: EventMeta;
  /** «gol» (ours, gold), «them» (the rival's, coral) or «» (ours). */
  tone: "gol" | "them" | "";
}

type FeedMatch = Pick<ClubMatch, "events" | "duration" | "rival" | "clock">;

const halfLength = (m: Pick<ClubMatch, "duration">) => ((m.duration ?? 50) * 60) / 2;
/** Which half a play belongs to: its own `period`, or (old plays) by its time against half the duration. */
export const halfOf = (e: Pick<MatchEvent, "period" | "elapsedSeconds" | "minute">, m: Pick<ClubMatch, "duration">): 1 | 2 => e.period ?? (eventSeconds(e) >= halfLength(m) ? 2 : 1);

/** Every play of the match as the Directo tells it, latest first. Only la mesa's plays with a time (never a
 *  narrated pass, an «assist» row or a participation). */
export function feedOf(m: FeedMatch, nameOf: (id: string) => string): FeedItem[] {
  const rival = m.rival ?? "Rival";
  return settled(m.events)
    .map((e, order) => ({ e, order }))
    .filter(({ e }) => isMesaType(e.type) && (typeof e.minute === "number" || typeof e.elapsedSeconds === "number"))
    .sort((a, b) => eventSeconds(b.e) - eventSeconds(a.e) || b.order - a.order)
    .map(({ e }) => {
      const meta = eventMetaOf(e);
      const said = eventSentence(e, { nameOf, rival });
      const tone = meta.goal === "for" ? "gol" : meta.side === "them" || meta.goal === "against" ? "them" : "";
      return { id: e.id, minute: minuteText(e), seconds: eventSeconds(e), half: halfOf(e, m), title: said.title, sub: said.sub, people: said.people, meta, tone } as FeedItem;
    });
}

/** How many plays each filter shows. */
export function filterCounts(items: readonly FeedItem[]): Record<EventFilter, number> {
  const out = Object.fromEntries(EVENT_FILTERS.map((f) => [f.id, 0])) as Record<EventFilter, number>;
  for (const it of items) {
    out.all++;
    if (it.meta.group !== "otros") out[it.meta.group]++;
  }
  return out;
}

export const inFilter = (it: FeedItem, filter: EventFilter) => filter === "all" || it.meta.group === filter;

export interface FeedHalf {
  half: 1 | 2;
  label: string;
  meta: string;
  items: FeedItem[];
}

/** The plays of `filter` split by half, the latest half first. `current`: the half being played (its line
 *  says «en juego»), null once it's over or without a live clock. */
export function halvesOf(items: readonly FeedItem[], filter: EventFilter, current: 1 | 2 | null): FeedHalf[] {
  const out: FeedHalf[] = [];
  for (const half of [2, 1] as const) {
    const all = items.filter((it) => it.half === half);
    if (!all.length && half !== current) continue;
    const shown = all.filter((it) => inFilter(it, filter));
    const n = (k: number) => `${k} ${k === 1 ? "jugada" : "jugadas"}`;
    const meta = filter === "all" ? (half === current ? `en juego, ${n(all.length)}` : n(all.length)) : `${shown.length} de ${n(all.length)}`;
    out.push({ half, label: half === 1 ? "1ª parte" : "2ª parte", meta, items: shown });
  }
  return out;
}

/** The half being played now (live clock), or null. */
export function currentHalf(m: Pick<ClubMatch, "clock">, now: number): 1 | 2 | null {
  if (!m.clock || !["first", "second"].includes(m.clock.phase)) return null;
  return clockReading(m.clock, now).period;
}

/** «hace 5 s», «hace 3 min»: how long ago in play the play was, from the live clock; "" without one. */
export function agoText(m: Pick<ClubMatch, "clock">, e: Pick<MatchEvent, "elapsedSeconds"> | undefined, now: number): string {
  if (!m.clock || !e || typeof e.elapsedSeconds !== "number") return "";
  const s = Math.max(0, Math.floor(clockReading(m.clock, now).elapsedSeconds - e.elapsedSeconds));
  return s < 60 ? `hace ${s} s` : `hace ${Math.floor(s / 60)} min`;
}

/** The rival's three letters on its rows. */
export const rivalTag = (m: Pick<ClubMatch, "rival">) => rivalCode(m.rival ?? "Rival");

const TICK: Partial<Record<string, number>> = {
  goal: 46, goal_penalty: 46, goal_freekick: 46, opponent_goal: 46, opponent_own_goal: 46, own_goal: 46,
  woodwork: 34, opponent_woodwork: 34, chance: 28, opponent_chance: 28, save: 22, penalty_saved: 26,
  penalty_missed: 26, opponent_penalty_missed: 26, penalty_received: 24, penalty_committed: 24,
  yellow_card: 18, opponent_yellow: 18, double_yellow: 26, red_card: 26, opponent_red: 26,
  corner: 14, opponent_corner: 14, substitution: 10, injury: 10, opponent_offside: 10,
};
export interface PulseTick {
  id: string;
  /** % of the match. */
  x: number;
  /** px of the bar. */
  h: number;
  side: "us" | "them";
  goal: boolean;
}
/** The pulse track: one tick per play (up = Piti, down = rival; a foul they suffer is the rival's), a ball
 *  on each goal, and the axis labels. */
export function pulseTrack(items: readonly FeedItem[], duration: number) {
  const total = Math.max(1, duration * 60);
  const ticks: PulseTick[] = [...items].reverse().map((it) => {
    const side = it.meta.type === "foul_received" ? "them" : it.meta.goal === "for" ? "us" : it.meta.goal === "against" ? "them" : it.meta.side;
    return { id: it.id, x: Math.min(100, Math.round((it.seconds / total) * 1000) / 10), h: TICK[it.meta.type] ?? 12, side, goal: !!it.meta.goal };
  });
  const step = duration <= 30 ? 5 : 10;
  const labels: number[] = [];
  for (let m = 0; m <= duration; m += step) labels.push(m);
  if (labels.at(-1) !== duration) labels.push(duration);
  return { ticks, labels };
}

/** «2 goles, 1 asistencia y 1 palo»: what one of ours has added so far (empty when nothing). */
export function sumLine(id: string, events: MatchEvent[] | undefined): string {
  const c = liveCounts(id, events);
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => n > 0 && parts.push(`${n} ${n === 1 ? one : many}`);
  add(c.goals, "gol", "goles");
  add(c.assists, "asistencia", "asistencias");
  add(c.chances, "ocasión", "ocasiones");
  add(c.woodwork, "palo", "palos");
  add(c.saves, "parada", "paradas");
  add(c.fouls, "falta hecha", "faltas hechas");
  add(c.foulsReceived, "falta recibida", "faltas recibidas");
  if (c.yellow) parts.push(c.yellow === 1 ? "una amarilla" : `${c.yellow} amarillas`);
  if (c.red) parts.push("una roja");
  if (c.injured) parts.push("tocado");
  const line = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}` : (parts[0] ?? "");
  return line ? line.charAt(0).toLocaleUpperCase("es") + line.slice(1) : "";
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** «2 goles, 3 paradas, amonestado, tocado»: the stickers in words. */
export function stickerWords(c: LiveCounts): string {
  return [c.goals ? plural(c.goals, "gol", "goles") : "", c.saves ? plural(c.saves, "parada", "paradas") : "", c.red ? "expulsado" : c.yellow ? "amonestado" : "", c.injured ? "tocado" : ""].filter(Boolean).join(", ");
}
