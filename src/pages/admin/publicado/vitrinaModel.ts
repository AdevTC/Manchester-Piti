// The publish peak's content (pure, tested in vitrinaModel.test.ts), as on the canvas (stats-gen/ad-v2-full.mjs
// `publicado`, ad-v2-full-logic.js «Publish peak»): the plaque «V · J8 · MAD SKY 2–1 · 8 nov · fuera», the
// seven shirts with their stickers (goals, cards), the season's shelf «Vitrina T1» (published actas as
// V/E/D, unpublished ones as a gap, this one popping in), the cartel's scorers and the MVP line.
import { dateMillis, type MatchEvent } from "../../../../functions/src/matchEngine";
import { scoreOf } from "../../../lib/partidos";
import { jLabel, type AdminMatch } from "../data/adminLogic";
import { isPublishedFinal, matchMoment } from "../data/moments";
import { resultLetter, resultWord, type ResultLetter } from "../kit/result";
import type { Sticker } from "../kit/ShirtBack";
import { dayOf, whereOf } from "../partidos/listModel";
import { closesWords, voteCloses } from "../partidos/workspaceModel";

export interface VitrinaShirt {
  id: string;
  num: string;
  name: string;
  stickers: Sticker[];
}
export interface ShelfItem {
  id: string;
  /** null = an acta not published yet (a gap). */
  r: ResultLetter | null;
  /** This match: it pops in. */
  fresh: boolean;
  aria: string;
}
export interface VitrinaView {
  j: string;
  rival: string;
  gf: number;
  ga: number;
  r: ResultLetter;
  /** «8 nov». */
  date: string;
  /** «fuera» / «en casa». */
  where: string;
  seven: VitrinaShirt[];
  /** «Vitrina T1». */
  shelfLabel: string;
  shelf: ShelfItem[];
  /** «ERIK y ADRIÁN T.C.» (unique, in scoring order). */
  scorers: string;
  mvp: { title: string; detail: string };
}
export interface VitrinaInput {
  match: AdminMatch;
  /** Every match (the shelf takes the match's season). */
  matches: readonly AdminMatch[];
  seasonName: string;
  now: number;
  whistled: ReadonlySet<string>;
  nameOf: (id: string) => string;
  numberOf: (id: string) => string;
  /** The MVP once the vote has closed («Ganó ERIK con 6 votos»). */
  closedMvp?: string;
}

const GOALS = new Set(["goal", "goal_penalty", "goal_freekick"]);
/** The stickers a player earned in the match (a ball per goal, a card per booking). */
export function stickersOf(id: string, events: readonly MatchEvent[]): Sticker[] {
  const out: Sticker[] = [];
  for (const e of events) {
    if (e.playerId !== id) continue;
    if (GOALS.has(e.type)) out.push("goal");
    else if (e.type === "yellow_card") out.push("yellow");
    else if (e.type === "double_yellow" || e.type === "red_card") out.push("red");
  }
  return out;
}
const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
/** «Vitrina T1» from «Temporada 1»; any other name as it is. */
export const shelfLabelOf = (seasonName: string) => {
  const m = /temporada\s+(\d+)/i.exec(seasonName);
  return `Vitrina ${m ? `T${m[1]}` : seasonName}`;
};

export function vitrinaOf(o: VitrinaInput): VitrinaView {
  const { match } = o;
  const { gf, ga } = scoreOf(match);
  const r = resultLetter(gf, ga);
  const events = match.events ?? [];
  const t = dateMillis(match.date);
  const seven = (match.starters ?? []).map((id) => ({ id, num: o.numberOf(id), name: o.nameOf(id), stickers: stickersOf(id, events) }));
  const season = o.matches
    .filter((m) => m.seasonId === match.seasonId && m.status !== "cancelled" && m.status !== "postponed")
    .filter((m) => m.id === match.id || (dateMillis(m.date) <= t && matchMoment(m, o.now, o.whistled.has(m.id)) !== "antes"))
    .sort((a, b) => dateMillis(a.date) - dateMillis(b.date));
  const shelf = season.map((m): ShelfItem => {
    const j = jLabel(m);
    if (m.id !== match.id && !isPublishedFinal(m)) return { id: m.id, r: null, fresh: false, aria: `${j} sin publicar` };
    const s = scoreOf(m);
    const letter = resultLetter(s.gf, s.ga);
    return { id: m.id, r: letter, fresh: m.id === match.id, aria: `${j} ${resultWord(letter).toLowerCase()}` };
  });
  const scorers = andList([...new Set(events.filter((e) => GOALS.has(e.type) && e.playerId).map((e) => o.nameOf(e.playerId as string)))]);
  const closes = voteCloses(match.voteClosesAt, o.now);
  const mvp =
    closes > o.now
      ? { title: "MVP abierto · 48 h", detail: `Votan los socios hasta ${closesWords(closes)}` }
      : { title: "MVP cerrado", detail: o.closedMvp ?? "La votación ya terminó" };
  return {
    j: jLabel(match),
    rival: match.rival?.trim() || "Rival",
    gf,
    ga,
    r,
    date: dayOf(t),
    where: whereOf(match),
    seven,
    shelfLabel: shelfLabelOf(o.seasonName),
    shelf,
    scorers,
    mvp,
  };
}
