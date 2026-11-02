// r14 · el plan del tablero (PZ-D22P/D23P), stored as the board's `plan` field: the keys (≤ 3), what each key
// lights on the pitch (`viz[i] = { icon, zona }`, beside `claves[i]`), the notes for the charla and the set
// pieces (`parado`: the corner and free-kick box runners and their play, who follows up a penalty — the
// takers themselves stay the Siete's galones, `takers`). Read leniently (an invalid part is dropped and
// reported, never the board); firestore.rules (planOk) caps the shape. Pure.
import { z } from "zod";
import { reportDroppedDoc } from "../../../lib/docTelemetry";

export const PLAN_LIMITS = { claves: 3, clave: 60, notes: 280, box: 5, rechace: 5, id: 128 } as const;

/** The icons a key can carry (the prototype's KEY_ICONS). */
export const KEY_ICONS = ["spark", "eye", "ball", "shield", "users", "flag"] as const;
export type KeyIcon = (typeof KEY_ICONS)[number];
/** What a key lights on the pitch (the prototype's VIZ: «nada», «Presión arriba», «Su peligroso»…). */
export const VIZ_ZONES = ["nada", "arriba", "su7", "medio", "atras", "bandas", "centro"] as const;
export type VizZone = (typeof VIZ_ZONES)[number];

export interface KeyViz {
  icon: KeyIcon;
  zona: VizZone;
}
export interface SetPiece {
  /** The play it runs (a board play's id, a season play's id or a library id), null = none yet. */
  playId: string | null;
  /** Who goes into the box (player ids, ≤ 5). */
  box: string[];
}
export interface Parado {
  corners: SetPiece;
  freekicks: SetPiece;
  /** Who follows up the rebound (ids, ≤ 5). */
  penalties: { rechace: string[] };
}
export interface BoardPlan {
  claves: string[];
  /** One per key, same index (missing = the key lights nothing yet). */
  viz: KeyViz[];
  notes: string;
  /** null = not set yet. */
  parado: Parado | null;
}

/** A player id as the rules accept it in a list (planOk idListOk): a ficha id or «guest:g1». */
const ID_RE = /^[A-Za-z0-9_:-]{1,128}$/;
const ids = (max: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((a) => [...new Set(a.filter((x): x is string => typeof x === "string" && ID_RE.test(x)))].slice(0, max));
const setPieceSchema = z
  .object({ playId: z.string().min(1).max(PLAN_LIMITS.id).nullable().optional().catch(null), box: ids(PLAN_LIMITS.box).optional() })
  .transform((s): SetPiece => ({ playId: s.playId ?? null, box: s.box ?? [] }));
const paradoSchema = z
  .object({
    corners: setPieceSchema.optional().catch(undefined),
    freekicks: setPieceSchema.optional().catch(undefined),
    penalties: z.object({ rechace: ids(PLAN_LIMITS.rechace).optional() }).optional().catch(undefined),
  })
  .transform(
    (p): Parado => ({
      corners: p.corners ?? { playId: null, box: [] },
      freekicks: p.freekicks ?? { playId: null, box: [] },
      penalties: { rechace: p.penalties?.rechace ?? [] },
    }),
  );
const vizSchema = z.object({ icon: z.enum(KEY_ICONS).catch("flag"), zona: z.enum(VIZ_ZONES).catch("nada") });

export const planSchema = z.object({
  claves: z.array(z.unknown()).max(PLAN_LIMITS.claves * 2).optional(),
  viz: z.array(z.unknown()).max(PLAN_LIMITS.claves * 2).optional(),
  notes: z.string().max(PLAN_LIMITS.notes * 2).optional(),
  parado: z.unknown().optional(),
});

/** A text as stored: «¬» dropped (firestore.rules joins the keys with it: one inside would refuse every later save of
 *  the board — a stored one heals on the next save, as parsePlan runs it too), spaces folded, cut to `max`. */
const cleanText = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/¬/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "");

/** The stored `plan` (undefined = never set, null = taken off), repaired. */
export function parsePlan(raw: unknown, docId = "-"): BoardPlan | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const r = planSchema.safeParse(raw);
  if (!r.success) {
    reportDroppedDoc("lineups.plan", docId, r.error.issues);
    return null;
  }
  const claves = (r.data.claves ?? []).map((c) => cleanText(c, PLAN_LIMITS.clave)).filter(Boolean).slice(0, PLAN_LIMITS.claves);
  const viz = (r.data.viz ?? []).slice(0, claves.length).flatMap((v) => {
    const one = vizSchema.safeParse(v);
    return one.success ? [one.data] : [];
  });
  let parado: Parado | null = null;
  if (r.data.parado !== undefined && r.data.parado !== null) {
    const p = paradoSchema.safeParse(r.data.parado);
    if (p.success) parado = p.data;
    else reportDroppedDoc("lineups.plan.parado", docId, p.error.issues);
  }
  return { claves, viz, notes: cleanText(r.data.notes ?? "", PLAN_LIMITS.notes), parado };
}

/** Firestore payload (nothing undefined); null = taken off. */
export function planToData(p: BoardPlan | null): Record<string, unknown> | null {
  if (!p) return null;
  // (firestore.rules planOk: each key 1–60, each box/rechace id-like: what the parser keeps)
  const claves = p.claves.map((c) => cleanText(c, PLAN_LIMITS.clave)).filter(Boolean).slice(0, PLAN_LIMITS.claves);
  return {
    claves,
    viz: p.viz.slice(0, claves.length).map((v) => ({ icon: v.icon, zona: v.zona })),
    notes: p.notes.slice(0, PLAN_LIMITS.notes),
    parado: p.parado ? copyParado(p.parado) : null,
  };
}

const copyParado = (p: Parado): Parado => ({
  corners: { playId: p.corners.playId, box: [...p.corners.box] },
  freekicks: { playId: p.freekicks.playId, box: [...p.freekicks.box] },
  penalties: { rechace: [...p.penalties.rechace] },
});
export const copyPlan = (p: BoardPlan): BoardPlan => ({ claves: [...p.claves], viz: p.viz.map((v) => ({ ...v })), notes: p.notes, parado: p.parado ? copyParado(p.parado) : null });
export const emptyPlan = (): BoardPlan => ({ claves: [], viz: [], notes: "", parado: null });
export const emptyParado = (): Parado => ({ corners: { playId: null, box: [] }, freekicks: { playId: null, box: [] }, penalties: { rechace: [] } });
