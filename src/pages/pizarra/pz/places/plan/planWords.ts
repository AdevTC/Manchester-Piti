// r14 «La pizarra» · Plan: the headline, the kicker and each part's live summary (the prototype's renderVals head /
// subs / peekT). Pure over the store.
import type { PzApi } from "../../store/api";
import { fmt } from "../../store/fmt";
import { planLiveState, planOf, planRuleShort, planStyle, rivalDanger, dangerName, type PlanPart } from "./planView";
import { MISS_T, offShape, baseTokens, paradoGap, partsStatus } from "./planPlace";
import { PARADO_KINDS } from "./planView";

/** The rival's row in the league table. */
export interface PlanTable {
  pos: number;
  pts: number;
  pj: number;
  form: ("G" | "E" | "P")[];
}

export function planHead(P: PzApi): { kicker: string; t: string; s: string; peek: string } {
  const b = P.sel.board();
  const M = P.sel.match();
  const m = P.sel.me();
  const PS = partsStatus(P);
  const pl = planOf(b?.lineup);
  const J = M?.j ? "J" + M.j : "";
  const kicker = "El plan · " + (M ? [J, M.rival, fmt.day(M.at)].filter(Boolean).join(" · ") : "sin partido");
  const rival = M ? M.rival : "el rival";
  const ro = !!b && !P.sel.canEdit(b);
  let t: string;
  let s: string;
  if (!b) {
    t = m.fuera || m.socia ? "El plan del partido" : "El plan está por hacer";
    s = m.fuera || m.socia ? "Cuando el capitán publique el oficial, aquí verás cómo jugamos." : "Empieza por el siete: el plan va con él.";
  } else if (M && M.played && M.gf != null && M.ga != null) {
    t = (M.gf > M.ga ? "Ganamos " : M.gf < M.ga ? "Perdimos " : "Empatamos ") + M.gf + "–" + M.ga;
    s = "Así salió el plan contra " + M.rival + ".";
  } else if (ro) {
    t = "Contra " + rival;
    s = b.isOfficial ? "El plan del capitán: se lee en un minuto." : "El plan de @" + b.ownerNick + ", en solo lectura.";
  } else if (!PS.miss.length) {
    t = "Contra " + rival;
    s = "Listo: " + fmt.plural(pl.claves.length, "clave", "claves") + ", las pelotas paradas" + ((b.lineup.condPlan ?? []).length ? " y qué hacer si pasa algo." : ".");
  } else if (PS.miss.length === 1) {
    const k = PS.miss[0];
    const w = MISS_T[k];
    const gap = k === "parado" ? paradoGap(P, b) : [];
    t = "Al plan le " + w[1] + " " + w[0];
    s = gap.length ? "Falta " + fmt.list(gap) + ". Lo demás está listo." : "Lo demás está listo.";
  } else if (PS.done === 0) {
    t = "El plan está por hacer";
    s = "Empieza por el rival: " + (M ? (P.state.W.matches.some((x) => x.rival === M.rival && x.played && x.id !== M.id) ? "ya hemos jugado contra " + M.rival + "." : "primera vez contra " + M.rival + ".") : "elige contra quién.");
  } else {
    t = "Al plan le faltan " + PS.miss.length + " partes";
    s = "Faltan " + fmt.list(PS.miss.map((k) => MISS_T[k][0])) + ".";
  }
  const live = b ? planLiveState(P) : null;
  if (live) {
    t = "Contra " + rival;
    s = "En juego · " + live.minute + "′ · Piti " + live.gf + "–" + live.ga + ". Mira «Si pasa…».";
  }
  const PEEK: Record<string, string> = { rival: "el rival", claves: "las claves", juego: "el estilo", parado: "las paradas", sipasa: "el «si pasa»" };
  const peek = !b ? t : live ? live.minute + "′ · " + live.gf + "–" + live.ga : PS.miss.length === 1 ? "Falta" + (PS.miss[0] === "claves" || PS.miss[0] === "parado" ? "n " : " ") + PEEK[PS.miss[0]] : PS.miss.length ? "Faltan " + PS.miss.length + " partes" : "Contra " + rival;
  return { kicker, t, s, peek };
}

/** Each part's live summary (the places bar turned vertical). */
export function partSubs(P: PzApi): Record<PlanPart, string> {
  const b = P.sel.board();
  const L = b?.lineup;
  const pl = planOf(L);
  const PS = partsStatus(P);
  const v = b ? P.sel.ver(b, "titular") : null;
  const tk = (k: (typeof PARADO_KINDS)[number]) => {
    const t = b && v ? P.sel.taker(b, v, k) : null;
    return t ? P.sel.name(t) : "—";
  };
  const nNotes = L?.rival ? L.rival.players.filter((x) => x.note).length : 0;
  const d = rivalDanger(L);
  const st = planStyle(L?.style);
  const off = L ? offShape(L, baseTokens(P, b ?? null)) : null;
  const rules = L?.condPlan ?? [];
  return {
    rival: L?.rival ? L.rival.formation + " · " + fmt.plural(nNotes, "nota", "notas") + (d ? " · cuidado con " + dangerName(d).toLowerCase() : "") : "Sin su siete",
    claves: pl.claves.length ? pl.claves[0] : "Ninguna todavía",
    juego: (st ? st.t : "Sin estilo") + (off ? " · sin balón " + off.formation : ""),
    parado: b ? (PS.st.parado ? "Córners " + tk("corners") + " · Faltas " + tk("freekicks") : "Falta " + (paradoGap(P, b)[0] ?? "")) : "",
    sipasa: rules.length ? planRuleShort(rules[0]) : "Ninguna regla",
    notas: pl.notes ? "«" + pl.notes + "»" : "Vacías",
  };
}
