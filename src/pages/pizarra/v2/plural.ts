// Counts in Spanish, singular or plural as the number asks: «1 partido», «0 partidos», «3 goles».
// Pure.

/** The word for `n` of it: `one` for exactly 1, else `many` (by default `one` + «s»). */
export const pluralWord = (n: number, one: string, many = one + "s"): string => (n === 1 ? one : many);

/** «1 partido», «2 partidos», «1 gol», «3 goles» (pass `many` when the plural isn't just + «s»). */
export const plural = (n: number, one: string, many = one + "s"): string => n + " " + pluralWord(n, one, many);
