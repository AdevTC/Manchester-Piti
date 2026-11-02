// r14 · the «Ver la charla» link (PZ-D02), apart from boards.ts: the match page imports it and must not load
// Firebase before its first paint (scripts/check-boot.mjs).
/** /pizarra/charla?tablero=<id>[&season=<id>] — the same link the «Ya está el siete» push opens for the season's
 *  official (functions/src/pushLogic.ts charlaUrl). The match page shows «Ver la charla» to members with the
 *  board useMatchBoard gives it. */
export function charlaHref(boardId: string, seasonId?: string | null): string {
  const season = seasonId && seasonId !== "all" ? "&season=" + encodeURIComponent(seasonId) : "";
  return "/pizarra/charla?tablero=" + encodeURIComponent(boardId) + season;
}
