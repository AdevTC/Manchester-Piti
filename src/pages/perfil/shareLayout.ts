// /profile › the share image: where everything goes on the 1080-wide PNG. The studio's preview is the
// design's DOM (pf-g-css.mjs: .pv «Mi carta» 224 px wide for Historia / 268 px for Post, the poster .po
// at 10 px per em, 22.4 em / 25.6 em wide); the image is that same preview scaled up, so every number
// here is the CSS one times the scale. Pure (no canvas): shareDraw.ts paints these boxes.
import { SHARE_SIZE, type ShareFace, type ShareFormat } from "./share";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The card's shape (--shape): the shield polygon, in fractions of its box. */
export const CARD_SHAPE: readonly (readonly [number, number])[] = [
  [0, 0.036],
  [0.065, 0],
  [0.935, 0],
  [1, 0.036],
  [1, 0.82],
  [0.93, 0.875],
  [0.8, 0.935],
  [0.63, 0.984],
  [0.5, 1],
  [0.37, 0.984],
  [0.2, 0.935],
  [0.07, 0.875],
  [0, 0.82],
];

/** A wall of the tunnel (.pv-w): a 34 %-wide plane turned 48° away, seen through perspective(200px). */
export interface Wall {
  /** Near edge (full height) and far edge (shorter), in px. */
  near: number;
  far: number;
  top: number;
  bottom: number;
  farTop: number;
  farBottom: number;
}

export interface CartaLayout {
  w: number;
  h: number;
  /** Image px per preview px. */
  s: number;
  card: Box & { u: number };
  /** The light pool under the card (.pv-ped). */
  ped: { cx: number; cy: number; rx: number; ry: number };
  walls: { l: Wall; r: Wall };
  beam: { x: number; w: number; h: number };
  top: { x: number; y: number; crest: number; size: number; right: number };
  kicker: { y: number; size: number };
  foot: { x: number; y: number; size: number };
}

const PREVIEW_W: Record<ShareFormat, number> = { historia: 224, post: 268 };

function wall(side: "l" | "r", W: number, H: number, s: number, pw: number): Wall {
  const w = 0.34 * pw;
  const a = (48 * Math.PI) / 180;
  const k = 200 / (200 + w * Math.sin(a));
  const reach = w * Math.cos(a) * k * s;
  const half = (H / 2) * k;
  const near = side === "l" ? 0 : W;
  return { near, far: side === "l" ? reach : W - reach, top: 0, bottom: H, farTop: H / 2 - half, farBottom: H / 2 + half };
}

/** «Mi carta»: the tunnel frame with the card on its light pool (.pv, .pv-card, .pv-ped…). */
export function cartaLayout(format: ShareFormat, face: ShareFace): CartaLayout {
  const { w: W, h: H } = SHARE_SIZE[format];
  const pw = PREVIEW_W[format];
  const s = W / pw;
  const post = format === "post";
  const cw = (post ? 130 : 136) * s;
  const ch = cw * 1.4;
  const pedBottom = H * (1 - (post ? 0.11 : 0.18));
  return {
    w: W,
    h: H,
    s,
    // .pv-card: left 50 %, top 50 %, translate(-50 %, -44 %)
    card: { x: W / 2 - cw / 2, y: H / 2 - 0.44 * ch, w: cw, h: ch, u: cw / 25 },
    ped: { cx: W / 2, cy: pedBottom - 15 * s, rx: 75 * s, ry: 15 * s },
    walls: { l: wall("l", W, H, s, pw), r: wall("r", W, H, s, pw) },
    beam: { x: 0.1 * W, w: 0.8 * W, h: 0.8 * H },
    top: { x: 10 * s, y: 10 * s, crest: 18 * s, size: 8 * s, right: W - 10 * s },
    kicker: { y: (post ? 30 : 36) * s, size: (post || face === "dorso" ? 15 : 19) * s },
    foot: { x: 10 * s, y: H - 10 * s, size: 7.5 * s },
  };
}

/** The card inside its box: .fc-in sits .55 em in (the «Fijo» frame: .8 em). */
export function cardInner(card: Box & { u: number }, fijo: boolean): Box {
  const i = (fijo ? 0.8 : 0.55) * card.u;
  return { x: card.x + i, y: card.y + i, w: card.w - 2 * i, h: card.h - 2 * i };
}

/** The shirt back (.tee): a 10 em × 10.5 em box at font size `f`; the print area and the dorsal inside. */
export interface TeeBox extends Box {
  f: number;
  /** .tee-pr: 1.5 em in from the sides, 1.1 em down, 7.8 em tall (clips the print). */
  pr: Box;
  /** The name's row: the letters sit on its bottom (1.75 em). */
  nameBottom: number;
  /** The dorsal: font size and the top of its line box (line-height 1). */
  numSize: number;
  numTop: number;
}
export function teeBox(x: number, y: number, f: number): TeeBox {
  const pr = { x: x + 1.5 * f, y: y + 1.1 * f, w: 7 * f, h: 7.8 * f };
  return { x, y, w: 10 * f, h: 10.5 * f, f, pr, nameBottom: pr.y + 1.75 * f, numSize: 4.1 * f, numTop: pr.y + 0.45 * 4.1 * f };
}
/** The vinyl letters' size (em of the print) and width axis per auto-shrink class. */
export const PRINT_SIZE: Record<"n1" | "n2" | "n3" | "n4", { em: number; wdth: number }> = {
  n1: { em: 1.45, wdth: 100 },
  n2: { em: 1.18, wdth: 90 },
  n3: { em: 1, wdth: 76 },
  n4: { em: 0.9, wdth: 64 },
};

export interface PosterLayout {
  w: number;
  h: number;
  /** Image px per em of the poster (.po is 10 px per em in the preview). */
  E: number;
  pad: number;
  top: { y: number; crest: number; size: number };
  vb: Box & { led: number; lines: [number, number]; lineH: number; padX: number };
  fig: { cx: number; cy: number; crest: number; tee: TeeBox };
  name: { top: number; size: number; lineH: number };
  line: { top: number; size: number; lineH: number };
  ft: { border: number; numSize: number; numBottom: number; textSize: number; textLines: [number, number] };
}

/** «¡Ya es oficial!»: crest bar · LED board · shirt over the crest · big name · line · dorsal + date. */
export function posterLayout(format: ShareFormat, o: { long: boolean; nmCls: "" | "m" | "s" }): PosterLayout {
  const { w: W, h: H } = SHARE_SIZE[format];
  const post = format === "post";
  const E = W / (post ? 25.6 : 22.4);
  const pad = 1.2 * E;
  // the crest bar (.po-top): 2.6 em tall
  const top = { y: pad, crest: 2.6 * E, size: 0.8 * E };
  // the LED board (.po-vb): .9 em below, padding .55 / .7 / .45 em, two lines at line-height .95
  const led = (o.long ? (post ? 2.45 : 2.75) : post ? 2.9 : 3.5) * E;
  const lineH = 0.95 * led;
  const vbY = top.y + top.crest + 0.9 * E;
  const vb = { x: pad, y: vbY, w: W - 2 * pad, h: 0.55 * E + 2 * lineH + 0.45 * E, led, lineH, padX: 0.7 * E, lines: [vbY + 0.55 * E, vbY + 0.55 * E + lineH] as [number, number] };
  // the foot (.po-ft): the outline dorsal (3.2 em of .72 em, line-height .8) on the bottom padding
  const ftText = 0.72 * E;
  const numSize = 3.2 * ftText;
  const textLineH = ftText * 1.2;
  const numBottom = H - pad;
  const border = numBottom - 0.8 * numSize - 0.6 * E;
  const ft = { border, numSize, numBottom, textSize: ftText, textLines: [numBottom - 2 * textLineH, numBottom - textLineH] as [number, number] };
  // the name block (.po-nm), .7 em above the foot's rule: name (padding-top .14 em, line-height .92), gap .35 em, the line
  const size = (o.nmCls === "s" ? 1.8 : o.nmCls === "m" ? 2.15 : 2.5) * E;
  const lineSize = 0.82 * E;
  const lineLH = lineSize * 1.2;
  const lineTop = border - 0.7 * E - lineLH;
  const nameLH = 0.92 * size;
  const nameTop = lineTop - 0.35 * E - nameLH;
  // the figure fills what is left between the board and the name: the crest watermark and the shirt, centred
  const figTop = vb.y + vb.h;
  const figBottom = nameTop - 0.14 * size;
  const cy = (figTop + figBottom) / 2;
  const f = (post ? 0.98 : 1.22) * E;
  return {
    w: W,
    h: H,
    E,
    pad,
    top,
    vb,
    fig: { cx: W / 2, cy, crest: 13 * E, tee: teeBox(W / 2 - 5 * f, cy - 5.25 * f, f) },
    name: { top: nameTop, size, lineH: nameLH },
    line: { top: lineTop, size: lineSize, lineH: lineLH },
    ft,
  };
}
