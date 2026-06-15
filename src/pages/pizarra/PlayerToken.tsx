import React from "react";
import { useDraggable } from "@dnd-kit/react";
import { Lock } from "lucide-react";
import { Jersey } from "../../components/Jersey";
import type { PizarraPlayer } from "./usePizarraPlayers";
import type { RoleMeta } from "./formations";
import type { PizarraSettings } from "./usePizarraSettings";

export interface TokenData {
  kind: "token";
  playerId: string;
  from: "slot" | "bench";
}

interface PlayerTokenProps {
  player: PizarraPlayer;
  galones: RoleMeta[];
  from: "slot" | "bench";
  /** True when this token is the pending tap-to-place pickup. */
  picked: boolean;
  pinned: boolean;
  variant: "pitch" | "bench";
  jerseySize: number;
  settings: PizarraSettings;
  /** Effective position label to show (when settings.showPosition). */
  positionLabel?: string;
  /** True when the player's effective zone differs from the slot's zone. */
  outOfPosition: boolean;
  /** Suspended (derived from cards) or injured (admin flag). */
  unavailable?: boolean;
  /** Read-only board: drag + tap are turned off (token stays focusable). */
  disabled?: boolean;
  onActivate: () => void;
}

// One player on the board: a draggable jersey. Chrome (number, name, position,
// galones, out-of-position cue, pin badge) is driven by display settings.
// Draggable via @dnd-kit, and a real <button> so tap-to-place and keyboard
// (Enter/Espacio) work without a pointer. Editing of position/pin lives in the
// side panels, not here, so the token stays clean and never clips.
export const PlayerToken: React.FC<PlayerTokenProps> = ({
  player,
  galones,
  from,
  picked,
  pinned,
  variant,
  jerseySize,
  settings,
  positionLabel,
  outOfPosition,
  unavailable = false,
  disabled = false,
  onActivate,
}) => {
  const data: TokenData = { kind: "token", playerId: player.id, from };
  const { ref, isDragging } = useDraggable({ id: player.id, data, disabled });

  const name = player.shirtName || player.firstName || player.lastName || `Nº${player.number}`;
  const showOop = outOfPosition && settings.showOutOfPosition;
  const showNameRow = settings.showNumber || settings.showName;

  const className = [
    "pz-token",
    `pz-token--${variant}`,
    isDragging ? "is-dragging" : "",
    picked ? "is-picked" : "",
    showOop ? "is-oop" : "",
    unavailable ? "is-unavailable" : "",
    disabled ? "is-readonly" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type="button"
      className={className}
      style={{ viewTransitionName: `pz-token-${player.id}` } as React.CSSProperties}
      onClick={disabled ? undefined : onActivate}
      aria-disabled={disabled || undefined}
      aria-pressed={picked}
      aria-label={`${name}, dorsal ${player.number}${positionLabel ? `, ${positionLabel}` : ""}${pinned ? ", fijado" : ""}${showOop ? ", fuera de posición" : ""}${unavailable ? ", no disponible" : ""}${picked ? ", seleccionado para mover" : ""}`}
    >
      <span className="pz-token-jersey" aria-hidden="true">
        <Jersey name={player.shirtName} number={player.number} size="sm" style={{ filter: "none", width: jerseySize, height: jerseySize }} />
      </span>

      {showNameRow && (
        <span className="pz-token-name">
          {settings.showNumber && <b className="pz-token-num">{player.number}</b>}
          {settings.showName && <span className="pz-token-label">{name}</span>}
        </span>
      )}

      {settings.showPosition && positionLabel && (
        <span className="pz-token-pos">{positionLabel}</span>
      )}

      {settings.showGalones && galones.length > 0 && (
        <span className="pz-token-roles" aria-hidden="true">
          {galones.map((r) => (
            <span key={r.key} className="pz-role-seal" title={r.aria}>
              {r.glyph}
            </span>
          ))}
        </span>
      )}

      {pinned && (
        <span className="pz-token-pin" aria-hidden="true" title="Fijado">
          <Lock size={10} />
        </span>
      )}

      {showOop && (
        <span className="pz-token-oop" aria-hidden="true" title="Fuera de posición">≠</span>
      )}

      {unavailable && (
        <span className="pz-token-unavail" aria-hidden="true" title="No disponible">✚</span>
      )}
    </button>
  );
};
