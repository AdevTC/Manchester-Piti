// r14 «La pizarra» · Plan: a «Si pasa…» rule in words — light (no store, no live clock), so la mesa can import it
// without pulling the Plan's other pieces. planView.ts re-exports all of it: the names and signatures stay.
import type { CondRuleR14, CondVer } from "../../../data/condPlan";
import { COND_KEEP } from "../../../data/condPlan";
import { TACTICS } from "../../../tactics";

/** What a rule does (the prototype's CONSE): the consigna it sets, in words. */
export const RULE_CONSE: { id: string; t: string; key: "mentality" | "press" | "defLine" | null; value: string | null }[] = [
  { id: "arriba", t: "más arriba", key: "mentality", value: "Ofensiva" },
  { id: "atras", t: "más atrás", key: "mentality", value: "Defensiva" },
  { id: "presion", t: "presión alta", key: "press", value: "Alta" },
  { id: "repliegue", t: "replegados", key: "press", value: "Repliegue" },
  { id: "lineaA", t: "línea alta", key: "defLine", value: "Alta" },
  { id: "lineaB", t: "línea baja", key: "defLine", value: "Baja" },
  { id: "nada", t: "sin cambiar nada", key: null, value: null },
];
/** The versions a rule can switch to, in words. */
export const RULE_VERS: [CondVer | null, string][] = [
  ["planb", "Plan B"],
  ["segunda", "2ª parte"],
  [null, "sin cambiar de versión"],
];
/** «perdiendo» · «empatando» · «ganando» (stored «empate» reads «empatando»). */
export const WHEN_WORD: Record<CondRuleR14["when"], string> = { perdiendo: "perdiendo", empate: "empatando", ganando: "ganando" };
const WHEN_VERB: Record<CondRuleR14["when"], string> = { perdiendo: "perdemos", empate: "empatamos", ganando: "ganamos" };

/** A rule's consigna in words (one of the prototype's, else «presión media»). */
export function ruleConse(r: Pick<CondRuleR14, "key" | "value">): { t: string; key: CondRuleR14["key"] | null; value: string | null } {
  if (r.value === COND_KEEP) return { t: "sin cambiar nada", key: null, value: null };
  const c = RULE_CONSE.find((x) => x.key === r.key && x.value === r.value);
  if (c) return { t: c.t, key: r.key, value: r.value };
  const d = TACTICS.find((x) => x.key === r.key);
  return { t: (d ? d.label.toLowerCase().replace("línea defensiva", "línea") + " " : "") + r.value.toLowerCase(), key: r.key, value: r.value };
}

/** «desde el 35′» · «desde el principio». */
export const fromWords = (from: number): string => (from > 0 ? "desde el " + from + "′" : "desde el principio");

/** «Si vamos perdiendo por 1 desde el 35′ → más arriba + entra BRAWAN por ALCIDES + Plan B». */
export function planRuleText(r: CondRuleR14, name: (id: string) => string): string {
  const c = ruleConse(r);
  const ver = r.ver ? RULE_VERS.find((x) => x[0] === r.ver)?.[1] ?? "" : "";
  const sub = r.sub && r.sub.out && r.sub.in ? "entra " + name(r.sub.in) + " por " + name(r.sub.out) : "";
  const bits = [c.key ? c.t : "", sub, ver].filter(Boolean);
  return "Si vamos " + WHEN_WORD[r.when] + (r.when !== "empate" ? " por " + r.by : "") + " " + fromWords(r.from) + " → " + (bits.join(" + ") || "sin cambiar nada");
}

/** «Si perdemos desde el 35′ → Plan B» (the short one, for a chip). */
export function planRuleShort(r: CondRuleR14): string {
  const ver = r.ver ? RULE_VERS.find((x) => x[0] === r.ver)?.[1] ?? "" : "";
  return "Si " + WHEN_VERB[r.when] + " " + fromWords(r.from) + " → " + (ver || ruleConse(r).t);
}
