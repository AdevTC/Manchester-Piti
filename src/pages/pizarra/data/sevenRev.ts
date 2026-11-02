// r14 · las reacciones vuelven a empezar si cambia el siete (PZ-D01). The server stamps an official board with
// `sevenRev` (the seven's version: it moves on each publication and each change of who plays) and deletes the
// reactions to an older version; each reaction carries `rev`, the version it answers (the rules accept only the
// current one). A reaction without `rev` (an older client) is version 0. Pure.
import { z } from "zod";
import { REACTION_VALUES, type ReactionValue } from "../../../lib/schemas";
import { reportDroppedDoc } from "../../../lib/docTelemetry";

export interface ReactionR14 {
  id: string;
  value: ReactionValue;
  /** The seven's version it answers (0 = before r14). */
  rev: number;
  at: number | null;
}

const schema = z.object({ value: z.enum(REACTION_VALUES), rev: z.number().int().min(0).optional() });
const millis = (v: unknown): number | null =>
  typeof v === "number" ? v : v && typeof v === "object" && typeof (v as { toMillis?: unknown }).toMillis === "function" ? (v as { toMillis(): number }).toMillis() : null;

/** lineups/{id}/reactions/{uid} (the doc id is the member's uid), or null (reported). */
export function mapReactionR14(id: string, data: unknown): ReactionR14 | null {
  const r = schema.safeParse(data);
  if (!r.success) {
    reportDroppedDoc("lineups.reactions", id, r.error.issues);
    return null;
  }
  return { id, value: r.data.value, rev: r.data.rev ?? 0, at: millis((data as { at?: unknown }).at) };
}

/** Only the reactions to the board's current seven count. */
export const currentReactions = <T extends { rev: number }>(docs: readonly T[], sevenRev: number): T[] => docs.filter((d) => d.rev === sevenRev);

/** The doc a member writes to react (its `at` is the server's time; `rev` the board's current `sevenRev`). */
export const reactionWrite = (value: ReactionValue, sevenRev: number, at: unknown): { value: ReactionValue; rev: number; at: unknown } => ({ value, rev: sevenRev, at });
