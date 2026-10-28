// The sala's commands (salaCommands and what each screen registers: palette/registry) as entries of the web's search
// (components/celeste/searchModel): Acciones → accion, Sitios → seccion, Partidos → partido (its jornada found
// exactly), Jugadores → jugador (his dorsal, found exactly, and his printed shirt); anything else a screen adds is an
// action. The preview says what it is and where it leads; choosing it runs the command. Also the search's words
// for the sala (its scopes, its titles, what the empty field lists). Pure.
import type { SrEntry, SrKind, SrOptions, SrScope } from "../../../components/celeste/searchModel";
import type { TuIconName } from "../../../components/vidrio/tu/ui";
import type { PaletteCommand } from "../palette/search";

const KIND: Record<string, SrKind> = { Acciones: "accion", Sitios: "seccion", Partidos: "partido", Jugadores: "jugador" };

/** A command's glyph as one of the search's icons. */
const GLYPH: Record<string, TuIconName> = { "+": "plus", "✎": "post", "✓": "check", "↗": "expand", "↓": "download", "◐": "moon", "€": "euro", "7": "tab", "•": "arrow", C: "shield", T: "chart" };

/** Where to search in the sala (Tab cycles them): no rivals, no «Tu página»; «Sitios» is the scope of the places. */
export const SALA_SCOPES: readonly (readonly [SrScope, string])[] = [
  ["todo", "Todo"],
  ["jugador", "Jugadores"],
  ["partido", "Partidos"],
  ["tu", "Sitios"],
  ["accion", "Acciones"],
];

/** The sala's words, and its empty field: the pinned matches (the acta to do, the one that matters now), the
 *  actions and the five places. */
export const SALA_OPTIONS: SrOptions = {
  titles: { seccion: "Sitios", tu: "Sitios" },
  hint: "Un partido, un jugador, un sitio o algo que hacer",
  empty: ["partido", "accion", "seccion"],
};

/** The commands in their order inside each group (`order`, else as registered), as the search's entries. */
export function salaEntries(commands: readonly PaletteCommand[]): SrEntry[] {
  return commands
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.order ?? a.i) - (b.c.order ?? b.i))
    .map(({ c }): SrEntry => {
      const kind = KIND[c.group] ?? "accion";
      const exact = c.exact?.[0];
      const detail = c.description ?? c.hint ?? "";
      return {
        id: `sala:${c.id}`,
        kind,
        title: c.title,
        detail,
        kw: [c.keywords, c.hint, c.exact?.join(" ")].filter(Boolean).join(" "),
        num: kind === "jugador" && exact ? exact : undefined,
        jn: kind === "partido" && exact ? exact.replace(/^j/i, "") : undefined,
        icon: c.vicon ?? GLYPH[c.icon] ?? (kind === "partido" ? "fixtures" : "arrow"),
        keys: c.keys,
        idle: c.whenEmpty,
        // (the preview already says `detail` under the title: no line repeating it)
        pv: { line: "", url: c.href ?? "" },
        go: { to: "run", run: c.run },
      };
    });
}
