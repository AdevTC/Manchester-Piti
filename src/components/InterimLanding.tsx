// Landing where an old link meant, until each page's redesign gives its screens their own component:
// a new address that points at a block of today's page (/vestuario/caja, /club/historia…) scrolls to it once it
// is there, as its old #hash did; /vestuario#vx-mvp («Vota al MVP» from old notices) opens the last voted
// match's Vestuario once the matches are in. Mounted by the layout; renders nothing.
import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { anchorAt } from "../lib/interimScreens";
import { useClubData } from "../lib/clubData";
import { lastVotedMatch } from "../lib/vestuario";

/** How long a block may take to arrive (its data) before the page is left where it is. */
const WAIT_MS = 8000;

export function InterimLanding() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hash = useRouterState({ select: (s) => s.location.hash });
  const anchor = anchorAt(pathname);
  useEffect(() => {
    if (!anchor || typeof document === "undefined") return;
    let done = false;
    let later = 0;
    const land = () => {
      const el = document.getElementById(anchor);
      if (!el || done) return !!el;
      done = true;
      // (a jump, as the old #hash did; just after the router has put the new page at the top)
      later = window.setTimeout(() => el.scrollIntoView?.({ block: "start" }), 60);
      return true;
    };
    // (the visitor moving first wins: the page is not pulled from under them)
    const stop = () => {
      done = true;
      observer.disconnect();
      window.clearTimeout(timer);
      for (const e of ["wheel", "touchstart", "keydown"]) window.removeEventListener(e, stop);
    };
    const observer = new MutationObserver(() => {
      if (land()) stop();
    });
    const timer = window.setTimeout(stop, WAIT_MS);
    if (!land()) {
      observer.observe(document.body, { childList: true, subtree: true });
      for (const e of ["wheel", "touchstart", "keydown"]) window.addEventListener(e, stop, { passive: true });
    }
    return () => {
      stop();
      window.clearTimeout(later);
    };
  }, [anchor, pathname]);
  return pathname.replace(/\/+$/, "") === "/vestuario" && hash === "vx-mvp" ? <LastVoteRedirect /> : null;
}

function LastVoteRedirect() {
  const { matches, loading } = useClubData();
  const navigate = useNavigate();
  const last = loading ? undefined : lastVotedMatch(matches);
  useEffect(() => {
    if (last) void navigate({ to: "/partidos/$matchId/vestuario", params: { matchId: last.id }, replace: true });
  }, [last, navigate]);
  return null;
}
