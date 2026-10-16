// Where the chrome mounts the bell (NoticesBell). The public pages are server-rendered for fans, so this renders
// nothing on the server and while the browser hydrates (the published viewer is the fan's there: the HTML and
// the first paint stay exactly the fan's), and nothing for a fan: a fan never loads the bell's chunk, never
// opens a listener. Once RootLayout knows a member (hooks/viewerSignal) the chunk loads, its CSS with it. The
// header places it in a slot it already had, so no sibling moves and React's ids stay the server's (Chrome.tsx).
import { lazy, Suspense } from "react";
import { usePublishedViewer } from "../../hooks/viewerSignal";

const NoticesBell = lazy(() => import("./NoticesBell").then((m) => ({ default: m.NoticesBell })));

export function NoticesGate() {
  if (!usePublishedViewer().member) return null;
  return (
    <Suspense fallback={null}>
      <NoticesBell />
    </Suspense>
  );
}
