// /profile «La carta»: the member's card built from real data. The rating is the pizarra cromo's
// (buildSquad / formRating over the same season), so the card and the cromo always show the same
// number. Also the six attributes, the tier, the LED videoboard text, the season series, the last five
// results, the partner and the evoluciones (design: stats-gen/pf-g.mjs + pf-e-data.mjs). Pure.
import { dateMillis, isCompleted } from "../../../functions/src/matchEngine";
import type { ClubMatch } from "../../lib/clubData";
import { chronological, playerGame } from "../../lib/clubAnalytics";
import { resultOf } from "../../lib/partidos";
import { bestPartner, mvpWinners, mvpWins, vitrina, type MvpResult } from "../../lib/vestuario";
import type { Zone } from "../pizarra/formations";
import type { Cromo, Squad } from "../pizarra/v2/model";
import { buildSquad, type SquadPlayer } from "../pizarra/v2/ratings";

const TZ = "Europe/Madrid";
const GOAL_TYPES = new Set(["goal", "goal_penalty", "goal_freekick"]);

export type FichaState = "vinculada" | "pendiente" | "sin-ficha";
export type Tier = "bronce" | "plata" | "oro" | "racha";
/** The tier chip: a real tier, or the card before it has numbers / before it exists. */
export type TierKey = Tier | "nuevo" | "down" | "pack";

export const POSITION_LONG: Record<Zone, string> = { POR: "Portero", DEF: "Defensa", MED: "Centrocampista", DEL: "Delantero" };
export const TIER_NAME: Record<TierKey, string> = {
  racha: "En racha",
  oro: "Oro",
  plata: "Plata",
  bronce: "Bronce",
  nuevo: "Por estrenar",
  down: "Por revelar",
  pack: "Sobre cerrado",
};
/** «Tipos de carta»: the four tiers and their rule. */
export const TIERS: { k: Tier; label: string; rule: string }[] = [
  { k: "bronce", label: "Bronce", rule: "Valoración menos de 65" },
  { k: "plata", label: "Plata", rule: "De 65 a 79" },
  { k: "oro", label: "Oro", rule: "80 o más" },
  { k: "racha", label: "En racha", rule: "G o A en las 3 últimas" },
];
export function tierOf(rating: number): Exclude<Tier, "racha"> {
  return rating >= 80 ? "oro" : rating >= 65 ? "plata" : "bronce";
}

export type AttrKey = "GOL" | "MVP" | "ASI" | "PJ" | "MIN" | "FOR";
/** The card's six numbers, in the design's order, with the copy of «Qué significa cada número». */
export const ATTRS: { k: AttrKey; label: string; d: string }[] = [
  { k: "GOL", label: "Goles", d: "Los que has marcado esta temporada" },
  { k: "MVP", label: "MVP", d: "Votaciones al mejor del partido que has ganado" },
  { k: "ASI", label: "Asistencias", d: "Pases tuyos que acabaron en gol" },
  { k: "PJ", label: "Partidos jugados", d: "Partidos en los que has salido al campo" },
  { k: "MIN", label: "Minutos", d: "Minutos jugados (un partido son 50′)" },
  { k: "FOR", label: "Forma", d: "Tus últimos 5 partidos: goles, asistencias y MVP, de 40 a 99" },
];
export interface Attr {
  k: AttrKey;
  label: string;
  d: string;
  /** null = no numbers yet (no ficha, or the season hasn't started): shown as «—». */
  value: number | null;
  text: string;
  /** Bar fill 0–1: against the best of the squad (PJ: the season's matches; FOR: out of 99). */
  p: number;
}

export interface Ticker {
  /** gold / amber / sky — the words always carry the state; colour only reinforces it. */
  tone: "ok" | "warn" | "off";
  /** Marquee text (ends with « ·» so the loop joins). */
  text: string;
  /** The same for screen readers («Videomarcador: …»), without the loop separator. */
  sr: string;
}

export interface SeriesPoint {
  j: number;
  label: string;
  goals: number;
  played: boolean;
  /** Bar height 0–1 (design: 3 goals = full, a played match at least 0.06, not played 0.03). */
  p: number;
}
export interface FormResult {
  r: "g" | "e" | "p";
  l: "G" | "E" | "P";
  j: string;
  aria: string;
}
export interface PartnerView {
  playerId: string;
  name: string;
  number: string;
  together: number;
  wins: number;
  /** Goals he scored with your pass / you scored with his. */
  fromYou: number;
  fromThem: number;
  combos: number;
  note: string;
}

export type EvoShape = "shield" | "circle" | "star" | "hex";
export interface Evo {
  id: "debut" | "goal" | "double" | "mvp" | "fijo" | "goleador" | "hat" | "duo";
  k: string;
  d: string;
  shape: EvoShape;
  goal: number;
  cur: number;
  done: boolean;
  /** 0–100. */
  pct: number;
  reward: string;
}

export interface CardInput {
  state: FichaState;
  /** The linked ficha (vinculada) or the requested one (pendiente). */
  playerId: string | null;
  nickname: string;
  /** Captain: armband on the card and «· CAPITÁN» on the board. */
  captain: boolean;
  /** The season's squad as the pizarra resolves it (shirt name and dorsal of the season); it must include the player. */
  squad: SquadPlayer[];
  /** Every club match (the evoluciones are for the whole career). */
  matches: ClubMatch[];
  seasonId: string;
  seasonName: string;
  seasons: { id: string; name: string }[];
  mvpResults: Map<string, MvpResult>;
  now: number;
}

export interface CardView {
  state: FichaState;
  /** The season has finished matches (else «temporada sin empezar»: numbers are «—»). */
  started: boolean;
  /** Numbers on the card: vinculada and the season started. */
  showNumbers: boolean;
  playerId: string | null;
  name: string;
  number: string;
  pos: Zone | null;
  posLong: string | null;
  captain: boolean;
  rating: number | null;
  ratingText: string;
  form: number | null;
  /** The real tier (null until there are numbers). */
  tier: Tier | null;
  tierKey: TierKey;
  tierName: string;
  tierWhy: string;
  racha: boolean;
  attrs: Attr[];
  totals: { played: number; goals: number; assists: number; minutes: number; mvps: number };
  ticker: Ticker;
  /** «MANCHESTER PITI · T1 · J1–J7» / «SE REVELA EN LA J1». */
  clubLine: string;
  series: SeriesPoint[];
  last5: FormResult[];
  goalRank: number | null;
  rankText: string;
  partner: PartnerView | null;
  evo: Evo[];
  nextEvo: (Evo & { text: string }) | null;
  /** The season's first match (for «Se revela en la J1…»). */
  first: { dateMs: number; rival: string } | null;
}

/** The season's matches in calendar order (as the pizarra numbers its jornadas). */
export function seasonCalendar(matches: ClubMatch[], seasonId: string): ClubMatch[] {
  return matches
    .filter((m) => seasonId === "all" || m.seasonId === seasonId)
    .slice()
    .sort((a, b) => (dateMillis(a.date) || 0) - (dateMillis(b.date) || 0) || a.id.localeCompare(b.id));
}

/** The pizarra's squad (cromos) for this season: the same call useBoardData makes. */
export function seasonSquad(squad: SquadPlayer[], matches: ClubMatch[], seasonId: string, mvpResults: Map<string, MvpResult>, now: number): { squad: Squad; calendar: ClubMatch[]; games: ClubMatch[]; jornada: Map<string, number> } {
  const calendar = seasonCalendar(matches, seasonId);
  const games = calendar.filter((m) => isCompleted(m));
  const jornada = new Map(calendar.map((m, i) => [m.id, i + 1]));
  const mvps = new Map<string, string[]>();
  games.forEach((m) => mvps.set(m.id, mvpWinners(m, mvpResults.get(m.id), now)));
  return { squad: buildSquad({ players: squad, games, jornada, suspended: new Set(), mvps }), calendar, games, jornada };
}

/** «T1» from «Temporada 1». */
export function seasonShort(name: string): string {
  const n = /(\d+)/.exec(name)?.[1];
  return n ? `T${n}` : name.toLocaleUpperCase("es");
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const ratio = (v: number, max: number) => (max > 0 ? clamp(v / max, 0, 1) : 0);

/** Forma (FOR): the last five matches of the season — 45 + G+A·5 + MVP·3 + played, from 40 to 99. */
export function formScore(playerId: string, games: ClubMatch[], mvps: (m: ClubMatch) => string[]): number {
  const last5 = games.slice(-5);
  let ga = 0, mv = 0, played = 0;
  for (const m of last5) {
    const g = playerGame(playerId, m);
    ga += g.ga;
    if (g.played) played++;
    if (mvps(m).includes(playerId)) mv++;
  }
  return clamp(45 + ga * 5 + mv * 3 + played, 40, 99);
}

/** «En racha»: a goal or an assist in each of the player's last three played jornadas. */
export function onStreak(playerId: string, games: ClubMatch[]): boolean {
  const last3 = games.map((m) => playerGame(playerId, m)).filter((g) => g.played).slice(-3);
  return last3.length === 3 && last3.every((g) => g.ga > 0);
}

/** The LED videoboard's line for each state (§2 of the design). */
export function tickerFor(s: { state: FichaState; name: string; number: string; posLong: string | null; captain: boolean; nickname: string }): Ticker {
  const nick = `@${s.nickname.toLocaleUpperCase("es")}`;
  const parts =
    s.state === "vinculada"
      ? ["¡YA ES OFICIAL!", s.name, s.number ? `DORSAL ${s.number}` : "", s.posLong ? s.posLong.toLocaleUpperCase("es") : "", s.captain ? "CAPITÁN" : ""]
      : s.state === "pendiente"
        ? ["FICHAJE EN TRÁMITE", s.number ? `${nick} PIDE EL ${s.number}` : `${nick} PIDE SU FICHA`, "EL CAPITÁN LO REVISA"]
        : ["SIN DORSAL TODAVÍA", nick, "RECLAMA TU FICHA"];
  const sr = parts.filter(Boolean).join(" · ");
  return { tone: s.state === "vinculada" ? "ok" : s.state === "pendiente" ? "warn" : "off", text: `${sr} ·`, sr };
}

const firstDate = (ms: number) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, day: "numeric", month: "long" }).format(ms);
export function tierWhy(key: TierKey, first: { dateMs: number; rival: string } | null): string {
  switch (key) {
    case "racha":
      return "Carta especial: has marcado o asistido en las 3 últimas jornadas.";
    case "oro":
      return "Valoración de 80 o más.";
    case "plata":
      return "Valoración de 65 a 79.";
    case "bronce":
      return "Valoración por debajo de 65.";
    case "nuevo":
      return first ? `Se revela en la J1, el ${firstDate(first.dateMs)} contra ${first.rival}.` : "Se revela con el primer partido de la temporada.";
    case "down":
      return "Elige tu dorsal y el capitán te la confirma.";
    case "pack":
      return "Esperando a que el capitán la abra.";
  }
}

/** The eight evoluciones of the design, with progress from the whole career (the medals stay). */
export function evoluciones(playerId: string | null, matches: ClubMatch[], results: Map<string, MvpResult>, seasons: { id: string; name: string }[], now: number): Evo[] {
  const id = playerId ?? "";
  const games = id ? chronological(matches) : [];
  const series = games.map((m) => playerGame(id, m));
  const played = series.filter((g) => g.played).length;
  const goals = series.reduce((s, g) => s + g.goals, 0);
  const maxG = Math.max(0, ...series.map((g) => g.goals));
  const mvps = id ? mvpWins(id, games, results, now) : 0;
  const pairs = new Map<string, number>();
  for (const m of games)
    for (const e of m.events ?? []) {
      if (!GOAL_TYPES.has(e.type) || !e.playerId || !e.assistPlayerId || e.playerId === e.assistPlayerId) continue;
      const other = e.playerId === id ? e.assistPlayerId : e.assistPlayerId === id ? e.playerId : null;
      if (other) pairs.set(other, (pairs.get(other) ?? 0) + 1);
    }
  const combos = Math.max(0, ...pairs.values());
  // The medals of the vitrina that are the same thing say whether it's done.
  const medals = new Map(vitrina(id, games, results, seasons, now).map((m) => [m.id, m.earned]));
  const rows: [Evo["id"], string, string, EvoShape, number, number, string, string | null][] = [
    ["debut", "Debut", "Juega tu primer partido", "shield", 1, played, "Tu carta entra en la colección", "debut"],
    ["goal", "Primer gol", "Marca tu primer gol", "circle", 1, goals, "Estela dorada en el nombre", "goal"],
    ["double", "Doblete", "2 goles en un partido", "circle", 2, maxG, "+1 de valoración", null],
    ["mvp", "MVP", "Gana una votación al MVP", "star", 1, mvps, "Estrella en la carta", "mvp"],
    ["fijo", "Fijo", "Juega 10 partidos", "shield", 10, played, "Marco «Fijo»", "ten"],
    ["goleador", "Goleador", "Llega a 10 goles", "circle", 10, goals, "Carta «Goleador» · +2", null],
    ["hat", "Hat-trick", "3 goles en un partido", "circle", 3, maxG, "Balón de oro en la carta", "hat"],
    ["duo", "Dúo", "10 goles combinados con el mismo compañero", "hex", 10, combos, "Carta dúo con tu socio", null],
  ];
  return rows.map(([eid, k, d, shape, goal, raw, reward, medal]) => {
    const cur = Math.min(raw, goal);
    const done = medal ? medals.get(medal) === true : raw >= goal;
    return { id: eid, k, d, shape, goal, cur, done, pct: Math.round((cur / goal) * 100), reward };
  });
}
/** «Próxima evolución»: the closest one still to do (the first of the list on a tie). */
export function nextEvolution(evo: Evo[], playing: boolean): (Evo & { text: string }) | null {
  const todo = evo.filter((e) => !e.done);
  if (!todo.length) return null;
  const best = playing ? todo.reduce((a, b) => (b.pct > a.pct ? b : a)) : todo[0];
  return { ...best, text: playing ? `Llevas ${best.cur} de ${best.goal} · faltan ${best.goal - best.cur}` : "Tu primer objetivo, en cuanto juegues" };
}

function partnerOf(me: string, games: ClubMatch[], squad: Squad): PartnerView | null {
  const p = bestPartner(me, games, squad.list.map((c) => c.id));
  if (!p) return null;
  const c = squad.byId.get(p.playerId);
  const combos = p.theirGoalsFromYou + p.yourGoalsFromThem;
  return {
    playerId: p.playerId,
    name: c?.name ?? "",
    number: c && c.num ? String(c.num) : "",
    together: p.together,
    wins: p.wins,
    fromYou: p.theirGoalsFromYou,
    fromThem: p.yourGoalsFromThem,
    combos,
    note: combos ? `${plural(combos, "gol", "goles")} entre los dos, con pase de uno al otro` : `${plural(p.together, "partido", "partidos")} juntos · aún sin goles combinados`,
  };
}

const EMPTY_TOTALS = { played: 0, goals: 0, assists: 0, minutes: 0, mvps: 0 };

export function buildCard(input: CardInput): CardView {
  const { state, playerId, captain, matches, seasonId, mvpResults, now } = input;
  const { squad, calendar, games, jornada } = seasonSquad(input.squad, matches, seasonId, mvpResults, now);
  const mvpsOf = (m: ClubMatch) => mvpWinners(m, mvpResults.get(m.id), now);
  const started = games.length > 0;
  const vinc = state === "vinculada";
  const me: Cromo | undefined = playerId ? squad.byId.get(playerId) : undefined;
  /** The cromo whose numbers the card shows (vinculada, season started). */
  const shown = vinc && started ? me : undefined;
  const showNumbers = !!shown;
  const pos = me?.pos ?? null;
  const posLong = pos ? POSITION_LONG[pos] : null;
  const name = me?.name ?? "";
  const number = me && me.num ? String(me.num) : "";

  const rating = shown ? shown.rt : null;
  const form = shown ? formScore(shown.id, games, mvpsOf) : null;
  const racha = !!shown && onStreak(shown.id, games);
  const tier: Tier | null = rating === null ? null : racha ? "racha" : tierOf(rating);
  const tierKey: TierKey = !vinc ? (state === "pendiente" ? "pack" : "down") : tier ?? "nuevo";
  const firstMatch = calendar[0];
  const first = firstMatch ? { dateMs: dateMillis(firstMatch.date), rival: firstMatch.rival || "el rival" } : null;

  const totals = shown ? { played: shown.stats.played, goals: shown.stats.goals, assists: shown.stats.assists, minutes: shown.stats.minutes, mvps: shown.stats.mvps } : EMPTY_TOTALS;
  const max = (k: "goals" | "assists" | "minutes" | "mvps") => Math.max(0, ...squad.list.map((c) => c.stats[k]));
  const values: Record<AttrKey, [number, number]> = {
    GOL: [totals.goals, ratio(totals.goals, max("goals"))],
    MVP: [totals.mvps, ratio(totals.mvps, max("mvps"))],
    ASI: [totals.assists, ratio(totals.assists, max("assists"))],
    PJ: [totals.played, ratio(totals.played, games.length)],
    MIN: [totals.minutes, ratio(totals.minutes, max("minutes"))],
    FOR: [form ?? 0, ratio(form ?? 0, 99)],
  };
  const attrs: Attr[] = ATTRS.map((a) => {
    const [v, p] = values[a.k];
    return { ...a, value: showNumbers ? v : null, text: showNumbers ? String(v) : "—", p: showNumbers ? p : 0 };
  });

  const js = games.map((m) => jornada.get(m.id) ?? 0);
  const clubLine = started ? `MANCHESTER PITI · ${seasonShort(input.seasonName)} · ${js.length > 1 ? `J${js[0]}–J${js[js.length - 1]}` : `J${js[0]}`}` : "SE REVELA EN LA J1";
  const series: SeriesPoint[] = playerId
    ? games.map((m) => {
        const g = playerGame(playerId, m);
        const j = jornada.get(m.id) ?? 0;
        return { j, label: `J${j}`, goals: g.goals, played: g.played, p: g.played ? Math.round(clamp(Math.max(0.06, g.goals / 3), 0, 1) * 100) / 100 : 0.03 };
      })
    : [];
  const RES = { G: ["g", "Victoria"], E: ["e", "Empate"], P: ["p", "Derrota"] } as const;
  const last5: FormResult[] = games.slice(-5).map((m) => {
    const l = resultOf(m);
    const j = `J${jornada.get(m.id) ?? 0}`;
    return { r: RES[l][0], l, j, aria: `${j}: ${RES[l][1]}` };
  });
  const goalRank = shown ? squad.list.filter((c) => c.stats.goals > shown.stats.goals).length + 1 : null;
  const rankText = !showNumbers
    ? ""
    : (totals.goals === 0 ? "Aún sin goles esta temporada" : goalRank === 1 ? "Máximo goleador del equipo" : `${goalRank}.º en goles del equipo`) +
      ` · ${plural(totals.goals, "gol", "goles")} en ${plural(totals.played, "partido", "partidos")}`;

  const evo = evoluciones(vinc ? playerId : null, matches, mvpResults, input.seasons, now);
  const ticker = tickerFor({ state, name, number, posLong, captain, nickname: input.nickname });
  return {
    state,
    started,
    showNumbers,
    playerId,
    name,
    number,
    pos,
    posLong,
    captain,
    rating,
    ratingText: rating === null ? "—" : String(rating),
    form,
    tier,
    tierKey,
    tierName: TIER_NAME[tierKey],
    tierWhy: tierWhy(tierKey, first),
    racha,
    attrs,
    totals,
    ticker,
    clubLine,
    series: vinc ? series : [],
    last5,
    goalRank,
    rankText,
    partner: shown ? partnerOf(shown.id, games, squad) : null,
    evo,
    nextEvo: nextEvolution(evo, vinc && evo.some((e) => e.cur > 0)),
    first,
  };
}
