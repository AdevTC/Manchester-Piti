// «Hoy» on the home: above the hero, for members on match day (spec §1). The home is server-rendered for
// fans, so this renders nothing on the server and while the browser hydrates (the HTML and the first paint
// stay exactly the fan's), and nothing for a fan or outside the match-day window: a fan never loads the
// card, never reads member data and never sees the page move. Once a member is known (useViewer) and
// lib/derived/hoy says it is match day, the card's chunk loads (its own CSS with it) and mounts.
import { lazy, Suspense, useSyncExternalStore } from "react";
import type { ClubMatch } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";
import { useViewer } from "../../hooks/useViewer";
import { hoyModel } from "../../lib/derived/hoy";

const HoyCard = lazy(() => import("../../components/celeste/HoyCard").then((m) => ({ default: m.HoyCard })));

const subscribeNothing = () => () => {};
/** False on the server and during hydration, true once the browser has taken over (React re-renders then). */
const useHydrated = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);

export function HomeHoy({ matches, players, now }: { matches: readonly ClubMatch[]; players: readonly PlayerDoc[]; now: number }) {
  const viewer = useViewer();
  const hydrated = useHydrated();
  if (!hydrated || !hoyModel(matches, viewer, now)) return null;
  return (
    <Suspense fallback={null}>
      <HoyCard matches={matches} players={players} now={now} className="hm-hoy" />
    </Suspense>
  );
}
