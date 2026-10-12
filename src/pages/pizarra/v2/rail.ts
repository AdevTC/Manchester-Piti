// The tools, as the «Acciones» rail groups them (En el campo / Gestión): their order is the 1–8 shortcut.
import type { IconName } from "./icons";
import type { Modo } from "./view";

export interface RailItem {
  m: Modo;
  l: string;
  /** The one line under the name (desktop). */
  d: string;
  icon: IconName;
  /** The icon's size, when not the default. */
  w?: number;
  /** The «nuevo» badge. */
  nv?: boolean;
}

export const RAIL: { g: string; items: RailItem[] }[] = [
  {
    g: "En el campo",
    items: [
      { m: "editar", l: "Siete", d: "Alineación y banquillo", icon: "card" },
      { m: "quimica", l: "Química", d: "Las luces entre vecinos", icon: "spark" },
      { m: "jugadas", l: "Jugadas", d: "Estrategia en repetición", icon: "film", nv: true },
      { m: "dibujar", l: "Dibujar", d: "Trazos sobre el césped", icon: "pen", nv: true },
    ],
  },
  {
    g: "Gestión",
    items: [
      { m: "tableros", l: "Tableros", d: "Míos, oficial y partido", icon: "boards" },
      { m: "comparar", l: "Comparar", d: "Dos sietes cara a cara", icon: "compare" },
      { m: "compartir", l: "Compartir", d: "Cartel para el grupo", icon: "share", w: 20 },
      { m: "ajustes", l: "Ajustes", d: "Cromos, cámara, sonido", icon: "sliders" },
    ],
  },
];

/** The tools in their shortcut order (1–8). */
export const RAIL_ORDER: Modo[] = RAIL.flatMap((g) => g.items.map((x) => x.m));
