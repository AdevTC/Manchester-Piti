// DEV only: the TU boards' «Maqueta» strip over production's data. Signed in as the emulator's captain, any Tú
// screen or surface can be looked at as someone else and in any state of the device or the inbox:
//   ?quien=fan|socio|nuevo|pendiente|jugador|capitan|admin   (jugador: &jugador=<playerId>, default the board's Kevin)
//   &movil=listo|iphone|bloqueado|nosoporta                   (this device, as Avisos a medida reads it)
//   &bandeja=vacia|cargando|error                             (the notices' read)
// The production build never reads it (import.meta.env.DEV is false there).

export type TuQuien = "fan" | "socio" | "nuevo" | "pendiente" | "jugador" | "capitan" | "admin";
export type TuMovil = "listo" | "iphone" | "bloqueado" | "nosoporta";
export type TuBandeja = "vacia" | "cargando" | "error";

export interface TuMaqueta {
  quien: TuQuien | null;
  /** The ficha a «jugador» looks through (a player id; null: the first linked one the page finds). */
  jugador: string | null;
  movil: TuMovil | null;
  bandeja: TuBandeja | null;
}

const QUIEN: readonly string[] = ["fan", "socio", "nuevo", "pendiente", "jugador", "capitan", "admin"];
const MOVIL: readonly string[] = ["listo", "iphone", "bloqueado", "nosoporta"];
const BANDEJA: readonly string[] = ["vacia", "cargando", "error"];

/** The first maqueta an address asked for stays until the page reloads (moving between screens drops the params). */
let sticky: TuMaqueta | null = null;

/** The maqueta in the address, else the one this load started with (null in production or when none was asked). */
export function readTuMaqueta(search: string = typeof location === "undefined" ? "" : location.search): TuMaqueta | null {
  if (!import.meta.env.DEV) return null;
  const now = parseTuMaqueta(search);
  if (now) sticky = now;
  return sticky;
}

export function parseTuMaqueta(search: string): TuMaqueta | null {
  const q = new URLSearchParams(search);
  const quien = q.get("quien");
  const movil = q.get("movil");
  const bandeja = q.get("bandeja");
  const out: TuMaqueta = {
    quien: quien && QUIEN.includes(quien) ? (quien as TuQuien) : null,
    jugador: q.get("jugador"),
    movil: movil && MOVIL.includes(movil) ? (movil as TuMovil) : null,
    bandeja: bandeja && BANDEJA.includes(bandeja) ? (bandeja as TuBandeja) : null,
  };
  return out.quien || out.movil || out.bandeja ? out : null;
}
