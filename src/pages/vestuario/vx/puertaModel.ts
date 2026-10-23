// «La puerta» (/vestuario/puerta, captains): the pure pieces of the block, the words the board's vx.d draws for
// who is knocking, who is inside and the live passes, out of production's rows.
export type DoorTab = 0 | 1 | 2;
export interface SquadShirt {
  id: string;
  name: string;
  num: string;
}

/** «Pellete · 20» (no dorsal: just the name). */
export const fichaLabel = (s: SquadShirt) => (s.num ? `${s.name} · ${s.num}` : s.name);

/** «24 de septiembre» in club time. */
const longDay = (ms: number) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "long" }).format(ms);
/** «Dentro desde el 24 de septiembre» (an old account with no date: «Dentro»). */
export const since = (ms: number) => (ms ? `Dentro desde el ${longDay(ms)}` : "Dentro");

/** «Caduca hoy», «Caduca en 5 días». */
export function daysLeft(expiresAt: number, now: number) {
  const d = Math.ceil((expiresAt - now) / 86_400_000);
  return d <= 1 ? "Caduca hoy" : `Caduca en ${d} días`;
}

/** Who knocks, as the request carries him: the name he gave, else his Google name. */
export const knockNick = (r: { name: string | null; googleName: string; email: string }) => r.name || r.googleName || r.email || "Sin nombre";
/** The ficha he asked for: «Pellete · 20», the name the request kept, or «Sin ficha». */
export function knockFicha(playerId: string | null | undefined, playerName: string | null, byId: ReadonlyMap<string, SquadShirt>) {
  const p = playerId ? byId.get(playerId) : undefined;
  if (p) return fichaLabel(p);
  return playerId && playerName ? playerName : "Sin ficha";
}

/** A pass's title: «Para Pellete · 20», «Para Almachi», «Enlace abierto · sin ficha». */
export function passTitle(v: { playerId: string | null; playerName: string | null }, byId: ReadonlyMap<string, SquadShirt>) {
  const p = v.playerId ? byId.get(v.playerId) : undefined;
  return p ? `Para ${fichaLabel(p)}` : v.playerName ? `Para ${v.playerName}` : "Enlace abierto · sin ficha";
}
/** «1 uso · Caduca en 5 días · Sin usar». */
export const passLine = (v: { maxUses: number; uses: number; expiresAt: number }, now: number) =>
  `${v.maxUses === 0 ? "Ilimitado" : "1 uso"} · ${daysLeft(v.expiresAt, now)} · ${v.uses ? `${v.uses} ${v.uses === 1 ? "entrada" : "entradas"}` : "Sin usar"}`;

/** The WhatsApp text for a new link (named when it keeps a ficha). */
export const waText = (link: string, name?: string) =>
  name ? `¡${name}! Te abro el vestuario del Manchester Piti: entra con tu Google aquí: ${link}` : `Te abro el vestuario del Manchester Piti: entra con tu Google aquí: ${link}`;

/** «1 cuenta dentro», «14 cuentas dentro». */
export const insideLine = (n: number) => `${n} ${n === 1 ? "cuenta" : "cuentas"} dentro. Quitar el acceso no borra a nadie de la plantilla.`;
