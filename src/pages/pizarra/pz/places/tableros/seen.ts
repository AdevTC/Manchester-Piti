// r14 «La pizarra» · Tableros: the official's seven as this device last saw it (PAR-42 «El oficial ha cambiado desde
// la última vez»). Device memory only (private mode: nothing is remembered, nothing breaks).
import type { FormationName } from "../../../formations";
import type { PzSlot } from "../../store/types";
import type { PosCode } from "../../../../../lib/positions";

const KEY = "mp_pizarra_oficial_visto:";

export interface Seen {
  formation: FormationName;
  slots: PzSlot[];
}

export function readSeen(boardId: string): Seen | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY + boardId) ?? "null");
    if (!raw || typeof raw !== "object") return null;
    const r = raw as { formation?: unknown; slots?: unknown };
    if (typeof r.formation !== "string" || !Array.isArray(r.slots) || r.slots.length !== 7) return null;
    const slots = r.slots.map((s: unknown) => {
      const o = (s ?? {}) as { code?: unknown; x?: unknown; y?: unknown; playerId?: unknown };
      return { code: String(o.code ?? "MC") as PosCode, x: Number(o.x) || 0, y: Number(o.y) || 0, playerId: typeof o.playerId === "string" ? o.playerId : null };
    });
    return { formation: r.formation as FormationName, slots };
  } catch {
    return null;
  }
}

export function writeSeen(boardId: string, v: Seen): void {
  try {
    localStorage.setItem(KEY + boardId, JSON.stringify({ formation: v.formation, slots: v.slots.map((s) => ({ code: s.code, x: s.x, y: s.y, playerId: s.playerId })) }));
  } catch {
    /* private mode */
  }
}
