// La pizarra · Bloque 4 — el plan condicional: up to three rules «Si vamos ganando por 2 desde el 30′ →
// mentalidad defensiva + entra KEVIN por TELLO», stored on the board. In the live match, the first rule whose
// condition holds (and whose consigna is not on yet) is suggested on the live card; applying it changes the
// consigna and, with a cambio, plans it for now. Pure.
import type { Lineup, Sub } from "../formations";
import { COND_KEYS, TACTICA_LIMITS, type CondKey, type CondRule, type CondWhen } from "../../../lib/tacticaSchemas";
import { MATCHDAY_LIMITS } from "../../../lib/schemas";
import { defaultTactics, TACTICS } from "../tactics";

export const COND_MAX = TACTICA_LIMITS.rules;
export const WHEN_LABEL: Record<CondWhen, string> = { ganando: "ganando", perdiendo: "perdiendo", empate: "empatando" };
export const KEY_LABEL: Record<CondKey, string> = { mentality: "Mentalidad", press: "Presión", defLine: "Línea" };
export const condOptions = (key: CondKey): string[] => TACTICS.find((t) => t.key === key)?.options ?? [];

/** A new rule, as a starting point: «si vamos ganando por 1 desde el 30′ → mentalidad defensiva». */
export function newRule(id: string): CondRule {
  return { id, when: "ganando", by: 1, from: 30, key: "mentality", value: "Defensiva" };
}

/** The rules a board has. */
export const rulesOf = (L: Lineup): CondRule[] => L.condPlan ?? [];

/** One more rule (none past three). */
export function addRule(L: Lineup, id: string): Lineup {
  const rs = rulesOf(L);
  if (rs.length >= COND_MAX) return L;
  return { ...L, condPlan: [...rs, newRule(id)] };
}

export function removeRule(L: Lineup, id: string): Lineup {
  const rs = rulesOf(L);
  if (!rs.some((r) => r.id === id)) return L;
  return { ...L, condPlan: rs.filter((r) => r.id !== id) };
}

export type RulePatch = Partial<Pick<CondRule, "when" | "by" | "from" | "key" | "value">> & { sub?: CondRule["sub"] | null };

/** A rule changed, kept valid: empate has no «por N», the others at least 1; a new consigna starts at its
 *  first value; a cambio needs two different players (null takes it away). */
export function patchRule(L: Lineup, id: string, p: RulePatch): Lineup {
  const rs = rulesOf(L);
  const r = rs.find((x) => x.id === id);
  if (!r) return L;
  const next: CondRule = { ...r };
  if (p.when) {
    next.when = p.when;
    next.by = p.when === "empate" ? 0 : Math.max(1, next.by);
  }
  if (p.by != null && next.when !== "empate") next.by = Math.max(1, Math.min(TACTICA_LIMITS.by, Math.round(p.by)));
  if (p.from != null && Number.isFinite(p.from)) next.from = Math.max(0, Math.min(TACTICA_LIMITS.from, Math.round(p.from)));
  if (p.key && COND_KEYS.includes(p.key) && p.key !== r.key) {
    next.key = p.key;
    next.value = condOptions(p.key)[0];
  }
  if (p.value && condOptions(next.key).includes(p.value)) next.value = p.value;
  if (p.sub === null) delete next.sub;
  else if (p.sub) {
    if (p.sub.out && p.sub.in && p.sub.out !== p.sub.in) next.sub = { out: p.sub.out, in: p.sub.in };
    else delete next.sub;
  }
  if (JSON.stringify(next) === JSON.stringify(r)) return L;
  return { ...L, condPlan: rs.map((x) => (x.id === id ? next : x)) };
}

/** «Si vamos ganando por 2 o más desde el 30′ → mentalidad defensiva + entra KEVIN por TELLO». */
export function ruleTxt(r: CondRule, name: (id: string) => string): string {
  const cond = r.when === "empate" ? "Si vamos empatando" : "Si vamos " + WHEN_LABEL[r.when] + " por " + r.by + (r.by > 1 ? " o más" : "");
  const since = r.from > 0 ? " desde el " + r.from + "′" : "";
  return cond + since + " → " + KEY_LABEL[r.key].toLowerCase() + " " + r.value.toLowerCase() + (r.sub ? " + entra " + name(r.sub.in) + " por " + name(r.sub.out) : "");
}

/** Whether a rule's condition holds at a minute with a score. */
export function holds(r: CondRule, minute: number, gf: number, ga: number): boolean {
  if (minute < r.from) return false;
  const d = gf - ga;
  if (r.when === "empate") return d === 0;
  if (r.when === "ganando") return d >= r.by;
  return -d >= r.by;
}

export interface LiveSuggestion {
  rule: CondRule;
  /** «Vamos ganando por 2 desde el 30′: toca mentalidad defensiva». */
  txt: string;
  /** The cambio can be planned now (the one leaving is on the pitch, the one coming in is not). */
  subOk: boolean;
}

/** The rule to suggest now (the first that holds whose consigna — or cambio — is still to come), or null. */
export function liveSuggestion(L: Lineup, live: { minute: number; gf: number; ga: number; field: readonly string[] }, name: (id: string) => string): LiveSuggestion | null {
  const t = { ...defaultTactics(), ...L.tactics };
  const on = new Set(live.field);
  for (const r of rulesOf(L)) {
    if (!holds(r, live.minute, live.gf, live.ga)) continue;
    const subOk = !!r.sub && on.has(r.sub.out) && !on.has(r.sub.in) && !(L.subs ?? []).some((s) => s.out === r.sub?.out && s.in === r.sub?.in);
    if (t[r.key] === r.value && !subOk) continue;
    return { rule: r, txt: "Toca el plan: " + ruleTxt(r, name).replace(/^Si v/, "v"), subOk };
  }
  return null;
}

/** The rule applied: its consigna and, when it can be, its cambio planned for this minute. */
export function applyRule(L: Lineup, r: CondRule, minute: number, subOk: boolean, newId: () => string): Lineup {
  const tactics = { ...defaultTactics(), ...L.tactics, [r.key]: r.value };
  const subs: Sub[] = L.subs ?? [];
  const min = Math.max(1, Math.min(MATCHDAY_LIMITS.subMinute, minute));
  const withSub = subOk && r.sub && subs.length < MATCHDAY_LIMITS.subs ? [...subs, { id: newId(), min, out: r.sub.out, in: r.sub.in }] : subs;
  return { ...L, tactics, ...(withSub !== subs || L.subs ? { subs: withSub } : {}) };
}
