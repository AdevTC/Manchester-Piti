import type { ReactNode } from "react";
import { PlayerLink } from "../../components/celeste/PlayerLink";
import { isGuestId } from "../../lib/derived/guests";

/** A name from the acta: a member's links to his page (quietly); a guest («Rafa (invitado)») is plain text,
 *  never a PlayerLink: he has no page. */
export function Who({ id, seasonId, children }: { id: string; seasonId?: string; children?: ReactNode }) {
  if (isGuestId(id)) return <>{children}</>;
  return (
    <PlayerLink id={id} seasonId={seasonId} variant="quiet">
      {children}
    </PlayerLink>
  );
}
