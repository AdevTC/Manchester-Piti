// Tras el partido: the members' reactions to each crónica moment and their 1–5 nota of the match.
// Pure: the windows (the same ones firestore.rules enforces: actaPublished() and ratingOpen()), the docs as
// they are read (matches/{id}/reactions/{uid}, matches/{id}/ratings/{uid}), what is shown from them (counts,
// «Hugo, Mario y 3 más», the average «4,2») and the exact fields each write sends.
import { isVisibleMatch } from "../../../functions/src/matchEngine";

export const REACTIONS = [
  { id: "fuego", emoji: "🔥", word: "Golazo" },
  { id: "aplauso", emoji: "👏", word: "Bien" },
  { id: "risa", emoji: "😂", word: "Risas" },
  { id: "uy", emoji: "😬", word: "Uy" },
] as const;
export type ReactionId = (typeof REACTIONS)[number]["id"];
const REACTION_IDS: readonly string[] = REACTIONS.map((r) => r.id);
export const isReactionId = (v: unknown): v is ReactionId => typeof v === "string" && REACTION_IDS.includes(v);

/** At most this many moments per member and match (rules: momentsOk). */
export const MAX_MOMENTS = 30;
/** A moment is an event id of the acta, or the final whistle's. Same format the rules check. */
export const MOMENT_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
export const FINAL_MOMENT = "final";

const HOUR = 3_600_000;
/** The MVP window saveMatchSheet stamps on the first publication: voteClosesAt = published + 48 h. */
export const MVP_WINDOW_MS = 48 * HOUR;
/** The nota stays open this long from the acta's publication. */
export const RATING_WINDOW_MS = 7 * 24 * HOUR;

type MatchLike = { status?: string; voteClosesAt?: number | null };

/** When the acta was published (ms), or null while there is none: a finished match carries its MVP window. */
export function actaPublishedAt(match: MatchLike): number | null {
  if (!isVisibleMatch(match) || match.status !== "finished" || typeof match.voteClosesAt !== "number") return null;
  return match.voteClosesAt - MVP_WINDOW_MS;
}

/** Reactions: from the acta's publication on, for good (rules: actaPublished). */
export const reactionsOpen = (match: MatchLike): boolean => actaPublishedAt(match) !== null;

export type RatingWindow = { state: "none" } | { state: "open"; closesAt: number } | { state: "closed"; closedAt: number };
/** The nota: «none» before the acta, «open» for 7 days from its publication, then «closed» (rules: ratingOpen). */
export function ratingWindow(match: MatchLike, now: number): RatingWindow {
  const at = actaPublishedAt(match);
  if (at === null) return { state: "none" };
  const end = at + RATING_WINDOW_MS;
  return now < end ? { state: "open", closesAt: end } : { state: "closed", closedAt: end };
}

// ---------- the docs, as read
export interface ReactionDoc {
  uid: string;
  name: string;
  playerId: string | null;
  moments: Record<string, ReactionId>;
}
export interface RatingDoc {
  uid: string;
  name: string;
  playerId: string | null;
  score: number;
}
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nameOf = (d: Record<string, unknown>) => (typeof d.name === "string" && d.name.trim() ? d.name : "Miembro");
const playerOf = (d: Record<string, unknown>) => (typeof d.playerId === "string" ? d.playerId : null);

/** A reactions doc; unknown reactions or malformed moment ids are dropped (never the whole doc). */
export function parseReactionDoc(uid: string, data: unknown): ReactionDoc | null {
  if (!isRecord(data) || !isRecord(data.moments)) return null;
  const moments: Record<string, ReactionId> = {};
  for (const [k, v] of Object.entries(data.moments)) if (MOMENT_ID_RE.test(k) && isReactionId(v)) moments[k] = v;
  return { uid, name: nameOf(data), playerId: playerOf(data), moments };
}
export function parseRatingDoc(uid: string, data: unknown): RatingDoc | null {
  if (!isRecord(data) || typeof data.score !== "number" || !Number.isInteger(data.score) || data.score < 1 || data.score > 5) return null;
  return { uid, name: nameOf(data), playerId: playerOf(data), score: data.score };
}

// ---------- what is shown
/** «Hugo», «Hugo y Mario», «Hugo, Mario y Raúl», «Hugo, Mario y 3 más». */
export function whoReacted(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= 3) return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  return `${names.slice(0, 2).join(", ")} y ${names.length - 2} más`;
}

export interface ReactionCount {
  id: ReactionId;
  emoji: string;
  word: string;
  count: number;
  /** Who, «Tú» first when it is mine, then by name. */
  names: string[];
  mine: boolean;
}
/** One moment's bar: each reaction with its count, who and whether it is mine (`uid`: the viewer, if a member). */
export function momentTally(docs: readonly ReactionDoc[], momentId: string, uid?: string | null): ReactionCount[] {
  return REACTIONS.map((r) => {
    const who = docs.filter((d) => d.moments[momentId] === r.id);
    const mine = !!uid && who.some((d) => d.uid === uid);
    const others = who.filter((d) => d.uid !== uid).map((d) => d.name).sort((a, b) => a.localeCompare(b, "es"));
    return { id: r.id, emoji: r.emoji, word: r.word, count: who.length, names: mine ? ["Tú", ...others] : others, mine };
  });
}

/** The moments a member reacts to after choosing `reaction` on `momentId` (the same one again takes it back). */
export function nextMoments(current: Readonly<Record<string, ReactionId>>, momentId: string, reaction: ReactionId): Record<string, ReactionId> {
  const next = { ...current };
  if (next[momentId] === reaction) delete next[momentId];
  else next[momentId] = reaction;
  return next;
}
/** A new moment once the member already reacts to MAX_MOMENTS would be refused. */
export const momentsFull = (current: Readonly<Record<string, ReactionId>>, momentId: string): boolean =>
  !(momentId in current) && Object.keys(current).length >= MAX_MOMENTS;

const ONE_DECIMAL = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** «4,2». */
export const formatNota = (n: number): string => ONE_DECIMAL.format(n);

export interface RatingSummary {
  count: number;
  /** null without votes. */
  average: number | null;
}
export function ratingSummary(docs: readonly RatingDoc[]): RatingSummary {
  if (!docs.length) return { count: 0, average: null };
  return { count: docs.length, average: docs.reduce((s, d) => s + d.score, 0) / docs.length };
}
export const votesText = (n: number): string => `${n} ${n === 1 ? "voto" : "votos"}`;
/** «Nota del vestuario: 4,2 · 11 votos», or "" without votes. */
export function notaLine(s: RatingSummary): string {
  return s.average === null ? "" : `Nota del vestuario: ${formatNota(s.average)} · ${votesText(s.count)}`;
}

// ---------- the writes (firestore.rules: exactly these keys, plus `at` = the server's time)
export interface Signer {
  name: string;
  playerId: string | null;
}
export const reactionFields = (me: Signer, moments: Record<string, ReactionId>) => ({ moments, name: me.name, playerId: me.playerId });
export const ratingFields = (me: Signer, score: number) => ({ score, name: me.name, playerId: me.playerId });
