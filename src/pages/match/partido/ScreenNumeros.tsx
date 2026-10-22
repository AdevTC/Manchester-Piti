// «El partido» · the Numeros screen (P- boards, place-numeros). Stub until ported.
import type { PageCtx } from "./ctx";


export function ScreenNumeros({ c }: { c: PageCtx }) {
  return <section className="pp-place pp-place--numeros" aria-label="Numeros">{c.fase}</section>;
}
