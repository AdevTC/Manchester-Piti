import React from "react";
import { useDroppable } from "@dnd-kit/react";
import type { SlotState } from "./formations";

export interface SlotData {
  kind: "slot";
  slotId: string;
  index: number;
}

interface PitchSlotProps {
  slot: SlotState;
  index: number;
  /** True while a tap-to-place pickup is pending (slot becomes a target). */
  pendingPlace: boolean;
  /** Show the position label on the empty slot (display setting). */
  showLabel: boolean;
  /** Read-only board: drop target + empty-slot tap are turned off. */
  disabled?: boolean;
  /** Rendered token when the slot is occupied. */
  children?: React.ReactNode;
  /** Place the pending pickup into this slot (empty-slot tap / keyboard). */
  onActivate: () => void;
}

// A position on the pitch: a drop target (@dnd-kit) placed by percentage.
// When empty it is a focusable button labelled with its position (POR, MC…)
// so a pending pickup can be placed by tap or keyboard. When occupied the
// token itself owns activation, so the wrapper is a plain div.
export const PitchSlot: React.FC<PitchSlotProps> = ({ slot, index, pendingPlace, showLabel, disabled = false, children, onActivate }) => {
  const data: SlotData = { kind: "slot", slotId: slot.slotId, index };
  const { ref, isDropTarget } = useDroppable({ id: slot.slotId, data, disabled });
  const occupied = slot.playerId !== null;

  const className = [
    "pz-slot",
    occupied ? "is-occupied" : "is-empty",
    isDropTarget ? "is-over" : "",
    pendingPlace ? "is-target" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const style = { left: `${slot.x}%`, top: `${slot.y}%` } as React.CSSProperties;

  if (occupied) {
    return (
      <div ref={ref} className={className} style={style} data-position={slot.position}>
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} className={className} style={style}>
      <button
        type="button"
        className={`pz-slot-empty${showLabel ? "" : " is-bare"}`}
        onClick={disabled ? undefined : onActivate}
        aria-disabled={disabled || undefined}
        aria-label={pendingPlace ? `Colocar en ${slot.position}` : `Posición ${slot.position}, vacía`}
      >
        {showLabel && <span className="pz-slot-pos">{slot.position}</span>}
      </button>
    </div>
  );
};
