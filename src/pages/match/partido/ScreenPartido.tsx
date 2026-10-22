// «El partido» · the Partido screen (P- boards, place-partido). Stub until ported.
import type { PageCtx } from "./ctx";
import type { Avisos } from "./avisos";

export function ScreenPartido({ c }: { c: PageCtx; avisos: Avisos }) {
  return <section className="pp-place pp-place--partido" aria-label="Partido">{c.fase}</section>;
}
