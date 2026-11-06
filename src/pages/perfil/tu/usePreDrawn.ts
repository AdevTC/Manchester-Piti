// A share image drawn before the tap. Safari (iPhone) only opens the share sheet inside the tap's own gesture, and an
// await before navigator.share spends it: «Compartir» then fell back to «te hemos copiado el enlace». So the PNG is
// drawn as soon as what it shows is chosen (and again on every change, a moment later), and «Compartir» sends the
// ready one straight away — the pizarra's cartel does the same (pz/sheets/compartir).
import { useEffect, useRef, useState } from "react";

/** The PNG for `key` once drawn (null while it is being drawn, or with no key). `draw` is called with the latest
 *  props; a change of `key` draws again after `delay` ms. */
export function usePreDrawn(key: string | null, draw: () => Promise<Blob | null>, delay = 120): Blob | null {
  const [img, setImg] = useState<{ key: string; blob: Blob } | null>(null);
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });
  useEffect(() => {
    if (key === null) return;
    let off = false;
    const t = window.setTimeout(() => {
      drawRef
        .current()
        .then((blob) => {
          if (!off && blob) setImg({ key, blob });
        })
        .catch(() => {
          /* the tap draws it then, as before */
        });
    }, delay);
    return () => {
      off = true;
      window.clearTimeout(t);
    };
  }, [key, delay]);
  return img && img.key === key ? img.blob : null;
}
