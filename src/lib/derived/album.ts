// The album of cromos, derived (no data of its own): a member owns the cromo of every teammate he has played a
// match with this season — both on the acta's ledger as played — and his own once he has played. The total is
// the season's squad. Pure: the matches (with their ledgers) and the squad are all it reads.
import type { ClubMatch } from "../clubData";
import { dateMillis } from "../../../functions/src/matchEngine";

export interface AlbumCromo {
  id: string;
  /** When he got it: the first match they played together (ms; NaN undated). */
  at: number;
}

export interface Album {
  /** The cromos he has, newest first. */
  owned: AlbumCromo[];
  total: number;
  /** Squad members he has never played with. */
  missing: string[];
}

/** `playerId`'s album in the season `seasonId`, over the squad's ids. */
export function albumOf(playerId: string, matches: readonly Pick<ClubMatch, "id" | "seasonId" | "date" | "ledger">[], squad: readonly string[], seasonId: string): Album {
  const got = new Map<string, number>();
  const played = matches
    .filter((m) => m.seasonId === seasonId && m.ledger?.[playerId]?.played)
    .map((m) => ({ m, at: dateMillis(m.date) }))
    .sort((a, b) => (Number.isFinite(a.at) ? a.at : Infinity) - (Number.isFinite(b.at) ? b.at : Infinity));
  for (const { m, at } of played) {
    for (const [id, p] of Object.entries(m.ledger ?? {})) {
      if (!p?.played || id.startsWith("guest:") || !squad.includes(id) || got.has(id)) continue;
      got.set(id, at);
    }
  }
  const owned = [...got].map(([id, at]) => ({ id, at })).sort((a, b) => (Number.isFinite(b.at) ? b.at : -Infinity) - (Number.isFinite(a.at) ? a.at : -Infinity));
  return { owned, total: squad.length, missing: squad.filter((id) => !got.has(id)) };
}

/** The line under «11 de 16 cromos»: who is missing tonight, how many are left, or the album complete. */
export function albumLine(album: Album, debutTonight: readonly string[]): string {
  if (album.total && album.owned.length >= album.total) return "Los tienes todos.";
  const debut = debutTonight.filter((id) => album.missing.includes(id));
  if (debut.length) return debut.length === album.missing.length ? "Te faltan los de los que debutan hoy." : debut.length === 1 ? "Hoy cae uno de los que te faltan." : `Hoy caen ${debut.length} de los que te faltan.`;
  const left = album.total - album.owned.length;
  if (!album.owned.length) return "El primero llega con tu primer partido.";
  return left === 1 ? "Te falta uno: juega con él y lo tienes." : `Te faltan ${left}: juega con ellos y los tienes.`;
}
