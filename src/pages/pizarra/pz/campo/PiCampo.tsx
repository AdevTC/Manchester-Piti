// r14 «La pizarra» · PiCampo, THE pitch (CAMPO-API.md): one pitch for every place. It renders `P.sel.view(spec)` —
// the current stage, or `show` for a mini/inert pitch — on a 2:3 plane: the crafted grass, the sistema written on our
// half and its chalk shape, the seven (printed shirts, plates, galones, layer badges, marks, rings), the rival's
// discs, tokens, overlay paths with handles, the ball, labels; three CSS-3D cameras (Pizarra · Grada · Foco); the
// chrome (layers, Dibujar, camera, legend, caption); and, on an editable siete, tap-tap «en la mano», drag (through
// the store's controller: P.drag.begin) and the keyboard. A place never edits this file: it changes the stage spec.
// Ported from the prototype's PiCampo.dc.html (its markup, its CSS in styles/pz/campo.css, its logic).
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject, type PointerEvent as ReactPointerEvent } from "react";
import { usePz } from "../store/context";
import type { Camera, Layout, StageSpec, Token, ViewSlot } from "../store/types";
import { CAMPO_LAYERS, fitGeometry, planeTransform, round2, shapeLines, slotAhead } from "./geometry";
import { overlayPaths } from "./overlayPaths";
import { CampoShirt, PzIcon } from "./Shirt";
import "../../../../styles/pz/campo.css";

export interface PiCampoProps {
  layout: Layout;
  /** A thumbnail: light, no interactions, no plates/badges/controls. */
  mini?: boolean;
  /** The stage spec to show (minis and inert pitches); the shell's pitch shows the current stage. */
  show?: StageSpec;
  camera?: Camera;
  /** No chrome. */
  bare?: boolean;
  /** A read-only, non-mini pitch: taps open the ficha, no drag, never the current board's tapSlot. */
  inert?: boolean;
  /** The shell's own pitch: its stage box carries view-transition-name: pz-pitch (only one instance may). */
  main?: boolean;
}

const CAMS: { id: Camera; t: string; icon: string }[] = [
  { id: "pizarra", t: "Pizarra", icon: "cenital" },
  { id: "grada", t: "Grada", icon: "grada" },
];
const RING_WORD: Record<string, string> = { sale: "Sale", entra: "Entra", mueve: "Se mueve" };
const notaTxt = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
const isTrue = (v: unknown) => v === true || v === "true" || v === 1;
type Vars = Record<`--${string}`, string | number>;
const vars = (o: Vars): CSSProperties => o as CSSProperties;

/** The box's size (ResizeObserver; jsdom and the server have none: the geometry falls back to a default box). */
function useBoxSize(ref: RefObject<HTMLDivElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = (w: number, h: number) => setSize((s) => (Math.abs(s.w - w) > 1 || Math.abs(s.h - h) > 1 ? { w, h } : s));
    const r = el.getBoundingClientRect();
    if (r.width && r.height) read(r.width, r.height);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((es) => {
      const c = es[0]?.contentRect;
      if (c) read(c.width, c.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export function PiCampo(props: PiCampoProps) {
  const P = usePz();
  const S = P.state;
  const mini = isTrue(props.mini);
  const inert = isTrue(props.inert);
  const layout: Layout = props.layout || S.layout || "desktop";
  const rootRef = useRef<HTMLDivElement | null>(null);
  const planeRef = useRef<HTMLDivElement | null>(null);
  const box = useBoxSize(rootRef);
  const [hover, setHover] = useState<string | null>(null);
  const view = mini && props.show ? P.sel.view({ chrome: false, camera: props.camera || "grada", layer: "nada", ...props.show }) : P.sel.view(props.show);
  const cam: Camera = props.camera || view.camera || "pizarra";
  const G = fitGeometry(cam, layout, mini, box.w, box.h, view.gradaPad || 0);
  const T = planeTransform(cam, G, view);
  const ro = !view.editable || inert || mini;
  const tinyTxt = mini && G.s * 0.52 < 11.5;
  const layer = view.layer || "nada";
  const drag = S.drag;
  const handSel = S.sel;

  // What changed since the last render, tracked as state adjusted during render (React's derived-state pattern):
  // a slot whose player just changed drops with a settle (its shadow grows); a new flash (the seven completes)
  // sweeps the light once; a new sistema redraws its chalk shape. Timers (async) clear the one-shot marks.
  const pidKey = view.slots.map((s) => s.pid ?? "").join("|");
  const flash = view.flash || 0;
  const form = view.formation || "";
  const [track, setTrack] = useState(() => ({ pidKey, flash, form, fresh: {} as Record<number, true>, freshN: 0, sweepN: 0, sweep: false, shapeKey: "a" as "a" | "b" }));
  if (track.pidKey !== pidKey || track.flash !== flash || track.form !== form) {
    const next = { ...track, pidKey, flash, form };
    if (track.pidKey !== pidKey && !mini) {
      const prev = track.pidKey.split("|");
      const changed: Record<number, true> = {};
      pidKey.split("|").forEach((pid, i) => {
        if (pid && prev[i] !== undefined && prev[i] !== pid) changed[i] = true;
      });
      if (Object.keys(changed).length) {
        next.fresh = changed;
        next.freshN = track.freshN + 1;
      }
    }
    if (track.flash !== flash && flash && !mini) {
      next.sweep = true;
      next.sweepN = track.sweepN + 1;
    }
    if (track.form !== form) next.shapeKey = track.shapeKey === "a" ? "b" : "a";
    setTrack(next);
  }
  const { fresh, sweep, shapeKey } = track;
  useEffect(() => {
    if (!track.freshN) return;
    const t = window.setTimeout(() => setTrack((x) => ({ ...x, fresh: {} })), 700);
    return () => window.clearTimeout(t);
  }, [track.freshN]);
  useEffect(() => {
    if (!track.sweepN) return;
    const t = window.setTimeout(() => setTrack((x) => ({ ...x, sweep: false })), 1400);
    return () => window.clearTimeout(t);
  }, [track.sweepN]);
  // (nobody is hovered once the board changes under the pointer)
  const hovered = hover && view.slots.some((s) => s.pid === hover) ? hover : null;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (mini) return;
    const t = e.target as HTMLElement | null;
    const k = e.key;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const slotEl = t?.closest?.("[data-pz-slot]");
    const i = slotEl ? Number(slotEl.getAttribute("data-pz-slot")) : null;
    const root = rootRef.current;
    if (k.startsWith("Arrow")) {
      if (!root) return;
      const all = Array.from(root.querySelectorAll<HTMLElement>("[data-pz-slot]"));
      if (!all.length) return;
      e.preventDefault();
      if (i == null) {
        all[0].focus();
        return;
      }
      const best = slotAhead(view.slots, i, k);
      if (best == null) return;
      root.querySelector<HTMLElement>(`[data-pz-slot="${best}"]`)?.focus();
      const s = view.slots[best];
      P.say((s.p ? `${s.p.shirt}, ${s.code}` : `Hueco ${s.code} vacío`) + (handSel ? `. Intro para ${s.p ? "cambiarlos" : "soltarlo aquí"}` : ""));
      return;
    }
    if (k === "Escape") {
      if (S.sel || S.slotPick != null) {
        P.act.release();
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }
    if ((k === "m" || k === "M") && view.editable && !inert) {
      const pid = handSel?.pid ?? (i != null ? view.slots[i]?.pid : null);
      if (pid) {
        P.act.openSheet("mover", { pid, slot: i ?? handSel?.slot ?? null });
        e.preventDefault();
      }
      return;
    }
    if ((k === "Delete" || k === "Backspace") && view.editable && !inert && i != null && view.slots[i]?.pid) {
      P.act.remove(i);
      e.preventDefault();
      return;
    }
    if (inert) return;
    if (k === "v" || k === "V") {
      P.act.toggleCamera();
      e.preventDefault();
      return;
    }
    if ((k === "d" || k === "D") && view.source === "siete" && view.editable) {
      P.act.setDrawing(!S.drawing);
      e.preventDefault();
      return;
    }
    const L = CAMPO_LAYERS.find((x) => x.key === k);
    if (L) {
      P.act.setLayer(L.id);
      e.preventDefault();
    }
  };

  // ── the seven
  const shortPlates = view.plates === "short" || (G.pw < (cam === "pizarra" ? 270 : 300) && !mini);
  const slotModel = (s: ViewSlot) => {
    const pl = s.p;
    let layV = "";
    let layCls = "";
    let layAria = "";
    if (pl && layer === "media") {
      const b = P.sel.band(pl.global);
      layV = pl.global == null ? "—" : String(pl.global);
      layCls = `t-${b.tone}`;
      layAria = `Media ${layV}${pl.provisional && pl.global != null ? " provisional" : ""}, ${b.t}`;
    }
    if (pl && layer === "nota") {
      const n = P.sel.lastNota(pl.id);
      layV = n ? notaTxt(n.n) : "—";
      layCls = `t-${n ? (n.n >= 7 ? "top" : n.n >= 6 ? "good" : n.n >= 5 ? "ok" : "bad") : "mute"}`;
      layAria = n ? `Última nota ${layV}${n.j ? ` en la J${n.j}` : ""}, ${P.sel.notaWord(n.n).toLowerCase()}` : "Sin nota";
    }
    if (pl && layer === "forma") {
      const fb = P.sel.band(pl.forma);
      layV = pl.forma == null ? "—" : String(pl.forma);
      layCls = `t-${fb.tone}`;
      layAria = `Forma ${layV}, ${fb.t}`;
    }
    if (pl && layer === "minutos") {
      layV = `${pl.min || 0}′`;
      layCls = "t-ok";
      layAria = `${pl.min || 0} minutos en ${pl.pj} partidos`;
    }
    const marks = mini ? [] : (s.marks ?? []).concat((view.marksExtra && s.pid && view.marksExtra[s.pid]) || []).map((m) => ({ k: m.k, short: m.short ?? (m.k === "amarilla" ? "▮" : m.k === "tocado" ? "+" : m.k === "roja" ? "▮" : "●"), min: (m.t.match(/\d+′/) ?? [""])[0], t: m.t }));
    const galT = s.galones.map((g) => g.aria).join(", ");
    // (short: his first word — the shirt already shows the dorsal)
    const label = pl ? (shortPlates ? pl.shirt.split(/[ .]/)[0] : pl.shirt) : s.code;
    const posWord = P.sel.posName(s.code).toLowerCase();
    const aria = pl
      ? [
          pl.shirt + (pl.num ? `, ${pl.num}` : ""),
          `${s.code} · ${posWord}`,
          s.fit != null ? s.fitT : "",
          galT,
          layAria,
          s.r && s.r.v !== "yes" ? s.r.t.toLowerCase() : "",
          s.me ? "eres tú" : "",
          marks.map((m) => m.t.toLowerCase()).join(", "),
          s.ringT ?? "",
          ro ? "toca para ver su ficha" : s.sel ? "en la mano: toca otro puesto o un hueco" : handSel ? `toca para cambiarlo por ${P.sel.name(handSel.pid)}` : "toca para cogerlo; mantén para arrastrar",
        ]
          .filter(Boolean)
          .join(". ")
      : `Hueco ${s.code} vacío, ${posWord}${ro ? "" : handSel ? `: toca para poner a ${P.sel.name(handSel.pid)}` : ": toca para ver quién encaja"}`;
    const isDrag = !!(drag && drag.from === "campo" && drag.slot === s.i);
    const gal = mini ? [] : s.galones;
    const hasLay = !!layV && !mini;
    return {
      pl,
      label,
      aria,
      marks,
      gal,
      hasLay,
      layV,
      layCls,
      rowNone: !(hasLay || gal.length || marks.length),
      cls: [s.sel && "is-sel", s.over && "is-over", fresh[s.i] && "is-new", isDrag && "is-drag", s.me && "is-me", s.out && "is-out", s.ring && `r-${s.ring}`].filter(Boolean).join(" "),
      slotCls: [s.picked && "is-pick", s.over && "is-over", drag && "is-drop"].filter(Boolean).join(" "),
      num: pl && !tinyTxt ? String(pl.num || pl.shirt[0] || "") : "",
      tag: s.ring && !mini ? RING_WORD[s.ring] ?? "" : "",
    };
  };
  const tapSlot = (s: ViewSlot) => {
    if (mini) return;
    if (inert) {
      if (s.pid) P.act.openFicha(s.pid);
      return;
    }
    if (ro && !s.pid) {
      P.say(`Hueco ${s.code} vacío`);
      return;
    }
    P.act.tapSlot(s.i);
  };
  const downSlot = (e: ReactPointerEvent, s: ViewSlot) => {
    if (ro || !s.pid) return;
    P.drag.begin(e, { pid: s.pid, from: "campo", slot: s.i });
  };

  // ── tokens
  const others = [...view.slots.filter((s) => s.pid).map((s) => ({ x: s.x, y: s.y, id: `s${s.i}` })), ...view.tokens.filter((o) => o.pid || o.kind === "us").map((o) => ({ x: o.x, y: o.y, id: o.id }))];
  const tokenModel = (t: Token) => {
    const pl = t.pid ? P.sel.player(t.pid) : null;
    const shirtKind = t.kind === "us" || t.kind === "petos" || t.kind === "sinpetos" || (t.kind === "ghost" && !!t.pid);
    const isShirt = shirtKind && (!!pl || t.kind === "us");
    const nearOurs = t.kind === "rival" && others.some((o) => o.id !== t.id && Math.abs(o.x - t.x) < 9 && Math.abs(o.y - t.y) < 8);
    const ringWord = t.ring ? RING_WORD[t.ring] : "";
    const tappable = !!(view.tappable && !mini && !inert && (t.pid || t.id));
    const aria =
      t.kind === "rival"
        ? `Rival${view.rivalName ? ` (${view.rivalName})` : ""}${t.num ? `, dorsal ${t.num}` : ""}${t.label && t.label !== "Rival" ? `, ${t.label}` : ""}${t.note ? `. ${t.note}` : ""}`
        : `${t.label || pl?.shirt || ""}${t.bib ? `, ${t.bib}` : ""}${ringWord ? `, ${ringWord.toLowerCase()}` : ""}${t.tag && t.tag !== ringWord ? `, ${t.tag}` : ""}${tappable ? ". Toca para elegirlo" : ""}`;
    return {
      pl,
      isShirt,
      tappable,
      aria,
      label: t.label || pl?.shirt || "",
      num: tinyTxt ? "" : t.num != null && t.num !== "" ? String(t.num) : pl?.num ? String(pl.num) : "",
      code: nearOurs ? "" : t.code || "",
      tag: mini ? "" : t.tag || ringWord,
      patCls: t.pat ? `pz-c__bib p-${String(t.pat).replace(/^p-/, "")}` : "",
    };
  };

  // ── the sistema's shape, química, overlay, labels, handles
  const shape = view.source === "siete" && !view.free && !mini ? shapeLines(view.slots) : [];
  const ls = view.links.filter((l) => l.a && l.b);
  const focusPid = handSel?.pid ?? hovered;
  const small = !mini && G.ph < 430;
  const lkWords = layer === "quimica" && focusPid && !small ? ls.filter((l) => l.a.pid === focusPid || l.b.pid === focusPid) : [];
  const ov = overlayPaths(view.overlay);
  const labels = mini ? [] : view.labels;
  const handles = mini || inert ? [] : (view.overlay?.paths ?? []).filter((d) => d.handle && (d.pts?.length ?? 0) > 0);
  const legend: { cls: string; t: string }[] = [];
  if (layer === "quimica" && ls.length) legend.push({ cls: "", t: "Muy buena" }, { cls: "t2", t: "Buena" }, { cls: "t1", t: "Floja" });
  if (view.tokens.some((t) => t.kind === "rival")) legend.push({ cls: "riv", t: `${view.rivalName || "Rival"} · rival` });
  const sysLabel = view.formation && view.source === "siete" ? (view.free ? "LIBRE" : view.formation) : "";
  const chrome = !mini && !inert && view.chrome !== false && !props.bare;
  const canDraw = chrome && view.source === "siete" && view.editable;
  const showLayers = layout !== "phone" && (view.source === "siete" || view.source === "ahora" || view.source === "comparar");
  const nSeven = view.slots.filter((s) => s.pid).length;
  const camWord = cam === "grada" ? "grada" : cam === "foco" ? "foco" : "pizarra";
  const aria = mini
    ? `Miniatura del campo${sysLabel ? ` · ${sysLabel}` : ""}`
    : `El campo${sysLabel ? ` · ${sysLabel}` : ""}${view.source === "siete" ? ` · ${nSeven} de 7` : ""} · cámara ${camWord}${ro ? " · solo lectura" : ""}. Flechas para moverte entre puestos.`;

  const rootCls = [
    "pz-c",
    tinyTxt && "pz-c--tiny",
    `is-${cam}`,
    ro ? "is-ro" : "is-ed",
    mini && "pz-c--mini",
    mini && G.pw < 150 && "pz-c--disc",
    // (a very small pitch — a short phone — leaves the plates to the printed shirts; the buttons keep their names)
    !mini && G.pw < 170 && "pz-c--noplate",
    isTrue(props.main) && !mini && "pz-c--main",
    layout === "phone" && "pz-c--sm",
    sweep && "is-sweep",
    view.source === "jugada" && "is-linear",
    drag && "is-dragging",
  ]
    .filter(Boolean)
    .join(" ");
  const rootStyle = vars({
    "--pw": `${round2(G.pw)}px`,
    "--ph": `${round2(G.ph)}px`,
    "--s": `${round2(G.s)}px`,
    "--rx": `${G.rx}deg`,
    "--persp": `${round2(G.persp)}px`,
    "--tx": `${round2(T.tx)}px`,
    "--ty": `${round2(T.ty)}px`,
    "--sc": T.sc,
    "--glide": `${view.glideMs || 420}ms`,
    "--zs": T.zs,
  });
  const at = (x: number, y: number, i?: number, extra?: Vars): CSSProperties => vars({ "--x": round2(x), "--y": round2(y), ...(i != null ? { "--i": i } : {}), ...extra });

  const startHandle = (e: ReactPointerEvent, onMove: (y: number) => void, clamp: (v: number) => number, onEnd?: () => void) => {
    const plane = planeRef.current;
    if (!plane) return;
    e.preventDefault();
    e.stopPropagation();
    const r = plane.getBoundingClientRect();
    const move = (ev: PointerEvent) => onMove(clamp(((ev.clientY - r.top) / r.height) * 100));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onEnd?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={rootRef}
      className={rootCls}
      style={rootStyle}
      data-pz-campo="1"
      role={mini ? "img" : "group"}
      aria-roledescription={mini ? undefined : "campo"}
      aria-label={aria}
      aria-keyshortcuts={mini ? undefined : "ArrowUp ArrowDown ArrowLeft ArrowRight Enter Escape M Delete V D 0 1 2 3 4 5"}
      onKeyDown={onKey}
    >
      <div className="pz-c__stage" inert={mini || undefined} aria-hidden={mini || undefined}>
        <div className="pz-c__pool" aria-hidden="true" />
        <div className="pz-c__plane" ref={planeRef}>
          <div className="pz-c__grass" aria-hidden="true" />
          <svg className="pz-c__chalk" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
            <rect className="l" x="3" y="3" width="94" height="144" rx="1" />
            <line className="l" x1="3" y1="75" x2="97" y2="75" />
            <ellipse className="l" cx="50" cy="75" rx="13" ry="13" />
            <circle className="s" cx="50" cy="75" r=".9" />
            <rect className="l" x="20" y="3" width="60" height="25" />
            <rect className="l" x="35" y="3" width="30" height="9" />
            <circle className="s" cx="50" cy="20" r=".8" />
            <path className="l" d="M38 28 A13 13 0 0 0 62 28" />
            <rect className="l" x="20" y="122" width="60" height="25" />
            <rect className="l" x="35" y="138" width="30" height="9" />
            <circle className="s" cx="50" cy="130" r=".8" />
            <path className="l" d="M38 122 A13 13 0 0 1 62 122" />
            <rect className="g" x="42" y=".4" width="16" height="2.6" />
            <rect className="g" x="42" y="147" width="16" height="2.6" />
            <path className="l" d="M3 6 A3 3 0 0 0 6 3 M94 3 A3 3 0 0 0 97 6 M3 144 A3 3 0 0 1 6 147 M94 147 A3 3 0 0 1 97 144" />
          </svg>
          {sysLabel && !mini && (
            <p className="pz-c__sys" aria-hidden="true">
              {sysLabel}
            </p>
          )}
          {shape.length > 0 && (
            <svg key={shapeKey} className={`pz-c__svg pz-c__shape ${shapeKey}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {shape.map((l, k) => (
                <line key={k} x1={round2(l.x1)} y1={round2(l.y1)} x2={round2(l.x2)} y2={round2(l.y2)} />
              ))}
            </svg>
          )}
          {ls.length > 0 && (
            <svg className="pz-c__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {ls.map((l, k) => (
                <path
                  key={`${l.a.i}-${l.b.i}-${k}`}
                  className={`pz-c__lk t${l.t}${focusPid && l.a.pid !== focusPid && l.b.pid !== focusPid ? " dim" : ""}`}
                  d={`M${round2(l.a.x)} ${round2(l.a.y)} L${round2(l.b.x)} ${round2(l.b.y)}`}
                />
              ))}
            </svg>
          )}
          {ov.paths.length > 0 && (
            <>
              <svg className="pz-c__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {ov.paths.map((p, k) => (
                  <path key={`p${k}`} className={`pz-c__p ${p.cls}`} d={p.d} />
                ))}
                {ov.heads.map((h, k) => (
                  <path key={`h${k}`} className={`pz-c__ah ${h.cls}`} d={h.d} />
                ))}
              </svg>
              {!mini &&
                ov.labels.map((t, k) => (
                  <div key={`l${k}`} className="pz-c__at" style={at(t.x, t.y)}>
                    <span className={`pz-c__lbl ${t.cls}`}>{t.t}</span>
                  </div>
                ))}
            </>
          )}
          <div className="pz-c__sweep" aria-hidden="true" />
          {view.ghost.map((g, k) => (
            <div key={`g${k}`} className="pz-c__at" style={at(g.x, g.y)} aria-hidden="true">
              <span className="pz-c__gdot" />
            </div>
          ))}

          {view.tokens.map((t, k) => {
            const m = tokenModel(t);
            const ringCls = [t.kind === "ghost" ? "pz-c__ghostman" : "", t.ring ? `r-${t.ring}` : ""].filter(Boolean).join(" ");
            if (m.isShirt) {
              const inner = (
                <>
                  <CampoShirt still={P.sel.shirt(t.pid ?? null)} className={m.patCls} />
                  <span className="pz-c__dn" aria-hidden="true">
                    {m.num}
                  </span>
                  {m.label && <span className="pz-c__plate">{m.label}</span>}
                  {m.tag && <span className={`pz-c__tag k-${t.ring ?? ""}`}>{m.tag}</span>}
                </>
              );
              return (
                <div key={t.id} className={`pz-c__at ${ringCls}`} style={at(t.x, t.y, k)}>
                  <span className="pz-c__shadow" aria-hidden="true" />
                  <span className="pz-c__ring" aria-hidden="true" />
                  <span className="pz-c__man">
                    {m.tappable ? (
                      <button type="button" className="pz-c__hit is-tok" aria-label={m.aria} aria-pressed={!!t.on} onClick={() => P.emit("token:tap", { id: t.id, pid: t.pid ?? null, kind: t.kind })}>
                        {inner}
                      </button>
                    ) : (
                      <span className="pz-c__hit" role="img" aria-label={m.aria}>
                        {inner}
                      </span>
                    )}
                  </span>
                </div>
              );
            }
            return (
              <div key={t.id} className={`pz-c__at ${ringCls}`} style={at(t.x, t.y, k)}>
                <button
                  type="button"
                  className={`pz-c__riv k-${t.kind}`}
                  aria-label={m.aria}
                  title={t.note || undefined}
                  tabIndex={t.note && !mini ? 0 : -1}
                  onClick={m.tappable ? () => P.emit("token:tap", { id: t.id, pid: t.pid ?? null, kind: t.kind }) : undefined}
                >
                  <b>{m.num}</b>
                  {m.code && <small>{m.code}</small>}
                </button>
              </div>
            );
          })}

          {labels.map((l, k) => (
            <div key={`lab${k}`} className="pz-c__at" style={at(l.x, l.y)}>
              <span className={`pz-c__lab a-${l.align || "left"}`}>
                {l.pat && <i className={`p-${String(l.pat).replace(/^p-/, "")}`} aria-hidden="true" />}
                {l.t}
              </span>
            </div>
          ))}
          {handles.map((d, k) => {
            const hd = d.handle;
            const pts = d.pts ?? [];
            if (!hd) return null;
            const mx = pts.reduce((a, q) => a + q[0], 0) / pts.length;
            const my = pts.reduce((a, q) => a + q[1], 0) / pts.length;
            const clamp = (v: number) => Math.max(hd.min ?? 5, Math.min(hd.max ?? 95, v));
            const step = hd.step || 5;
            return (
              <div key={`hd${k}`} className="pz-c__at" style={at(mx, my, undefined, { "--glide": "0ms" })}>
                <button
                  type="button"
                  className="pz-c__handle"
                  aria-label={`${hd.label || d.label || "Mover la línea"}: arrastra o usa las flechas`}
                  aria-keyshortcuts="ArrowUp ArrowDown"
                  onPointerDown={(e) => startHandle(e, hd.onMove, clamp, hd.onEnd)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                    e.preventDefault();
                    e.stopPropagation();
                    hd.onMove(clamp(my + (e.key === "ArrowUp" ? -step : step)));
                    hd.onEnd?.();
                  }}
                >
                  <svg className="nx-ic" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 4v16M8.5 7.5L12 4l3.5 3.5M8.5 16.5L12 20l3.5-3.5" />
                  </svg>
                </button>
              </div>
            );
          })}

          {view.slots.map((s) => {
            const m = slotModel(s);
            return (
              <div key={`s${s.i}`} className={`pz-c__at ${m.cls}`} style={at(s.x, s.y, s.i)}>
                {s.empty || !m.pl ? (
                  <button
                    type="button"
                    className={`pz-c__slot ${m.slotCls}`}
                    data-pz-drop={`slot:${s.i}`}
                    data-pz-slot={s.i}
                    onClick={() => tapSlot(s)}
                    aria-label={m.aria}
                    tabIndex={mini ? -1 : undefined}
                  >
                    <b aria-hidden="true">+</b>
                    <span className="pz-c__code">{s.code}</span>
                  </button>
                ) : (
                  <>
                    <span className="pz-c__shadow" aria-hidden="true" />
                    <span className="pz-c__ring" aria-hidden="true" />
                    <span className="pz-c__man">
                      <button
                        type="button"
                        className="pz-c__hit"
                        data-pz-drop={`slot:${s.i}`}
                        data-pz-slot={s.i}
                        onClick={() => tapSlot(s)}
                        onPointerDown={(e) => downSlot(e, s)}
                        onMouseEnter={() => setHover(s.pid)}
                        onFocus={() => setHover(s.pid)}
                        onMouseLeave={() => setHover(null)}
                        aria-label={m.aria}
                        aria-pressed={ro ? undefined : !!s.sel}
                        aria-keyshortcuts={ro ? undefined : "Enter M Delete"}
                        tabIndex={mini ? -1 : undefined}
                      >
                        <span className={`pz-c__row${m.rowNone ? " is-none" : ""}`} aria-hidden="true">
                          {m.hasLay && <span className={`pz-c__lay ${m.layCls}`}>{m.layV}</span>}
                          {m.marks.map((mk, k) => (
                            <span key={`mk${k}`} className={`pz-c__mk k-${mk.k}`}>
                              {mk.short} {mk.min}
                            </span>
                          ))}
                          {m.gal.map((g) => (
                            <span key={g.k} className={`pz-c__g pz-c__gal k-${g.k}`}>
                              {g.k}
                            </span>
                          ))}
                        </span>
                        <CampoShirt still={P.sel.shirt(m.pl.id)} />
                        <span className="pz-c__dn" aria-hidden="true">
                          {m.num}
                        </span>
                        <span className="pz-c__plate">{m.label}</span>
                        {m.tag && <span className={`pz-c__tag k-${s.ring}`}>{m.tag}</span>}
                      </button>
                    </span>
                  </>
                )}
              </div>
            );
          })}

          {lkWords.map((l, k) => (
            <div key={`w${k}`} className="pz-c__at" style={at((l.a.x + l.b.x) / 2, (l.a.y + l.b.y) / 2)} aria-hidden="true">
              <span className="pz-c__lkw">{l.word}</span>
            </div>
          ))}
          {view.ball && (
            <div className="pz-c__at" style={at(view.ball.x, view.ball.y, 0)}>
              <span className="pz-c__ball" aria-hidden="true" />
            </div>
          )}
          <div className="pz-c__haze" aria-hidden="true" />
        </div>
      </div>

      {chrome && (
        <>
          {showLayers && (
            <div className="pz-c__top">
              <div className="vd-glass pz-c__layers" role="group" aria-label="Capa del campo" data-scroll-x="1">
                {CAMPO_LAYERS.map((l) => (
                  <button key={l.id} type="button" aria-pressed={layer === l.id} onClick={() => P.act.setLayer(l.id)} aria-keyshortcuts={l.key}>
                    {l.t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="pz-c__br">
            {canDraw && (
              <button type="button" className="vd-glass vd-press nx-ib pz-c__draw" aria-label="Dibujar sobre el campo" aria-pressed={!!S.drawing} aria-keyshortcuts="D" onClick={() => P.act.setDrawing(!S.drawing)}>
                <PzIcon name="pencil" />
              </button>
            )}
            <div className="vd-glass pz-c__cam" role="group" aria-label="Cámara" aria-keyshortcuts="V">
              {CAMS.map((c) => (
                <button key={c.id} type="button" aria-pressed={cam === c.id || (c.id === "grada" && cam === "foco")} onClick={() => P.act.setCamera(c.id)}>
                  <PzIcon name={c.icon} />
                  {c.t}
                </button>
              ))}
            </div>
          </div>
          {legend.length > 0 && !small && (
            <div className="pz-c__bl">
              <p className="pz-c__legend">
                {legend.map((g) => (
                  <span key={g.t}>
                    <i className={g.cls} aria-hidden="true" />
                    {g.t}
                  </span>
                ))}
              </p>
            </div>
          )}
          {view.caption && (
            <p className="pz-c__cap" role="status">
              {view.caption}
            </p>
          )}
        </>
      )}
      {!chrome && inert && view.caption && (
        <p className="pz-c__cap" role="status">
          {view.caption}
        </p>
      )}
      {layer === "quimica" && ls.length > 0 && !mini && (
        <ul className="nx-vh pz-c__sr" aria-label="La química del siete">
          {ls.map((l, k) => (
            <li key={k}>{`${l.a.p?.shirt ?? ""} y ${l.b.p?.shirt ?? ""}: ${l.word.toLowerCase()} (${l.why})`}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
