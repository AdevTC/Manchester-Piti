// The vestuario's member-only blocks, each its own chunk (lib/lazyBlock): the route's chunk is what a
// visitor at the door downloads, so La caja, Ausencias, Encuestas, «Hoy», the turnos line and the cromos banner stay out
// of it. VestuarioPage (rendered only for members, RootLayout) waits for them all on its first render
// (useMemberBlocks), so everything paints together: no block pops in, nothing moves.
import { lazyBlock, useBlocksReady } from "../../lib/lazyBlock";
import type { recapBannerSeason as RecapBannerSeason } from "../perfil/recapView";

export const Caja = lazyBlock(() => import("./Caja").then((m) => m.Caja), (p) => p.member && !!p.seasonId);
export const Ausencias = lazyBlock(() => import("./Ausencias").then((m) => m.Ausencias), (p) => p.member);
export const Encuestas = lazyBlock(() => import("./Encuestas").then((m) => m.Encuestas), (p) => p.member);
export const RecapBanner = lazyBlock(() => import("./RecapBanner").then((m) => m.RecapBanner));
export const HoyCard = lazyBlock(() => import("../../components/celeste/HoyCard").then((m) => m.HoyCard));
export const MatchTurnsLine = lazyBlock(() => import("../../components/celeste/Turnos").then((m) => m.MatchTurnsLine), (p) => p.enabled);

// The banner's window (perfil/recapView, with the season recap behind it): a plain function, loaded with the blocks.
let bannerSeason: typeof RecapBannerSeason | undefined;
let recapPending: Promise<void> | undefined;
const recapView = {
  preload: (): Promise<void> =>
    (recapPending ??= import("../perfil/recapView").then(
      (m) => {
        bannerSeason = m.recapBannerSeason;
      },
      () => {
        bannerSeason = () => null;
      },
    )),
};
/** recapBannerSeason once loaded (useMemberBlocks has waited for it); null before. */
export const recapBanner = (...args: Parameters<typeof RecapBannerSeason>): string | null => bannerSeason?.(...args) ?? null;

const BLOCKS = [Caja, Ausencias, Encuestas, RecapBanner, HoyCard, MatchTurnsLine, recapView] as const;
/** Suspends the page's first render until every member block is in (one parallel download, cached after). */
export const useMemberBlocks = (): void => useBlocksReady(BLOCKS);
