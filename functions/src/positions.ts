// Las posiciones de fútbol 7: el catálogo (13 códigos en 4 líneas), sus vecinas, y cómo leer lo que haya
// guardado (códigos o palabras, con o sin tildes). Puro y sin imports: lo usan la web (src/lib/positions.ts)
// y las funciones. Campo en %: x 0→100 izquierda→derecha, y 0 = portería rival … 100 = la nuestra.
export const POS_CODES = ["POR", "DFC", "LIB", "LI", "LD", "MCD", "MC", "MI", "MD", "MCO", "EI", "ED", "DC"] as const;
export type PosCode = (typeof POS_CODES)[number];
export const LINES = ["POR", "DEF", "MED", "DEL"] as const;
export type Line = (typeof LINES)[number];
export type Side = "izquierda" | "centro" | "derecha";

export interface PositionDef {
  code: PosCode;
  name: string;
  long: string;
  line: Line;
  side: Side;
  x: number;
  y: number;
  neighbours: readonly PosCode[];
}

const def = (code: PosCode, name: string, line: Line, side: Side, x: number, y: number, neighbours: PosCode[]): PositionDef => ({
  code,
  name,
  long: name.toLocaleUpperCase("es"),
  line,
  side,
  x,
  y,
  neighbours,
});

/** Las 13 posiciones. Vecinas = entre líneas (la misma línea ya cuenta como «adaptado» aparte). */
export const POSITIONS: Record<PosCode, PositionDef> = {
  POR: def("POR", "Portero", "POR", "centro", 50, 93, []),
  DFC: def("DFC", "Central", "DEF", "centro", 50, 76, ["MCD"]),
  LIB: def("LIB", "Líbero", "DEF", "centro", 50, 84, ["MCD"]),
  LI: def("LI", "Lateral izquierdo", "DEF", "izquierda", 14, 70, ["MI"]),
  LD: def("LD", "Lateral derecho", "DEF", "derecha", 86, 70, ["MD"]),
  MCD: def("MCD", "Pivote", "MED", "centro", 50, 62, ["DFC", "LIB"]),
  MC: def("MC", "Mediocentro", "MED", "centro", 50, 48, []),
  MI: def("MI", "Interior izquierdo", "MED", "izquierda", 18, 46, ["LI", "EI"]),
  MD: def("MD", "Interior derecho", "MED", "derecha", 82, 46, ["LD", "ED"]),
  MCO: def("MCO", "Mediapunta", "MED", "centro", 50, 34, ["DC"]),
  EI: def("EI", "Extremo izquierdo", "DEL", "izquierda", 16, 22, ["MI"]),
  ED: def("ED", "Extremo derecho", "DEL", "derecha", 84, 22, ["MD"]),
  DC: def("DC", "Punta", "DEL", "centro", 50, 14, ["MCO"]),
};

export const LINE_NAMES: Record<Line, { name: string; short: string; plural: string }> = {
  POR: { name: "Portero", short: "Portero", plural: "Porteros" },
  DEF: { name: "Defensa", short: "Defensa", plural: "Defensas" },
  MED: { name: "Centrocampista", short: "Medio", plural: "Medios" },
  DEL: { name: "Delantero", short: "Delantero", plural: "Delanteros" },
};

export const isPosCode = (x: unknown): x is PosCode => typeof x === "string" && (POS_CODES as readonly string[]).includes(x);
export const isLine = (x: unknown): x is Line => typeof x === "string" && (LINES as readonly string[]).includes(x);
export const lineOf = (code: PosCode): Line => POSITIONS[code].line;

export function positionLabel(code: PosCode, form: "short" | "name" | "long" = "short"): string {
  return form === "short" ? code : form === "name" ? POSITIONS[code].name : POSITIONS[code].long;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s\-_/.,·]+/g, " ")
    .trim();

// Frases completas → posición exacta (se comparan ya sin tildes, en minúsculas y con un espacio).
const EXACT = new Map<string, PosCode>();
const ex = (c: PosCode, ...ws: string[]) => ws.forEach((w) => EXACT.set(w, c));
ex("POR", "por", "portero", "portera", "porteros", "guardameta", "arquero", "gk");
ex("DFC", "dfc", "central", "centrales", "defensa central", "defensor central");
ex("LIB", "lib", "libero", "ultimo hombre");
ex("LI", "li", "lateral izquierdo", "lateral izq", "carrilero izquierdo");
ex("LD", "ld", "lateral derecho", "lateral dcho", "carrilero derecho");
ex("MCD", "mcd", "pivote", "mediocentro defensivo", "medio defensivo", "medio centro defensivo");
ex("MC", "mc", "mediocentro", "medio centro", "mediocampista central", "centrocampista central");
ex("MI", "mi", "interior izquierdo", "medio izquierdo", "volante izquierdo");
ex("MD", "md", "interior derecho", "medio derecho", "volante derecho");
ex("MCO", "mco", "mediapunta", "media punta", "enganche", "mediocentro ofensivo");
ex("EI", "ei", "extremo izquierdo", "extremo izq");
ex("ED", "ed", "extremo derecho", "extremo dcho");
ex("DC", "delantero centro", "punta", "ariete", "nueve", "9", "dc");

// Palabras que solo dicen la línea (la primera palabra decide, como hacía normZone).
const LINE_WORDS = new Map<string, Line>();
const lw = (l: Line, ...ws: string[]) => ws.forEach((w) => LINE_WORDS.set(w, l));
lw("POR", "por", "portero", "portera", "porteros", "guardameta", "arquero", "gk");
lw("DEF", "def", "defensa", "defensas", "defensor", "defensora", "defensores", "defensivo", "lateral", "laterales", "central", "centrales", "carrilero", "libero", "dfc", "ld", "li", "lib");
lw("MED", "med", "medio", "medios", "media", "mediocampista", "centrocampista", "centrocampistas", "mediocentro", "mediapunta", "pivote", "interior", "volante", "mc", "mcd", "mco", "mi", "md");
lw("DEL", "del", "delantero", "delantera", "delanteros", "extremo", "extremos", "punta", "ariete", "dc", "ed", "ei");

/** La posición exacta (si se puede leer sin adivinar) y su línea. */
export function parsePosition(x: unknown): { code: PosCode | null; line: Line | null } {
  if (typeof x !== "string") return { code: null, line: null };
  const s = fold(x);
  if (!s) return { code: null, line: null };
  const code = EXACT.get(s) ?? null;
  if (code) return { code, line: lineOf(code) };
  const line = LINE_WORDS.get(s) ?? LINE_WORDS.get(s.split(" ")[0]) ?? null;
  return { code: null, line };
}

// ── Las posiciones de un jugador ───────────────────────────────────────────────
export const MAX_ALSO = 6;
export interface PositionSet {
  main: PosCode | null;
  also: PosCode[];
}
export interface ResolvedPositions extends PositionSet {
  /** La línea: la de la preferida, o la del texto antiguo; null = no se sabe. */
  line: Line | null;
}

/** Un mapa guardado, limpio: códigos válidos, sin repetidos, sin la preferida en «también», ≤ 6. */
export function sanitizePositions(x: unknown): PositionSet | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const r = x as { main?: unknown; also?: unknown };
  const main = isPosCode(r.main) ? r.main : null;
  const also: PosCode[] = [];
  if (Array.isArray(r.also)) for (const c of r.also) if (isPosCode(c) && c !== main && !also.includes(c) && also.length < MAX_ALSO) also.push(c);
  return { main, also };
}

/** Lo que vale para toda la web: `positions` si existe; si no, lo que se pueda leer de `naturalPosition`. */
export function resolvePositions(doc: { positions?: unknown; naturalPosition?: unknown }): ResolvedPositions {
  const legacy = parsePosition(doc.naturalPosition);
  const set = sanitizePositions(doc.positions);
  if (set) return { ...set, line: set.main ? lineOf(set.main) : legacy.line };
  return { main: legacy.code, also: [], line: legacy.line };
}

export type FitGrade = 0 | 1 | 2 | 3;
/** 3 preferida · 2 también · 1 adaptado (su línea o vecina) · 0 fuera de sitio · null sin datos. Portería: solo lo declarado. */
export function fitGrade(p: PositionSet & { line?: Line | null }, slot: PosCode): FitGrade | null {
  if (p.main === slot) return 3;
  if (p.also.includes(slot)) return 2;
  const mine = [...(p.main ? [p.main] : []), ...p.also];
  if (!mine.length) {
    if (!p.line) return null;
    return slot !== "POR" && p.line !== "POR" && lineOf(slot) === p.line ? 1 : 0;
  }
  if (slot === "POR" || mine.every((c) => c === "POR")) return 0;
  const line = lineOf(slot);
  return mine.some((c) => c !== "POR" && (lineOf(c) === line || POSITIONS[c].neighbours.includes(slot))) ? 1 : 0;
}

/** Lo que se lee de un jugador en una línea de texto: «Pivote», o «Defensa» si solo se sabe la línea. */
export function positionText(doc: { positions?: unknown; naturalPosition?: unknown }): string | undefined {
  const r = resolvePositions(doc);
  return r.main ? POSITIONS[r.main].name : r.line ? LINE_NAMES[r.line].name : undefined;
}

/** La migración: a quién le falta `positions` y qué se le escribe (sin adivinar códigos a partir de una línea). */
export function legacyPlan(players: { id: string; positions?: unknown; naturalPosition?: unknown }[]): { id: string; from: string; to: PositionSet }[] {
  return players
    .filter((p) => sanitizePositions(p.positions) === null)
    .map((p) => ({ id: p.id, from: typeof p.naturalPosition === "string" ? p.naturalPosition : "", to: { main: parsePosition(p.naturalPosition).code, also: [] } }));
}
