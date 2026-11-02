// r14 «La pizarra» · Tableros: what the gallery, the inspector and Comparar say, over the store's selectors (pure but
// for P.sel reads). The prototype's PiTableros helpers (resOf, savedOf, itemOf, compare, statsOf) on the app's data.
import type { PzApi } from "../../store/api";
import { fmt } from "../../store/fmt";
import { VERS, verOf } from "../../store/seven";
import type { PzBoard, PzMatch, PzSlot, PzVer, Tactics } from "../../store/types";
import type { HistorySnap } from "../../../data/history";
import { seedLineup } from "../../../lineupOps";
import type { FormationName } from "../../../formations";
import type { PosCode } from "../../../../../lib/positions";
import { readSeen } from "./seen";

/** Lower case, no accents (search and name clashes). */
export const norm = (s: string): string =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export const matchById = (P: PzApi, id: string | null | undefined): PzMatch | null => (id ? (P.state.W.matches.find((m) => m.id === id) ?? null) : null);
export const jLabel = (M: PzMatch): string => (M.j ? "J" + M.j : M.rival);

/** The match's band: G / E / P once played (with the word), «J3» to be played, «·» without a match. */
export function resOf(M: PzMatch | null): { l: string; w: string; cls: string } {
  if (!M) return { l: "·", w: "Sin partido vinculado", cls: "is-none" };
  if (M.phase === "juego" || M.phase === "descanso") return { l: jLabel(M), w: "En juego" + (M.gf != null ? " · " + M.gf + "–" + M.ga : ""), cls: "is-next" };
  if (M.played && M.gf != null && M.ga != null) {
    const r = M.gf > M.ga ? ["G", "Victoria", "is-g"] : M.gf === M.ga ? ["E", "Empate", "is-e"] : ["P", "Derrota", "is-p"];
    return { l: r[0], w: r[1] + " · " + M.gf + "–" + M.ga, cls: r[2] };
  }
  if (M.played) return { l: jLabel(M), w: "Jugado", cls: "is-next" };
  const where = M.home == null ? "" : M.home ? " · En casa" : " · Fuera";
  return { l: jLabel(M), w: "Por jugar" + (M.at ? " · " + fmt.day(M.at) + " · " + fmt.hm(M.at) : "") + where, cls: "is-next" };
}

/** «ahora», «hoy 18:50», «lun 18:50», «dom 18 oct». */
export function savedOf(ms: number | null | undefined, now: number): string {
  if (!ms) return "";
  const d = now - ms;
  if (d < 90000) return "ahora";
  if (fmt.day(ms) === fmt.day(now)) return "hoy " + fmt.hm(ms);
  if (d < 6 * 86400000) return fmt.day(ms).split(" ")[0] + " " + fmt.hm(ms);
  return fmt.day(ms);
}

/** One thing Comparar can put on a side: a board's version, the seven that played, a snapshot of a board's history. */
export interface CmpItem {
  key: string;
  kind: "board" | "match" | "snap";
  boardId?: string;
  ver: "titular" | "segunda" | "planb";
  b?: PzBoard;
  snap?: HistorySnap;
  t: string;
  short: string;
  sub: string;
  formation: FormationName;
  slots: PzSlot[];
}

export interface CmpCtx {
  /** The history snapshots known now, by board id (newest first). */
  snaps: Record<string, HistorySnap[] | undefined>;
}

const snapSlots = (s: HistorySnap): PzSlot[] => s.slots.map((x) => ({ code: x.code as PosCode, x: x.x, y: x.y, playerId: x.playerId }));

/** The seven that played a match (its convocatoria's starters) on the shape of the match's official, else 2-3-1:
 *  the official's players keep their spot, the rest go where they fit best. Null when nobody started. */
export function playedSlots(P: PzApi, M: PzMatch): { formation: FormationName; slots: PzSlot[] } | null {
  const starters = M.cal.conv?.starters ?? [];
  if (!starters.length) return null;
  const off = P.state.W.boards.find((b) => b.isOfficial && b.matchId === M.id) ?? null;
  const base = off ? verOf(off.lineup, "titular") : verOf(seedLineup("2-3-1", []), "titular");
  const left = new Set(starters);
  const slots: PzSlot[] = base.slots.map((s) => {
    if (s.playerId && left.has(s.playerId)) {
      left.delete(s.playerId);
      return { ...s };
    }
    return { ...s, playerId: null };
  });
  // the rest: each free slot takes who fits it best (the keeper's slot first)
  slots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.playerId)
    .sort((a, b) => (a.s.code === "POR" ? -1 : b.s.code === "POR" ? 1 : 0))
    .forEach(({ i }) => {
      let best: string | null = null;
      let bf = -1;
      left.forEach((pid) => {
        const f = P.sel.fit(pid, slots[i].code) ?? 0;
        if (f > bf) {
          bf = f;
          best = pid;
        }
      });
      if (best) {
        slots[i] = { ...slots[i], playerId: best };
        left.delete(best);
      }
    });
  return { formation: base.formation, slots };
}

/** A comparable item from its key: `b:<board>:<ver>`, `j:<match>`, `h:<board>:<snapId>`. */
export function itemOf(P: PzApi, key: string | null | undefined, ctx: CmpCtx): CmpItem | null {
  if (!key) return null;
  const p = String(key).split(":");
  if (p[0] === "b") {
    const b = P.sel.board(p[1]);
    if (!b || b.draft) return null;
    const vid = p[2] === "segunda" || p[2] === "planb" ? p[2] : "titular";
    const v = verOf(b.lineup, vid);
    if (!v.exists) return null;
    const vt = VERS.find((x) => x.id === vid)?.t ?? "Titular";
    const mine = b.ownerUid === P.sel.me().uid;
    return { key, kind: "board", boardId: b.id, ver: vid, b, t: (b.isOfficial ? "Oficial · " : "") + b.name, short: b.name, sub: vt + (mine ? "" : " · de @" + b.ownerNick), formation: v.formation, slots: v.slots };
  }
  if (p[0] === "j") {
    const M = matchById(P, p[1]);
    if (!M || !M.played) return null;
    const ps = playedSlots(P, M);
    if (!ps) return null;
    return { key, kind: "match", ver: "titular", t: "El siete que jugó · " + jLabel(M), short: jLabel(M) + " · " + M.rival, sub: M.rival + " · " + resOf(M).w, formation: ps.formation, slots: ps.slots };
  }
  if (p[0] === "v") {
    const b = P.sel.board(p[1]);
    const s = b ? readSeen(b.id) : null;
    if (!b || !s) return null;
    return { key, kind: "snap", boardId: b.id, ver: "titular", b, t: "Lo que viste la última vez", short: "La última vez", sub: b.name, formation: s.formation, slots: s.slots };
  }
  if (p[0] === "h") {
    const b = P.sel.board(p[1]);
    const s = b ? (ctx.snaps[b.id] ?? []).find((x) => x.id === p[2]) : null;
    if (!b || !s) return null;
    return { key, kind: "snap", boardId: b.id, ver: "titular", b, snap: s, t: s.label || "Una foto", short: s.label || "Una foto", sub: b.name + " · " + savedOf(s.at, P.state.W.now), formation: s.formation, slots: snapSlots(s) };
  }
  return null;
}

/** Everything a side can be, grouped as the pickers show it. */
export function itemList(P: PzApi, ctx: CmpCtx): { g: string; it: CmpItem }[] {
  const out: { g: string; it: CmpItem }[] = [];
  const cur = P.sel.board();
  const add = (g: string, key: string) => {
    const it = itemOf(P, key, ctx);
    if (it && !out.some((x) => x.it.key === key)) out.push({ g, it });
  };
  if (cur && !cur.draft) VERS.forEach((v) => add("«" + cur.name + "»", "b:" + cur.id + ":" + v.id));
  P.sel
    .boards()
    .filter((b) => b !== cur && !b.draft)
    .sort((a, b) => Number(b.isOfficial) - Number(a.isOfficial))
    .forEach((b) => add(b.isOfficial ? "El oficial" : "Los tableros", "b:" + b.id + ":titular"));
  P.state.W.matches.filter((m) => m.played).forEach((m) => add("El siete que jugó", "j:" + m.id));
  if (cur && !cur.draft) (ctx.snaps[cur.id] ?? []).forEach((s) => add("Cómo estaba", "h:" + cur.id + ":" + s.id));
  return out;
}

/** The pair to show when nothing was picked: the address (?a= &b=), else the official against the board on screen,
 *  else its versions, its last snapshot, the last played seven; else the last two played. */
export function defaultPair(P: PzApi, ctx: CmpCtx): [string | null, string | null] {
  const cur = P.sel.board();
  const off = P.sel.official();
  const q = P.state.route.q;
  if (q.a || q.b) {
    const a = q.a || (cur && !cur.draft ? "b:" + cur.id + ":titular" : null);
    const b = q.b || null;
    if (itemOf(P, a, ctx) && itemOf(P, b, ctx)) return [a, b];
  }
  const played = P.state.W.matches.filter((m) => m.played && (m.cal.conv?.starters.length ?? 0) > 0);
  if (cur && !cur.draft) {
    if (off && off.id !== cur.id) return ["b:" + off.id + ":titular", "b:" + cur.id + ":titular"];
    const vs = VERS.filter((v) => v.id !== "titular" && verOf(cur.lineup, v.id).exists);
    if (vs.length) return ["b:" + cur.id + ":titular", "b:" + cur.id + ":" + vs[0].id];
    const sn = ctx.snaps[cur.id] ?? [];
    if (sn.length > 1) return ["h:" + cur.id + ":" + sn[1].id, "b:" + cur.id + ":titular"];
    const j = played[played.length - 1];
    if (j) return ["j:" + j.id, "b:" + cur.id + ":titular"];
  }
  if (played.length > 1) return ["j:" + played[played.length - 2].id, "j:" + played[played.length - 1].id];
  return [null, null];
}

export interface CmpRow {
  k: string;
  t: string;
  tag: "Sistema" | "Cambio" | "Entra" | "Sale" | "Hueco" | "Se mueve";
  cls: string;
}
export interface Comparison {
  ins: string[];
  outs: string[];
  moved: string[];
  rows: CmpRow[];
  aP: Record<string, PzSlot>;
  bP: Record<string, PzSlot>;
  paired: string[];
  sistema: boolean;
  same: boolean;
}

/** A against B, puesto by puesto: who comes in for whom (same code, else the nearest), who goes, who moves. */
export function compareItems(A: { formation: string; slots: PzSlot[] }, B: { formation: string; slots: PzSlot[] }, nm: (id: string) => string): Comparison {
  const aP: Record<string, PzSlot> = {};
  const bP: Record<string, PzSlot> = {};
  A.slots.forEach((s) => {
    if (s.playerId) aP[s.playerId] = s;
  });
  B.slots.forEach((s) => {
    if (s.playerId) bP[s.playerId] = s;
  });
  const ins = Object.keys(bP).filter((x) => !aP[x]);
  const outs = Object.keys(aP).filter((x) => !bP[x]);
  const moved = Object.keys(bP).filter((x) => aP[x] && aP[x].code !== bP[x].code);
  const rows: CmpRow[] = [];
  const used = new Set<string>();
  if (A.formation !== B.formation) rows.push({ k: "Sist.", t: A.formation + " → " + B.formation, tag: "Sistema", cls: "t-si" });
  const pairOf: Record<string, string> = {};
  ins.forEach((pid) => {
    const o = outs.find((x) => !used.has(x) && aP[x].code === bP[pid].code);
    if (o) {
      used.add(o);
      pairOf[pid] = o;
    }
  });
  ins.forEach((pid) => {
    if (pairOf[pid]) return;
    const s = bP[pid];
    let best: string | null = null;
    let bd = 26;
    outs.forEach((x) => {
      if (used.has(x)) return;
      const d = Math.hypot(aP[x].x - s.x, (aP[x].y - s.y) * 1.5);
      if (d < bd) {
        bd = d;
        best = x;
      }
    });
    if (best) {
      used.add(best);
      pairOf[pid] = best;
    }
  });
  ins.forEach((pid) => {
    const s = bP[pid];
    const o = pairOf[pid];
    rows.push(o ? { k: s.code, t: nm(o) + " → " + nm(pid), tag: "Cambio", cls: "t-cm" } : { k: s.code, t: "Entra " + nm(pid), tag: "Entra", cls: "t-en" });
  });
  outs
    .filter((o) => !used.has(o))
    .forEach((o) => {
      const hole = B.slots.find((s) => !s.playerId && s.code === aP[o].code);
      rows.push(hole ? { k: aP[o].code, t: nm(o) + " → nadie", tag: "Hueco", cls: "t-hu" } : { k: aP[o].code, t: "Sale " + nm(o), tag: "Sale", cls: "t-sa" });
    });
  moved.forEach((pid) => rows.push({ k: bP[pid].code, t: nm(pid) + ", antes de " + aP[pid].code, tag: "Se mueve", cls: "t-mu" }));
  B.slots.filter((s) => !s.playerId && !rows.some((r) => r.k === s.code && r.tag === "Hueco")).forEach((s) => rows.push({ k: s.code, t: "Sin nadie en B", tag: "Hueco", cls: "t-hu" }));
  return { ins, outs, moved, rows, aP, bP, paired: Object.values(pairOf), sistema: A.formation !== B.formation, same: !ins.length && !outs.length && !moved.length && A.formation === B.formation };
}

/** The headline of a comparison. */
export function cmpHead(c: Comparison, B: { formation: string }, nm: (id: string) => string): string {
  if (c.ins.length === 1 && !c.sistema) return "Entra " + nm(c.ins[0]);
  if (c.ins.length) return "Cambian " + c.ins.length + " de 7";
  if (c.sistema) return "Otro sistema: " + B.formation;
  if (c.moved.length) return "Mismos siete, otros sitios";
  if (c.rows.length) return "Falta uno en B";
  return "Los mismos siete";
}
export function cmpLine(c: Comparison, A: { formation: string }, B: { formation: string }, nm: (id: string) => string): string {
  const bits: string[] = [];
  if (c.sistema) bits.push(A.formation + " → " + B.formation);
  if (c.ins.length) bits.push((c.ins.length > 1 ? "entran " : "entra ") + fmt.list(c.ins.map(nm)));
  if (c.outs.length) bits.push((c.outs.length > 1 ? "salen " : "sale ") + fmt.list(c.outs.map(nm)));
  if (c.moved.length) bits.push(fmt.list(c.moved.map(nm)) + (c.moved.length > 1 ? " cambian" : " cambia") + " de puesto");
  return bits.length ? bits.join(" · ").replace(/^./, (x) => x.toUpperCase()) + "." : "Igual colocados: nada que cambiar.";
}

/** A seven as a PzVer (to ask the store for its media and química). */
export const asVer = (it: { formation: FormationName; slots: PzSlot[] }, tactics: Tactics): PzVer => ({ id: "titular", t: "", exists: true, formation: it.formation, freeMode: false, slots: it.slots, tactics });

/** The cara a cara numbers of one side. */
export function statsOf(P: PzApi, it: CmpItem, tactics: Tactics): { n: number; media: number | null; chem: number | null; inPlace: number; mins: number; gal: number | null } {
  const v = asVer(it, tactics);
  const on = it.slots.filter((s) => s.playerId);
  const ch = on.length > 1 ? P.sel.chem(v) : null;
  const inPlace = on.filter((s) => (P.sel.fit(s.playerId as string, s.code) ?? 0) >= 2).length;
  const mins = on.reduce((t, s) => t + (P.sel.player(s.playerId)?.min ?? 0), 0);
  let gal: number | null = null;
  if (it.kind === "board" && it.b) {
    const bv = verOf(it.b.lineup, it.ver);
    const ids = new Set(on.map((s) => s.playerId as string));
    const r = it.b.lineup.roles ?? {};
    const holders = [r.captainId ?? null, r.viceId ?? null, P.sel.taker(it.b, bv, "penalties"), P.sel.taker(it.b, bv, "freekicks"), P.sel.taker(it.b, bv, "corners")];
    gal = holders.filter((h) => !!h && ids.has(h)).length;
  }
  return { n: on.length, media: on.length ? P.sel.media(v) : null, chem: ch ? ch.v : null, inPlace, mins, gal };
}

/** «mejor» on the better side (never colour alone). */
export function cintaRow<T extends number | string | null>(k: string, a: T, b: T, better: "hi" | null, f: (x: T) => string = (x) => (x == null ? "—" : String(x))) {
  const comparable = better && a != null && b != null && a !== b;
  const ab = comparable ? (a as number) > (b as number) : false;
  const bb = comparable ? !ab : false;
  return { k, a: f(a), b: f(b), aBest: ab, bBest: bb };
}

/** Who has worn the armband in the season's played officials (the «capitán rotativo»). */
export function armbands(P: PzApi): Record<string, number> {
  const out: Record<string, number> = {};
  P.state.W.boards.forEach((b) => {
    if (!b.isOfficial || !b.matchId || !matchById(P, b.matchId)?.played) return;
    const c = b.lineup.roles?.captainId;
    if (c) out[c] = (out[c] ?? 0) + 1;
  });
  return out;
}

/** The dots of a mini (for the history rows, the strip and the origins). */
export const dots = (slots: readonly { x: number; y: number; playerId: string | null }[]): { x: number; y: number }[] => slots.filter((s) => s.playerId).map((s) => ({ x: s.x, y: s.y }));
