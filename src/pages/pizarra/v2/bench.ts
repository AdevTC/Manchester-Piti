// La pizarra «FUT» — what the «Siete» tool shows besides the pitch: the squad bars (media, química,
// the four axes), the convocatoria's head (the counts, who is in doubt), the bench in three groups
// (Banquillo · Sin convocar · Bajas) as FUT rows or cromos — with the targets that glow while a player
// is in the hand — and the reparto de minutos. Pure.
import type { FormationName, Lineup, Zone } from "../formations";
import { FORM, slotZone } from "./geometry";
import { formAria, rtTxt, type Cromo, type Squad } from "./model";
import { tierDiamonds, type Chem } from "./quimica";
import { matchShort, type CalMatch } from "./boards";
import { plural } from "./plural";
import { mediaOf } from "./view";

// ── the squad bars ──
export interface SquadBar {
  k: "ATA" | "DEF" | "FOR" | "EXP";
  v: number;
  /** "hi" ≥ 80, "lo" < 50. */
  cls: "" | "hi" | "lo";
}
export interface SquadInfo {
  /** Mean form rating of the seven on the pitch who have played (0 with nobody). */
  media: number;
  /** «7/7». */
  once: string;
  /** The química's three diamonds (lit up to its tier: quimica.ts TIERS). */
  dm: boolean[];
  bars: SquadBar[];
}

export function squadInfo(L: Lineup, sq: Squad, ch: Chem): SquadInfo {
  const media = mediaOf(L, sq);
  const t = tierDiamonds(ch.v);
  const bar = (k: SquadBar["k"], v: number): SquadBar => ({ k, v, cls: v >= 80 ? "hi" : v < 50 ? "lo" : "" });
  return { media, once: ch.n + "/7", dm: [0, 1, 2].map((i) => i < t), bars: [bar("ATA", ch.at), bar("DEF", ch.de), bar("FOR", ch.fo), bar("EXP", ch.ex)] };
}

// ── the systems ──
/** «3 DEF · 2 MED · 1 DEL». */
export function sysLines(name: FormationName): string {
  const zs = FORM[name].map((f) => f[1]);
  const n = (z: string) => zs.filter((x) => x === z).length;
  return n("DEF") + " DEF · " + n("MED") + " MED · " + n("DEL") + " DEL";
}

// ── the convocatoria ──
/** The players the match's convocatoria calls (starters + banquillo); null = it calls no one yet. */
export function calledOf(m: CalMatch | null): ReadonlySet<string> | null {
  const ids = m?.conv ? [...m.conv.starters, ...m.conv.bench] : [];
  return ids.length ? new Set(ids) : null;
}

export interface ConvHead {
  /** «Convocatoria · J8 · MAD SKY». */
  kick: string;
  /** «12 convocados · 2 bajas», or what is going on with the answers. */
  title: string;
  voy: number;
  duda: number;
  no: number;
  aria: string;
  /** Names of those in doubt. */
  dudas: string[];
  /** Who «Avisar a los que dudan» calls on: those in doubt and, with the captain's convocatoria, the
   *  called who haven't answered (never a baja, never someone it doesn't call). */
  aviso: string[];
  /** Whether anyone has answered (else «Solo los que van» has nothing to filter by). */
  answered: boolean;
}

export function convHead(o: { sq: Squad; match: CalMatch | null; loading: boolean; error: boolean }): ConvHead {
  const { sq, match: m } = o;
  const called = calledOf(m);
  // With the captain's convocatoria, everything counts over who it calls.
  const pool = called ? sq.list.filter((c) => called.has(c.id)) : sq.list;
  const n = { voy: 0, duda: 0, no: 0, sin: 0 };
  pool.forEach((c) => {
    if (c.cv) n[c.cv]++;
    else n.sin++;
  });
  const answered = n.voy + n.duda + n.no > 0;
  const bajas = pool.filter((c) => c.baja).length;
  const title = !m
    ? "Sin partido a la vista: sin convocatoria."
    : o.error
      ? "No se ha podido leer la convocatoria de " + matchShort(m) + "."
      : o.loading
        ? "Leyendo la convocatoria de " + matchShort(m) + "…"
        : !answered && !called
          ? "Nadie ha respondido aún a la convocatoria de " + matchShort(m) + "."
          : [called ? plural(called.size, "convocado") : plural(n.voy + n.duda + n.no, "respuesta"), n.sin ? n.sin + " sin responder" : "", bajas ? plural(bajas, "baja") : ""].filter(Boolean).join(" · ");
  const dudas = pool.filter((c) => c.cv === "duda" && !c.baja).map((c) => c.name);
  const aviso = pool.filter((c) => !c.baja && (c.cv === "duda" || (!!called && !c.cv))).map((c) => c.name);
  return {
    kick: "Convocatoria" + (m ? " · " + matchShort(m) : ""),
    title,
    voy: n.voy,
    duda: n.duda,
    no: n.no,
    aria: "Respuestas: " + n.voy + " voy, " + n.duda + " duda, " + n.no + " no va",
    dudas,
    aviso,
    answered,
  };
}

/** «Kevin y Almachi» / «A, B y C». */
export const andList = (xs: string[]): string => (xs.length < 2 ? (xs[0] ?? "") : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]);

/** The message «Avisar a los que dudan» sends to the group, with the link where they answer (null when
 *  there is nobody to call on). */
export function avisoTxt(names: string[], m: CalMatch | null, url?: string): string | null {
  if (!names.length) return null;
  return (m ? matchShort(m) + ": " : "") + andList(names) + ", ¿venís? Contestad a la convocatoria en el vestuario" + (url ? ": " + url : ".");
}

/** Where the convocatoria is answered (the link «Avisar a los que dudan» carries). */
export const avisoUrl = (origin: string): string => origin + "/vestuario";

// ── the bench ──
export interface BenchFilter {
  /** «Buscar en la plantilla» is open: only then do its filters apply. */
  on: boolean;
  q: string;
  /** "Todos" or a zone. */
  zf: string;
  /** «Solo los que van» = those who said «Voy». */
  oc: boolean;
}

/** Whether «Buscar en la plantilla» is filtering at all (a name or dorsal, a position, «Solo los que van»). */
export const isFiltering = (f: BenchFilter): boolean => f.on && (!!f.q.trim() || f.zf !== "Todos" || f.oc);
const matches = (c: Cromo, f: BenchFilter): boolean => {
  const qq = f.q.trim().toLowerCase();
  return (!qq || c.name.toLowerCase().includes(qq) || String(c.num) === qq) && (f.zf === "Todos" || c.pos === f.zf) && (!f.oc || c.cv === "voy");
};

/** «Buscar en la plantilla» finds the ones on the pitch too: who, and the slot he plays. */
export interface PitchHit {
  id: string;
  name: string;
  num: number;
  slot: string;
}
export function pitchFound(L: Lineup, sq: Squad, f: BenchFilter, label: (i: number) => string): PitchHit[] {
  if (!isFiltering(f)) return [];
  return L.slots.flatMap((s, i) => {
    const c = s.playerId ? sq.byId.get(s.playerId) : undefined;
    return c && matches(c, f) ? [{ id: c.id, name: c.name, num: c.num, slot: label(i) }] : [];
  });
}

/** Who is in the hand: a player of the pitch (his slot's zone), or an empty slot picked. */
export type BenchHand = { kind: "p"; name: string; zone: Zone } | { kind: "slot"; zone: Zone };

export interface BenchRow {
  id: string;
  /** The rating as printed («—» before his first match). */
  rt: string;
  pos: string;
  num: number;
  name: string;
  /** «7 PJ · 4 G · 6 A · 335'». */
  line: string;
  /** "x" = a baja: it can't be dragged to the pitch. */
  zone: "b" | "x";
  baja: boolean;
  me: boolean;
  sel: boolean;
  /** The status chip: class and words. */
  cvCls: "voy" | "duda" | "no" | "sin" | "les" | "san" | "ina";
  cv: string;
  icon: "check" | "doubt" | "x" | null;
  /** «Entra por él» / «Entra aquí» while someone is in the hand (null = not a target). */
  tg: string | null;
  cls: string;
  aria: string;
}

export interface BenchGroup {
  k: "b" | "s" | "x";
  t: string;
  cls: "g-b" | "g-s" | "g-x";
  rows: BenchRow[];
  /** What an empty group says. */
  emptyTxt: string;
}

const CV_TXT = { voy: "Voy", duda: "Duda", no: "No va" } as const;
const CV_ORDER = { voy: 0, duda: 1, no: 2 } as const;
const BAJA_CLS = { Lesionado: "les", Sancionado: "san", Inactivo: "ina" } as const;

function row(c: Cromo, grp: BenchGroup["k"], o: { hand: BenchHand | null; selId: string | null; meId: string | null }): BenchRow {
  const bj = grp === "x";
  const sin = grp === "s";
  const cvCls: BenchRow["cvCls"] = bj ? BAJA_CLS[c.baja ?? "Inactivo"] : sin ? "sin" : (c.cv ?? "sin");
  const cv = bj ? (c.baja ?? "Baja") : sin ? "Sin convocar" : c.cv ? CV_TXT[c.cv] : "Sin respuesta";
  const icon: BenchRow["icon"] = bj || c.cv === "no" ? "x" : sin ? null : c.cv === "voy" ? "check" : c.cv === "duda" ? "doubt" : null;
  const h = o.hand;
  const tgt = !!h && !bj && !sin && c.cv !== "no";
  const best = tgt && c.pos === h.zone;
  const me = o.meId === c.id;
  const s = c.stats;
  return {
    id: c.id,
    rt: rtTxt(c),
    pos: c.pos ?? "—",
    num: c.num,
    name: c.name,
    line: s.played + " PJ · " + s.goals + " G · " + s.assists + " A · " + s.minutes + "'",
    zone: bj ? "x" : "b",
    baja: bj,
    me,
    sel: o.selId === c.id,
    cvCls,
    cv,
    icon,
    tg: tgt && h ? (h.kind === "p" ? "Entra por él" : "Entra aquí") : null,
    cls: [c.pos === "POR" ? "gk" : "", c.cv === "no" && !bj ? "no-va" : "", sin ? "sin" : "", bj ? "baja" : "", tgt ? "tgt" : "", best ? "best" : "", me ? "me" : ""].filter(Boolean).join(" "),
    aria:
      c.name + ", dorsal " + c.num + ", " + (c.pos ?? "sin posición") + ", " + formAria(c) + ", " +
      (bj ? cv.toLowerCase() + ", no disponible" : "convocatoria: " + cv.toLowerCase()) +
      ", " + plural(s.minutes, "minuto") + " esta temporada" + (me ? ", eres tú" : "") +
      (tgt && h ? (h.kind === "p" ? ". Toca: entra por " + h.name : ". Toca: entra en el hueco") : ""),
  };
}

/** The bench (everyone off the pitch) in its three groups, filtered by «Buscar en la plantilla». */

export function benchGroups(o: { bench: Cromo[]; called: ReadonlySet<string> | null; filter: BenchFilter; hand: BenchHand | null; selId: string | null; meId: string | null }): BenchGroup[] {
  const f = o.filter;
  const filtering = isFiltering(f);
  const keep = (c: Cromo) => !f.on || matches(c, f);
  const grpOf = (c: Cromo): BenchGroup["k"] => (c.baja ? "x" : o.called && !o.called.has(c.id) ? "s" : "b");
  const of = (k: BenchGroup["k"]) => o.bench.filter((c) => grpOf(c) === k && keep(c));
  const rank = (c: Cromo) => (c.cv ? CV_ORDER[c.cv] : 3);
  const b = of("b")
    .map((c, i) => ({ c, i }))
    .sort((x, y) => rank(x.c) - rank(y.c) || x.i - y.i)
    .map((x) => x.c);
  const g = (k: BenchGroup["k"], t: string, cls: BenchGroup["cls"], list: Cromo[], empty: string): BenchGroup => ({
    k,
    t,
    cls,
    rows: list.map((c) => row(c, k, o)),
    emptyTxt: filtering ? "Nadie con ese filtro." : empty,
  });
  return [
    g("b", "Banquillo", "g-b", b, "Todos los convocados están en el campo."),
    g("s", "Sin convocar", "g-s", of("s"), "Nadie fuera de la convocatoria."),
    g("x", "Bajas", "g-x", of("x"), "Sin bajas para este partido."),
  ];
}

// ── the reparto de minutos (Plan) ──
export interface RepRow {
  id: string;
  num: number;
  name: string;
  /** In the seven on the pitch («SIETE»). */
  inS: boolean;
  /** Bar width, «42%». */
  m: string;
  min: string;
}
export interface Reparto {
  rows: RepRow[];
  txt: string;
  /** «Darle minutos»: who comes in, at which slot, for whom. */
  rot: { id: string; i: number; out: string } | null;
}

/** The six outfield players who have played least (and can play), and the change that evens it out. */
export function reparto(L: Lineup, sq: Squad, called: ReadonlySet<string> | null): Reparto {
  const onPitch = new Set(L.slots.map((s) => s.playerId).filter((x): x is string => !!x));
  const avl = sq.list
    .filter((c) => !c.baja && c.pos !== "POR" && c.cv !== "no" && (!called || called.has(c.id) || onPitch.has(c.id)))
    .sort((a, b) => a.stats.minutes - b.stats.minutes);
  const maxMin = Math.max(1, ...sq.list.map((c) => c.stats.minutes));
  const rows = avl.slice(0, 6).map((c) => ({ id: c.id, num: c.num, name: c.name, inS: onPitch.has(c.id), m: Math.max(2, Math.round((c.stats.minutes / maxMin) * 100)) + "%", min: c.stats.minutes + "′" }));
  const low = avl.find((c) => !onPitch.has(c.id));
  let rot: Reparto["rot"] = null;
  if (low?.pos) {
    const cands = L.slots
      .map((s, i) => ({ id: s.playerId, i }))
      .filter((x): x is { id: string; i: number } => !!x.id && x.i > 0 && slotZone(L, x.i) === low.pos)
      .sort((a, b) => (sq.byId.get(b.id)?.stats.minutes ?? 0) - (sq.byId.get(a.id)?.stats.minutes ?? 0));
    if (cands[0]) rot = { id: low.id, i: cands[0].i, out: cands[0].id };
  }
  const outName = rot ? (sq.byId.get(rot.out)?.name ?? "Jugador") : "";
  const txt = rot && low ? low.name + " lleva " + low.stats.minutes + "′; " + outName + ", " + (sq.byId.get(rot.out)?.stats.minutes ?? 0) + "′." : "El reparto está equilibrado.";
  return { rows, txt, rot };
}
