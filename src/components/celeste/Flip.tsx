// A scoreboard tile (styles/partidos.css). Each new value remounts the tile, so it flips once per
// change: the countdown every second, the score at every goal.
export function Flip({ value, className = "" }: { value: string | number; className?: string }) {
  return (
    <span key={String(value)} className={`pt-flip ${className}`} aria-hidden="true">
      {value}
    </span>
  );
}
