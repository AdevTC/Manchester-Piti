import { z } from "zod";
import { analysisSearchFields } from "./analysisSearch";

/**
 * The match page's tabs, in order, as they read in the old URL (/matches/<id>?tab=vestuario).
 * «cronica» is the first tab whatever it shows (Previa, Directo, Acta pendiente or Crónica) and
 * is the clean URL: no `tab` means it. The push notices (functions/src/pushLogic.ts) write the
 * same ids.
 */
export const MATCH_TABS = ["cronica", "campo", "pulso", "vestuario", "estadisticas"] as const;
export type MatchTab = (typeof MATCH_TABS)[number];

/** The match route's `validateSearch`: an unknown or absent tab reads as the first one. The screens are
 *  addresses now (/partidos/<id>/siete…; an old ?tab= redirects there, lib/legacyUrls): `tab` stays for
 *  today's Pulso until the match page lands. ?min=21 opens the page at that minute; sheets are ?hoja=. */
export const matchSearchSchema = z.object({
  ...analysisSearchFields,
  tab: z.enum(MATCH_TABS).optional().catch(undefined),
  min: z.coerce.number().int().min(0).max(200).optional().catch(undefined),
  hoja: z.enum(["cartel", "momento", "avisos"]).optional().catch(undefined),
});

/** The tab's position (0 = crónica for anything absent). */
export const matchTabIndex = (tab: MatchTab | undefined): number => (tab ? MATCH_TABS.indexOf(tab) : 0);

/** The URL value of the tab at `index` (undefined for the first: its clean URL). */
export const matchTabAt = (index: number): MatchTab | undefined => (index > 0 ? MATCH_TABS[index] : undefined);
