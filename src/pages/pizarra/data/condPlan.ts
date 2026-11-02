// r14 · «Si pasa…» (PZ-D07): the board's conditional plan as r14 stores it. On top of the v2 rule («si vamos
// perdiendo por 1 desde el 35′ → mentalidad ofensiva + entra X por Y»), a rule may switch to another version
// of the seven (`ver`: «segunda» = the board's «2ª parte» variant v2, «planb» = «Plan B» vb) and may change no
// consigna at all (`value` COND_KEEP, «sin cambiar nada»: key and value stay valid strings so the v2 code and
// firestore.rules condPlanOk — ≤ 8 keys per rule — are unchanged). Pure; la mesa evaluates it live with
// liveRules().
import { COND_KEYS, condRuleSchema, TACTICA_LIMITS, type CondKey, type CondRule } from "../../../lib/tacticaSchemas";
import { reportDroppedDoc } from "../../../lib/docTelemetry";
import { TACTICS } from "../tactics";

/** The value of a rule that changes no consigna («sin cambiar nada»). */
export const COND_KEEP = "=";
export const COND_VERS = ["segunda", "planb"] as const;
export type CondVer = (typeof COND_VERS)[number];
/** The variant id each `ver` switches to (formations.ts VariantId). */
export const VER_VARIANT: Record<CondVer, "v2" | "vb"> = { segunda: "v2", planb: "vb" };

/** A stored rule in r14: v2's, plus the version it switches to. */
export type CondRuleR14 = CondRule & { ver?: CondVer };

const valueOk = (key: CondKey, value: string): boolean => value === COND_KEEP || !!TACTICS.find((t) => t.key === key)?.options.includes(value);
const isVer = (v: unknown): v is CondVer => (COND_VERS as readonly unknown[]).includes(v);

/** The stored `condPlan`: the valid rules (≤ 3, once per id, `ver` kept); an invalid one dropped and reported. */
export function parseCondPlanR14(raw: unknown, docId = "-"): CondRuleR14[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    reportDroppedDoc("lineups.condPlan", docId, []);
    return [];
  }
  const out: CondRuleR14[] = [];
  raw.forEach((x) => {
    const r = condRuleSchema.safeParse(x);
    if (r.success && valueOk(r.data.key, r.data.value) && out.length < TACTICA_LIMITS.rules && !out.some((o) => o.id === r.data.id)) {
      const ver = (x as { ver?: unknown }).ver;
      out.push(isVer(ver) ? { ...r.data, ver } : r.data);
    } else reportDroppedDoc("lineups.condPlan", docId, r.success ? [] : r.error.issues);
  });
  return out;
}

/** Firestore payload of the rules (nothing undefined). */
export function condPlanToData(rules: readonly CondRuleR14[] | undefined): Record<string, unknown>[] {
  return (rules ?? []).map((r) => {
    const o: Record<string, unknown> = { id: r.id, when: r.when, by: r.by, from: r.from, key: r.key, value: r.value };
    if (r.sub) o.sub = { out: r.sub.out, in: r.sub.in };
    if (r.ver && isVer(r.ver)) o.ver = r.ver;
    return o;
  });
}

/** Whether a rule holds at `minute` with the score gf–ga (v2/condPlan.ts holds()). */
export function ruleHolds(r: CondRule, minute: number, gf: number, ga: number): boolean {
  if (minute < r.from) return false;
  const d = gf - ga;
  if (r.when === "empate") return d === 0;
  if (r.when === "ganando") return d >= r.by;
  return -d >= r.by;
}

/** What la mesa shows of a rule that holds: the consigna (none for COND_KEEP), the cambio, the version. */
export interface LiveRule {
  rule: CondRuleR14;
  consigna: { key: CondKey; value: string } | null;
  sub: { out: string; in: string } | null;
  ver: CondVer | null;
}

/** The rules that hold now, in order (la mesa: «Si pasa…» comes true → a suggestion). `onPitch` = who is on the
 *  pitch now: a cambio whose «out» isn't there or whose «in» already is is left out of the suggestion. */
export function liveRules(rules: readonly CondRuleR14[], o: { minute: number; gf: number; ga: number; onPitch?: ReadonlySet<string> }): LiveRule[] {
  return rules
    .filter((r) => ruleHolds(r, o.minute, o.gf, o.ga))
    .map((r) => {
      const subOk = !!r.sub && (!o.onPitch || (o.onPitch.has(r.sub.out) && !o.onPitch.has(r.sub.in)));
      return { rule: r, consigna: r.value === COND_KEEP ? null : { key: r.key, value: r.value }, sub: subOk && r.sub ? { ...r.sub } : null, ver: r.ver ?? null };
    });
}

export { COND_KEYS };
