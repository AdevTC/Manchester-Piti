// Pure rules of «Tu nombre» (the /profile page): the name printed on the back of the shirt
// (players/{id}.shirtName) and the vestuario handle (users/{uid}.nickname). Shared by the callables
// (profile.ts) and the web app (src/pages/perfil/rules.ts), so both say exactly the same thing.
// No Firebase imports here.

export const SHIRT_MIN = 2;
export const SHIRT_MAX = 12;
export const NICK_MIN = 3;
export const NICK_MAX = 15;
/** How long «Deshacer» can bring back a previous shirt name the current rules would refuse. */
export const SHIRT_UNDO_MS = 10 * 60_000;

/** Handles that would read as the club itself. */
export const RESERVED_NICKNAMES: readonly string[] = ["admin", "capitan", "capitanes", "manchesterpiti", "piti", "soporte", "sistema"];

/** Case- and accent-insensitive key (NFD, combining marks stripped; ñ → N, ç → C), spaces collapsed. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** What goes to print: Spanish capitals, typographic apostrophes as «'», spaces collapsed and trimmed. */
export function normalizeShirtName(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .toLocaleUpperCase("es-ES")
    .replace(/\s+/g, " ")
    .trim();
}

export type ShirtProblemCode = "empty" | "short" | "long" | "digits" | "chars" | "noletter" | "taken";
export interface ShirtOwner {
  id: string;
  name: string;
  number?: number | string | null;
}
export interface ShirtProblem {
  code: ShirtProblemCode;
  message: string;
  takenBy?: ShirtOwner;
}

export const SHIRT_COPY = {
  same: "Es lo que llevas ahora",
  empty: "Escribe lo que quieres a tu espalda",
  short: "Mínimo 2 caracteres",
  long: "Máximo 12 caracteres: no cabe en la espalda",
  digits: "Sin números: el dorsal ya va debajo",
  chars: "Solo letras, espacios, punto, guion o apóstrofo",
  noletter: "Pon al menos una letra",
  ok: "Libre: así quedará a tu espalda",
  notLinked: "Cuando tengas ficha podrás elegir lo que va en tu espalda.",
} as const;

/** «Ya la lleva el 9 (ERIK): elige otro». */
export function shirtTakenMessage(owner: ShirtOwner): string {
  const num = owner.number === null || owner.number === undefined || owner.number === "" ? "" : String(owner.number);
  return num ? `Ya la lleva el ${num} (${owner.name}): elige otro` : `Ya la lleva ${owner.name}: elige otro`;
}

const ALLOWED = /^[A-ZÁÉÍÓÚÜÑÇ .'’-]+$/;
const LETTER = /[A-ZÁÉÍÓÚÜÑÇ]/;

/**
 * Rules 2–5 of «En la espalda» on a name (normalised here): length 2–12 (characters incl. spaces),
 * no digits, only letters (tilde/ñ/ç), space, point, hyphen or apostrophe, at least one letter, and
 * not the same as another player's (case- and accent-insensitive). `others` must not include the
 * player himself. Null = fine.
 */
export function shirtNameProblem(name: string, others: readonly ShirtOwner[]): ShirtProblem | null {
  const n = normalizeShirtName(name);
  const code = shirtFormatProblem(n);
  if (code) return { code, message: SHIRT_COPY[code] };
  const key = fold(n);
  const owner = others.find((o) => o.name && fold(o.name) === key);
  if (owner) return { code: "taken", message: shirtTakenMessage(owner), takenBy: owner };
  return null;
}

/** The format rules only (2–4), on an already normalised name. */
export function shirtFormatProblem(n: string): Exclude<ShirtProblemCode, "taken"> | null {
  if (!n.length) return "empty";
  if (n.length < SHIRT_MIN) return "short";
  if (n.length > SHIRT_MAX) return "long";
  if (/[0-9]/.test(n)) return "digits";
  if (!ALLOWED.test(n)) return "chars";
  if (!LETTER.test(n)) return "noletter";
  return null;
}

export type NickProblemCode = "empty" | "short" | "long" | "chars" | "reserved";
export const NICK_COPY = {
  same: "Es tu apodo de ahora",
  empty: "Escribe tu apodo",
  short: "Mínimo 3 caracteres",
  long: "Máximo 15 caracteres",
  chars: "Solo letras a–z, números y _ (sin puntos ni guiones)",
  reserved: "Ese apodo es del club: elige otro",
  taken: "Ya lo usa otro socio del vestuario",
  checking: "Comprobando si está libre…",
  ok: "Libre: así te verán en el vestuario",
  fix: "Sin mayúsculas, tildes ni espacios: los quitamos al escribir (ñ pasa a n).",
} as const;

/** The callable's rules for a handle: 3–15 chars of a–z, 0–9 and _, not reserved. Null = fine. */
export function nicknameProblem(n: string): { code: NickProblemCode; message: string } | null {
  const code: NickProblemCode | null = !n.length
    ? "empty"
    : n.length < NICK_MIN
      ? "short"
      : n.length > NICK_MAX
        ? "long"
        : !/^[a-z0-9_]+$/.test(n)
          ? "chars"
          : RESERVED_NICKNAMES.includes(n)
            ? "reserved"
            : null;
  return code ? { code, message: NICK_COPY[code] } : null;
}
