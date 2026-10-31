// Tú › «Tu temporada en cromos»: ONE model (bug 7) — the season recap of lib/derived/seasonRecap (spec
// 2026-10-16: partidos, goles, MVP, socio, «Dónde jugaste», porra, medallas, el equipo), offered as recapView
// says (the closed season for 30 days after its last match, else the current one). Before the current season's
// 10th match the recap is not «on offer» for the vestuario's banner, but the vitrina still tells it «hasta ahora»
// from his first match: the same seasonRecap, with the porra line the perfil already reads. «Tu puesto» is the
// position he actually played most (bug 6: seasonRecap's posiciones.main, from the actas). The words of each cromo
// for the page and the viewer are here; the images are recapDraw's (one cromo) and `cromosSheetBlob` (all of them
// in ONE file, bug 17).
import { seasonRecap, type RecapCard, type RecapInput, type SeasonRecap } from "../../../lib/derived/seasonRecap";
import type { PorraLine } from "../../../lib/derived/seasonPlayers";
import { niceName } from "../../../lib/derived/words";
import { fmtMinutes } from "../../../lib/derived/minutes";
import { POSITIONS, isPosCode } from "../../../lib/positions";
import type { RecapOffer } from "../recapView";
import type { ProfileData } from "../useProfileData";
import { pl } from "./model";

export interface CromosSource {
  /** His linked ficha (null: no cromos). */
  playerId: string | null;
  uid: string;
  /** The current season. */
  seasonId: string;
  now: number;
  raw: Pick<RecapInput, "matches" | "players" | "seasons" | "mvpResults" | "standings">;
  /** useProfileData's recapOffer (null before the current season's 10th match). */
  offer: RecapOffer | null;
  /** His porra line of the current season (useProfileData's stuff.porra). */
  porra: PorraLine | null;
}

export interface SeasonCromos {
  recap: SeasonRecap;
  /** The season is over (all its cromos); else «hasta ahora». */
  closed: boolean;
  /** The cromos shown (a season still on has no «Gracias por la temporada»). */
  cards: RecapCard[];
}

const shown = (cards: RecapCard[], closed: boolean) => (closed ? cards : cards.filter((c) => c.kind !== "cierre"));

/** His season in cromos (null without a ficha or a played match of the season). */
export function seasonCromos(s: CromosSource): SeasonCromos | null {
  if (!s.playerId) return null;
  if (s.offer) {
    const closed = s.offer.status === "closed";
    return { recap: s.offer.recap, closed, cards: shown(s.offer.recap.cards, closed) };
  }
  const recap = seasonRecap({ ...s.raw, porraStandings: [], uid: s.uid, now: s.now }, s.playerId, s.seasonId);
  if (!recap) return null;
  const cards = [...recap.cards];
  if (s.porra) {
    // (where seasonRecap puts it: after «Dónde jugaste», before the medals and the team)
    const at = cards.findIndex((c) => c.kind === "medallas" || c.kind === "equipo");
    cards.splice(at < 0 ? cards.length : at, 0, { kind: "porra", rank: s.porra.rank, of: s.porra.of, points: s.porra.points });
  }
  const full = { ...recap, partial: true, cards };
  return { recap: full, closed: false, cards: shown(cards, false) };
}

/** His season in cromos from the profile (a linked ficha only). */
export function cromosOfData(data: Pick<ProfileData, "ficha" | "uid" | "seasonId" | "raw" | "recap" | "stuff">, now: number): SeasonCromos | null {
  return seasonCromos({ playerId: data.ficha.state === "vinculada" ? data.ficha.playerId : null, uid: data.uid, seasonId: data.seasonId, now, raw: data.raw, offer: data.recap, porra: data.stuff.porra });
}

/** The cromo the viewer opens on (a tile of the vitrina sets it; the address alone opens the first). */
let startAt = 0;
export const cromoStart = {
  set: (i: number) => {
    startAt = Math.max(0, Math.floor(i));
  },
  /** Read in the viewer's state initializer (pure: StrictMode may call it twice)… */
  peek: (): number => startAt,
  /** …and forgotten once it is open, so the address alone opens the first. */
  clear: () => {
    startAt = 0;
  },
};

/** A cromo in words: its kicker, its big line and what it says (the page's tiles and the viewer). */
export interface CromoWords {
  k: string;
  t: string;
  s: string;
  gold: boolean;
}

const posName = (code: string) => (isPosCode(code) ? POSITIONS[code].name : code);

export function cromoWords(card: RecapCard, closed: boolean): CromoWords {
  const w = (k: string, t: string, s: string, gold = false): CromoWords => ({ k, t, s, gold });
  switch (card.kind) {
    case "portada":
      return w(closed ? card.season : `${card.season}, hasta ahora`, [card.number, niceName(card.name)].filter(Boolean).join(" · "), "Tu temporada en cromos");
    case "partidos":
      return w("Partidos y minutos", pl(card.played, "partido", "partidos"), card.minutes === null ? "Minutos: las actas aún no los saben." : `${fmtMinutes(card.minutes)} en el campo.`);
    case "goles": {
      const best = card.best ? ` Tu mejor partido: ${card.best.label}.` : "";
      return w("Goles y asistencias", pl(card.goals, "gol", "goles"), `${pl(card.assists, "asistencia", "asistencias")}.${best}`, card.goals > 0);
    }
    case "mvp":
      return w("MVP", card.times ? pl(card.times, "vez MVP", "veces MVP") : "Aún sin MVP", `${pl(card.votes, "voto", "votos")} en toda la temporada.`, card.times > 0);
    case "socio":
      return w("Tu socio", niceName(card.partnerName), `${pl(card.combined, "gol combinado", "goles combinados")} entre los dos.`);
    case "posiciones": {
      const main = card.main ?? card.codes[0]?.code ?? "";
      const mine = card.codes.find((c) => c.code === main);
      const also = card.codes.filter((c) => c.code !== main).slice(0, 2);
      return w("Tu puesto", posName(main) || "—", `El que más ocupaste${mine ? `: ${fmtMinutes(mine.minutes)}` : ""}.${also.length ? ` También: ${also.map((c) => `${posName(c.code).toLocaleLowerCase("es")} ${fmtMinutes(c.minutes)}`).join(", ")}.` : ""}`);
    }
    case "porra":
      return w("La porra", `${card.rank}.º de ${card.of}`, `${pl(card.points, "punto", "puntos")}.`);
    case "medallas":
      return w("Tus medallas", pl(card.medals.length, "medalla nueva", "medallas nuevas"), `${card.medals.map((m) => m.label).join(", ")}.`);
    case "equipo":
      return w("El equipo", `${card.g} G · ${card.e} E · ${card.p} P`, `${pl(card.gf, "gol", "goles")} a favor y ${card.ga} en contra.${card.biggest ? ` La mayor victoria: ${card.biggest.score}, ${card.biggest.label}.` : ""}`);
    case "cierre":
      return w("Gracias por la temporada", card.season, "Nos vemos en la próxima.");
  }
}

/** The page's line over the cromos. */
export function cromosMeta(c: SeasonCromos): string {
  return c.closed ? `${c.recap.seasonName}, completa: ${pl(c.cards.length, "cromo", "cromos")}.` : `En curso: ${pl(c.cards.length, "cromo", "cromos")}. Al final de la temporada sale la historia entera.`;
}

/** Where the cromos of «Descargar todos» sit in the one image: up to five a row, scaled to 40 %. */
export function sheetLayout(n: number, w = 1080, h = 1920): { cols: number; rows: number; cw: number; ch: number; gap: number; W: number; H: number } {
  const cols = Math.max(1, Math.min(5, n));
  const rows = Math.max(1, Math.ceil(n / cols));
  const cw = Math.round(w * 0.4);
  const ch = Math.round(h * 0.4);
  const gap = 32;
  return { cols, rows, cw, ch, gap, W: cols * cw + (cols + 1) * gap, H: rows * ch + (rows + 1) * gap };
}

/** «Descargar todos»: every cromo in ONE PNG (a browser blocks a burst of downloads; bug 17). Each cromo is
 *  painted by recapDraw on one reused canvas and copied into the sheet. Null where the canvas can't draw. */
export async function cromosSheetBlob(cards: RecapCard[], draw: (canvas: HTMLCanvasElement, card: RecapCard) => Promise<boolean>, bg: string): Promise<Blob | null> {
  if (typeof document === "undefined" || !cards.length) return null;
  const L = sheetLayout(cards.length);
  const sheet = document.createElement("canvas");
  sheet.width = L.W;
  sheet.height = L.H;
  const g = sheet.getContext("2d");
  const one = document.createElement("canvas");
  try {
    if (!g) return null;
    g.fillStyle = bg;
    g.fillRect(0, 0, L.W, L.H);
    for (const [i, card] of cards.entries()) {
      if (!(await draw(one, card))) return null;
      const col = i % L.cols;
      const row = Math.floor(i / L.cols);
      g.drawImage(one, L.gap + col * (L.cw + L.gap), L.gap + row * (L.ch + L.gap), L.cw, L.ch);
    }
    return await new Promise<Blob | null>((res) => sheet.toBlob((b) => res(b), "image/png"));
  } finally {
    // their pixels go now: iOS caps a page's canvas memory
    one.width = one.height = 0;
    sheet.width = sheet.height = 0;
  }
}
