// «El oficial ha cambiado»: the seven of the official this device last saw, so a member opening the pizarra
// after the captain changed it is told who comes in (the push «Cambio en el siete» is the other half, for
// whoever has notices on). Kept on the device, per official board. Pure helpers + storage (never throws).
import type { Lineup } from "../formations";

const KEY = "mp_pizarra_seen7:";

/** Who stands in the seven, in slot order. */
export const sevenIds = (L: Pick<Lineup, "slots">): string[] => L.slots.map((s) => s.playerId).filter((x): x is string => !!x);

export function readSeen(id: string): string[] | null {
  try {
    const raw = localStorage.getItem(KEY + id);
    const v: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
}

export function writeSeen(id: string, seven: string[]): void {
  try {
    localStorage.setItem(KEY + id, JSON.stringify(seven));
  } catch {
    /* private mode: the banner just won't remember */
  }
}

const andList = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]);

/** «El oficial ha cambiado: entra ERIK por KEVIN» (null = nothing seen before, or nobody in or out). */
export function oficialChange(seen: readonly string[] | null, now: readonly string[], name: (id: string) => string): string | null {
  if (!seen) return null;
  const a = new Set(seen);
  const b = new Set(now);
  const ins = now.filter((x) => !a.has(x)).map(name);
  const outs = seen.filter((x) => !b.has(x)).map(name);
  if (!ins.length && !outs.length) return null;
  const verb = ins.length > 1 ? "entran " : "entra ";
  const txt = ins.length && outs.length ? verb + andList(ins) + " por " + andList(outs) : ins.length ? verb + andList(ins) : (outs.length > 1 ? "salen " : "sale ") + andList(outs);
  return "El oficial ha cambiado: " + txt;
}
