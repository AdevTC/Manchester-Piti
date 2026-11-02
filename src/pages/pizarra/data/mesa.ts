// r14 · lo que la mesa lee de la pizarra (PZ-D07, PZ-D10, PZ-B-PAR-01 + the 2ª parte at half-time). «Mandar a la mesa»
// (setMatchLineup) copies onto the match's official board the seven, the cambios, the galones and lanzadores, the
// «2ª parte» / «Plan B» versions and the «Si pasa…» rules; la mesa reads that official board (its id:
// matches/{id}.lineup.boardId, or useMatchBoard) during the match. Typed reader + pure helpers; the mesa's UI is
// PARTIDO's. Team-member reads (la mesa's scorers are members).
import type { DocumentData } from "firebase/firestore";
import { useLiveDoc } from "../../vestuario/live";
import { lineupWalk, type LineupEvent, type LineupSlot, type MatchLineup } from "../../../lib/matchLineup";
import { dataToLineupDoc } from "../lineupDoc";
import type { LineupVariant, Takers } from "../formations";
import { liveRules, VER_VARIANT, type CondRuleR14, type CondVer, type LiveRule } from "./condPlan";

export interface MesaPlan {
  boardId: string;
  /** The «Si pasa…» rules (la mesa shows the ones that hold: liveRules). */
  condPlan: CondRuleR14[];
  /** Lanzadores in order (the first on the pitch takes it). */
  takers: Takers;
  captainId: string | null;
  viceId: string | null;
  /** «2ª parte» (v2) and «Plan B» (vb), when the board has them. */
  segunda: LineupVariant | null;
  planb: LineupVariant | null;
}

/** The official board's doc → what la mesa needs (null: no doc). */
export function mesaPlanOf(boardId: string, d: DocumentData | undefined): MesaPlan | null {
  if (!d) return null;
  // (the same lenient read as the pizarra's: a broken field is repaired, never the whole plan)
  const b = dataToLineupDoc(boardId, d);
  const variants = b.variants ?? [];
  return {
    boardId,
    condPlan: b.condPlan ?? [],
    takers: b.takers ?? { penalties: [], freekicks: [], corners: [] },
    captainId: b.roles.captainId ?? null,
    viceId: b.roles.viceId ?? null,
    segunda: variants.find((v) => v.id === "v2") ?? null,
    planb: variants.find((v) => v.id === "vb") ?? null,
  };
}

/** La mesa's live read of the official board (`boardId` null: nothing is read). */
export function useMesaPlan(boardId: string | null): MesaPlan | null {
  const live = useLiveDoc(boardId ? `lineups/${boardId}` : null, "mesaPlan", (d) => (boardId ? mesaPlanOf(boardId, d) : null), null);
  return boardId ? live.data : null;
}

/** Who takes the next penalty (PZ-D10): the first of the list who is on the pitch now (null: none of them). */
export function penaltyTaker(plan: Pick<MesaPlan, "takers"> | null, onPitch: ReadonlySet<string>): string | null {
  return plan?.takers.penalties.find((id) => onPitch.has(id)) ?? null;
}

/** The «Si pasa…» suggestions now (PZ-D07): the rules that hold at `minute` with `gf`–`ga`. */
export function mesaSuggestions(plan: Pick<MesaPlan, "condPlan"> | null, o: { minute: number; gf: number; ga: number; onPitch: ReadonlySet<string> }): LiveRule[] {
  return plan ? liveRules(plan.condPlan, o) : [];
}

/** The cambios that take the pitch now to a version's seven («la mesa ofrece la 2ª parte en el descanso»): who
 *  comes on (in the version's slot order, keeper first) for whom (the ones on the pitch now who aren't in it, in
 *  their slot order). Places within the seven are la mesa's «Cambio de sitio», not listed here. */
export function versionChanges(now: readonly LineupSlot[], version: Pick<LineupVariant, "slots"> | null): { out: string; in: string }[] {
  if (!version) return [];
  const on = new Set(now.map((s) => s.playerId));
  const want = version.slots.map((s) => s.playerId).filter((x): x is string => !!x);
  const wantSet = new Set(want);
  const leaving = now.map((s) => s.playerId).filter((id) => !wantSet.has(id));
  const coming = want.filter((id) => !on.has(id));
  return coming.flatMap((id, i) => (leaving[i] ? [{ out: leaving[i], in: id }] : []));
}

/** The version a rule switches to (PZ-D07 `ver`), from the plan. */
export const versionOf = (plan: Pick<MesaPlan, "segunda" | "planb"> | null, ver: CondVer | null): LineupVariant | null =>
  !plan || !ver ? null : VER_VARIANT[ver] === "v2" ? plan.segunda : plan.planb;

/** Who is on the pitch now (matches/{id}.lineup + events: lib/matchLineup lineupWalk). */
export const onPitchNow = (lineup: Pick<MatchLineup, "slots"> | null, events: readonly LineupEvent[]): LineupSlot[] =>
  lineup ? lineupWalk(lineup, events).now : [];
