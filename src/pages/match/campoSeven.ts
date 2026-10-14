// The Campo tab before the acta (M6, one «siete»): what goes on the pitch. Fans see the convocatoria's
// titulares, as ever; a member with the pizarra's official for this match sees that official seven with
// its «Siete oficial de la pizarra» badge, and a note when the convocatoria has another seven. Pure.
import { sameSeven, sevenDiffs } from "../pizarra/officialBoard";

export interface CampoSeven {
  /** The seven on the pitch (slot order). */
  field: string[];
  /** The called who aren't on the pitch. */
  bench: string[];
  /** It is the pizarra's official seven. */
  official: boolean;
  /** When the convocatoria disagrees: who it has in the siete instead (`conv`) of whom (`board`); an empty
   *  `conv` with no titulares at all = the convocatoria has no siete yet. Null = they agree (or no official). */
  differs: { conv: string[]; board: string[]; none: boolean } | null;
}

export function campoSeven(conv: { starters?: readonly string[]; bench?: readonly string[] }, official: readonly string[] | null | undefined): CampoSeven {
  const starters = [...(conv.starters ?? [])];
  const bench = [...(conv.bench ?? [])];
  if (!official?.length) return { field: starters, bench, official: false, differs: null };
  const field = [...official];
  const called = [...starters, ...bench];
  return {
    field,
    bench: called.filter((id, i) => !field.includes(id) && called.indexOf(id) === i),
    official: true,
    differs: sameSeven(field, starters) ? null : { ...sevenDiffs(starters, field), none: !starters.length },
  };
}

/** «Kevin y Almachi» / «A, B y C». */
const andList = (xs: string[]): string => (xs.length < 2 ? (xs[0] ?? "") : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]);

/** The note under the badge when the convocatoria disagrees (null when it agrees). */
export function campoSevenNote(d: CampoSeven["differs"], nameOf: (id: string) => string): string | null {
  if (!d) return null;
  if (d.none) return "La convocatoria aún no tiene siete: este es el de la pizarra.";
  if (!d.conv.length) return "La convocatoria tiene otro siete: le faltan " + andList(d.board.map(nameOf)) + ".";
  return "La convocatoria tiene otro siete: con " + andList(d.conv.map(nameOf)) + (d.board.length ? " en lugar de " + andList(d.board.map(nameOf)) : "") + ".";
}
