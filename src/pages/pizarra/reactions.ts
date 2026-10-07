// Reactions to the official seven: each member says «¡Vamos!» (ok) or «Tengo dudas» (dudas) once,
// can change it or take it back. Stored at lineups/{id}/reactions/{uid}. Pure helpers (no React,
// no Firestore); unit-tested in reactions.test.ts. The hook lives in useReactions.ts.
import { REACTION_VALUES, type ReactionDoc, type ReactionValue } from "../../lib/schemas";

export type { ReactionValue };
export { REACTION_VALUES };

export interface ReactionTally {
  ok: number;
  dudas: number;
  total: number;
  /** What the signed-in member said, if anything. */
  mine: ReactionValue | null;
}

/** Counts per value plus the member's own (`uid` null = signed out). */
export function tallyReactions(docs: Pick<ReactionDoc, "id" | "value">[], uid: string | null): ReactionTally {
  const t: ReactionTally = { ok: 0, dudas: 0, total: 0, mine: null };
  for (const d of docs) {
    if (!REACTION_VALUES.includes(d.value)) continue;
    t[d.value]++;
    t.total++;
    if (uid && d.id === uid) t.mine = d.value;
  }
  return t;
}

/** Only members react, and only to an official board. */
export const canReact = (board: { isOfficial: boolean } | null | undefined, member: boolean, uid: string | null | undefined) =>
  !!board?.isOfficial && member && !!uid;

/** Tapping the value you already gave takes it back (null); otherwise it becomes your reaction. */
export const nextReaction = (mine: ReactionValue | null, tapped: ReactionValue): ReactionValue | null => (mine === tapped ? null : tapped);
