// r14 «La pizarra» · Pachanga: the training it is for (PZ-D09). The owner region reads the vestuario's training,
// its «voy» and its saved attendance (data/attendance.ts) and keeps them in the `pg-src` slice, so every region and
// sheet reads the same thing; it also keeps the pachanga on this device (localStorage) between visits.
import type { PzApi, PzSlice } from "../../store/api";
import { emptyPg, type PgState } from "./pachangaView";
import { fmt } from "../../store/fmt";

export interface PgSource {
  loading: boolean;
  trainingId: string | null;
  slotId: string | null;
  /** The confirmed slot's start (ms) and place. */
  at: number | null;
  place: string;
  proposedBy: string | null;
  /** Who said «voy» to the confirmed slot: fichas, and names of members without one. */
  present: string[];
  guests: string[];
  /** Saved as attendance (who came), or null. */
  saved: { present: string[]; guests: string[]; at: number | null; by: string } | null;
}
export const EMPTY_SRC: PgSource = { loading: true, trainingId: null, slotId: null, at: null, place: "", proposedBy: null, present: [], guests: [], saved: null };
export const srcSlice = (P: PzApi): PzSlice<PgSource> => P.slice<PgSource>("pg-src", EMPTY_SRC);
export const srcOf = (P: PzApi): PgSource => srcSlice(P).get() ?? EMPTY_SRC;

/** Can this person save who came (firestore.rules trainingAttendance: a captain or whoever proposed it). */
export const canSaveAttendance = (P: PzApi, src: PgSource): boolean => !!src.trainingId && !!src.slotId && (P.sel.me().cap || (!!src.proposedBy && src.proposedBy === P.sel.me().uid));

const KEY = "mp_pizarra_r14_pachanga";
export function readLocalPg(): PgState | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PgState>;
    if (!v || !Array.isArray(v.comes) || !Array.isArray(v.teams) || (v.n !== 2 && v.n !== 3)) return null;
    return { ...emptyPg(), ...v } as PgState;
  } catch {
    return null;
  }
}
export function writeLocalPg(s: PgState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private window: the pachanga lives until the page closes */
  }
}

/** «hoy» / «jue 12 nov». */
export function dayWord(P: PzApi, ms: number): string {
  return fmt.day(ms) === fmt.day(P.state.W.now) ? "hoy" : fmt.day(ms);
}
/** Madrid YYYY-MM-DD of a moment (the absences' format). */
export function isoDay(ms: number): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  return p;
}
/** «12 nov» of a YYYY-MM-DD. */
export function isoShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][m - 1]}`;
}
