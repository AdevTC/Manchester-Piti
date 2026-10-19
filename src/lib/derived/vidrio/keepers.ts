// «Vidrio» · Números: the clean sheets by goalkeeper («Evans · Porterías a cero · 4») and the season's yellow
// cards, the live match counted as provisional («de momento»). A clean sheet goes to whoever kept goal: the
// most minutes at POR in the acta's ledger, else the published lineup's POR slot, else the first starter
// (the convocatoria lists the keeper first). Pure.
import type { ClubMatch } from "../../clubData";
import { settled } from "../../eventMeta";
import { parseMatchLineup } from "../../matchLineup";

export interface KeeperRow {
  id: string;
  clean: number;
  /** One of them is the live match, still at nil. */
  provisional: boolean;
}

/** Who kept goal in `m` (null when nothing says). */
export function keeperOf(m: Pick<ClubMatch, "ledger" | "starters"> & { lineup?: unknown }): string | null {
  let best: string | null = null;
  let most = 0;
  for (const [id, row] of Object.entries(m.ledger ?? {})) {
    const pp = (row as { positionsPlayed?: unknown } | undefined)?.positionsPlayed;
    const min = pp && typeof pp === "object" ? (pp as Record<string, unknown>).POR : undefined;
    if (typeof min === "number" && min > most) {
      most = min;
      best = id;
    }
  }
  if (best) return best;
  const slot = parseMatchLineup(m.lineup)?.slots.find((s) => s.code === "POR");
  if (slot) return slot.playerId;
  return m.starters?.[0] ?? null;
}

/** The clean sheets per keeper over the `played` matches (and `live`, at nil so far), most first. */
export function cleanSheetsByKeeper(played: readonly ClubMatch[], score: (m: ClubMatch) => { gf: number; ga: number }, live: ClubMatch | null = null): KeeperRow[] {
  const rows = new Map<string, KeeperRow>();
  const add = (m: ClubMatch, provisional: boolean) => {
    if (score(m).ga !== 0) return;
    const id = keeperOf(m);
    if (!id) return;
    const r = rows.get(id) ?? { id, clean: 0, provisional: false };
    r.clean++;
    r.provisional ||= provisional;
    rows.set(id, r);
  };
  for (const m of played) add(m, false);
  if (live) add(live, true);
  return [...rows.values()].sort((a, b) => b.clean - a.clean || a.id.localeCompare(b.id));
}

/** Our yellow cards (a double yellow counts two) over the `played` matches and the `live` one. */
export function seasonCards(played: readonly ClubMatch[], live: ClubMatch | null = null): { cards: number; provisional: boolean } {
  const count = (m: ClubMatch) =>
    settled(m.events).reduce((n, e) => n + (e.type === "yellow_card" ? 1 : e.type === "double_yellow" ? 2 : 0), 0);
  const tonight = live ? count(live) : 0;
  return { cards: played.reduce((n, m) => n + count(m), 0) + tonight, provisional: tonight > 0 };
}
