// The designed still: CDM Palomeras painted on a 2D canvas (first paint, no WebGL, Save-Data, reduced motion,
// a lost context). Same rigs, same sun and sky, same plates as the WebGL scene.
import { lightingOf, mix, smooth } from "./light";
import { horizonFraction, projector, sunScreen, type RigDef } from "./rigs";
import { COMPACT_W, fillPlate, MASTS, MAST_H, PITCH, placeFigures, plateLook, plateX, floodLevels } from "./scene";
import type { PalomerasState } from "./types";

export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Paints the still into `cv` at w×h CSS px (DPR ≤ 1.5) and lays out the plates in `platesEl`. */
export function paintStill(
  cv: HTMLCanvasElement,
  w: number,
  h: number,
  rig: RigDef,
  st: PalomerasState,
  platesEl?: HTMLElement | null,
): void {
  const dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 1.5);
  cv.width = Math.max(1, Math.round(w * dpr));
  cv.height = Math.max(1, Math.round(h * dpr));
  const g = cv.getContext("2d");
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { el, minutes, kind, sky: s } = lightingOf(st.at, st.weather);
  const P = projector(rig, w, h);
  const hy = horizonFraction(rig) * h;
  const L2 = PITCH.HL;
  const W2 = PITCH.HW;
  const fl = floodLevels(st.floodlights);
  const lit = fl.power[0];
  const night = s.night;

  /* sky */
  const gr = g.createLinearGradient(0, 0, 0, hy);
  gr.addColorStop(0, s.top);
  gr.addColorStop(0.55, s.mid);
  gr.addColorStop(1, s.hor);
  g.fillStyle = gr;
  g.fillRect(0, 0, w, hy + 2);
  const xy = sunScreen(minutes, el, rig);
  if (el > -1 && kind !== "lluvia") {
    const sg = g.createRadialGradient(xy.x * w, xy.y * h, 2, xy.x * w, xy.y * h, w * 0.5);
    sg.addColorStop(0, "rgba(255,236,190,.75)");
    sg.addColorStop(0.2, "rgba(255,214,150,.25)");
    sg.addColorStop(1, "rgba(255,214,150,0)");
    g.fillStyle = sg;
    g.fillRect(0, 0, w, hy);
    g.fillStyle = "#fff6e0";
    g.beginPath();
    g.arc(xy.x * w, xy.y * h, Math.max(7, w * 0.012), 0, 7);
    g.fill();
  }
  if (night > 0.5 && kind !== "lluvia") {
    const r = rng(5);
    g.fillStyle = "rgba(255,255,255,.8)";
    for (let i = 0; i < 90; i++) g.fillRect(r() * w, r() * hy * 0.8, 1.2, 1.2);
  }
  if (kind !== "despejado") {
    const rc = rng(9);
    const ct = kind === "lluvia" ? mix(s.mid, "#5d677c", 0.5) : mix(s.hor, "#ffffff", 0.4);
    for (let c = 0; c < 7; c++) {
      const cx = rc() * w;
      const cy = hy * (0.15 + rc() * 0.5);
      const cw = w * (0.18 + rc() * 0.22);
      const cg = g.createRadialGradient(cx, cy, 2, cx, cy, cw / 2);
      cg.addColorStop(0, ct);
      cg.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = 0.55;
      g.fillStyle = cg;
      g.beginPath();
      g.ellipse(cx, cy, cw / 2, cw / 7, 0, 0, 7);
      g.fill();
      g.globalAlpha = 1;
    }
  }

  /* rooftops along the horizon */
  const rb = rng(23);
  const sil = mix(mix("#0e1630", "#273455", 0.3), mix(s.hor, "#8996ab", 0.55), s.day);
  for (let x0 = -10; x0 < w + 10; ) {
    const bw = 18 + rb() * 46;
    const bh = 6 + rb() * hy * 0.09;
    g.fillStyle = sil;
    g.fillRect(x0, hy - bh, bw, bh + 2);
    if (night > 0.4) {
      g.fillStyle = "rgba(255,214,150,.75)";
      for (let k = 0; k < (bw * bh) / 90; k++) if (rb() < 0.4) g.fillRect(x0 + 3 + rb() * (bw - 6), hy - bh + 3 + rb() * (bh - 6), 2, 2.5);
    }
    x0 += bw + 2;
  }

  /* ground */
  g.fillStyle = mix("#1a2230", "#5d6670", s.day);
  g.fillRect(0, hy, w, h - hy);
  const poly = (pts: readonly (readonly [number, number, number])[], fill: string) => {
    const q: { x: number; y: number }[] = [];
    for (const p of pts) {
      const s2 = P(p[0], p[1], p[2]);
      if (!s2) return;
      q.push(s2);
    }
    g.fillStyle = fill;
    g.beginPath();
    q.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    g.fill();
  };
  const line = (a: readonly number[], b: readonly number[], col: string, wd = 1.2) => {
    const p1 = P(a[0], a[1], a[2]);
    const p2 = P(b[0], b[1], b[2]);
    if (!p1 || !p2) return;
    g.strokeStyle = col;
    g.lineWidth = wd;
    g.beginPath();
    g.moveTo(p1.x, p1.y);
    g.lineTo(p2.x, p2.y);
    g.stroke();
  };
  poly(
    [
      [-L2 - 11, 0, -W2 - 15],
      [L2 + 11, 0, -W2 - 15],
      [L2 + 11, 0, W2 + 15],
      [-L2 - 11, 0, W2 + 15],
    ],
    mix("#3d4352", "#a5aab0", s.day),
  );
  const turfK = Math.min(1, 0.42 + 0.58 * smooth(-6, 8, el) + 0.3 * lit * night);
  const t1 = mix("#0f2414", "#4e8e4b", turfK);
  const t2 = mix("#12291a", "#5a9a55", turfK);
  for (let i = 0; i < 14; i++) {
    const xa = -L2 - 3 + (i * (L2 * 2 + 6)) / 14;
    const xb = xa + (L2 * 2 + 6) / 14;
    poly(
      [
        [xa, 0, -W2 - 3],
        [xb, 0, -W2 - 3],
        [xb, 0, W2 + 3],
        [xa, 0, W2 + 3],
      ],
      i % 2 ? t2 : t1,
    );
  }
  if (lit && night > 0.3) {
    const cp = P(0, 0, 0);
    if (cp) {
      const pg = g.createRadialGradient(cp.x, cp.y, 4, cp.x, cp.y, w * 0.6);
      pg.addColorStop(0, "rgba(255,246,222,.22)");
      pg.addColorStop(1, "rgba(255,246,222,0)");
      g.fillStyle = pg;
      g.fillRect(0, hy, w, h - hy);
    }
  }
  const chalk = `rgba(244,248,255,${0.55 + 0.3 * Math.max(lit, s.day)})`;
  line([-L2, 0, -W2], [L2, 0, -W2], chalk);
  line([L2, 0, -W2], [L2, 0, W2], chalk);
  line([L2, 0, W2], [-L2, 0, W2], chalk);
  line([-L2, 0, W2], [-L2, 0, -W2], chalk);
  line([0, 0, -W2], [0, 0, W2], chalk);
  for (let a = 0; a < 32; a++) {
    const a0 = (a / 32) * Math.PI * 2;
    const a1 = ((a + 1) / 32) * Math.PI * 2;
    line([Math.cos(a0) * 6, 0, Math.sin(a0) * 6], [Math.cos(a1) * 6, 0, Math.sin(a1) * 6], chalk);
  }
  for (const sg of [1, -1]) {
    const gx = sg * L2;
    line([gx, 0, -10], [gx - sg * 9, 0, -10], chalk);
    line([gx - sg * 9, 0, -10], [gx - sg * 9, 0, 10], chalk);
    line([gx - sg * 9, 0, 10], [gx, 0, 10], chalk);
    line([gx, 0, -3], [gx, 2, -3], "#fff", 2);
    line([gx, 0, 3], [gx, 2, 3], "#fff", 2);
    line([gx, 2, -3], [gx, 2, 3], "#fff", 2);
  }

  /* main stand with the crest (or the neutral away ground) */
  const SZ = -24;
  const bz = SZ - 7.1;
  const away = !!st.away;
  const wall = away ? mix("#3c4438", "#c3c8bb", s.day) : mix("#2a3350", "#dfe3ea", s.day);
  poly(
    [
      [-17.5, 0, bz],
      [17.5, 0, bz],
      [17.5, 8.6, bz],
      [-17.5, 8.6, bz],
    ],
    wall,
  );
  poly(
    [
      [-17, 0, SZ],
      [17, 0, SZ],
      [17, 3.3, bz + 0.5],
      [-17, 3.3, bz + 0.5],
    ],
    away ? mix("#203226", "#4f7f63", s.day) : mix("#1b3456", "#6CABDD", s.day),
  );
  poly(
    [
      [-18.5, 9.4, bz],
      [18.5, 9.4, bz],
      [18.5, 9, bz + 10],
      [-18.5, 9, bz + 10],
    ],
    mix("#0d1428", "#27304a", s.day),
  );
  poly(
    [
      [-18.5, 8.6, bz + 10],
      [18.5, 8.6, bz + 10],
      [18.5, 9.7, bz + 10],
      [-18.5, 9.7, bz + 10],
    ],
    away ? "#2c4434" : "#16285a",
  );
  if (!away) {
    const cc = P(0, 6.2, bz + 0.3);
    const ce = P(2.2, 6.2, bz + 0.3);
    if (cc && ce) {
      g.fillStyle = "#eef4ff";
      g.beginPath();
      g.arc(cc.x, cc.y, Math.abs(ce.x - cc.x), 0, 7);
      g.fill();
      g.fillStyle = "#6CABDD";
      g.beginPath();
      g.arc(cc.x, cc.y, Math.abs(ce.x - cc.x) * 0.72, 0, 7);
      g.fill();
    }
  }

  /* floodlight masts */
  MASTS.forEach((m, i) => {
    const pw = fl.power[i];
    line([m[0], 0, m[1]], [m[0], MAST_H, m[1]], mix("#3a4458", "#8a93a3", s.day), 2.2);
    const hd = P(m[0], MAST_H + 0.9, m[1]);
    if (!hd) return;
    g.fillStyle = pw ? "#ffffff" : fl.pre ? "#8f8a7a" : "#5a6478";
    g.fillRect(hd.x - 7, hd.y - 4, 14, 8);
    if (pw) {
      const fg = g.createRadialGradient(hd.x, hd.y, 1, hd.x, hd.y, 60 + 40 * night);
      fg.addColorStop(0, "rgba(255,255,255,.95)");
      fg.addColorStop(0.15, "rgba(230,242,255,.45)");
      fg.addColorStop(1, "rgba(200,225,255,0)");
      g.fillStyle = fg;
      g.beginPath();
      g.arc(hd.x, hd.y, 100, 0, 7);
      g.fill();
      g.fillStyle = "rgba(225,242,255,.6)";
      g.fillRect(hd.x - 70, hd.y - 1, 140, 2);
    }
  });

  /* the players */
  const figs = placeFigures(st.figures).filter((f) => !f.leaving);
  const shirtC = mix("#2a4f7a", "#8cc4ec", Math.min(1, 0.4 + s.day * 0.6 + lit * 0.3));
  figs
    .slice()
    .sort((a, b) => a.z - b.z)
    .forEach((p) => {
      const ft = P(p.x, 0, p.z);
      const hd = P(p.x, 2.6, p.z);
      if (!ft || !hd) return;
      const ht = ft.y - hd.y;
      const bw = ht * 0.32;
      g.fillStyle = "rgba(0,0,0,.35)";
      g.beginPath();
      g.ellipse(ft.x + ht * 0.25, ft.y, ht * 0.4, ht * 0.08, 0, 0, 7);
      g.fill();
      g.fillStyle = "#0c1733";
      g.fillRect(ft.x - bw * 0.4, ft.y - ht * 0.32, bw * 0.8, ht * 0.32);
      g.fillStyle = "#f4f7fb";
      g.fillRect(ft.x - bw * 0.5, ft.y - ht * 0.45, bw, ht * 0.14);
      g.fillStyle = p.gk ? "#1d2c57" : p.tag === "mvp" ? "#FFC659" : shirtC;
      g.fillRect(ft.x - bw * 0.55, ft.y - ht * 0.8, bw * 1.1, ht * 0.36);
      g.fillStyle = "#c89878";
      g.beginPath();
      g.arc(ft.x, ft.y - ht * 0.88, bw * 0.32, 0, 7);
      g.fill();
    });
  if (kind === "lluvia") {
    const r = rng(3);
    g.strokeStyle = "rgba(201,220,242,.35)";
    g.lineWidth = 1;
    g.beginPath();
    for (let q = 0; q < 160; q++) {
      const x = r() * w;
      const y = r() * h;
      g.moveTo(x, y);
      g.lineTo(x - 2, y + 12);
    }
    g.stroke();
  }

  /* plates, same markup as the WebGL view */
  if (platesEl) {
    platesEl.replaceChildren();
    for (const f of figs) {
      if (f.plate === "none") continue;
      const hp = P(f.x, 3.15, f.z);
      if (!hp) continue;
      const node = document.createElement("span");
      const look = plateLook(f, false, w < COMPACT_W);
      node.className = look.cls;
      fillPlate(node, look);
      node.style.transform = `translate(${plateX(hp.x, w).toFixed(1)}px,${hp.y.toFixed(1)}px)`;
      platesEl.appendChild(node);
    }
  }
}
