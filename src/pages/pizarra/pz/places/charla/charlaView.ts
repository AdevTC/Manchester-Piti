// r14 «La pizarra» · La charla: its steps, built from the board on screen (always the TITULAR) and the charla's own
// choices (order, the blocks switched off, the jugada, the speed). The port of PiCharla's `steps()`: the voice is
// tied to WHAT is said (content keys of data/voz.ts), never to a step number, so it follows its player or its play.
import { systemDef } from "../../../../../lib/formations";
import { libraryPlays } from "../../../playLibrary";
import { rivalSpots } from "../../../v2/rival";
import { dangerOf } from "../../../data/rival";
import { planResumen } from "../plan/planView";
import { huecoVoz, jugadaVoz, sieteVoz } from "../../../data/voz";
import type { Quedada } from "../../../data/quedada";
import type { Play } from "../../../plays";
import type { PzApi } from "../../store/api";
import { fmt } from "../../store/fmt";
import type { PzBoard, PzMatch, PzPlay, PzStatus, PzVer, StageSpec, Token } from "../../store/types";

export type BlockId = "sistema" | "siete" | "suplentes" | "galones" | "rival" | "plan" | "jugada" | "quedada" | "vamos";
export const BLOCKS: { id: BlockId; t: string; icon: string }[] = [
  { id: "sistema", t: "El sistema", icon: "pitch" },
  { id: "siete", t: "Los siete uno a uno", icon: "shirt" },
  { id: "suplentes", t: "Los suplentes", icon: "bench" },
  { id: "galones", t: "Galones y lanzadores", icon: "armband" },
  { id: "rival", t: "El rival", icon: "flag" },
  { id: "plan", t: "El plan", icon: "board" },
  { id: "jugada", t: "La jugada", icon: "play" },
  { id: "quedada", t: "La quedada", icon: "pin" },
  { id: "vamos", t: "¡Vamos, Piti!", icon: "megaphone" },
];
export const BLOCK_IDS = BLOCKS.map((b) => b.id);
/** Seconds each step lasts at 1× (a voice longer than that holds its step). */
export const BASE: Record<string, number> = { sistema: 4.5, siete: 3.6, hueco: 2.6, suplentes: 6, galones: 5.5, rival: 7, plan: 8, quedada: 6.5, vamos: 4 };
export const SPEEDS: [number, string, string][] = [
  [0.75, "0,75×", "Más despacio"],
  [1, "1×", "Velocidad normal"],
  [1.5, "1,5×", "Más deprisa"],
];
const GAL_T: Record<string, string> = { C: "Capitán", V: "Vice", P: "Penaltis", F: "Faltas", E: "Córners" };

/** The charla's own choices (a slice of the store, remembered per board on this device). */
export interface CharlaChoices {
  order: BlockId[];
  off: Partial<Record<BlockId, boolean>>;
  jugada: string | null;
  speed: number;
}
export const CHARLA0: CharlaChoices = { order: BLOCK_IDS, off: {}, jugada: null, speed: 1 };

export interface Chip {
  t: string;
  icon: string;
  cls: string;
}
export interface Row {
  kind: "disc" | "gal" | "ic";
  mark: string;
  t: string;
  s: string;
}
export interface Step {
  id: string;
  block: BlockId;
  /** The voice's content key (data/voz.ts). */
  vkey: string;
  /** Short name (the strip, the guion, the presenter). */
  t: string;
  kick: string;
  head: string;
  hCls: "" | "is-huge" | "is-mid";
  line: string;
  chips: Chip[];
  rows: Row[];
  claves: { t: string; icon: string }[];
  bench: { pid: string; name: string; w: string }[];
  foot: string;
  pid: string | null;
  spec: StageSpec;
  /** The play shown (jugada steps). */
  play: string | null;
  base: number;
  /** Its voice's length (s, 0 = none). */
  vdur: number;
  /** How long it lasts now (s): the base at the speed, or the voice if longer. */
  dur: number;
}
export interface BlockState {
  id: BlockId;
  on: boolean;
  na: boolean;
  why: string;
}
export interface CharlaModel {
  steps: Step[];
  blocks: BlockState[];
  b: PzBoard | null;
  v: PzVer | null;
  M: PzMatch | null;
  st: PzStatus | null;
  plays: Play[];
  chosen: Play | null;
  /** The chosen play as the pitch's `jugada` source reads it. */
  pz: PzPlay | null;
  benchIds: string[];
  empty: boolean;
  none: boolean;
}

/** The app's Play → the pitch's PzPlay: one point per slot of the seven (a player missing from a step keeps where he
 *  was, or his slot). */
export function playToPz(play: Play, v: PzVer): PzPlay {
  let prev: [number, number][] = v.slots.map((s) => [s.x, s.y]);
  return {
    id: play.id,
    name: play.name,
    steps: play.frames.map((f, k) => {
      const p = v.slots.map((s, i): [number, number] => {
        const at = s.playerId ? f.players[s.playerId] : undefined;
        return at ? [at.x, at.y] : prev[i];
      });
      prev = p;
      return { title: f.title || (k === 0 ? "Así empieza" : "Paso " + (k + 1)), note: f.note, p, r: f.rivals.map((r): [number, number] => [r.x, r.y]), b: [f.ball.x, f.ball.y], dur: 1.6 };
    }),
  };
}

const plural = fmt.plural;

/** The charla on screen. `voz`: the length (s) of each content key that has a voice; `muted`: voices off here. */
export function buildCharla(P: PzApi, cs: CharlaChoices, voz: ReadonlyMap<string, number>, o: { muted: boolean; quedada: Quedada | null }): CharlaModel {
  const out: Step[] = [];
  const blocks: BlockState[] = [];
  const b = P.sel.board();
  const v = b ? P.sel.ver(b, "titular") : null;
  const M = b?.matchId ? P.sel.match(b.matchId) : null;
  if (!b || !v) return { steps: out, blocks, b, v, M, st: null, plays: [], chosen: null, pz: null, benchIds: [], empty: true, none: !b };
  const L = b.lineup;
  const st = P.sel.status(v);
  const J = M ? (M.j != null ? "J" + M.j + " · " : "") + M.rival : b.name;
  const base: StageSpec = { source: "siete", boardId: b.id, version: "titular", camera: "grada", layer: "nada", rival: false, drawings: false, chrome: false, focus: null };
  const sd = systemDef(v.formation);
  const placed = v.slots.filter((s) => s.playerId).map((s) => s.playerId as string);
  const pls = placed.map((id) => P.sel.player(id)).filter((p): p is NonNullable<typeof p> => !!p);
  const maxNota = (p: (typeof pls)[number]) => Math.max(-1, ...p.notas.map((n) => n.n));
  const topG = pls.slice().sort((a, c) => c.goals - a.goals)[0];
  const topN = pls.slice().sort((a, c) => maxNota(c) - maxNota(a))[0];
  const topM = pls.slice().sort((a, c) => c.min - a.min)[0];
  const used = { g: false, n: false, m: false };
  const oneLiner = (p: (typeof pls)[number]): string => {
    const ns = p.notas;
    if (p.guest) return "Invitado" + (p.by ? ": lo trae " + P.sel.name(p.by) : "") + (p.note ? " · " + p.note : "");
    if (topG && topG.id === p.id && p.goals > 0 && !used.g) {
      used.g = true;
      return "El que más mete: " + plural(p.goals, "gol", "goles") + " en " + plural(p.pj, "partido", "partidos");
    }
    if (topN && topN.id === p.id && ns.length && !used.n) {
      used.n = true;
      const best = ns.slice().sort((a, c) => c.n - a.n)[0];
      return "La mejor nota del equipo: " + fmt.nota(best.n) + (best.j != null ? " en la J" + best.j : " contra " + best.rival);
    }
    if (topM && topM.id === p.id && p.min && !used.m) {
      used.m = true;
      return "El que más minutos lleva: " + p.min + "′";
    }
    if (ns.length >= 2) return fmt.nota(ns.reduce((a, n) => a + n.n, 0) / ns.length) + " de media en sus " + (ns.length === 2 ? "dos" : ns.length) + " partidos";
    if (ns.length === 1) return fmt.nota(ns[0].n) + (ns[0].j != null ? " en la J" + ns[0].j : "") + " contra " + ns[0].rival;
    return "Su primer partido con nosotros";
  };
  const speed = cs.speed || 1;
  const push = (block: BlockId, s: Omit<Step, "block" | "chips" | "rows" | "claves" | "bench" | "foot" | "pid" | "play" | "vdur" | "dur" | "line" | "hCls"> & Partial<Step>) => {
    const vd = voz.get(s.vkey) ?? 0;
    out.push({ block, chips: [], rows: [], claves: [], bench: [], foot: "", pid: null, play: null, line: "", hCls: "", ...s, vdur: vd, dur: Math.max(s.base / speed, o.muted ? 0 : vd) });
  };
  // availability: a block with nothing to say is skipped, and the strip says why
  const W = P.state.W;
  const benchIds = [...W.squad, ...W.guests]
    .map((p) => p.id)
    .filter((id) => !placed.includes(id))
    .filter((id) => {
      const r = P.sel.rsvp(id).v;
      return r === "yes" || r === "maybe" || r === "guest";
    });
  const rank: Record<string, number> = { yes: 0, guest: 1, maybe: 2 };
  benchIds.sort((a, c) => (rank[P.sel.rsvp(a).v] ?? 3) - (rank[P.sel.rsvp(c).v] ?? 3));
  const R = L.rival ?? null;
  const plan = L.plan ?? null;
  const claves = (plan?.claves ?? []).filter(Boolean).slice(0, 3);
  const cond = L.condPlan ?? [];
  const plays = [...(L.plays ?? []), ...libraryPlays(L)];
  const chosen = plays.find((p) => p.id === cs.jugada) ?? L.plays?.[0] ?? plays.find((p) => p.id === "lib-corner") ?? plays[0] ?? null;
  const avail: Record<BlockId, boolean> = {
    sistema: true,
    siete: true,
    suplentes: benchIds.length > 0,
    galones: true,
    rival: !!R && R.players.length > 0,
    plan: claves.length > 0 || cond.length > 0 || !!plan?.notes,
    jugada: !!chosen,
    quedada: !!M,
    vamos: true,
  };
  const why: Partial<Record<BlockId, string>> = { suplentes: "Nadie más convocado", rival: "Sin su siete: añádelo en Plan", plan: "Sin plan todavía", jugada: "Sin jugadas", quedada: "Sin partido enlazado" };
  const order = cs.order.filter((id) => BLOCK_IDS.includes(id));
  BLOCK_IDS.forEach((id) => {
    if (!order.includes(id)) order.push(id);
  });
  const pz = chosen ? playToPz(chosen, v) : null;
  for (const id of order) {
    const on = !cs.off[id] && avail[id];
    blocks.push({ id, on, na: !avail[id], why: why[id] ?? "" });
    if (!on) continue;
    if (id === "sistema") {
      push(id, {
        id: "sistema",
        vkey: "sistema",
        t: "El sistema · " + v.formation,
        kick: "El sistema · " + J,
        head: v.freeMode ? "Libre" : v.formation,
        hCls: "is-huge",
        line: "Así salimos: " + sd.name.toLowerCase() + ", " + sd.character + ". " + sd.about,
        base: BASE.sistema,
        spec: { ...base },
        chips: st.full ? [] : [{ t: st.n + " de 7: " + (7 - st.n === 1 ? "falta 1" : "faltan " + (7 - st.n)), icon: "warn", cls: "is-warn" }],
      });
    }
    if (id === "siete") {
      v.slots.forEach((s, k) => {
        const p = s.playerId ? P.sel.player(s.playerId) : null;
        const n = k + 1;
        if (!p) {
          push(id, { id: "siete-hueco-" + k, vkey: huecoVoz(s.code), t: "Hueco · " + s.code, kick: "Los siete · " + n + " de 7 · " + s.code, head: "Hueco libre", hCls: "is-mid", line: "Falta un " + P.sel.posName(s.code).toLowerCase() + ": sale así en la charla.", base: BASE.hueco, spec: { ...base, camera: "foco", focus: { x: s.x, y: s.y } } });
          return;
        }
        const r = P.sel.rsvp(p.id);
        const chips: Chip[] = P.sel.galones(p.id, b, v).map((g) => ({ t: GAL_T[g.k] ?? g.t, icon: "armband", cls: g.k === "C" ? "is-warn" : "" }));
        if (r.v === "maybe") chips.push({ t: "Duda" + (r.why ? ": " + r.why : ""), icon: "help", cls: "is-warn" });
        if (r.v === "no" || r.v === "baja" || r.v === "ausente") chips.push({ t: r.t, icon: "cross", cls: "is-bad" });
        if (r.v === "none") chips.push({ t: "Sin responder", icon: "dots", cls: "is-mute" });
        push(id, { id: "siete-" + p.id, vkey: sieteVoz(p.id), pid: p.id, t: p.shirt + " · " + s.code, kick: "Los siete · " + n + " de 7 · " + s.code + " · " + P.sel.posName(s.code).toLowerCase(), head: p.shirt, line: oneLiner(p), chips, base: BASE.siete, spec: { ...base, camera: "foco", focus: { pid: p.id } } });
      });
    }
    if (id === "suplentes") {
      const subs = (L.subs ?? []).slice(0, 3).map((x): Row => ({ kind: "ic", mark: "swap", t: x.min + "′ · entra " + P.sel.name(x.in), s: "por " + P.sel.name(x.out) }));
      push(id, {
        id: "suplentes",
        vkey: "suplentes",
        t: "Los suplentes · " + benchIds.length,
        kick: "El banquillo · la convocatoria",
        head: "Los suplentes",
        hCls: "is-mid",
        line: subs.length ? "Los cambios ya tienen minuto:" : "Todos entran: estad listos.",
        base: BASE.suplentes,
        spec: { ...base },
        bench: benchIds.slice(0, 6).map((pid) => {
          const r = P.sel.rsvp(pid);
          return { pid, name: P.sel.name(pid), w: r.v === "guest" ? "Invitado" : r.t };
        }),
        rows: subs,
      });
    }
    if (id === "galones") {
      const ro = L.roles ?? {};
      const T = L.takers;
      const nm = (pid: string) => P.sel.name(pid) + (placed.includes(pid) ? "" : " (no está en el siete)");
      const lst = (xs: (string | undefined)[]) =>
        xs
          .filter((x): x is string => !!x)
          .map(nm)
          .join(" › ") || "Sin elegir";
      const rows: Row[] = [
        { kind: "gal", mark: "C", t: ro.captainId ? nm(ro.captainId) : "Sin brazalete", s: "El brazalete" + (ro.viceId ? " · vice " + nm(ro.viceId) : "") },
        { kind: "gal", mark: "P", t: lst(T?.penalties?.length ? T.penalties : [ro.penaltiesId]), s: "Los penaltis, en este orden" },
        { kind: "gal", mark: "F", t: lst(T?.freekicks?.length ? T.freekicks : [ro.freekicksId]), s: "Las faltas" },
        { kind: "gal", mark: "E", t: lst(T?.corners?.length ? T.corners : [ro.cornersId]), s: "Los córners" },
      ];
      push(id, { id: "galones", vkey: "galones", t: "Galones y lanzadores", kick: "Las pelotas paradas · quién la toca", head: "Galones y lanzadores", hCls: "is-mid", rows, base: BASE.galones, spec: { ...base } });
    }
    if (id === "rival" && R) {
      const name = M?.rival ?? "El rival";
      const spots = rivalSpots(R);
      const code = name.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "").slice(0, 3).toUpperCase();
      const tokens: Token[] = R.players.map((rp, k) => ({ id: "r" + k, kind: "rival", x: spots[k]?.x ?? 50, y: spots[k]?.y ?? 20, num: rp.num ?? "", code, label: "", note: rp.note ?? "" }));
      const d = dangerOf(R);
      const noted = R.players.map((x, i) => ({ ...x, i })).filter((x) => x.note);
      noted.sort((a, c) => (d && c.i === d.i ? 1 : 0) - (d && a.i === d.i ? 1 : 0));
      push(id, {
        id: "rival",
        vkey: "rival",
        t: "El rival · " + name,
        kick: "El rival · " + R.formation,
        head: name,
        hCls: "is-mid",
        line: noted.length ? "Lo que hay que saber de ellos:" : "Su siete, en coral.",
        base: BASE.rival,
        rows: noted.slice(0, 4).map((x): Row => ({ kind: "disc", mark: x.num != null ? String(x.num) : "?", t: (x.num != null ? x.num + " · " : "") + (spots[x.i] ? posOfRival(R.formation, x.i) : "rival"), s: x.note ?? "" })),
        spec: { source: "tokens", tokens, camera: "grada", chrome: false, rivalName: name, rivalCode: code },
      });
    }
    if (id === "plan") {
      // (PLAN's summary: the same words and icons as Plan)
      const R0 = planResumen(P, b.id);
      const ks = R0?.claves ?? claves.map((t) => ({ t, icon: "flag" }));
      const rule = R0?.sipasa[0] ?? "";
      push(id, {
        id: "plan",
        vkey: "plan",
        t: "El plan · " + (ks.length ? plural(ks.length, "clave", "claves") : "Si pasa…"),
        kick: "El plan · contra " + (M ? M.rival : "el rival"),
        head: ks.length ? "Nuestras claves" : "El plan",
        hCls: "is-mid",
        line: ks.length ? (R0?.danger ? R0.danger + "." : "") : (R0?.notas ?? plan?.notes ?? ""),
        foot: rule || (ks.length ? (R0?.notas ?? "") : ""),
        base: BASE.plan,
        claves: ks.map((c) => ({ t: c.t, icon: KEY_ICON[c.icon] ?? "flag" })),
        spec: { ...base, drawings: true },
      });
    }
    if (id === "jugada" && chosen && pz) {
      const kind = chosen.kind === "propia" ? "Tuya" : chosen.name;
      pz.steps.forEach((ps, k) => {
        push(id, {
          id: "jugada-" + k,
          vkey: jugadaVoz(chosen.id, k),
          t: chosen.name + " · " + (k + 1) + "/" + pz.steps.length,
          kick: "La jugada · " + (chosen.kind === "propia" ? kind + " · " : "") + "paso " + (k + 1) + " de " + pz.steps.length,
          head: k === 0 ? chosen.name : ps.title,
          hCls: "is-mid",
          line: (k === 0 ? ps.title + ". " : "") + (ps.note ?? ""),
          base: (ps.dur ?? 1.6) + 1.6,
          chips: (ps.r ?? []).length ? [{ t: "En coral: " + (M?.rival ?? "el rival"), icon: "flag", cls: "is-bad" }] : [],
          spec: { source: "jugada", play: pz, playId: chosen.id, step: k, camera: "grada", chrome: false, ghost: true, rate: speed, caption: "" },
          play: chosen.id,
        });
      });
    }
    if (id === "quedada" && M) {
      const q = o.quedada;
      const rows: Row[] = [{ kind: "ic", mark: "whistle", t: "Saque a las " + fmt.hm(M.at), s: fmt.dayLong(M.at) + (M.home === true ? " · en casa, de celeste" : M.home === false ? " · fuera" : "") }];
      if (M.venue) rows.push({ kind: "ic", mark: "pin", t: M.venue, s: "El campo" });
      if (q?.note) rows.push({ kind: "ic", mark: "chat", t: q.note, s: "Lo que dice el capitán" });
      push(id, {
        id: "quedada",
        vkey: "quedada",
        t: "La quedada · " + fmt.day(M.at),
        kick: "La quedada · " + J,
        head: q ? "Quedamos a las " + fmt.hm(q.at) : "Nos vemos a las " + fmt.hm(M.at),
        hCls: "is-mid",
        line: q ? q.where + "." : "Sin hora de quedar todavía: el saque manda.",
        rows,
        base: BASE.quedada,
        spec: { ...base },
      });
    }
    if (id === "vamos") push(id, { id: "vamos", vkey: "vamos", t: "¡Vamos, Piti!", kick: "La charla · " + J, head: "¡Vamos, Piti!", hCls: "is-huge", line: "Juntos. Como lo hemos hablado.", base: BASE.vamos, spec: { ...base } });
  }
  return { steps: out, blocks, b, v, M, st, plays, chosen, pz, benchIds, empty: st.n === 0, none: false };
}

const KEY_ICON: Record<string, string> = { spark: "spark", eye: "eye", ball: "ball", shield: "shield", users: "users", flag: "flag" };

function posOfRival(formation: Parameters<typeof systemDef>[0], i: number): string {
  const spot = systemDef(formation).spots[i];
  return spot ? spot[0] : "rival";
}

/** «1:18». */
export const mmss = (s: number): string => {
  const t = Math.max(0, Math.round(s));
  return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
};
