// «El palco» · Rivales and two of the sheets, as the prototype computes them (Numeros.dc.html `rivales()`, `search()`
// and the scope sheet `sc` of `renderVals()`), on the app's view model: the next rival (or today's), the list with
// its bars and letters, the chosen rival's dossier; «Qué números ver» with the filters adding up (the prototype
// could hold one at a time); «Busca o pregunta» grouped by kind and the questions by place.
import type { IconName } from "./icons";
import { initials, norm } from "./num";
import { PLACES, type Act, type NuState, type Place, type Section } from "../numeros/view";

// ———————————————————————————— Rivales

export interface RivLetter {
  key: string;
  l: string;
  cls: string;
}
export interface RivRowIn {
  key: string;
  rival: string;
  ini: string;
  logo?: string;
  pj: number;
  rec: string;
  gf: number;
  gc: number;
  letters: RivLetter[];
  /** «J5 · 3 nov» (empty for the one being played). */
  next: string;
  nextJ: number | null;
  /** «J5 · 3 nov, 18:00», «Hoy, en directo». */
  nextLong: string;
  /** «Hoy, en directo» while we play them. */
  live: string;
  on: boolean;
}
export interface RivGameIn {
  key: string;
  j: string;
  day: string;
  res: string;
  cls: string;
  where: string;
  who: string;
  live: boolean;
  href: string;
}
export interface DossierIn {
  rival: string;
  ini: string;
  logo?: string;
  rec: string;
  games: RivGameIn[];
  scorers: string;
  big: string;
  first: string;
  next: string;
  noGames: boolean;
}
export interface RivalesIn {
  kick: string;
  title: string;
  sub: string;
  q: string;
  /** The searched ones. */
  rows: RivRowIn[];
  /** Every rival of the period. */
  all: RivRowIn[];
  d: DossierIn;
}

/** A rival's badge: its escudo when an acta saved one, its initials otherwise (and when the escudo stops loading). */
export const crest = (rival: string, logo: string | undefined, ini?: string) => ({ logo: logo || undefined, hasLogo: !!logo, ini: ini || initials(rival) });

/** The card on top: the rival we are playing right now, else the nearest jornada still to play; none at the end. */
export function nextRival(all: readonly RivRowIn[]): RivRowIn | null {
  const live = all.find((r) => r.live);
  if (live) return live;
  return (
    all
      .filter((r) => r.nextJ != null)
      .slice()
      .sort((a, b) => (a.nextJ ?? 0) - (b.nextJ ?? 0))[0] ?? null
  );
}

export function rivalesView(R: RivalesIn, act: Pick<Act, "set">) {
  const nx = nextRival(R.all);
  const maxG = Math.max(1, ...R.all.map((r) => Math.max(r.gf, r.gc)));
  const pick = (rival: string) => act.set({ rival });
  return {
    kick: R.kick,
    title: R.title,
    sub: R.sub,
    q: R.q,
    setQ: (q: string) => act.set({ rq: q }),
    next: nx
      ? {
          rival: nx.rival,
          ...crest(nx.rival, nx.logo, nx.ini),
          k: nx.live ? "Hoy, en juego" : "El próximo rival",
          s: [nx.live || nx.nextLong || nx.next, nx.pj ? `Nuestro historial: ${nx.rec}` : "Aún sin jugar contra ellos"].filter(Boolean).join(" · "),
          pick: () => pick(nx.rival),
        }
      : null,
    rows: R.rows.map((r) => ({
      key: r.key,
      rival: r.rival,
      ...crest(r.rival, r.logo, r.ini),
      rec: r.rec,
      letters: r.letters.slice(-6),
      played: r.pj > 0,
      gfW: Math.round((r.gf / maxG) * 100),
      gcW: Math.round((r.gc / maxG) * 100),
      next: r.next,
      now: r.live,
      on: r.on,
      pick: () => pick(r.rival),
    })),
    empty: R.rows.length === 0,
    d: { ...R.d, ...crest(R.d.rival, R.d.logo, R.d.ini) },
  };
}
export type RivalesV = ReturnType<typeof rivalesView>;

// ———————————————————————————— «Qué números ver»

export interface ScopeOpt {
  t: string;
  on: boolean;
  pick: () => void;
}
export interface ScopeIn {
  scope: {
    seasonOpts: ScopeOpt[];
    seasonI: number;
    campoOpts: ScopeOpt[];
    campoI: number;
    matches: (ScopeOpt & { key: string; s: string })[];
    people: (ScopeOpt & { key: string; n: number | "" })[];
    jornadas: { key: string; j: number; letter: string; label: string }[];
    hasOthers: boolean;
    players: boolean;
    count: string;
    clear: () => void;
  };
  time: { off: boolean; offNote: string };
  upto: number;
  edge: number;
}

/** Each group shows its own choice and they add up: the season, up to which jornada, where, the matches, the players. */
export function scopeView(v: ScopeIn, st: Pick<NuState, "replay">, act: Pick<Act, "set">) {
  const S = v.scope;
  const season = S.hasOthers ? S.seasonOpts : S.seasonOpts.slice(0, 1);
  const today = !st.replay && v.upto >= v.edge;
  const js = [
    { key: "hoy", t: "Al día", letter: "", cls: "", aria: "Al día", on: today, pick: () => act.set({ upto: Number.POSITIVE_INFINITY, replay: false, playing: false }) },
    ...S.jornadas.map((x) => ({
      key: x.key,
      t: `J${x.j}`,
      letter: x.letter,
      cls: x.letter === "G" ? "is-g" : x.letter === "P" ? "is-p" : "",
      // the result in words too («Hasta la J3, Ganamos 3–1 contra…»): the colour is not the only sign
      aria: `Hasta la ${x.label}`,
      on: !st.replay && v.upto === x.j && v.upto < v.edge,
      pick: () => act.set({ upto: x.j, replay: false, playing: false }),
    })),
  ];
  const nOn = [S.seasonI === 1, !today && !v.time.off, S.campoI > 0, S.matches.some((m) => m.on), S.people.some((p) => p.on)].filter(Boolean).length;
  return {
    season,
    seasonI: S.hasOthers ? S.seasonI : 0,
    jOff: v.time.off,
    jOffNote: v.time.offNote,
    js,
    where: S.campoOpts,
    whereI: S.campoI,
    matches: S.matches,
    people: S.people,
    players: S.players,
    count: S.count,
    /** How many of the five groups cut the numbers now. */
    nOn,
    clear: S.clear,
  };
}
export type ScopeV = ReturnType<typeof scopeView>;

// ———————————————————————————— «Busca o pregunta»

/** Where each round-3 section's questions are asked now: El campo in Jugadores, Récords in Temporada. */
export const SEARCH_PLACE: Record<Section, Place> = { temporada: "temporada", records: "temporada", jugadores: "jugadores", campo: "jugadores", juego: "juego", rivales: "rivales" };
export const PLACE_T: Record<Place, string> = {
  temporada: "Preguntas sobre la temporada",
  jugadores: "Preguntas sobre los jugadores",
  juego: "Preguntas sobre el juego",
  rivales: "Preguntas sobre los rivales",
};

export interface SearchResIn {
  key: string;
  kind: "player" | "rival" | "ask" | "rank" | "screen" | "stat";
  name: string;
  n: number | string | "";
  detail: string;
  go: () => void;
}
export interface AskIn {
  key: string;
  t: string;
  place: Section;
  go: () => void;
}
export interface SearchIn {
  res: SearchResIn[];
  all: AskIn[];
}
export interface SearchItem {
  key: string;
  t: string;
  s: string;
  /** The shirt's dorsal (players). */
  n: number | string | "";
  shirt: boolean;
  ic: IconName | null;
  go: () => void;
}
export interface SearchGroup {
  key: string;
  t: string;
  items: SearchItem[];
}

const KIND_GROUP: [SearchResIn["kind"], string, IconName | null][] = [
  ["player", "Jugadores", null],
  ["rival", "Rivales", "shield"],
  ["stat", "Estadísticas", "book"],
  ["rank", "Rankings", "chart"],
];

/** The results by kind (what the words find), then every question that matches, grouped by the place that answers it. */
export function searchView(s: SearchIn, sq: string) {
  const qn = norm(sq).trim();
  const groups: SearchGroup[] = [];
  if (qn)
    for (const [kind, t, ic] of KIND_GROUP) {
      const items = s.res.filter((r) => r.kind === kind).map((r) => ({ key: r.key, t: r.name, s: r.detail, n: r.n, shirt: kind === "player", ic, go: r.go }));
      if (items.length) groups.push({ key: kind, t, items });
    }
  const byPlace = new Map<Place, AskIn[]>();
  for (const q of s.all) {
    if (qn && !norm(q.t).includes(qn)) continue;
    const p = SEARCH_PLACE[q.place] ?? "temporada";
    byPlace.set(p, [...(byPlace.get(p) ?? []), q]);
  }
  for (const p of PLACES) {
    const qs = byPlace.get(p);
    if (qs) groups.push({ key: `q-${p}`, t: PLACE_T[p], items: qs.map((q) => ({ key: q.key, t: q.t, s: "", n: "", shirt: false, ic: "arrow" as IconName, go: q.go })) });
  }
  return { groups, none: groups.length === 0 };
}
export type SearchV = ReturnType<typeof searchView>;
