// Tú › «Tu temporada en cromos» (TU boards cromosModel): the season as a story, one number per cromo. While the
// season is on, four «hasta ahora» (what he has played, his minutes, his partner, what comes next); once it is
// over, the ten. Pure; plus the cromo painted as a PNG for «Compartir este» and «Descargar todos».
import { pl } from "./model";

export interface Cromo {
  k: string;
  big: string;
  t: string;
  d: string;
  /** The printed still to show: his own (num) or his partner's. */
  shirt: string | null;
  gold?: boolean;
}

export interface CromosInput {
  seasonName: string;
  /** The season is over (no match of it left to play). */
  finished: boolean;
  played: number;
  minutes: number | null;
  goals: number;
  assists: number;
  wins: number;
  /** «J1» … «J16». */
  firstJ: string;
  lastJ: string;
  /** The first goal of his season: «J3 contra Rayo». */
  firstGoal: string | null;
  /** His one match: how many stretches (null when he played more than one). */
  stints: number | null;
  /** The only match, in words: «La J1, en casa contra Orduña fc.». */
  oneLine: string | null;
  myNum: string;
  partner: { name: string; num: string; line: string } | null;
  bestClock: { label: string; goals: number } | null;
  pos: string;
  medals: string[];
  nextMedal: { t: string; left: string } | null;
  rating: string;
  tier: string;
  next: { j: string; where: string; when: string; revancha: boolean } | null;
}

export function cromosOf(i: CromosInput): Cromo[] {
  if (!i.finished) {
    const out: Cromo[] = [
      { k: `${i.seasonName}, hasta ahora`, big: String(i.played), t: i.played === 1 ? "partido jugado" : "partidos jugados", d: i.oneLine ?? `De la ${i.firstJ} a la ${i.lastJ}.`, shirt: i.myNum },
      { k: "Tus minutos", big: i.minutes === null ? "—" : `${i.minutes}′`, t: i.stints !== null ? `en ${pl(i.stints, "tramo", "tramos")}` : `en ${pl(i.played, "partido", "partidos")}`, d: "Con cambios continuos: entras y sales sin parar.", shirt: null },
      { k: "Tu socio", big: i.partner?.name ?? "—", t: i.partner?.line ?? "", d: "El compañero con el que más tiempo compartiste campo.", shirt: i.partner?.num ?? null },
    ];
    if (i.next) out.push({ k: "Lo próximo", big: i.next.j, t: i.next.where, d: `${i.next.when}.${i.next.revancha ? " La revancha empieza ahí." : ""}`, shirt: null });
    return out;
  }
  return [
    { k: i.seasonName, big: String(i.played), t: i.played === 1 ? "partido jugado" : "partidos jugados", d: `De la ${i.firstJ} a la ${i.lastJ}.`, shirt: i.myNum },
    { k: "Goles", big: String(i.goals), t: i.goals === 1 ? "gol" : "goles", d: i.firstGoal ? `El primero, en la ${i.firstGoal}.` : "El primero está al caer.", shirt: null, gold: i.goals > 0 },
    { k: "Victorias contigo", big: String(i.wins), t: `de ${i.played}`, d: `Cuando juegas, el equipo gana el ${Math.round((i.wins / Math.max(1, i.played)) * 100)} %.`, shirt: null },
    { k: "Tu minuto", big: i.bestClock?.label ?? "—", t: "cuando más marcas", d: i.bestClock?.goals ? `${pl(i.bestClock.goals, "gol", "goles")} en ese tramo.` : "Se llena con tu primer gol.", shirt: null },
    { k: "Tu socio", big: i.partner?.name ?? "—", t: "en el campo", d: i.partner?.line ?? "", shirt: i.partner?.num ?? null },
    { k: "Tu puesto", big: i.pos, t: "el de tu ficha", d: "El que más ocupaste en la pizarra.", shirt: null },
    { k: "Asistencias", big: String(i.assists), t: i.assists === 1 ? "pase de gol" : "pases de gol", d: i.assists ? "Goles que llevan tu firma." : "La primera, en la próxima.", shirt: null },
    { k: "Logros", big: String(i.medals.length), t: i.medals.length === 1 ? "medalla" : "medallas", d: i.medals.length ? `${i.medals.join(", ")}.` : "La primera llega jugando.", shirt: null },
    { k: "Lo próximo", big: i.nextMedal?.t ?? "—", t: i.nextMedal ? `te faltan ${i.nextMedal.left}` : "", d: "Para la próxima temporada.", shirt: null },
    { k: "Tu carta", big: i.rating || "—", t: i.tier, d: "Tu temporada, en una carta.", shirt: i.myNum },
  ];
}

/** One cromo as a 1080 × 1680 PNG (tu.css .tu-cromo). */
export async function cromoImage(c: Cromo, shirt: string | null, crest: string): Promise<Blob | null> {
  const w = 1080;
  const h = 1680;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d");
  if (!g) return null;
  if (typeof document.fonts !== "undefined") await document.fonts.ready;
  const load = (src: string) =>
    new Promise<HTMLImageElement | null>((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
  const [sh, cr] = await Promise.all([shirt ? load(shirt) : Promise.resolve(null), load(crest)]);
  const lg = g.createLinearGradient(0, 0, w * 0.17, h);
  lg.addColorStop(0, "#173a6b");
  lg.addColorStop(1, "#081227");
  g.fillStyle = lg;
  g.fillRect(0, 0, w, h);
  const rg = g.createRadialGradient(w / 2, 0, 0, w / 2, 0, w);
  rg.addColorStop(0, "rgba(108,171,221,.5)");
  rg.addColorStop(0.7, "rgba(108,171,221,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, w, h);
  if (cr) g.drawImage(cr, 64, 64, 140, 140);
  const SANS = "'Mona Sans', 'Inter', system-ui, sans-serif";
  const t = (s: string, y: number, size: number, weight: number, color: string) => {
    g.font = `${weight} ${size}px ${SANS}`;
    g.fillStyle = color;
    g.textAlign = "center";
    g.fillText(s, w / 2, y, w - 120);
  };
  let y = sh ? 360 : 640;
  t(c.k, y, 52, 700, "#c3d5ec");
  if (sh) {
    const sw = w * 0.52;
    g.drawImage(sh, (w - sw) / 2, y + 40, sw, (sw * 600) / 540);
    y += 40 + (sw * 600) / 540 + 40;
  } else y += 60;
  t(c.big, y + 200, 250, 800, c.gold ? "#ffc659" : "#eaf3fc");
  t(c.t, y + 300, 62, 650, "#eaf3fc");
  t(c.d, y + 400, 50, 500, "#c3d5ec");
  try {
    return await new Promise<Blob | null>((res) => cv.toBlob((b) => res(b), "image/png"));
  } finally {
    cv.width = cv.height = 0; // its pixels go now: iOS caps a page's canvas memory
  }
}
