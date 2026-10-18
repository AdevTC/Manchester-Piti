// Public types of «La luz del partido»: CDM Palomeras lit by the real sun (contract of the Inicio/Partidos plan).
import type { ReactNode } from "react";
import type { Sky } from "../../lib/weather";

export interface PalomerasFigure {
  id: string;
  num: string;
  name: string;
  /** Pitch %: x across (0 our left touchline → 100 our right), y from our goal (0) to theirs (100). */
  x: number;
  y: number;
  tag?: "tu" | "gol" | "mvp" | "amarilla" | "roja";
  /** Walks off to the touchline and disappears. */
  leaving?: boolean;
  /** Joins the half-time huddle by the bench (no plate). */
  huddle?: boolean;
  /** Extra (beyond the contract): goalkeeper's navy shirt and gold-ringed plate. */
  gk?: boolean;
  /** Extra (beyond the contract): "mini" = number only (the acta's nine), "none" = no plate. */
  plate?: "full" | "mini" | "none";
}

export interface PalomerasState {
  /** ms shown: drives the sun (sunPosition) and the sky. */
  at: number;
  weather?: { sky: Sky; cloud?: number | null; rain?: number | null } | null;
  floodlights: "off" | "glow" | "on";
  /** Perimeter boards' live message (sponsors otherwise). */
  board?: string;
  /** Extra (beyond the contract): the board's colourway; gold for an MVP or a record. */
  boardKind?: "navy" | "gold" | "rival";
  sponsors?: readonly string[];
  figures?: readonly PalomerasFigure[];
  /** Neutral visiting ground (no crest). */
  away?: boolean;
}

export type PalomerasRig = "hero390" | "hero820" | "hero1440" | "slice" | "sliceWide" | "window";

export interface PalomerasHandle {
  goal(ours: boolean, scorerId?: string): void;
  ignite(): void;
  mvp(id: string): void;
  /** Pointer parallax, -0.5..0.5 from the centre of the view. */
  pointer(nx: number, ny: number): void;
  /** Extra: screen point (px in the element) of a pitch % spot at a height in metres; null if behind. */
  project(x: number, y: number, height?: number): { x: number; y: number } | null;
}

export interface PalomerasSliceView {
  rig: PalomerasRig;
  state: PalomerasState;
  /** CSS px of the slice. */
  w: number;
  h: number;
  /** Extra: which of the six vantage points (1–6) a slice uses; defaults to its position in `views`. */
  spot?: number;
  /** Extra: class and overlay (the jornada's labels) for this slice's box. */
  className?: string;
  children?: ReactNode;
}

/** The three skies the ground paints. */
export type WeatherKind = "despejado" | "nublado" | "lluvia";
