// /pizarra: the new board behind its switch (`?v2`, remembered on this device; `?v2=0` turns it off),
// otherwise the current one, unchanged. Each loads on its own, so neither pays for the other.
import { lazy, Suspense } from "react";
import { RoutePending } from "../../components/route-states";
import { usePizarraV2 } from "./v2/flag";
// Loaded with the route: it remembers ?tablero= and #panel before the season sync rewrites the URL.
import "./v2/deeplink";

const Current = lazy(() => import("./Pizarra").then((m) => ({ default: m.Pizarra })));
const Next = lazy(() => import("./v2/PizarraV2").then((m) => ({ default: m.PizarraV2 })));

export function PizarraRoute() {
  const v2 = usePizarraV2();
  return <Suspense fallback={<RoutePending />}>{v2 ? <Next /> : <Current />}</Suspense>;
}
