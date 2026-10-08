// Fichas' domain logic, pure (tested in fichasLogic.test.ts): «hace 2 h» / «ayer, 21:40» / «28 oct» in club
// time, how a member came into the vestuario («entró con la invitación de erik9», «llamó a la puerta y le
// abrió adrian_tc»), and who resolved a claim.

const TZ = "Europe/Madrid";
const dayKey = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
const hm = (ms: number) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
const dm = (ms: number) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("es-ES", { timeZone: TZ, day: "numeric", month: "short" }).formatToParts(ms).map((x) => [x.type, x.value]));
  return `${p.day} ${String(p.month).replace(".", "")}`;
};

/** When something happened, the way the captains say it (Madrid time): «ahora mismo», «hace 5 min»,
 *  «hace 2 h» (today), «ayer, 21:40», «28 oct». */
export function relativeWhen(ms: number, now: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "hace tiempo";
  const diff = Math.max(0, now - ms);
  if (diff < 60_000) return "ahora mismo";
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  if (dayKey(ms) === dayKey(now)) return `hace ${Math.floor(diff / 3_600_000)} h`;
  if (dayKey(ms) === dayKey(now - 86_400_000)) return `ayer, ${hm(ms)}`;
  return dm(ms);
}

export interface MemberVia {
  /** "invite", "request", "returning"; older members came with the shared key (none / "clave"). */
  via: string;
  /** Who let them in (uid): the inviter or the captain who opened the door. */
  by: string;
}
/** How a member came into the vestuario, for the ficha row. */
export function viaText(member: MemberVia | undefined, nickOf: (uid: string) => string): string {
  if (!member) return "sin pase del vestuario";
  const who = member.by ? nickOf(member.by) : "";
  switch (member.via) {
    case "invite":
      return who ? `entró con la invitación de ${who}` : "entró con una invitación";
    case "request":
      return who ? `llamó a la puerta y le abrió ${who}` : "llamó a la puerta";
    case "returning":
      return "volvió al vestuario";
    default:
      return "entró con la clave del vestuario";
  }
}
/** «aprobada por erik9» / «rechazada por adrian_tc» / «se aprobó sola (es administrador)». */
export function resolvedText(approved: boolean, uid: string, by: string, nickOf: (uid: string) => string): string {
  if (approved && by && by === uid) return "se aprobó sola (es administrador)";
  const who = by ? nickOf(by) : "";
  return `${approved ? "aprobada" : "rechazada"}${who ? ` por ${who}` : ""}`;
}
/** «@nuevo.socio», or the e-mail when there is no nickname. */
export const handle = (c: { nickname?: string; email?: string }) => (c.nickname ? `@${c.nickname}` : c.email || "Socio");
