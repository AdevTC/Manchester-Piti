// r14 «La pizarra» · Partido: the place's two slices — "pt-feed" (what feed.tsx reads from the app: la mesa, the
// acta, the clock…) and "partido" (its own state: who can't go on, the confirm, the views, the proposal). Light: the
// shell's sublabel, badge and primary action read them without loading the components.
import type { PzApi } from "../../store/api";
import { EMPTY_FEED, UI0, type PtFeed, type PtUi } from "./partidoView";

export const FEED = "pt-feed";
export const UI = "partido";

/** The feed (EMPTY_FEED until the bridge has read). */
export const feedOf = (P: PzApi): PtFeed => P.slice<PtFeed>(FEED, EMPTY_FEED).get() ?? EMPTY_FEED;
/** The place's own state. */
export const uiOf = (P: PzApi): PtUi => ({ ...UI0, ...(P.slice<PtUi>(UI, UI0).get() ?? {}) });
/** A change of the place's own state that isn't undoable nor toasted (a view, a confirm, a pick). */
export const setUi = (P: PzApi, patch: Partial<PtUi>) => P.slice<PtUi>(UI, UI0).set(patch, { undoable: false, toast: false });
