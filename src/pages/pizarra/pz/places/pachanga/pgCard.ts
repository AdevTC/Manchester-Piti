// r14 «La pizarra» · Pachanga: the teams as an image for the group, drawn on a canvas exactly like the sheet's
// preview (PiPachanga .pg-img: the crest, «Pachanga», the day, a column per team with its bib swatch, name, media
// and players, the keeper marked, the balance word). Post 4:5 (1080×1350) · Historia 9:16 (1080×1920).
// null where the canvas can't draw (the sheet then offers the text).
import type { PgPat } from "./pachangaView";

export interface CardCol {
  name: string;
  sub: string;
  pat: PgPat;
  rows: { t: string; k: string }[];
}
export interface CardModel {
  fmt: "post" | "historia";
  title: string;
  sub: string;
  cols: CardCol[];
  foot: string;
  word: string;
}
export const CARD_SIZE = { post: { w: 1080, h: 1350 }, historia: { w: 1080, h: 1920 } } as const;

function swatch(ctx: CanvasRenderingContext2D, pat: PgPat, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, [w * 0.27, w * 0.27, w * 0.18, w * 0.18]);
  ctx.clip();
  if (pat === "rayas") {
    ctx.fillStyle = "#ffc28f";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ff8a2e";
    ctx.lineWidth = w * 0.14;
    for (let k = -h; k < w + h; k += w * 0.28) {
      ctx.beginPath();
      ctx.moveTo(x + k, y);
      ctx.lineTo(x + k + h, y + h);
      ctx.stroke();
    }
  } else if (pat === "malla") {
    ctx.fillStyle = "#e8ec40";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(30,40,10,.55)";
    const step = w * 0.18;
    for (let i = x + step / 2; i < x + w; i += step) for (let j = y + step / 2; j < y + h; j += step) ctx.fillRect(i, j, step * 0.3, step * 0.3);
  } else {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#f4f8fc");
    g.addColorStop(1, "#dce8f3");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  ctx.fillStyle = "rgba(6,14,32,.45)";
  ctx.fillRect(x + w * 0.27, y, w * 0.46, h * 0.19);
  ctx.restore();
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

const loadImg = (src: string) =>
  new Promise<HTMLImageElement | null>((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });

export async function pachangaCard(m: CardModel, crest = "/crest-128.webp"): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const { w: W, h: H } = CARD_SIZE[m.fmt];
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx || typeof ctx.roundRect !== "function") return null;
  try {
    await document.fonts?.ready;
  } catch {
    /* system fonts then */
  }
  const sans = "'Mona Sans', system-ui, sans-serif";
  const bg = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.9);
  bg.addColorStop(0, "#1d4f86");
  bg.addColorStop(0.55, "#0d2550");
  bg.addColorStop(1, "#081733");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const story = m.fmt === "historia";
  const pad = 62;
  let y = story ? 120 : 72;
  const im = await loadImg(crest);
  if (im) ctx.drawImage(im, pad, y - 6, 84, 84);
  ctx.fillStyle = "#cfe3f5";
  ctx.font = `720 40px ${sans}`;
  ctx.textBaseline = "middle";
  ctx.fillText("Manchester Piti", pad + (im ? 104 : 0), y + 36);
  y += story ? 200 : 170;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${story ? 150 : 124}px ${sans}`;
  ctx.fillText(fit(ctx, m.title, W - pad * 2), pad, y);
  y += story ? 70 : 58;
  ctx.fillStyle = "#cfe3f5";
  ctx.font = `600 42px ${sans}`;
  ctx.fillText(fit(ctx, m.sub, W - pad * 2), pad, y);
  y += story ? 110 : 80;
  const k = m.cols.length;
  const gap = 48;
  const cw = (W - pad * 2 - gap * (k - 1)) / k;
  const rowH = story ? 74 : 62;
  m.cols.forEach((col, i) => {
    const x = pad + i * (cw + gap);
    swatch(ctx, col.pat, x, y, 64, 78);
    ctx.fillStyle = "#ffffff";
    ctx.font = `780 ${k === 3 ? 40 : 48}px ${sans}`;
    ctx.fillText(fit(ctx, col.name, cw - 84), x + 84, y + 36);
    ctx.fillStyle = "#cfe3f5";
    ctx.font = `650 36px ${sans}`;
    ctx.fillText(fit(ctx, col.sub, cw - 84), x + 84, y + 78);
    ctx.fillStyle = "rgba(255,255,255,.2)";
    ctx.fillRect(x, y + 104, cw, 3);
    col.rows.forEach((r, n) => {
      const ry = y + 104 + 60 + n * rowH;
      if (ry > H - 150) return;
      ctx.fillStyle = "#ffffff";
      ctx.font = `720 ${k === 3 ? 38 : 44}px ${sans}`;
      const t = fit(ctx, r.t, cw - (r.k ? 150 : 0));
      ctx.fillText(t, x, ry);
      if (r.k) {
        const tw = ctx.measureText(t).width;
        ctx.fillStyle = "#cfe3f5";
        ctx.font = `600 32px ${sans}`;
        ctx.fillText(r.k, x + tw + 4, ry);
      }
    });
  });
  // foot: the keepers' rule and the balance word in its pill
  ctx.fillStyle = "#cfe3f5";
  ctx.font = `700 34px ${sans}`;
  ctx.fillText(fit(ctx, m.foot, W - pad * 2 - 360), pad, H - 70);
  ctx.font = `760 36px ${sans}`;
  const ww = ctx.measureText(m.word).width + 52;
  const wx = W - pad - ww;
  ctx.fillStyle = "rgba(127,214,160,.22)";
  ctx.beginPath();
  ctx.roundRect(wx, H - 108, ww, 60, 30);
  ctx.fill();
  ctx.strokeStyle = "rgba(127,214,160,.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(m.word, wx + 26, H - 66);
  return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}
