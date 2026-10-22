// «El partido» · the Vestuario screen (P- boards, place-vestuario). Stub until ported.
import type { PageCtx } from "./ctx";
import type { VestuarioState } from "./vestuarioState";

export function ScreenVestuario({ c, v }: { c: PageCtx; v: VestuarioState }) {
  return <section className="pp-place pp-place--vestuario" aria-label="Vestuario">{c.fase} {v.badge}</section>;
}
