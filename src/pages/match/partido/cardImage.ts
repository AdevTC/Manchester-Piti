// «El partido»: the cartel, the momento card and the cromo of the jornada as images to share or save — the same picture the sheet shows
// (the sky of that night, the crest, the hero's printed shirt, the big line and the words), drawn on a canvas
// only when asked for.

export interface CardSpec {
  kind: "cartel" | "momento" | "cromo";
  /** The cartel's story format (9:14); the square otherwise. */
  story?: boolean;
  /** The floodlit night (else the golden evening). */
  flood: boolean;
  j: string;
  vs: string;
  big: string;
  hero: string;
  when: string;
  where: string;
  link?: string;
  /** A rival's play on the momento card: its ring instead of a shirt. */
  rivalCode?: string;
}

const GOLDEN = ["#1C2B5E", "#5E6FA8", "#C99A86", "#2A2F4A", "#0C1430"];
const FLOOD = ["#060F24", "#14275A", "#22457F", "#10283F", "#071022"];
const FONT = '"Mona Sans", ui-sans-serif, system-ui, sans-serif';

function img(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

/** Draws `spec` (with the shirt still `still`, a 540 × 600 image) and returns it as a PNG. */
export async function drawCard(spec: CardSpec, still: string | undefined): Promise<Blob> {
  if (spec.kind === "cromo") return drawCromo(spec, still);
  const W = 1080;
  const H = spec.kind === "cartel" ? (spec.story ? 1680 : 1080) : 1080;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d");
  if (!g) throw new Error("no canvas");
  try {
    await document.fonts?.load(`700 40px ${FONT}`);
  } catch {
    /* the system face draws it */
  }
  const sky = spec.flood ? FLOOD : GOLDEN;
  const grad = g.createLinearGradient(0, 0, 0, H);
  [0, 0.34, 0.58, 0.74, 1].forEach((s, i) => grad.addColorStop(s, sky[i]));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const [crest, shirt] = await Promise.all([img("/crest-128.webp"), still ? img(still) : Promise.resolve(null)]);
  const pad = 56;
  if (crest) g.drawImage(crest, pad, pad, 104, 104);
  g.fillStyle = "#fff";
  g.textBaseline = "alphabetic";
  g.shadowColor = "rgba(3,8,22,.55)";
  g.shadowBlur = 24;
  if (spec.kind === "cartel") {
    g.font = `800 40px ${FONT}`;
    g.textAlign = "right";
    g.fillText(spec.j, W - pad, pad + 40);
    g.textAlign = "left";
    if (shirt) {
      const w = spec.story ? W * 0.56 : W * 0.42;
      const x = spec.story ? (W - w) / 2 : W - W * 0.06 - w;
      g.drawImage(shirt, 63, 46, 413, 548, x, H * (spec.story ? 0.13 : 0.15), w, (w * 548) / 413);
    }
    let y = H - pad;
    const line = (t: string, font: string, gap: number) => {
      if (!t) return;
      g.font = font;
      g.fillText(t, pad, y);
      y -= gap;
    };
    line(spec.where, `500 34px ${FONT}`, 46);
    line(spec.when, `600 36px ${FONT}`, 48);
    line(spec.hero, `650 36px ${FONT}`, 30);
    g.font = `800 190px ${FONT}`;
    g.fillText(spec.big, pad, y - 10);
    y -= 190 + 26;
    line(spec.vs, `500 36px ${FONT}`, 58);
    line("Manchester Piti", `720 58px ${FONT}`, 0);
  } else {
    g.font = `650 34px ${FONT}`;
    g.fillText(spec.vs, pad + 124, pad + 66);
    if (shirt) g.drawImage(shirt, 63, 46, 413, 548, W - pad - 330, H - pad - 520, 330, (330 * 548) / 413);
    else if (spec.rivalCode) {
      g.shadowBlur = 0;
      g.strokeStyle = "#F08A7E";
      g.lineWidth = 6;
      g.fillStyle = "rgba(240,138,126,.18)";
      g.beginPath();
      g.arc(W - pad - 110, H - pad - 260, 104, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = "#fff";
      g.font = `800 60px ${FONT}`;
      g.textAlign = "center";
      g.fillText(spec.rivalCode, W - pad - 110, H - pad - 240);
      g.textAlign = "left";
      g.shadowBlur = 24;
    }
    g.font = `500 150px ${FONT}`;
    g.fillText(spec.big, pad, H * 0.42);
    g.font = `720 64px ${FONT}`;
    g.fillText(spec.hero, pad, H * 0.42 + 96, W - pad * 2 - 300);
    g.font = `500 38px ${FONT}`;
    g.fillText(spec.when, pad, H * 0.42 + 156, W - pad * 2 - 300);
    g.font = `780 52px ${FONT}`;
    g.fillText(spec.where, pad, H * 0.42 + 250, W - pad * 2 - 300);
    g.font = `600 32px ${FONT}`;
    if (spec.link) g.fillText(spec.link, pad, H - pad);
  }
  try {
    return await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/png"));
  } finally {
    cv.width = cv.height = 0; // its pixels go now: iOS caps a page's canvas memory
  }
}

/** The cromo of the jornada (spec: `j` the top line, `big` his shirt name, `hero` the line, `when` the foot), 3:4.2. */
async function drawCromo(spec: CardSpec, still: string | undefined): Promise<Blob> {
  const W = 900;
  const H = 1260;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d");
  if (!g) throw new Error("no canvas");
  try {
    await document.fonts?.load(`700 40px ${FONT}`);
  } catch {
    /* the system face draws it */
  }
  const bg = g.createLinearGradient(0, 0, W * 0.3, H);
  bg.addColorStop(0, "#3d6f9e");
  bg.addColorStop(0.78, "#0c1733");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, H * 0.18, 0, W / 2, H * 0.18, W * 0.7);
  glow.addColorStop(0, "rgba(108,171,221,.7)");
  glow.addColorStop(1, "rgba(108,171,221,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(234,243,252,.4)";
  g.lineWidth = 6;
  g.strokeRect(3, 3, W - 6, H - 6);
  const [crest, shirt] = await Promise.all([img("/crest-128.webp"), still ? img(still) : Promise.resolve(null)]);
  g.fillStyle = "#eaf3fc";
  g.textAlign = "center";
  g.font = `650 40px ${FONT}`;
  const top = spec.j;
  const tw = g.measureText(top).width;
  if (crest) g.drawImage(crest, W / 2 - tw / 2 - 64, 46, 50, 50);
  g.fillText(top, W / 2 + 32, 86);
  if (shirt) {
    const w = W * 0.62;
    g.drawImage(shirt, 63, 46, 413, 548, (W - w) / 2, 150, w, (w * 548) / 413);
  }
  g.shadowColor = "rgba(3,8,22,.5)";
  g.shadowBlur = 18;
  g.font = `800 96px ${FONT}`;
  g.fillText(spec.big, W / 2, H - 250, W - 80);
  g.font = `600 46px ${FONT}`;
  g.fillText(spec.hero, W / 2, H - 170, W - 80);
  g.font = `500 40px ${FONT}`;
  g.fillStyle = "rgba(234,243,252,.85)";
  g.fillText(spec.when, W / 2, H - 100, W - 80);
  try {
    return await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/png"));
  } finally {
    cv.width = cv.height = 0; // its pixels go now: iOS caps a page's canvas memory
  }
}
