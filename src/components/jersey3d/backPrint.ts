// How the kit prints a back, in the scene's 540×600 still (measured on its stills, prints.ts drawPrints): the
// name's caps on rows 113–157 in Barlow Condensed 700, squeezed to .93 and condensed further (never shorter) to at
// most about 258 px wide (measured: «ADRIÁN T.C.» 237, the twelve letters of «MAXIMILIANOS» about 258); the number's caps on rows 191–380 in Barlow Condensed 600 squeezed to .915; both centred on
// x 270. The faces' caps are .7 em. A shirt that sets the print over a blank still (while the printed one renders)
// places it with these, so the swap to the real print doesn't move it.
export const BACK_PRINT = { name: { top: 113, cap: 44, maxW: 258, sx: 0.93 }, num: { top: 191, cap: 189, sx: 0.915 }, x: 270, capEm: 0.7 } as const;

/** The set name's horizontal squeeze for its natural (unsqueezed) width at font size `fontPx`: the kit's .93, less
 *  when the name would run past the print's 258 px; its height never changes. */
export function nameSqueeze(naturalW: number, fontPx: number): number {
  const room = (BACK_PRINT.name.maxW * fontPx * BACK_PRINT.capEm) / BACK_PRINT.name.cap;
  return naturalW > 0 && fontPx > 0 ? Math.min(BACK_PRINT.name.sx, room / naturalW) : BACK_PRINT.name.sx;
}

/** How long a typed name and number rest before the scene prints them on a still. */
export const PRINT_SETTLE_MS = 300;
