// «¿Quién ha venido?» (QuienV3), pure: each convocado as a row with the pizarra's own data — his position
// code (the cromo's preferida, else his line), his GLOBAL (rtTxt) and a five-bar form meter read off that
// same number (the last three played with a goal or an assist each: «En racha», the perfil card's rule) —
// what he answered to the convocatoria, and the note under the list. The roll call itself is
// matches/{id}.present (setMatchPresent).
import type { Convocatoria, Cromo } from "../../pizarra/v2/model";
import { formAria, rtTxt } from "../../pizarra/v2/model";
import { TIER_ORO } from "../../../lib/rating/constants";

export interface Convocado {
  id: string;
  name: string;
  number: string;
  guest: boolean;
}

export const FORM_WORDS = ["Sin partidos", "Baja", "Floja", "Normal", "Buena", "Muy buena"] as const;

export interface FormMeter {
  /** Lit bars, 0 (no match yet) … 5. */
  level: number;
  word: string;
  /** «En racha»: a goal or an assist in each of his last three played matches. */
  hot: boolean;
  low: boolean;
}

/** Where GLOBAL's bands start (65 is a normal season, oro from TIER_ORO): Floja, Normal, Buena, Muy buena. */
export const FORM_BANDS = [55, 62, 68, TIER_ORO] as const;
/** The form meter for a cromo: its GLOBAL cut in five bands; «En racha» lights all five. */
export function formMeter(c: Pick<Cromo, "rt" | "unrated" | "form"> | undefined): FormMeter {
  if (!c || c.unrated) return { level: 0, word: FORM_WORDS[0], hot: false, low: false };
  const played = (c.form ?? []).filter((g) => g.played);
  const last3 = played.slice(-3);
  if (last3.length === 3 && last3.every((g) => g.ga > 0)) return { level: 5, word: "En racha", hot: true, low: false };
  const level = 1 + FORM_BANDS.filter((from) => c.rt >= from).length;
  return { level, word: FORM_WORDS[level], hot: false, low: level === 1 };
}

const RSVP: Record<Convocatoria, string> = { voy: "Dijo que viene", duda: "Dijo «duda»", no: "Dijo que no viene" };

export interface RollRow {
  id: string;
  name: string;
  number: string;
  /** His position code (POR, DFC…), his line, or «—». */
  pos: string;
  keeper: boolean;
  /** The rating as the cromo prints it («—» before his first match). */
  rt: string;
  form: FormMeter;
  here: boolean;
  /** «Ha venido» / «Dijo que viene» / «Dijo «duda»» / «Dijo que no viene» / «No contestó». */
  line: string;
  lineCls: "" | "duda" | "nova";
  aria: string;
}

/** The rows: who said «voy» or «duda» first, then who said no or didn't answer, each in convocatoria order. */
export function rollRows(called: readonly Convocado[], squad: ReadonlyMap<string, Cromo>, conv: ReadonlyMap<string, Convocatoria> | null, here: ReadonlySet<string>): { main: RollRow[]; rest: RollRow[] } {
  const rows = called.map((p): RollRow & { cv: Convocatoria | null } => {
    const c = squad.get(p.id);
    const cv = conv?.get(p.id) ?? null;
    const pos = c?.ps?.main ?? c?.pos ?? "—";
    const on = here.has(p.id);
    const form = formMeter(c);
    const line = on ? "Ha venido" : cv ? RSVP[cv] : p.guest ? "Invitado" : "No contestó";
    const formTxt = c ? formAria(c) : "sin forma aún";
    return {
      id: p.id,
      name: p.name,
      number: p.guest ? "Inv" : p.number,
      pos,
      keeper: pos === "POR",
      rt: c ? rtTxt(c) : "—",
      form,
      here: on,
      line,
      lineCls: !on && cv === "duda" ? "duda" : !on && cv === "no" ? "nova" : "",
      aria: `${p.name}, ${pos === "—" ? "sin posición" : pos}, ${formTxt}, forma ${form.word.toLowerCase()}, ${on ? "ha venido" : `no ha venido; ${line.toLowerCase()}`}`,
      cv,
    };
  });
  const strip = ({ cv: _cv, ...r }: RollRow & { cv: Convocatoria | null }): RollRow => r;
  return {
    main: rows.filter((r) => r.cv === "voy" || r.cv === "duda").map(strip),
    rest: rows.filter((r) => r.cv !== "voy" && r.cv !== "duda").map(strip),
  };
}

export interface RollNote {
  /** «8 para elegir · » / «Faltan 2 para el siete» / «Ojo: ». */
  a: string;
  /** «1 al banquillo» / «no ha venido ningún portero» (the gold part). */
  b: string;
  /** Seven or more have come. */
  enough: boolean;
  cta: string;
}

/** The note over the CTA and the CTA's words, from how many have come and whether a keeper is among them. */
export function rollNote(count: number, keeperHere: boolean): RollNote {
  if (count < 7) {
    const k = 7 - count;
    return { a: `Faltan ${k} para el siete`, b: "", enough: false, cta: `Faltan ${k}` };
  }
  if (!keeperHere) return { a: "Ojo: ", b: "no ha venido ningún portero", enough: true, cta: "Elegir el siete" };
  return { a: `${count} para elegir · `, b: count === 7 ? "nadie al banquillo" : `${count - 7} al banquillo`, enough: true, cta: "Elegir el siete" };
}

/** `present` with `id` switched, in convocatoria order (ids not called any more are dropped). */
export function togglePresent(present: readonly string[], id: string, called: readonly string[]): string[] {
  const set = new Set(present);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return called.filter((x) => set.has(x));
}

/** Same ids, any order. */
export const samePresent = (a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean => {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((id) => y.includes(id));
};
