// «El club» (CL- boards, ronda 3), the words and numbers the hub and the rooms draw, from production's data: the
// season as jornadas (the board's S.jornadas), the vitrina's pieces with the jornada that earned each one (the
// board's pieces, `at`), «La línea del club», the four doors' living details, the birthdays (30 days, Inicio's rule)
// and a member's own pieces. Pure: no React, no Firebase.
import type { ClubMatch } from "../../../lib/clubData";
import { dateMillis } from "../../../lib/clubData";
import type { StripSegment } from "../../../lib/derived/vidrio/strip";
import { playerGame } from "../../../lib/clubAnalytics";
import { keyEvents } from "../../partidos/pa/season";
import { madridDate, madridTime } from "../../../lib/derived/madrid";
import { venueName } from "../../../lib/derived/venue";
import type { VIconName } from "../../../components/vidrio/VIcon";
import type { ClubTrophy } from "../../../lib/clubContentDefaults";

const DAY = 86_400_000;
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTH_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WD_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WD_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const NUM_WORD = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis"];

/** «a, b y c». */
export const andList = (xs: readonly string[]): string => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
export const capFirst = (s: string): string => (s ? s.charAt(0).toLocaleUpperCase("es") + s.slice(1) : s);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The Madrid calendar parts of an instant. */
export function madridParts(ms: number): { y: number; m: number; d: number; wd: number } {
  const [y, m, d] = madridDate(ms).split("-").map(Number);
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}
/** «Dom 18 oct». */
export const shortDate = (ms: number): string => {
  const p = madridParts(ms);
  return `${WD_SHORT[p.wd]} ${p.d} ${MES[p.m - 1]}`;
};
/** «18 oct». */
export const dayMonth = (ms: number): string => {
  const p = madridParts(ms);
  return `${p.d} ${MES[p.m - 1]}`;
};
/** «Domingo 18 de octubre». */
export const longDate = (ms: number): string => {
  const p = madridParts(ms);
  return `${capFirst(WD_LONG[p.wd])} ${p.d} de ${MONTH_LONG[p.m - 1]}`;
};
/** «domingo 25» within the month of `now`, «domingo 8 de noviembre» past it. */
export function weekdayDay(ms: number, now: number): string {
  const p = madridParts(ms);
  const n = madridParts(now);
  return `${WD_LONG[p.wd]} ${p.d}${p.m === n.m && p.y === n.y ? "" : ` de ${MONTH_LONG[p.m - 1]}`}`;
}
export const weekdayOf = (ms: number): string => WD_LONG[madridParts(ms).wd];

/** The boards' crest letters for a rival: the admin's own initials, else two words' initials or a word's first three. */
export function crestCode(m: Pick<ClubMatch, "rival" | "rivalShort" | "rivalInitials">): string {
  const own = (m.rivalInitials ?? m.rivalShort ?? "").trim();
  if (own) return own.toLocaleUpperCase("es").slice(0, 3);
  const w = (m.rival ?? "")
    .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, " ")
    .split(/\s+/)
    .filter((x) => x && !/^(fc|f|c|de|la|el|los|las|cf)$/i.test(x));
  return w.length ? w[0].slice(0, 3).toLocaleUpperCase("es") : "";
}

// ---------------------------------------------------------------- the season as jornadas

export type Letter = "G" | "E" | "P";
export interface Jor {
  j: number;
  id: string;
  match: ClubMatch;
  rival: string;
  code: string;
  /** ms of the kick-off (NaN undated). */
  at: number;
  /** «Dom 18 oct». */
  date: string;
  /** «19:00»; null when the kick-off has no hour yet. */
  time: string | null;
  home: boolean;
  gf: number | null;
  ga: number | null;
  /** Postponed. */
  off: boolean;
  venue: string;
}
export interface ClubSeason {
  name: string;
  jornadas: Jor[];
  /** The jornadas told so far (the last played one's number; a postponed one before it counts). */
  played: number;
  /** Our place in the published table, and of how many. */
  pos: number | null;
  of: number | null;
}

/** Midnight in Madrid has no hour: a kick-off at 00:00 is «hora por fijar». */
const timeOf = (ms: number): string | null => {
  const t = madridTime(ms);
  return t === "00:00" ? null : t;
};

export function seasonFrom(name: string, segments: readonly StripSegment[], table: { pos: number; of: number } | null): ClubSeason {
  const list = segments.filter((s) => s.jornada !== null && s.state !== "suspendido" && s.at !== null);
  const jornadas: Jor[] = list.map((s, i) => ({
    j: i + 1,
    id: s.id,
    match: s.match,
    rival: s.rival,
    code: crestCode(s.match),
    at: s.at ?? NaN,
    date: s.at !== null ? shortDate(s.at) : "",
    time: s.at !== null ? timeOf(s.at) : null,
    home: s.home,
    gf: s.state === "jugado" && s.score ? s.score.gf : null,
    ga: s.state === "jugado" && s.score ? s.score.ga : null,
    off: s.state === "aplazado",
    venue: s.match.venue ? venueName(s.match.venue) : "",
  }));
  let played = 0;
  jornadas.forEach((x, i) => {
    if (x.gf !== null) played = i + 1;
  });
  return { name, jornadas, played, pos: table?.pos ?? null, of: table?.of ?? null };
}

export const letterOf = (x: Pick<Jor, "gf" | "ga" | "off">): Letter | "Apl." | "" => (x.off ? "Apl." : x.gf === null || x.ga === null ? "" : x.gf > x.ga ? "G" : x.gf < x.ga ? "P" : "E");
export const scoreOfJ = (x: Pick<Jor, "gf" | "ga">): string => (x.gf === null || x.ga === null ? "" : `${x.gf}–${x.ga}`);
const wordOf = (x: Jor) => ((x.gf ?? 0) > (x.ga ?? 0) ? "ganamos" : (x.gf ?? 0) < (x.ga ?? 0) ? "perdimos" : "empatamos");
export const posText = (s: ClubSeason): string => (s.pos ? `${s.pos}º de ${s.of}` : "sin tabla todavía");

/** «J2 · En casa de Pitutis, domingo 25 a las 14:00» · «J1 · Orduña fc, en casa, domingo 18 a las 19:00». */
export function nextLine(x: Jor | null, now: number): string {
  if (!x) return "Fecha por publicar";
  const when = `${weekdayDay(x.at, now)}${x.time ? ` a las ${x.time}` : ""}`;
  return x.home ? `J${x.j} · ${x.rival}, en casa, ${when}` : `J${x.j} · En casa de ${x.rival}, ${when}`;
}
/** «J2 · En casa de Pitutis · domingo 25, 14:00». */
export function rsvpLine(x: Jor | null, now: number): string {
  if (!x) return "Sin partido a la vista";
  const when = `${weekdayDay(x.at, now)}${x.time ? `, ${x.time}` : ""}`;
  return x.home ? `J${x.j} · ${x.rival}, en casa · ${when}` : `J${x.j} · En casa de ${x.rival} · ${when}`;
}
/** «¿Vas a Pitutis el domingo?» · «¿Vas contra Orduña fc el domingo 18?». */
export function vasLine(x: Jor | null, now: number): string {
  if (!x) return "Sin partido a la vista";
  const soon = x.at - now < 7 * DAY;
  return x.home ? `¿Vas contra ${x.rival} el ${soon ? weekdayOf(x.at) : weekdayDay(x.at, now)}?` : `¿Vas a ${x.rival} el ${soon ? weekdayOf(x.at) : weekdayDay(x.at, now)}?`;
}

// ---------------------------------------------------------------- the vitrina's pieces

export type PieceId = "escudo" | "primer-gol" | "primer-partido" | "debut" | "pichichi" | "record" | "primera-victoria" | "asistencias" | "porteria-a-cero" | "penalti" | "hat-trick" | "primera-copa";
export const PIECE_IDS: readonly PieceId[] = ["escudo", "primer-gol", "primer-partido", "debut", "pichichi", "record", "primera-victoria", "asistencias", "porteria-a-cero", "penalti", "hat-trick", "primera-copa"];
export interface Piece {
  id: PieceId;
  icon: VIconName;
  kicker: string;
  title: string;
  detail: string;
  /** The jornada that earned it (0 for the crest); null still to win. */
  at: number | null;
  date?: string;
  /** «J1» when it has a match. */
  match?: string;
  matchId?: string;
  note?: string;
  gold?: boolean;
  cup?: boolean;
  crest?: boolean;
}
export const ESCUDO: Piece = { id: "escudo", icon: "shield", kicker: "El escudo", title: "Pieza nº 01", detail: "Celeste, marino y oro", at: 0, date: "Desde el primer balón", note: "El escudo gira en su vitrina. Por detrás: MP.", crest: true };
/** What each piece is made of on the shelf. */
export const PIECE_OBJ: Record<PieceId, "crest" | "medal" | "ticket" | "shirt" | "ball" | "cup" | "plaque"> = {
  escudo: "crest",
  "primer-gol": "medal",
  "primer-partido": "ticket",
  debut: "shirt",
  pichichi: "medal",
  record: "ball",
  "primera-victoria": "cup",
  asistencias: "medal",
  "porteria-a-cero": "plaque",
  penalti: "plaque",
  "hat-trick": "ball",
  "primera-copa": "cup",
};
/** The piece the hub opens on when the address names none: the season's latest («real»: the first goal). */
export function defaultPiece(pieces: readonly Piece[]): PieceId {
  const won = pieces.filter((p) => p.at !== null && p.at > 0);
  if (!won.length) return "escudo";
  const last = Math.max(...won.map((p) => p.at ?? 0));
  const at = won.filter((p) => p.at === last);
  return (at.find((p) => p.gold) ?? at.find((p) => p.id === "record") ?? at[0]).id;
}

export interface PiecesIn {
  season: ClubSeason;
  /** A player's short name («Alcides», «Adrián T.C.»). */
  nameOf: (id: string) => string;
  /** The squad's ids (guests never count). */
  squad: ReadonlySet<string>;
  /** r12 M-19: clubContent.trophies as read (clubExtras.readTrophies, newest first). None: «La primera copa · Aquí irá». */
  trophies?: readonly ClubTrophy[];
}

/** «12 de octubre de 2025» from "2025-10-12", «2025» from "2025". */
export function trophyDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${+m[3]} de ${MONTH_LONG[+m[2] - 1] ?? ""} de ${m[1]}` : date;
}
/** The cup at the end of the shelf: the newest trophy when the club has any (won, beside the crest: it belongs to
 *  no jornada), else the place kept for the first one. */
function cupPiece(trophies: readonly ClubTrophy[] | undefined): Piece {
  const [newest, ...rest] = trophies ?? [];
  if (!newest) return { id: "primera-copa", icon: "trophy", kicker: "La primera copa", title: "Aquí irá", detail: "el primer título del Piti", at: null, cup: true };
  const when = trophyDate(newest.date);
  const others = rest.map((t) => `${t.name} (${t.date.slice(0, 4)})`);
  const note = [newest.note?.trim() ?? "", others.length ? `También en la vitrina: ${andList(others)}.` : ""].filter(Boolean).join(" ") || "Un título del Piti, en su balda.";
  return { id: "primera-copa", icon: "trophy", kicker: rest.length ? `Las copas · ${rest.length + 1} títulos` : "La primera copa", title: newest.name, detail: when, at: 0, date: when, note, cup: true };
}

const goalsBy = (m: ClubMatch) => {
  const out = new Map<string, number>();
  for (const e of keyEvents(m)) if (e.k === "g" && e.who) out.set(e.who, (out.get(e.who) ?? 0) + 1);
  return out;
};
const assistsBy = (m: ClubMatch) => {
  const out = new Map<string, number>();
  for (const e of keyEvents(m)) if (e.k === "g" && e.with) out.set(e.with, (out.get(e.with) ?? 0) + 1);
  return out;
};
function leadersOf(totals: Map<string, number>, nameOf: (id: string) => string): { names: string[]; n: number; runners: { names: string[]; n: number } | null } | null {
  const rows = [...totals.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || nameOf(a[0]).localeCompare(nameOf(b[0]), "es"));
  if (!rows.length) return null;
  const top = rows[0][1];
  const names = rows.filter(([, n]) => n === top).map(([id]) => nameOf(id));
  const rest = rows.filter(([, n]) => n < top);
  const second = rest.length ? rest[0][1] : 0;
  return { names, n: top, runners: second ? { names: rest.filter(([, n]) => n === second).map(([id]) => nameOf(id)), n: second } : null };
}

/** The team's pieces in the board's order: the crest, the ones won (by the jornada that won them), then the ones to win. */
export function piecesOf({ season, nameOf, squad, trophies }: PiecesIn): Piece[] {
  const played = season.jornadas.slice(0, season.played).filter((x) => x.gf !== null);
  const won: Piece[] = [];
  const at = (x: Jor) => ({ at: x.j, date: longDate(x.at), match: `J${x.j}`, matchId: x.id });
  const ours = (id: string) => squad.has(id);

  // the first goal: the first match with a goal of ours by a player of the squad
  let firstGoal: { x: Jor; who: string; min: number; with?: string } | null = null;
  for (const x of played) {
    const g = keyEvents(x.match).find((e) => e.k === "g" && e.who && ours(e.who));
    if (g?.who) {
      firstGoal = { x, who: g.who, min: g.min, with: g.with && ours(g.with) ? g.with : undefined };
      break;
    }
  }
  if (firstGoal) {
    const x = firstGoal.x;
    const lost = (x.gf ?? 0) < (x.ga ?? 0);
    won.push({
      id: "primer-gol",
      icon: "ball",
      kicker: "Primer gol",
      title: nameOf(firstGoal.who),
      detail: `ante ${x.rival}, en el ${firstGoal.min}′`,
      ...at(x),
      note: firstGoal.with ? `Con el pase de ${nameOf(firstGoal.with)}.` : lost ? "El gol de la honra en una tarde dura: el primero del archivo." : "El primero del archivo.",
      gold: true,
    });
  }
  const first = played[0];
  // who played the first match (the ledger's rows, else the lineups)
  const debutants = first ? [...squad].filter((id) => playerGame(id, first.match).played) : [];
  if (first) {
    won.push({
      id: "primer-partido",
      icon: "flag",
      kicker: "Primer partido",
      title: dayMonth(first.at),
      detail: `${scoreOfJ(first)} ante ${first.rival}`,
      ...at(first),
      note: `El primer acta de la temporada.${debutants.length ? ` Jugaron ${NUM_WORD[debutants.length] ?? debutants.length}.` : ""}`,
    });
    if (debutants.length)
      won.push({
        id: "debut",
        icon: "shirt",
        kicker: "Logro «Debut»",
        title: `Los ${debutants.length}`,
        detail: `que jugaron la J${first.j}`,
        ...at(first),
        note: `${andList(orderByLedger(first.match, debutants).map(nameOf))}.`,
      });
  }
  const goals = new Map<string, number>();
  const assists = new Map<string, number>();
  for (const x of played) {
    for (const [id, n] of goalsBy(x.match)) if (ours(id)) goals.set(id, (goals.get(id) ?? 0) + n);
    for (const [id, n] of assistsBy(x.match)) if (ours(id)) assists.set(id, (assists.get(id) ?? 0) + n);
  }
  const last = played[played.length - 1];
  const tras = last ? { at: last.j, date: `Tras la J${last.j}`, match: "" } : null;
  const pich = leadersOf(goals, nameOf);
  if (pich && tras)
    won.push({
      id: "pichichi",
      icon: "star",
      kicker: pich.names.length > 1 ? "Pichichi compartido" : "Pichichi",
      title: andList(pich.names),
      detail: `${plural(pich.n, "gol", "goles")}${pich.names.length > 1 ? " cada uno" : ""}`,
      ...tras,
      note: pich.runners ? `${andList(pich.runners.names)}, con ${pich.runners.n}, ${pich.names.length > 1 ? "los" : "le"} persigue${pich.runners.names.length > 1 ? "n" : ""}.` : "Se mueve con cada acta.",
    });
  const record = [...played].sort((a, b) => (b.gf ?? 0) - (a.gf ?? 0) || a.j - b.j)[0];
  if (record && (record.gf ?? 0) > 0)
    won.push({
      id: "record",
      icon: "chart",
      kicker: "Tarde de récord",
      title: plural(record.gf ?? 0, "gol", "goles"),
      detail: `ante ${record.rival}`,
      ...at(record),
      note: (record.gf ?? 0) <= 1 ? "El listón está bajo: la próxima tarde lo sube." : (record.gf ?? 0) >= 4 ? `${scoreOfJ(record)}, la tarde más larga del marcador.` : "El listón, para el próximo que lo supere.",
    });
  const win = played.find((x) => (x.gf ?? 0) > (x.ga ?? 0));
  if (win) won.push({ id: "primera-victoria", icon: "trophy", kicker: "Primera victoria", title: scoreOfJ(win), detail: `ante ${win.rival}`, ...at(win), note: win.j === 1 ? "La que abrió la temporada." : `La primera, en la J${win.j}.` });
  const ast = leadersOf(assists, nameOf);
  if (ast && tras)
    won.push({
      id: "asistencias",
      icon: "arrow",
      kicker: ast.names.length > 1 ? "Líderes de asistencias" : "Rey de la asistencia",
      title: andList(ast.names),
      detail: `${plural(ast.n, "asistencia")}${ast.names.length > 1 ? " cada uno" : ""}`,
      ...tras,
      note: ast.runners ? `${andList(ast.runners.names)}, con ${ast.runners.n}.` : "Se mueve con cada acta.",
    });
  const cleans = played.filter((x) => x.ga === 0);
  if (cleans.length) {
    const c = cleans[0];
    const keeper = keeperOf(c.match, squad);
    const more = cleans.slice(1);
    won.push({
      id: "porteria-a-cero",
      icon: "shield",
      kicker: "Portería a cero",
      title: scoreOfJ(c),
      detail: `ante ${c.rival}`,
      ...at(c),
      note: `${keeper ? `${nameOf(keeper)}, sin encajar.` : "Sin encajar."}${more.length ? ` Luego, ${NUM_WORD[more.length] ?? more.length} más: ${andList(more.map((x) => x.rival))}.` : ""}`,
    });
  }
  for (const x of played) {
    const saved = (x.match.events ?? []).find((e) => e.type === "penalty_saved" && e.playerId && ours(e.playerId));
    if (saved?.playerId) {
      const min = typeof saved.minute === "number" ? saved.minute : null;
      won.push({ id: "penalti", icon: "glove", kicker: "Penalti parado", title: nameOf(saved.playerId), detail: `ante ${x.rival}${min != null ? `, en el ${min}′` : ""}`, ...at(x), note: "Un logro del partido: el primero de la portería." });
      break;
    }
  }
  for (const x of played) {
    const hat = [...goalsBy(x.match)].find(([id, n]) => n >= 3 && ours(id));
    if (hat) {
      won.push({ id: "hat-trick", icon: "ball", kicker: "Hat-trick", title: nameOf(hat[0]), detail: `ante ${x.rival}`, ...at(x), note: `${hat[1]} goles en una tarde.` });
      break;
    }
  }
  const has = new Set(won.map((p) => p.id));
  const next = season.jornadas[season.played] ?? null;
  const todo: Piece[] = [
    { id: "primera-victoria", icon: "trophy", kicker: "Primera victoria", title: "Por ganar", detail: "se celebrará aquí", at: null },
    { id: "primer-partido", icon: "flag", kicker: "Primer partido", title: `Jornada ${next?.j ?? 1}`, detail: next ? `${weekdayDay(next.at, next.at)}, contra ${next.rival}` : "fecha por confirmar", at: null },
    { id: "primer-gol", icon: "ball", kicker: "Primer gol", title: "Por marcar", detail: "¿quién lo hará?", at: null },
    { id: "pichichi", icon: "star", kicker: "Pichichi", title: "Por decidir", detail: "todos a cero", at: null },
    { id: "asistencias", icon: "arrow", kicker: "Rey de la asistencia", title: "Por decidir", detail: "0 asistencias", at: null },
    { id: "record", icon: "chart", kicker: "Tarde de récord", title: "Por batir", detail: "el listón está en cero", at: null },
    { id: "porteria-a-cero", icon: "shield", kicker: "Portería a cero", title: "Por cerrar", detail: "un partido sin encajar", at: null },
    { id: "hat-trick", icon: "ball", kicker: "Hat-trick", title: "Por firmar", detail: "tres goles en un partido", at: null },
  ].filter((p) => !has.has(p.id as PieceId)) as Piece[];
  const ORDER: PieceId[] = ["primera-victoria", "primer-gol", "primer-partido", "debut", "porteria-a-cero", "pichichi", "record", "asistencias", "penalti", "hat-trick"];
  won.sort((a, b) => (a.at ?? 0) - (b.at ?? 0) || wonRank(a.id, played.length) - wonRank(b.id, played.length) || ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  return [ESCUDO, ...won, ...todo, cupPiece(trophies)];
}
/** Within one jornada: a first win comes first; a lost first match leads with its goal (the board's «real»). */
function wonRank(id: PieceId, n: number): number {
  const r: Partial<Record<PieceId, number>> = { "primera-victoria": 0, "primer-partido": 1, "primer-gol": 2, debut: 3, "porteria-a-cero": 4, pichichi: 5, asistencias: 6, record: 7, penalti: 8, "hat-trick": 9 };
  if (n && id === "primer-gol") return -1;
  return r[id] ?? 10;
}
/** The squad's ids in the ledger's order (starters first), else as given. */
function orderByLedger(m: ClubMatch, ids: string[]): string[] {
  const order = [...(m.starters ?? []), ...(m.bench ?? []), ...Object.keys(m.ledger ?? {})];
  return [...ids].sort((a, b) => idx(order, a) - idx(order, b));
}
const idx = (xs: readonly string[], x: string) => {
  const i = xs.indexOf(x);
  return i < 0 ? 999 : i;
};
/** Who kept goal: the ledger's saves, else the starter in goal. */
function keeperOf(m: ClubMatch, squad: ReadonlySet<string>): string | null {
  const saves = Object.entries(m.ledger ?? {}).filter(([id, v]) => squad.has(id) && typeof v.saves === "number" && v.saves > 0);
  if (saves.length) return saves.sort((a, b) => (b[1].saves ?? 0) - (a[1].saves ?? 0))[0][0];
  return null;
}

// ---------------------------------------------------------------- a member's own pieces (Tus piezas)

export interface MineIn {
  playerId: string;
  season: ClubSeason;
  /** Matches the player played this season, in order. */
  nameOf: (id: string) => string;
  /** The MVP votes he won (closed) and whether the last one is still open. */
  mvpWins: number;
  mvpOpen: boolean;
}
export interface Mine {
  t: string;
  d: string;
  has: boolean;
}
export function minePieces({ playerId, season, mvpWins, mvpOpen }: MineIn): Mine[] {
  const played = season.jornadas.slice(0, season.played).filter((x) => x.gf !== null);
  const games = played.map((x) => ({ x, g: playerGame(playerId, x.match) })).filter((r) => r.g.played);
  const debut = games[0];
  let goal: { x: Jor; min: number } | null = null;
  let assist: { x: Jor; min: number; to?: string } | null = null;
  let hat: Jor | null = null;
  for (const x of played) {
    const ev = keyEvents(x.match);
    if (!goal) {
      const g = ev.find((e) => e.k === "g" && e.who === playerId);
      if (g) goal = { x, min: g.min };
    }
    if (!assist) {
      const a = ev.find((e) => e.k === "g" && e.with === playerId);
      if (a) assist = { x, min: a.min, to: a.who };
    }
    if (!hat && ev.filter((e) => e.k === "g" && e.who === playerId).length >= 3) hat = x;
  }
  const first = played[0];
  const mins = debut?.g.minutes ?? 0;
  return [
    { t: "Debut", d: debut ? `J${debut.x.j} ante ${debut.x.rival}${mins ? `, ${mins} minutos` : ""}` : first ? `Aún no: no jugó la J${first.j}` : "Por estrenar", has: !!debut },
    { t: "Primer gol", d: goal ? `en el ${goal.min}′ ante ${goal.x.rival}` : "Por marcar", has: !!goal },
    { t: "Primera asistencia", d: assist ? `J${assist.x.j}, en el ${assist.min}′` : "Por dar", has: !!assist },
    { t: "MVP", d: mvpWins ? plural(mvpWins, "vez", "veces") : mvpOpen && debut ? "Votación abierta" : "Por votar", has: mvpWins > 0 },
    { t: "10 partidos", d: games.length >= 10 ? `${games.length} jugados` : `${games.length} de 10`, has: games.length >= 10 },
    { t: "Hat-trick", d: hat ? `J${hat.j} ante ${hat.rival}` : "Por firmar", has: !!hat },
  ];
}

// ---------------------------------------------------------------- birthdays (30 days, Inicio's rule)

export interface BdayPerson {
  id: string;
  /** «Huberoski». */
  name: string;
  /** «Hubert Kurdziel». */
  full: string;
  num: string;
  birthDate?: string;
}
export interface Bday extends BdayPerson {
  /** Madrid days from today. */
  days: number;
  at: number;
  age: number;
}
export function birthdaysOf(people: readonly BdayPerson[], now: number): Bday[] {
  const t = madridParts(now);
  const base = Date.UTC(t.y, t.m - 1, t.d);
  return people
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate ?? ""))
    .map((p) => {
      const [by, bm, bd] = (p.birthDate ?? "").split("-").map(Number);
      let y = t.y;
      let at = Date.UTC(y, bm - 1, bd);
      if (at < base) at = Date.UTC(++y, bm - 1, bd);
      // (noon UTC: the same Madrid day whatever the offset)
      return { ...p, days: Math.round((at - base) / DAY), at: at + 12 * 3_600_000, age: y - by };
    })
    .sort((a, b) => a.days - b.days || a.name.localeCompare(b.name, "es"));
}
/** «el martes 27» · «el viernes 6 de noviembre» · «hoy» · «mañana». */
export function bdayWhen(b: Bday, now: number): string {
  if (b.days === 0) return "hoy";
  if (b.days === 1) return "mañana";
  return `el ${weekdayDay(b.at, now)}`;
}

export const BDAY_DAYS = 30;

// ---------------------------------------------------------------- la línea del club (Historia)

export interface Bead {
  cls: string;
  left: string;
  top: number;
  letter: string;
  label: string;
  j: number;
  played: boolean;
  date: string;
}
export interface Mark {
  cls: string;
  left: string;
  icon: VIconName;
  many: boolean;
  n: number;
  label: string;
  j: number;
}
export function lineOf(S: ClubSeason, pieces: readonly Piece[], h: number, playing: boolean) {
  const N = Math.max(1, S.jornadas.length);
  const px = (i: number) => ((i + 0.5) / N) * 1000;
  const yOf = (x: Jor) => (x.gf === null || x.ga === null ? 45 : x.gf > x.ga ? 18 : x.gf < x.ga ? 72 : 45);
  const played = S.jornadas.slice(0, S.played);
  const real = played.filter((x) => x.gf !== null);
  const pts = (xs: Jor[]) => xs.map((x) => `${px(x.j - 1).toFixed(1)},${yOf(x)}`);
  const all = pts(real);
  const lit = pts(real.filter((x) => x.j <= h));
  const beads: Bead[] = S.jornadas.map((x, i) => {
    const isPlayed = i < S.played;
    const L = letterOf(x);
    let cls = isPlayed ? (x.off ? "is-off" : `is-${String(L).toLowerCase()}`) : "is-next";
    if (isPlayed && x.j > h) cls += " is-later";
    if (x.j === h) cls += " is-at";
    const label = `J${x.j}, ${x.off ? `aplazado, ${x.rival}` : isPlayed ? `${wordOf(x)} ${scoreOfJ(x)}${x.home ? " a " : " en casa de "}${x.rival}` : `${x.home ? "contra " : "en casa de "}${x.rival}, ${x.date}`}`;
    return { cls, left: (((i + 0.5) / N) * 100).toFixed(2), top: ((isPlayed && !x.off ? yOf(x) : 50) / 90) * 100, letter: N > 12 ? "" : isPlayed ? (L === "Apl." ? "" : L) : "", label, j: x.j, played: isPlayed, date: x.date };
  });
  const groups = new Map<number, Piece[]>();
  for (const p of pieces) if (p.at) groups.set(p.at, [...(groups.get(p.at) ?? []), p]);
  const marks: Mark[] = [...groups.entries()].map(([j, gg]) => ({
    cls: j > h ? "is-later" : "",
    left: (((j - 0.5) / N) * 100).toFixed(2),
    icon: gg[0].icon === "flag" ? "trophy" : gg[0].icon,
    many: gg.length > 1,
    n: gg.length,
    label: `J${j}: ${gg.length === 1 ? gg[0].kicker : `${gg.length} piezas`} para la vitrina`,
    j,
  }));
  const hx = h === 0 ? (0.6 / N) * 100 : ((h - 0.5) / N) * 100;
  const atJ = h ? S.jornadas[h - 1] : null;
  const tip = !atJ ? "Antes del primer balón" : `J${atJ.j} · ${atJ.off ? "Aplazado" : `${letterOf(atJ)} ${scoreOfJ(atJ)}`} · ${atJ.code}`;
  const first = S.jornadas[0];
  const last = S.jornadas[S.jornadas.length - 1];
  return {
    cls: [playing ? "is-playing" : "", N > 12 ? "is-long" : ""].join(" ").trim(),
    allD: all.length ? `M${all.join(" L")}` : "M0 45",
    litD: lit.length ? `M${lit.join(" L")}` : "M0 45",
    todayLab: S.played === 0 || h < S.played,
    beads,
    marks,
    todayPct: (S.played === 0 ? (0.15 / N) * 100 : (S.played / N) * 100).toFixed(2),
    hasHead: S.played > 0,
    headPct: hx.toFixed(2),
    tip,
    tipCls: hx < 14 ? "is-start" : hx > 86 ? "is-end" : "",
    valueText: atJ ? tip.replace(/·/g, ",") : "Antes del primer balón",
    hint:
      S.played === 0
        ? first
          ? `La línea se enciende con la primera jornada: el ${weekdayOf(first.at)} ${madridParts(first.at).d}, contra ${first.rival}.`
          : "La línea se enciende con la primera jornada."
        : "Arrastra por la temporada: los números y la vitrina de abajo vuelven a esa jornada.",
    back: S.played > 0 && h < S.played,
    startLab: first ? `J1 · ${first.date}` : "",
    endLab: last ? `J${S.jornadas.length} · ${last.date}` : "",
  };
}

/** The four counts over the line at jornada `h`, and the shelf «La vitrina tras la J{h}». */
export function lensOf(S: ClubSeason, pieces: readonly Piece[], h: number) {
  const upto = S.jornadas.slice(0, S.played).filter((x) => x.gf !== null && x.j <= h);
  const won = upto.filter((x) => (x.gf ?? 0) > (x.ga ?? 0)).length;
  const gf = upto.reduce((a, x) => a + (x.gf ?? 0), 0);
  const earned = pieces.filter((p) => p.at !== null && p.at <= h);
  return {
    countsLabel: h ? `El club tras la J${h}` : "El club antes del primer balón",
    counts: [
      { v: upto.length, label: upto.length === 1 ? "partido" : "partidos" },
      { v: won, label: won === 1 ? "victoria" : "victorias" },
      { v: gf, label: gf === 1 ? "gol" : "goles" },
      { v: earned.length, label: "piezas", pop: true },
    ],
    shelfT: h ? `La vitrina tras la J${h}` : "La vitrina antes del primer balón",
    shelf: pieces.map((p) => {
      const has = p.at !== null && p.at <= h;
      return { id: p.id, icon: p.icon, t: p.kicker, cls: has ? "is-has" : "is-not", label: `${p.kicker}${has ? ", ganada" : ", todavía no"}` };
    }),
  };
}

/** The door of La historia: the last six jornadas around the one just played, and its little line. */
export function doorLineOf(S: ClubSeason) {
  const N = Math.max(1, S.jornadas.length);
  const px = (i: number) => ((i + 0.5) / N) * 1000;
  const yOf = (x: Jor) => (x.gf === null || x.ga === null ? 45 : x.gf > x.ga ? 18 : x.gf < x.ga ? 72 : 45);
  const real = S.jornadas.slice(0, S.played).filter((x) => x.gf !== null);
  const dot = (x: number, y: number, r: number) => `M${(x - r).toFixed(1)},${y.toFixed(1)} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0`;
  const rD = N > 12 ? 1.6 : 3;
  const dotsP = real.map((x) => dot((px(x.j - 1) / 1000) * 120, (yOf(x) / 90) * 36, rD)).join(" ");
  const dotsN = S.jornadas
    .slice(S.played)
    .map((x) => dot((px(x.j - 1) / 1000) * 120, 18, rD * 0.8))
    .join(" ");
  const spark = real.map((x) => `${((px(x.j - 1) / 1000) * 120).toFixed(1)},${((yOf(x) / 90) * 36).toFixed(1)}`).join(" L");
  const cell = (x: Jor, long: boolean) => {
    const pl = x.j <= S.played;
    const L = letterOf(x);
    return { t: `J${x.j}`, s: pl ? (x.off ? "Apl." : `${L} ${scoreOfJ(x)}`) : long ? x.date : x.date.replace(/^\S+ /, ""), cls: pl ? `is-${x.off ? "off" : String(L).toLowerCase()}` : "is-next" };
  };
  const jj =
    S.jornadas.length > 6
      ? S.jornadas.slice(Math.max(0, S.played - 4), Math.max(0, S.played - 4) + 6).map((x) => cell(x, true))
      : S.jornadas.slice(0, 6).map((x) => cell(x, false));
  return { spark: spark ? `M${spark}` : "M0,18", dotsP: dotsP || "M0,0", dotsN: dotsN || "M0,0", jj };
}

/** «J1 · P 1–8 · sin tabla todavía» (the door) — «Empieza el domingo 18» before the first. */
export function historiaLive(S: ClubSeason): string {
  if (!S.played) {
    const f = S.jornadas[0];
    return f ? `Empieza el ${weekdayOf(f.at)} ${madridParts(f.at).d}` : "La temporada, por publicar";
  }
  const x = S.jornadas[S.played - 1];
  return `J${x.j} · ${letterOf(x)} ${scoreOfJ(x)} · ${posText(S)}`.replace(/\s+·/, " ·");
}

/** The address of a jornada's match. */
export const matchHref = (x: Pick<Jor, "id">): string => `/partidos/${x.id}`;
export const dateMs = (m: Pick<ClubMatch, "date">): number => dateMillis(m.date);
