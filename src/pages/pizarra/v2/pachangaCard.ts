// La pizarra · Bloque 5 — la pachanga as an image for the group (1080 × 1350 PNG): the date, then a column
// per team with its name, average and players (the keeper marked, or the turns in goal). Drawn on a canvas;
// null where the canvas can't draw.
import type { Pachanga } from "./pachanga";

export const CARD_W = 1080;
export const CARD_H = 1350;
/** Each team's slab colour on the image (the names say which is which; the colour only helps). */
const TEAM_FILL = ["#ff8a3d", "#f4f6fb", "#ffd23f"];
const TEAM_INK = ["#2b1200", "#0b1a3a", "#2b2200"];

export async function pachangaBlob(p: Pachanga, name: (id: string) => string, head: string): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, "#14306b");
  bg.addColorStop(1, "#050c20");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#9ad3ff";
  ctx.font = "600 30px 'Geist Mono', monospace";
  ctx.fillText(head.toUpperCase(), 64, 100);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 96px Anybody, sans-serif";
  ctx.fillText("PACHANGA", 60, 200);
  const k = p.teams.length;
  const gap = 24;
  const w = (CARD_W - 120 - gap * (k - 1)) / k;
  p.teams.forEach((t, i) => {
    const x = 60 + i * (w + gap);
    ctx.fillStyle = TEAM_FILL[i % TEAM_FILL.length];
    ctx.fillRect(x, 250, w, 130);
    ctx.fillStyle = TEAM_INK[i % TEAM_INK.length];
    ctx.font = "900 " + (k === 3 ? 34 : 44) + "px Anybody, sans-serif";
    ctx.fillText(t.name.toUpperCase(), x + 20, 310, w - 40);
    ctx.font = "700 28px 'Geist Mono', monospace";
    ctx.fillText("MEDIA " + t.avg, x + 20, 356);
    ctx.fillStyle = "rgba(255,255,255,.06)";
    ctx.fillRect(x, 380, w, CARD_H - 460);
    ctx.fillStyle = "#ffffff";
    t.ids.forEach((id, n) => {
      const y = 440 + n * 64;
      if (y > CARD_H - 140) return;
      ctx.font = "800 " + (k === 3 ? 30 : 38) + "px Anybody, sans-serif";
      ctx.fillText(name(id) + (id === t.keeper ? "  (POR)" : ""), x + 20, y, w - 40);
    });
    if (t.turns.length) {
      ctx.fillStyle = "#9ad3ff";
      ctx.font = "600 22px 'Geist Mono', monospace";
      ctx.fillText("PORTERÍA POR TURNOS", x + 20, CARD_H - 104, w - 40);
    }
  });
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = "600 24px 'Geist Mono', monospace";
  ctx.fillText("MANCHESTER PITI · LA PIZARRA", 64, CARD_H - 40);
  return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}
