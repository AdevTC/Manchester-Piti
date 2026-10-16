import { z } from "zod";
import { EVENT_LABELS } from "./matchEngine.js";
import { OUTCOMES } from "./matchAnalysis.js";
import { GUEST_ID_RE, GUEST_NAME_MAX, GUEST_PREFIX, MAX_GUESTS } from "./guests.js";
const ref = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
/** A guest reference («guest:g1»): accepted only in the player fields (guests.ts). */
export const guestRefSchema = z.string().regex(new RegExp(`^${GUEST_PREFIX}g[1-4]$`));
/** A player field: a member's id or a guest reference. */
export const playerRefSchema = z.union([ref, guestRefSchema]);
/** A match's guests: up to MAX_GUESTS, ids g1–g4 once each, names 1–30 characters. */
export const guestsSchema = z
  .array(z.object({ id: z.string().regex(GUEST_ID_RE), name: z.string().trim().min(1, "Escribe el nombre del invitado.").max(GUEST_NAME_MAX, `El nombre del invitado tiene como mucho ${GUEST_NAME_MAX} caracteres.`) }))
  .max(MAX_GUESTS, `Como mucho ${MAX_GUESTS} invitados por partido.`)
  .refine((gs) => new Set(gs.map((g) => g.id)).size === gs.length, { message: "Cada invitado necesita su propia referencia (g1–g4)." });
const coordinate = z.number().finite().min(0).max(100).optional();
export const eventSchema = z.object({
  id: ref, type: z.enum(Object.keys(EVENT_LABELS) as [keyof typeof EVENT_LABELS, ...Array<keyof typeof EVENT_LABELS>]),
  minute: z.number().int().min(0).max(150).optional(), elapsedSeconds: z.number().int().min(0).max(9000).optional(), timingUnknown: z.boolean().optional(),
  period: z.union([z.literal(1), z.literal(2)]).optional(),
  playerId: playerRefSchema.optional(), assistPlayerId: playerRefSchema.optional(), assistReviewed: z.boolean().optional(), inPlayerId: playerRefSchema.optional(), receiverId: playerRefSchema.optional(),
  team: z.enum(["us", "opponent"]).optional(), opponentPlayer: z.string().max(80).optional(),
  outcome: z.enum(OUTCOMES).optional(), keyPass: z.boolean().optional(),
  delivery: z.enum(["short", "long", "cross", "through", "throw"]).optional(),
  bodyPart: z.enum(["right", "left", "head", "hand", "other"]).optional(), zone: z.enum(["left", "center", "right"]).optional(),
  x: coordinate, y: coordinate, endX: coordinate, endY: coordinate,
  possessionSeconds: z.number().int().min(1).max(9000).optional(),
  note: z.string().max(300).optional(), source: z.enum(["live", "narration", "manual"]).optional(), sourceRef: z.string().max(160).optional(),
}).refine(e => e.elapsedSeconds == null || Math.floor(e.elapsedSeconds / 60) === e.minute, { message: "El minuto debe coincidir con los segundos de juego." });
