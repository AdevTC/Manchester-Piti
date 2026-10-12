// La pizarra · Bloque 4: the board's tactical fields (sin balón, plan condicional, estilo) read from the store
// leniently and written back plain. An invalid field is reported (the same telemetry as a dropped doc) and
// repaired to nothing; an invalid rule is dropped alone. Pure.
import type { Lineup } from "../formations";
import { reportDroppedDoc } from "../../../lib/docTelemetry";
import { condRuleSchema, shapeOffSchema, styleSchema, TACTICA_LIMITS, type CondRule, type ShapeOff, type StyleId } from "../../../lib/tacticaSchemas";
import { TACTICS } from "../tactics";

/** «Sin balón» as stored (null = the board has none). */
export function parseShapeOff(raw: unknown, docId: string): ShapeOff | null {
  if (raw === undefined || raw === null) return null;
  const r = shapeOffSchema.safeParse(raw);
  if (r.success) return r.data;
  reportDroppedDoc("lineups.shapeOff", docId, r.error.issues);
  return null;
}

/** A rule's value has to be one of its consigna's own values. */
const valueOk = (r: CondRule): boolean => !!TACTICS.find((t) => t.key === r.key)?.options.includes(r.value);

/** The conditional plan: the valid rules (at most three, once per id); an invalid one is dropped and reported. */
export function parseCondPlan(raw: unknown, docId: string): CondRule[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    reportDroppedDoc("lineups.condPlan", docId, []);
    return [];
  }
  const out: CondRule[] = [];
  raw.forEach((x) => {
    const r = condRuleSchema.safeParse(x);
    if (r.success && valueOk(r.data) && out.length < TACTICA_LIMITS.rules && !out.some((o) => o.id === r.data.id)) out.push(r.data);
    else reportDroppedDoc("lineups.condPlan", docId, r.success ? [] : r.error.issues);
  });
  return out;
}

/** The style last applied (null = none, or an unknown one). An empty string is «none» as written. */
export function parseStyle(raw: unknown, docId: string): StyleId | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const r = styleSchema.safeParse(raw);
  if (r.success) return r.data;
  reportDroppedDoc("lineups.style", docId, r.error.issues);
  return null;
}

const copyRule = (r: CondRule): CondRule => ({ ...r, ...(r.sub ? { sub: { ...r.sub } } : {}) });

/** The three fields as a write: always present, so clearing one clears it in the store too. */
export function tacticaToData(L: Lineup): { shapeOff: ShapeOff | null; condPlan: Record<string, unknown>[]; style: string } {
  return {
    shapeOff: L.shapeOff ? { formation: L.shapeOff.formation, offs: L.shapeOff.offs.map((o) => ({ du: o.du, dv: o.dv })) } : null,
    condPlan: (L.condPlan ?? []).map((r) => {
      const o: Record<string, unknown> = { id: r.id, when: r.when, by: r.by, from: r.from, key: r.key, value: r.value };
      if (r.sub) o.sub = { out: r.sub.out, in: r.sub.in };
      return o;
    }),
    style: L.style ?? "",
  };
}

/** The three fields copied (loading a board into the editor). */
export function copyTactica(L: Pick<Lineup, "shapeOff" | "condPlan" | "style">): Pick<Lineup, "shapeOff" | "condPlan" | "style"> {
  return {
    shapeOff: L.shapeOff ? { formation: L.shapeOff.formation, offs: L.shapeOff.offs.map((o) => ({ ...o })) } : null,
    condPlan: (L.condPlan ?? []).map(copyRule),
    style: L.style ?? null,
  };
}

/** What the lineup's undo compares of them (ops.ts editSig). */
export function tacticaSig(L: Lineup): unknown[] {
  return [L.shapeOff ? [L.shapeOff.formation, L.shapeOff.offs.map((o) => [o.du, o.dv])] : null, (L.condPlan ?? []).map((r) => [r.id, r.when, r.by, r.from, r.key, r.value, r.sub?.out ?? null, r.sub?.in ?? null]), L.style ?? null];
}
