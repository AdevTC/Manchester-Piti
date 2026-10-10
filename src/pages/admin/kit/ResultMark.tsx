// The V/E/D mark on every result (`.ved`): the letter, its colour and — for a defeat — a hatch, so the
// result never depends on colour alone (helpers in result.ts).

import { resultWord, type ResultLetter } from "./result";

/** `.ved`: the result's letter in its square (aria-label = the word). `sm` = the 20 px one. */
export function ResultMark({ r, small = false, className = "" }: { r: ResultLetter; small?: boolean; className?: string }) {
  return (
    <span className={["ved", r, small ? "sm" : "", className].filter(Boolean).join(" ")} role="img" aria-label={resultWord(r)}>
      {r}
    </span>
  );
}
