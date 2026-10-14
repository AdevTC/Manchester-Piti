import { isFeatureNew, type NewFeature } from "../lib/derived/isNew";

/**
 * The small gold «nuevo» pill, for as long as its feature is new (see NEW_FEATURES). Each page family keeps
 * its own look through the class: "st-new" (Estadísticas, El club, Jugador) or "nv" (the vestuario door, Perfil).
 * `now` is for tests; the page's clock is the render's.
 */
export function NewBadge({ feature, look = "st-new", now }: { feature: NewFeature; look?: "st-new" | "nv"; now?: number }) {
  if (!isFeatureNew(feature, now)) return null;
  return <span className={look}>nuevo</span>;
}
