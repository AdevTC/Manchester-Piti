// r14 «La pizarra» · PiCampo's overlay (pure): drawings and play paths in pitch units (x 0–100, y 0–100 on a 2:3
// plane): a 2-point carrera curves, a zona closes and fills, every kind but zona/lápiz gets an arrowhead coloured
// like its stroke (compensated for the plane's 2:3 so it is not squashed), and a label sits at the centroid (a zone's
// at its top-right edge).
import type { Overlay } from "../store/types";
import { round2 } from "./geometry";

export interface DrawnPath {
  d: string;
  cls: string;
}
export interface PathLabel {
  x: number;
  y: number;
  t: string;
  cls: string;
}

const pt = (q: readonly [number, number]) => `${round2(q[0])} ${round2(q[1])}`;

export function overlayPaths(ov: Overlay | null | undefined): { paths: DrawnPath[]; heads: DrawnPath[]; labels: PathLabel[] } {
  const paths: DrawnPath[] = [];
  const heads: DrawnPath[] = [];
  const labels: PathLabel[] = [];
  if (!ov || !ov.paths) return { paths, heads, labels };
  for (const d of ov.paths) {
    const pts = d.pts ?? [];
    const color = d.color ? ` c-${d.color}` : "";
    if (d.d) {
      paths.push({ d: d.d, cls: `k-${d.kind || "lapiz"}${color}` });
      continue;
    }
    if (pts.length < 2) continue;
    let path: string;
    if (d.kind === "zona") path = `M${pts.map(pt).join(" L")} Z`;
    else if (pts.length === 2 && d.kind === "carrera") {
      const [a, c] = pts;
      const mx = (a[0] + c[0]) / 2 + (c[1] - a[1]) * 0.18;
      const my = (a[1] + c[1]) / 2 - (c[0] - a[0]) * 0.18;
      path = `M${pt(a)} Q${round2(mx)} ${round2(my)} ${pt(c)}`;
    } else path = `M${pts.map(pt).join(" L")}`;
    paths.push({ d: path, cls: `k-${d.kind || "flecha"}${color}` });
    if (d.kind !== "zona" && d.kind !== "lapiz") {
      const a = pts[pts.length - 2];
      const c = pts[pts.length - 1];
      const ang = Math.atan2((c[1] - a[1]) * 1.5, c[0] - a[0]);
      const L = 3.2;
      const W = 1.7;
      const bx = c[0] - Math.cos(ang) * L;
      const by = c[1] - (Math.sin(ang) * L) / 1.5;
      const px = -Math.sin(ang) * W;
      const py = (Math.cos(ang) * W) / 1.5;
      heads.push({
        d: `M${pt(c)} L${round2(bx + px)} ${round2(by + py)} L${round2(bx - px)} ${round2(by - py)} Z`,
        cls: d.color ? `c-${d.color}` : d.kind === "pase" ? "w" : "",
      });
    }
    if (d.label) {
      if (d.kind === "zona") {
        const top = Math.min(...pts.map((q) => q[1]));
        const right = Math.max(...pts.map((q) => q[0]));
        labels.push({ x: round2(right), y: round2(Math.max(2.5, top - 2.2)), t: d.label, cls: "is-end" });
      } else {
        const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
        const cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
        labels.push({ x: round2(cx), y: round2(cy), t: d.label, cls: "" });
      }
    }
  }
  return { paths, heads, labels };
}
