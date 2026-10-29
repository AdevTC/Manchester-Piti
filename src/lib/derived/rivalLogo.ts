// A rival's name folded to one spelling, and each rival's escudo. Kept apart from derived/rival (the dossier, which
// pulls the analytics) so Inicio, Partidos and the search can read the escudos without it.
import type { ClubMatch } from "../clubData";
import { dateMillis } from "../../../functions/src/matchEngine";

/** The one spelling of a rival's name the meetings are grouped by. */
export const rivalKey = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

type LogoSource = Pick<ClubMatch, "id" | "rival" | "rivalLogoUrl" | "date">;

/**
 * Each rival's escudo (rivalKey → its https link): the newest match against them that saved one, so a
 * fixture still to be played, or a table row, shows the escudo an earlier acta set.
 */
export function rivalLogos(matches: readonly LogoSource[]): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  const newest = [...matches].sort((a, b) => dateMillis(b.date) - dateMillis(a.date) || b.id.localeCompare(a.id));
  for (const m of newest) {
    const url = (m.rivalLogoUrl ?? "").trim();
    const key = rivalKey(m.rival || "");
    if (key && /^https:\/\/\S+$/i.test(url) && !out.has(key)) out.set(key, url);
  }
  return out;
}

/** The escudo of `name` in `logos` (rivalLogos), if any. */
export const logoOf = (logos: ReadonlyMap<string, string> | undefined, name: string | null | undefined): string | undefined =>
  name ? logos?.get(rivalKey(name)) : undefined;
