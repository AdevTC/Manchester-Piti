// The pizarra's ways out to the rest of the app, as router links dressed as its chips (.b3): a player's
// public page («Ver su página», on his ficha) and the board's linked match (its page; for an admin, its
// Convocar in the Sala de control). The Board takes them as a prop, so it stays router-free.
import { Link } from "@tanstack/react-router";
import type { BoardProps } from "./Board";

export type BoardLinks = NonNullable<BoardProps["links"]>;

export function pizarraLinks(isAdmin: boolean): BoardLinks {
  return {
    player: (id) => (
      <Link className="b3" to="/jugadores/$playerId" params={{ playerId: id }}>
        Ver su página
      </Link>
    ),
    match: (matchId) => (
      <>
        <Link className="b3" to="/partidos/$matchId" params={{ matchId }}>
          Ver el partido
        </Link>
        {isAdmin && (
          <Link className="b3" to="/admin/partidos/$matchId/convocatoria" params={{ matchId }}>
            Convocar
          </Link>
        )}
      </>
    ),
  };
}
