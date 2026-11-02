// r14 «La pizarra»: what the pitch shows (CAMPO-API § Sources), resolved from a stage spec — the prototype's
// resolveSiete / Ahora / Jugada / Pachanga / Comparar / tokens. Pure over the selectors the store hands in.
import { SYSTEMS_CATALOGUE } from "../../../../lib/formations";
import type { PosCode } from "../../../../lib/positions";
import { drawingPath } from "./registry";
import type { PzBoard, PzDiff, PzGalon, PzLink, PzMe, PzPlayer, PzRsvp, PzState, PzVer, PzView, StageSpec, Token, ViewSlot, Mark, OverlayPath } from "./types";

export interface ViewCtx {
  S: PzState;
  board(id?: string | null): PzBoard | null;
  ver(b?: PzBoard | null, v?: PzState["version"]): PzVer | null;
  player(id: string | null | undefined): PzPlayer | null;
  name(id: string | null | undefined): string;
  rsvp(pid: string): PzRsvp;
  fit(pid: string, code: PosCode): number | null;
  fitWord(g: number | null): string;
  galones(pid: string, b?: PzBoard | null, v?: PzVer | null): PzGalon[];
  links(v?: PzVer | null): PzLink[];
  diff(a: PzVer | null, b: PzVer | null): PzDiff | null;
  canEdit(b: PzBoard | null | undefined): boolean;
  rivalOf(b: PzBoard | null): { name: string; players: { num: number | null; note: string; x: number; y: number; code: string }[] } | null;
  me(): PzMe;
}

type Base = Omit<PzView, "source" | "camera" | "focus" | "zoom" | "plates" | "layer" | "editable" | "glideMs" | "marksExtra" | "chrome" | "tappable" | "gradaPad" | "flash"> & { captionSet?: boolean; glideMs?: number; gradaPad?: number; tappable?: boolean };

const empty = (): Base => ({ boardId: null, formation: "", free: false, slots: [], tokens: [], links: [], overlay: null, ghost: [], ball: null, labels: [], caption: "", rivalName: "" });

/** A rival disc that would land on one of our shirts moves ~13 % away (display only; the data keeps its spot). */
export function rivalSpotNear(x: number, y: number, slots: { x: number; y: number; pid: string | null }[]): { x: number; y: number } {
  // (a shirt with its plate is wide: ±14 % across, ±10 % down; an empty slot's ring is smaller)
  const hit = (px: number, py: number) => slots.some((s) => Math.abs(s.x - px) < (s.pid ? 14 : 9) && Math.abs(s.y - py) * 1.4 < (s.pid ? 14 : 11));
  const inX = (v: number) => Math.max(9, Math.min(91, v));
  const inY = (v: number) => Math.max(6, Math.min(94, v));
  if (!hit(inX(x), inY(y))) return { x: inX(x), y: inY(y) };
  const near = slots.slice().sort((a, b) => Math.abs(a.x - x) + Math.abs(a.y - y) - (Math.abs(b.x - x) + Math.abs(b.y - y)))[0];
  const dx = !near || x >= near.x ? 14 : -14;
  const tries: [number, number][] = [
    [x + dx, y],
    [x - dx, y],
    [x, y - 12],
    [x, y + 12],
    [x + dx, y - 12],
    [x - dx, y - 12],
    [x + dx, y + 12],
    [x - dx, y + 12],
  ];
  for (const [tx0, ty0] of tries) {
    const tx = inX(tx0);
    const ty = inY(ty0);
    if (!hit(tx, ty)) return { x: tx, y: ty };
  }
  return { x: inX(x + dx), y: inY(y) };
}

function resolveSiete(spec: StageSpec, c: ViewCtx): Base {
  const { S } = c;
  const b = spec.boardId ? c.board(spec.boardId) : c.board();
  let v = b ? c.ver(b, spec.version ?? S.version) : null;
  if (!v) {
    const f = SYSTEMS_CATALOGUE.find((s) => s.id === "2-3-1");
    v = { id: "titular", t: "Titular", exists: false, formation: "2-3-1", freeMode: false, tactics: { defLine: "Media", press: "Media", width: "Media", tempo: "Medio", mentality: "Equilibrada", buildup: "Mixta", attackFocus: "Equilibrado" }, slots: (f?.spots ?? []).map(([code, x, y]) => ({ code, x, y, playerId: null })) };
  }
  const m = c.me();
  const lk = (spec.layer ?? S.layer) === "quimica" ? c.links(v) : [];
  const onScreen = !spec.boardId || spec.boardId === S.boardId;
  const sel = onScreen ? S.sel : null;
  const slots: ViewSlot[] = v.slots.map((s, i) => {
    const p = c.player(s.playerId);
    const r = p ? c.rsvp(p.id) : null;
    const g = p ? c.fit(p.id, s.code) : null;
    return {
      i,
      code: s.code,
      x: s.x,
      y: s.y,
      pid: s.playerId,
      empty: !s.playerId,
      p,
      galones: p ? c.galones(p.id, b, v) : [],
      fit: g,
      fitT: c.fitWord(g),
      r,
      me: !!(p && m.pid === p.id),
      sel: !!(sel && sel.from === "campo" && sel.slot === i),
      picked: onScreen && S.slotPick === i,
      over: onScreen && S.over === "slot:" + i,
      drop: onScreen && !!S.drag,
      out: !!(p && r && !r.can),
    };
  });
  const tokens: Token[] = [];
  const rv = spec.rival ? c.rivalOf(b) : null;
  if (rv) rv.players.forEach((rp, k) => {
    const q = rivalSpotNear(rp.x, rp.y, slots);
    // (a disc stays inside the lines; its code goes when it would sit on one of our plates — the dorsal stays)
    const x = Math.max(9, Math.min(91, q.x));
    const y = Math.max(6, Math.min(94, q.y));
    const crowded = slots.some((s) => s.pid && Math.abs(s.x - x) < 17 && Math.abs(s.y - y) < 12);
    tokens.push({ id: "r" + k, kind: "rival", x, y, num: rp.num ?? "", code: crowded ? "" : (spec.rivalCode ?? rv.name.slice(0, 3).toUpperCase()), label: rp.code, note: rp.note });
  });
  let overlay = spec.overlay ?? null;
  if (!overlay && spec.drawings && b) {
    const paths = (b.lineup.drawings ?? []).map((d) => drawingPath(d)).filter((x): x is OverlayPath => !!x);
    overlay = paths.length ? { paths } : null;
  }
  return { ...empty(), boardId: b ? b.id : null, formation: v.formation, free: v.freeMode, slots, tokens, links: lk.map((l) => ({ a: slots[l.i], b: slots[l.j], t: l.t, word: l.word, why: l.why })), overlay, rivalName: rv ? rv.name : "" };
}

function resolveJugada(spec: StageSpec, c: ViewCtx): Base {
  const play = spec.play;
  if (!play || !play.steps.length) return empty();
  const i = Math.max(0, Math.min(play.steps.length - 1, spec.step ?? 0));
  const st = play.steps[i];
  const prev = i > 0 ? play.steps[i - 1] : null;
  const b = c.board();
  const v = c.ver(b) ?? { slots: [] };
  const tokens: Token[] = st.p.map((pt, k) => {
    const pid = v.slots[k]?.playerId ?? undefined;
    return { id: "m" + k, kind: "us", pid, x: pt[0], y: pt[1], label: pid ? c.name(pid) : (v.slots[k]?.code ?? ""), code: v.slots[k]?.code ?? "" };
  });
  const rv = c.rivalOf(b);
  const rname = spec.rivalName ?? rv?.name ?? "";
  const rcode = spec.rivalCode ?? (rname ? rname.slice(0, 3).toUpperCase() : "");
  (st.r ?? []).forEach((pt, k) => {
    const rp = rv?.players[k];
    tokens.push({ id: "r" + k, kind: "rival", x: pt[0], y: pt[1], num: rp?.num ?? "", code: rcode, label: rp?.code ?? "Rival", note: rp?.note ?? "" });
  });
  const ghost = spec.ghost !== false && prev ? prev.p.map((pt) => ({ x: pt[0], y: pt[1] })) : [];
  const paths: OverlayPath[] = [];
  if (prev) {
    st.p.forEach((pt, k) => {
      const a = prev.p[k];
      if (a && Math.abs(a[0] - pt[0]) + Math.abs(a[1] - pt[1]) > 6) paths.push({ kind: "carrera", pts: [a, pt] });
    });
    if (prev.b && st.b && Math.abs(prev.b[0] - st.b[0]) + Math.abs(prev.b[1] - st.b[1]) > 4) paths.push({ kind: "pase", pts: [prev.b, st.b] });
  }
  return {
    ...empty(),
    tokens,
    ghost,
    ball: st.b ? { x: st.b[0], y: st.b[1] } : null,
    overlay: { paths: [...paths, ...(spec.overlay?.paths ?? [])] },
    rivalName: rname,
    caption: spec.caption ?? `${i + 1}/${play.steps.length} · ${st.title}`,
    captionSet: true,
    glideMs: Math.round((st.dur ?? 1.4) * 1000 * (spec.rate ? 1 / spec.rate : 1)),
  };
}

/** The live seven: the spec's (Partido hands it in from la mesa), else the official's titular. */
function resolveAhora(spec: StageSpec, c: ViewCtx): Base {
  const base = resolveSiete({ ...spec, boardId: spec.boardId, editable: false, rival: false, drawings: false }, c);
  const next = spec.next ?? null;
  if (spec.slots) {
    base.slots = spec.slots.map((s, i) => {
      const p = c.player(s.playerId);
      return { i, code: s.code, x: s.x, y: s.y, pid: s.playerId, empty: !s.playerId, p, galones: [], fit: null, fitT: "", r: null, me: !!(p && c.me().pid === p.id), sel: false, picked: false, over: false, drop: false, out: false };
    });
  }
  const marks = spec.marks ?? {};
  base.slots = base.slots.map((s) => {
    const ring = next && next.out === s.pid ? "sale" : "";
    const mk: Mark[] = s.pid ? (marks[s.pid] ?? []) : [];
    return { ...s, sel: false, picked: false, over: false, drop: false, marks: mk, ring, ringT: ring && next ? `Sale en el ${next.min}′ · entra ${c.name(next.in)}` : "" };
  });
  base.links = [];
  base.caption = spec.caption != null ? spec.caption : next ? `Próximo cambio · ${next.min}′ · entra ${c.name(next.in)} por ${c.name(next.out)}` : "";
  base.captionSet = true;
  if (next && spec.entra !== false) {
    const outS = base.slots.find((s) => s.pid === next.out);
    if (outS) base.tokens.push({ id: "entra-" + next.in, kind: "ghost", pid: next.in, x: outS.x > 50 ? Math.min(97, outS.x + 13) : Math.max(3, outS.x - 13), y: outS.y, label: c.name(next.in), ring: "entra", tag: `Entra ${next.min}′` });
  }
  return base;
}

function resolvePachanga(spec: StageSpec, c: ViewCtx): Base {
  const names = spec.names ?? ["Con petos", "Sin petos"];
  if (spec.tokens) return { ...empty(), tokens: spec.tokens, labels: spec.labels ?? [], caption: spec.caption ?? "", gradaPad: 40, tappable: !!spec.tappable };
  const teams = spec.teams ?? [[], []];
  const pats = spec.pats ?? ["rayas", "liso"];
  // keeper + two lines per half, 16 % apart, the keeper's centre kept free
  const shape = (n: number, top: boolean): [number, number][] => {
    const out: [number, number][] = [[50, top ? 6 : 94]];
    const rest = n - 1;
    const l1 = Math.ceil(rest / 2);
    const l2 = rest - l1;
    (
      [
        [l1, top ? 22 : 78],
        [l2, top ? 38 : 62],
      ] as const
    ).forEach(([cnt, y]) => {
      for (let j = 0; j < cnt; j++) out.push([((j + 1) * 100) / (cnt + 1), y]);
    });
    return out;
  };
  const tokens: Token[] = [];
  teams.forEach((t, ti) => {
    const pts = shape(t.length, ti === 0);
    t.forEach((pid, k) => tokens.push({ id: `t${ti}-${pid}`, kind: ti === 0 ? "petos" : "sinpetos", pat: pats[ti], pid: c.player(pid) ? pid : undefined, x: pts[k]?.[0] ?? 50, y: pts[k]?.[1] ?? 50, label: c.name(pid), bib: names[ti] }));
  });
  return {
    ...empty(),
    tokens,
    labels: [
      { x: 4, y: 2.5, t: names[0], align: "left" },
      { x: 4, y: 97.5, t: names[1], align: "left" },
    ],
    caption: spec.caption ?? "",
    gradaPad: 40,
    tappable: !!spec.tappable,
  };
}

function resolveComparar(spec: StageSpec, c: ViewCtx): Base {
  const A = spec.a ?? {};
  const B = spec.b ?? {};
  const ba = c.board(A.boardId) ?? c.board();
  const bb = B.boardId ? c.board(B.boardId) : null;
  const va = ba ? c.ver(ba, A.version ?? "titular") : null;
  const vb = bb ? c.ver(bb, B.version ?? "titular") : null;
  const base = resolveSiete({ boardId: ba?.id, version: A.version ?? "titular", layer: "nada" }, c);
  const d = vb ? c.diff(va, vb) : null;
  if (d) {
    base.slots = base.slots.map((s) => (s.pid && d.ins.includes(s.pid) ? { ...s, ring: "entra", ringT: "Entra respecto al otro" } : s.pid && d.moved.includes(s.pid) ? { ...s, ring: "mueve", ringT: "Cambia de puesto" } : s));
    vb?.slots.forEach((s, k) => {
      if (s.playerId && d.outs.includes(s.playerId)) {
        const pg = c.player(s.playerId);
        base.tokens.push({ id: "g" + k, kind: "ghost", x: Math.min(95, s.x + 8), y: Math.max(4, s.y - 6), num: pg?.num ?? "", code: "Sale", label: c.name(s.playerId), ring: "sale", note: "Sale " + c.name(s.playerId) });
      }
    });
  }
  return { ...base, diff: d };
}

/** The resolved pitch model PiCampo renders. */
export function resolveView(spec: StageSpec, c: ViewCtx): PzView {
  const src = spec.source ?? "siete";
  let out: Base;
  if (src === "jugada") out = resolveJugada(spec, c);
  else if (src === "ahora") out = resolveAhora(spec, c);
  else if (src === "pachanga") out = resolvePachanga(spec, c);
  else if (src === "comparar") out = resolveComparar(spec, c);
  else if (src === "tokens") out = { ...empty(), tokens: spec.tokens ?? [], ball: spec.ball ?? null, ghost: Array.isArray(spec.ghost) ? spec.ghost : [], overlay: spec.overlay ?? null, caption: spec.caption ?? "", labels: spec.labels ?? [], rivalName: spec.rivalName ?? "" };
  else if (src === "none") out = { ...empty(), none: true };
  else out = resolveSiete(spec, c);
  const editable = src === "siete" ? spec.editable !== false && c.canEdit(spec.boardId ? c.board(spec.boardId) : c.board()) : !!spec.editable;
  const view: PzView = {
    ...out,
    source: src,
    camera: spec.camera ?? "pizarra",
    focus: spec.focus ?? null,
    zoom: spec.zoom ?? null,
    plates: spec.plates ?? "",
    layer: spec.layer ?? c.S.layer,
    editable,
    glideMs: out.glideMs ?? spec.glideMs ?? 420,
    // (the ahora source already puts the marks on its slots)
    marksExtra: src === "ahora" ? null : (spec.marks ?? null),
    chrome: spec.chrome !== false,
    tappable: !!(spec.tappable || out.tappable),
    gradaPad: spec.gradaPad ?? out.gradaPad ?? 0,
    flash: c.S.flash,
  };
  if (spec.caption != null && !out.captionSet && src !== "jugada") view.caption = spec.caption;
  if (spec.labels && !out.labels.length) view.labels = spec.labels;
  if (spec.rivalName) view.rivalName = spec.rivalName;
  if (spec.overlay && src !== "siete" && src !== "jugada") view.overlay = spec.overlay;
  if (spec.ball && !view.ball) view.ball = spec.ball;
  delete (view as { captionSet?: boolean }).captionSet;
  return view;
}
