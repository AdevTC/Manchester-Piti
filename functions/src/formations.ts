// Los 15 sistemas de fútbol 7 (sin contar al portero): casillas [posición, u, v] — u 0→100 izquierda→derecha,
// v 0 = portería rival … 100 = la nuestra —, carácter y su ficha. La pizarra deriva de aquí lo que dibuja
// (geometry FORM) y lo que guarda (formations FORMATIONS). Ids ≤ 10 caracteres (firestore.rules).
import type { PosCode } from "./positions.js";

export const SYSTEM_IDS = ["2-3-1", "2-1-2-1", "2-2-2", "2-2-1-1", "3-2-1", "3-1-2", "3-1-1-1", "4-1-1", "3-3", "2-1-3", "1-3-2", "1-2-3", "1-2-2-1", "1-1-2-1-1", "1-3-1-1"] as const;
export type FormationName = (typeof SYSTEM_IDS)[number];
export type SystemCharacter = "equilibrado" | "defensivo" | "ofensivo";
export type Spot = readonly [PosCode, number, number];
export interface SystemDef {
  id: FormationName;
  label: string;
  name: string;
  character: SystemCharacter;
  spots: readonly Spot[];
  about: string;
  strengths: string;
  weaknesses: string;
  needs: string;
}

const GK: Spot = ["POR", 50, 95];
const sys = (id: FormationName, label: string, name: string, character: SystemCharacter, spots: Spot[], about: string, strengths: string, weaknesses: string, needs: string): SystemDef => ({
  id,
  label,
  name,
  character,
  spots: [GK, ...spots],
  about,
  strengths,
  weaknesses,
  needs,
});

export const SYSTEMS_CATALOGUE: readonly SystemDef[] = [
  sys(
    "2-3-1",
    "2-3-1",
    "Clásico",
    "equilibrado",
    [["DFC", 30, 74], ["DFC", 70, 74], ["MI", 17, 49], ["MC", 50, 50], ["MD", 83, 49], ["DC", 50, 22]],
    "El más usado en fútbol 7: dos centrales, tres medios y un punta.",
    "Triángulos de pase en todo el campo y el medio bien poblado.",
    "Si nos ganan el medio, los dos centrales quedan expuestos.",
    "Interiores con recorrido y un punta que aguante de espaldas.",
  ),
  sys(
    "2-1-2-1",
    "2-1-2-1",
    "Rombo",
    "equilibrado",
    [["DFC", 24, 74], ["DFC", 76, 74], ["MCD", 50, 59], ["MI", 20, 41], ["MD", 80, 41], ["DC", 50, 20]],
    "Un pivote por delante de la defensa e interiores que llegan.",
    "Protege a los centrales y da salida limpia.",
    "Las bandas se quedan solas si los interiores no bajan.",
    "Un pivote que ordene e interiores que lleguen al área.",
  ),
  sys(
    "2-2-2",
    "2-2-2",
    "Parejas",
    "equilibrado",
    [["DFC", 30, 74], ["DFC", 70, 74], ["MC", 27, 49], ["MC", 73, 49], ["DC", 27, 22], ["DC", 73, 22]],
    "Dos jugadores en cada línea: simétrico y fácil de entender.",
    "Dos puntas que fijan a la defensa rival.",
    "Poco control del medio con solo dos.",
    "Medios todoterreno y dos puntas que se entiendan.",
  ),
  sys(
    "2-2-1-1",
    "2-2-1-1",
    "Mediapunta",
    "equilibrado",
    [["DFC", 30, 74], ["DFC", 70, 74], ["MCD", 24, 50], ["MC", 76, 50], ["MCO", 50, 43], ["DC", 50, 15]],
    "Un enganche entre líneas por detrás del punta.",
    "El mediapunta recibe entre líneas y filtra pases.",
    "Si el mediapunta no defiende, el medio sufre.",
    "Un mediapunta creativo y un pivote que cubra.",
  ),
  sys(
    "3-2-1",
    "3-2-1",
    "Línea de 3",
    "defensivo",
    [["LI", 18, 72], ["DFC", 50, 74], ["LD", 82, 72], ["MC", 25, 46], ["MC", 75, 46], ["DC", 50, 22]],
    "Tres atrás sólidos y carrileros que suben por banda.",
    "Mucha seguridad atrás y amplitud por fuera.",
    "El punta puede quedarse muy solo.",
    "Laterales con piernas para subir y bajar.",
  ),
  sys(
    "3-1-2",
    "3-1-2",
    "Contra",
    "defensivo",
    [["LI", 18, 72], ["DFC", 50, 74], ["LD", 82, 72], ["MCD", 50, 48], ["DC", 22, 22], ["DC", 78, 22]],
    "Robar atrás y salir rápido con dos arriba.",
    "Defensa de tres y contraataques con dos puntas.",
    "Un solo medio: el rival puede dominar la pelota.",
    "Un pivote incansable y puntas rápidos.",
  ),
  sys(
    "3-1-1-1",
    "3-1-1-1",
    "Escalonado",
    "defensivo",
    [["LI", 18, 74], ["DFC", 50, 74], ["LD", 82, 74], ["MCD", 38, 50], ["MCO", 64, 44], ["DC", 50, 16]],
    "Defensa de tres con un eje vertical: pivote, mediapunta y punta.",
    "Ocupa el carril central de arriba abajo.",
    "Las bandas del medio quedan vacías.",
    "Laterales que cierren y un eje con buen pase.",
  ),
  sys(
    "4-1-1",
    "4-1-1",
    "Cerrojo",
    "defensivo",
    [["LI", 10, 68], ["DFC", 36, 74], ["DFC", 64, 74], ["LD", 90, 68], ["MCD", 50, 50], ["DC", 50, 22]],
    "Cuatro atrás para defender un resultado.",
    "Muy difícil de superar por fuera y por dentro.",
    "Casi no hay llegada: el punta vive aislado.",
    "Defensas disciplinados y un punta que aguante el balón.",
  ),
  sys(
    "3-3",
    "3-3",
    "Falso nueve",
    "defensivo",
    [["LI", 18, 72], ["DFC", 50, 74], ["LD", 82, 72], ["MI", 17, 46], ["MC", 50, 40], ["MD", 83, 46]],
    "Sin punta fijo: el medio llega desde atrás.",
    "Superioridad en el medio y llegadas por sorpresa.",
    "Sin referencia arriba cuesta finalizar.",
    "Medios con gol y mucho movimiento.",
  ),
  sys(
    "2-1-3",
    "2-1-3",
    "Tridente",
    "ofensivo",
    [["DFC", 30, 74], ["DFC", 70, 74], ["MCD", 50, 50], ["EI", 17, 30], ["DC", 50, 22], ["ED", 83, 30]],
    "Tres arriba con los extremos abiertos.",
    "Mucha presión arriba y amplitud en ataque.",
    "El pivote se queda solo ante las transiciones.",
    "Extremos rápidos y un pivote que lo tape todo.",
  ),
  sys(
    "1-3-2",
    "1-3-2",
    "Líbero",
    "ofensivo",
    [["LIB", 50, 74], ["MI", 17, 50], ["MC", 50, 48], ["MD", 83, 50], ["DC", 22, 22], ["DC", 78, 22]],
    "Un último hombre, el medio poblado y dos puntas.",
    "Mucha gente por delante del balón.",
    "Un solo defensa: cada pérdida es peligrosa.",
    "Un líbero rápido y con lectura.",
  ),
  sys(
    "1-2-3",
    "1-2-3",
    "Todo arriba",
    "ofensivo",
    [["LIB", 50, 74], ["MC", 30, 50], ["MC", 70, 50], ["EI", 17, 23], ["DC", 50, 20], ["ED", 83, 23]],
    "Para remontar: tres arriba y dos medios.",
    "Máxima presión y muchos jugadores en el área.",
    "Muy expuesto a la contra.",
    "Medios que corran por dos y un líbero valiente.",
  ),
  sys(
    "1-2-2-1",
    "1-2-2-1",
    "Alas",
    "ofensivo",
    [["LIB", 50, 74], ["MC", 24, 57], ["MC", 76, 57], ["EI", 17, 31], ["ED", 83, 31], ["DC", 50, 20]],
    "Extremos por fuera y un nueve en el área.",
    "Amplitud y centros para el punta.",
    "Las bandas defensivas quedan a la espalda de los extremos.",
    "Extremos que también bajen y un punta rematador.",
  ),
  sys(
    "1-1-2-1-1",
    "1-1-2-1-1",
    "Rombo alto",
    "ofensivo",
    [["LIB", 50, 74], ["MCD", 38, 50], ["MI", 10, 42], ["MD", 90, 42], ["MCO", 64, 44], ["DC", 50, 16]],
    "Un rombo completo en el medio con un último hombre.",
    "Dominio del medio y muchas líneas de pase.",
    "Un solo defensa ante balones largos.",
    "Un pivote que cubra al líbero y un mediapunta con visión.",
  ),
  sys(
    "1-3-1-1",
    "1-3-1-1",
    "Escalera",
    "ofensivo",
    [["LIB", 50, 74], ["MI", 17, 49], ["MC", 50, 50], ["MD", 83, 49], ["MCO", 36, 22], ["DC", 64, 14]],
    "Un líbero, tres medios y un mediapunta detrás del punta.",
    "Superioridad en el medio y un enganche que conecta con el punta.",
    "Un solo defensa: las bandas a la espalda de los interiores sufren.",
    "Un líbero rápido e interiores que bajen.",
  ),
];

const BY_ID = new Map(SYSTEMS_CATALOGUE.map((s) => [s.id, s]));
export const systemDef = (id: FormationName): SystemDef => BY_ID.get(id) ?? SYSTEMS_CATALOGUE[0];
export const isFormationName = (v: unknown): v is FormationName => typeof v === "string" && BY_ID.has(v as FormationName);
