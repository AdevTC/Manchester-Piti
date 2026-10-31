// «El vestuario»: the pieces every room draws, ported from the canvas prototype (Vestuario.dc.html, vx.css) — a glyph,
// an icon tile, a room's head (the kicker, the room's live status in words as its title, what to do) and the toggle.
// Shirts and segmented controls are Estadísticas' (palco/kit: PShirt reads the page's printed stills, Seg the glass
// control with its bead). Styles: styles/vestuario/vestuario.css (ve-).
import type { CSSProperties, ReactNode } from "react";
import type { Bloque } from "./ctx";
import { VICON, type VIcon } from "./icons";

export { PShirt, Seg, type SegOpt } from "../../stats/palco/kit";

/** A glyph (decorative: the control around it carries the words); `d` draws a room's own path instead. */
export function Ic({ name, d, className, style }: { name?: VIcon; d?: string; className?: string; style?: CSSProperties }) {
  return (
    <svg className={`nx-ic${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={style}>
      <path d={d ?? (name ? VICON[name] : "")} />
    </svg>
  );
}

/** An icon tile (amber with `warn`: something of yours waits, said in words next to it too). */
export function Tile({ icon, warn, className }: { icon: VIcon; warn?: boolean; className?: string }) {
  return (
    <span className={`ve-tile${warn ? " ve-tile--warn" : ""}${className ? ` ${className}` : ""}`} aria-hidden="true">
      <Ic name={icon} />
    </span>
  );
}

/** The id of a room's title: the page moves the focus to it when the room opens. */
export const ROOM_TITLE_ID = "ve-room-h";

/**
 * A room's head: the kicker (its tile and «Room · what it is»), the room's live status in words as the page's title
 * («Debes 12,50 €», «Te toca: el agua», «2 llaman a la puerta»), what to do, and the room's own actions (a captain's).
 * The hub's door of this room grows into it (View Transition `cb-blk-<room>`).
 */
export function RoomHead({ room, icon, warn, kick, title, sub, acts }: { room: Bloque; icon: VIcon; warn?: boolean; kick: ReactNode; title: ReactNode; sub?: ReactNode; acts?: ReactNode }) {
  return (
    <header className="ve-head">
      <div className="ve-head__t">
        <p className="ve-kick" style={{ viewTransitionName: `cb-blk-${room}` }}>
          <Tile icon={icon} warn={warn} />
          {kick}
        </p>
        <h1 className="nx-h2" id={ROOM_TITLE_ID} tabIndex={-1}>
          {title}
        </h1>
        {sub != null && sub !== "" && <p className="nx-sub">{sub}</p>}
      </div>
      {acts && <div className="ve-head__acts">{acts}</div>}
    </header>
  );
}

/** An on/off switch (a real button with aria-pressed; the words say the state, the knob follows). */
export function Tog({ on, onToggle, disabled, children }: { on: boolean; onToggle: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" className="ve-tog" aria-pressed={on} disabled={disabled} onClick={onToggle}>
      <span className="ve-tog__t" aria-hidden="true" />
      <span>{children}</span>
    </button>
  );
}
