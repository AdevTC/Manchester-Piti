// The one way a player is named: the shirt name he wears that season, else his shirt name, else his
// first and last name, else «Jugador». Shared by the web (src/lib/derived/names.ts re-exports it) and the
// server (push notices, «Cambio en el siete», the door, the share cards): a notice about a match names
// its players with the match's own season, as the match page does.

export interface NameSource {
  shirtName?: string;
  firstName?: string;
  lastName?: string;
  /** Per-season overrides ({ [seasonId]: { shirtName?, number? } }), as stored on players/{id}. */
  seasonDetails?: Record<string, unknown>;
}

/** The shirt name a season gives him (seasonDetails[seasonId].shirtName), when it has one. */
export function seasonShirtName(p: NameSource | null | undefined, seasonId: string | null | undefined): string | undefined {
  if (!p || !seasonId || seasonId === "all") return undefined;
  const raw = p.seasonDetails?.[seasonId];
  if (!raw || typeof raw !== "object") return undefined;
  const name = (raw as Record<string, unknown>).shirtName;
  return typeof name === "string" && name.trim() ? name : undefined;
}

/** A player's name: the season's shirt name, then shirtName, then first + last, then «Jugador». */
export function nameFor(p: NameSource | null | undefined, seasonId?: string | null): string {
  return seasonShirtName(p, seasonId) || p?.shirtName || [p?.firstName, p?.lastName].filter(Boolean).join(" ") || "Jugador";
}
