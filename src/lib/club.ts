// Pure logic of the Celeste "El club" page (Design canvas "El club · elegida"): the history train,
// the squad in numbers, the classified ads (contact) and the sponsors' wall (the map link: derived/venue). The
// trophy room reuses clubMedals (lib/home.ts).
import { ageOn } from "./clubAnalytics";
import { dateMillis, isCompleted, type ClubMatch } from "./clubData";
import { LINES, LINE_NAMES, POS_CODES, resolvePositions, type Line, type PosCode } from "./positions";
import type { ClubContent } from "./clubContentDefaults";
import type { ClubMedal } from "./home";
import { isGuestId } from "./derived/guests";
import { OURS } from "./partidos";

export const mailto = (email: string, subject: string) => `mailto:${email}?subject=${encodeURIComponent(subject)}`;

export interface TrainStop {
  key: string;
  year: string;
  title: string;
  text: string;
  /** The automatic stop: the oldest finished match of the archive. */
  match?: ClubMatch;
}
/** The admin's moments (in their order) and, last, the first match of the archive. */
export function historyTrain(milestones: ClubContent["milestones"], matches: ClubMatch[]): TrainStop[] {
  const stops: TrainStop[] = (milestones ?? []).filter((m) => m && (m.title || m.year || m.text)).map((m, i) => ({ key: `m${i}`, year: m.year, title: m.title, text: m.text }));
  const oldest = matches.filter(isCompleted).sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0];
  if (oldest) stops.push({ key: "first", year: String(new Date(dateMillis(oldest.date)).getFullYear()), title: "El primer partido de nuestro archivo", text: "", match: oldest });
  return stops;
}

export interface SquadNumbersInput {
  id: string;
  naturalPosition?: string;
  positions?: unknown;
  birthDate?: string;
}
/** Size, players per line (unknown positions apart) and average age of a squad. */
export function squadNumbers(players: SquadNumbersInput[], today: Date) {
  const byZone = Object.fromEntries(LINES.map((l) => [l, 0])) as Record<Line, number>;
  let other = 0;
  for (const p of players) {
    const z = resolvePositions(p).line;
    if (z) byZone[z]++;
    else other++;
  }
  const ages = players.map((p) => ageOn(p.birthDate, today)).filter((a): a is number => a !== null);
  return {
    size: players.length,
    byZone,
    other,
    averageAge: ages.length ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : null,
    agesKnown: ages.length,
  };
}

export interface PosCount {
  /** Players whose preferida is this position. */
  main: number;
  /** Players who list it in «también». */
  also: number;
}
/** The squad by exact position: per code, how many have it as their preferida and how many more list it in
 *  «también»; `none` = players with no exact position (no preferida, no también), and `lineOnly` the line of
 *  each of them whose old ficha still says one («Defensa»: resolvePositions gives the line, no code). */
export function squadByPosition(players: readonly Pick<SquadNumbersInput, "id" | "naturalPosition" | "positions">[]): { byCode: Record<PosCode, PosCount>; none: number; lineOnly: Line[]; total: number } {
  const byCode = Object.fromEntries(POS_CODES.map((c) => [c, { main: 0, also: 0 }])) as Record<PosCode, PosCount>;
  let none = 0;
  const lineOnly: Line[] = [];
  for (const p of players) {
    const r = resolvePositions(p);
    if (r.main) byCode[r.main].main++;
    for (const c of r.also) byCode[c].also++;
    if (!r.main && !r.also.length) {
      none++;
      if (r.line) lineOnly.push(r.line);
    }
  }
  return { byCode, none, lineOnly, total: players.length };
}
/** The «Sin posición exacta» card: its heading and sentence. A ficha that still says only its line is told
 *  apart («(2 con solo su línea: defensa, medio)»), never as one that doesn't say where he plays. */
export function noPositionText(none: number, lineOnly: readonly Line[]): { title: string; text: string } {
  if (!none) return { title: "Todos con posición", text: "Todos tienen su sitio en el campo." };
  const title = `Sin posición exacta: ${none}`;
  if (!lineOnly.length) return { title, text: none === 1 ? "Su ficha aún no dice dónde juega." : "Sus fichas aún no dicen dónde juegan." };
  const lines = LINES.filter((l) => lineOnly.includes(l)).map((l) => LINE_NAMES[l].short.toLocaleLowerCase("es"));
  const blank = none - lineOnly.length;
  return { title, text: `(${lineOnly.length} con solo su línea: ${lines.join(", ")})${blank > 0 ? ` · ${blank} aún sin posición en su ficha.` : ""}` };
}
/** «MC 3 · +2» (the «+N» of también only when there are some). */
export const posCountText = (code: PosCode, n: PosCount): string => `${code} ${n.main}${n.also ? ` · +${n.also}` : ""}`;
/** The legend's key, read from the data: the position with the most players (preferida + también; ties in
 *  catalogue order), its chip and what its numbers mean, singular/plural right. Nobody placed yet: a
 *  neutral, symbolic key. `pref`: its chip looks like a preferida one (gold) on the pitch. */
export function posKey(byCode: Record<PosCode, PosCount>): { chip: string; text: string; pref: boolean } {
  const code = POS_CODES.reduce<PosCode | null>((best, c) => {
    const t = byCode[c].main + byCode[c].also;
    return t > 0 && (!best || t > byCode[best].main + byCode[best].also) ? c : best;
  }, null);
  if (!code) return { chip: "POS n · +m", text: "n la tienen de preferida y m más la marcan en «también».", pref: true };
  const { main, also } = byCode[code];
  const tienen = main === 1 ? "la tiene" : "la tienen";
  const marcan = also === 1 ? "la marca" : "la marcan";
  const text = !main ? `Nadie la tiene de preferida; ${also} ${marcan} en «también».` : also ? `${main} ${tienen} de preferida y ${also} más ${marcan} en «también».` : `${main} ${tienen} de preferida.`;
  return { chip: posCountText(code, byCode[code]), text, pref: main > 0 };
}

export interface Ad {
  id: "rival" | "player" | "patron";
  wanted: string;
  title: string;
  text: string;
  href?: string;
}
/** The three ways to get in touch, as classified ads; no email yet → no link. */
export function classifieds(email: string): Ad[] {
  const ads: Omit<Ad, "href">[] = [
    { id: "rival", wanted: "SE BUSCA RIVAL", title: "Un amistoso", text: "¿Buscáis rival? Nos vemos en el campo." },
    { id: "player", wanted: "SE BUSCA JUGADOR", title: "Un lugar en el equipo", text: "Si quieres jugar con nosotros, nos encantará conocerte." },
    { id: "patron", wanted: "SE BUSCAN MECENAS", title: "Juega de nuestro lado", text: "Colabora con el equipo y acompáñanos durante la temporada." },
  ];
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return ads.map((a) => ({ ...a, ...(ok ? { href: mailto(email.trim(), a.title) } : {}) }));
}

/** Sponsors with a name, safe https links only. */
export function sponsorWall(sponsors: ClubContent["sponsors"]) {
  const https = (u: string) => (/^https:\/\//.test(u ?? "") ? u : undefined);
  return (sponsors ?? []).filter((s) => s && s.name).map((s) => ({ name: s.name, url: https(s.url), logo: https(s.logo) }));
}

/** Two more pieces for the trophy room: the first hat-trick and the first clean sheet of the season. */
export function extraTrophies(played: ClubMatch[], nameOf: (id: string) => string): ClubMedal[] {
  let hat: { match: ClubMatch; playerId: string } | undefined;
  for (const m of played) {
    const goals = new Map<string, number>();
    for (const e of m.events ?? []) if (OURS.has(e.type) && e.type !== "opponent_own_goal" && e.playerId && !isGuestId(e.playerId)) goals.set(e.playerId, (goals.get(e.playerId) ?? 0) + 1);
    const who = [...goals.entries()].find(([, n]) => n >= 3);
    if (who) {
      hat = { match: m, playerId: who[0] };
      break;
    }
  }
  const clean = played.find((m) => m.goalsAgainst === 0);
  return [
    { id: "hat", kicker: "Hat-trick", title: hat ? nameOf(hat.playerId) : "Por firmar", detail: hat ? `ante ${hat.match.rival ?? "el rival"}` : "tres goles en un partido", earned: !!hat, tone: "gold" },
    { id: "clean", kicker: "Portería a cero", title: clean ? `${clean.goalsFor}–0` : "Por cerrar", detail: clean ? `ante ${clean.rival ?? "el rival"}` : "un partido sin encajar", earned: !!clean, tone: "sky" },
  ];
}
