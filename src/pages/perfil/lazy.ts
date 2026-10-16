// The perfil's overlays, out of its chunk: «Tu temporada en 10 cromos» (RecapStory, with its sheet) and
// the share studio (ShareStudio, with the shareDraw canvas renderer). Both open on a tap, over the page,
// so nothing moves while they arrive; ProfilePage fetches them once the page is up (preloadOverlays).
import { lazyBlock } from "../../lib/lazyBlock";

export const RecapStory = lazyBlock(() => import("./RecapStory").then((m) => m.RecapStory));
export const ShareStudio = lazyBlock(() => import("./ShareStudio").then((m) => m.ShareStudio));

/** Starts both downloads (cached): by the first tap they are usually in. */
export function preloadOverlays(): void {
  void RecapStory.preload();
  void ShareStudio.preload();
}
