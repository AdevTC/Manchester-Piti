// The web addresses the notices open (pure: the web's tests read it too). A match lives at /partidos/<id>
// with its screens (/siete, /numeros, /vestuario); notices stored before that keep /matches/<id>?tab=…, which
// the web redirects, so both forms name their match.

/** The match page's screens a notice opens ("" is the page itself). */
export type MatchScreen = '' | 'siete' | 'numeros' | 'vestuario';

export const matchUrl = (id: string, screen: MatchScreen = ''): string => `/partidos/${encodeURIComponent(id)}${screen ? `/${screen}` : ''}`;

/** Partidos' own screens, never a match id. */
const PARTIDOS_SCREENS = new Set(['tabla', 'balance']);

/** The match a notice is about, from its address: /partidos/<id>[/…] or the old /matches/<id>[?tab=…]. */
export function noticeMatchId(url: string): string | null {
  const m = /^\/(matches|partidos)\/([A-Za-z0-9_-]+)(?:[/?#]|$)/.exec(url);
  if (!m) return null;
  return m[1] === 'partidos' && PARTIDOS_SCREENS.has(m[2]) ? null : m[2];
}
