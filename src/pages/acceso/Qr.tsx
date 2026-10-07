// A real QR code of a link, drawn as one SVG path (white quiet zone, club navy modules).
import { useMemo } from "react";
import { encode } from "uqr";

export function Qr({ text, label }: { text: string; label?: string }) {
  const { d, n } = useMemo(() => {
    const { data, size } = encode(text, { ecc: "M", border: 0 });
    let path = "";
    data.forEach((row, y) => row.forEach((on, x) => on && (path += `M${x} ${y}h1v1h-1z`)));
    return { d: path, n: size };
  }, [text]);
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} shapeRendering="crispEdges">
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
      <path d={d} fill="#0c1733" />
    </svg>
  );
}
