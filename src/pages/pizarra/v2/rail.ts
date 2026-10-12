// The tools, as the «Acciones» rail groups them (En el campo / Gestión): their order is the 1–8 shortcut.
// The «nuevo» badges expire: each one goes once its tool has been opened twice on this device, and all
// of them 30 days after the FUT chrome came out.
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
  /** The «nuevo» badge (while it hasn't expired, see nuevoOn). */
  readonly nv?: boolean;
}

/** When the «nuevo» badges went up (La pizarra FUT, 12 Oct 2026) and how long they last. */
export const NUEVO_DESDE = Date.UTC(2026, 9, 12);
export const NUEVO_DIAS = 30;
/** Opening a tool this many times takes its badge away. */
export const NUEVO_VISTAS = 2;
const KEY = "mp_pizarra_nuevo";

function opened(): Partial<Record<Modo, number>> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return v && typeof v === "object" ? (v as Partial<Record<Modo, number>>) : {};
  } catch {
    return {};
  }
}

/** Whether a tool still wears its «nuevo» badge on this device. */
export function nuevoOn(m: Modo, now: number = Date.now()): boolean {
  if (now >= NUEVO_DESDE + NUEVO_DIAS * 86_400_000) return false;
  const n = opened()[m];
  return !(typeof n === "number" && n >= NUEVO_VISTAS);
}

/** A tool was opened (its badge goes after NUEVO_VISTAS). Private mode: the badge just stays. */
export function noteToolOpened(m: Modo): void {
  try {
    const o = opened();
    const n = o[m] ?? 0;
    if (n >= NUEVO_VISTAS) return;
    localStorage.setItem(KEY, JSON.stringify({ ...o, [m]: n + 1 }));
  } catch {
    /* private mode */
  }
}

const item = (it: Omit<RailItem, "nv">, nuevo = false): RailItem =>
  nuevo
    ? {
        ...it,
        get nv() {
          return nuevoOn(it.m);
        },
      }
    : it;

export const RAIL: { g: string; items: RailItem[] }[] = [
  {
    g: "En el campo",
    items: [
      item({ m: "editar", l: "Siete", d: "Alineación y banquillo", icon: "card" }),
      item({ m: "quimica", l: "Química", d: "Las luces entre vecinos", icon: "spark" }),
      item({ m: "jugadas", l: "Jugadas", d: "Estrategia en repetición", icon: "film" }, true),
      item({ m: "dibujar", l: "Dibujar", d: "Trazos sobre el césped", icon: "pen" }, true),
    ],
  },
  {
    g: "Gestión",
    items: [
      item({ m: "tableros", l: "Tableros", d: "Míos, oficial y partido", icon: "boards" }),
      item({ m: "comparar", l: "Comparar", d: "Dos sietes cara a cara", icon: "compare" }),
      item({ m: "compartir", l: "Compartir", d: "Cartel para el grupo", icon: "share", w: 20 }),
      item({ m: "ajustes", l: "Ajustes", d: "Cromos, cámara, sonido", icon: "sliders" }),
    ],
  },
];

/** The tools in their shortcut order (1–8). */
export const RAIL_ORDER: Modo[] = RAIL.flatMap((g) => g.items.map((x) => x.m));
