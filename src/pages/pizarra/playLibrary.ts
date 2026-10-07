// The built-in jugadas (estrategia): córner, falta, saque de banda and salida de balón, from the
// approved design. Stored by slot (0 POR, 1–2 DFC, 3 MI, 4 MC, 5 MD, 6 DC: the order every system
// keeps, back to front) and turned into a Play for the seven on the board, so the people moving
// are the ones in those slots. The player with the galón for the dead ball (córners / faltas)
// takes it. Arrows are derived from each move. Pure data + one function; tested in plays.test.ts.
import type { Lineup, RoleKey } from "./formations";
import { deriveArrows, type Play, type PlayFrame, type PlayKind } from "./plays";

type XY = [number, number];
interface LibStep {
  title: string;
  note: string;
  /** Spot of slot 0..6. */
  p: XY[];
  /** Rivals r1..r5. */
  r: XY[];
  b: XY;
}
interface LibPlay {
  kind: Exclude<PlayKind, "propia">;
  name: string;
  /** Who takes the dead ball: the holder of this galón goes to that slot's spots. */
  taker?: { role: RoleKey; slot: number };
  steps: LibStep[];
}
const st = (title: string, note: string, p: XY[], r: XY[], b: XY): LibStep => ({ title, note, p, r, b });

export const PLAY_LIBRARY: readonly LibPlay[] = [
  {
    kind: "corner",
    name: "Córner a favor",
    taker: { role: "cornersId", slot: 3 },
    steps: [
      st("Colocación", "El especialista a la esquina. Dos rematan y uno espera el rechace.", [[50, 90], [36, 58], [62, 30], [95, 4], [42, 22], [72, 14], [28, 12]], [[50, 3], [46, 9], [58, 9], [38, 18], [66, 20]], [94, 4]),
      st("Bloqueo y desmarque", "El central bloquea en el primer palo; la punta da un paso atrás.", [[50, 90], [38, 52], [58, 16], [95, 4], [44, 25], [72, 7], [30, 18]], [[50, 3], [47, 10], [60, 12], [36, 21], [66, 9]], [94, 4]),
      st("Centro al segundo palo", "Centro tenso entre el portero y la defensa.", [[50, 90], [38, 50], [57, 14], [92, 7], [44, 24], [69, 6], [38, 8]], [[50, 3], [47, 11], [60, 11], [33, 15], [64, 6]], [40, 8]),
      st("Remate", "Cabezazo cruzado al palo largo. Dentro.", [[50, 90], [38, 50], [57, 14], [90, 8], [46, 25], [69, 6], [41, 7]], [[56, 2], [47, 11], [60, 11], [34, 15], [64, 6]], [46, 1.5]),
    ],
  },
  {
    kind: "falta",
    name: "Falta frontal",
    taker: { role: "freekicksId", slot: 3 },
    steps: [
      st("Barrera", "Dos sobre el balón; uno al final de la barrera, atento al rechace.", [[50, 90], [36, 62], [64, 62], [40, 34], [58, 44], [76, 16], [64, 30]], [[50, 3], [43, 20], [48, 20], [53, 20], [58, 20]], [52, 28]),
      st("Amago", "La punta pasa por encima del balón y arrastra a la barrera.", [[50, 90], [36, 62], [64, 62], [42, 33], [58, 42], [78, 13], [64, 21]], [[50, 3], [43, 20], [48, 20], [53, 20], [60, 17]], [52, 28]),
      st("Rosca", "Rosca por encima de la barrera, a la escuadra.", [[50, 90], [36, 62], [64, 62], [46, 30], [58, 41], [79, 10], [65, 18]], [[45, 3], [43, 20], [48, 20], [53, 20], [60, 17]], [40, 1.5]),
    ],
  },
  {
    kind: "banda",
    name: "Saque de banda",
    steps: [
      st("Saque", "Saca la banda; el MC viene en corto y la punta fija al central.", [[50, 90], [34, 72], [66, 72], [24, 44], [62, 54], [96, 38], [54, 22]], [[50, 3], [40, 40], [68, 44], [80, 48], [50, 18]], [97, 37]),
      st("En corto", "Saque al pie del MC, que la devuelve de primeras.", [[50, 90], [34, 72], [68, 70], [26, 40], [84, 48], [94, 32], [52, 22]], [[50, 3], [40, 40], [70, 44], [82, 52], [50, 18]], [84, 47]),
      st("A la espalda", "El que ha sacado recibe a la espalda y centra atrás.", [[50, 90], [36, 70], [68, 66], [30, 32], [80, 44], [90, 22], [50, 13]], [[50, 3], [42, 38], [72, 46], [84, 50], [54, 14]], [89, 22]),
    ],
  },
  {
    kind: "salida",
    name: "Salida de balón",
    steps: [
      st("Portero con balón", "Saque en corto: el portero la tiene y los centrales se abren.", [[50, 92], [30, 76], [70, 76], [18, 52], [50, 58], [82, 52], [50, 26]], [[50, 5], [40, 42], [60, 42], [50, 30], [30, 24]], [50, 88]),
      st("Abren los centrales", "Los centrales pisan la banda y el MC baja a ofrecerse.", [[50, 92], [12, 80], [88, 80], [18, 46], [50, 67], [82, 46], [50, 26]], [[50, 5], [36, 62], [64, 62], [50, 48], [30, 36]], [50, 88]),
      st("Pase al central", "Pase raso al central derecho, lejos de la presión.", [[50, 92], [12, 80], [88, 78], [18, 46], [52, 64], [86, 56], [50, 26]], [[50, 5], [38, 62], [72, 68], [52, 50], [30, 36]], [86, 75]),
      st("Salto de línea", "Pared con la banda y diagonal a la punta, de cara.", [[50, 92], [16, 76], [82, 66], [30, 30], [56, 50], [86, 42], [54, 18]], [[50, 5], [42, 58], [78, 72], [58, 46], [34, 34]], [54, 19]),
    ],
  },
];

/** Stable id of a built-in jugada (not stored on the board: rebuilt from the library each time). */
export const libraryPlayId = (kind: LibPlay["kind"]) => `lib-${kind}`;

/** Slot index → player id for a library jugada on this lineup (the galón holder takes the dead ball). */
function cast(lineup: Lineup, taker: LibPlay["taker"]): (string | null)[] {
  const ids = Array.from({ length: 7 }, (_, i) => lineup.slots[i]?.playerId ?? null);
  const holder = taker ? lineup.roles[taker.role] : undefined;
  const at = holder ? ids.indexOf(holder) : -1;
  // the keeper never leaves goal to take it
  if (taker && at > 0 && at !== taker.slot) [ids[at], ids[taker.slot]] = [ids[taker.slot], ids[at]];
  return ids;
}

/** The built-in jugadas for the seven on `lineup` (empty slots are simply not in them). */
export function libraryPlays(lineup: Lineup): Play[] {
  return PLAY_LIBRARY.map((lib) => {
    const ids = cast(lineup, lib.taker);
    const frames: PlayFrame[] = lib.steps.map((s) => ({
      players: Object.fromEntries(ids.flatMap((id, i) => (id ? [[id, { x: s.p[i][0], y: s.p[i][1] }]] : []))),
      ball: { x: s.b[0], y: s.b[1] },
      rivals: s.r.map(([x, y], j) => ({ id: `r${j + 1}`, x, y })),
      arrows: [],
      title: s.title,
      note: s.note,
    }));
    frames.forEach((f, i) => {
      if (frames[i + 1]) f.arrows = deriveArrows(f, frames[i + 1]);
    });
    return { id: libraryPlayId(lib.kind), name: lib.name, kind: lib.kind, frames };
  });
}
