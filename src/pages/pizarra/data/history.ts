// r14 · la historia del tablero (PZ-D21T): «Cómo ha ido cambiando». The server keeps the snapshots
// (lineups/{id}/history/{hid}, functions/src/pizarraR14.ts: when the board is created or published, its sistema
// changes or someone comes into the seven; ≤ 20, a burst of the same change within 10 min is one). Here: reading
// them, and «Recuperar» — an ordinary edit of the board with the snapshot's seven (the caller keeps the board's
// current state for its 12 s «Deshacer»). Team reads; only whoever may edit the board recovers.
import { useMemo } from "react";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { z } from "zod";
import { db } from "../../../firebase";
import { useFirestoreCollection } from "../../../lib/useFirestoreCollection";
import { reportDroppedDoc } from "../../../lib/docTelemetry";
import { LINEUP_FORMATIONS } from "../../../lib/schemas";
import { FORMATIONS, slotIdFor, type FormationName, type Lineup, type SlotState } from "../formations";
import type { Tactics } from "../tactics";

export const HISTORY_KINDS = ["nuevo", "sistema", "entra", "publica"] as const;
export type HistoryKind = (typeof HISTORY_KINDS)[number];

export interface HistorySnap {
  id: string;
  kind: HistoryKind;
  /** The server's words («Pasa al 3-2-1»); the UI names «Entra X» from `entra`. */
  label: string;
  entra: string[];
  formation: FormationName;
  freeMode: boolean;
  system: string;
  slots: { playerId: string | null; code: string; x: number; y: number }[];
  roles: Record<string, unknown>;
  takers: Record<string, unknown>;
  tactics: Record<string, unknown>;
  isOfficial: boolean;
  at: number;
}

const slot = z.object({ playerId: z.string().min(1).max(128).nullable(), code: z.string().max(4), x: z.number().min(0).max(100), y: z.number().min(0).max(100) });
const schema = z.object({
  kind: z.enum(HISTORY_KINDS),
  label: z.string().max(80).catch(""),
  entra: z.array(z.string().max(128)).max(7).catch([]),
  formation: z.enum(LINEUP_FORMATIONS),
  freeMode: z.boolean().catch(false),
  system: z.string().max(16).catch(""),
  slots: z.array(slot).length(7),
  roles: z.record(z.string(), z.unknown()).catch({}),
  takers: z.record(z.string(), z.unknown()).catch({}),
  tactics: z.record(z.string(), z.unknown()).catch({}),
  isOfficial: z.boolean().catch(false),
  at: z.number(),
});

export function mapHistory(id: string, data: unknown): HistorySnap | null {
  const r = schema.safeParse(data);
  if (!r.success) {
    reportDroppedDoc("lineups.history", id, r.error.issues);
    return null;
  }
  return { id, ...r.data };
}

/** The board's snapshots, newest first (live while `enabled`: the history is on screen). */
export function useBoardHistory(lineupId: string | null, enabled = true): { snaps: HistorySnap[]; loading: boolean; error: boolean } {
  const on = enabled && !!lineupId;
  const q = useMemo(() => query(collection(db, "lineups", lineupId || "-", "history"), orderBy("at", "desc"), limit(20)), [lineupId]);
  const key = useMemo(() => ["lineupHistory", lineupId ?? "-"], [lineupId]);
  const { data, isPending, error } = useFirestoreCollection(key, q, mapHistory, on);
  return { snaps: on ? (data ?? []) : [], loading: on && isPending, error: on && !!error };
}

/** «Recuperar»: the board with the snapshot's seven, sistema, galones and consignas (everything else — plan, rival,
 *  jugadas, dibujos, versiones — stays as it is now). Save it like any edit; keep `current` for «Deshacer». */
export function restoreFrom(current: Lineup, s: HistorySnap): Lineup {
  const defs = FORMATIONS[s.formation];
  const slots: SlotState[] = defs.map((d, i) => ({
    ...d,
    slotId: slotIdFor(i),
    playerId: s.slots[i]?.playerId ?? null,
    ...(s.freeMode ? { x: s.slots[i]?.x ?? d.x, y: s.slots[i]?.y ?? d.y } : {}),
  }));
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 3) : []);
  const roles = Object.fromEntries((["captainId", "viceId", "penaltiesId", "freekicksId", "cornersId"] as const).flatMap((k) => (str(s.roles[k]) ? [[k, str(s.roles[k])]] : [])));
  return {
    ...current,
    formation: s.formation,
    freeMode: s.freeMode,
    slots,
    roles,
    takers: { penalties: list(s.takers.penalties), freekicks: list(s.takers.freekicks), corners: list(s.takers.corners) },
    tactics: { ...current.tactics, ...(Object.fromEntries(Object.entries(s.tactics).filter(([k, v]) => k in current.tactics && typeof v === "string")) as Partial<Tactics>) },
  };
}

/** What changes from `a` to `b` puesto by puesto («DFC: FER → ILLESCAS»), for «Comparar». */
export function historyDiff(a: Pick<HistorySnap, "slots">, b: Pick<HistorySnap, "slots">): { code: string; from: string | null; to: string | null }[] {
  return b.slots.flatMap((s, i) => (a.slots[i]?.playerId !== s.playerId ? [{ code: s.code, from: a.slots[i]?.playerId ?? null, to: s.playerId }] : []));
}
