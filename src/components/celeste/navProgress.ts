// A change of page that has to wait — its code still downloading on a slow connection, the first time — shows a thin
// celeste line across the top, a broadcast's LED strip filling: only after 160 ms (a quick change never shows it).
// It fills slowly while the page is on its way, then runs to the end and fades as soon as the page moves
// (styles/navprogress.css). Outside React: no render for it.
import type { AnyRouter } from "@tanstack/react-router";
import { onViewTransition } from "./pageTransition";
import "../../styles/navprogress.css";

export const NAV_PROGRESS_DELAY = 160;

export function navProgress(router: AnyRouter, doc: Document = document): () => void {
  const bar = doc.createElement("div");
  bar.className = "vd-navprogress";
  bar.setAttribute("aria-hidden", "true");
  doc.body.append(bar);
  const win = doc.defaultView ?? window;
  let timer = 0;
  const show = () => {
    delete bar.dataset.done;
    // (from empty each time: the fill restarts)
    void bar.offsetWidth;
    bar.dataset.on = "";
  };
  const done = () => {
    win.clearTimeout(timer);
    timer = 0;
    if (!("on" in bar.dataset)) return;
    delete bar.dataset.on;
    bar.dataset.done = "";
  };
  const offStart = router.subscribe("onBeforeLoad", (e) => {
    if (!e.pathChanged) return;
    win.clearTimeout(timer);
    timer = win.setTimeout(show, NAV_PROGRESS_DELAY);
  });
  const offEnd = router.subscribe("onResolved", done);
  // (the transition starts once the page is in: the line is done by then)
  const offVt = onViewTransition(done);
  return () => {
    offStart();
    offEnd();
    offVt();
    done();
    bar.remove();
  };
}
