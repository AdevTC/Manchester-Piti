// r14 «La pizarra» · Dibujar (PiDibujar.dc.html): the tool dock and the layer over the grass, mounted by the shell over
// the stage while P.state.drawing (region "dock"). Two surfaces: the board's drawings (the Siete: Lápiz, Flecha,
// Carrera, Pase, Zona, Texto, Borrar · Unir, Foco, Medir, Fuera; three named colours; the strokes' list; mark, move,
// delete; «Jugada» turns the runs and passes into a play) and the open play's step (Jugadas › Editar: drag shirts,
// rivals and the ball — Mayús or «Varias a la vez» moves several —, bend a run by its 44 px handle; arrows, Intro,
// Supr, Esc on each piece). Every change goes through act.saveBoard (undoable, Ctrl Z / Ctrl ⇧ Z).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { usePz } from "../../store/context";
import type { PzApi } from "../../store/api";
import type { RegionProps } from "../../store/types";
import type { BoardPoint, Stroke, StrokeColor } from "../../../../../lib/schemas";
import { drawingToPlay, convertible as appConvertible } from "../../../v2/playPaths";
import { newId } from "../../../drawings";
import { fmt } from "../../store/fmt";
import { COLORS, COLOR_WORD, ICONS, MAX_STROKES, STICK, TOOLS, dd, hitStroke, nearPlayer, pinned, strokeFrom, strokeName, strokePath, bp, type DrawCtx, type ToolId } from "./drawView";
import { MAX_OWN, MAX_STEP_STROKES, setStrokesAt, bez, clamp, dist, freeName, nudgeIn, pieceAt, r1, bendTo, straighten, removeRivalAll, type XY, type PjStep } from "./jugadasView";
import { U, askCopy, canEditPlay, cur, fullBoard, idsForMove, nameAt, pause, rivalInfo, saveSteps, setMode, setUi, stepsOf, sync } from "./engine";
import "../../../../../styles/pz/jugadas.css";

interface Geo {
  w: number;
  h: number;
  x: number;
  y: number;
  pw: number;
  ph: number;
}
interface DrawUi {
  tool: ToolId;
  /** The tool in Jugadas › Editar (Mover, or a drawing tool for the step). */
  jtool: ToolId;
  color: StrokeColor;
  mark: string | null;
  list: boolean;
  text: XY | null;
  picks: string[];
  ask: boolean;
}
const UI0: DrawUi = { tool: "flecha", jtool: "mover", color: "white", mark: null, list: false, text: null, picks: [], ask: false };

function surface(P: PzApi): "jugada" | "siete" {
  return P.state.route.place === "jugadas" && cur(P) && U(P).mode === "editar" ? "jugada" : "siete";
}
function ctxOf(P: PzApi): DrawCtx | null {
  const b = P.sel.board();
  const v = P.sel.ver();
  if (!b || !v) return null;
  const places: Record<string, BoardPoint> = {};
  v.slots.forEach((s) => {
    if (s.playerId) places[s.playerId] = { x: s.x, y: s.y };
  });
  return { places, lineup: { ...b.lineup, formation: v.formation, freeMode: true, slots: b.lineup.slots.map((s, i) => ({ ...s, x: v.slots[i]?.x ?? s.x, y: v.slots[i]?.y ?? s.y, playerId: v.slots[i]?.playerId ?? null })) }, name: (id) => P.sel.name(id) };
}
const strokesOf = (P: PzApi): Stroke[] => P.sel.board()?.lineup.drawings ?? [];
const pj0 = (P: PzApi) => (surface(P) === "jugada" ? cur(P) : null);

export function Dibujar({ layout }: RegionProps) {
  const P = usePz();
  const phone = layout === "phone";
  const rootRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLInputElement | null>(null);
  const [g, setG] = useState<Geo | null>(null);
  const [ui, setUiD] = useState<DrawUi>(UI0);
  const [live, setLive] = useState<{ tool: ToolId; pts: XY[] } | null>(null);
  const [tv, setTv] = useState("");
  const set = useCallback((patch: Partial<DrawUi>) => setUiD((u) => ({ ...u, ...patch })), []);
  const m = surface(P);
  const b = P.sel.board();
  const ctx = ctxOf(P);
  const stepPj = pj0(P);
  const stepI = stepPj ? clamp(U(P).step, 0, stepsOf(P, stepPj).length - 1) : 0;
  const L: Stroke[] = m === "jugada" && stepPj ? (stepsOf(P, stepPj)[stepI]?.d ?? []) : strokesOf(P);
  const maxS = m === "jugada" ? MAX_STEP_STROKES : MAX_STROKES;
  const tool: ToolId = m === "jugada" ? ui.jtool : ui.tool;
  const pj = m === "jugada" ? cur(P) : null;
  const ro = m === "siete" ? !(b && P.sel.canEdit(b)) : !(pj && canEditPlay(P, pj)) && !(pj && !pj.own && b && P.sel.canEdit(b));

  // measure the grass (the stage's plane) relative to this layer
  const measure = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const stage = el.closest(".pz-s__stage");
    const plane = stage?.querySelector(".pz-c__plane");
    const rr = el.getBoundingClientRect();
    if (!rr.width) return;
    let ng: Geo;
    if (plane) {
      const pr = plane.getBoundingClientRect();
      ng = { w: rr.width, h: rr.height, x: pr.left - rr.left, y: pr.top - rr.top, pw: pr.width, ph: pr.height };
    } else {
      const ph = Math.min(rr.height - 104, (rr.width - 32) * 1.5);
      const pw = ph / 1.5;
      ng = { w: rr.width, h: rr.height, x: (rr.width - pw) / 2, y: (rr.height - ph) / 2 - 2, pw, ph };
    }
    setG((o) => (!o || Math.abs(o.x - ng.x) > 0.5 || Math.abs(o.y - ng.y) > 0.5 || Math.abs(o.pw - ng.pw) > 0.5 || Math.abs(o.ph - ng.ph) > 0.5 || Math.abs(o.w - ng.w) > 0.5 || Math.abs(o.h - ng.h) > 0.5 ? ng : o));
  }, []);
  useLayoutEffect(() => {
    measure();
  });
  useEffect(() => {
    const el = rootRef.current;
    const ro2 = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(() => measure()) : null;
    if (ro2 && el) {
      ro2.observe(el);
      const plane = el.closest(".pz-s__stage")?.querySelector(".pz-c__plane");
      if (plane) ro2.observe(plane);
    }
    // the camera tilts back to flat (CSS transition): measure again when it lands
    const t1 = setTimeout(measure, 380);
    const t2 = setTimeout(measure, 820);
    window.addEventListener("resize", measure);
    return () => {
      ro2?.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);
  // the Siete: a flat pitch and the board's strokes drawn live (colours, pinned ones following the seven)
  const paths = m === "siete" ? L.map((s) => strokePath(s, ctx)).filter((x) => !!x) : null;
  const pathsKey = JSON.stringify(paths);
  useEffect(() => {
    if (m !== "siete") return;
    if (P.state.stage.camera !== "pizarra") P.act.setCamera("pizarra");
    const t = setTimeout(measure, 400);
    return () => clearTimeout(t);
    // oxlint-disable-next-line react/exhaustive-deps -- once per surface (P is a new facade per version)
  }, [m]);
  useEffect(() => {
    if (m !== "siete" || !paths) return;
    P.act.setStage({ overlay: { paths }, drawings: true, ...(phone ? { chrome: false } : {}) });
    // oxlint-disable-next-line react/exhaustive-deps -- the key says when the strokes changed
  }, [m, pathsKey]);
  useEffect(
    () => () => {
      // leaving: the Siete draws the board's strokes again by itself
      if (P.state.route.place === "siete") P.act.setStage({ overlay: null, chrome: true });
    },
    // oxlint-disable-next-line react/exhaustive-deps -- only on unmount
    [],
  );
  useEffect(() => {
    if (ui.text && textRef.current && document.activeElement !== textRef.current) textRef.current.focus();
  }, [ui.text]);

  const toPitch = (e: { clientX: number; clientY: number }): XY => {
    const rr = rootRef.current!.getBoundingClientRect();
    const G = g!;
    return [clamp(r1(((e.clientX - rr.left - G.x) / G.pw) * 100), 0, 100), clamp(r1(((e.clientY - rr.top - G.y) / G.ph) * 100), 0, 100)];
  };

  // ── writing the board's strokes ──
  const commit = (label: string, next: Stroke[], o: { toast?: boolean; long?: boolean; say?: string } = {}) => {
    const pjx = m === "jugada" ? cur(P) : null;
    if (pjx) {
      // (a play's step: its own strokes, written with the play)
      if (!canEditPlay(P, pjx)) {
        askCopy(P);
        return false;
      }
      const ok = saveSteps(P, pjx, setStrokesAt(stepsOf(P, pjx), stepI, next), label, { toast: o.toast ?? false, long: o.long });
      if (ok && o.say) P.say(o.say);
      return ok;
    }
    const bb = P.sel.board();
    if (!bb) return false;
    if (!P.sel.canEdit(bb)) {
      P.toast("Solo lectura: duplica el tablero para dibujar", { action: P.sel.me().socia ? null : { t: "Duplicar", run: () => P.act.duplicate() } });
      return false;
    }
    const ok = P.act.saveBoard({ drawings: next }, label, { toast: o.toast ?? false, long: o.long });
    if (ok && o.say) P.say(o.say);
    return ok;
  };
  const addStroke = (s: Stroke, from?: string | null) => {
    if (L.length >= maxS) {
      P.toast(m === "jugada" ? `Ya hay ${maxS} trazos en este paso: borra alguno para dibujar más` : `Ya hay ${maxS} trazos: borra alguno para dibujar más`, { icon: "warn" });
      return;
    }
    if (fullBoard(P, m === "jugada" ? cur(P) : null)) return;
    const nm = strokeName(s, ctx, from);
    commit(`${nm} en el césped`, [...L, s], { say: `${nm} · ${COLOR_WORD[s.color]}. Deshacer con Control Z` });
  };
  const delStroke = (id: string) => {
    const s = L.find((x) => x.id === id);
    if (!s) return;
    set({ mark: null });
    commit(`${strokeName(s, ctx)} borrado`, L.filter((x) => x.id !== id), { toast: true, long: true });
  };
  const moveStroke = (id: string, dx: number, dy: number) => {
    const s = L.find((x) => x.id === id);
    if (!s) return;
    if (pinned(s)) {
      P.say("Va pegado a los jugadores: se mueve con ellos");
      return;
    }
    commit(`${strokeName(s, ctx)} movido`, L.map((x) => (x.id === id ? { ...x, points: x.points.map((q) => bp([q.x + dx, q.y + dy])) } : x)), { say: `${strokeName(s, ctx)} movido` });
  };

  // ── the pen on the grass ──
  const padDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button > 0 || !g) return;
    if (m === "jugada" && tool === "mover") {
      if (U(P).sel.length) setUi(P, { sel: [] });
      return;
    }
    const a = toPitch(e);
    const pts: XY[] = [a];
    let moved = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture not available */
    }
    const mv = (ev: PointerEvent) => {
      const q = toPitch(ev);
      if (!moved && dd(q, a) < 1.4) return;
      moved = true;
      if (tool === "lapiz") {
        if (dd(q, pts[pts.length - 1]) > 0.9) pts.push(q);
      } else pts[1] = q;
      setLive({ tool, pts: pts.slice() });
    };
    const up = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setLive(null);
      if (!moved) tap(a, tool);
      else stroke(tool, pts);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const tap = (pt: XY, tool: ToolId) => {
    const hit = hitStroke(L, pt, ctx);
    if (tool === "texto") {
      set({ text: pt });
      setTv("");
      return;
    }
    if (tool === "borrar") {
      if (hit) delStroke(hit.id);
      else P.say("Toca un trazo para quitarlo");
      return;
    }
    if ((tool === "unir" || tool === "foco" || tool === "medir") && ctx) {
      const w = nearPlayer(ctx.places, pt, 7);
      if (w) {
        if (tool === "foco") {
          addStroke({ id: newId("k"), kind: "foco", color: ui.color, anchors: [w.pid], points: [bp(w.at)] }, w.pid);
          return;
        }
        let picks = ui.picks.includes(w.pid) ? ui.picks.filter((x) => x !== w.pid) : [...ui.picks, w.pid];
        if (tool === "medir" && picks.length === 2) {
          const [p1, p2] = picks;
          set({ picks: [] });
          addStroke({ id: newId("k"), kind: "medir", color: "white", anchors: [p1, p2], points: [bp(P2of(ctx, p1)), bp(P2of(ctx, p2))] });
          return;
        }
        if (tool === "unir" && picks.length > 4) {
          picks = picks.slice(0, 4);
          P.toast("Como mucho cuatro: pulsa «Unir» o quita a alguno");
        }
        set({ picks });
        P.say(fmt.list(picks.map((x) => P.sel.name(x))) + (tool === "unir" ? (picks.length >= 2 ? ". Pulsa «Unir» otra vez para unirlos" : ". Toca otro") : ". Toca otro para medir"));
        return;
      }
    }
    if (hit) {
      const mk = ui.mark === hit.id ? null : hit.id;
      set({ mark: mk });
      P.say(mk ? `Marcado: ${strokeName(hit, ctx)}. Flechas para moverlo; Supr lo quita` : "Desmarcado");
      return;
    }
    if (ui.mark) {
      set({ mark: null });
      return;
    }
    P.say(tool === "unir" || tool === "foco" ? "Toca un jugador" : "Arrastra sobre el césped para dibujar");
  };
  const stroke = (tool: ToolId, pts: XY[]) => {
    const a = pts[0];
    const z = pts[pts.length - 1];
    if (tool === "medir") {
      if (dd(a, z) < 3) {
        P.toast("Arrastra un poco más para medir");
        return;
      }
      const wa = ctx ? nearPlayer(ctx.places, a, 5) : null;
      const wb = ctx ? nearPlayer(ctx.places, z, 5) : null;
      addStroke(wa && wb && wa.pid !== wb.pid ? { id: newId("k"), kind: "medir", color: "white", anchors: [wa.pid, wb.pid], points: [bp(wa.at), bp(wb.at)] } : { id: newId("k"), kind: "medir", color: "white", points: [bp(a), bp(z)] });
      return;
    }
    if (tool === "texto" || tool === "borrar" || tool === "unir" || tool === "foco" || tool === "fuera" || tool === "mover") {
      P.say(tool === "borrar" ? "Toca un trazo para quitarlo" : "Toca, no arrastres");
      return;
    }
    const s = strokeFrom(tool, pts, ui.color, newId("k"));
    if (typeof s === "string") {
      P.toast(s);
      return;
    }
    const w = ctx ? nearPlayer(ctx.places, a, 9) : null;
    addStroke(s, w?.pid ?? null);
  };
  const putText = () => {
    const v = tv.trim();
    if (!ui.text) return;
    if (!v) {
      P.say("Escribe el texto antes de ponerlo");
      return;
    }
    const pt = ui.text;
    set({ text: null });
    setTv("");
    addStroke({ id: newId("k"), kind: "texto", color: ui.color, points: [bp(pt)], text: v.slice(0, 40) });
  };
  const pickStick = (id: ToolId, label: string, help: string) => {
    if (id === "fuera") {
      const ours = L.find((s) => s.kind === "fuera" && s.side !== "rival");
      const theirs = L.find((s) => s.kind === "fuera" && s.side === "rival");
      const mk = (side: "nos" | "rival"): Stroke => ({ id: newId("k"), kind: "fuera", color: "sky", side, points: [bp([0, side === "nos" ? 70 : 30]), bp([100, side === "nos" ? 70 : 30])] });
      const ourY = ctx ? ctx.lineup.slots.filter((s) => s.playerId).length >= 2 : false;
      const theirY = !!ctx?.lineup.rival;
      if (!ours && !theirs) {
        if (!ourY) P.toast("Hacen falta dos en el campo para la línea");
        else addStroke(mk("nos"));
      } else if (ours && !theirs && theirY) addStroke(mk("rival"));
      else commit("Fuera de juego quitado", L.filter((s) => s.kind !== "fuera"), { toast: true, long: true });
      return;
    }
    if (id === "unir" && ui.tool === "unir" && ui.picks.length >= 2 && ctx) {
      const pp = ui.picks;
      set({ picks: [] });
      addStroke({ id: newId("k"), kind: "unir", color: ui.color, anchors: pp, points: pp.map((x) => bp(P2of(ctx, x))) });
      P.toast("Unidos: " + fmt.list(pp.map((q) => P.sel.name(q))) + ". Se mueven juntos");
      return;
    }
    set({ tool: id, picks: [], text: null });
    P.say(`${label}: ${help}`);
  };
  const convert = () => {
    const bb = P.sel.board();
    if (!bb) return;
    const plays = bb.lineup.plays ?? [];
    if (plays.length >= MAX_OWN) {
      P.toast(`Ya tienes ${MAX_OWN} jugadas en este tablero: borra una para guardar otra`, { icon: "warn" });
      return;
    }
    const pl = drawingToPlay(L, bb.lineup, freeName("Del dibujo", plays.map((x) => x.name)));
    if (!pl) {
      P.toast("Dibuja una carrera o un pase que salga de un jugador");
      return;
    }
    if (P.act.saveBoard({ plays: [...plays, pl] }, "«Del dibujo» creada: dos pasos para retocar")) {
      P.act.setDrawing(false);
      P.nav(`/pizarra/jugadas/${pl.id}?modo=editar&paso=2`);
    }
  };
  const conv = m === "siete" && ctx ? appConvertible(L).filter((s) => !!nearPlayer(ctx.places, [s.points[0].x, s.points[0].y], 9)) : [];

  // ── the keys of the layer (text, mark, list, picks) ──
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    const k = e.key;
    if (k === "Escape") {
      if (ui.text || ui.mark || ui.list || ui.picks.length) {
        e.preventDefault();
        e.stopPropagation();
        if (ui.text) set({ text: null });
        else if (ui.mark) {
          set({ mark: null });
          P.say("Desmarcado");
        } else if (ui.list) set({ list: false });
        else set({ picks: [] });
      }
      return;
    }
    if (ui.mark) {
      const dir = ({ ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] } as Record<string, [number, number]>)[k];
      if (dir) {
        e.preventDefault();
        e.stopPropagation();
        const s = e.shiftKey ? 10 : 2;
        moveStroke(ui.mark, dir[0] * s, dir[1] * s);
        return;
      }
      if (k === "Delete" || k === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        delStroke(ui.mark);
      }
    }
  };

  // ── layout of the docks: beside the pitch (desktop/tablet), rows above the bottom on the phone ──
  let dockL = {};
  let dockR = {};
  let listSt = {};
  // (a tablet's stage is about one pitch wide: no room beside it, so the docks go in rows — the colours above the
  // pitch, the tools under it — instead of standing on the wings, over the men)
  const narrow = !phone && !!g && g.x - 12 < 82 && g.w - (g.x + g.pw) - 12 < 82;
  const rowDocks = phone || narrow;
  if (g) {
    if (narrow) {
      const below = g.y + g.ph + 8;
      // (a row with its words is ≈ 70 px; on a short stage the tools sit over the camera switch's row, never on it)
      dockR = { left: 8, right: 8, top: Math.round(Math.max(4, g.y - 74)) };
      dockL = below + 72 <= g.h ? { left: 8, right: 8, top: Math.round(below) } : { left: 8, right: 8, bottom: 64 };
      listSt = { left: 8, right: 8, top: Math.round(Math.max(8, g.y)), width: "auto", maxHeight: "calc(100% - 130px)" };
    } else if (phone) {
      dockL = { left: 6, right: 6, bottom: 8 };
      dockR = { left: 6, right: 6, bottom: 62 };
      listSt = { left: 8, right: 8, top: 8, width: "auto", maxHeight: "calc(100% - 130px)" };
    } else {
      const room = g.x - 12;
      const lx = room >= 82 ? Math.max(8, g.x - 86) : 8;
      const rx = g.w - (g.x + g.pw) - 12 >= 82 ? g.x + g.pw + 12 : g.w - 82;
      // the tools' column (≈ 12 tools of 48 px) starts level with the grass, or higher when the stage is short;
      // it never runs past the stage's bottom (it scrolls inside, the last tool never cut)
      const need = (m === "siete" ? 12 * 48 + 30 : 8 * 48 + 24) + 12;
      const top = Math.round(Math.max(8, Math.min(g.y, g.h - need - 8)));
      const maxHeight = Math.round(g.h - top - 8);
      dockL = { left: Math.round(lx), top, maxHeight };
      dockR = { left: Math.round(rx), top: Math.round(Math.max(8, g.y)), maxHeight: Math.round(g.h - Math.max(8, g.y) - 8) };
      listSt = { left: Math.round(Math.max(8, rx - 312)), top: Math.round(Math.max(8, g.y)) };
    }
  }
  const px = (q: XY): XY => (g ? [g.x + (q[0] / 100) * g.pw, g.y + (q[1] / 100) * g.ph] : [0, 0]);
  const marked = ui.mark ? (L.find((s) => s.id === ui.mark) ?? null) : null;
  const mr = marked ? strokePath(marked, ctx) : null;
  const tools: [ToolId, string, string][] = m === "jugada" ? [["mover", "Mover", "Arrastra fichas; el asa del medio curva la carrera"], ...TOOLS] : TOOLS;
  const canUndo = P.sel.canUndo();
  const canRedo = P.sel.canRedo();
  const done = () => {
    if (m === "jugada") setMode(P, "ver");
    else {
      P.act.setDrawing(false);
      P.toast(L.length ? `Dibujo guardado en el tablero · ${L.length} ${L.length === 1 ? "trazo" : "trazos"}` : "Sin trazos");
    }
  };
  let hint = "";
  if (!ro) {
    if (ui.picks.length) hint = fmt.list(ui.picks.map((x) => P.sel.name(x))) + (ui.tool === "unir" ? (ui.picks.length >= 2 ? " · pulsa «Unir» otra vez" : " · toca otro") : " · toca otro para medir");
    else if (m === "jugada") hint = "";
    else {
      const x = [...TOOLS, ...STICK].find((y) => y[0] === ui.tool);
      hint = x ? `${x[1]} · ${x[2]}` : "";
    }
  }
  const liveD = (() => {
    if (!live || live.pts.length < 2) return "";
    const a = live.pts[0];
    const z = live.pts[live.pts.length - 1];
    if (live.tool === "zona") return `M${a[0]} ${a[1]} L${z[0]} ${a[1]} L${z[0]} ${z[1]} L${a[0]} ${z[1]} Z`;
    if (live.tool === "carrera") {
      const mid: XY = [(a[0] + z[0]) / 2 + (z[1] - a[1]) * 0.16, (a[1] + z[1]) / 2 - (z[0] - a[0]) * 0.16];
      const c: XY = [2 * mid[0] - (a[0] + z[0]) / 2, 2 * mid[1] - (a[1] + z[1]) / 2];
      return "M" + Array.from({ length: 13 }, (_, j) => bez(a, c, z, j / 12)).map((q) => `${r1(q[0])} ${r1(q[1])}`).join(" L");
    }
    return "M" + live.pts.map((q) => `${q[0]} ${q[1]}`).join(" L");
  })();
  const picks = m === "siete" && ctx ? ui.picks.map((pid) => ctx.places[pid]).filter(Boolean) : [];
  const rows = L.map((s) => ({ s, t: strokeName(s, ctx), sub: (pinned(s) ? "Pegado a los jugadores · " : "") + COLOR_WORD[s.color] }));
  const roT = m === "jugada" ? "Esta jugada se mira. Para cambiarla, duplica el tablero." : b?.isOfficial ? "Es el oficial: los trazos se ven, pero no se tocan." : "Los trazos se ven, pero no se tocan: el tablero es de otro.";

  return (
    <div className={`pd${phone ? " is-phone" : ""}${narrow ? " is-rows" : ""}`} ref={rootRef} data-pd-keys="1" onKeyDown={onKey}>
      {g && (
        <>
          <div
            className={`pd-pad${ro ? " is-off" : tool === "mover" ? " is-move" : tool === "borrar" ? " is-erase" : ""}`}
            style={{ left: r1(g.x), top: r1(g.y), width: r1(g.pw), height: r1(g.ph) }}
            onPointerDown={padDown}
            aria-hidden="true"
          >
            <svg className="pd-live" viewBox="0 0 100 100" preserveAspectRatio="none">
              {mr?.pts && <path className="halo" d={"M" + mr.pts.map((q) => `${r1(q[0])} ${r1(q[1])}`).join(" L") + (mr.kind === "zona" ? " Z" : "")} />}
              {picks.map((q, k) => (
                <ellipse key={k} className="pick" cx={q.x} cy={q.y - 2} rx="4" ry="2.7" />
              ))}
              {liveD && <path className={`lv c-${ui.color}${live?.tool === "zona" ? " zn" : ""}`} d={liveD} />}
            </svg>
          </div>
          {m === "jugada" && pj && <Pieces g={g} rootRef={rootRef} off={tool !== "mover"} />}
          {ui.text && (
            <div className="vd-glass vd-glass--deep pd-text" style={{ left: Math.round(clamp(px(ui.text)[0], 130, g.w - 130)), top: Math.round(px(ui.text)[1]) }}>
              <label className="pz-vh" htmlFor="pd-txt">
                Texto para el campo
              </label>
              <input
                id="pd-txt"
                ref={textRef}
                type="text"
                maxLength={40}
                placeholder="¡PRESIÓN!"
                value={tv}
                onChange={(e) => setTv(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    putText();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    set({ text: null });
                  }
                }}
              />
              <button type="button" onClick={putText}>
                Poner
              </button>
            </div>
          )}
          {mr?.pts && marked && (
            <div
              className="vd-glass vd-glass--deep pd-mark"
              style={(() => {
                const cx = mr.pts.reduce((s, q) => s + q[0], 0) / mr.pts.length;
                const cy = Math.min(...mr.pts.map((q) => q[1]));
                const c = px([cx, cy]);
                return { left: Math.round(clamp(c[0], 140, g.w - 140)), top: Math.round(Math.max(60, c[1])) };
              })()}
              role="group"
              aria-label="Trazo marcado"
            >
              <span>{strokeName(marked, ctx)}</span>
              {!ro && (
                <button type="button" className="is-bad" onClick={() => delStroke(marked.id)} aria-keyshortcuts="Delete">
                  Borrar
                </button>
              )}
              <button type="button" onClick={() => set({ mark: null })} aria-keyshortcuts="Escape">
                Soltar
              </button>
            </div>
          )}
          {/* (the tool's help is said and lives in each tool's title: a line over the grass would cover the strokes) */}
          {hint && <p className="pz-vh">{hint}</p>}
          {!ro && (
            <>
              {tools.length > 0 && (
                <div className={`vd-glass pd-dock${rowDocks ? " is-row" : ""}`} style={dockL} role="toolbar" aria-label="Herramientas de dibujo" aria-orientation={rowDocks ? "horizontal" : "vertical"}>
                  {tools.map(([id, t, help]) => (
                    <ToolBtn key={id} id={id} t={t} help={help} on={tool === id} pick={() => {
                        set(m === "jugada" ? { jtool: id, mark: null, text: null } : { tool: id, picks: [], text: null });
                        P.say(`${t}: ${help}`);
                      }} />
                  ))}
                  {m === "siete" && <span className="pd-sep" aria-hidden="true" />}
                  {m === "siete" && STICK.map(([id, t, help]) => (
                    <ToolBtn key={id} id={id} t={t} help={help} on={ui.tool === id || (id === "fuera" && L.some((s) => s.kind === "fuera"))} pick={() => pickStick(id, t, help)} />
                  ))}
                </div>
              )}
              <div className={`vd-glass pd-dock${rowDocks ? " is-row" : ""}`} style={dockR} role="toolbar" aria-label="Color, deshacer y listo" aria-orientation={rowDocks ? "horizontal" : "vertical"}>
                {COLORS.map(([c, t, hex]) => (
                    <button
                      key={c}
                      type="button"
                      className="pd-sw"
                      aria-pressed={ui.color === c}
                      onClick={() => {
                        set({ color: c });
                        if (marked && !pinned(marked)) commit(`${strokeName(marked, ctx)} en ${t.toLowerCase()}`, L.map((x) => (x.id === marked.id ? { ...x, color: c } : x)));
                        P.say("Color " + t);
                      }}
                      aria-label={"Color " + t}
                    >
                      <i style={{ background: hex }} aria-hidden="true" />
                      <span className="pd-tl">{t}</span>
                    </button>
                  ))}
                <span className="pd-sep" aria-hidden="true" />
                <button type="button" className="pd-t" onClick={() => P.act.undo()} disabled={!canUndo} aria-label={canUndo ? "Deshacer: " + P.sel.undoLabel() : "Nada que deshacer"} aria-keyshortcuts="Control+Z">
                  <Glyph d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                  <span className="pd-tl">Deshacer</span>
                </button>
                <button type="button" className="pd-t" onClick={() => P.act.redo()} disabled={!canRedo} aria-label={canRedo ? "Rehacer: " + P.sel.redoLabel() : "Nada que rehacer"} aria-keyshortcuts="Control+Shift+Z">
                  <Glyph d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
                  <span className="pd-tl">Rehacer</span>
                </button>
                {m === "siete" && (
                  <>
                    <button type="button" className="pd-t" onClick={() => set({ list: !ui.list, ask: false })} aria-pressed={ui.list} aria-label={`Los trazos: ${L.length} de ${MAX_STROKES}`}>
                      <Glyph d="M12 4l8.5 4.5L12 13 3.5 8.5zM3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5" />
                      <span className="pd-tl">Trazos</span> <span className="pd-n">{L.length}</span>
                    </button>
                    <button type="button" className="pd-t" onClick={convert} disabled={!conv.length} aria-label={conv.length ? `Convertir en jugada: ${conv.length} ${conv.length === 1 ? "trazo sale" : "trazos salen"} de un jugador` : "Convertir en jugada: dibuja una carrera o un pase que salga de un jugador"} title="Convertir el dibujo en jugada">
                      <Glyph d="M8 5.5v13l10.5-6.5z" />
                      <span className="pd-tl">Jugada</span>
                    </button>
                  </>
                )}
                <span className="pd-sep" aria-hidden="true" />
                <button type="button" className="pd-t is-pri" onClick={done} aria-keyshortcuts="Escape">
                  <Glyph d="M5 12.5l4.5 4.5L19 7.5" />
                  Listo
                </button>
              </div>
            </>
          )}
          {ro && (
            <div className="vd-glass vd-glass--deep pd-ro" style={phone ? { left: 8, right: 8, bottom: 8, width: "auto" } : dockL} role="status">
              <b>Solo lectura</b>
              <p>{roT}</p>
              <div className="pz-acts">
                {!P.sel.me().socia && !!b && (
                  <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.duplicate()}>
                    {m === "jugada" ? "Duplicar el tablero" : "Duplicar para dibujar"}
                  </button>
                )}
                <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={done}>
                  Listo
                </button>
              </div>
            </div>
          )}
          {ui.list && m === "siete" && (
            <div className="vd-glass vd-glass--deep pd-list" style={listSt} role="dialog" aria-label="Los trazos del césped">
              <h2>
                En el césped <small>{`${L.length} de ${MAX_STROKES}`}</small>
              </h2>
              <ul>
                {rows.map((r) => (
                  <li key={r.s.id} className="pd-li">
                    <button
                      type="button"
                      aria-pressed={ui.mark === r.s.id}
                      onClick={() => {
                        const mk = ui.mark === r.s.id ? null : r.s.id;
                        set({ mark: mk });
                        P.say(mk ? `Marcado: ${r.t}. Flechas para moverlo; Supr lo quita` : "Desmarcado");
                      }}
                      onKeyDown={(e) => {
                        if (ui.mark !== r.s.id && (e.key.startsWith("Arrow") || e.key === "Delete")) set({ mark: r.s.id });
                      }}
                      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Delete Escape"
                    >
                      <b>{r.t}</b>
                      <small>{r.sub}</small>
                    </button>
                    {!ro && (
                      <button type="button" className="vd-glass vd-press nx-ib" onClick={() => delStroke(r.s.id)} aria-label={"Borrar: " + r.t}>
                        <Glyph d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {!L.length && <p className="pz-meta">{ro ? "Este tablero no tiene trazos." : "Aún no hay trazos: elige una herramienta y dibuja sobre el césped."}</p>}
              {!ro && L.length > 1 && (
                <div className="pz-acts">
                  {ui.ask ? (
                    <>
                      <span className="pz-meta">{`¿Borrar los ${L.length} trazos?`}</span>
                      <button
                        type="button"
                        className="vd-glass vd-press pz-btn pj-danger"
                        onClick={() => {
                          set({ ask: false, mark: null });
                          commit("Césped limpio", [], { toast: true, long: true });
                        }}
                      >
                        Borrar todo
                      </button>
                      <button type="button" className="nx-lnk" onClick={() => set({ ask: false })}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button type="button" className="nx-lnk" onClick={() => set({ ask: true })}>
                      Borrar todos los trazos
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
function P2of(ctx: DrawCtx, pid: string): XY {
  const p = ctx.places[pid];
  return p ? [p.x, p.y] : [50, 50];
}
function Glyph({ d, dash }: { d: string; dash?: string }) {
  return (
    <svg className="nx-ic" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} style={dash ? { strokeDasharray: dash } : undefined} />
    </svg>
  );
}
function ToolBtn({ id, t, help, on, pick }: { id: ToolId; t: string; help: string; on: boolean; pick: () => void }) {
  const ic = ICONS[id];
  return (
    <button type="button" className="pd-t" aria-pressed={on} onClick={pick} aria-label={`${t}: ${help}`} title={help}>
      <Glyph d={ic.d} dash={ic.dash} />
      <span className="pd-tl">{t}</span>
    </button>
  );
}

// ── the pieces of a play's step (Jugadas › Editar) ──────────────────────────────────────────────────────────
function Pieces({ g, rootRef, off }: { g: Geo; rootRef: RefObject<HTMLDivElement | null>; off: boolean }) {
  const P = usePz();
  const pj = cur(P);
  if (!pj) return null;
  const steps = stepsOf(P, pj);
  const i = clamp(U(P).step, 0, steps.length - 1);
  const st = steps[i];
  const prev = i > 0 ? steps[i - 1] : null;
  const sel = U(P).sel;
  const can = canEditPlay(P, pj);
  const px = (q: XY): XY => [g.x + (q[0] / 100) * g.pw, g.y + (q[1] / 100) * g.ph];
  const toPitch = (e: { clientX: number; clientY: number }): XY => {
    const rr = rootRef.current!.getBoundingClientRect();
    return [clamp(r1(((e.clientX - rr.left - g.x) / g.pw) * 100), 0, 100), clamp(r1(((e.clientY - rr.top - g.y) / g.ph) * 100), 0, 100)];
  };
  const pieceName = (id: string) => (id === "b" ? "El balón" : id[0] === "r" ? `El rival ${+id.slice(1) + 1}` : nameAt(P, +id.slice(1)));
  const zs = P.state.stage.zoom?.s ?? 1;
  const s = clamp((g.pw * 0.13) / zs, 30, 120);

  const pieceDown = (e: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button > 0) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let on = false;
    let asked = false;
    const multi = e.shiftKey || e.ctrlKey || e.metaKey || U(P).multi;
    const ids = U(P).sel.includes(id) ? U(P).sel.slice() : [id];
    const base = stepsOf(P, pj);
    const start: Record<string, XY> = {};
    ids.forEach((k) => {
      const q = pieceAt(base[i], k);
      if (q) start[k] = [q[0], q[1]];
    });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture not available */
    }
    let raf = 0;
    let last: PjStep[] | null = null;
    const mv = (ev: PointerEvent) => {
      if (!on && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
      if (!can) {
        if (!asked) {
          asked = true;
          askCopy(P);
        }
        return;
      }
      if (!on) {
        on = true;
        if (U(P).playing) pause(P, true);
        if (!U(P).sel.includes(id)) setUi(P, { sel: [id] });
      }
      const dx = ((ev.clientX - x0) / g.pw) * 100;
      const dy = ((ev.clientY - y0) / g.ph) * 100;
      last = nudgeIn(base, i, Object.keys(start), dx, dy, start);
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          setUi(P, { draft: { id: pj.id, steps: last! } });
          sync(P, { dur: 0.001 });
        });
    };
    const up = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      cancelAnimationFrame(raf);
      if (!on) {
        if (asked) return;
        const cur0 = U(P).sel;
        const next = multi ? (cur0.includes(id) ? cur0.filter((x) => x !== id) : [...cur0, id]) : cur0.length === 1 && cur0[0] === id ? [] : [id];
        setUi(P, { sel: next });
        P.say(next.length ? (next.length > 1 ? `${next.length} elegidas` : `${pieceName(id)} elegido`) + ". Flechas para moverlo" : "Soltado");
        return;
      }
      const ids2 = idsForMove(P, pj, Object.keys(start));
      if (ids2 === "hueco" || !last) {
        setUi(P, { draft: null });
        sync(P);
        if (ids2 === "hueco") P.toast("Ese sitio está vacío en tu siete: pon a alguien para moverlo");
        return;
      }
      const n = Object.keys(start).length;
      saveSteps(P, pj, last, `${n > 1 ? `${n} fichas movidas` : `${pieceName(id)} movido`} en el paso ${i + 1}`, { toast: false, ids: ids2 });
      setUi(P, { draft: null });
      sync(P);
      P.say(`${n > 1 ? `${n} fichas movidas` : `${pieceName(id)} movido`}. Deshacer con Control Z`);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const pieceKey = (e: ReactKeyboardEvent<HTMLButtonElement>, id: string) => {
    const k = e.key;
    if (k === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (U(P).sel.length) {
        setUi(P, { sel: [] });
        P.say("Soltado");
      } else setMode(P, "ver");
      return;
    }
    if (k === "Enter" || k === " ") {
      e.preventDefault();
      e.stopPropagation();
      const cur0 = U(P).sel;
      const next = e.shiftKey || U(P).multi ? (cur0.includes(id) ? cur0.filter((x) => x !== id) : [...cur0, id]) : cur0.length === 1 && cur0[0] === id ? [] : [id];
      setUi(P, { sel: next });
      P.say(next.length ? `${pieceName(id)} elegido` : "Soltado");
      return;
    }
    if ((k === "Delete" || k === "Backspace") && id[0] === "r") {
      e.preventDefault();
      e.stopPropagation();
      const n = +id.slice(1);
      if (saveSteps(P, pj, removeRivalAll(steps, n), "Rival quitado de la jugada", { long: true, rivalIds: pj.rivalIds.filter((_, j) => j !== n) })) setUi(P, { sel: [] });
      return;
    }
    const dir = ({ ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] } as Record<string, [number, number]>)[k];
    if (!dir) return;
    e.preventDefault();
    e.stopPropagation();
    if (!can) {
      askCopy(P);
      return;
    }
    const ids = U(P).sel.includes(id) ? U(P).sel.slice() : [id];
    const d = e.shiftKey ? 10 : 2;
    const ids2 = idsForMove(P, pj, ids);
    if (ids2 === "hueco") {
      P.toast("Ese sitio está vacío en tu siete: pon a alguien para moverlo");
      return;
    }
    saveSteps(P, pj, nudgeIn(steps, i, ids, dir[0] * d, dir[1] * d), `${pieceName(id)} movido en el paso ${i + 1}`, { toast: false, ids: ids2 });
    P.say(`${pieceName(id)} movido`);
  };
  const handleDown = (e: ReactPointerEvent<HTMLButtonElement>, k: number) => {
    if (e.button > 0) return;
    if (!can) {
      askCopy(P);
      return;
    }
    e.stopPropagation();
    const x0 = e.clientX;
    const y0 = e.clientY;
    let on = false;
    let raf = 0;
    let last: PjStep[] | null = null;
    const base = stepsOf(P, pj);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture not available */
    }
    const mv = (ev: PointerEvent) => {
      if (!on && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      on = true;
      last = bendTo(base, i, k, toPitch(ev));
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          setUi(P, { draft: { id: pj.id, steps: last! } });
          sync(P, { dur: 0.001 });
        });
    };
    const up = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      cancelAnimationFrame(raf);
      if (!on || !last) return;
      const curved = !!last[i].c["m" + k];
      const ids2 = idsForMove(P, pj, ["m" + k]);
      saveSteps(P, pj, last, `Carrera de ${nameAt(P, k)}${curved ? " curvada" : " recta"}`, { toast: false, ids: ids2 === "hueco" ? undefined : ids2 });
      setUi(P, { draft: null });
      sync(P);
      P.say(`Carrera de ${nameAt(P, k)}${curved ? " curvada" : " recta"}`);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const handleKey = (e: ReactKeyboardEvent<HTMLButtonElement>, k: number, a: XY, q: XY, c0: XY | undefined) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      e.stopPropagation();
      saveSteps(P, pj, straighten(steps, i, k), `Carrera de ${nameAt(P, k)} recta`);
      return;
    }
    const dir = ({ ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] } as Record<string, [number, number]>)[e.key];
    if (!dir) return;
    e.preventDefault();
    e.stopPropagation();
    if (!can) {
      askCopy(P);
      return;
    }
    const mid: XY = c0 ? bez(a, c0, q, 0.5) : [(a[0] + q[0]) / 2, (a[1] + q[1]) / 2];
    saveSteps(P, pj, bendTo(steps, i, k, [mid[0] + dir[0] * 2, mid[1] + dir[1] * 2]), `Carrera de ${nameAt(P, k)} curvada`, { toast: false });
    P.say(`Curva de ${nameAt(P, k)}`);
  };
  const riv = rivalInfo(P);
  return (
    <>
      {st.p.map((q, k) => {
        const c = px(q);
        const w = Math.max(44, s * 1.15);
        const h = Math.max(48, s * 1.36 + 4);
        return (
          <button
            key={"m" + k}
            type="button"
            className={`pd-hit k-man${off ? " is-off" : ""}`}
            style={{ left: Math.round(c[0] - w / 2), top: Math.round(c[1] - h * 0.86), width: Math.round(w), height: Math.round(h) }}
            onPointerDown={(e) => pieceDown(e, "m" + k)}
            onKeyDown={(e) => pieceKey(e, "m" + k)}
            aria-pressed={sel.includes("m" + k)}
            aria-label={`${nameAt(P, k)} en el paso ${i + 1}. Arrastra o usa las flechas; Intro lo elige`}
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Escape"
          >
            <i aria-hidden="true" />
          </button>
        );
      })}
      {st.r.map((q, k) => {
        const c = px(q);
        return (
          <button
            key={"r" + k}
            type="button"
            className={`pd-hit k-riv${off ? " is-off" : ""}`}
            style={{ left: Math.round(c[0] - 22), top: Math.round(c[1] - 22), width: 44, height: 44 }}
            onPointerDown={(e) => pieceDown(e, "r" + k)}
            onKeyDown={(e) => pieceKey(e, "r" + k)}
            aria-pressed={sel.includes("r" + k)}
            aria-label={`Rival ${k + 1} de ${riv.name}. Arrastra o flechas; Supr lo quita`}
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Delete Escape"
          >
            <i aria-hidden="true" />
          </button>
        );
      })}
      {st.b &&
        (() => {
          const c = px(st.b);
          return (
            <button
              type="button"
              className={`pd-hit k-ball${off ? " is-off" : ""}`}
              style={{ left: Math.round(c[0] - 22), top: Math.round(c[1] - 22), width: 44, height: 44 }}
              onPointerDown={(e) => pieceDown(e, "b")}
              onKeyDown={(e) => pieceKey(e, "b")}
              aria-pressed={sel.includes("b")}
              aria-label={`El balón en el paso ${i + 1}. Arrastra o flechas`}
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Escape"
            >
              <i aria-hidden="true" />
            </button>
          );
        })()}
      {prev &&
        st.p.map((q, k) => {
          const a = prev.p[k];
          if (dist(a, q) <= 4) return null;
          const c0 = st.c["m" + k];
          const mid: XY = c0 ? bez(a, c0, q, 0.5) : [(a[0] + q[0]) / 2, (a[1] + q[1]) / 2];
          const c = px(mid);
          return (
            <button
              key={"h" + k}
              type="button"
              className={`pd-hd${c0 ? " is-curved" : ""}${off ? " is-off" : ""}`}
              style={{ left: Math.round(c[0]), top: Math.round(c[1]) }}
              onPointerDown={(e) => handleDown(e, k)}
              onKeyDown={(e) => handleKey(e, k, a, q, c0)}
              onDoubleClick={() => saveSteps(P, pj, straighten(steps, i, k), `Carrera de ${nameAt(P, k)} recta`)}
              aria-label={`Curva de la carrera de ${nameAt(P, k)} al paso ${i + 1}, ${c0 ? "curvada" : "recta"}. Arrástrala o usa las flechas; Supr la endereza`}
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Delete"
            >
              <i aria-hidden="true" />
            </button>
          );
        })}
    </>
  );
}
