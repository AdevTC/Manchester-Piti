// Where the chrome mounts «Buscar» (SearchLauncher). The public pages are server-rendered for fans, so this
// renders nothing on the server and while the browser hydrates (the server snapshot below): the fans' HTML and
// first paint stay exactly what they were. Right after, for everyone, the button's small chunk loads; the
// dialog and its data hooks load only when it opens. The header places it in the bell's slot (Chrome.tsx), so
// no sibling moves and React's ids stay the server's.
import { lazy, Suspense, useSyncExternalStore } from "react";

const SearchLauncher = lazy(() => import("./SearchLauncher").then((m) => ({ default: m.SearchLauncher })));

const noop = () => () => undefined;
/** false on the server and during hydration, true once the browser owns the page. */
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

export function SearchGate() {
  if (!useHydrated()) return null;
  return (
    <Suspense fallback={null}>
      <SearchLauncher />
    </Suspense>
  );
}
