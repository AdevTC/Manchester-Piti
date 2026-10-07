// The vestuario door on the client: which screen a visitor sees (from their account, membership,
// request and the invitation in the link), the invitation code in the URL, and the shirts they can
// pick in «¿Quién eres?». Pure; the screens live in pages/acceso.
import { suggestFicha } from "./vestuario";
import type { DoorRequest } from "../context/TeamContext";
import type { InviteInfo } from "./clubApi";

export type DoorStep = "puerta" | "invitacion" | "invitacion-caducada" | "quien-eres" | "pendiente" | "rechazada" | "dentro";
export interface DoorInput {
  signedIn: boolean;
  member: boolean;
  hasProfile: boolean;
  request: DoorRequest | null;
  /** The invitation in the link, once looked up (null: no link; undefined: still loading). */
  invite: InviteInfo | null | undefined;
  /** The visitor chose to answer «¿Quién eres?» (from the door or after a rejection). */
  choosing: boolean;
}
export function doorStep(d: DoorInput): DoorStep {
  if (d.member && d.hasProfile) return "dentro";
  if (d.member) return "quien-eres"; // inside, but the profile was never made (old key flow)
  if (d.invite && d.invite.state !== "valid") return d.signedIn && d.choosing ? "quien-eres" : "invitacion-caducada";
  if (d.invite && d.invite.state === "valid") return d.signedIn ? "quien-eres" : "invitacion";
  if (!d.signedIn) return "puerta";
  if (d.request?.status === "pending" && !d.choosing) return "pendiente";
  if ((d.request?.status === "rejected" || d.request?.status === "removed") && !d.choosing) return "rechazada";
  return "quien-eres";
}

/** `/invitacion/ABCDE23456` or `?invitacion=…` → the code (upper-cased), else null. */
export function inviteCodeFrom(pathname: string, search: string) {
  const fromPath = pathname.match(/^\/invitacion\/([A-Za-z2-9]{10})\/?$/)?.[1];
  const fromQuery = new URLSearchParams(search).get("invitacion") ?? undefined;
  const code = (fromPath ?? fromQuery ?? "").toUpperCase();
  return /^[A-Z2-9]{10}$/.test(code) ? code : null;
}
export const inviteUrl = (origin: string, code: string) => `${origin}/invitacion/${code}`;

export interface Shirt {
  id: string;
  name: string;
  num: string;
  position?: string;
  taken: boolean;
}
/** The season's shirts for «¿Quién eres?»: free ones first by dorsal, and a guess from the Google name. */
export function shirtsToPick(players: { id: string; name: string; num: string; position?: string; first?: string; last?: string }[], linked: Set<string>, googleName: string) {
  const shirts: Shirt[] = players
    .map((p) => ({ id: p.id, name: p.name, num: p.num, position: p.position, taken: linked.has(p.id) }))
    .sort((a, b) => Number(a.taken) - Number(b.taken) || Number(a.num || 999) - Number(b.num || 999) || a.name.localeCompare(b.name, "es"));
  const free = players.filter((p) => !linked.has(p.id)).map((p) => ({ id: p.id, names: [p.name, p.first ?? "", [p.first, p.last].filter(Boolean).join(" ")] }));
  const guess = googleName ? (suggestFicha(googleName.split(/\s+/)[0] ?? googleName, free) ?? suggestFicha(googleName, free)) : null;
  return { shirts, suggestion: guess ? shirts.find((s) => s.id === guess.id) ?? null : null };
}
