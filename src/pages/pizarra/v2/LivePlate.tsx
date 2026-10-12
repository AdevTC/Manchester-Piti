// The command bar's live plate while the board's match is played: «EN DIRECTO 23′», the score and the
// next tanda («CAMBIO 25′ · EN 2′», «¡CAMBIO YA!»). A tap opens Siete → Cambios (the live view). Not a
// live region: what matters is said by the board's one announcer; the minute is the match clock's.
import { Icon } from "./icons";
import type { LiveWave } from "./live";

export interface LivePlateProps {
  minute: number;
  gf: number;
  ga: number;
  next: LiveWave | null;
  aria: string;
  onOpen: () => void;
}

export function LivePlate({ minute, gf, ga, next, aria, onOpen }: LivePlateProps) {
  const nx = next ? (next.due ? "¡Cambio ya! · " + next.wave.min + "′" : "Cambio " + next.wave.min + "′ · en " + next.inMin + "′") : null;
  return (
    <button type="button" className={"lvp" + (next?.due ? " due" : "")} onClick={onOpen} aria-label={aria + (nx ? ". " + nx : "") + ". Abrir los cambios"}>
      <span className="lvp-l">
        <i aria-hidden="true" />
        En directo
      </span>
      <b>{minute}′</b>
      <span className="lvp-s">
        {gf}–{ga}
      </span>
      {nx && (
        <small>
          <Icon n="swap" w={12} />
          {nx}
        </small>
      )}
    </button>
  );
}
