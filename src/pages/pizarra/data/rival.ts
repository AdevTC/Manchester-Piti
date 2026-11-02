// r14 · el rival se guarda con el tablero (PZ-D21P): on top of v2/rival.ts's seven (system, dorsal and note per
// player), `visible` («En el campo»: false = their seven off the pitch; absent = on) and `danger` (the index of
// their dangerous player, 0–6; absent/null = none chosen). firestore.rules rivalOk caps both. Pure.
import { copyRival, parseRival, rivalToData, RIVAL_LIMITS, type RivalSeven } from "../v2/rival";

export interface RivalPlan extends RivalSeven {
  /** Their seven drawn on the pitch (default true). */
  visible?: boolean;
  /** Index into `players` of their danger man (null/absent = none). */
  danger?: number | null;
}

const dangerOk = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v < RIVAL_LIMITS.players;

/** The stored `rival` (undefined = never had one, null = taken off), with `visible` and `danger`. */
export function parseRivalPlan(raw: unknown, docId = "-"): RivalPlan | null | undefined {
  const base = parseRival(raw, docId);
  if (!base) return base;
  const r = raw as { visible?: unknown; danger?: unknown };
  const out: RivalPlan = base;
  if (r.visible === false) out.visible = false;
  if (dangerOk(r.danger)) out.danger = r.danger;
  return out;
}

/** Firestore payload (nothing undefined); null = taken off. */
export function rivalPlanToData(r: RivalPlan | null): Record<string, unknown> | null {
  const base = rivalToData(r);
  if (!base || !r) return base;
  return { ...base, ...(r.visible === false ? { visible: false } : {}), ...(dangerOk(r.danger) ? { danger: r.danger } : {}) };
}

export function copyRivalPlan(r: RivalPlan): RivalPlan {
  const out: RivalPlan = copyRival(r);
  if (r.visible === false) out.visible = false;
  if (dangerOk(r.danger)) out.danger = r.danger;
  return out;
}

/** Their seven is drawn on the pitch. */
export const rivalVisible = (r: RivalPlan | null | undefined): boolean => !!r && r.visible !== false;

/** Their danger man: the chosen one, else the first whose note says so («mejor», «peligro», «no le dej…»), else
 *  the first with a note (the prototype's `danger(b)`). Null = none. */
export function dangerOf(r: RivalPlan | null | undefined): { i: number; num?: number; note?: string } | null {
  if (!r) return null;
  if (dangerOk(r.danger) && r.players[r.danger]) return { i: r.danger, ...r.players[r.danger] };
  let k = r.players.findIndex((p) => /mejor|peligro|no le dej/i.test(p.note ?? ""));
  if (k < 0) k = r.players.findIndex((p) => !!p.note);
  return k >= 0 ? { i: k, ...r.players[k] } : null;
}

/** `rival` with `visible` set / `danger` chosen (a copy; the same object when nothing changes). */
export function setRivalVisible(r: RivalPlan, on: boolean): RivalPlan {
  if (rivalVisible(r) === on) return r;
  const next = copyRivalPlan(r);
  if (on) delete next.visible;
  else next.visible = false;
  return next;
}
export function setRivalDanger(r: RivalPlan, i: number | null): RivalPlan {
  const want = i !== null && dangerOk(i) ? i : null;
  if ((dangerOk(r.danger) ? r.danger : null) === want) return r;
  const next = copyRivalPlan(r);
  if (want === null) delete next.danger;
  else next.danger = want;
  return next;
}
