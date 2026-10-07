// Pure rules of the vestuario door (no shared key): invitation codes, their validity, the nickname a
// new member gets from their ficha or name, and what a request may carry. Firestore lives in door.ts.

/** Membership lasts until an admin removes it: stored as a far expiry so the rules stay unchanged. */
export const FOREVER_MS = Date.UTC(2200, 0, 1);
export const INVITE_DAYS = { min: 1, max: 30, default: 7 } as const;

/** Readable code: no 0/O, 1/I/L. 10 chars of 31 symbols ≈ 49 bits. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
// Web Crypto (Node 20+ and browsers), so the client tests can import this file too.
export function newInviteCode(bytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const raw = bytes(10);
  return Array.from(raw, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
export const inviteCodePattern = /^[A-Z2-9]{10}$/;

export interface InviteLike {
  expiresAt: number;
  maxUses: number; // 0 = unlimited
  uses: number;
  revoked?: boolean;
}
export type InviteState = "valid" | "expired" | "used" | "revoked" | "missing";
export function inviteState(invite: InviteLike | undefined, now: number): InviteState {
  if (!invite) return "missing";
  if (invite.revoked) return "revoked";
  if (invite.expiresAt <= now) return "expired";
  if (invite.maxUses > 0 && invite.uses >= invite.maxUses) return "used";
  return "valid";
}
export const INVITE_PROBLEM: Record<Exclude<InviteState, "valid">, string> = {
  missing: "Esta invitación no existe. Revisa el enlace o pide acceso.",
  revoked: "El capitán ha anulado esta invitación. Pide acceso o una nueva.",
  expired: "Esta invitación ha caducado. Pide acceso o una nueva.",
  used: "Esta invitación ya se ha usado. Pide acceso o una nueva.",
};

/** Base nickname (3–15 chars, a–z 0–9 _) from a shirt name, a typed name or the Google name/email. */
export function nicknameBase(...sources: (string | undefined | null)[]) {
  for (const s of sources) {
    const slug = (s ?? "")
      .split("@")[0]
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 15)
      .replace(/_+$/, "");
    if (slug.length >= 3) return slug;
    if (slug.length > 0) return (slug + "_piti").slice(0, 15);
  }
  return "jugador";
}
/** Candidates in order: base, base2, base3… always within 15 chars. */
export function nicknameCandidates(base: string, n = 20) {
  return Array.from({ length: n }, (_, i) => (i === 0 ? base : base.slice(0, 15 - String(i + 1).length) + (i + 1)));
}

/** A display name typed by someone who isn't in the squad. */
export const cleanName = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 40);
