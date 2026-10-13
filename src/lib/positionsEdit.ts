// Pure helpers to edit, propose and review a player's positions (no Firebase here: the timestamp
// is passed in by the caller, who passes serverTimestamp()). Every payload satisfies firestore.rules
// (validPosSet / validProposal / validReview): main not in also, no repeats, ≤ MAX_ALSO, exact keys.
import { MAX_ALSO, lineOf, sanitizePositions, type Line, type PosCode, type PositionSet } from "./positions";

export type ReviewKind = "aprobada" | "ajustada" | "rechazada";
export type ProposalState = "ninguna" | "pendiente" | ReviewKind;

const REVIEW_KINDS: readonly string[] = ["aprobada", "ajustada", "rechazada"];
const EMPTY: PositionSet = { main: null, also: [] };

/** nada -> también -> preferida -> nada. One preferida only (the old one drops to también); when
 *  «también» is full a new one is refused: the very same set comes back (the UI says «Máximo 6»). */
export function cyclePosition(set: PositionSet, code: PosCode): PositionSet {
  if (set.main === code) return { main: null, also: [...set.also] };
  if (set.also.includes(code)) {
    const also = set.also.filter((c) => c !== code);
    if (set.main) also.push(set.main);
    return { main: code, also };
  }
  if (set.also.length >= MAX_ALSO) return set;
  return { main: set.main, also: [...set.also, code] };
}

/** What the admin writes into the ficha: `positions`, and `naturalPosition` (the line) only when there is a preferida. */
export function positionsPayload(set: PositionSet): { positions: PositionSet; naturalPosition?: Line } {
  const clean = sanitizePositions(set) ?? EMPTY;
  return clean.main ? { positions: clean, naturalPosition: lineOf(clean.main) } : { positions: clean };
}

/** A member's proposal (with the server timestamp) or its withdrawal. */
export function proposalPayload(
  set: PositionSet | null,
  ts: unknown,
): { positionsProposal: { main: PosCode | null; also: PosCode[]; at: unknown } | null } {
  if (!set) return { positionsProposal: null };
  const clean = sanitizePositions(set) ?? EMPTY;
  return { positionsProposal: { main: clean.main, also: clean.also, at: ts } };
}

export interface ReviewPayload {
  positions?: PositionSet;
  naturalPosition?: Line;
  positionsProposal: null;
  positionsReview: { status: ReviewKind; at: unknown; by: string };
}

/** The admin's verdict: approve/adjust write the (final) positions; reject only closes the proposal. */
export function reviewPayload(kind: ReviewKind, set: PositionSet | null, uid: string, ts: unknown): ReviewPayload {
  const review = { positionsProposal: null, positionsReview: { status: kind, at: ts, by: uid } } as const;
  if (kind === "rechazada") return { ...review };
  return { ...positionsPayload(set ?? EMPTY), ...review };
}

/** pendiente while a proposal object exists; else the last review's status; else ninguna. */
export function proposalState(doc: { positionsProposal?: unknown; positionsReview?: unknown }): ProposalState {
  const p = doc.positionsProposal;
  if (p && typeof p === "object" && !Array.isArray(p)) return "pendiente";
  const r = doc.positionsReview;
  if (r && typeof r === "object") {
    const status = (r as { status?: unknown }).status;
    if (typeof status === "string" && REVIEW_KINDS.includes(status)) return status as ReviewKind;
  }
  return "ninguna";
}

export interface ProposalDiff {
  added: PosCode[];
  removed: PosCode[];
  mainChange?: [PosCode | null, PosCode | null];
}

const codesOf = (s: PositionSet | null): PosCode[] => (s ? [...(s.main ? [s.main] : []), ...s.also] : []);

/** What a proposal changes against the current set. `added`/`removed` look at every code the player
 *  plays (preferida or también); `mainChange` only when the preferida itself differs. */
export function proposalDiff(current: PositionSet | null, proposal: PositionSet | null): ProposalDiff {
  const before = codesOf(current);
  const after = codesOf(proposal);
  const diff: ProposalDiff = {
    added: after.filter((c) => !before.includes(c)),
    removed: before.filter((c) => !after.includes(c)),
  };
  const from = current?.main ?? null;
  const to = proposal?.main ?? null;
  if (from !== to) diff.mainChange = [from, to];
  return diff;
}
