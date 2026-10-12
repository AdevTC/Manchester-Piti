// The telestrator's Bloque 4 strokes (Unir, Foco, Medir, Fuera de juego): they follow the players, so
// drawTools.ts draws and hits them instead of telestrator.ts. Kept apart so both can ask without a cycle.
import type { StrokeKind } from "../drawings";

export const EXTRA_KINDS = ["unir", "foco", "medir", "fuera"] as const;
export type ExtraKind = (typeof EXTRA_KINDS)[number];
export const isExtraKind = (k: StrokeKind | string): k is ExtraKind => (EXTRA_KINDS as readonly string[]).includes(k);
