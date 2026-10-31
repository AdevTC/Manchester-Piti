// «El palco»: the small number helpers the prototype's arithmetic reads with.
// (the view model hands numbers as Spanish strings: «1.234», «45,5 %»)
/** A number from a figure («1.234» · «45,5 %» · «−3»); 0 when there is none. */
export const num = (x: unknown): number =>
  typeof x === "number"
    ? x
    : parseFloat(
        String(x ?? "")
          .replace(/−/g, "-")
          .replace(/\./g, "")
          .replace(",", ".")
          .replace(/[^\d.-]/g, ""),
      ) || 0;
/** A figure's value, NaN when it says there is none («–», «-», empty). */
export const val = (x: unknown): number => {
  const s = String(x ?? "").trim();
  if (!s || s === "-" || s === "–") return NaN;
  return num(s);
};
/** «1 punto» · «3 puntos». */
export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
/** A rival's initials for its badge when it has no crest: «Payo Vallecano» → «PV», «La 90-10» → «90». */
export const initials = (name: string): string => {
  const w = String(name || "")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter((x) => x && !/^(fc|f|c|cd|ud|de|del|la|el|los|las)$/i.test(x));
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "··").slice(0, 2)).toUpperCase();
};
/** For comparing words: no accents, lower case. */
export const norm = (s: string): string =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
