// r14 «La pizarra»: its addresses (DIRECTION.md § IA), pure. /pizarra/<place>[/<sub>]?<q>: the place shown, its
// sub-screen (a part of the plan, a jugada, Comparar) and the address' parameters as strings. The old addresses
// (/pizarra, its #hashes, ?desde=mesa, /pizarra/dibujar) are redirected before the page loads (lib/legacyUrls).
import type { PlaceId, PzRoute } from "./types";

export const PLACE_IDS: readonly PlaceId[] = ["siete", "plan", "jugadas", "partido", "tableros", "pachanga", "charla"];
/** The plan's parts (/pizarra/plan/<part>). */
export const PLAN_PARTS = ["rival", "claves", "juego", "parado", "sipasa", "notas"] as const;
export type PlanPart = (typeof PLAN_PARTS)[number];
/** The parameters the pizarra itself names (a place may add its own sheet arguments; the router keeps any
 *  short lowercase key). */
/** (alto = the phone sheet's height: peek · half · full) */
export const PZ_KEYS = ["tablero", "hoja", "capa", "modo", "partido", "desde", "a", "b", "va", "vb", "jugador", "hueco", "paso", "alto"] as const;

const isPlace = (s: string): s is PlaceId => (PLACE_IDS as readonly string[]).includes(s);

const asString = (v: unknown): string | null => {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return String(v);
  return null;
};

/** The route an address names. `search` as the router parsed it (a value may come as a number). */
export function parsePizarra(pathname: string, search: Record<string, unknown> = {}): PzRoute {
  const q: Record<string, string> = {};
  for (const [k, v] of Object.entries(search)) {
    if (k === "season") continue;
    const s = asString(v);
    if (s !== null && s !== "") q[k] = s;
  }
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const seg = path.split("/").slice(1).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  const lost: PzRoute = { place: "perdido", sub: path, q };
  if (seg[0] !== "pizarra") return lost;
  const p = seg[1] ?? "";
  if (!p) return { place: "siete", sub: "", q };
  if (!isPlace(p)) return lost;
  const rest = seg.slice(2);
  if (!rest.length) return { place: p, sub: "", q };
  if (rest.length > 1) return lost;
  const sub = rest[0];
  if (p === "plan") return (PLAN_PARTS as readonly string[]).includes(sub) ? { place: p, sub, q } : lost;
  if (p === "jugadas") return /^[A-Za-z0-9_-]{1,64}$/.test(sub) ? { place: p, sub, q } : lost;
  if (p === "tableros") return sub === "comparar" ? { place: p, sub, q } : lost;
  return lost;
}

/** The address of a place (its sub-screen and parameters; empty ones dropped, keys in a stable order: the
 *  pizarra's own first, as PZ_KEYS lists them, then the rest alphabetically). */
export function pizarraHref(place: PlaceId, sub = "", q: Record<string, string | undefined> = {}): string {
  const keys = Object.keys(q).filter((k) => q[k] !== undefined && q[k] !== "");
  const rank = (k: string) => {
    const i = (PZ_KEYS as readonly string[]).indexOf(k);
    return i < 0 ? PZ_KEYS.length : i;
  };
  keys.sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
  const qs = keys.map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(q[k] as string)).join("&");
  return "/pizarra/" + place + (sub ? "/" + encodeURIComponent(sub) : "") + (qs ? "?" + qs : "");
}
