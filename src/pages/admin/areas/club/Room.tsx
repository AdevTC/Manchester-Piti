// CLUB · what every room of the office shares (board part-club.html § room): its head (on the desktop «‹ La oficina»
// over the title; below 1100 the frame's header says it, with «‹»), the line that says how the room saves (A-CLUB-06),
// the one primary action, and at its foot «La siguiente sala» and the way back. On the desktop the room fills the
// frame and its columns scroll inside (law 7).
import type { ReactNode } from "react";
import { VIcon } from "../../../../components/vidrio/VIcon";
import { SalaScreen, type PrimarySpec } from "../../shell/Screen";
import { SalaLink } from "../../shell/SalaLink";
import { useFrame } from "../../ui/frame";
import { OFFICE, ROOMS, roomOf, roomPath, useClubCommands, type RoomId } from "./rooms";
import "./club.css";

/** Small glyphs the shared sprite has not got (info, edit, trash). */
export function ClIcon({ name, size = 18 }: { name: "info" | "edit" | "trash"; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false, className: "cl-ico" };
  if (name === "info")
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.5v.01" />
      </svg>
    );
  if (name === "edit")
    return (
      <svg {...p}>
        <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
        <path d="m13.5 6.5 4 4" />
      </svg>
    );
  return (
    <svg {...p}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  );
}

export interface RoomScreenProps {
  room: RoomId;
  /** The h1 (default: the room's name); a web section names itself. */
  title?: string;
  lede?: string;
  /** Where «‹» goes (default: the office). */
  back?: { to: string; label: string; word: string };
  primary?: PrimarySpec | null;
  actions?: ReactNode;
  /** Hide «La siguiente sala» (a web section's foot only goes back). */
  noNext?: boolean;
  children: ReactNode;
}

export function RoomScreen({ room, title, lede, back, primary, actions, noNext, children }: RoomScreenProps) {
  const { desktop } = useFrame();
  useClubCommands();
  const def = roomOf(room);
  const to = back ?? { to: OFFICE, label: "Volver a la oficina", word: "‹ La oficina" };
  const i = ROOMS.findIndex((r) => r.id === room);
  const next = ROOMS[(i + 1) % ROOMS.length];
  return (
    <SalaScreen
      className="cl cl-room"
      title={<span className="sc-morph" style={{ viewTransitionName: title ? "none" : `cl-door-${room}` }}>{title ?? def.name}</span>}
      headTitle={title ?? def.name}
      kicker={
        <SalaLink className="vd-link cl-back" to={to.to}>
          {to.word}
        </SalaLink>
      }
      lede={lede}
      back={{ to: to.to, label: to.label }}
      primary={primary}
      actions={actions}
      fit={desktop}
    >
      <p className="cl-save sc-small">
        <ClIcon name="info" size={16} />
        <span>{def.save}</span>
      </p>
      {children}
      <footer className="cl-next">
        {!noNext && (
          <SalaLink className="cl-next__b" to={roomPath(next.id)}>
            <span>La siguiente sala</span>
            <b>{next.name}</b>
            <VIcon name="chevR" size={18} />
          </SalaLink>
        )}
        <SalaLink className="vd-link" to={to.to}>
          {to.word}
        </SalaLink>
      </footer>
    </SalaScreen>
  );
}
