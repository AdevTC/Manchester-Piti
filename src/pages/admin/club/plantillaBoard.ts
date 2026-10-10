// «El tablón» (Plantilla), pure (tested in plantillaBoard.test.ts): what each ficha still lacks (the empty
// slots of the row: posición, foto, nacimiento, altura, peso), whether he has his account in the vestuario
// (linked, asking for his ficha, none), the gap filters with their counts, the rows grouped by line
// (POR · DEF · MED · DEL · Sin posición), the repeated and the free dorsals. Router-, React- and Firebase-free.
import type { PlayerDoc } from "../../../lib/schemas";
import { POSITIONS, POS_LABEL, type PlantillaRow, type Position } from "./plantillaLogic";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A piece of the ficha that can be missing (the row's slots, in this order). */
export type GapKey = "pos" | "foto" | "nac" | "alt" | "peso";
export const GAPS: readonly { key: GapKey; short: string; label: string }[] = [
  { key: "pos", short: "Pos", label: "posición" },
  { key: "foto", short: "Foto", label: "foto" },
  { key: "nac", short: "Nac", label: "nacimiento" },
  { key: "alt", short: "Alt", label: "altura" },
  { key: "peso", short: "Peso", label: "peso" },
];
const has = (v: unknown) => (typeof v === "string" ? v.trim() !== "" : typeof v === "number" ? Number.isFinite(v) && v > 0 : false);
/** What his ficha still lacks, in the slots' order. */
export function gapsOf(p: Pick<PlayerDoc, "naturalPosition" | "photoUrl" | "birthDate" | "height" | "weight">): GapKey[] {
  const present: Record<GapKey, boolean> = {
    pos: (POSITIONS as readonly string[]).includes(String(p.naturalPosition ?? "").toUpperCase()),
    foto: has(p.photoUrl),
    nac: has(p.birthDate),
    alt: has(p.height),
    peso: has(p.weight),
  };
  return GAPS.filter((g) => !present[g.key]).map((g) => g.key);
}
/** «Le falta la foto, la altura y el peso» / «Ficha completa». */
export function gapsText(gaps: readonly GapKey[]): string {
  if (!gaps.length) return "Ficha completa";
  const words = gaps.map((k) => `${k === "pos" || k === "foto" || k === "alt" ? "la" : "el"} ${GAPS.find((g) => g.key === k)?.label ?? k}`);
  return `Le falta ${words.length < 2 ? words[0] : `${words.slice(0, -1).join(", ")} y ${words[words.length - 1]}`}`;
}

/** His account in the vestuario: linked (a member has his ficha), asking for it (a claim waits in Fichas), none. */
export type Account = "vinculada" | "pide" | "sin";
export interface AccountSources {
  people: readonly { playerId: string | null; removed: boolean; nickname?: string }[];
  claims: readonly { playerId: string; nickname?: string }[];
}
export function accountOf(id: string, src: AccountSources): { state: Account; who: string } {
  const owner = src.people.find((p) => !p.removed && p.playerId === id);
  if (owner) return { state: "vinculada", who: owner.nickname ?? "" };
  const claim = src.claims.find((c) => c.playerId === id);
  if (claim) return { state: "pide", who: claim.nickname ?? "" };
  return { state: "sin", who: "" };
}
export const ACCOUNT_LABEL: Record<Account, string> = { vinculada: "Cuenta vinculada", pide: "Pide su ficha", sin: "Sin cuenta" };

/** A row of the tablón: the plantilla row plus what it lacks and its account. */
export interface BoardRow extends PlantillaRow {
  gaps: GapKey[];
  account: Account;
  /** The member's nickname (linked) or the claimant's (asking). */
  who: string;
}
export function boardRows(rows: readonly PlantillaRow[], src: AccountSources): BoardRow[] {
  return rows.map((r) => {
    const a = accountOf(r.id, src);
    return { ...r, gaps: gapsOf(r.doc), account: a.state, who: a.who };
  });
}

/** The gap filters (the chips under the title): each one isolates the players that need that. */
export type BoardFilter = "todos" | "pos" | "foto" | "datos" | "lesion" | "cuenta" | "pide" | "dup";
export const FILTER_LABEL: Record<Exclude<BoardFilter, "todos">, string> = {
  pos: "Sin posición",
  foto: "Sin foto",
  datos: "Faltan datos",
  lesion: "Lesionados",
  cuenta: "Sin cuenta",
  pide: "Piden su ficha",
  dup: "Dorsal repetido",
};
/** The dorsals worn by more than one player of the season. */
export function repeatedDorsals(rows: readonly PlantillaRow[]): Set<number> {
  const seen = new Map<number, number>();
  for (const r of rows) if (r.inSeason && r.number != null) seen.set(r.number, (seen.get(r.number) ?? 0) + 1);
  return new Set([...seen].filter(([, n]) => n > 1).map(([num]) => num));
}
const DATOS: readonly GapKey[] = ["nac", "alt", "peso"];
export function matchesFilter(r: BoardRow, f: BoardFilter, dup: ReadonlySet<number>): boolean {
  switch (f) {
    case "todos":
      return true;
    case "pos":
      return r.gaps.includes("pos");
    case "foto":
      return r.gaps.includes("foto");
    case "datos":
      return r.gaps.some((g) => DATOS.includes(g));
    case "lesion":
      return r.injured;
    case "cuenta":
      return r.account === "sin";
    case "pide":
      return r.account === "pide";
    case "dup":
      return r.number != null && dup.has(r.number);
  }
}
/** The chips to show: only the filters something matches (exceptions only), with their counts. */
export function filterChips(rows: readonly BoardRow[]): { key: Exclude<BoardFilter, "todos">; label: string; n: number }[] {
  const dup = repeatedDorsals(rows);
  return (Object.keys(FILTER_LABEL) as Exclude<BoardFilter, "todos">[])
    .map((key) => ({ key, label: FILTER_LABEL[key], n: rows.filter((r) => matchesFilter(r, key, dup)).length }))
    .filter((c) => c.n > 0);
}

/** «12 de 16 fichas completas»: the collection bar. */
export function collection(rows: readonly BoardRow[]): { done: number; total: number; text: string } {
  const done = rows.filter((r) => !r.gaps.length).length;
  return { done, total: rows.length, text: `${done} de ${plural(rows.length, "ficha completa", "fichas completas")}` };
}

/** The tablón's groups: one per line in the field's order, «Sin posición» last; empty lines left out. */
export interface BoardGroup {
  key: Position | "none";
  title: string;
  rows: BoardRow[];
}
export function boardGroups(rows: readonly BoardRow[]): BoardGroup[] {
  const lines: BoardGroup[] = POSITIONS.map((p) => ({ key: p, title: `${POS_LABEL[p]}s`, rows: rows.filter((r) => r.position === p) }));
  lines.push({ key: "none", title: "Sin posición", rows: rows.filter((r) => !r.position) });
  return lines.filter((g) => g.rows.length);
}

/** The season's free dorsals (1–99, smallest first): «Alta» can start on one of them. */
export function freeDorsals(rows: readonly PlantillaRow[], limit = 99): number[] {
  const taken = new Set(rows.filter((r) => r.inSeason && r.number != null).map((r) => r.number));
  const out: number[] = [];
  for (let n = 1; n <= 99 && out.length < limit; n++) if (!taken.has(n)) out.push(n);
  return out;
}

/** «POR 2 · DEF 4 · MED 5 · DEL 3» and the ones without a line: the overview's formation strip. */
export function lineCounts(rows: readonly PlantillaRow[]): { key: Position | "none"; label: string; n: number }[] {
  return [...POSITIONS.map((p) => ({ key: p, label: p, n: rows.filter((r) => r.position === p).length })), { key: "none" as const, label: "Sin", n: rows.filter((r) => !r.position).length }];
}

/** A dorsal from the URL (`?dorsal=`): 1–99, else none. */
export function dorsalParam(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,2}$/.test(v) ? Number(v) : Number.NaN;
  return Number.isInteger(n) && n >= 1 && n <= 99 ? n : null;
}
