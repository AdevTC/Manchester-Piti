// PLANTILLA · Socios y Capitanes, the pure part (tested through Socios.test.tsx and Capitanes.test.tsx): who is the
// capitán general (by role, and by the founder's e-mail, like AuthContext), the role words, the ?ver= sections, the
// shirt of a ficha for this season, the board's consequences and messages for «Quitar el acceso» and the brazalete
// (M-13, M-40), the invitations' lines and who still holds a ficha after leaving (B-CLUB-02/03).
import { madridDay } from "../../../../lib/derived/madrid";
import { plural } from "../../../../lib/derived/words";
import type { PlayerDoc } from "../../../../lib/schemas";
import type { InviteRow, PersonRow } from "../../../vestuario/live";
import { holdsAfterLeaving } from "../../club/plantillaBoard";
import { nameIn, numberIn } from "../../club/plantillaLogic";
import type { AdminData } from "../../data/useAdminData";

/** The founder's account: AuthContext promotes it and updateUserRole refuses to touch it. */
export const SUPERADMIN_EMAIL = "adriantomascv@gmail.com";

export type Role = "superadmin" | "admin" | "user";
export const roleOf = (p: Pick<PersonRow, "role" | "email">): Role => (p.role === "superadmin" || p.email === SUPERADMIN_EMAIL ? "superadmin" : p.role === "admin" ? "admin" : "user");
export const ROLE_WORD: Record<Role, string> = { superadmin: "Capitán general", admin: "Capitán", user: "Socio" };
export const RANK: Record<Role, number> = { superadmin: 0, admin: 1, user: 2 };
/** M-40: who looks is the capitán general (his role, or the founder's e-mail before the role reached him). */
export const isGeneral = (profile: { role?: string; email?: string } | null | undefined) => !!profile && (profile.role === "superadmin" || profile.email === SUPERADMIN_EMAIL);
/** «@kevin11», or the e-mail when there is no nickname. */
export const handleOf = (p: Pick<PersonRow, "nickname" | "email">) => (p.nickname ? `@${p.nickname}` : p.email || "Socio");
/** The initial on the round badge. */
export const initialOf = (p: Pick<PersonRow, "nickname" | "displayName" | "email">) => (p.displayName || p.nickname || p.email || "?").trim().charAt(0).toLocaleUpperCase("es") || "?";

/** The sections of Socios (on the phone the ?ver= chips pick one; on the desktop all of them are there). */
export type SociosVer = "puerta" | "fichas" | "dentro" | "invitaciones";
/** ?ver= → the section («llaman», the router's word for the door, and anything unknown: the door). */
export const sociosVer = (v: unknown): SociosVer => (v === "fichas" || v === "dentro" || v === "invitaciones" ? v : "puerta");
export const SOCIOS_TABS: readonly { key: SociosVer; t: string; to: string }[] = [
  { key: "puerta", t: "La puerta", to: "/admin/plantilla/socios" },
  { key: "fichas", t: "Fichas", to: "/admin/plantilla/socios?ver=fichas" },
  { key: "dentro", t: "Dentro", to: "/admin/plantilla/socios?ver=dentro" },
  { key: "invitaciones", t: "Invitaciones", to: "/admin/plantilla/socios?ver=invitaciones" },
];

/** A ficha's shirt for the sala's season: its name and dorsal («KEVIN», «11»). */
export interface ShirtOf {
  id: string;
  name: string;
  num: string;
}
export const shirtLabel = (s: ShirtOf) => (s.num ? `${s.name} · ${s.num}` : s.name);
export const shirtOption = (s: ShirtOf) => (s.num ? `${s.num} · ${s.name}` : s.name);
/** The shirt of any ficha (the season's squad first, then any ficha, the archived ones too). */
export function shirtLookup(data: Pick<AdminData, "roster" | "players" | "archivedPlayers" | "season">): (id: string | null | undefined) => ShirtOf | null {
  const sid = data.season?.id;
  const byRoster = new Map(data.roster.map((r) => [r.id, { id: r.id, name: r.name, num: r.number != null ? String(r.number) : "" }]));
  const docs = new Map<string, PlayerDoc>([...data.archivedPlayers, ...data.players].map((p) => [p.id, p]));
  return (id) => {
    if (!id) return null;
    const r = byRoster.get(id);
    if (r) return r;
    const p = docs.get(id);
    if (!p) return null;
    const n = numberIn(p, sid);
    return { id, name: nameIn(p, sid), num: n != null ? String(n) : "" };
  };
}
/** A shirt in a given season (the field captain's select and his line). */
export function shirtIn(p: PlayerDoc, seasonId: string): ShirtOf {
  const n = numberIn(p, seasonId);
  return { id: p.id, name: nameIn(p, seasonId), num: n != null ? String(n) : "" };
}

/** «Quitar el acceso»: the three things that happen (the board's q1 · q2 · q3, with the server of r12). */
export function quitConsequences(shirt: ShirtOf | null, captain: boolean): [string, string, string] {
  return [
    "Deja de entrar al vestuario y a la sala en cuanto se guarde.",
    shirt ? `Su ficha (${shirt.name}) queda libre: otro socio puede pedirla.` : "No tenía ficha: nada que liberar.",
    captain ? "Pierde también el brazalete: si vuelve a llamar, entra como socio." : "Si vuelve a llamar a la puerta, entra como socio.",
  ];
}
/** «@kevin11 ya no entra · KEVIN queda libre · sin brazalete». */
export const quitMessage = (who: string, shirt: ShirtOf | null, captain: boolean) => `${who} ya no entra${shirt ? ` · ${shirt.name} queda libre` : ""}${captain ? " · sin brazalete" : ""}`;

/** The brazalete's confirm: what changes when it is given or taken off (M-40: only the general takes another's). */
export function armConsequences(give: boolean, mine: boolean): string[] {
  if (give) return ["Podrá publicar actas y convocar", "Podrá aprobar cuentas, abrir la puerta y cambiar el contenido", "Se lo puede quitar el capitán general, o él mismo"];
  return [...(mine ? ["Eres tú: dejarás de ver la sala en cuanto se guarde"] : []), "Deja de ver la sala de control", "Sigue siendo socio: su carta y su voto no cambian"];
}

/** A removed member who still holds his ficha: an old removal without a seal, or one who left on his own. */
export const stillHolds = (p: PersonRow) => p.removed && !!p.playerId && holdsAfterLeaving(p);

/** The line of someone without access («Le quitó el acceso erik9 hace 2 h · sin brazalete», «Se fue por su cuenta»…). */
export function removedLine(p: PersonRow, nickOf: (uid: string) => string, when: string, now?: { had: string; wasCap: boolean; by: string }): string {
  if (now) return `Le quitó el acceso ${now.by} ${when}${now.had ? ` · ${now.had} quedó libre` : ""}${now.wasCap ? " · perdió el brazalete" : " · sin brazalete"}`;
  const by = p.removedBy;
  if (by && by === p.uid) return `Se fue por su cuenta ${when}`;
  if (by) return `Le quitó el acceso ${nickOf(by)} ${when} · sin brazalete`;
  return `Sin acceso · ${when}`;
}

/** The invitation's days to choose from (the server takes 1–30). */
export const INVITE_DAYS = [1, 3, 7, 14, 30] as const;
/** An invitation that no longer opens: revoked, used up, or past its date. */
export const inviteDead = (v: Pick<InviteRow, "revoked" | "maxUses" | "uses" | "expiresAt">, now: number) => v.revoked || v.expiresAt < now || (v.maxUses > 0 && v.uses >= v.maxUses);
/** «1 uso · sin usar · Caduca el 9 nov · la creó adrian_tc» / «Ilimitada · 3 usos · Revocada». */
export function inviteLine(v: Pick<InviteRow, "revoked" | "maxUses" | "uses" | "expiresAt" | "byName">, now: number): string {
  const uses = v.maxUses ? (v.uses ? "Usada" : "1 uso · sin usar") : `Ilimitada · ${plural(v.uses, "uso", "usos")}`;
  const when = v.revoked ? "Revocada" : v.expiresAt < now ? `Caducada el ${madridDay(v.expiresAt)}` : `Caduca el ${madridDay(v.expiresAt)}${v.byName ? ` · la creó ${v.byName}` : ""}`;
  return `${uses} · ${when}`;
}
