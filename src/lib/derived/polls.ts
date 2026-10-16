// «Encuestas del vestuario» (docs/superpowers/specs/2026-10-16-encuestas-design.md): what the vestuario
// reads, counts and writes, without Firebase. A member writes polls/{id} = pollFields(…) plus
// `createdAt: serverTimestamp()` and `closesAt` as a Timestamp (pages/vestuario/writes.createPoll); each
// member's vote is polls/{id}/votes/{uid} = voteFields(…) plus `at`. firestore.rules validates both shapes;
// the «3 abiertas por autor» limit lives only here (the rules can't count).

export const POLL_QUESTION_MAX = 120;
export const POLL_OPTION_MAX = 40;
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;
/** Open polls one author may have at a time (UI only). */
export const POLL_OPEN_PER_AUTHOR = 3;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** A closed poll stays in the vestuario this long after it closed. */
export const POLL_KEEP_MS = 7 * DAY;
/** What the rules accept for `closesAt - createdAt`. */
export const POLL_MIN_MS = HOUR;
export const POLL_MAX_MS = 14 * DAY;

export const POLL_DURATIONS = [
  { id: "1h", label: "1 hora", ms: HOUR },
  { id: "1d", label: "1 día", ms: DAY },
  { id: "3d", label: "3 días", ms: 3 * DAY },
  { id: "1w", label: "1 semana", ms: 7 * DAY },
] as const;
export type PollDurationId = (typeof POLL_DURATIONS)[number]["id"];
export const POLL_DEFAULT_DURATION: PollDurationId = "3d";
/** Margin added to `closesAt` so the rules' «at least 1 h after request.time» holds with the network's delay. */
export const POLL_CLOSE_MARGIN_MS = 60_000;

export interface PollOption {
  id: string;
  label: string;
}
export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  multi: boolean;
  authorUid: string;
  authorName: string;
  createdAt: number;
  closesAt: number;
  /** Closed early by the author or a captain (ms); null while it runs to `closesAt`. */
  closedAt: number | null;
}
export interface PollVote {
  uid: string;
  optionIds: string[];
  name: string;
  playerId: string | null;
}

/** Firestore Timestamp, Date or millis → ms (NaN for anything else). */
function toMs(v: unknown): number {
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  if (v && typeof v === "object" && "toMillis" in v && typeof (v as { toMillis: unknown }).toMillis === "function") return (v as { toMillis: () => number }).toMillis();
  return NaN;
}
const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * polls/{id} as read, or null when it isn't a poll. `now` stands in for a server timestamp still on its
 * way (this device's own write): a fresh poll sorts first, and a poll just closed reads closed at once.
 */
export function parsePoll(id: string, d: Record<string, unknown> | undefined, now: number): Poll | null {
  if (!d) return null;
  const options = Array.isArray(d.options)
    ? (d.options as unknown[]).flatMap((o) => {
        if (!o || typeof o !== "object") return [];
        const { id: oid, label } = o as { id?: unknown; label?: unknown };
        return typeof oid === "string" && typeof label === "string" ? [{ id: oid, label }] : [];
      })
    : [];
  const closesAt = toMs(d.closesAt);
  if (!str(d.question) || options.length < POLL_MIN_OPTIONS || !Number.isFinite(closesAt)) return null;
  const created = toMs(d.createdAt);
  const closed = "closedAt" in d ? toMs(d.closedAt) : NaN;
  return {
    id,
    question: str(d.question),
    options,
    multi: d.multi === true,
    authorUid: str(d.authorUid),
    authorName: str(d.authorName) || "Alguien",
    createdAt: Number.isFinite(created) ? created : now,
    closesAt,
    closedAt: Number.isFinite(closed) ? closed : "closedAt" in d && d.closedAt === null ? now : null,
  };
}

/** polls/{id}/votes/{uid} as read, or null without any option. */
export function parsePollVote(uid: string, d: Record<string, unknown> | undefined): PollVote | null {
  if (!d || !Array.isArray(d.optionIds)) return null;
  const optionIds = (d.optionIds as unknown[]).filter((x): x is string => typeof x === "string");
  if (!optionIds.length) return null;
  return { uid, optionIds, name: str(d.name) || "Miembro", playerId: typeof d.playerId === "string" && d.playerId ? d.playerId : null };
}

/** Open: not closed early, and `closesAt` still ahead. */
export const isPollOpen = (p: Pick<Poll, "closesAt" | "closedAt">, now: number) => p.closedAt === null && now < p.closesAt;
/** When it stopped taking votes (the earlier of the early close and `closesAt`). */
export const pollEndedAt = (p: Pick<Poll, "closesAt" | "closedAt">) => (p.closedAt === null ? p.closesAt : Math.min(p.closedAt, p.closesAt));
/** Still in the vestuario: open, or closed less than 7 days ago. */
export const isPollVisible = (p: Pick<Poll, "closesAt" | "closedAt">, now: number) => isPollOpen(p, now) || now - pollEndedAt(p) < POLL_KEEP_MS;

/** The vestuario's list: open polls first (newest first), then the closed ones of the last 7 days
 *  (the most recently closed first). */
export function visiblePolls(polls: readonly Poll[], now: number): Poll[] {
  const open = polls.filter((p) => isPollOpen(p, now)).sort((a, b) => b.createdAt - a.createdAt);
  const closed = polls.filter((p) => !isPollOpen(p, now) && isPollVisible(p, now)).sort((a, b) => pollEndedAt(b) - pollEndedAt(a));
  return [...open, ...closed];
}

/** How many polls this author has open now (the limit is POLL_OPEN_PER_AUTHOR). */
export const openPollsBy = (polls: readonly Poll[], uid: string, now: number) => polls.filter((p) => p.authorUid === uid && isPollOpen(p, now)).length;

/** The option ids a vote counts for: only the poll's, each once, and just the first when it isn't `multi`. */
export function validChoice(poll: Pick<Poll, "options" | "multi">, optionIds: readonly string[]): string[] {
  const known = new Set(poll.options.map((o) => o.id));
  const ids = [...new Set(optionIds.filter((id) => known.has(id)))];
  return poll.multi ? ids : ids.slice(0, 1);
}

export interface TallyRow extends PollOption {
  count: number;
  /** Share of the people who voted (0–100, rounded); with several answers they can add up to more. */
  pct: number;
}
export interface Tally {
  rows: TallyRow[];
  /** People who voted. */
  voters: number;
}
export function pollTally(poll: Pick<Poll, "options" | "multi">, votes: readonly Pick<PollVote, "optionIds">[]): Tally {
  const counts = new Map(poll.options.map((o) => [o.id, 0]));
  let voters = 0;
  for (const v of votes) {
    const ids = validChoice(poll, v.optionIds);
    if (!ids.length) continue;
    voters++;
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const rows = poll.options.map((o) => {
    const count = counts.get(o.id) ?? 0;
    return { ...o, count, pct: voters ? Math.round((count / voters) * 100) : 0 };
  });
  return { rows, voters };
}

export type Outcome = { kind: "none" } | { kind: "winner"; ids: [string] } | { kind: "tie"; ids: string[] };
/** The most voted option, the tie between several, or nothing when nobody voted. */
export function pollOutcome(tally: Tally): Outcome {
  const top = Math.max(0, ...tally.rows.map((r) => r.count));
  if (!top) return { kind: "none" };
  const ids = tally.rows.filter((r) => r.count === top).map((r) => r.id);
  return ids.length === 1 ? { kind: "winner", ids: [ids[0]] } : { kind: "tie", ids };
}

/** «a», «a y b», «a, b y c» («e» before an «i»/«hi» sound, as Spanish writes it). */
export function joinEs(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  const last = items[items.length - 1];
  const and = /^h?i(?![aeiouáéó])/i.test(last.trim()) ? " e " : " y ";
  return items.slice(0, -1).join(", ") + and + last;
}

/** «Gana X», «Empate entre X e Y» or «Nadie votó». */
export function outcomeText(poll: Pick<Poll, "options">, outcome: Outcome): string {
  const label = (id: string) => poll.options.find((o) => o.id === id)?.label ?? "";
  if (outcome.kind === "none") return "Nadie votó";
  if (outcome.kind === "winner") return `Gana ${label(outcome.ids[0])}`;
  return `Empate entre ${joinEs(outcome.ids.map(label))}`;
}

/** «Cierra en 2 días», «Cierra en 5 horas», «Cierra en 20 min» or «Cerrada». */
export function closesText(p: Pick<Poll, "closesAt" | "closedAt">, now: number): string {
  if (!isPollOpen(p, now)) return "Cerrada";
  const left = p.closesAt - now;
  if (left >= DAY) {
    const d = Math.round(left / DAY);
    return `Cierra en ${d === 1 ? "1 día" : `${d} días`}`;
  }
  if (left >= HOUR) {
    const h = Math.round(left / HOUR);
    return h >= 24 ? "Cierra en 1 día" : `Cierra en ${h === 1 ? "1 hora" : `${h} horas`}`;
  }
  return `Cierra en ${Math.max(1, Math.ceil(left / 60_000))} min`;
}

/** «Tú: X» (the labels you picked), or "" when you haven't voted. */
export function myChoiceText(poll: Pick<Poll, "options" | "multi">, vote: Pick<PollVote, "optionIds"> | undefined): string {
  if (!vote) return "";
  const ids = validChoice(poll, vote.optionIds);
  const labels = poll.options.filter((o) => ids.includes(o.id)).map((o) => o.label);
  return labels.length ? `Tú: ${joinEs(labels)}` : "";
}

// ── «Nueva encuesta» ──

export interface PollForm {
  question: string;
  /** As typed, blanks included: blank ones are left out. */
  options: readonly string[];
  multi: boolean;
  duration: PollDurationId;
}
const filled = (options: readonly string[]) => options.map((o) => o.trim()).filter(Boolean);

/** Why this poll can't be published (null = it can), in the words the member reads. `openMine`: polls the
 *  member already has open. */
export function pollFormProblem(form: PollForm, openMine: number): string | null {
  if (openMine >= POLL_OPEN_PER_AUTHOR) return `Ya tienes ${POLL_OPEN_PER_AUTHOR} encuestas abiertas. Cierra una para abrir otra.`;
  const q = form.question.trim();
  if (!q) return "Escribe la pregunta.";
  if (q.length > POLL_QUESTION_MAX) return `La pregunta, como mucho ${POLL_QUESTION_MAX} caracteres.`;
  const opts = filled(form.options);
  if (opts.length < POLL_MIN_OPTIONS) return `Pon al menos ${POLL_MIN_OPTIONS} opciones.`;
  if (opts.length > POLL_MAX_OPTIONS) return `Como mucho ${POLL_MAX_OPTIONS} opciones.`;
  if (opts.some((o) => o.length > POLL_OPTION_MAX)) return `Cada opción, como mucho ${POLL_OPTION_MAX} caracteres.`;
  if (new Set(opts.map((o) => o.toLocaleLowerCase("es"))).size !== opts.length) return "Hay dos opciones iguales.";
  if (!POLL_DURATIONS.some((d) => d.id === form.duration)) return "Elige cuándo se cierra.";
  return null;
}

export interface PollAuthor {
  uid: string;
  name: string;
}
/** The polls doc fields but createdAt (the server's time, added by the writer); `closesAt` in ms (the
 *  writer makes it a Timestamp). Options get the ids "o1".."o6" in order. */
export function pollFields(me: PollAuthor, form: PollForm, now: number) {
  const ms = POLL_DURATIONS.find((d) => d.id === form.duration)?.ms ?? 3 * DAY;
  return {
    question: form.question.trim(),
    options: filled(form.options).map((label, i) => ({ id: `o${i + 1}`, label })),
    multi: form.multi,
    authorUid: me.uid,
    authorName: me.name,
    closesAt: now + ms + POLL_CLOSE_MARGIN_MS,
  };
}

/** The votes doc fields but `at`: the valid ids (one unless `multi`), the member's name and ficha. */
export function voteFields(me: { name: string; playerId: string | null }, poll: Pick<Poll, "options" | "multi">, optionIds: readonly string[]) {
  return { optionIds: validChoice(poll, optionIds), name: me.name, playerId: me.playerId };
}

/** The author or a captain may close and delete it. */
export const canManagePoll = (p: Pick<Poll, "authorUid">, uid: string, admin: boolean) => admin || (!!uid && p.authorUid === uid);
