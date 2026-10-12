// La pizarra «Noche de partido» — the ficha's back: what a player brings to this seven, from real data
// only. The season line (partidos, goles, asistencias, minutos, titular, MVP); his form over the last
// matches as small bars (minutes per match, with goals + assists said in words); his minutes against
// the team's; where he plays («Jugar de») and his natural line; the galones he wears; whether he goes to
// the board's match; and his química links in this seven. Pure.
import type { ClubMatch } from "../../../lib/clubData";
import { playerGame } from "../../../lib/clubAnalytics";
import type { Lineup } from "../formations";
import { normZone } from "../positions";
import { availTxt, type CharlaMatch } from "./charla";
import { slotLabel } from "./geometry";
import { galonesOf, type FormGame, type Squad } from "./model";
import type { Chem } from "./quimica";
import { plural } from "./plural";
import type { FichaView } from "./Overlays";

/** How many of the last matches the form bars show. */
export const FORM_GAMES = 5;
const DEFAULT_DURATION = 50;

/** A player's last `n` matches of `games` (the season's finished ones, oldest first), oldest first. */
export function formGames(playerId: string, games: readonly ClubMatch[], jornada: ReadonlyMap<string, number>, n = FORM_GAMES): FormGame[] {
  return games.slice(-n).map((m, k) => {
    const g = playerGame(playerId, m);
    const min = g.minutes ?? (g.played ? (typeof m.duration === "number" && m.duration > 0 ? m.duration : DEFAULT_DURATION) : 0);
    return { j: jornada.get(m.id) ?? games.length - Math.min(n, games.length) + k + 1, played: g.played, min, ga: g.ga };
  });
}

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
  const top = Math.max(1, ...form.map((g) => g.min));
  return form.map((g) => ({
    j: "J" + g.j,
    h: g.played ? Math.max(12, Math.round((g.min / top) * 100)) : 0,
    played: g.played,
    t: "J" + g.j + ": " + (g.played ? g.min + "′" + (g.ga ? " y " + plural(g.ga, "gol o asistencia", "goles o asistencias") : "") : "no jugó"),
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
    .map((l) => ({ k: "con " + nm(l.a === id ? l.b : l.a) + (l.tog ? " · " + plural(l.tog, "partido") : ""), v: l.t === 3 ? "++" : l.t === 2 ? "+" : "–" }));
  if (fi < 0) ln = [{ k: p.baja ? p.baja + ": no disponible" : "En el banquillo", v: "" }];
  else if (!ln.length) ln = [{ k: "Sin vecinos cerca en este siete", v: "" }];
  const cv = p.cv === "voy" ? " · Voy" : p.cv === "duda" ? " · Duda" : p.cv === "no" ? " · No va" : "";

  // the facts: minutes against the team's, where he plays, galones, the match
  const facts: { k: string; v: string }[] = [];
  // the team's minutes: everyone's added up over the seven on the pitch
  const teamMin = sq.list.reduce((s, c) => s + c.stats.minutes, 0) / 7;
  if (p.stats.minutes > 0 && teamMin > 0) facts.push({ k: "Minutos", v: p.stats.minutes + "′ · " + Math.min(100, Math.round((p.stats.minutes / teamMin) * 100)) + " % del equipo" });
  else facts.push({ k: "Minutos", v: "Aún sin minutos" });
  const jugar = normZone(L.playerPositions[id]);
  facts.push({ k: "Posición", v: jugar && jugar !== p.pos ? "Juega de " + jugar + (p.pos ? " · natural " + p.pos : "") : p.pos ? p.pos + " natural" : "Sin posición natural" });
  const gal = galonesOf(L, id);
  facts.push({ k: "Galones", v: gal.length ? gal.map((g) => g.label).join(" · ") : "Ninguno" });
  if (match) {
    const called = match.called ? (match.called.includes(id) ? "Convocado" : "No convocado") : "";
    facts.push({ k: match.j ?? "Partido", v: [called, availTxt(p)].filter(Boolean).join(" · ").replace(/^./, (c) => c.toLocaleUpperCase("es")) });
  }

  const bars = formBars(p.form);
  return {
    name: p.name,
    num: p.num,
    rt: p.rt,
    pos: p.pos ?? "—",
    gk: p.pos === "POR",
    sub: (p.pos ? p.pos + " natural" : "Sin posición") + (fi >= 0 ? " · juega de " + slotLabel(L, fi) : "") + cv,
    st: [
      { k: "PARTIDOS", v: p.stats.played },
      { k: "GOLES", v: p.stats.goals },
      { k: "ASIST.", v: p.stats.assists },
      { k: "MINUTOS", v: p.stats.minutes },
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
