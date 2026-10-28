// The command palette's model (pure): what a command is, and how a query becomes the grouped results.
// Groups come in the designed order (Acciones, Sitios, Partidos, Jugadores, then anything a view adds).
import { normalize, textMatches } from "../../../lib/derived/search";

export type PaletteGroup = "Acciones" | "Sitios" | "Partidos" | "Jugadores" | (string & {});
export interface PaletteCommand {
  /** Unique across the palette (prefix with your view, e.g. "plantilla:exportar"). */
  id: string;
  group: PaletteGroup;
  /** The small square on the left: a glyph or 1–3 characters (e.g. "+", "PL", "J8", "9"). */
  icon: string;
  title: string;
  description?: string;
  /** The right-hand word: «acción», «ir», «abrir», «editar». */
  hint?: string;
  /** Its keyboard shortcut, shown as a key cap («G H» for a section). */
  keys?: string;
  /** Extra words that should find it (not shown). */
  keywords?: string;
  /** Tokens that find it only when typed exactly (a dorsal: "9" must not match "19"). */
  exact?: string[];
  /** Shown with an empty query (default true). Matches and players set false except the pinned ones. */
  whenEmpty?: boolean;
  /** Sort inside its group (lower first; default: registration order). */
  order?: number;
  run: () => void;
}
export interface PaletteSection {
  title: string;
  items: PaletteCommand[];
}

// (the boards' order: what you can do, the five places, then what you look for)
const GROUP_ORDER = ["Acciones", "Sitios", "Partidos", "Jugadores"];
/** Partidos / Jugadores list at most this many (the design's 6). */
export const GROUP_LIMIT: Record<string, number> = { Partidos: 6, Jugadores: 6 };

// The matching itself is the club's one model (lib/derived/search): the public «Buscar» reads text the same way.
export { normalize };

export function commandMatches(cmd: PaletteCommand, query: string): boolean {
  if (!normalize(query)) return cmd.whenEmpty !== false;
  return textMatches({ text: [cmd.title, cmd.description ?? "", cmd.keywords ?? ""].join(" "), exact: cmd.exact }, query);
}

/** The palette's result groups for `query` (empty groups dropped). */
export function buildPaletteGroups(commands: readonly PaletteCommand[], query: string): PaletteSection[] {
  const byGroup = new Map<string, PaletteCommand[]>();
  commands.forEach((c) => {
    if (!commandMatches(c, query)) return;
    const list = byGroup.get(c.group) ?? [];
    list.push(c);
    byGroup.set(c.group, list);
  });
  const names = [...byGroup.keys()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a);
    const ib = GROUP_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return names.map((title) => {
    const items = byGroup
      .get(title)!
      .map((c, i) => ({ c, i }))
      .sort((a, b) => (a.c.order ?? a.i) - (b.c.order ?? b.i))
      .map((x) => x.c);
    return { title, items: items.slice(0, GROUP_LIMIT[title] ?? items.length) };
  });
}

/** The flat option list (keyboard order). */
export const flatten = (groups: PaletteSection[]): PaletteCommand[] => groups.flatMap((g) => g.items);
