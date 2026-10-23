// «Ponte la del Piti»: the print over a blank kit still, as the kit prints it (Inicio's /camiseta and El club's
// /club/equipo/camiseta draw the same).
import type { Kit } from "../../../components/jersey3d/kitStill";

// (the name in the kit's text face, the number in its number face: prints.ts FONT_TXT / FONT_NUM, as the scene prints them)
const FAM = '"Barlow Condensed", "Arial Narrow", sans-serif';
const FAM_NUM = '"Barlow Semi Condensed", "Barlow Condensed", "Arial Narrow", sans-serif';

/** The print over a 540 × 600 blank still: the name's cap height 45 (rows 113–157), condensed past 220 px wide but
 *  never shrunk in height; the number 188 tall (rows 191–380), a 34 px gap under the name. */
export function drawPrint(g: CanvasRenderingContext2D, img: CanvasImageSource, name: string, num: string, kit: Kit) {
  g.clearRect(0, 0, 540, 600);
  g.drawImage(img, 0, 0, 540, 600);
  g.fillStyle = kit === "away" ? "#F5F5F5" : "#051330";
  g.textBaseline = "alphabetic";
  const sizeFor = (w: string, cap: number, fam = FAM) => {
    g.font = `${w} 100px ${fam}`;
    return (100 * cap) / (g.measureText("H").actualBoundingBoxAscent || 70);
  };
  const ink = (t: string) => {
    const m = g.measureText(t);
    return { w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight || m.width, l: m.actualBoundingBoxLeft || 0 };
  };
  const put = (t: string, w: string, cap: number, sx: number, cx: number, base: number, fam = FAM) => {
    g.font = `${w} ${sizeFor(w, cap, fam)}px ${fam}`;
    g.textAlign = "left";
    const k = ink(t);
    g.save();
    g.translate(cx, base);
    g.scale(sx, 1);
    g.fillText(t, -k.w / 2 + k.l, 0);
    g.restore();
  };
  if (name) {
    g.font = `700 ${sizeFor("700", 45)}px ${FAM}`;
    const nsx = 119 / ink("JORDI").w;
    const nw = ink(name).w * nsx;
    put(name, "700", 45, nw > 220 ? 220 / ink(name).w : nsx, 270, 157);
  }
  if (num) {
    g.font = `600 ${sizeFor("600", 188, FAM_NUM)}px ${FAM_NUM}`;
    put(num, "600", 188, 167 / ink("10").w, 270, 380, FAM_NUM);
  }
}
