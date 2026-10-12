// La pizarra · Bloque 4 «profundidad táctica»: the board's tactical fields as stored, with Zod. The same caps
// as firestore.rules (tacticaOk): the shape without the ball (`shapeOff`), the conditional plan (`condPlan`,
// ≤ 3 rules) and the predefined style last applied (`style`). Read leniently (lineupDoc → tacticaData.ts): an
// invalid field is repaired to nothing, an invalid rule dropped, never the whole board.
import { z } from "zod";
import { LINEUP_FORMATIONS, LINEUP_LIMITS } from "./schemas";

export const TACTICA_LIMITS = {
  /** One offset per slot of the seven. */
  offs: 7,
  /** How far (in % of the pitch) a slot may be moved from its system's spot without the ball. */
  off: 40,
  /** Rules of the conditional plan. */
  rules: 3,
  /** «por N»: the goal difference a rule asks for. */
  by: 5,
  /** «desde el min′». */
  from: 149,
  style: 24,
  id: 40,
  value: 40,
} as const;

/** A plane offset (du across, dv along) in % of the pitch, clamped to ±off. */
const offNum = z
  .number()
  .refine(Number.isFinite)
  .transform((v) => Math.max(-TACTICA_LIMITS.off, Math.min(TACTICA_LIMITS.off, v)));
export const shapeOffsetSchema = z.object({ du: offNum, dv: offNum });

/** «Sin balón»: the system the seven fall into without the ball, and each slot's nudge from its spot. */
export const shapeOffSchema = z.object({
  formation: z.enum(LINEUP_FORMATIONS),
  offs: z.array(shapeOffsetSchema).length(TACTICA_LIMITS.offs),
});
export type ShapeOff = z.infer<typeof shapeOffSchema>;
export type ShapeOffset = z.infer<typeof shapeOffsetSchema>;

export const COND_WHEN = ["ganando", "perdiendo", "empate"] as const;
/** The consignas a rule can change (mentalidad, presión, línea). */
export const COND_KEYS = ["mentality", "press", "defLine"] as const;
const ref = z.string().min(1).max(LINEUP_LIMITS.id);

/** «Si vamos [ganando] [por 2] desde el [30]′ → [mentalidad] [defensiva] + [entra X por Y]». */
export const condRuleSchema = z
  .object({
    id: z.string().min(1).max(TACTICA_LIMITS.id),
    when: z.enum(COND_WHEN),
    by: z.number().int().min(0).max(TACTICA_LIMITS.by),
    from: z.number().int().min(0).max(TACTICA_LIMITS.from),
    key: z.enum(COND_KEYS),
    value: z.string().min(1).max(TACTICA_LIMITS.value),
    sub: z
      .object({ out: ref, in: ref })
      .refine((s) => s.out !== s.in, { message: "Un cambio necesita dos jugadores distintos." })
      .optional(),
  })
  .refine((r) => (r.when === "empate" ? r.by === 0 : r.by >= 1), { message: "«Por N» va con ganando o perdiendo (1–5)." });
export type CondRule = z.infer<typeof condRuleSchema>;
export type CondWhen = CondRule["when"];
export type CondKey = CondRule["key"];

export const STYLE_IDS = ["presion", "bloque", "posesion", "directo", "equilibrado"] as const;
export const styleSchema = z.enum(STYLE_IDS);
export type StyleId = z.infer<typeof styleSchema>;
