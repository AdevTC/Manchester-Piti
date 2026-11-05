// Estadísticas' headline is Anton, a face no other page paints: the browser fetches it only once the headline is laid
// out, so the page arrived with the headline in Archivo and swapped it to Anton a moment later (font-display: swap).
// The HTML preloads it when Estadísticas is the first page (vite.config ROUTE_FONTS); arriving from another page, the
// route waits for it (from the service worker or the HTTP cache it is a few milliseconds; never more than `cap`)
// before the change of page paints. Not while preloading the route (at idle, on a touch's intent): loading the face
// then would re-measure the other pages' text that names Anton first in its fonts (the strut of its lines), a
// sub-pixel change on the page being read.
export const HEADLINE_FONT = "1em Anton";

export function headlineFont({ preload }: { preload: boolean }, cap = 400, doc: Document | undefined = typeof document === "undefined" ? undefined : document): Promise<void> | undefined {
  const fonts = doc?.fonts;
  if (preload || !fonts || typeof fonts.load !== "function" || fonts.check(HEADLINE_FONT)) return undefined;
  return Promise.race([
    fonts.load(HEADLINE_FONT).then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((done) => setTimeout(done, cap)),
  ]);
}
