// The nota's traffic light (Sofascore's, on the «valoración Piti» ranges): each nota's band, its word and how it is
// written («7,4»). Each band has its own ink in CSS (.nb--*: white on the blue and the red, navy on the four light
// ones), so every pairing passes AA; the figure and the word say it without the colour. Pure.

export type NotaBand = "s9" | "s8" | "s7" | "s65" | "s6" | "s5" | "no";
export interface NotaBandInfo {
  k: NotaBand;
  /** «Muy buena»; «Sin nota» without one. */
  word: string;
}

/** From the top: where each band starts (the nota rounded to one decimal) and its word. */
export const NOTA_BANDS: readonly { k: Exclude<NotaBand, "no">; from: number; word: string }[] = [
  { k: "s9", from: 9, word: "Sobresaliente" },
  { k: "s8", from: 8, word: "Muy buena" },
  { k: "s7", from: 7, word: "Buena" },
  { k: "s65", from: 6.5, word: "Normal" },
  { k: "s6", from: 6, word: "Floja" },
  { k: "s5", from: 0, word: "Baja" },
];

const round1 = (n: number): number => Math.round(n * 10) / 10;
const known = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n);

/** The band of a nota as it is shown (one decimal): 6,45 reads 6,5 and is «Normal». */
export function notaBand(n: number | null | undefined): NotaBandInfo {
  if (!known(n)) return { k: "no", word: "Sin nota" };
  const r = round1(n);
  const b = NOTA_BANDS.find((x) => r >= x.from) ?? NOTA_BANDS[NOTA_BANDS.length - 1];
  return { k: b.k, word: b.word };
}

/** «7,4»; «—» without a nota. */
export function notaText(n: number | null | undefined): string {
  return known(n) ? round1(n).toFixed(1).replace(".", ",") : "—";
}
