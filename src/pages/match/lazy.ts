// The match page's parts a fan never uses, out of its chunk: the Mesa de partido (Banda, with the quick
// entry and the live model behind it: scorers and captains only, mounted while the match is on) and the
// poster's canvas renderer (only when someone asks for the cartel).
import { lazyBlock } from "../../lib/lazyBlock";
import type { downloadMatchPoster as DownloadMatchPoster } from "../../lib/matchPoster";

export const Banda = lazyBlock(() => import("./Banda").then((m) => m.Banda));

/** lib/matchPoster's downloadMatchPoster, its code fetched on the first tap. */
export const downloadMatchPoster = (...args: Parameters<typeof DownloadMatchPoster>): ReturnType<typeof DownloadMatchPoster> =>
  import("../../lib/matchPoster").then((m) => m.downloadMatchPoster(...args));
