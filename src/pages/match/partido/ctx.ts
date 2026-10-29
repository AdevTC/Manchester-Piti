// «El partido»: what the page hands each screen — the match and its model at the moviola's minute, who is
// looking, the people named, and the page's verbs (go to a screen, open a sheet, move the moviola, say a line).
import type { ClubMatch } from "../../../lib/clubData";
import type { MvpResult } from "../../../lib/vestuario";
import type { Kit } from "../../../components/jersey3d/kitStill";
import type { Fase, Lineup, NumKind, Play, ResultWords, Score, Screen, Timeline } from "./model";

export type Sheet = "cartel" | "momento" | "avisos";

export interface Person {
  id: string;
  /** As a sentence names him: «Adrián T.C.». */
  name: string;
  /** The shirt's name: «ADRIÁN T.C.». */
  short: string;
  /** His number this season ("" without one). */
  num: string;
  first: string;
  last: string;
  /** His natural position: POR · DEF · MED · DEL. */
  pos: string;
}

export interface Viewer {
  member: boolean;
  admin: boolean;
  /** He keeps la mesa of this match (a designated scorer) or is an admin. */
  mesa: boolean;
  /** He is the designated scorer (not only an admin). */
  anotador: boolean;
  /** Linked to a player of the season's squad. */
  playerId: string | null;
  uid: string | null;
  /** His name for the page («Jordi»). */
  name: string;
}

export interface PageCtx {
  match: ClubMatch;
  /** The match's address: /partidos/<id>. */
  base: string;
  /** The kick-off (ms; NaN undated). */
  kickMs: number;
  /** «el CDM», for «el sol sobre el CDM». */
  venueShort: string;
  matches: ClubMatch[];
  now: number;
  fase: Fase;
  /** The moviola's minute (0 before the whistle). */
  minute: number;
  /** The live edge (the minute reached; the whole match once played). */
  edge: number;
  duration: number;
  pre: boolean;
  live: boolean;
  played: boolean;
  done: boolean;
  off: "aplazado" | "pendiente" | null;
  /** The moviola is held back from the edge. */
  dragged: boolean;
  plays: Play[];
  /** The score at the moviola's minute. */
  score: Score;
  result: ResultWords;
  lineup: Lineup;
  tl: Timeline;
  pulse: number[];
  nums: { kinds: NumKind[]; hits: { m: number; k: string; side: "us" | "them" }[]; narrated: boolean };
  /** The light of the moviola's minute: 0 golden … 1 floodlit. */
  floodAt: (m: number) => number;
  rival: string;
  rivalCode: string;
  /** The rival's escudo (rivalLogos: the newest acta against them that saved one). */
  rivalLogo?: string;
  jornada: number | null;
  kit: Kit;
  captain: string | null;
  people: Map<string, Person>;
  nameOf: (id: string) => string;
  numOf: (id: string) => string;
  viewer: Viewer;
  mvp: MvpResult | undefined;
  /** The season's matches still to play after this one, in order. */
  next: ClubMatch[];
  dia: boolean;
  screen: Screen;
  go: (s: Screen | "mesa") => void;
  open: (s: Sheet) => void;
  seek: (m: number) => void;
  say: (line: string) => void;
}
