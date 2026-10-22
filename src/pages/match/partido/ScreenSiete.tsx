// «El partido» · the Siete screen (P- boards, place-siete). Stub until ported.
import type { PageCtx } from "./ctx";


export function ScreenSiete({ c }: { c: PageCtx }) {
  return <section className="pp-place pp-place--siete" aria-label="Siete">{c.fase}</section>;
}
