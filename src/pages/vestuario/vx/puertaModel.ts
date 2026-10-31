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
/** The club's calendar day of a moment («2026-10-31»). */
const dayKey = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
/** Whether `ms` falls on the same club day as `now`. */
export const isToday = (ms: number, now: number) => !!ms && dayKey(ms) === dayKey(now);
/** «Dentro desde el 24 de septiembre» (an old account with no date: «Dentro»); with `now`, today's «Dentro desde hoy». */
export const since = (ms: number, now?: number) => (!ms ? "Dentro" : now != null && isToday(ms, now) ? "Dentro desde hoy" : `Dentro desde el ${longDay(ms)}`);
/** «el 7 nov»: the day a new pass stops working. */
export const validUntil = (ms: number) => `el ${new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" }).format(ms).replace(".", "")}`;

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

/** «1 cuenta dentro.», «14 cuentas dentro.» (the section's title; its note says removing access deletes nobody). */
export const insideLine = (n: number) => `${n} ${n === 1 ? "cuenta" : "cuentas"} dentro.`;

/** «MR» for «Marcos Ruiz», «SM» for «sergio.mz», «PA» for «Pablo»: the knocker's round tag. */
export function initials(name: string) {
  const parts = name.trim().split(/[\s._@-]+/).filter(Boolean);
  if (!parts.length) return "?";
  const two = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  return two.toLocaleUpperCase("es");
}

/** «ahora», «hace 20 min», «hace 2 h», «hace 3 días» (no date: nothing). */
export function ago(at: number, now: number) {
  if (!at) return "";
  const min = Math.max(0, Math.floor((now - at) / 60_000));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

/**
 * What a knock asks for, in the words the card draws: the kicker («Quiere entrar como», «Entrará como» once the
 * captain changed it, «Quiere entrar» without one), the ficha («Pellete · 20» or «Sin ficha») and the line under it.
 * `pick`: the ficha he will enter with (the captain's change, else the one he asked for); `wants`: the one he asked for
 * (its label: the squad's, else the name the request kept); `wantsTaken`: someone else already has that ficha.
 */
export function askWords(o: { pick: string; pickLabel: string; wants: string; wantsLabel: string; wantsTaken: boolean }) {
  const changed = o.pick !== o.wants;
  const k = o.pick ? (changed ? "Entrará como" : "Quiere entrar como") : "Quiere entrar";
  const t = o.pick ? o.pickLabel : "Sin ficha";
  let s: string;
  if (o.pick && changed) s = o.wants ? `Pidió ${o.wantsLabel}: la cambias tú.` : "Pidió entrar sin ficha: se la pones tú.";
  else if (o.pick) s = o.wantsTaken ? "Esa ficha ya tiene dueño: cámbiasela o que entre sin ficha." : "Su ficha está libre: entra con ella.";
  else s = o.wants ? `Pidió ${o.wantsLabel}; entra sin ficha y se la haces tú.` : "No está en la plantilla: el capitán le hace la ficha.";
  return { k, t, s };
}

/** The «Cambiar ficha» choices: none, then the free fichas; the one he asked for stays listed even if it is not free. */
export function knockOptions(free: readonly SquadShirt[], wants: string, wantsLabel: string) {
  const opts = [{ v: "", t: "Sin ficha · el capitán se la hace" }, ...free.map((s) => ({ v: s.id, t: fichaLabel(s) }))];
  if (wants && !free.some((s) => s.id === wants)) opts.splice(1, 0, { v: wants, t: wantsLabel });
  return opts;
}

/** The room's title and line: who knocks right now (still looking: it says so). */
export function puertaHead(knocking: number, loading: boolean) {
  if (!knocking && loading) return { title: "Mirando quién llama…", sub: "Quién llama, quién está dentro y quién tiene pase: un toque y abres." };
  return knocking
    ? { title: `${knocking} ${knocking === 1 ? "llama" : "llaman"} a la puerta`, sub: "Mira quién es y con qué camiseta quiere entrar: un toque y abres. Aquí también mandas pases y ves quién está dentro." }
    : { title: "Túnel en silencio", sub: "Nadie llamando a la puerta. Quién llama, quién está dentro y quién tiene pase: un toque y abres." };
}

/** The drawn tunnel, said: «El túnel: 2 llaman a la puerta (Marcos, dani), 2 pases activos y 8 cuentas dentro.» */
export function tunnelAria(names: readonly string[], passes: number, inside: number) {
  const k = names.length;
  const who = k ? `${k} ${k === 1 ? "llama" : "llaman"} a la puerta (${names.join(", ")})` : "nadie llamando";
  return `El túnel: ${who}, ${passes} ${passes === 1 ? "pase activo" : "pases activos"} y ${inside} ${inside === 1 ? "cuenta dentro" : "cuentas dentro"}.`;
}
