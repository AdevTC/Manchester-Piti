// The PA- boards' three small drawings: the sun around a kick-off (Previa), our points jornada by jornada with
// «Como mucho, N» and the «¿Y si…?» path (Tabla, before the league publishes), and our place after each table.
import { sunPosition } from "../../../lib/derived/sun";
import { clockTime as hhmm } from "../vidrio/model";
import type { Picks } from "./views";
import type { PMatch } from "./season";

const r1 = (n: number) => Math.round(n * 10) / 10;

export function SunCurve({ m }: { m: PMatch }) {
  const W = 300;
  const H = 66;
  const t0 = m.at - 2 * 3_600_000;
  const t1 = m.at + 2 * 3_600_000;
  const pts: number[] = [];
  let max = 0;
  let min = 0;
  for (let i = 0; i <= 24; i++) {
    const el = sunPosition(t0 + ((t1 - t0) * i) / 24).elevation;
    pts.push(el);
    max = Math.max(max, el);
    min = Math.min(min, el);
  }
  const top = Math.max(20, max + 4);
  const bot = Math.min(-8, min);
  const Y = (e: number) => r1(4 + ((top - e) / (top - bot)) * (H - 18));
  const d = pts.map((e, k) => `${k ? "L" : "M"}${r1((k / 24) * W)} ${Y(e)}`).join(" ");
  const hz = Y(0);
  const kx = W / 2;
  const ky = Y(sunPosition(m.at).elevation);
  const ex = W / 2 + (W / 4) * (m.dur / 60);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" className="pa-sunsvg">
      <rect x={kx} y={0} width={Math.round(ex - kx)} height={H - 14} className="pa-sun__match" />
      <path d={`${d} L${W} ${hz} L0 ${hz}Z`} className="pa-sun__fill" />
      <path d={d} className="pa-sun__line" />
      <line x1={0} x2={W} y1={hz} y2={hz} className="pa-sun__hz" />
      <line x1={kx} x2={kx} y1={0} y2={H - 14} className="pa-sun__ko" />
      <circle cx={kx} cy={ky} r={5} className="pa-sun__dot" />
      <text x={2} y={H - 2} className="pa-sun__t">
        {hhmm(t0)}
      </text>
      <text x={kx} y={H - 2} className="pa-sun__t" textAnchor="middle">
        {hhmm(m.at)} pitido
      </text>
      <text x={W - 2} y={H - 2} className="pa-sun__t" textAnchor="end">
        {hhmm(t1)}
      </text>
    </svg>
  );
}

export function PointsPath({ ms, picks }: { ms: readonly PMatch[]; picks: Picks }) {
  const n = ms.length;
  const W = 320;
  const H = 150;
  const maxP = Math.max(3, n * 3);
  const px = (i: number) => r1(22 + (i * (W - 34)) / Math.max(1, n));
  const py = (p: number) => r1(H - 22 - (p / maxP) * (H - 40));
  let real = `M${px(0)} ${py(0)}`;
  let sim = "";
  let p = 0;
  let s = 0;
  let last = 0;
  const dots: { k: string; cx: number; cy: number; r: number; cls: string }[] = [];
  ms.forEach((m, k) => {
    if (m.score && m.letter) {
      p += m.letter === "G" ? 3 : m.letter === "E" ? 1 : 0;
      s = p;
      real += ` L${px(k + 1)} ${py(p)}`;
      last = k + 1;
      dots.push({ k: `r${k}`, cx: px(k + 1), cy: py(p), r: 4, cls: `pa-pts__dot${m.state === "directo" ? " is-prov" : ""}` });
    } else if (picks[m.id]) {
      if (!sim) sim = `M${px(k)} ${py(s)}`;
      s += picks[m.id] === "G" ? 3 : picks[m.id] === "E" ? 1 : 0;
      sim += ` L${px(k + 1)} ${py(s)}`;
      dots.push({ k: `s${k}`, cx: px(k + 1), cy: py(s), r: 3.5, cls: "pa-pts__sim" });
    }
  });
  const bestP = p + (n - last) * 3;
  const step = maxP > 30 ? 15 : 3;
  const grid: number[] = [];
  for (let i = 0; i <= maxP; i += step) grid.push(i);
  const labs = ms.filter((_m, k) => n <= 8 || k % 5 === 0 || k === n - 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="pa-ptssvg">
      {grid.map((i) => (
        <g key={i}>
          <line x1={20} x2={W - 6} y1={py(i)} y2={py(i)} className="pa-pts__g" />
          <text x={16} y={py(i) + 4} textAnchor="end" className="pa-pts__t">
            {i}
          </text>
        </g>
      ))}
      <path d={`M${px(last)} ${py(p)} L${px(n)} ${py(bestP)}`} className="pa-pts__best" />
      <text x={px(n) - 2} y={py(bestP) - 7} textAnchor="end" className="pa-pts__t pa-pts__t--b">
        Como mucho, {bestP}
      </text>
      {sim && <path d={sim} className="pa-pts__simline" />}
      <path d={real} className="pa-pts__line" />
      {dots.map((d) => (
        <circle key={d.k} cx={d.cx} cy={d.cy} r={d.r} className={d.cls} />
      ))}
      {labs.map((m) => (
        <text key={m.id} x={px(ms.indexOf(m) + 1)} y={H - 4} textAnchor="middle" className="pa-pts__t">
          J{m.j}
        </text>
      ))}
    </svg>
  );
}

export function PositionLine({ series, teams }: { series: readonly { j: number; p: number }[]; teams: number }) {
  if (!series.length) return null;
  const W = 320;
  const H = 150;
  const n = Math.max(series.length, 2);
  const px = (i: number) => r1(24 + (i * (W - 36)) / (n - 1));
  const py = (p: number) => r1(12 + ((p - 1) / Math.max(1, teams - 1)) * (H - 34));
  const d = series.map((s, i) => `${i ? "L" : "M"}${px(i)} ${py(s.p)}`).join(" ");
  const lastI = series.length - 1;
  const grid = [...new Set([1, Math.ceil(teams / 2), teams])];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="pa-ptssvg">
      {grid.map((p) => (
        <g key={p}>
          <line x1={20} x2={W - 6} y1={py(p)} y2={py(p)} className="pa-pts__g" />
          <text x={16} y={py(p) + 4} textAnchor="end" className="pa-pts__t">
            {p}º
          </text>
        </g>
      ))}
      <path d={d} className="pa-pts__line" />
      {series.map((s, i) => (
        <circle key={`${s.j}-${i}`} cx={px(i)} cy={py(s.p)} r={i === lastI ? 5 : 3} className={`pa-pts__dot${i === lastI ? " is-last" : ""}`} />
      ))}
      {series.map((s, i) =>
        i % 4 === 0 || i === lastI ? (
          <text key={`l${s.j}-${i}`} x={px(i)} y={H - 4} textAnchor="middle" className="pa-pts__t">
            J{s.j}
          </text>
        ) : null,
      )}
      <text x={px(lastI)} y={py(series[lastI].p) - 9} textAnchor={lastI > n - 3 ? "end" : "middle"} className="pa-pts__t pa-pts__t--b">
        {series[lastI].p}º
      </text>
    </svg>
  );
}
