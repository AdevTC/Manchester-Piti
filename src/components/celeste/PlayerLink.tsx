// A squad member's name that leads to his page (/jugadores/$playerId). Every page that names a player
// names him through this: the season's name (nameFor) or the caller's own text, a link with the season
// in the URL when there is one, and plain text for an id nobody in the squad has.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useClubData } from "../../lib/clubData";
import { nameFor } from "../../lib/derived/names";
import "./celeste-links.css";

export interface PlayerLinkProps {
  /** The player's id (players/{id}). */
  id: string;
  /** The season he is named in: his shirt name that season, and ?season= on his page. */
  seasonId?: string | null;
  className?: string;
  /** The text to show instead of nameFor(player, seasonId) (the caller's own wording). */
  children?: ReactNode;
  /** "quiet" for dense places (scorer lists, minutes, the crónica): it keeps the colour around it and
   *  underlines only on hover or focus. */
  variant?: "quiet";
  /** -1 where the name sits in a decorative copy that has its own accessible version. */
  tabIndex?: number;
}

export function PlayerLink({ id, seasonId, className, children, variant, tabIndex }: PlayerLinkProps) {
  const { players } = useClubData();
  const player = id ? players.find((p) => p.id === id) : undefined;
  const label = children ?? nameFor(player, seasonId);
  if (!player) return className ? <span className={className}>{label}</span> : <>{label}</>;
  return (
    <Link
      to="/jugadores/$playerId"
      params={{ playerId: id }}
      search={seasonId ? { season: seasonId } : undefined}
      className={["pl-link", variant === "quiet" && "quiet", className].filter(Boolean).join(" ")}
      tabIndex={tabIndex}
    >
      {label}
    </Link>
  );
}
