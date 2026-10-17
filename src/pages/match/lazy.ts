// The match page's parts a fan never uses, out of its chunk: the poster's canvas renderer (only when
// someone asks for the cartel). Scoring lives in la mesa (/matches/$matchId/mesa), its own route.
import type { downloadMatchPoster as DownloadMatchPoster } from "../../lib/matchPoster";

/** lib/matchPoster's downloadMatchPoster, its code fetched on the first tap. */
export const downloadMatchPoster = (...args: Parameters<typeof DownloadMatchPoster>): ReturnType<typeof DownloadMatchPoster> =>
  import("../../lib/matchPoster").then((m) => m.downloadMatchPoster(...args));
