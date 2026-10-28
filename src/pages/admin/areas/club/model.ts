// CLUB · the office's pure rules (tested in model.test.ts): what each door says, when the table is behind the actas,
// the clasificación's and the turnos' drafts and their checks, and the words of the rooms.
import { looksLikeUs, norm, standingsErrors, standingsHints, stripText, STANDINGS_LIMITS, type FormLetter, type StandingRow, type Standings, type WebRecord } from "../../../../lib/standings";
import { rotaErrors, type RotaJob } from "../../../../lib/derived/rota";
import { plural } from "../../../../lib/derived/words";
import type { AdminMatch, AdminMatchState } from "../../data/adminLogic";

/** «la Temporada 1» / «“Archivo 2025/26”». */
export const la = (name: string) => (/^temporada/i.test(name) ? `la ${name}` : `«${name}»`);

/** The season's matches with a jornada, in order (the public calendar's). */
export function seasonJornadas(matches: readonly AdminMatch[], seasonId: string): AdminMatch[] {
  return matches.filter((m) => m.seasonId === seasonId && m.jornada !== null).sort((a, b) => (a.jornada ?? 0) - (b.jornada ?? 0));
}

/** The last published acta's jornada of the season (null: none yet). */
export function lastPublishedJornada(matches: readonly AdminMatch[], seasonId: string, stateOf: (m: AdminMatch) => AdminMatchState): number | null {
  const pub = seasonJornadas(matches, seasonId).filter((m) => stateOf(m) === "published" && m.status === "finished");
  return pub.length ? (pub[pub.length - 1].jornada ?? null) : null;
}

/** H-HOY-12: the web's table goes by an older jornada than the last published acta. Null: it doesn't (or no table). */
export function tableBehind(standings: Pick<Standings, "jornada"> | null, lastJ: number | null): { table: number; acta: number } | null {
  if (!standings || lastJ === null) return null;
  const table = standings.jornada ?? 0;
  return table < lastJ ? { table, acta: lastJ } : null;
}

/** The season's record from its published actas (our row is checked against it). */
export function webRecord(matches: readonly AdminMatch[], seasonId: string, stateOf: (m: AdminMatch) => AdminMatchState): WebRecord | null {
  const pub = seasonJornadas(matches, seasonId).filter((m) => stateOf(m) === "published" && m.status === "finished" && typeof m.goalsFor === "number" && typeof m.goalsAgainst === "number");
  if (!pub.length) return null;
  const r: WebRecord = { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0 };
  for (const m of pub) {
    const gf = m.goalsFor ?? 0;
    const ga = m.goalsAgainst ?? 0;
    r.pj++;
    r.gf += gf;
    r.gc += ga;
    if (gf > ga) r.g++;
    else if (gf === ga) r.e++;
    else r.p++;
  }
  return r;
}

/** What the web will say with these rows («Vamos 4.º de 7 · 4 pts · J3»), or why it can't. */
export function saysText(rows: readonly StandingRow[], jornada: number | null): string {
  return stripText({ rows: [...rows], jornada }) ?? "sin nuestra fila: la web no dice en qué puesto vamos";
}

// ───────────────────────── la clasificación's draft ─────────────────────────
export interface ClaRow extends StandingRow {
  /** A key that follows the row when it moves. */
  k: string;
}
export interface ClaDraft {
  rows: ClaRow[];
  competition: string;
  /** Digits only («» = none). */
  jornada: string;
  /** The saved table it started from (its signature; "" = none saved). */
  base: string;
  /** When it started (ms). */
  since: number;
}

let seq = 0;
export const rowKey = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;
export const withKeys = (rows: readonly StandingRow[]): ClaRow[] => rows.map((r) => ({ ...r, form: r.form ? [...r.form] : undefined, k: rowKey() }));
export const blankRow = (team = "", isUs = false): ClaRow => ({ team, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0, isUs, k: rowKey() });
/** Two tables are the same save when this matches. */
export const standingsSig = (s: Pick<Standings, "rows" | "jornada" | "competition" | "updatedAt"> | null): string => (s ? JSON.stringify([s.competition, s.jornada, s.updatedAt, s.rows.map((r) => [r.team, r.pj, r.g, r.e, r.p, r.gf, r.gc, r.pts, r.isUs, r.form ?? []])]) : "");

export function draftFrom(saved: Standings | null, now: number): ClaDraft {
  return { rows: withKeys(saved?.rows ?? []), competition: saved?.competition ?? "", jornada: saved?.jornada ? String(saved.jornada) : "", base: standingsSig(saved), since: now };
}
export const plainRows = (rows: readonly ClaRow[]): StandingRow[] => rows.map(({ k: _k, ...r }) => r);

/** «Falta para guardar» (blocks) and «Avisos, no impiden guardar». */
export function claChecks(rows: readonly ClaRow[], web: WebRecord | null): { errs: string[]; warns: string[] } {
  const plain = plainRows(rows);
  const errs = standingsErrors(plain);
  const seen = new Set<string>();
  for (const r of plain) {
    const n = norm(r.team);
    if (!n) continue;
    if (seen.has(n)) {
      errs.push(`«${r.team.trim()}» está dos veces.`);
      break;
    }
    seen.add(n);
  }
  const warns = standingsHints(plain, web).map((h) => h.text);
  return { errs, warns };
}
/** The jornada the save writes: the one written here, else none. */
export const draftJornada = (d: Pick<ClaDraft, "jornada">): number | null => {
  const n = parseInt(d.jornada, 10);
  return Number.isInteger(n) && n > 0 ? Math.min(n, STANDINGS_LIMITS.jornada) : null;
};
/** A number field: digits only, empty = 0, at most 3 digits. */
export const toCount = (v: string): number => {
  const n = parseInt(v.replace(/\D/g, "").slice(0, 3), 10);
  return Number.isInteger(n) ? n : 0;
};
/** «Manchester Piti» marked as us when the paste had no «nosotros». */
export function markUs(rows: ClaRow[]): ClaRow[] {
  if (rows.some((r) => r.isUs)) return rows;
  const i = rows.findIndex((r) => looksLikeUs(r.team));
  return i < 0 ? rows : rows.map((r, j) => ({ ...r, isUs: j === i }));
}
export const formLabel = (form: readonly FormLetter[] | undefined) => (form?.length ? `Últimos ${form.length}: ${form.map((l) => ({ G: "victoria", E: "empate", P: "derrota" })[l]).join(", ")}` : "Sin últimos partidos");

// ───────────────────────── los turnos' draft ─────────────────────────
export interface TurDraft {
  jobs: RotaJob[];
  /** The saved rota it started from (its signature; "" = none). */
  base: string;
  since: number;
}
export const rotaSig = (jobs: readonly RotaJob[] | null | undefined): string => (jobs ? JSON.stringify(jobs.map((j) => [j.id, j.name.trim(), j.icon, j.awayOnly, j.order])) : "");
export const turErrs = (jobs: readonly RotaJob[]): string[] => rotaErrors({ jobs: [...jobs] });

// ───────────────────────── words ─────────────────────────
export const countWord = (n: number, one: string, many: string) => plural(n, one, many);
/** «hace 5 min», «ayer», «el 12 oct» for the room's lines. */
export function relWhen(at: number | null | undefined, now: number): string {
  if (!at) return "hace un momento";
  const d = Math.max(0, now - at);
  const min = Math.round(d / 60_000);
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return `el ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }).format(at).replace(".", "")}`;
}
