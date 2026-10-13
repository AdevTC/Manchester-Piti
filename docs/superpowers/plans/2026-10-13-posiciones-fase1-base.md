# Posiciones y sistemas — Fase 1 (Base) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the F7 position catalogue (13 codes, preferida + «también»), the tolerant reader of old data, the 15-system catalogue, the Firestore rules for player proposals and the migration script in place, and make every existing screen read positions through one module — with no visual redesign yet.

**Architecture:** Pure shared logic lives in `functions/src/positions.ts` (the repo's pattern: web imports pure modules from `functions/src`, e.g. `matchClock`, `matchEngine`), re-exported by `src/lib/positions.ts`. The 15 systems live in `src/lib/formations.ts`; the pizarra's `FORM` (geometry) and `FORMATIONS` (stored slots) are derived from it, so the two disagreeing tables disappear. Consumers stop parsing `naturalPosition` themselves and call `resolvePositions(doc)`. `naturalPosition` stays written (compat) — the line of `positions.main`.

**Tech Stack:** React 19, TypeScript, Vite, Zod, Firestore rules (rules v2), Vitest, `@firebase/rules-unit-testing`, firebase-admin (functions), Node 24 (native TS type stripping for the script).

**Spec:** `docs/superpowers/specs/2026-10-13-posiciones-y-sistemas-design.md`

## Global Constraints

- Package manager `pnpm`; do not touch `pnpm-lock.yaml` / `package-lock.json`; no new dependencies.
- No `any` in TypeScript — use `unknown` and narrow.
- Spanish-first copy; codes always paired with a Spanish name somewhere in the view.
- Status never encoded by colour alone; honour `prefers-reduced-motion`.
- Codes: `POR DFC LIB LI LD MCD MC MI MD MCO EI ED DC` (13). Lines: `POR DEF MED DEL`.
- `also`: unique, never contains `main`, max 6.
- System ids ≤ 10 characters (firestore.rules `optStr(d, 'formation', 10)`).
- Never point tests at production Firebase. The migration script defaults to the emulator and dry-run.
- Do not modify unrelated uncommitted files (`.claude/launch.json`, `.impeccable/*`). Use `git add <files>`, never `-A`.
- Generated `pizarra.css` owns short class names (`.cb`, `.sy`…): add no new class names in this phase.
- No browsers / headless WebGL from agents (user's PC limit). Verification = lint, tsc, vitest, rules tests, build.

## Review Focus

1. **Old word data** («Portero», «Lateral derecho», «Mediocentro», «delantero centro», «DEL», «def», blank, `null`, numbers) — every screen must show the right line, and none may say «Sin posición» for a word it can read → Task 1 `parsePosition` tests + Task 5 `asPosition`/`squadNumbers`/`constellation` tests with words.
2. **Corrupt `positions` maps** (unknown code, `main` repeated in `also`, duplicates, >6, `also` not an array, `positions: "MC"`) — the doc still reads; bad parts dropped → Task 2 tests.
3. **Old boards saved with the six original ids** keep their slots, and a board with an unknown formation id still falls back to 2-3-1 → Task 4 tests on `lineupDoc`.
4. **A member editing someone else's ficha or a field other than `positionsProposal`** must be refused; withdrawing a proposal (`null`) must be allowed → Task 6 rules tests.
5. **Migration run twice** must be a no-op the second time and never overwrite an existing `positions` → Task 7 `legacyPlan` tests.

---

## File structure

| File | Responsibility |
|---|---|
| `functions/src/positions.ts` (create) | Catalogue, lines, neighbours, `parsePosition`, `fitGrade`, `resolvePositions`, `sanitizePositions`, `legacyPlan`, labels. Pure, no imports. |
| `src/lib/positions.ts` (create) | `export * from "../../functions/src/positions";` — the web's import path. |
| `src/lib/positions.test.ts` (create) | Catalogue, parsing, grades, resolver, sanitizer, legacy plan. |
| `src/lib/formations.ts` (create) | The 15 systems (`SYSTEMS_CATALOGUE`), `SYSTEM_IDS`, `FormationName`, `systemDef`. |
| `src/lib/formations.test.ts` (create) | Shape of every system (7 slots, POR first, line counts = label). |
| `src/lib/schemas.ts` (modify) | `positions`, `positionsProposal`, `positionsReview` on `playerSchema`; `LINEUP_FORMATIONS` from `SYSTEM_IDS`. |
| `src/pages/pizarra/formations.ts` (modify) | `FormationName`, `FORMATION_NAMES`, `FORMATIONS`, `ZONE_LABEL`, `ZONES` derived from the catalogues. |
| `src/pages/pizarra/v2/geometry.ts` (modify) | `FORM` derived from the catalogue. |
| `src/pages/pizarra/v2/Panels.tsx` (modify) | System tile shows `label` + `name` (ids like `2-1-2-1a` never shown). |
| `src/pages/pizarra/positions.ts` (modify) | `normZone` delegates to `parsePosition`. |
| Consumers (modify) | `lib/club.ts`, `lib/statsView.ts`, `lib/squad.ts`, `pages/acceso/useDoor.ts`, `pages/jugador/JugadorPage.tsx`, `pages/admin/shell/AdminLayout.tsx`, `pages/admin/acta/roster.ts`, `pages/admin/data/useAdminData.ts`, `pages/admin/club/plantillaLogic.ts`, `pages/admin/club/plantillaBoard.ts`, `pages/admin/club/FichaWorkspace.tsx`, `pages/perfil/card.ts`, `pages/perfil/TabCarta.tsx`, `pages/perfil/profileData.ts`, `pages/pizarra/usePizarraPlayers.ts`, `functions/src/shareCard.ts`, `functions/src/social.ts`. |
| `firestore.rules` (modify) | Position shapes; a member may write only their own `positionsProposal`. |
| `test/rules/firestore-rules.test.ts` (modify) | Rules cases. |
| `functions/scripts/migrate-positions.mjs` (create) | Dry-run / `--write` migration (emulator by default). |

---

### Task 1: Position catalogue and parsing

**Files:**
- Create: `functions/src/positions.ts`, `src/lib/positions.ts`, `src/lib/positions.test.ts`

**Interfaces:**
- Produces:
  - `type PosCode = "POR"|"DFC"|"LIB"|"LI"|"LD"|"MCD"|"MC"|"MI"|"MD"|"MCO"|"EI"|"ED"|"DC"`
  - `type Line = "POR"|"DEF"|"MED"|"DEL"`
  - `POS_CODES: readonly PosCode[]`, `POSITIONS: Record<PosCode, PositionDef>` with `PositionDef = { code; name; long; line: Line; side: "izquierda"|"centro"|"derecha"; x: number; y: number; neighbours: readonly PosCode[] }`
  - `LINES: readonly Line[]`, `LINE_NAMES: Record<Line, { name: string; short: string; plural: string }>`
  - `isPosCode(x: unknown): x is PosCode`, `lineOf(code: PosCode): Line`
  - `parsePosition(x: unknown): { code: PosCode | null; line: Line | null }`
  - `positionLabel(code: PosCode, form?: "short"|"name"|"long"): string`

- [ ] **Step 1: Write the failing test** — `src/lib/positions.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { LINE_NAMES, POS_CODES, POSITIONS, isPosCode, lineOf, parsePosition, positionLabel } from "./positions";

describe("catálogo de posiciones de fútbol 7", () => {
  it("has the 13 codes, each in its line", () => {
    expect(POS_CODES).toEqual(["POR", "DFC", "LIB", "LI", "LD", "MCD", "MC", "MI", "MD", "MCO", "EI", "ED", "DC"]);
    expect(POS_CODES.map(lineOf)).toEqual(["POR", "DEF", "DEF", "DEF", "DEF", "MED", "MED", "MED", "MED", "MED", "DEL", "DEL", "DEL"]);
  });
  it("puts left on the left and right on the right (team attacking up)", () => {
    expect(POSITIONS.LI.x).toBeLessThan(50);
    expect(POSITIONS.LD.x).toBeGreaterThan(50);
    expect(POSITIONS.EI.x).toBeLessThan(POSITIONS.ED.x);
    expect(POSITIONS.POR.y).toBeGreaterThan(POSITIONS.DC.y);
  });
  it("neighbours are symmetric and never the position itself", () => {
    for (const c of POS_CODES)
      for (const n of POSITIONS[c].neighbours) {
        expect(n).not.toBe(c);
        expect(POSITIONS[n].neighbours).toContain(c);
      }
  });
  it("labels: code, Spanish name, long capitals", () => {
    expect(positionLabel("MCD")).toBe("MCD");
    expect(positionLabel("MCD", "name")).toBe("Pivote");
    expect(positionLabel("MCD", "long")).toBe("PIVOTE");
    expect(LINE_NAMES.MED).toEqual({ name: "Centrocampista", short: "Medio", plural: "Medios" });
  });
  it("isPosCode only accepts the 13 codes", () => {
    expect(isPosCode("MC")).toBe(true);
    expect(isPosCode("mc")).toBe(false);
    expect(isPosCode("MED")).toBe(false);
    expect(isPosCode(3)).toBe(false);
  });
});

describe("parsePosition: whatever was stored, never a guess", () => {
  const cases: [unknown, string | null, string | null][] = [
    ["MC", "MC", "MED"],
    ["mcd", "MCD", "MED"],
    ["Portero", "POR", "POR"],
    ["portera", "POR", "POR"],
    ["Lateral derecho", "LD", "DEF"],
    ["lateral izquierdo", "LI", "DEF"],
    ["Lateral", null, "DEF"],
    ["Defensa central", "DFC", "DEF"],
    ["Central", "DFC", "DEF"],
    ["Líbero", "LIB", "DEF"],
    ["Pivote", "MCD", "MED"],
    ["Mediocentro", "MC", "MED"],
    ["Medio centro", "MC", "MED"],
    ["Mediapunta", "MCO", "MED"],
    ["Interior derecho", "MD", "MED"],
    ["Extremo izquierdo", "EI", "DEL"],
    ["Extremo", null, "DEL"],
    ["Delantero centro", "DC", "DEL"],
    ["Punta", "DC", "DEL"],
    ["DEL", null, "DEL"],
    ["def", null, "DEF"],
    ["Defensa", null, "DEF"],
    ["Centrocampista", null, "MED"],
    ["Delantero", null, "DEL"],
    ["  MED ", null, "MED"],
    ["", null, null],
    ["Banquillo", null, null],
    [null, null, null],
    [7, null, null],
  ];
  for (const [input, code, line] of cases)
    it(`${JSON.stringify(input)} → ${code ?? "—"} / ${line ?? "—"}`, () => {
      expect(parsePosition(input)).toEqual({ code, line });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/positions.test.ts`
Expected: FAIL — cannot resolve `./positions`.

- [ ] **Step 3: Write the implementation** — `functions/src/positions.ts`

```ts
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
    .trim()
    .replace(/[\s\-_/.,·]+/g, " ");

// Frases completas → posición exacta (se comparan ya sin tildes, en minúsculas y con un espacio).
const EXACT: Record<string, PosCode> = {};
const ex = (c: PosCode, ...ws: string[]) => ws.forEach((w) => (EXACT[w] = c));
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
const LINE_WORDS: Record<string, Line> = {};
const lw = (l: Line, ...ws: string[]) => ws.forEach((w) => (LINE_WORDS[w] = l));
lw("POR", "por", "portero", "portera", "porteros", "guardameta", "arquero", "gk");
lw("DEF", "def", "defensa", "defensas", "defensor", "defensora", "defensores", "defensivo", "lateral", "laterales", "central", "centrales", "carrilero", "libero", "dfc", "ld", "li", "lib");
lw("MED", "med", "medio", "medios", "media", "mediocampista", "centrocampista", "centrocampistas", "mediocentro", "mediapunta", "pivote", "interior", "volante", "mc", "mcd", "mco", "mi", "md");
lw("DEL", "del", "delantero", "delantera", "delanteros", "extremo", "extremos", "punta", "ariete", "dc", "ed", "ei");

/** La posición exacta (si se puede leer sin adivinar) y su línea. */
export function parsePosition(x: unknown): { code: PosCode | null; line: Line | null } {
  if (typeof x !== "string") return { code: null, line: null };
  const s = fold(x);
  if (!s) return { code: null, line: null };
  const code = EXACT[s] ?? null;
  if (code) return { code, line: lineOf(code) };
  const line = LINE_WORDS[s] ?? LINE_WORDS[s.split(" ")[0]] ?? null;
  return { code: null, line };
}
```

Note: `"DEL"`, `"def"` and `"MED"` must stay line-only (they are the old line codes) — `EXACT` has no `"del"`, `"def"`, `"med"` keys. `"dc"` maps to `DC` exactly (it was a line word before; as a full string it is the punta code).

`src/lib/positions.ts`:

```ts
// The web's door to the F7 positions (the pure module is shared with the functions).
export * from "../../functions/src/positions";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/positions.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add functions/src/positions.ts src/lib/positions.ts src/lib/positions.test.ts
git commit -m "feat(positions): the F7 position catalogue and a tolerant reader"
```

---

### Task 2: A player's positions — resolver, sanitizer, fit grade, schema

**Files:**
- Modify: `functions/src/positions.ts` (append), `src/lib/schemas.ts:120-142`
- Test: `src/lib/positions.test.ts` (append), `src/lib/schemas.test.ts` (append)

**Interfaces:**
- Consumes: Task 1 exports.
- Produces:
  - `interface PositionSet { main: PosCode | null; also: PosCode[] }`
  - `interface ResolvedPositions extends PositionSet { line: Line | null }`
  - `sanitizePositions(x: unknown): PositionSet | null` — `null` when `x` is not an object.
  - `resolvePositions(doc: { positions?: unknown; naturalPosition?: unknown }): ResolvedPositions`
  - `type FitGrade = 0 | 1 | 2 | 3`; `fitGrade(p: PositionSet & { line?: Line | null }, slot: PosCode): FitGrade | null` (`null` = no data)
  - `MAX_ALSO = 6`
  - `playerSchema` gains `positions`, `positionsProposal`, `positionsReview` (types `PositionSet`-like, permissive).

- [ ] **Step 1: Write the failing tests** — append to `src/lib/positions.test.ts`

```ts
import { fitGrade, resolvePositions, sanitizePositions } from "./positions";

describe("sanitizePositions: a broken map still reads", () => {
  it("keeps valid codes, drops the rest, dedupes, removes main from also, caps at 6", () => {
    expect(sanitizePositions({ main: "MC", also: ["MCD", "MC", "MCD", "XX", 3, "MI", "LD", "LI", "EI", "ED", "DC"] })).toEqual({ main: "MC", also: ["MCD", "MI", "LD", "LI", "EI", "ED"] });
  });
  it("unknown main → null; also not an array → []", () => {
    expect(sanitizePositions({ main: "MED", also: "MC" })).toEqual({ main: null, also: [] });
  });
  it("not an object → null", () => {
    expect(sanitizePositions("MC")).toBeNull();
    expect(sanitizePositions(null)).toBeNull();
  });
});

describe("resolvePositions: new field first, old text as fallback", () => {
  it("uses positions when present (line from main)", () => {
    expect(resolvePositions({ positions: { main: "LD", also: ["MD"] }, naturalPosition: "DEL" })).toEqual({ main: "LD", also: ["MD"], line: "DEF" });
  });
  it("positions without main keeps the old line", () => {
    expect(resolvePositions({ positions: { main: null, also: ["MC"] }, naturalPosition: "Defensa" })).toEqual({ main: null, also: ["MC"], line: "DEF" });
  });
  it("falls back to the old words", () => {
    expect(resolvePositions({ naturalPosition: "Lateral derecho" })).toEqual({ main: "LD", also: [], line: "DEF" });
    expect(resolvePositions({ naturalPosition: "DEL" })).toEqual({ main: null, also: [], line: "DEL" });
    expect(resolvePositions({})).toEqual({ main: null, also: [], line: null });
  });
});

describe("fitGrade", () => {
  const p = { main: "MC" as const, also: ["MCD" as const] };
  it("3 preferida, 2 también, 1 adaptado (same line or neighbour), 0 fuera", () => {
    expect(fitGrade(p, "MC")).toBe(3);
    expect(fitGrade(p, "MCD")).toBe(2);
    expect(fitGrade(p, "MI")).toBe(1); // same line
    expect(fitGrade(p, "DFC")).toBe(1); // neighbour of MCD
    expect(fitGrade(p, "DC")).toBe(0);
  });
  it("goal: only declared counts", () => {
    expect(fitGrade(p, "POR")).toBe(0);
    expect(fitGrade({ main: "POR", also: [] }, "DFC")).toBe(0);
    expect(fitGrade({ main: "DFC", also: ["POR"] }, "POR")).toBe(2);
  });
  it("only a line known: 1 in that line, 0 elsewhere; nothing known: null", () => {
    expect(fitGrade({ main: null, also: [], line: "DEF" }, "LD")).toBe(1);
    expect(fitGrade({ main: null, also: [], line: "DEF" }, "MC")).toBe(0);
    expect(fitGrade({ main: null, also: [], line: null }, "MC")).toBeNull();
  });
});
```

Append to `src/lib/schemas.test.ts` (inside its file, reuse its `playerSchema` import or add `import { playerSchema } from "./schemas";`):

```ts
describe("playerSchema: positions are permissive", () => {
  it("reads a good set, and a broken one never drops the player", () => {
    expect(playerSchema.parse({ id: "a", positions: { main: "MC", also: ["MCD"] } }).positions).toEqual({ main: "MC", also: ["MCD"] });
    const broken = playerSchema.parse({ id: "b", positions: "MC", positionsProposal: 4, positionsReview: { status: "x" } });
    expect(broken.id).toBe("b");
    expect(broken.positions).toBeUndefined();
    expect(broken.positionsProposal).toBeUndefined();
    expect(broken.positionsReview).toBeUndefined();
  });
  it("a proposal can be null (withdrawn)", () => {
    expect(playerSchema.parse({ id: "c", positionsProposal: null }).positionsProposal).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/positions.test.ts src/lib/schemas.test.ts`
Expected: FAIL — `sanitizePositions` / `resolvePositions` / `fitGrade` not exported; schema fields undefined.

- [ ] **Step 3: Implement** — append to `functions/src/positions.ts`

```ts
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
```

In `src/lib/schemas.ts`, above `playerSchema`, add:

```ts
/** `players/{id}.positions` / `.positionsProposal`: permisivos (códigos raros se limpian al leer con
 *  `resolvePositions`; un valor que no es un mapa se queda en ausente — nunca tira el jugador). */
const positionSetSchema = z.object({
  main: z.string().nullable().catch(null),
  also: z.array(z.string()).catch([]),
});
const positionsReviewSchema = z.object({
  status: z.enum(["aprobada", "ajustada", "rechazada"]),
  at: z.unknown(),
  by: z.string().optional().catch(undefined),
});
```

and inside `playerSchema` after `naturalPosition`:

```ts
  positions: positionSetSchema.optional().catch(undefined),
  positionsProposal: positionSetSchema.extend({ at: z.unknown() }).nullable().optional().catch(undefined),
  positionsReview: positionsReviewSchema.nullable().optional().catch(undefined),
```

Also update the doc comment above `playerSchema` (the `naturalPosition` paragraph) to: «`naturalPosition` es texto libre heredado (códigos o palabras); la fuente de verdad es `positions` y se lee siempre con `resolvePositions`».

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/positions.test.ts src/lib/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/positions.ts src/lib/positions.test.ts src/lib/schemas.ts src/lib/schemas.test.ts
git commit -m "feat(positions): a player's positions — resolver, sanitizer, fit grade and schema"
```

---

### Task 3: `normZone` delegates; the pizarra and perfil read through the resolver

**Files:**
- Modify: `src/pages/pizarra/positions.ts`, `src/pages/pizarra/usePizarraPlayers.ts:115-120`, `src/pages/perfil/profileData.ts:57`
- Test: `src/pages/pizarra/positions.test.ts` (must keep passing), `src/pages/perfil/profileData.test.ts`

**Interfaces:**
- Consumes: `parsePosition`, `resolvePositions`.
- Produces: unchanged signatures (`normZone(x: unknown): Zone | undefined`). Pizarra players now carry the line of `positions.main` when it exists.

- [ ] **Step 1: Write the failing test** — append to `src/pages/pizarra/positions.test.ts`

```ts
it("reads the exact F7 words through the shared catalogue", () => {
  expect(normZone("Pivote")).toBe("MED");
  expect(normZone("Líbero")).toBe("DEF");
  expect(normZone("Extremo derecho")).toBe("DEL");
});
```

And append to `src/pages/perfil/profileData.test.ts` (it already imports `seasonPlayers`, `PlayerDoc`, `SEASONS`):

```ts
describe("la línea de cada uno, leída de sus posiciones", () => {
  it("positions manda sobre el texto antiguo, y las palabras se leen", () => {
    const ps: PlayerDoc[] = [
      { id: "lat", seasons: ["t1"], positions: { main: "LD", also: [] }, naturalPosition: "DEL" },
      { id: "por", seasons: ["t1"], naturalPosition: "Portero" },
    ];
    const byId = new Map(seasonPlayers(ps, "t1", SEASONS, null).map((p) => [p.id, p.naturalPosition]));
    expect(byId.get("lat")).toBe("DEF");
    expect(byId.get("por")).toBe("POR");
  });
});
```

- [ ] **Step 2: Run to see the profile case fail**

Run: `pnpm vitest run src/pages/pizarra/positions.test.ts src/pages/perfil/profileData.test.ts`
Expected: the `normZone` cases may already pass (fine); the profileData case FAILS (`"DEL"`).

- [ ] **Step 3: Implement**

`src/pages/pizarra/positions.ts` — replace the whole body with:

```ts
// The board only speaks POR / DEF / MED / DEL: this reads any stored position (codes or Spanish words, any
// case, with or without accents) through the shared F7 catalogue; anything else is «no position». Pure.
import { parsePosition } from "../../lib/positions";
import type { Zone } from "./formations";

/** POR / DEF / MED / DEL from whatever was stored; undefined when it isn't a known position. */
export function normZone(x: unknown): Zone | undefined {
  return parsePosition(x).line ?? undefined;
}
```

`src/pages/pizarra/usePizarraPlayers.ts` — replace the `naturalPosition: normZone(p.naturalPosition),` line with:

```ts
          // The line of the approved positions (or of the old text): always POR/DEF/MED/DEL here.
          naturalPosition: resolvePositions(p).line ?? undefined,
```

and add `import { resolvePositions } from "../../lib/positions";` (drop the `normZone` import if it becomes unused).

`src/pages/perfil/profileData.ts:57` — replace `naturalPosition: p.naturalPosition,` with `naturalPosition: resolvePositions(p).line ?? undefined,` and import `resolvePositions` from `../../lib/positions`.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/pages/pizarra src/pages/perfil`
Expected: PASS (all existing pizarra/perfil tests too).

- [ ] **Step 5: Commit**

```bash
git add src/pages/pizarra/positions.ts src/pages/pizarra/positions.test.ts src/pages/pizarra/usePizarraPlayers.ts src/pages/perfil/profileData.ts src/pages/perfil/profileData.test.ts
git commit -m "refactor(pizarra): read positions through the shared F7 catalogue"
```

---

### Task 4: The 15 systems, one table

**Files:**
- Create: `src/lib/formations.ts`, `src/lib/formations.test.ts`
- Modify: `src/lib/schemas.ts:183` (`LINEUP_FORMATIONS`), `src/pages/pizarra/formations.ts:17-21,113-171,201-210`, `src/pages/pizarra/v2/geometry.ts:88-100`, `src/pages/pizarra/v2/Panels.tsx:508-519` (+ `sysLines` / `MiniSystem` if they assume six)
- Test: `src/pages/pizarra/v2/fit.test.ts`, `geometry.test.ts`, `rival.test.ts` (if present), `src/pages/pizarra/lineupDoc.test.ts`

**Interfaces:**
- Consumes: `PosCode`, `lineOf`, `Line`.
- Produces:
  - `SYSTEM_IDS` (readonly tuple of the 15 ids, `as const`), `type FormationName = (typeof SYSTEM_IDS)[number]`
  - `type SystemCharacter = "equilibrado" | "defensivo" | "ofensivo"`
  - `interface SystemDef { id: FormationName; label: string; name: string; character: SystemCharacter; spots: readonly (readonly [PosCode, number, number])[]; about: string; strengths: string; weaknesses: string; needs: string }`
  - `SYSTEMS_CATALOGUE: readonly SystemDef[]` (order = the spec's table), `systemDef(id: FormationName): SystemDef`
  - `src/pages/pizarra/formations.ts` keeps exporting `FormationName`, `FORMATION_NAMES`, `FORMATIONS`, `Zone`, `ZONE_LABEL`, `ZONES` (now derived).

- [ ] **Step 1: Write the failing test** — `src/lib/formations.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { lineOf } from "./positions";
import { SYSTEMS_CATALOGUE, SYSTEM_IDS, systemDef } from "./formations";

describe("los 15 sistemas de fútbol 7", () => {
  it("are the spec's, in order, with ids that fit the rules (≤ 10)", () => {
    expect(SYSTEM_IDS).toEqual(["2-3-1", "2-1-2-1", "2-2-2", "2-2-1-1", "3-2-1", "3-1-2", "3-1-1-1", "4-1-1", "3-3", "2-1-3", "1-3-2", "1-2-3", "1-2-2-1", "1-1-2-1-1", "2-1-2-1a"]);
    for (const id of SYSTEM_IDS) expect(id.length).toBeLessThanOrEqual(10);
  });
  for (const s of SYSTEMS_CATALOGUE)
    it(`${s.id} ${s.name}: 7 slots, keeper first at 95, lines match its label`, () => {
      expect(s.spots).toHaveLength(7);
      expect(s.spots[0]).toEqual(["POR", 50, 95]);
      const counts = (["DEF", "MED", "DEL"] as const).map((l) => s.spots.filter(([c]) => lineOf(c) === l).length);
      const label = s.label.split("-").map(Number);
      // The label counts lines back to front; mids may be split across several numbers (2-1-2-1 = 2 DEF, 3 MED, 1 DEL).
      expect(counts[0]).toBe(label[0]);
      expect(label.reduce((a, b) => a + b, 0)).toBe(6);
      expect(counts[0] + counts[1] + counts[2]).toBe(6);
      for (const [, u, v] of s.spots) {
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThanOrEqual(100);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      expect(s.about && s.strengths && s.weaknesses && s.needs).toBeTruthy();
    });
  it("left is left: every LI/MI/EI stands left of its LD/MD/ED", () => {
    for (const s of SYSTEMS_CATALOGUE) {
      const u = (c: string) => s.spots.find(([x]) => x === c)?.[1];
      for (const [l, r] of [["LI", "LD"], ["MI", "MD"], ["EI", "ED"]] as const) if (u(l) !== undefined && u(r) !== undefined) expect(u(l)!).toBeLessThan(u(r)!);
    }
  });
  it("systemDef finds each id", () => {
    expect(systemDef("2-1-2-1a").name).toBe("Clásico con alas");
  });
});
```

Note on `counts[0] === label[0]`: for `1-3-2` / `1-2-3` / `1-2-2-1` / `1-1-2-1-1` the first number is the LIB alone (1 DEF) — consistent.

Append to `src/pages/pizarra/lineupDoc.test.ts` (reuse its existing doc-builder helper; read the file first):

```ts
describe("lineup document: the 15 systems", () => {
  it("a board saved with a new system keeps it; an unknown id still falls back to 2-3-1", () => {
    const data = json(lineupToData(seedLineup("2-3-1", ["a"]), meta));
    expect(extractLineup(dataToLineupDoc("x", { ...data, formation: "4-1-1" })).formation).toBe("4-1-1");
    expect(extractLineup(dataToLineupDoc("y", { ...data, formation: "9-9-9" })).formation).toBe("2-3-1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/formations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/formations.ts`**

```ts
// Los 15 sistemas de fútbol 7 (sin contar al portero): casillas [posición, u, v] — u 0→100 izquierda→derecha,
// v 0 = portería rival … 100 = la nuestra —, carácter y su ficha. La pizarra deriva de aquí lo que dibuja
// (geometry FORM) y lo que guarda (formations FORMATIONS). Ids ≤ 10 caracteres (firestore.rules).
import type { PosCode } from "./positions";

export const SYSTEM_IDS = ["2-3-1", "2-1-2-1", "2-2-2", "2-2-1-1", "3-2-1", "3-1-2", "3-1-1-1", "4-1-1", "3-3", "2-1-3", "1-3-2", "1-2-3", "1-2-2-1", "1-1-2-1-1", "2-1-2-1a"] as const;
export type FormationName = (typeof SYSTEM_IDS)[number];
export type SystemCharacter = "equilibrado" | "defensivo" | "ofensivo";
export type Spot = readonly [PosCode, number, number];
export interface SystemDef {
  id: FormationName;
  label: string;
  name: string;
  character: SystemCharacter;
  spots: readonly Spot[];
  about: string;
  strengths: string;
  weaknesses: string;
  needs: string;
}

const GK: Spot = ["POR", 50, 95];
const sys = (id: FormationName, label: string, name: string, character: SystemCharacter, spots: Spot[], about: string, strengths: string, weaknesses: string, needs: string): SystemDef => ({
  id, label, name, character, spots: [GK, ...spots], about, strengths, weaknesses, needs,
});

export const SYSTEMS_CATALOGUE: readonly SystemDef[] = [
  sys("2-3-1", "2-3-1", "Clásico", "equilibrado",
    [["DFC", 30, 74], ["DFC", 70, 74], ["MI", 17, 49], ["MC", 50, 50], ["MD", 83, 49], ["DC", 50, 22]],
    "El más usado en fútbol 7: dos centrales, tres medios y un punta.", "Triángulos de pase en todo el campo y el medio bien poblado.", "Si nos ganan el medio, los dos centrales quedan expuestos.", "Interiores con recorrido y un punta que aguante de espaldas."),
  sys("2-1-2-1", "2-1-2-1", "Rombo", "equilibrado",
    [["DFC", 24, 74], ["DFC", 76, 74], ["MCD", 50, 59], ["MI", 20, 41], ["MD", 80, 41], ["DC", 50, 20]],
    "Un pivote por delante de la defensa e interiores que llegan.", "Protege a los centrales y da salida limpia.", "Las bandas se quedan solas si los interiores no bajan.", "Un pivote que ordene e interiores que lleguen al área."),
  sys("2-2-2", "2-2-2", "Parejas", "equilibrado",
    [["DFC", 30, 74], ["DFC", 70, 74], ["MC", 27, 48], ["MC", 73, 48], ["DC", 27, 22], ["DC", 73, 22]],
    "Dos jugadores en cada línea: simétrico y fácil de entender.", "Dos puntas que fijan a la defensa rival.", "Poco control del medio con solo dos.", "Medios todoterreno y dos puntas que se entiendan."),
  sys("2-2-1-1", "2-2-1-1", "Mediapunta", "equilibrado",
    [["DFC", 30, 74], ["DFC", 70, 74], ["MCD", 32, 56], ["MC", 68, 52], ["MCO", 50, 36], ["DC", 50, 17]],
    "Un enganche entre líneas por detrás del punta.", "El mediapunta recibe entre líneas y filtra pases.", "Si el mediapunta no defiende, el medio sufre.", "Un mediapunta creativo y un pivote que cubra."),
  sys("3-2-1", "3-2-1", "Línea de 3", "defensivo",
    [["LI", 18, 72], ["DFC", 50, 74], ["LD", 82, 72], ["MC", 25, 46], ["MC", 75, 46], ["DC", 50, 22]],
    "Tres atrás sólidos y carrileros que suben por banda.", "Mucha seguridad atrás y amplitud por fuera.", "El punta puede quedarse muy solo.", "Laterales con piernas para subir y bajar."),
  sys("3-1-2", "3-1-2", "Contra", "defensivo",
    [["LI", 18, 72], ["DFC", 50, 74], ["LD", 82, 72], ["MCD", 50, 48], ["DC", 22, 22], ["DC", 78, 22]],
    "Robar atrás y salir rápido con dos arriba.", "Defensa de tres y contraataques con dos puntas.", "Un solo medio: el rival puede dominar la pelota.", "Un pivote incansable y puntas rápidos."),
  sys("3-1-1-1", "3-1-1-1", "Escalonado", "defensivo",
    [["LI", 18, 72], ["DFC", 50, 74], ["LD", 82, 72], ["MCD", 38, 56], ["MCO", 62, 38], ["DC", 50, 18]],
    "Defensa de tres con un eje vertical: pivote, mediapunta y punta.", "Ocupa el carril central de arriba abajo.", "Las bandas del medio quedan vacías.", "Laterales que cierren y un eje con buen pase."),
  sys("4-1-1", "4-1-1", "Cerrojo", "defensivo",
    [["LI", 14, 68], ["DFC", 36, 76], ["DFC", 64, 76], ["LD", 86, 68], ["MCD", 50, 52], ["DC", 50, 22]],
    "Cuatro atrás para defender un resultado.", "Muy difícil de superar por fuera y por dentro.", "Casi no hay llegada: el punta vive aislado.", "Defensas disciplinados y un punta que aguante el balón."),
  sys("3-3", "3-3", "Falso nueve", "defensivo",
    [["LI", 18, 72], ["DFC", 50, 74], ["LD", 82, 72], ["MI", 17, 46], ["MC", 50, 40], ["MD", 83, 46]],
    "Sin punta fijo: el medio llega desde atrás.", "Superioridad en el medio y llegadas por sorpresa.", "Sin referencia arriba cuesta finalizar.", "Medios con gol y mucho movimiento."),
  sys("2-1-3", "2-1-3", "Tridente", "ofensivo",
    [["DFC", 30, 74], ["DFC", 70, 74], ["MCD", 50, 50], ["EI", 17, 30], ["DC", 50, 22], ["ED", 83, 30]],
    "Tres arriba con los extremos abiertos.", "Mucha presión arriba y amplitud en ataque.", "El pivote se queda solo ante las transiciones.", "Extremos rápidos y un pivote que lo tape todo."),
  sys("1-3-2", "1-3-2", "Líbero", "ofensivo",
    [["LIB", 50, 74], ["MI", 17, 50], ["MC", 50, 48], ["MD", 83, 50], ["DC", 22, 22], ["DC", 78, 22]],
    "Un último hombre, el medio poblado y dos puntas.", "Mucha gente por delante del balón.", "Un solo defensa: cada pérdida es peligrosa.", "Un líbero rápido y con lectura."),
  sys("1-2-3", "1-2-3", "Todo arriba", "ofensivo",
    [["LIB", 50, 74], ["MC", 30, 50], ["MC", 70, 50], ["EI", 17, 28], ["DC", 50, 20], ["ED", 83, 28]],
    "Para remontar: tres arriba y dos medios.", "Máxima presión y muchos jugadores en el área.", "Muy expuesto a la contra.", "Medios que corran por dos y un líbero valiente."),
  sys("1-2-2-1", "1-2-2-1", "Alas", "ofensivo",
    [["LIB", 50, 74], ["MC", 30, 54], ["MC", 70, 54], ["EI", 17, 34], ["ED", 83, 34], ["DC", 50, 20]],
    "Extremos por fuera y un nueve en el área.", "Amplitud y centros para el punta.", "Las bandas defensivas quedan a la espalda de los extremos.", "Extremos que también bajen y un punta rematador."),
  sys("1-1-2-1-1", "1-1-2-1-1", "Rombo alto", "ofensivo",
    [["LIB", 50, 76], ["MCD", 50, 58], ["MI", 18, 44], ["MD", 82, 44], ["MCO", 50, 36], ["DC", 50, 18]],
    "Un rombo completo en el medio con un último hombre.", "Dominio del medio y muchas líneas de pase.", "Un solo defensa ante balones largos.", "Un pivote que cubra al líbero y un mediapunta con visión."),
  sys("2-1-2-1a", "2-1-2-1", "Clásico con alas", "ofensivo",
    [["DFC", 30, 74], ["DFC", 70, 74], ["MCD", 50, 56], ["EI", 17, 34], ["ED", 83, 34], ["DC", 50, 18]],
    "Variante del clásico con extremos en lugar de interiores.", "Amplitud arriba sin perder a los dos centrales.", "El pivote cubre mucho campo él solo.", "Extremos con ida y vuelta y un pivote fuerte."),
];

const BY_ID = new Map(SYSTEMS_CATALOGUE.map((s) => [s.id, s]));
export const systemDef = (id: FormationName): SystemDef => BY_ID.get(id) ?? SYSTEMS_CATALOGUE[0];
export const isFormationName = (v: unknown): v is FormationName => typeof v === "string" && BY_ID.has(v as FormationName);
```

(Prettier/oxlint will reflow the `sys(...)` calls; keep the data.)

`src/lib/schemas.ts:183` — replace the literal with:

```ts
export const LINEUP_FORMATIONS = SYSTEM_IDS;
```

and add `import { SYSTEM_IDS } from "./formations";` at the top. (`z.enum(LINEUP_FORMATIONS)` in `tacticaSchemas.ts` and `rival.ts` keeps working with the readonly tuple.)

`src/pages/pizarra/formations.ts`:
- Replace `export type FormationName = …` and `FORMATION_NAMES` with:
```ts
import { SYSTEMS_CATALOGUE, SYSTEM_IDS, type FormationName } from "../../lib/formations";
import { LINE_NAMES, LINES, lineOf, type Line } from "../../lib/positions";
export type { FormationName };
export const FORMATION_NAMES: FormationName[] = [...SYSTEM_IDS];
/** Vertical zone of a slot/player (= the position's line). */
export type Zone = Line;
```
  (delete the old `export type Zone = …` line).
- Replace the whole `FORMATIONS` literal (lines 113-171, including the «Position labels» comment) with:
```ts
// Each system's stored slots (label = the F7 position code, zone = its line), straight from the catalogue.
export const FORMATIONS = Object.fromEntries(
  SYSTEMS_CATALOGUE.map((s) => [s.id, s.spots.map(([code, x, y]) => ({ position: code, zone: lineOf(code), x, y }))]),
) as Record<FormationName, SlotDef[]>;
```
- Replace `ZONE_LABEL` / `ZONES` with:
```ts
/** Spanish label for a zone (used in position selectors / chips). */
export const ZONE_LABEL: Record<Zone, string> = { POR: LINE_NAMES.POR.name, DEF: LINE_NAMES.DEF.name, MED: "Medio", DEL: LINE_NAMES.DEL.name };
export const ZONES: Zone[] = [...LINES];
```
  (`ZONE_LABEL` keeps «Medio» — it is what the pizarra chips print today.)

`src/pages/pizarra/v2/geometry.ts` — replace the `FORM` literal with:

```ts
export const FORM = Object.fromEntries(
  SYSTEMS_CATALOGUE.map((s) => [s.id, s.spots.map(([code, u, v]) => [code, lineOf(code), u, v] as const)]),
) as Record<FormationName, readonly SlotSpot[]>;
```
with `import { SYSTEMS_CATALOGUE } from "../../../lib/formations"; import { lineOf } from "../../../lib/positions";`. Keep the comment block above it, adding «(datos en src/lib/formations.ts)». `SYSTEMS = Object.keys(FORM)` now lists 15 in catalogue order.

Behaviour changes this causes (intended, per spec): 3-1-2 and 2-1-3 label their middle slot `MCD` (was `MC`); `FORMATIONS` now has the correct sides (LI left) and the same coordinates the board draws.

`src/pages/pizarra/v2/Panels.tsx` (`SystemTab`) — the tile shows the label and the name, never the id:

```tsx
        {SYSTEMS.map((k) => {
          const s = systemDef(k);
          return (
            <button key={k} type="button" className="sy" onClick={() => p.onSystem(k)} aria-pressed={!p.free && p.formation === k} aria-label={`Sistema ${s.label} ${s.name}`} disabled={p.ro}>
              <MiniSystem name={k} />
              <b>{s.label}</b>
              <small>{s.name}</small>
            </button>
          );
        })}
```
(import `systemDef` from `../../../lib/formations`; if `sysLines` becomes unused, delete it.) Update the doc comment «the six systems» → «the systems». In `TacticaPanel.tsx:75-79` show `{systemDef(f).label} · {systemDef(f).name}` as the `<option>` text. Search the rest of `src/pages/pizarra` for any other place that prints a `FormationName` to the user (`grep -rn "formation}" src/pages/pizarra --include=*.tsx`) and print `systemDef(id).label` there instead.

- [ ] **Step 4: Run the pizarra geometry suites and tune spots if needed**

Run: `pnpm vitest run src/lib/formations.test.ts src/pages/pizarra`
Expected: PASS. If `fit.test.ts` reports overlaps (`hits` like `"4-1-1 DFC/LI @16"`), adjust **only that new system's** offending spots in `src/lib/formations.ts` (move apart by up to 6 in u, or stagger v by up to 6; keep left < right and the keeper at `[50, 95]`) and rerun until green. Existing six systems' coordinates must not change. If `rival.test.ts` / `geometry.test.ts` pin old `FORMATIONS` coordinates or the old `MC` labels of 3-1-2 / 2-1-3, update those expectations to the catalogue's values (the visible board already used them). `SYSTEMS` is now in catalogue order, so `boardLogic.test.ts:85-86` changes to `expect(stepSystem(L, 1).formation).toBe("2-1-2-1")` and `expect(stepSystem(L, -1).formation).toBe("2-1-2-1a")`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/formations.ts src/lib/formations.test.ts src/lib/schemas.ts src/pages/pizarra/formations.ts src/pages/pizarra/v2/geometry.ts src/pages/pizarra/v2/Panels.tsx src/pages/pizarra/v2/TacticaPanel.tsx src/pages/pizarra/lineupDoc.test.ts src/pages/pizarra/v2/boardLogic.test.ts
git commit -m "feat(pizarra): 15 F7 systems from one catalogue (labels, sides and slots agree)"
```
(Add any other test file you had to update.)

---

### Task 5: Every screen reads positions through the resolver

**Files:**
- Modify: `src/lib/club.ts:28-42`, `src/lib/statsView.ts:100,115`, `src/lib/squad.ts:92`, `src/pages/acceso/useDoor.ts:45`, `src/pages/jugador/JugadorPage.tsx:31,142`, `src/pages/admin/shell/AdminLayout.tsx:176-185`, `src/pages/admin/acta/roster.ts:14,25-33`, `src/pages/admin/data/useAdminData.ts:151`, `src/pages/admin/club/plantillaLogic.ts:10-15,81,150`, `src/pages/admin/club/plantillaBoard.ts:23`, `src/pages/admin/club/FichaWorkspace.tsx:185`, `src/pages/perfil/card.ts:23`, `src/pages/perfil/TabCarta.tsx:13`, `functions/src/shareCard.ts:6,20`, `functions/src/social.ts:63,70`
- Test: `src/lib/club.test.ts`, `src/lib/statsView.test.ts`, `src/pages/admin/club/plantillaLogic.test.ts`, `src/pages/admin/club/plantillaBoard.test.ts`, `src/lib/shareCard.test.ts`, `src/lib/squad.test.ts`

**Interfaces:**
- Consumes: `resolvePositions`, `LINE_NAMES`, `POSITIONS`, `positionLabel`, `isLine`.
- Produces: `positionText(doc): string | undefined` in `functions/src/positions.ts` — the Spanish name of `main` («Lateral derecho»), else the line name («Defensa»), else `undefined`. `RosterPlayer.position` keeps meaning «line code» (`"POR"|"DEF"|"MED"|"DEL"|""`).

Rule for this task: **the line semantics everywhere stay the same** (admin still edits a line in this phase); what changes is that words and the new field are read correctly, and where a screen prints a *name*, it prints the exact position name when one exists.

- [ ] **Step 1: Write the failing tests** (append to each file, reusing its imports)

`src/lib/positions.test.ts`:
```ts
import { positionText } from "./positions";
it("positionText: exact name, else line, else nothing", () => {
  expect(positionText({ positions: { main: "MCD", also: [] } })).toBe("Pivote");
  expect(positionText({ naturalPosition: "Defensa" })).toBe("Defensa");
  expect(positionText({ naturalPosition: "Banquillo" })).toBeUndefined();
});
```

`src/lib/club.test.ts`:
```ts
it("counts words and the new field by line", () => {
  const n = squadNumbers([{ id: "a", naturalPosition: "Portero" }, { id: "b", positions: { main: "LD", also: [] } }, { id: "c", naturalPosition: "Mediocentro" }, { id: "d" }], new Date("2026-10-13"));
  expect(n.byZone).toMatchObject({ POR: 1, DEF: 1, MED: 1, DEL: 0 });
});
```
(adapt the `other` field name to what `squadNumbers` returns — read the function; assert the unknown one is counted apart.)

`src/lib/statsView.test.ts`: a `constellation` case where a row has `naturalPosition: "Delantero centro"` and assert its node `y` is the DEL row (18 or 24), not MED (46/52).

`src/pages/admin/club/plantillaLogic.test.ts`: a row built from a player with `naturalPosition: "Portero"` has `position === "POR"`; one with `positions: { main: "MI", also: [] }` has `position === "MED"`.

`src/pages/admin/club/plantillaBoard.test.ts`: `gapsOf` for a player with `naturalPosition: "Defensa"` does **not** flag the position gap.

`src/lib/shareCard.test.ts`:
```ts
it("prints the exact position name when the ficha has one", () => {
  const svg = playerCardSvg({ name: "Erik", number: 4, position: "LATERAL DERECHO" }, "AAAA");
  expect(svg).toContain("LATERAL DERECHO");
});
```

- [ ] **Step 2: Run to verify failures**

Run: `pnpm vitest run src/lib src/pages/admin/club`
Expected: the new cases FAIL (words read as «Sin posición», `positionText` missing).

- [ ] **Step 3: Implement**

Append to `functions/src/positions.ts`:
```ts
/** Lo que se lee de un jugador en una línea de texto: «Pivote», o «Defensa» si solo se sabe la línea. */
export function positionText(doc: { positions?: unknown; naturalPosition?: unknown }): string | undefined {
  const r = resolvePositions(doc);
  return r.main ? POSITIONS[r.main].name : r.line ? LINE_NAMES[r.line].name : undefined;
}
```

Then, file by file:

- `src/lib/club.ts`: delete `const ZONES = …`; import `{ LINES, resolvePositions, type Line }` from `./positions`; `SquadNumbersInput` gains `positions?: unknown`; in the loop: `const z = resolvePositions(p).line; if (z) byZone[z]++; else other++;` with `byZone` typed `Record<Line, number>` built from `LINES`.
- `src/lib/statsView.ts:115`: `const zone = (p: PlayerAnalysis) => resolvePositions(p).line ?? "MED";` (keep `ZONE_Y`; import `resolvePositions` from `./positions`).
- `src/lib/squad.ts:92`: `position: positionText(p),` (import from `./positions`; make sure the input type of that builder allows `positions?: unknown`).
- `src/pages/acceso/useDoor.ts:45`: `position: positionText(p),` (door prints the first 3 letters — still fine).
- `src/pages/jugador/JugadorPage.tsx`: delete `const POS = …`; line 142 becomes `const position = positionText(p) ?? "Jugador";` (the next line already upper-cases it).
- `src/pages/admin/shell/AdminLayout.tsx:176-185`: delete the local `POS`; `keywords: [positionText(p.doc), p.position, p.doc.firstName, p.doc.lastName].filter(Boolean).join(" ")` and `description: positionText(p.doc) ?? "Jugador"`.
- `src/pages/admin/acta/roster.ts`: line 14 `position: resolvePositions(p).line ?? ""`; replace the local `POSITION` table: `positionName = (p: string) => (isLine(p) ? LINE_NAMES[p].short : parsePosition(p).line ? LINE_NAMES[parsePosition(p).line!].short : "Jugador")` — write it without the non-null assertion:
  ```ts
  export const positionName = (p: string) => {
    const line = isLine(p) ? p : parsePosition(p).line;
    return line ? LINE_NAMES[line].short : "Jugador";
  };
  ```
  `positionCode` stays as is (it derives from `positionName`; «Medio» → «MED»).
- `src/pages/admin/data/useAdminData.ts:151`: `position: resolvePositions(p).line ?? ""`.
- `src/pages/admin/club/plantillaLogic.ts`: keep `POSITIONS`/`Position`/`POS_LABEL` exported (the line picker still uses them this phase) but define `POS_LABEL` from `LINE_NAMES` (`{ POR: LINE_NAMES.POR.short, DEF: LINE_NAMES.DEF.short, MED: LINE_NAMES.MED.short, DEL: LINE_NAMES.DEL.short }`); change `asPosition` to read any stored value:
  ```ts
  export const asPosition = (v: unknown): Position | "" => (isLine(v) ? v : parsePosition(v).line) ?? "";
  ```
  and at lines 81 and 150 use `asPosition(resolvePositions(p).line)`.
- `src/pages/admin/club/plantillaBoard.ts:23`: `pos: resolvePositions(p).line !== null,`.
- `src/pages/admin/club/FichaWorkspace.tsx:185`: `const livePos = asPosition(resolvePositions(player).line);`.
- `src/pages/perfil/card.ts:23`: `export const POSITION_LONG: Record<Zone, string> = { POR: LINE_NAMES.POR.name, DEF: LINE_NAMES.DEF.name, MED: LINE_NAMES.MED.name, DEL: LINE_NAMES.DEL.name };` (same strings, one source).
- `src/pages/perfil/TabCarta.tsx:13`: build `ZONE` from `LINE_NAMES` (`Object.fromEntries(LINES.map((l) => [LINE_NAMES[l].name, l]))`).
- `functions/src/shareCard.ts`: delete the local `POSITIONS`; `const pos = escapeXml(String(p.position || "UNO DE LOS NUESTROS").toUpperCase().slice(0, 24));` — the caller now passes the resolved text. Keep the existing test («DEL» → «DELANTERO») passing by having `social.ts` resolve first; update that existing test input to `position: "Delantero"` if it calls `playerCardSvg` directly with a code (it does: change `"DEL"` → `"Delantero"`).
- `functions/src/social.ts:63,70`: `const posText = positionText(data) ?? "Uno de los nuestros";` used as the subtitle and as `position: posText` (import `{ positionText } from "./positions.js"` — NodeNext needs `.js`).

- [ ] **Step 4: Run all tests, types and the functions build**

Run: `pnpm vitest run` then `pnpm exec tsc -b` then `pnpm --dir functions build`
Expected: all PASS / no type errors. Fix any remaining test that pinned the old raw-string behaviour by asserting the resolved text instead.

- [ ] **Step 5: Commit**

```bash
git add functions/src/positions.ts functions/src/shareCard.ts functions/src/social.ts src/lib/club.ts src/lib/club.test.ts src/lib/statsView.ts src/lib/statsView.test.ts src/lib/squad.ts src/lib/shareCard.test.ts src/lib/positions.test.ts src/pages/acceso/useDoor.ts src/pages/jugador/JugadorPage.tsx src/pages/admin/shell/AdminLayout.tsx src/pages/admin/acta/roster.ts src/pages/admin/data/useAdminData.ts src/pages/admin/club/plantillaLogic.ts src/pages/admin/club/plantillaLogic.test.ts src/pages/admin/club/plantillaBoard.ts src/pages/admin/club/plantillaBoard.test.ts src/pages/admin/club/FichaWorkspace.tsx src/pages/perfil/card.ts src/pages/perfil/TabCarta.tsx
git commit -m "fix(positions): every screen reads positions through one resolver (words no longer «Sin posición»)"
```

---

### Task 6: Firestore rules — position shapes and the member's own proposal

**Files:**
- Modify: `firestore.rules:46-49`
- Test: `test/rules/firestore-rules.test.ts`

**Interfaces:**
- Produces (rules contract used by Phase 3):
  - Admin may write `positions` `{main: code|null, also: list≤6 of unique codes without main}`, `positionsReview` `{status in [aprobada, ajustada, rechazada], at: request.time, by: auth.uid}` or `null`, and `positionsProposal: null`.
  - A team member whose `users/{uid}.playerId == id` may update **only** `positionsProposal` on `players/{id}`: a valid set + `at == request.time`, or `null`.

- [ ] **Step 1: Write the failing tests** — add a `describe` block near the other `players` tests

```ts
describe("Posiciones: propuesta del jugador y aprobación", () => {
  const ref = (uid: string, id = "erik") => doc(db(uid), "players", id);
  const set = (main: string | null, also: string[] = []) => ({ main, also });
  beforeEach(async () => {
    await seed("users/member", { email: "member@test.dev", nickname: "member", role: "user", playerId: "erik" });
    await seed("players/erik", { shirtName: "ERIK", naturalPosition: "DEF" });
    await seed("players/otro", { shirtName: "OTRO" });
  });
  it("el jugador propone las suyas (y puede retirarlas)", async () => {
    await assertSucceeds(updateDoc(ref("member"), { positionsProposal: { ...set("LD", ["MD", "DFC"]), at: serverTimestamp() } }));
    await assertSucceeds(updateDoc(ref("member"), { positionsProposal: null }));
  });
  it("no puede proponer por otro, ni tocar otro campo, ni aprobarse", async () => {
    await assertFails(updateDoc(ref("member", "otro"), { positionsProposal: { ...set("MC"), at: serverTimestamp() } }));
    await assertFails(updateDoc(ref("member"), { positionsProposal: { ...set("MC"), at: serverTimestamp() }, shirtName: "YO" }));
    await assertFails(updateDoc(ref("member"), { positions: set("MC") }));
    await assertFails(updateDoc(ref("other"), { positionsProposal: { ...set("MC"), at: serverTimestamp() } }));
  });
  it("una propuesta mal formada se rechaza", async () => {
    for (const bad of [
      { ...set("XX"), at: serverTimestamp() },
      { ...set("MC", ["MC"]), at: serverTimestamp() },
      { ...set("MC", ["MI", "MI"]), at: serverTimestamp() },
      { ...set("MC", ["POR", "DFC", "LIB", "LI", "LD", "MCD", "MI"]), at: serverTimestamp() },
      { ...set("MC"), at: 5 },
      { ...set("MC"), at: serverTimestamp(), extra: 1 },
      { main: "MC", at: serverTimestamp() },
    ])
      await assertFails(updateDoc(ref("member"), { positionsProposal: bad }));
  });
  it("el admin aprueba: positions + revisión firmada + propuesta a null", async () => {
    await assertSucceeds(
      updateDoc(ref("admin"), {
        positions: set("LD", ["MD"]),
        naturalPosition: "DEF",
        positionsProposal: null,
        positionsReview: { status: "aprobada", at: serverTimestamp(), by: "admin" },
      }),
    );
    await assertFails(updateDoc(ref("admin"), { positions: set("LD", ["LD"]) }));
    await assertFails(updateDoc(ref("admin"), { positionsReview: { status: "aprobada", at: serverTimestamp(), by: "otro" } }));
    await assertFails(updateDoc(ref("admin"), { positionsReview: { status: "quizá", at: serverTimestamp(), by: "admin" } }));
  });
});
```

Add `serverTimestamp` and `updateDoc` to the file's `firebase/firestore` import if missing.

- [ ] **Step 2: Run to verify failures**

Run: `pnpm test:rules`
Expected: FAIL on «el jugador propone…» (member denied) and on the admin malformed cases (currently allowed).

- [ ] **Step 3: Implement** — in `firestore.rules`, above `match /players/{id}`:

```
    // ---- posiciones de fútbol 7 (Admin → Plantilla; el jugador propone las suyas desde su perfil).
    function posCodes() { return ['POR','DFC','LIB','LI','LD','MCD','MC','MI','MD','MCO','EI','ED','DC']; }
    function validPosSet(p) {
      return p is map
        && p.keys().hasAll(['main','also'])
        && (p.main == null || p.main in posCodes())
        && p.also is list && p.also.size() <= 6
        && p.also.toSet().size() == p.also.size()
        && p.also.toSet().difference(posCodes().toSet()).size() == 0
        && (p.main == null || !(p.main in p.also));
    }
    function validProposal(p) {
      return p == null || (validPosSet(p) && p.keys().hasOnly(['main','also','at']) && p.at == request.time);
    }
    function validReview(r) {
      return r == null || (r is map && r.keys().hasOnly(['status','at','by'])
        && r.status in ['aprobada','ajustada','rechazada'] && r.at == request.time && r.by == request.auth.uid);
    }
    // Admin: only when they change (like the sanction).
    function positionsOk() {
      let d = request.resource.data;
      let changed = resource == null ? d.keys() : d.diff(resource.data).affectedKeys();
      return (!changed.hasAny(['positions']) || (validPosSet(d.positions) && d.positions.keys().hasOnly(['main','also'])))
        && (!changed.hasAny(['positionsReview']) || validReview(d.get('positionsReview', null)))
        && (!changed.hasAny(['positionsProposal']) || validProposal(d.get('positionsProposal', null)));
    }
    // The member linked to this ficha: only their own proposal (or withdrawing it).
    function ownProposal(id) {
      return teamMember() && resource != null
        && me().get('playerId', null) == id
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['positionsProposal'])
        && validProposal(request.resource.data.get('positionsProposal', null));
    }
```

and change the players block to:

```
    match /players/{id} {
      allow read: if true;
      allow create: if admin() && sanctionOk() && positionsOk();
      allow update: if (admin() && sanctionOk() && positionsOk()) || ownProposal(id);
      allow delete: if admin();
    }
```

- [ ] **Step 4: Run rules tests**

Run: `pnpm test:rules`
Expected: PASS — the new block and every existing case (admin `naturalPosition: "DEL"` update still allowed).

- [ ] **Step 5: Commit**

```bash
git add firestore.rules test/rules/firestore-rules.test.ts
git commit -m "feat(rules): position shapes; a member proposes only their own positions"
```

Deploy note (not part of this task): rules go to production **before** the Phase 1 PR merges, with the user's go-ahead (`firebase deploy --only firestore:rules`, GCP env vars unset — see memory «Home El vestidor»).

---

### Task 7: The migration plan and script

**Files:**
- Modify: `functions/src/positions.ts` (append `legacyPlan`)
- Create: `functions/scripts/migrate-positions.mjs`
- Test: `src/lib/positions.test.ts` (append)

**Interfaces:**
- Produces: `legacyPlan(players: { id: string; positions?: unknown; naturalPosition?: unknown }[]): { id: string; from: string; to: PositionSet }[]` — only players **without** a `positions` map; `to.main` = exact code if the old text names one, else `null` (line-only words are not guessed into a code).

- [ ] **Step 1: Write the failing test**

```ts
import { legacyPlan } from "./positions";
describe("legacyPlan (migración)", () => {
  it("fills positions from the old text, never guessing a code from a line", () => {
    expect(
      legacyPlan([
        { id: "a", naturalPosition: "Portero" },
        { id: "b", naturalPosition: "DEL" },
        { id: "c", naturalPosition: "Lateral derecho" },
        { id: "d" },
        { id: "e", naturalPosition: "MC", positions: { main: "MCD", also: [] } },
      ]),
    ).toEqual([
      { id: "a", from: "Portero", to: { main: "POR", also: [] } },
      { id: "b", from: "DEL", to: { main: null, also: [] } },
      { id: "c", from: "Lateral derecho", to: { main: "LD", also: [] } },
      { id: "d", from: "", to: { main: null, also: [] } },
    ]);
  });
  it("is a no-op once every player has positions", () => {
    expect(legacyPlan([{ id: "e", positions: { main: null, also: [] } }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** `pnpm vitest run src/lib/positions.test.ts` — Expected: FAIL (`legacyPlan` missing).

- [ ] **Step 3: Implement**

Append to `functions/src/positions.ts`:
```ts
/** La migración: a quién le falta `positions` y qué se le escribe (sin adivinar códigos a partir de una línea). */
export function legacyPlan(players: { id: string; positions?: unknown; naturalPosition?: unknown }[]): { id: string; from: string; to: PositionSet }[] {
  return players
    .filter((p) => sanitizePositions(p.positions) === null)
    .map((p) => ({ id: p.id, from: typeof p.naturalPosition === "string" ? p.naturalPosition : "", to: { main: parsePosition(p.naturalPosition).code, also: [] } }));
}
```

Create `functions/scripts/migrate-positions.mjs`:
```js
// Rellena players/{id}.positions desde naturalPosition (texto antiguo). Por defecto: EMULADOR y en seco.
//   node functions/scripts/migrate-positions.mjs            → muestra el plan (emulador)
//   node functions/scripts/migrate-positions.mjs --write    → lo escribe (emulador)
//   node functions/scripts/migrate-positions.mjs --prod [--write] → producción (credenciales por defecto de GCP)
// Idempotente: solo toca fichas sin `positions`. No cambia naturalPosition.
import { legacyPlan } from "../src/positions.ts";

const write = process.argv.includes("--write");
const prod = process.argv.includes("--prod");
if (!prod) process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
const { initializeApp } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
initializeApp({ projectId: prod ? "manchester-piti" : "demo-manchester-piti" });
const db = getFirestore();

const snap = await db.collection("players").get();
const plan = legacyPlan(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
console.table(plan.map((p) => ({ id: p.id, antes: p.from, preferida: p.to.main ?? "— (Sin posición)" })));
console.log(`${plan.length} fichas sin «positions» (${prod ? "PRODUCCIÓN" : "emulador"}).`);
if (!write) {
  console.log("En seco: añade --write para escribirlo.");
  process.exit(0);
}
const batch = db.batch();
for (const p of plan) batch.update(db.collection("players").doc(p.id), { positions: p.to });
await batch.commit();
console.log(`Escritas ${plan.length}.`);
```

Before writing it, confirm the production project id: `cat .firebaserc` and use that id instead of `"manchester-piti"` if it differs.

- [ ] **Step 4: Verify**

Run: `pnpm vitest run src/lib/positions.test.ts` → PASS.
Then against the emulator (one terminal): `pnpm emulators`; in another: `node functions/test/seed-preview.mjs` then `node functions/scripts/migrate-positions.mjs` (expect a table with the seed's words → codes and `--write` hint), then `node functions/scripts/migrate-positions.mjs --write`, then run it again and expect `0 fichas sin «positions»`. Stop the emulators (see memory «Local emulator testing» for orphan cleanup on Windows).

- [ ] **Step 5: Commit**

```bash
git add functions/src/positions.ts functions/scripts/migrate-positions.mjs src/lib/positions.test.ts
git commit -m "feat(positions): idempotent migration from the old position text"
```

Production run happens at the Phase 3 deploy (when the admin can edit positions), only with the user's explicit go-ahead.

---

### Task 8: Full verification and PR

- [ ] **Step 1:** `pnpm lint` — Expected: 0 errors.
- [ ] **Step 2:** `pnpm test` — Expected: all pass.
- [ ] **Step 3:** `pnpm build` — Expected: success (web + SSR).
- [ ] **Step 4:** `pnpm --dir functions build` — Expected: success.
- [ ] **Step 5:** `pnpm test:rules` — Expected: all pass.
- [ ] **Step 6:** `pnpm test:e2e:ci` for `e2e/pizarra.crud.spec.ts` and the admin plantilla spec (`pnpm test:e2e:ci -- e2e/pizarra.crud.spec.ts` style per `playwright.config`), one at a time — Expected: pass. If the e2e environment can't run, report why.
- [ ] **Step 7:** Push `feat/posiciones` and open a PR to `main` titled «Posiciones de F7 · Fase 1: catálogo, 15 sistemas y reglas», body: what changed, the deploy order (rules first), that the migration is not run yet. Then bind it with the ccd_pr tools and read CI. Merge only with the user's OK (`gh pr merge --merge`).

---

## Later phases (planned after Phase 1 merges)

- **Phase 2 · Pizarra:** `Lineup.playerPositions` → `PosCode | Zone`; `model.ts natOf/fits` → `fitGrade`; `autoPlace`, `suggestSeven`, `quimica`, `chemPlayer`, `familiarity` (by code), `cambios`, `pachanga`, `compare`, `record`, `bench` filter, fit marks in `view.ts`; new system selector with «¿Nos encaja?»; rival selector. Needs the canvas design pick for the selector.
- **Phase 3 · Admin + perfil:** «Mapa de posiciones» component (ver/editar), FichaWorkspace/Alta/PlantillaList editor, «Propuestas pendientes» (Inicio/Hoy + filter), perfil «Mis posiciones», run the production migration. Needs the canvas design pick for the Mapa.
- **Phase 4 · Historial y estadísticas:** `functions/src/positionsPlayed.ts` + `saveMatchSheet`, backfill script, stats por posición / por sistema, FichaModal tab, cromo/club. Needs the canvas design pick for the stats.
- **Design (can start now, in parallel with Phase 1 coding):** one design agent, canvas sketches of the three new pieces.
