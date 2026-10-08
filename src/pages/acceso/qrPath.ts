// The QR of a link as one path of 1×1 modules: the card's SVG (Qr.tsx) and the profile's share image
// (canvas Path2D) draw exactly the same code.
import { encode } from "uqr";

/** `n` modules a side, no quiet zone (the caller adds two modules of white around it). */
export function qrPath(text: string): { d: string; n: number } {
  const { data, size } = encode(text, { ecc: "M", border: 0 });
  let path = "";
  data.forEach((row, y) => row.forEach((on, x) => on && (path += `M${x} ${y}h1v1h-1z`)));
  return { d: path, n: size };
}
