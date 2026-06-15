// Team tactical instructions for fútbol 7 (TV-graphic style controls).
// Each instruction is a small ordered scale; the board stores the chosen
// label per key. Adapted to F7 (see the F7 tactics research in the spec).

export type TacticKey =
  | "defLine"
  | "press"
  | "width"
  | "tempo"
  | "mentality"
  | "buildup"
  | "attackFocus";

export interface TacticDef {
  key: TacticKey;
  label: string;
  options: string[];
  def: string;
}

export const TACTICS: TacticDef[] = [
  { key: "defLine", label: "Línea defensiva", options: ["Baja", "Media", "Alta"], def: "Media" },
  { key: "press", label: "Presión", options: ["Repliegue", "Media", "Alta"], def: "Media" },
  { key: "width", label: "Amplitud", options: ["Estrecha", "Media", "Amplia"], def: "Media" },
  { key: "tempo", label: "Ritmo", options: ["Pausado", "Medio", "Rápido"], def: "Medio" },
  { key: "mentality", label: "Mentalidad", options: ["Defensiva", "Equilibrada", "Ofensiva"], def: "Equilibrada" },
  { key: "buildup", label: "Salida de balón", options: ["Corta", "Mixta", "En largo"], def: "Mixta" },
  { key: "attackFocus", label: "Foco de ataque", options: ["Bandas", "Centro", "Equilibrado"], def: "Equilibrado" },
];

export type Tactics = Record<TacticKey, string>;

export const defaultTactics = (): Tactics =>
  Object.fromEntries(TACTICS.map((t) => [t.key, t.def])) as Tactics;
