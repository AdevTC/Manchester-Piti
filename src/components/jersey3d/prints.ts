// Kit prints drawn onto the jersey texture. Every element is placed through an affine frame
// (photo px → UV px) measured from the official kit photos (public/models/kit-layout.json).

export type Frame = [number, number, number, number, number, number];
interface Box { m: Frame }
export interface KitLayout {
  front: {
    z: Box & { w: number; h: number };
    crest: Box & { d: number };
    num: Box & { w: number; h: number };
    arc: Box & { cap: number; R: number; span: number };
    piti: Box & { w: number; h: number };
    lines: (Box & { dx: number; dy: number; w: number })[];
  };
  back: {
    est: Box & { w: number; h: number };
    name: Box & { cap: number; w: number };
    num: Box & { w: number; h: number };
    wm: Box & { w: number; h: number };
    estL: Box & { w: number; h: number };
    estR: Box & { w: number; h: number };
    crown: Box & { w: number; h: number };
    lines: (Box & { dx: number; dy: number; w: number })[];
  };
}
export type KitName = "home" | "away";
export type Layouts = Record<KitName, KitLayout>;
export const KIT_INK: Record<KitName, { ink: string; accent: string }> = {
  home: { ink: "#051330", accent: "#CFA862" },
  away: { ink: "#F5F5F5", accent: "#D6161F" },
};
export const FONT_NUM = "'Barlow Semi Condensed'";
export const FONT_TXT = "'Barlow Condensed'";

type Ctx = CanvasRenderingContext2D;
function ink(g: Ctx, font: string, text: string) {
  g.font = font;
  const t = g.measureText(text);
  return { w: t.actualBoundingBoxLeft + t.actualBoundingBoxRight, cap: t.actualBoundingBoxAscent };
}
const sizeFor = (g: Ctx, family: string, weight: number, cap: number) => (100 * cap) / ink(g, `${weight} 100px ${family}`, "H").cap;
/** Text with cap height `cap`, centred on the origin; `sx` scales glyphs, `ls` adds tracking (photo px). */
function print(g: Ctx, text: string, family: string, weight: number, cap: number, { sx = 1, ls = 0 } = {}) {
  g.font = `${weight} ${sizeFor(g, family, weight, cap)}px ${family}`;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.save();
  g.scale(sx, 1);
  if (!ls) {
    const t = g.measureText(text), w = t.actualBoundingBoxLeft + t.actualBoundingBoxRight;
    g.fillText(text, -w / 2 + t.actualBoundingBoxLeft, cap / 2);
  } else {
    const chars = [...text], m = chars.map((c) => g.measureText(c)), gap = ls / sx;
    let w = m[0].actualBoundingBoxLeft;
    for (let i = 0; i < chars.length - 1; i++) w += m[i].width + gap;
    w += m[m.length - 1].actualBoundingBoxRight;
    let x = -w / 2 + m[0].actualBoundingBoxLeft;
    for (let i = 0; i < chars.length; i++) {
      g.fillText(chars[i], x, cap / 2);
      x += m[i].width + gap;
    }
  }
  g.restore();
}
function fitScale(g: Ctx, ref: string, family: string, weight: number, cap: number, width: number) {
  return width / ink(g, `${weight} ${sizeFor(g, family, weight, cap)}px ${family}`, ref).w;
}
function fitTracking(g: Ctx, text: string, family: string, weight: number, cap: number, width: number) {
  g.font = `${weight} ${sizeFor(g, family, weight, cap)}px ${family}`;
  const chars = [...text], m = chars.map((c) => g.measureText(c));
  let w = m[0].actualBoundingBoxLeft;
  for (let i = 0; i < chars.length - 1; i++) w += m[i].width;
  w += m[m.length - 1].actualBoundingBoxRight;
  return (width - w) / Math.max(1, chars.length - 1);
}
function arcText(g: Ctx, text: string, family: string, weight: number, cap: number, R: number, span: number) {
  g.font = `${weight} ${sizeFor(g, family, weight, cap)}px ${family}`;
  const chars = [...text], adv = chars.map((c) => g.measureText(c).width), nat = adv.reduce((a, b) => a + b, 0);
  const arc = 2 * R * Math.asin(Math.min(1, (span - cap * 0.2) / (2 * R))), k = arc / nat;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  let a = -arc / 2 / R;
  for (let i = 0; i < chars.length; i++) {
    const w = adv[i] * k;
    a += w / 2 / R;
    g.save();
    g.translate(Math.sin(a) * R, cap / 2 + R - Math.cos(a) * R);
    g.rotate(a);
    g.scale(k, 1);
    g.fillText(chars[i], 0, 0);
    g.restore();
    a += w / 2 / R;
  }
}
function poly(g: Ctx, pts: [number, number][], w: number, h: number) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo((x - 0.5) * w, (y - 0.5) * h) : g.moveTo((x - 0.5) * w, (y - 0.5) * h)));
  g.closePath();
  g.fill();
}
function makerZ(g: Ctx, w: number, h: number) {
  poly(g, [[0.07, 0.12], [1, 0.02], [0.95, 0.26], [0.08, 0.31]], w, h);
  poly(g, [[0.79, 0.25], [0.97, 0.19], [0.7, 0.6], [0.52, 0.6]], w, h);
  poly(g, [[0.33, 0.36], [0.5, 0.35], [0.29, 0.72], [0.12, 0.74]], w, h);
  poly(g, [[0.12, 0.7], [0.94, 0.66], [0.9, 0.83], [0.02, 0.95]], w, h);
}
function crown(g: Ctx, w: number, h: number) {
  poly(g, [[0.029, 0.4], [0.126, 0.59], [0.223, 0.387], [0.32, 0.6], [0.456, 0.33], [0.388, 0.253], [0.495, 0], [0.602, 0.253], [0.534, 0.33], [0.67, 0.6], [0.777, 0.387], [0.874, 0.59], [0.98, 0.4], [0.92, 0.83], [0.1, 0.83]], w, h);
  poly(g, [[0.1, 0.87], [0.92, 0.87], [0.92, 0.98], [0.1, 0.98]], w, h);
}

/** Paint every print. `sc` scales the whole layout (the sheen mask is half size); `crestImg` null = mask. */
export function drawPrints(g: Ctx, sc: number, L: KitLayout, colors: { ink: string; accent: string }, name: string, num: string, crestImg: CanvasImageSource | null) {
  const frame = (m: Frame) => g.setTransform(m[0] * sc, m[1] * sc, m[2] * sc, m[3] * sc, m[4] * sc, m[5] * sc);
  const rule = (l: KitLayout["front"]["lines"][number]) => {
    frame(l.m);
    g.strokeStyle = colors.accent;
    g.lineWidth = l.w;
    g.lineCap = "butt";
    g.beginPath();
    g.moveTo(-l.dx, -l.dy);
    g.lineTo(l.dx, l.dy);
    g.stroke();
  };
  const F = L.front, B = L.back;
  g.fillStyle = colors.ink;
  frame(F.z.m);
  makerZ(g, F.z.w, F.z.h);
  frame(F.crest.m);
  if (!crestImg) {
    g.beginPath();
    g.arc(0, 0, F.crest.d / 2, 0, Math.PI * 2);
    g.fill();
  } else g.drawImage(crestImg, -F.crest.d / 2, -F.crest.d / 2, F.crest.d, F.crest.d);
  g.fillStyle = colors.ink;
  if (num) {
    frame(F.num.m);
    print(g, num, FONT_NUM, 600, F.num.h, { sx: fitScale(g, "10", FONT_NUM, 600, F.num.h, F.num.w) });
  }
  frame(F.arc.m);
  arcText(g, "MANCHESTER", FONT_NUM, 700, F.arc.cap, F.arc.R, F.arc.span);
  frame(F.piti.m);
  print(g, "PITI", FONT_NUM, 700, F.piti.h, { ls: fitTracking(g, "PITI", FONT_NUM, 700, F.piti.h, F.piti.w) });
  F.lines.forEach(rule);
  g.fillStyle = colors.ink;
  frame(B.est.m);
  print(g, "EST 2026", FONT_TXT, 700, B.est.h, { ls: fitTracking(g, "EST 2026", FONT_TXT, 700, B.est.h, B.est.w) });
  if (name) {
    const nsx = fitScale(g, "JUGADOR", FONT_TXT, 700, B.name.cap, B.name.w);
    const natW = ink(g, `700 ${sizeFor(g, FONT_TXT, 700, B.name.cap)}px ${FONT_TXT}`, name).w * nsx;
    frame(B.name.m);
    print(g, name, FONT_TXT, 700, B.name.cap, { sx: nsx * Math.min(1, (B.name.w * 1.3) / natW) });
  }
  if (num) {
    frame(B.num.m);
    print(g, num, FONT_TXT, 600, B.num.h, { sx: fitScale(g, "10", FONT_TXT, 600, B.num.h, B.num.w) });
  }
  frame(B.wm.m);
  print(g, "MANCHESTER PITI", FONT_TXT, 700, B.wm.h, { sx: fitScale(g, "MANCHESTER PITI", FONT_TXT, 700, B.wm.h, B.wm.w) });
  frame(B.estL.m);
  print(g, "EST.", FONT_TXT, 700, B.estL.h, { ls: fitTracking(g, "EST.", FONT_TXT, 700, B.estL.h, B.estL.w) });
  frame(B.estR.m);
  print(g, "2026", FONT_TXT, 700, B.estR.h, { ls: fitTracking(g, "2026", FONT_TXT, 700, B.estR.h, B.estR.w) });
  g.fillStyle = colors.accent;
  frame(B.crown.m);
  crown(g, B.crown.w, B.crown.h);
  B.lines.forEach(rule);
  g.setTransform(1, 0, 0, 1, 0, 0);
}
