// The command palette's model (pure): what a command is, and how a query becomes the grouped results.
// Groups come in a fixed order (Acciones, Secciones, Partidos, Jugadores, then anything a view adds).

export type PaletteGroup = "Acciones" | "Secciones" | "Partidos" | "Jugadores" | (string & {});
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

const GROUP_ORDER = ["Acciones", "Secciones", "Partidos", "Jugadores"];
/** Partidos / Jugadores list at most this many (the design's 6). */
export const GROUP_LIMIT: Record<string, number> = { Partidos: 6, Jugadores: 6 };

/** Lower-case, no accents, collapsed spaces ("ADRIÁN  T.C." → "adrian t.c."). */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function commandMatches(cmd: PaletteCommand, query: string): boolean {
  const q = normalize(query);
  if (!q) return cmd.whenEmpty !== false;
  const compact = q.replace(/\s/g, "");
  if (cmd.exact?.some((t) => normalize(t).replace(/\s/g, "") === compact)) return true;
  // «J1» is a jornada: it must not find J10–J19 (commands that carry a jornada token match it exactly).
  if (/^j\d+$/.test(compact) && cmd.exact?.some((t) => /^j\d+$/.test(normalize(t)))) return false;
  const hay = normalize([cmd.title, cmd.description ?? "", cmd.keywords ?? ""].join(" "));
  // «J 8» finds «J8»; every word of the query must appear.
  if (hay.replace(/\s/g, "").includes(compact)) return true;
  return q.split(" ").every((w) => hay.includes(w));
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
