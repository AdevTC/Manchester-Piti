// Where the chrome mounts the bell (NoticesBell). The public pages are server-rendered for fans, so this renders
// nothing on the server and while the browser hydrates (the HTML and the first paint stay exactly the fan's);
// right after, the bell's chunk loads for everyone (V-Integracion: the bell is in every top bar): a member reads
// his notices there (once RootLayout knows him: hooks/viewerSignal), a fan only chooses his «Avisos a medida» and
// opens no listener. The header places it in a slot it already had, so no sibling moves and React's ids stay
// the server's (Chrome.tsx).
import { lazy, Suspense, useSyncExternalStore } from "react";
import { usePublishedViewer } from "../../hooks/viewerSignal";

const NoticesBell = lazy(() => import("./NoticesBell").then((m) => ({ default: m.NoticesBell })));
const FanBell = lazy(() => import("./NoticesBell").then((m) => ({ default: m.FanBell })));

const noop = () => () => undefined;
/** false on the server and during hydration, true once the browser owns the page. */
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

export function NoticesGate() {
  const member = usePublishedViewer().member;
  if (!useHydrated()) return null;
  return <Suspense fallback={null}>{member ? <NoticesBell /> : <FanBell />}</Suspense>;
}
