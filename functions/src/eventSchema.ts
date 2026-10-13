import { z } from "zod";
import { EVENT_LABELS } from "./matchEngine.js";
import { OUTCOMES } from "./matchAnalysis.js";
const ref = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const coordinate = z.number().finite().min(0).max(100).optional();
export const eventSchema = z.object({
  id: ref, type: z.enum(Object.keys(EVENT_LABELS) as [keyof typeof EVENT_LABELS, ...Array<keyof typeof EVENT_LABELS>]),
  minute: z.number().int().min(0).max(150).optional(), elapsedSeconds: z.number().int().min(0).max(9000).optional(), timingUnknown: z.boolean().optional(),
  period: z.union([z.literal(1), z.literal(2)]).optional(),
  playerId: ref.optional(), assistPlayerId: ref.optional(), inPlayerId: ref.optional(), receiverId: ref.optional(),
  team: z.enum(["us", "opponent"]).optional(), opponentPlayer: z.string().max(80).optional(),
  outcome: z.enum(OUTCOMES).optional(), keyPass: z.boolean().optional(),
  delivery: z.enum(["short", "long", "cross", "through", "throw"]).optional(),
  bodyPart: z.enum(["right", "left", "head", "hand", "other"]).optional(), zone: z.enum(["left", "center", "right"]).optional(),
  x: coordinate, y: coordinate, endX: coordinate, endY: coordinate,
  possessionSeconds: z.number().int().min(1).max(9000).optional(),
  note: z.string().max(300).optional(), source: z.enum(["live", "narration", "manual"]).optional(), sourceRef: z.string().max(160).optional(),
}).refine(e => e.elapsedSeconds == null || Math.floor(e.elapsedSeconds / 60) === e.minute, { message: "El minuto debe coincidir con los segundos de juego." });
