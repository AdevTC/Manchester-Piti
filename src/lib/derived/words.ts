// Small Spanish wording helpers every page shares: counts with the right word («1 partido», «3 goles») and
// a capital first letter («Domingo, 8 nov»). One copy (the pages each had their own). Pure.

/** The word for `n` of it: `one` for exactly 1, else `many` (by default `one` + «s»). */
export const pluralWord = (n: number, one: string, many = one + "s"): string => (n === 1 ? one : many);

/** «1 partido», «2 partidos», «1 gol», «3 goles» (pass `many` when the plural isn't just + «s»). */
export const plural = (n: number, one: string, many = one + "s"): string => `${n} ${pluralWord(n, one, many)}`;

/** The text with its first letter in capitals: «domingo, 8 nov» → «Domingo, 8 nov». */
export const capital = (s: string): string => s.charAt(0).toLocaleUpperCase("es") + s.slice(1);

/** «ADRIÁN T.C.» → «Adrián T.C.»: a shirt name in capitals read as a name (initials keep theirs), for
 *  sentences and plays; the capitals stay only where a shirt or a plate is drawn. */
export function niceName(s: string): string {
  if (!s || s !== s.toLocaleUpperCase("es") || !/\p{L}/u.test(s)) return s;
  return s
    .split(/(\s+|-)/)
    .map((w) => (w.includes(".") || /^\s+$|^-$/.test(w) ? w : w.charAt(0) + w.slice(1).toLocaleLowerCase("es")))
    .join("");
}

/** A sentence's end: a full stop, unless the text already ends in one («Adrián T.C.», «Entrepibas F.C.»). */
export const endSentence = (s: string): string => (/[.!?…]$/.test(s) ? s : `${s}.`);
