import { useState } from "react";

// A scoreboard tile (styles/partidos.css). Each new value remounts the tile, so it flips once per
// change: the countdown every second, the score at every goal. A tile with `still` set shows its value
// without the flip, decided when the value appears: the score tiles of a live match pass it so that a
// score that was already there (or that arrives late) does not flip, only a goal scored right now.
function Tile({ value, still, className }: { value: string | number; still: boolean; className: string }) {
  const [quiet] = useState(still);
  return (
    <span className={`pt-flip ${className}${quiet ? " still" : ""}`} aria-hidden="true">
      {value}
    </span>
  );
}

export function Flip({ value, className = "", still = false }: { value: string | number; className?: string; still?: boolean }) {
  return <Tile key={String(value)} value={value} still={still} className={className} />;
}
