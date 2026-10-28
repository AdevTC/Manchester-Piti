// What a command of the sala's search is (⌘K, «Buscar»: the web's search, opened by the frame as the sala's own
// dialog, shell/SalaSearch). The frame registers the built-ins (Acciones, Sitios, Partidos, Jugadores: shell/
// salaCommands) and every screen can add its own while it is mounted (registry.ts); shell/salaEntries turns them into
// the search's entries. Pure.
import type { TuIconName } from "../../../components/vidrio/tu/ui";
import { normalize } from "../../../lib/derived/search";

export type PaletteGroup = "Acciones" | "Sitios" | "Partidos" | "Jugadores" | (string & {});
export interface PaletteCommand {
  /** Unique across the sala (prefix with your view, e.g. "plantilla:exportar"). */
  id: string;
  /** Acciones, Sitios, Partidos, Jugadores (anything else lists as an action). */
  group: PaletteGroup;
  /** The small square on the left: a glyph or 1–3 characters (e.g. "+", "PL", "J8", "9"); the search draws it as
   *  one of its icons (`vicon` when given). */
  icon: string;
  vicon?: TuIconName;
  title: string;
  description?: string;
  /** The right-hand word: «acción», «ir», «abrir», «editar». */
  hint?: string;
  /** Its keyboard shortcut, shown as a key cap («g h» for a place). */
  keys?: string;
  /** Extra words that should find it (not shown). */
  keywords?: string;
  /** Tokens that find it only when typed exactly (a dorsal: "9" must not match "19"; a jornada: "J3"). */
  exact?: string[];
  /** Shown with an empty field (default true). Matches and players set false except the pinned ones. */
  whenEmpty?: boolean;
  /** Sort inside its group (lower first; default: registration order). */
  order?: number;
  /** The address it opens (the preview shows it), when it opens one. */
  href?: string;
  run: () => void;
}

// The matching itself is the club's one model (lib/derived/search): the sala's lists read text the same way.
export { normalize };
