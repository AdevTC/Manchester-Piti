import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { defineString } from "firebase-functions/params";
import { z } from "zod";

initializeApp();
// Next to the Firestore database (nam5 multi-region, served from us-central1): every
// server read stays in the region instead of crossing the Atlantic.
export const REGION = "us-central1";
setGlobalOptions({ region: REGION, maxInstances: 5 });
export const db = getFirestore();
export const siteUrl = defineString("PUBLIC_SITE_URL", {
  default: "https://futbolmanagement-dc6cb.web.app",
});
export const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success)
    throw new HttpsError(
      "invalid-argument",
      r.error.issues.map((i) => i.message).join(" "),
    );
  return r.data;
}
export function googleUser(req: CallableRequest) {
  if (!req.auth)
    throw new HttpsError("unauthenticated", "Inicia sesión con Google.");
  if (req.auth.token.firebase?.sign_in_provider !== "google.com")
    throw new HttpsError("permission-denied", "Usa tu cuenta de Google.");
  return req.auth.uid;
}
function checkAccess(access: FirebaseFirestore.DocumentSnapshot) {
  if (
    !access.exists ||
    !access.get("expiresAt") ||
    access.get("expiresAt").toMillis() <= Date.now()
  )
    throw new HttpsError(
      "permission-denied",
      "Introduce la clave del vestuario.",
    );
}
export async function member(req: CallableRequest) {
  const uid = googleUser(req);
  checkAccess(await db.doc(`teamMembers/${uid}`).get());
  return uid;
}
/** How a member is shown to the rest of the team: nickname first, linked player when approved. */
function identityOf(req: CallableRequest, profile: FirebaseFirestore.DocumentSnapshot) {
  return {
    name:
      (profile.get("nickname") as string | undefined) ||
      (req.auth?.token.name as string | undefined) ||
      "Miembro",
    playerId: (profile.get("playerId") as string | undefined) ?? null,
  };
}
/** Access check and profile in one round trip (both reads at once). */
export async function memberAs(req: CallableRequest) {
  const uid = googleUser(req);
  const [access, profile] = await Promise.all([
    db.doc(`teamMembers/${uid}`).get(),
    db.doc(`users/${uid}`).get(),
  ]);
  checkAccess(access);
  const isAdmin = ["admin", "superadmin"].includes(profile.get("role"));
  return { uid, profile, isAdmin, who: identityOf(req, profile) };
}
export async function admin(req: CallableRequest) {
  const { uid, isAdmin } = await memberAs(req);
  if (!isAdmin)
    throw new HttpsError(
      "permission-denied",
      "Solo los administradores pueden publicar.",
    );
  return uid;
}
