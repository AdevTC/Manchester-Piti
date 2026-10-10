// La pizarra «Noche de partido» — the boards around the one on screen: names (validated, unique per
// owner and season, copies and new ones numbered), the line under each board in the list, which board
// is the official for a match, the match a board is linked to (with its result band) and the
// convocatoria of that match on the cromos. Pure.
import type { Lineup } from "../formations";
import type { LineupDoc } from "../lineupDoc";
import { ago } from "./view";
import { chem } from "./quimica";
import type { Convocatoria, Squad } from "./model";

export const NAME_MAX = 40;

/** A name as it is stored: trimmed, single spaces. */
export const cleanName = (s: string): string => s.replace(/\s+/g, " ").trim();

const fold = (s: string): string =>
  cleanName(s)
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Why a name can't be used (null = it can): empty, too long, or another of your boards has it. */
export function nameError(name: string, taken: { id: string; name: string }[], selfId: string | null): string | null {
  const n = cleanName(name);
  if (!n) return "Ponle un nombre al tablero";
  if (n.length > NAME_MAX) return "Máximo " + NAME_MAX + " caracteres";
  const f = fold(n);
  if (taken.some((b) => b.id !== selfId && fold(b.name) === f)) return "Ya tienes un tablero con ese nombre";
  return null;
}

/** `base`, or «base 2», «base 3»… the first one not taken (always within NAME_MAX). */
export function uniqueName(base: string, taken: string[]): string {
  const used = new Set(taken.map(fold));
  const b = cleanName(base) || "Tablero";
  for (let k = 1; k < 1000; k++) {
    const suffix = k === 1 ? "" : " " + k;
    const name = b.slice(0, NAME_MAX - suffix.length).trimEnd() + suffix;
    if (!used.has(fold(name))) return name;
  }
  return b.slice(0, NAME_MAX);
}

/** The name of a copy: «Copia del oficial» for the official, «X (copia)» for the rest. */
export const copyName = (name: string, official: boolean, taken: string[]): string =>
  uniqueName(official ? "Copia del oficial" : cleanName(name).slice(0, NAME_MAX - 8).trimEnd() + " (copia)", taken);

/** «2-3-1 · 76 de química · ahora». */
export function boardMeta(L: Lineup, sq: Squad, at: number | null, now: number): string {
  return (L.freeMode ? "Libre" : L.formation) + " · " + chem(L, sq).v + " de química · " + ago(at, now);
}

/** The official for a match: the one published for that match, else the one for the whole season. */
export function officialFor(officials: LineupDoc[], matchId: string | null): LineupDoc | null {
  const newest = (ds: LineupDoc[]) => ds.slice().sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0] ?? null;
  return (matchId ? newest(officials.filter((d) => d.isOfficial && d.matchId === matchId)) : null) ?? newest(officials.filter((d) => d.isOfficial && !d.matchId));
}

// ── matches ──
export interface CalMatch {
  id: string;
  /** Jornada: the match's order in the season calendar. */
  j: number;
  rival: string;
  dateMs: number;
  played: boolean;
  /** Goals for / against once played. */
  gf: number | null;
  ga: number | null;
  home: boolean | null;
  venue: string;
  /** The match's one convocatoria (the admin's Convocar): el siete and the banquillo. Absent = not read. */
  conv?: { starters: string[]; bench: string[] };
}

/** «J8 · MAD SKY», with the score once played: «J8 · MAD SKY · 3–1». */
export const matchLabel = (m: CalMatch): string => "J" + m.j + " · " + m.rival + (m.played && m.gf != null && m.ga != null ? " · " + m.gf + "–" + m.ga : "");
export const matchShort = (m: CalMatch): string => "J" + m.j + " · " + m.rival;

const dayFmt = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
/** «sáb 8 nov» (empty without a date). */
export const matchDay = (ms: number): string => (ms ? dayFmt.format(new Date(ms)).replace(/,/g, "") : "");
/** «12:00» (empty without a date). */
export const matchTime = (ms: number): string => (ms ? timeFmt.format(new Date(ms)) : "");

export interface Band {
  /** g = victoria, e = empate, p = derrota, f = por jugar (and no match). */
  r: "g" | "e" | "p" | "f";
  letter: string;
  title: string;
  sub: string;
}

/** The result band of the linked match: V / E / D once played, «·» while it is to be played. */
export function matchBand(m: CalMatch | null): Band {
  if (!m) return { r: "f", letter: "·", title: "Sin partido vinculado", sub: "Elige uno arriba: el tablero lleva su nombre y su convocatoria." };
  const where = m.home == null ? m.venue : (m.home ? "En casa" : "Fuera") + (m.venue ? " · " + m.venue : "");
  const sub = ["J" + m.j, matchDay(m.dateMs), m.dateMs ? timeFmt.format(new Date(m.dateMs)) : "", where].filter(Boolean).join(" · ");
  if (!m.played || m.gf == null || m.ga == null) return { r: "f", letter: "·", title: "Por jugar · " + m.rival, sub };
  const r = m.gf > m.ga ? "g" : m.gf === m.ga ? "e" : "p";
  const word = r === "g" ? "Victoria" : r === "e" ? "Empate" : "Derrota";
  return { r, letter: r === "g" ? "V" : r === "e" ? "E" : "D", title: word + " · " + m.gf + "–" + m.ga + " · " + m.rival, sub };
}

// ── convocatoria ──
export interface Answer {
  response: "yes" | "no" | "maybe";
  playerId: string | null;
}
const CV: Record<Answer["response"], Convocatoria> = { yes: "voy", maybe: "duda", no: "no" };
const WORST: Record<Convocatoria, number> = { voy: 0, duda: 1, no: 2 };

/** The members' answers by player (only members linked to a ficha count; if two answer for the same
 *  ficha, the most cautious answer wins). */
export function convocatoriaOf(answers: Answer[]): Map<string, Convocatoria> {
  const out = new Map<string, Convocatoria>();
  answers.forEach((a) => {
    const cv = CV[a.response];
    if (!a.playerId || !cv) return;
    const prev = out.get(a.playerId);
    if (!prev || WORST[cv] > WORST[prev]) out.set(a.playerId, cv);
  });
  return out;
}

/** The squad with each cromo's answer (no answers = nobody carries one). */
export function withConvocatoria(sq: Squad, conv: Map<string, Convocatoria> | null): Squad {
  if (!conv?.size && !sq.list.some((c) => c.cv)) return sq;
  const list = sq.list.map((c) => ({ ...c, cv: conv?.get(c.id) }));
  return { ...sq, list, byId: new Map(list.map((c) => [c.id, c])) };
}

export interface ConvCounts {
  voy: number;
  duda: number;
  no: number;
  /** Squad players with no answer. */
  sin: number;
}
export function convCounts(sq: Squad): ConvCounts {
  const n: ConvCounts = { voy: 0, duda: 0, no: 0, sin: 0 };
  sq.list.forEach((c) => {
    if (c.cv) n[c.cv]++;
    else n.sin++;
  });
  return n;
}

/**
 * Publishing the official for a match whose pitch is not the convocatoria's siete: the convocatoria with
 * this siete (the banquillo keeps its order; whoever leaves the siete stays called, on the banquillo) — or
 * null when it already is that siete (or the convocatoria is not known).
 */
export function convocatoriaFromBoard(conv: { starters: readonly string[]; bench: readonly string[] } | undefined, seven: readonly (string | null)[]): { starters: string[]; bench: string[] } | null {
  if (!conv) return null;
  const s = seven.filter((id): id is string => !!id);
  if (s.length === conv.starters.length && s.every((id) => conv.starters.includes(id))) return null;
  const out = (id: string) => !s.includes(id);
  return { starters: s, bench: [...conv.bench.filter(out), ...conv.starters.filter((id) => out(id) && !conv.bench.includes(id))] };
}

/** The link to a board (`#charla` = straight to its charla). */
export function boardLink(origin: string, id: string, charla = false): string {
  return origin + "/pizarra?tablero=" + encodeURIComponent(id) + (charla ? "#charla" : "");
}
