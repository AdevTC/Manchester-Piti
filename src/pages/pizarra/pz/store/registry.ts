// r14 «La pizarra»: what each place and sheet tells the shell (the prototype's PZ.registerPlace / registerSheet),
// module-level so a place's `register.ts` can call it when it loads. The shell reads it through the store
// (P.sel.placeSub / primary / placeBadge / shareSheet / sheetMeta) and mounts the components.
import type { ComponentType, LazyExoticComponent } from "react";
import type { PzApi } from "./api";
import type { OverlayPath, PlaceBadge, PlaceId, PrimaryAction, RegionProps, SheetProps, SheetText } from "./types";

type Comp<P> = ComponentType<P> | LazyExoticComponent<ComponentType<P>>;

export interface PlaceReg {
  /** The places bar's live sublabel («6 de 7», «3 claves»). */
  sub?: (P: PzApi) => string;
  /** The screen's one primary action (end of the board bar on desktop; above the dock on the phone). */
  primary?: (P: PzApi) => PrimaryAction | null;
  /** Shown instead of the sublabel (and in the phone header): «23′ · 2–1», live. */
  badge?: (P: PzApi) => PlaceBadge | null;
  /** The sheet the board bar's «Compartir» opens in this place. */
  share?: string;
  /** The place's regions (lead · side · peek · panel · stage · full · dock). */
  Component?: Comp<RegionProps>;
}

export interface SheetReg {
  title?: SheetText;
  kicker?: SheetText;
  Component?: Comp<SheetProps>;
  /** A wide sheet (the desktop side column grows to the stage's edge, never over the pitch). */
  wide?: boolean;
}

const places: Partial<Record<PlaceId, PlaceReg>> = {};
const sheets: Record<string, SheetReg> = {};
let listeners: (() => void)[] = [];
const changed = () => listeners.slice().forEach((fn) => fn());

/** A place's sublabel, primary action, badge, share sheet and component (merged with what it registered before). */
export function registerPlace(id: PlaceId, reg: PlaceReg): void {
  places[id] = { ...places[id], ...reg };
  changed();
}
/** A sheet: its frame's texts and its content (the shell draws the frame: kicker, title, ×, Esc, focus trap). */
export function registerSheet(name: string, reg: SheetReg): void {
  sheets[name] = { ...sheets[name], ...reg };
  changed();
}
export const placeReg = (id: PlaceId): PlaceReg | undefined => places[id];
export const sheetReg = (name: string): SheetReg | undefined => sheets[name];
/** A tool the shell mounts over the stage (`dibujar`: the drawing dock while P.state.drawing; region "dock"). */
const tools: Record<string, Comp<RegionProps>> = {};
export function registerTool(name: "dibujar", C: Comp<RegionProps>): void {
  tools[name] = C;
  changed();
}
export const toolReg = (name: "dibujar"): Comp<RegionProps> | undefined => tools[name];

/** How a board's stored stroke is drawn on the pitch (Dibujar registers it; the default draws its kind and points). */
type DrawingRenderer = (stroke: unknown) => OverlayPath | null;
let drawingRenderer: DrawingRenderer | null = null;
export function registerDrawingRenderer(fn: DrawingRenderer | null): void {
  drawingRenderer = fn;
  changed();
}
const KINDS: readonly string[] = ["pase", "carrera", "conduccion", "flecha", "lapiz", "zona"];
export function drawingPath(stroke: unknown): OverlayPath | null {
  if (drawingRenderer) {
    try {
      return drawingRenderer(stroke);
    } catch {
      /* the default below */
    }
  }
  const s = stroke as { kind?: unknown; pts?: unknown; points?: unknown; text?: unknown };
  const raw = Array.isArray(s.pts) ? s.pts : Array.isArray(s.points) ? s.points : null;
  if (!raw) return null;
  const pts = raw
    .map((p: unknown): [number, number] | null => (Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number" ? [p[0], p[1]] : p && typeof p === "object" && typeof (p as { x?: unknown }).x === "number" ? [(p as { x: number }).x, (p as { y: number }).y] : null))
    .filter((p): p is [number, number] => !!p);
  if (pts.length < 2) return null;
  const kind = typeof s.kind === "string" && KINDS.includes(s.kind) ? (s.kind as OverlayPath["kind"]) : "lapiz";
  return { kind, pts, ...(typeof s.text === "string" && s.text ? { label: s.text } : {}) };
}

/** The store bumps when a late registration arrives (a lazily loaded place). */
export function onRegistry(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((x) => x !== fn);
  };
}
