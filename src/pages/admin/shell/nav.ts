// The sala's router-free targets: where a «Te toca» line, a button or a palette command goes (useAdminGo turns one
// into its address, context.ts targetHref; the old addresses are redirected in lib/adminUrls). The sala's places
// themselves are places.ts.

export type SectionKey = "hoy" | "partidos" | "convocar" | "plantilla" | "fichas" | "temporadas" | "capitanes" | "contenido" | "caja" | "clasificacion" | "turnos";

/** The match's old tabs (a target may still name one): each one a station now (lib/adminUrls). */
export type MatchTab = "encuentro" | "convocatoria" | "acta" | "publicar";

/** A counter: only exceptions, its words for the accessible name («2 por hacer»). */
export interface Counter {
  n: number;
  /** «N por hacer»; empty when n is 0. */
  label: string;
}

/** Where a «Por hacer» line / button / palette command goes, router-free (useAdminGo navigates). */
export interface AdminTarget {
  /** A section, la mesa of a match (`enjuego`), the pizarra or the web (a match's or a player's public page). */
  section: SectionKey | "enjuego" | "pizarra" | "web";
  /** partidos / enjuego / convocar / caja (its «Coste del partido») / web: the match. */
  matchId?: string;
  /** pizarra: the board to open (absent = as you left it) and its season. */
  tablero?: string;
  seasonId?: string;
  /** partidos: the station (as the old tab). */
  tab?: MatchTab;
  /** partidos: «Después» (the publish peak). */
  vitrina?: boolean;
  /** plantilla: this player's ficha; web: his public page. */
  playerId?: string;
  /** partidos «Nuevo partido» / plantilla «Alta de jugador». */
  nuevo?: boolean;
  /** contenido: this section of the web of the club. */
  seccion?: string;
}
