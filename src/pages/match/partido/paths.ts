// The match page's addresses (/partidos/<id>, /siete, /numeros, /vestuario, /mesa) and la mesa's way back: the
// page remembers the screen it opened la mesa from (this tab only), so «Volver al partido» returns to it.
export type MatchScreen = "partido" | "siete" | "numeros" | "vestuario";
const PATH: Record<MatchScreen | "mesa", string> = { partido: "", siete: "/siete", numeros: "/numeros", vestuario: "/vestuario", mesa: "/mesa" };
const KEY = (id: string) => `pp-back:${id}`;

export const matchHref = (id: string, screen: MatchScreen | "mesa" = "partido"): string => `/partidos/${encodeURIComponent(id)}${PATH[screen]}`;

/** Remembers the screen la mesa was opened from. */
export function rememberScreen(id: string, screen: MatchScreen): void {
  try {
    sessionStorage.setItem(KEY(id), screen);
  } catch {
    /* private mode: «Volver al partido» opens El partido */
  }
}

/** Where «Volver al partido» goes from la mesa: the screen it was opened from, else El partido. */
export function backFromMesa(id: string): string {
  let s: string | null = null;
  try {
    s = sessionStorage.getItem(KEY(id));
  } catch {
    s = null;
  }
  return matchHref(id, s === "siete" || s === "numeros" || s === "vestuario" ? s : "partido");
}
