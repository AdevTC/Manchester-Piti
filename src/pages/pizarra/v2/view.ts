// La pizarra «Noche de partido» — what the stadium draws for a lineup at a moment: the cromos (with their
// morph from where they were drawn last, ripple and pack flags), the empty and ghost slots, the química
// links, the plan layer, the LED texts, the scoreboard and the 7/7 chip. Pure, so the board stays a thin
// renderer and the rules are testable.
import type { CSSProperties } from "react";
import type { Lineup } from "../formations";
import { systemDef } from "../../../lib/formations";
import { defaultTactics } from "../tactics";
import { CAMS, depthScale, framePath, lineDepth, PRESS_BAND, proj, slotPos, slotZone, type CamName } from "./geometry";
import { formAria, galonesOf, natOf, rtTxt, type Squad } from "./model";
import type { FitGrade } from "../../../lib/positions";
import { normPlaysAs } from "../positions";
import { shownFit, slotCode } from "./encaje";

import { reelFor } from "./pack";
import { planArrows, type PlanArrow } from "./plan";
import { hops, linkMark, tierOf, type Chem } from "./quimica";
import { plural } from "./plural";

export type Modo = "editar" | "quimica" | "jugadas" | "dibujar" | "mas" | "tableros" | "comparar" | "compartir" | "ajustes" | "charla" | "pachanga";

/** One change's animation: where each cromo was drawn before it, and what to celebrate. */
export interface Fx {
  k: number;
  from: Record<string, [number, number]> | null;
  slow: boolean;
  q0: number | null;
  /** Players who just arrived somewhere: the química ripples out from them. */
  rip: string[];
  spin: boolean;
  cele: boolean;
  rw: "" | "REBOBINANDO" | "AVANCE";
  /** The camera moved: the turf eases in. */
  cam: boolean;
  /** A jugada's rivals and ball: where they were drawn before (by rival id; the ball). */
  rfrom: Record<string, [number, number]> | null;
  bfrom: [number, number] | null;
  /** The replay at 0,5×: the glide takes 3.2 s instead of 1.7 s. */
  long: boolean;
}
export const FX0: Fx = { k: 0, from: null, slow: false, q0: null, rip: [], spin: false, cele: false, rw: "", cam: false, rfrom: null, bfrom: null, long: false };
/** How long each kind of change animates before the board settles (ms). */
export const fxDuration = (fx: Fx): number => (fx.spin ? 2800 : fx.cele ? 2700 : fx.slow ? (fx.long ? 3400 : 1900) : 1300);

const n2 = (n: number): number => +n.toFixed(2);

/** Inline custom properties (--x, --y…) for React's style prop. */
export const vars = (o: Record<string, string | number>): CSSProperties => o as CSSProperties;

/** Where every placed cromo is drawn (frame %), by player id. */
export function positionsOf(L: Lineup, cam: CamName = "tv"): Record<string, [number, number]> {
  const C = CAMS[cam];
  const out: Record<string, [number, number]> = {};
  L.slots.forEach((s, i) => {
    if (!s.playerId) return;
    const p = slotPos(L, i);
    const q = proj(C, p.u, p.v);
    out[s.playerId] = [n2(q.x), n2(q.y)];
  });
  return out;
}

export interface CardView {
  id: string;
  i: number;
  x: number;
  y: number;
  fx: number;
  fy: number;
  mx: string;
  my: string;
  sc: string;
  z: number;
  rd: string;
  cls: string;
  /** The rating as printed («—» before his first match). */
  rt: string;
  num: number;
  name: string;
  /** The slot's exact code («DFC»); out of position, what he is › the slot («DC›MC»). */
  zoneTxt: string;
  /** Out of position: his fit there is 0 (fuera). Nothing known never is. */
  oop: boolean;
  /** How well he fits the slot (3 preferida · 2 también · 1 adaptado · 0 fuera), as the cromo marks it:
   *  null when nothing exact is known (no data, or only his line and he is on it). */
  fit: FitGrade | null;
  gal: string[];
  /** The red tag under the cromo: «NO VA» or why he is out. */
  tag: string;
  q: [boolean, boolean, boolean];
  spin: boolean;
  reel: number[];
  sel: boolean;
  me: boolean;
  /** A player is in the hand and this cromo is where he can go («tgt»; «best» = his own line; and
   *  «pzp-g3…g0» in `cls`: how well the held player would fit this slot). */
  tgt: boolean;
  best: boolean;
  /** The target's badge: «Entra por él» (a bench player in the hand) or «Intercambiar». */
  tg: string;
  aria: string;
  /** Familiarity with the slot's zone (familiarity.ts): «++», «+» or «!» (absent = nothing to say). */
  fam?: "++" | "+" | "!";
}
export interface SlotView {
  i: number;
  x: string;
  y: string;
  sc: string;
  lab: string;
  on: boolean;
  /** «pzp-g3…g0» with a player in the hand: how well he would fit this slot (else ""). */
  cls: string;
  aria: string;
}
export interface LinkView {
  key: string;
  cls: string;
  x: string;
  y: string;
  l: string;
  a: string;
  d: string;
}
export interface BadgeView {
  key: string;
  cls: string;
  x: string;
  y: string;
  d: string;
  t: string;
}

export interface PitchArgs {
  L: Lineup;
  sq: Squad;
  ch: Chem;
  cam: CamName;
  modo: Modo;
  fx: Fx;
  selId: string | null;
  /** The player in the hand (from the pitch or the bench): the cromos he can swap with glow. */
  hand?: { k: "p" | "b"; id: string } | null;
  pick: number | null;
  ro: boolean;
  rm: boolean;
  meId: string | null;
  /** Cromos as discs (the química, the plan and the comparison read better without the cards). */
  mini?: boolean;
  /** La charla's step: the cromos lie face down until their step turns them (1–7 = slot 0–6), the one
   *  presented is the hero and the rest of the revealed ones dim; no empty-slot buttons, and the química
   *  lights up from the plan on. */
  present?: number;
}

export interface PitchView {
  cards: CardView[];
  slots: SlotView[];
  gslots: { i: number; x: string; y: string; sc: string }[];
  links: LinkView[];
  badges: BadgeView[];
  mini: boolean;
}

/** The cromo's fit mark (text + shape, never colour alone): preferida needs none. */
export const FIT_GLYPH: Record<FitGrade, string> = { 3: "", 2: "✓", 1: "~", 0: "!" };
/** The fit in words (the mark's and the cromo's accessible text), the family of encaje.fitWord. */
export const FIT_WORDS: Record<FitGrade, string> = { 3: "en su sitio", 2: "también juega aquí", 1: "adaptado", 0: "fuera de su sitio" };

/** What a player is, as his cromo prints it when out of place: the board's «Jugar de» (its code, or a
 *  legacy line), else his preferida, else his line. */
export function natTxtOf(L: Lineup, sq: Squad, id: string): string | undefined {
  return normPlaysAs(L.playerPositions[id]) ?? sq.byId.get(id)?.ps?.main ?? natOf(L, sq, id);
}

export function pitchView({ L, sq, ch, cam, modo, fx, selId, hand = null, pick, ro, rm, meId, mini = modo === "quimica", present }: PitchArgs): PitchView {
  const ch0 = present != null;
  // the player in the hand: a pitch cromo (swap) or a bench one (comes in); his line is the best target
  const handI = hand?.k === "p" ? L.slots.findIndex((s) => s.playerId === hand.id) : -1;
  const handP = hand?.k === "p" && handI >= 0 ? hand : null;
  const handB = hand?.k === "b" && sq.byId.has(hand.id) ? hand : null;
  const handZ = handP ? slotZone(L, handI) : handB ? (sq.byId.get(handB.id)?.pos ?? null) : null;
  const handName = (handP ?? handB) ? (sq.byId.get((handP ?? handB)?.id ?? "")?.name ?? "") : "";
  const heldId = (handP ?? handB)?.id ?? null;
  // the held player's fit at slot i, and how it is said
  const handFit = (i: number): FitGrade | null => (heldId ? shownFit(L, sq, heldId, i) : null);
  const handSays = (g: FitGrade): string => "para " + handName + ": " + FIT_WORDS[g];
  const hero = ch0 && present >= 1 && present <= 7 ? present - 1 : -1;
  const C = CAMS[cam];
  const fk = fx.k;
  const linkT = new Map<number, number[]>();
  ch.links.forEach((l) => [l.i, l.j].forEach((i) => linkT.set(i, (linkT.get(i) ?? []).concat([l.t]))));
  const hop = hops(L, ch.links, fx.rip);
  const nums = sq.list.map((c) => c.num);
  const cards: CardView[] = [];
  L.slots.forEach((s, i) => {
    const id = s.playerId;
    const p = id ? sq.byId.get(id) : undefined;
    if (!id || !p) return;
    const pp = slotPos(L, i);
    const sp = proj(C, pp.u, pp.v);
    const x = n2(sp.x);
    const y = n2(sp.y);
    const f = fx.from?.[id];
    const zl = slotZone(L, i);
    const fit = shownFit(L, sq, id, i);
    const oop = fit === 0;
    const code = slotCode(L, i);
    const gal = galonesOf(L, id).map((g) => g.letter).slice(0, 3);
    const lt = linkT.get(i) ?? [];
    const lq = lt.length ? Math.round(lt.reduce((a, b) => a + b, 0) / lt.length) : 1;
    const fxx = f ? f[0] : x;
    const fyy = f ? f[1] : y;
    const dist = Math.hypot(fxx - x, fyy - y);
    const sel = selId === id;
    const h = hop.get(i);
    const tag = p.cv === "no" ? "NO VA" : p.baja ? p.baja.toUpperCase() : "";
    // la charla: face down until presented; the one presented now flips and leads, the rest dim
    const rev = !ch0 || present >= i + 1;
    const me = meId === id && rev;
    const nat = natOf(L, sq, id);
    // what he is, as the cromo prints it: the board's «Jugar de», else his preferida, else his line
    const natTxt = natTxtOf(L, sq, id);
    const tgt = !mini && rev && !ch0 && ((!!handP && handP.id !== id) || !!handB);
    const hf = tgt ? handFit(i) : null;
    // a bench player in the hand: best where he is in his place (his grade there), else by his line.
    // (In a swap the tints judge the held player at this slot, while best judges this cromo's player
    // at the held one's slot — the other half of the swap — so it stays the line rule.)
    const best = tgt && (handB ? (hf != null ? hf >= 2 : handZ != null && zl === handZ) : handZ != null && nat === handZ);
    const hs = hf != null ? " (" + handSays(hf) + ")" : "";
    const cls = [
      tgt ? "tgt" : "",
      best ? "best" : "",
      hf != null ? "pzp-g" + hf : "",
      fk % 2 ? "ma" : "mb",
      fx.slow ? "slow" : "",
      i === 0 ? "gk" : "",
      oop && !mini ? "oop" : "",
      sel ? "sel" : "",
      mini ? "mini" : "",
      !rev ? "hide" : "",
      ch0 && present === i + 1 ? "flip" : "",
      hero === i ? "hero" : "",
      hero >= 0 && hero !== i && rev ? "dim" : "",
      fx.from && !f && !ch0 ? "in" : "",
      h != null && !fx.spin ? (h === 0 ? "land" : "rip") : "",
      fx.spin && !rm ? "spin" : "",
      fx.rw ? "rw" : "",
      !mini ? "q" + Math.max(...(lt.length ? lt : [1])) : "",
      me ? "me" : "",
    ].filter(Boolean).join(" ");
    cards.push({
      id,
      i,
      x,
      y,
      fx: fxx,
      fy: fyy,
      mx: ((fxx + x) / 2).toFixed(2),
      my: ((fyy + y) / 2 - Math.min(9, dist * 0.35)).toFixed(2),
      sc: depthScale(C, sp.s).toFixed(3),
      z: Math.round(y * 10) + (sel ? 2000 : 0),
      rd: ((h ?? 0) * 0.16).toFixed(2) + "s",
      cls,
      rt: rtTxt(p),
      num: p.num,
      name: p.name,
      zoneTxt: oop && natTxt ? natTxt + "›" + code : code,
      oop,
      fit,
      gal,
      tag: rev ? tag : "",
      q: [lq >= 1, lq >= 2, lq >= 3],
      spin: !!fx.spin && !rm,
      reel: reelFor(i, nums),
      sel,
      me,
      tgt,
      best,
      tg: handB ? "Entra por él" : "Intercambiar",
      aria: !rev
        ? "Cromo boca abajo: aún por presentar"
        : p.name + ", dorsal " + p.num + ", " + code +
        (fit != null ? ", " + FIT_WORDS[fit] + (oop && natTxt ? " (natural " + natTxt + ")" : "") : "") +
        ", " + formAria(p) +
        (gal.length ? ", galones " + gal.join(" ") : "") +
        (p.cv === "no" ? ", dijo que no va" : p.baja ? ", " + p.baja.toLowerCase() : "") +
        (me ? ", eres tú" : "") +
        (tgt
          ? handB
            ? ". Toca: entra " + handName + " por él" + hs
            : ". Toca para intercambiarlo con " + handName + hs
          : modo === "editar" && !ro
            ? ". Toca para cogerlo, otra vez para su ficha; mantén pulsado para el menú rápido"
            : ""),
    });
  });

  const slots: SlotView[] = [];
  const gslots: PitchView["gslots"] = [];
  L.slots.forEach((s, i) => {
    const pp = slotPos(L, i);
    const sp = proj(C, pp.u, pp.v);
    const sc = depthScale(C, sp.s).toFixed(3);
    if (!L.freeMode && modo === "editar" && !ro) gslots.push({ i, x: sp.x.toFixed(2), y: sp.y.toFixed(2), sc });
    if ((s.playerId && sq.byId.has(s.playerId)) || ch0) return;
    const lab = slotCode(L, i);
    const hf = mini ? null : handFit(i);
    const said = hf != null ? ". P" + handSays(hf).slice(1) : "";
    slots.push({ i, x: sp.x.toFixed(2), y: sp.y.toFixed(2), sc, lab, on: pick === i, cls: hf != null ? "pzp-g" + hf : "", aria: "Hueco " + lab + " vacío: toca para elegir jugador" + said });
  });

  const links: LinkView[] = [];
  const badges: BadgeView[] = [];
  // (in the charla the química lights up once the seven have been presented)
  if (!ch0 || present >= 8) ch.links.forEach((l, n) => {
    const pa = slotPos(L, l.i);
    const pb = slotPos(L, l.j);
    const a = proj(C, pa.u, pa.v);
    const b = proj(C, pb.u, pb.v);
    const dx = b.x - a.x;
    const dy = (b.y - a.y) * C.Fh;
    const len = Math.hypot(dx, dy);
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const hp = Math.min(hop.get(l.i) ?? 9, hop.get(l.j) ?? 9);
    const rip = hp < 9 && !fx.spin;
    const d = (fx.spin ? 1.8 : 0) + (rip ? hp * 0.16 : n * 0.07);
    links.push({ key: l.a + "|" + l.b, cls: "t" + l.t + (rip ? " rip" : ""), x: a.x.toFixed(2), y: a.y.toFixed(2), l: len.toFixed(2), a: ang.toFixed(1) + "deg", d: d.toFixed(2) + "s" });
    if (modo === "quimica") badges.push({ key: l.a + "|" + l.b, cls: "t" + l.t, x: ((a.x + b.x) / 2).toFixed(2), y: ((a.y + b.y) / 2).toFixed(2), d: d.toFixed(2) + "s", t: linkMark(l.t) });
  });

  return { cards, slots, gslots, links, badges, mini };
}

export interface PlanLayer {
  heatD: string;
  dlOn: boolean;
  dlD: string;
  /** The handle's spot (frame %): the line's right end. */
  dlX: string;
  dlY: string;
  defLine: string;
  /** Salida and foco, painted while the plan is open. */
  tarrs: PlanArrow[];
}

export function planLayer(L: Lineup, cam: CamName, modo: Modo, showPlan = false): PlanLayer {
  const C = CAMS[cam];
  const t = { ...defaultTactics(), ...L.tactics };
  const pr = PRESS_BAND[t.press] ?? [26, 60];
  const heatD = framePath(C, [[0, pr[0]], [100, pr[0]], [100, pr[1]], [0, pr[1]]]) + "Z";
  const v = lineDepth(L, t.defLine);
  const A = proj(C, 0, v);
  const B = proj(C, 100, v);
  return {
    heatD,
    // (no línea under the strokes, nor over a jugada's paso, nor in the charla)
    dlOn: !L.freeMode && modo !== "dibujar" && modo !== "jugadas" && modo !== "charla",
    dlD: framePath(C, [[0, v], [100, v]]),
    dlX: (B.x - 0.5).toFixed(2),
    dlY: A.y.toFixed(2),
    defLine: t.defLine,
    tarrs: showPlan ? planArrows(L, cam) : [],
  };
}

/** «Presión alta · línea media · amplia». */
export function tacSummary(L: Lineup): string {
  const t = { ...defaultTactics(), ...L.tactics };
  return (t.press === "Alta" ? "Presión alta" : "Presión " + t.press.toLowerCase()) + " · línea " + t.defLine.toLowerCase() + " · " + t.width.toLowerCase();
}

export interface Hud {
  sysName: string;
  ledTop: string;
  ledNear: string;
  qv: number;
  tier: string;
  qDigits: { v: string; k: string; d: string }[];
  qUp: number;
  celeOn: boolean;
  valCls: string;
  valOk: boolean;
  valN: string;
  valTxt: string;
  valAria: string;
  pitchAria: string;
  /** MEDIA: the seven on the pitch's mean form rating (0 with nobody on it). */
  media: number;
}

/** The mean form rating of the players on the pitch who have played (a debutant's «—» doesn't count),
 *  rounded: the command bar's MEDIA plate and the squad bars. */
export function mediaOf(L: Lineup, sq: Squad): number {
  const rts = L.slots
    .map((s) => (s.playerId ? sq.byId.get(s.playerId) : undefined))
    .filter((c): c is NonNullable<typeof c> => !!c && !c.unrated)
    .map((c) => c.rt);
  return rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : 0;
}

export function hud(L: Lineup, sq: Squad, ch: Chem, fx: Fx, rm: boolean, match: { short: string; date: string } | null): Hud {
  const sysName = L.freeMode ? "LIBRE" : systemDef(L.formation).label;
  const v = ch.v;
  const [tier] = tierOf(v);
  const qUp = fx.from && fx.q0 != null && v > fx.q0 ? v - fx.q0 : 0;
  const celeOn = fx.cele && !rm;
  const flip = !!fx.from && fx.q0 != null && fx.q0 !== v;
  const qs = String(v).padStart(2, "0");
  const ms = match ? match.short + " · " : "";
  const ledTop = celeOn
    ? "¡SIETE LISTO! · " + sysName + " · QUÍMICA " + v + " · "
    : qUp
      ? "¡SUBE LA QUÍMICA! · +" + qUp + " · " + tier.toUpperCase() + " · "
      : sysName + " · " + tacSummary(L).toUpperCase() + " · QUÍMICA " + v + " · " + ms;
  const ledNear = "MANCHESTER PITI · " + ms + (match?.date ? match.date.toUpperCase() + " · " : "") + "VAMOS PITI · ";
  const n = ch.n;
  const warn = L.slots
    .map((s) => (s.playerId ? sq.byId.get(s.playerId) : undefined))
    .filter((c): c is NonNullable<typeof c> => !!c && (c.cv === "no" || !!c.baja));
  const bad = n < 7 || !ch.gk;
  // Short, so the board's name keeps the room (the full reason is in the chip's label).
  const valTxt = !L.slots[0]?.playerId
    ? "Sin POR"
    : !ch.gk
      ? "POR fuera"
      : n < 7
        ? "Faltan " + (7 - n)
        : warn.length
          ? plural(warn.length, "aviso")
          : "Listo";
  const warnTxt = warn.map((c) => c.name + (c.cv === "no" ? " dijo que no va" : " está " + (c.baja === "Inactivo" ? "inactivo" : c.baja?.toLowerCase()))).join(", ");
  return {
    sysName,
    ledTop,
    ledNear,
    qv: v,
    tier,
    qDigits: qs.split("").map((d, k) => ({ v: d, k: flip ? (fx.k % 2 ? "fa" : "fb") : "", d: (k * 0.12).toFixed(2) + "s" })),
    qUp,
    celeOn,
    valCls: (bad ? "bad" : warn.length ? "warn" : "") + (fx.cele ? " done" : ""),
    valOk: !bad && !warn.length,
    valN: n + "/7",
    valTxt,
    valAria: n + " de 7 colocados. " + (bad ? (!L.slots[0]?.playerId ? "Sin portero" : !ch.gk ? "Portero fuera de su sitio" : valTxt) : warn.length ? warnTxt : "Siete listo, con portero"),
    pitchAria: sysName + ", " + n + " de 7 colocados, química " + v,
    media: mediaOf(L, sq),
  };
}

/** Two announcements of one action joined into one: a part the new one already says goes, and a new one
 *  the message already says adds nothing («Capitán: X» is said once). */
export function joinLive(prev: string, next: string): string {
  if (!prev || prev.includes(next)) return prev || next;
  const parts = prev.split(". ").filter((x) => x && !next.includes(x));
  return [...parts, next].join(". ");
}

/** «ahora», «hace 3 min», «ayer»… for the autosave line. */
export function ago(t: number | null, now: number): string {
  if (!t) return "ahora";
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return "hace " + Math.floor(s / 60) + " min";
  if (s < 86400) return "hace " + Math.floor(s / 3600) + " h";
  if (s < 172800) return "ayer";
  return "hace " + Math.floor(s / 86400) + " días";
}
