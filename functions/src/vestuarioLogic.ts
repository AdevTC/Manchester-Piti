// Pure rules shared by the backend and the web app (no Firebase imports).

export interface Score {
  goalsFor: number;
  goalsAgainst: number;
}
const outcome = (s: Score) => Math.sign(s.goalsFor - s.goalsAgainst);

/** Porra scoring: 3 for the exact score, 1 for the right result (win, draw or loss), 0 otherwise. */
export function predictionPoints(prediction: Score, result: Score) {
  if (
    prediction.goalsFor === result.goalsFor &&
    prediction.goalsAgainst === result.goalsAgainst
  )
    return 3;
  return outcome(prediction) === outcome(result) ? 1 : 0;
}

export interface PorraRow {
  uid: string;
  name: string;
  playerId: string | null;
  points: number;
  exact: number;
  hits: number;
  played: number;
}
/** Order the table: points, then exact scores, then fewer games needed, then name. */
export function sortPorra(rows: PorraRow[]) {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.exact - a.exact ||
      a.played - b.played ||
      a.name.localeCompare(b.name, "es"),
  );
}
