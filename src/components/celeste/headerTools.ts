// The top bar's tools, «Buscar» and the bell (SearchGate, NoticesGate): their code is sent for once the browser owns
// the page, and they show together once who is looking is known (viewerSignal), so they come in where they stay.
// They used to show as soon as each chunk arrived: the magnifier came in beside «Entrar», then «Entrar» became a
// member's avatar (narrower) and the bell came in, and the magnifier slid across twice (a layout shift on every page).
// If the session is never checked (Firebase can't load) they show anyway after SAFETY_MS.
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePublishedViewerKnown } from "../../hooks/viewerSignal";

export interface HeaderTools {
  SearchLauncher: typeof import("./SearchLauncher").SearchLauncher;
  NoticesBell: typeof import("./NoticesBell").NoticesBell;
  FanBell: typeof import("./NoticesBell").FanBell;
}

export const SAFETY_MS = 8000;
let sent: Promise<HeaderTools> | null = null;
let ready: HeaderTools | null = null;
const load = () =>
  (sent ??= Promise.all([import("./SearchLauncher"), import("./NoticesBell")]).then(
    ([s, n]) => (ready = { SearchLauncher: s.SearchLauncher, NoticesBell: n.NoticesBell, FanBell: n.FanBell }),
    (error: unknown) => {
      // (a chunk that didn't arrive: the next page tries again)
      sent = null;
      throw error;
    },
  ));

const noop = () => () => undefined;
/** false on the server and during hydration, true once the browser owns the page. */
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

/** The tools' code once both are in and who is looking is known; null until then (and on the server). */
export function useHeaderTools(): HeaderTools | null {
  const hydrated = useHydrated();
  const known = usePublishedViewerKnown();
  const [tools, setTools] = useState(ready);
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!hydrated || tools) return;
    let on = true;
    load().then(
      (t) => on && setTools(t),
      () => undefined,
    );
    return () => {
      on = false;
    };
  }, [hydrated, tools]);
  useEffect(() => {
    if (!hydrated || known) return;
    const t = window.setTimeout(() => setLate(true), SAFETY_MS);
    return () => window.clearTimeout(t);
  }, [hydrated, known]);
  return hydrated && (known || late) ? tools : null;
}
