// r14 «La pizarra» · Plan: the plan's words, read by the Plan place and reused by PARTIDO and CHARLA (the
// prototype's PZ.sel.planResumen / planLive / planRuleText in PiPlan.dc.html). Pure: reads the store through the
// few selectors it needs (`PlanReader`, which the store's `P` satisfies), never writes. Keep these signatures
// stable: other places import them.
import type { CondRuleR14, CondVer } from "../../../data/condPlan";
import { COND_KEEP, ruleHolds } from "../../../data/condPlan";
import type { BoardPlan, KeyIcon, KeyViz } from "../../../data/plan";
import { dangerOf } from "../../../data/rival";
import { FORMATIONS, type Lineup } from "../../../formations";
import { TACTICS } from "../../../tactics";
import { liveNow } from "../../../v2/live";
import type { StyleId } from "../../../../../lib/tacticaSchemas";
import { fmt } from "../../store/fmt";
import type { PzBoard, PzMatch, PzVer, VersionId } from "../../store/types";

/** What the plan functions read from the store (`P` from usePz() fits; tests pass a small fake). */
export interface PlanReader {
  state: { W: { now: number } };
  sel: {
    board(id?: string | null): PzBoard | null;
    match(id?: string | null): PzMatch | null;
    name(id: string | null | undefined): string;
    ver(b?: PzBoard | null, v?: VersionId): PzVer | null;
    taker(b: PzBoard, v: PzVer, k: "penalties" | "freekicks" | "corners"): string | null;
  };
}

/** The plan «de un vistazo»: what the charla tells and the cartel carries. */
export interface PlanResumen {
  /** The rival's name («Red Demons»), '' when the board has neither a match nor a rival. */
  rival: string;
  /** «J3 · dom 8 nov · 18:00 · en casa» ('' without a match). */
  match: string;
  /** «Su 7 (MC): no le dejes girar» ('' when no rival player has a note or was chosen). */
  danger: string;
  claves: { t: string; icon: KeyIcon }[];
  /** «Presión alta · sin balón, 2-3-1». */
  juego: string;
  /** «Córners: EGUZQUIZA · Faltas: ADRIÁN · Penaltis: ALCIDES» (— for none). */
  parado: string;
  /** Every «Si pasa…» rule in words (planRuleText). */
  sipasa: string[];
  notas: string;
}

/** A «Si pasa…» rule that holds right now (la mesa / the live match). */
export interface PlanLive {
  rule: CondRuleR14;
  /** The rule in words (planRuleText). */
  text: string;
  /** «Toca el plan: vamos perdiendo (Piti 1–2) desde el 35′.» */
  live: string;
}

/** The score and minute a rule is checked against (v2/live.ts LiveNow fits). */
export interface PlanLiveState {
  minute: number;
  gf: number;
  ga: number;
}

// ── the prototype's tables (PiPlan.dc.html) ──────────────────────────────────────────────────────────────
export const PLAN_PARTS = [
  { id: "rival", t: "El rival", short: "Rival", icon: "shield" },
  { id: "claves", t: "Nuestras claves", short: "Claves", icon: "key" },
  { id: "juego", t: "Con balón · Sin balón", short: "Con y sin balón", icon: "ball" },
  { id: "parado", t: "Pelotas paradas", short: "Paradas", icon: "flag" },
  { id: "sipasa", t: "Si pasa…", short: "Si pasa…", icon: "swap" },
  { id: "notas", t: "Notas", short: "Notas", icon: "edit" },
] as const;
export type PlanPart = (typeof PLAN_PARTS)[number]["id"];
export const isPlanPart = (s: string): s is PlanPart => PLAN_PARTS.some((p) => p.id === s);

/** The styles as the plan tells them (title, what we win, what it costs) and the consignas each one sets. */
export const PLAN_STYLES: { id: StyleId; t: string; pro: string; con: string; tac: Partial<Record<string, string>>; mv: { DEF: number; MED: number; DEL: number; w: number } }[] = [
  { id: "presion", t: "Presión alta", pro: "Robamos cerca de su portería", con: "Dejamos espacio a la espalda", tac: { press: "Alta", defLine: "Alta" }, mv: { DEF: -8, MED: -10, DEL: -6, w: 1 } },
  { id: "bloque", t: "Bloque bajo y contra", pro: "Juntos atrás y salimos rápido", con: "Les dejamos el balón", tac: { press: "Repliegue", defLine: "Baja", mentality: "Defensiva", tempo: "Rápido" }, mv: { DEF: 7, MED: 15, DEL: 18, w: 0.82 } },
  { id: "posesion", t: "Posesión", pro: "El balón es nuestro", con: "Si la perdemos atrás, duele", tac: { buildup: "Corta", tempo: "Pausado", width: "Amplia" }, mv: { DEF: -2, MED: -4, DEL: 0, w: 1.14 } },
  { id: "directo", t: "Directo", pro: "Al 9 y a por la segunda", con: "Perdemos muchos balones", tac: { buildup: "En largo", tempo: "Rápido", attackFocus: "Centro" }, mv: { DEF: 2, MED: -6, DEL: -8, w: 0.92 } },
  { id: "equilibrado", t: "Equilibrado", pro: "Ni nos volcamos ni nos encerramos", con: "Sin un plan claro, cuesta morder", tac: { defLine: "Media", press: "Media", width: "Media", mentality: "Equilibrada", tempo: "Medio", buildup: "Mixta", attackFocus: "Equilibrado" }, mv: { DEF: 0, MED: 0, DEL: 0, w: 1 } },
];
export const planStyle = (id: StyleId | null | undefined) => PLAN_STYLES.find((s) => s.id === id) ?? null;

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

export const PARADO_KINDS = ["corners", "freekicks", "penalties"] as const;
export type ParadoKind = (typeof PARADO_KINDS)[number];
export const PARADO_KIND: Record<ParadoKind, { t: string; one: string; all: string; role: "E" | "F" | "P"; icon: string }> = {
  corners: { t: "Córners", one: "el córner", all: "los córners", role: "E", icon: "flag" },
  freekicks: { t: "Faltas", one: "la falta", all: "las faltas", role: "F", icon: "ball" },
  penalties: { t: "Penaltis", one: "el penalti", all: "los penaltis", role: "P", icon: "star" },
};

// ── the pieces ─────────────────────────────────────────────────────────────────────────────────────────────
/** The board's plan, never null (an untouched board has no keys and no notes). */
export const planOf = (L: Lineup | null | undefined): BoardPlan => L?.plan ?? { claves: [], viz: [], notes: "", parado: null };

/** What key `i` lights (its stored viz, else guessed from its words as the prototype does). */
export function vizOf(L: Lineup | null | undefined, i: number): KeyViz {
  const pl = planOf(L);
  if (pl.viz[i]) return pl.viz[i];
  const t = (pl.claves[i] ?? "").toLowerCase();
  if (/presi|muerd/.test(t)) return { icon: "spark", zona: "arriba" };
  if (/gire|su \d|marca|peligro/.test(t)) return { icon: "eye", zona: "su7" };
  if (/centro/.test(t)) return { icon: "ball", zona: "centro" };
  if (/banda/.test(t)) return { icon: "flag", zona: "bandas" };
  if (/atr[aá]s|juntos/.test(t)) return { icon: "users", zona: "atras" };
  return { icon: "flag", zona: "nada" };
}

/** The rival's dangerous player with his spot code («MC»), or null. */
export function rivalDanger(L: Lineup | null | undefined): { i: number; num: number | null; note: string; code: string } | null {
  const r = L?.rival;
  const d = r ? dangerOf(r) : null;
  if (!r || !d) return null;
  return { i: d.i, num: d.num ?? null, note: d.note ?? "", code: FORMATIONS[r.formation][d.i]?.position ?? "" };
}

/** «Su 7» / «Su MC» (no dorsal known). */
export const dangerName = (d: { num: number | null; code: string }): string => "Su " + (d.num != null ? String(d.num) : d.code || "peligroso");

/** A rule's consigna in words (one of the prototype's, else «presión media»). */
export function ruleConse(r: Pick<CondRuleR14, "key" | "value">): { t: string; key: CondRuleR14["key"] | null; value: string | null } {
  if (r.value === COND_KEEP) return { t: "sin cambiar nada", key: null, value: null };
  const c = RULE_CONSE.find((x) => x.key === r.key && x.value === r.value);
  if (c) return { t: c.t, key: r.key, value: r.value };
  const d = TACTICS.find((x) => x.key === r.key);
  return { t: (d ? d.label.toLowerCase().replace("línea defensiva", "línea") + " " : "") + r.value.toLowerCase(), key: r.key, value: r.value };
}

const fromWords = (from: number): string => (from > 0 ? "desde el " + from + "′" : "desde el principio");

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

/** The match being played now (minute and score), from la mesa's clock; null when it isn't. */
export function planLiveState(P: PlanReader, M: PzMatch | null = P.sel.match()): PlanLiveState | null {
  if (!M || M.played || (M.phase !== "juego" && M.phase !== "descanso")) return null;
  const l = liveNow(M.cal, P.state.W.now);
  if (l) return { minute: l.minute, gf: l.gf, ga: l.ga };
  return null;
}

/** Whether rule `r` holds at `s`, and the line that says so («Toca el plan…» / «Ahora no toca…»). */
export function ruleLive(r: CondRuleR14, s: PlanLiveState): { on: boolean; t: string } {
  const on = ruleHolds(r, s.minute, s.gf, s.ga);
  const d = s.gf - s.ga;
  const word = d > 0 ? "ganando" : d < 0 ? "perdiendo" : "empatando";
  const sc = "Piti " + s.gf + "–" + s.ga;
  return {
    on,
    t: on
      ? "Toca el plan: vamos " + word + " (" + sc + ") " + fromWords(r.from) + "."
      : "Ahora no toca: " + (d > 0 ? "ganamos" : d < 0 ? "perdemos" : "empatamos") + " " + s.gf + "–" + s.ga + " en el " + s.minute + "′.",
  };
}

/** The first «Si pasa…» rule of the board that holds now (null: none, or the match isn't being played).
 *  `live` overrides the minute and score (PARTIDO passes the one it shows). */
export function planLive(P: PlanReader, live?: PlanLiveState | null, boardId?: string | null): PlanLive | null {
  const b = P.sel.board(boardId);
  const rules = b?.lineup.condPlan ?? [];
  if (!b || !rules.length) return null;
  const s = live === undefined ? planLiveState(P, P.sel.match(b.matchId)) : live;
  if (!s) return null;
  for (const r of rules) {
    const l = ruleLive(r, s);
    if (l.on) return { rule: r, text: planRuleText(r, (id) => P.sel.name(id)), live: l.t };
  }
  return null;
}

/** «J3 · dom 8 nov · 18:00 · en casa». */
export function matchLine(M: PzMatch | null): string {
  if (!M) return "";
  return [M.j ? "J" + M.j : "", M.at ? fmt.day(M.at) : "", M.at ? fmt.hm(M.at) : "", M.home === true ? "en casa" : M.home === false ? "fuera" : ""].filter(Boolean).join(" · ");
}

/** The plan «de un vistazo» of the board on screen (or `boardId`); null without a board. */
export function planResumen(P: PlanReader, boardId?: string | null): PlanResumen | null {
  const b = P.sel.board(boardId);
  if (!b) return null;
  const L = b.lineup;
  const M = P.sel.match(b.matchId);
  const pl = planOf(L);
  const v = P.sel.ver(b, "titular");
  const tk = (k: ParadoKind) => (v ? P.sel.taker(b, v, k) : null);
  const d = rivalDanger(L);
  const style = planStyle(L.style);
  const off = L.shapeOff?.formation ?? v?.formation ?? L.formation;
  return {
    rival: M ? M.rival : L.rival ? "Rival" : "",
    match: matchLine(M),
    danger: d ? dangerName(d) + (d.code ? " (" + d.code + ")" : "") + ": " + (d.note || "el peligroso") : "",
    claves: pl.claves.map((t, i) => ({ t, icon: vizOf(L, i).icon })),
    juego: (style ? style.t : "Sin estilo") + " · sin balón, " + off,
    parado: PARADO_KINDS.map((k) => {
      const t = tk(k);
      return PARADO_KIND[k].t + ": " + (t ? P.sel.name(t) : "—");
    }).join(" · "),
    sipasa: (L.condPlan ?? []).map((r) => planRuleText(r, (id) => P.sel.name(id))),
    notas: pl.notes,
  };
}
