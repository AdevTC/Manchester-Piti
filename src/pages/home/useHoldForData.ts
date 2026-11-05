import { useEffect, useState } from "react";

/**
 * Whether Inicio holds its content back while the club's data is still coming (at most `cap` ms). Arriving from the
 * app's shell (the service worker's copy), the data bundle is still downloading at the first paint: Inicio painted a
 * stand-in portada («Pretemporada», a small lens) that the real one replaced a moment later, pushing everything below
 * it 270–440 px down (the field's layout shift on Inicio). Now the header, the sky and the dock paint at once and the
 * portada comes in whole. The server-painted page and a change of page have the data already: they never hold. Once
 * the content is shown it stays (a later refetch never blanks it), and a slow or failed load never holds it longer
 * than `cap` (the stand-in then, as before).
 */
export function useHoldForData(loading: boolean, cap = 4000): boolean {
  const [released, setReleased] = useState(!loading);
  // (latched in the render that already shows the content, as React adjusts state from a prop: nothing changes on
  // screen)
  if (!loading && !released) setReleased(true);
  useEffect(() => {
    if (released || !loading) return;
    const timer = setTimeout(() => setReleased(true), cap);
    return () => clearTimeout(timer);
  }, [loading, released, cap]);
  return loading && !released;
}
