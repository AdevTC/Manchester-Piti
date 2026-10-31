// The card's seal (TuCarta tc-seal): «3 cosas por hacer», counting down as he answers, gone at zero. Celeste/ink
// glass, never gold (gold is only our goals and the MVP); the number and the words, never the colour alone.
export function Seal({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="tc-seal" role="status">
      <span>
        <b>{n}</b>
        {n === 1 ? "cosa por hacer" : "cosas por hacer"}
      </span>
    </span>
  );
}
