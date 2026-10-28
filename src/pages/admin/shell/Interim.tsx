// TEMPORARY (r12): today's view of a screen inside the new frame, until wave 2 draws the screen (see interimSearch.ts).
// `search`: what the old view used to read from the address. `head`: the frame's header for it. Below 1100 today's
// views drew no h1 (the old phone header was it): the screen keeps one for the readers, visually hidden (`h1`
// false inside a match, whose head has it).
import { useMemo, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useFrame } from "../ui/frame";
import { useSalaHead, type SalaHead } from "./head";
import { InterimSearchContext, type ViewSearch } from "./interimSearch";
import { screenOf } from "./places";

export function Interim({ search, head, h1 = true, children }: { search?: ViewSearch; head?: SalaHead | null; h1?: boolean; children: ReactNode }) {
  const { desktop } = useFrame();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useSalaHead(head ?? null);
  // (a new object only when the values change: the old views' effects depend on what they read; plain values only)
  const key = search ? JSON.stringify(search) : "";
  const given = useMemo(() => (key ? (JSON.parse(key) as ViewSearch) : null), [key]);
  return (
    <InterimSearchContext.Provider value={given}>
      <div className={`sc-interim ${desktop ? "ws" : "mws"}`}>
        {h1 && !desktop && <h1 className="sc-vh">{head?.title ?? screenOf(pathname).title}</h1>}
        {children}
      </div>
    </InterimSearchContext.Provider>
  );
}
