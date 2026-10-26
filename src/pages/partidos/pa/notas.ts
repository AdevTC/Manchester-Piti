// Partidos «Vidrio» (PA- boards), las notas: the viewer's own on each played jornada's tile («Tú 4,9»), and in the
// acta «Las notas» (the best three and yours) with each minutes row's badge. The notas come from the season's
// ratings (seasonRatings' noteOf, wired in the page); this picks, sorts and words them. Public: a fan sees them all,
// only «Tú» needs a player. Pure.
import { notaBand, notaText, type NotaBand } from "../../../lib/rating/semaforo";

/** A player's nota in a match (null: he has none — under 10′, or no minutes in the acta). */
export type NotaOf = (matchId: string, playerId: string) => number | null;

/** The badge: `<span class="nb nb--{k}">{t}</span>`, with its name for a screen reader (never the colour alone). */
export interface NotaBadge {
  k: NotaBand;
  t: string;
  /** «Nota 7,4, buena»; «Sin nota». */
  aria: string;
  /** «buena»: the band's word, for a sentence. */
  word: string;
}
export function notaBadge(n: number | null | undefined): NotaBadge {
  const b = notaBand(n);
  const t = notaText(n);
  const word = b.word.toLowerCase();
  return { k: b.k, t, word, aria: b.k === "no" ? "Sin nota" : `Nota ${t}, ${word}` };
}

/** The viewer's own nota on a jornada's tile: only a player, and only when he has one there. */
export function myNota(matchId: string, myId: string | null, notaOf: NotaOf): NotaBadge | null {
  const n = myId ? notaOf(matchId, myId) : null;
  return n === null ? null : notaBadge(n);
}

export interface NotaRow extends NotaBadge {
  id: string;
  name: string;
  me: boolean;
}
/** How many names «Las notas» shows before «Ver todas las notas» (the minutes beside them carry everyone's). */
export const NOTAS_TOP = 3;

/** «Las notas» of a match, from everyone who played (`ids`): those with a nota, best first (a tie, by name); the
 *  list shows the best three and, under them, the viewer's own when he is not among them («La tuya»). */
export function actaNotas(matchId: string, ids: readonly string[], notaOf: NotaOf, nm: (id: string) => string, myId: string | null) {
  const rows = [...new Set(ids)]
    .flatMap((id) => {
      const n = notaOf(matchId, id);
      return n === null ? [] : [{ id, n, name: nm(id) }];
    })
    // (as they are shown: 7,44 and 7,36 both read 7,4 and tie)
    .sort((a, b) => Math.round(b.n * 10) - Math.round(a.n * 10) || a.name.localeCompare(b.name, "es"))
    .map((r): NotaRow => ({ id: r.id, name: r.name, me: r.id === myId, ...notaBadge(r.n) }));
  const top = rows.slice(0, NOTAS_TOP);
  const mine = top.some((r) => r.me) ? null : (rows.find((r) => r.me) ?? null);
  return { rows, top, mine, n: rows.length };
}
