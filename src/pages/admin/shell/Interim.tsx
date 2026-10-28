// TEMPORARY (r12): today's view of a screen inside the new frame, until wave 2 draws the screen (see interimSearch.ts).
// `search`: what the old view used to read from the address. `title`/`sub`/`back`: the frame's header for it.
import { useMemo, type ReactNode } from "react";
import { useFrame } from "../ui/frame";
import { useSalaHead, type SalaHead } from "./head";
import { InterimSearchContext, type ViewSearch } from "./interimSearch";

export function Interim({ search, head, children }: { search?: ViewSearch; head?: SalaHead | null; children: ReactNode }) {
  const { desktop } = useFrame();
  useSalaHead(head ?? null);
  // (a new object only when the values change: the old views' effects depend on what they read; plain values only)
  const key = search ? JSON.stringify(search) : "";
  const given = useMemo(() => (key ? (JSON.parse(key) as ViewSearch) : null), [key]);
  return (
    <InterimSearchContext.Provider value={given}>
      <div className={`sc-interim ${desktop ? "ws" : "mws"}`}>{children}</div>
    </InterimSearchContext.Provider>
  );
}
