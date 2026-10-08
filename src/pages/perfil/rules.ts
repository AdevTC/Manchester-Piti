// «Tu nombre» on /profile: the live checks under the two fields (the shirt name and the vestuario
// handle), what the fields do to what you type, and the arch of the vinyl letters on the shirt. Pure.
// The rules themselves are the backend's (functions/src/profileLogic.ts): the page and the callable
// always agree.
import {
  NICK_COPY,
  nicknameProblem,
  normalizeShirtName,
  SHIRT_COPY,
  SHIRT_MAX,
  shirtNameProblem,
  type NickProblemCode,
  type ShirtOwner,
  type ShirtProblemCode,
} from "../../../functions/src/profileLogic";

export { NICK_COPY, NICK_MAX, NICK_MIN, SHIRT_COPY, SHIRT_MAX, SHIRT_MIN, SHIRT_UNDO_MS, normalizeShirtName } from "../../../functions/src/profileLogic";

/** Letter size of the print: grande ≤5 · normal ≤8 · estrecha ≤10 · muy estrecha ≤12 · «No cabe». */
export type ShirtSize = "n1" | "n2" | "n3" | "n4" | "nocabe";
/** How the message line reads: neutral (unchanged), a problem, or free to stamp. */
export type CheckTone = "same" | "bad" | "ok";

export function shirtSize(len: number): ShirtSize {
  return len <= 5 ? "n1" : len <= 8 ? "n2" : len <= 10 ? "n3" : len <= SHIRT_MAX ? "n4" : "nocabe";
}
/** The size chip over the close-up («Sin nombre» while empty). */
export function shirtFitLabel(len: number): string {
  if (!len) return "Sin nombre";
  return { n1: "Letra grande", n2: "Letra normal", n3: "Letra estrecha", n4: "Letra muy estrecha", nocabe: "No cabe" }[shirtSize(len)];
}

export interface SquadShirt {
  id: string;
  name: string;
  number?: number | string | null;
}
export type ShirtState = "same" | ShirtProblemCode | "ok";
export interface ShirtCheck {
  state: ShirtState;
  tone: CheckTone;
  message: string;
  size: ShirtSize;
  /** What would be printed (normalised) and its length, spaces included. */
  value: string;
  length: number;
  takenBy?: ShirtOwner;
}

/** «En la espalda»: the draft against the current name, the rules and the rest of the squad. */
export function shirtNameCheck(draft: string, current: string, squad: readonly SquadShirt[], myId: string | null): ShirtCheck {
  const value = normalizeShirtName(draft);
  const base = { value, length: value.length, size: shirtSize(value.length) };
  if (value.length && value === normalizeShirtName(current)) return { ...base, state: "same", tone: "same", message: SHIRT_COPY.same };
  const problem = shirtNameProblem(
    value,
    squad.filter((p) => p.id !== myId),
  );
  if (problem) return { ...base, state: problem.code, tone: "bad", message: problem.message, ...(problem.takenBy ? { takenBy: problem.takenBy } : {}) };
  return { ...base, state: "ok", tone: "ok", message: SHIRT_COPY.ok };
}

export type NickState = "same" | NickProblemCode | "taken" | "checking" | "ok";
export interface NickCheck {
  state: NickState;
  tone: CheckTone;
  message: string;
  length: number;
}
/**
 * «Tu apodo»: the backend's rules, then whether another member has it (`taken`: true/false once
 * known, "checking" while the lookup is on its way, undefined before asking).
 */
export function nicknameCheck(draft: string, current: string, taken?: boolean | "checking"): NickCheck {
  const length = draft.length;
  if (draft === current) return { state: "same", tone: "same", message: NICK_COPY.same, length };
  const problem = nicknameProblem(draft);
  if (problem) return { state: problem.code, tone: "bad", message: problem.message, length };
  if (taken === "checking") return { state: "checking", tone: "same", message: NICK_COPY.checking, length };
  if (taken === true) return { state: "taken", tone: "bad", message: NICK_COPY.taken, length };
  return { state: "ok", tone: "ok", message: NICK_COPY.ok, length };
}

export interface Typed {
  value: string;
  caret: number;
}
/** The shirt field writes in capitals as you type, keeping the caret where it was. */
export function typeShirtName(raw: string, caret: number): Typed {
  const up = (s: string) => s.toLocaleUpperCase("es-ES");
  return { value: up(raw), caret: up(raw.slice(0, Math.max(0, caret))).length };
}

const stripNick = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "");
/**
 * The handle field: lowercase, no accents (ñ → n) and no spaces, caret kept. `stripped` = accents or
 * spaces were removed (shows «Sin mayúsculas, tildes ni espacios…»); plain capitals don't count.
 */
export function typeNickname(raw: string, caret: number): Typed & { stripped: boolean } {
  const value = stripNick(raw);
  return { value, caret: stripNick(raw.slice(0, Math.max(0, caret))).length, stripped: value !== raw.toLowerCase() };
}

export interface ArchOffset {
  i: number;
  /** Vertical drop, in em-ish units of the print (t², 0 at the middle letter, 1 at both ends). */
  y: number;
  /** Rotation in degrees (t·5°). */
  r: number;
}
/** The vinyl letters sit on a gentle arch: t ∈ [-1, 1] across the name, y = t², rotate = t·5°. */
export function archOffsets(n: number): ArchOffset[] {
  const mid = (n - 1) / 2;
  const m = mid || 1;
  return Array.from({ length: Math.max(0, n) }, (_, i) => {
    const t = (i - mid) / m;
    return { i, y: Math.round(t * t * 100) / 100, r: Math.round(t * 50) / 10 || 0 };
  });
}
/** The letters of a print with their arch (a space keeps its width as a no-break space). */
export function archLetters(text: string): (ArchOffset & { c: string })[] {
  const chars = [...text];
  return archOffsets(chars.length).map((o, i) => ({ ...o, c: chars[i] === " " ? " " : chars[i] }));
}
