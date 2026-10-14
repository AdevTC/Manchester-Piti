// La pizarra «Noche de partido» — the ficha's back: what a player brings to this seven, from real data
// only. The season line (partidos, goles, asistencias, minutos, titular, MVP); his form over the last
// matches as small bars (minutes per match, with goals + assists said in words); his minutes against
// the team's; who he is and where he plays (his exact positions and how well he fits his slot, else his
// natural line; a «Jugar de»); the galones he wears; whether he goes to the board's match; and his
// química links in this seven. Pure.
import type { Lineup } from "../formations";
import { normPlaysAs } from "../positions";
import { isPosCode, POSITIONS, type PosCode } from "../../../lib/positions";
import { availTxt, type CharlaMatch } from "./charla";
import { fitWord, hasFitData, logicGrade, slotCode, slotName } from "./encaje";
import { bajaWords, galonesOf, knownMinutes, rtTxt, type FormGame, type Squad } from "./model";
import { linkMark, togTxt, type Chem } from "./quimica";
import { formWhy } from "./ratings";
import { plural } from "./plural";
import type { FichaView } from "./Overlays";
import { fmtMinutes, wholeMinutes } from "../../../lib/derived/minutes";
import { jornadaLabel } from "../../../lib/derived/jornada";

// (his last matches are worked out with the squad, in ratings.ts buildSquad; re-exported for the ficha)
export { FORM_GAMES, formGames } from "./ratings";

/** A position said with its code: «pivote (MCD)». */
const named = (c: PosCode): string => POSITIONS[c].name.toLowerCase() + " (" + c + ")";

export interface FormBar {
  j: string;
  /** Height, % of the tallest match. */
  h: number;
  played: boolean;
  /** «J5: 50′ y 1 gol o asistencia» / «J6: no jugó». */
  t: string;
}

/** The form bars: each match as tall as its minutes (a match he didn't play is a flat mark, and says so). */
export function formBars(form: readonly FormGame[] | undefined): FormBar[] {
  if (!form?.length) return [];
  const top = Math.max(1, ...form.map((g) => g.min ?? 0));
  return form.map((g) => ({
    j: jornadaLabel(g.j) || "—",
    // (a legacy acta does not know his minutes: a half bar, and the words say so)
    h: g.played ? (g.min === null ? 50 : Math.max(12, Math.round((g.min / top) * 100))) : 0,
    played: g.played,
    t: (jornadaLabel(g.j) || "Partido") + ": " + (g.played ? (g.min === null ? "jugó, minutos sin registrar" : fmtMinutes(g.min)) + (g.ga ? " y " + plural(g.ga, "gol o asistencia", "goles o asistencias") : "") : "no jugó"),
  }));
}

export interface FichaArgs {
  id: string;
  L: Lineup;
  sq: Squad;
  ch: Chem;
  /** The board's match (its convocatoria says whether he is called). */
  match: CharlaMatch | null;
  ox: string;
  oy: string;
  side: FichaView["side"];
}

/** Everything the ficha shows for player `id` (null when he isn't in the squad any more). */
export function fichaOf({ id, L, sq, ch, match, ox, oy, side }: FichaArgs): FichaView | null {
  const p = sq.byId.get(id);
  if (!p) return null;
  const nm = (x: string) => sq.byId.get(x)?.name ?? "Jugador";
  const fi = L.slots.findIndex((s) => s.playerId === id);
  // his química in this seven: the strongest three links
  let ln = ch.links
    .filter((l) => l.a === id || l.b === id)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((l) => ({ k: "con " + nm(l.a === id ? l.b : l.a) + " · " + togTxt(l), v: linkMark(l.t) }));
  if (fi < 0) ln = [{ k: p.baja ? bajaWords(p).replace(/^./, (x) => x.toLocaleUpperCase("es")) + ": no disponible" : "En el banquillo", v: "" }];
  else if (!ln.length) ln = [{ k: "Sin vecinos cerca en este siete", v: "" }];
  const cv = p.cv === "voy" ? " · Voy" : p.cv === "duda" ? " · Duda" : p.cv === "no" ? " · No va" : "";

  // the facts: minutes against the team's, where he plays, galones, the match
  const facts: { k: string; v: string }[] = [];
  // the team's minutes: everyone's added up over the seven on the pitch
  const teamMin = sq.list.reduce((s, c) => s + c.stats.minutes, 0) / 7;
  if (knownMinutes(p.stats) === null && p.stats.played > 0) facts.push({ k: "Minutos", v: "Sin registrar" });
  else if (p.stats.minutes > 0 && teamMin > 0) facts.push({ k: "Minutos", v: fmtMinutes(p.stats.minutes) + " · " + Math.min(100, Math.round((p.stats.minutes / teamMin) * 100)) + " % del equipo" });
  else facts.push({ k: "Minutos", v: "Aún sin minutos" });
  const jugar = normPlaysAs(L.playerPositions[id]);
  // (a code is said with its name: «Juega de pivote (MCD)»; a legacy line as it was: «Juega de MED»)
  const jugarTxt = jugar && isPosCode(jugar) ? named(jugar) : jugar;
  // his exact positions («Pivote (MCD) · también MC»); who is known only by his line (or only as POR,
  // what every old «Portero» reads as) keeps the old words
  const ps = hasFitData([id], sq) ? p.ps : undefined;
  const home = ps?.main ?? ps?.also[0];
  let posV: string;
  if (ps && home) {
    if (jugar && jugar !== ps.main) posV = "Juega de " + jugarTxt + " · " + (ps.main ? "preferida " + named(ps.main) : "también " + ps.also.join(", "));
    else posV = ps.main ? named(ps.main).replace(/^./, (x) => x.toLocaleUpperCase("es")) + (ps.also.length ? " · también " + ps.also.join(", ") : "") : "También " + ps.also.map((c, k) => (k ? c : named(c))).join(", ");
  } else posV = jugar && jugar !== p.pos ? "Juega de " + jugarTxt + (p.pos ? " · natural " + p.pos : "") : p.pos ? p.pos + " natural" : "Sin posición natural";
  facts.push({ k: "Posición", v: posV });
  const gal = galonesOf(L, id);
  facts.push({ k: "Galones", v: gal.length ? gal.map((g) => g.label).join(" · ") : "Ninguno" });
  if (match) {
    const called = match.called ? (match.called.includes(id) ? "Convocado" : "No convocado") : "";
    facts.push({ k: match.j ?? "Partido", v: [called, availTxt(p)].filter(Boolean).join(" · ").replace(/^./, (c) => c.toLocaleUpperCase("es")) });
  }

  let whoWhere: string;
  if (ps && home) {
    const w = fi >= 0 ? fitWord(logicGrade(L, sq, id, fi)) : "";
    whoWhere = (ps.main ? POSITIONS[ps.main].name : "También " + ps.also.join(", ")) + (fi >= 0 ? " · juega de " + slotName(L, fi) + (w ? " · " + w : "") : "");
  } else {
    // (known only by his line, or not at all: a «Jugar de» by code on this board is exact data — the
    // slot by name and how well he fits it, as «Mover a» and his cromo say; else the slot's code)
    const byCode = fi >= 0 && hasFitData([id], sq, L);
    const w = byCode ? fitWord(logicGrade(L, sq, id, fi)) : "";
    const at = byCode ? slotName(L, fi) + (w ? " · " + w : "") : slotCode(L, fi);
    whoWhere = (p.pos ? p.pos + " natural" : "Sin posición") + (fi >= 0 ? " · juega de " + at : "");
  }

  const bars = formBars(p.form);
  const why = formWhy(sq, id);
  return {
    name: p.name,
    num: p.num,
    // the form chip: «—» before his first match
    rt: rtTxt(p),
    pos: home ?? p.pos ?? "—",
    gk: p.pos === "POR",
    // (who he is and where he plays in this seven — by the slot's name and how well he fits it for a
    // player with exact positions, «Pivote · juega de interior izquierdo · adaptado», else as it always
    // was, «MED natural · juega de MI» —; and why his form is what it is: «3 goles en sus 2 últimos»)
    sub: whoWhere + cv + (why !== "—" ? " · " + why : ""),
    st: [
      { k: "PARTIDOS", v: p.stats.played },
      { k: "GOLES", v: p.stats.goals },
      { k: "ASIST.", v: p.stats.assists },
      { k: "MINUTOS", v: knownMinutes(p.stats) === null ? "—" : wholeMinutes(p.stats.minutes) },
      { k: "TITULAR", v: p.stats.starts },
      { k: "MVP", v: p.stats.mvps },
    ],
    ...(bars.length ? { form: { k: "FORMA · " + bars[0].j + (bars.length > 1 ? "–" + bars[bars.length - 1].j : ""), bars } } : {}),
    facts,
    ln,
    ox,
    oy,
    side,
  };
}
