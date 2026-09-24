import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { z } from "zod";

initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 5 });
export const db = getFirestore();
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
export async function member(req: CallableRequest) {
  const uid = googleUser(req);
  const access = await db.doc(`teamMembers/${uid}`).get();
  if (
    !access.exists ||
    !access.get("expiresAt") ||
    access.get("expiresAt").toMillis() <= Date.now()
  )
    throw new HttpsError(
      "permission-denied",
      "Introduce la clave del vestuario.",
    );
  return uid;
}
export async function admin(req: CallableRequest) {
  const uid = await member(req);
  const profile = await db.doc(`users/${uid}`).get();
  if (!["admin", "superadmin"].includes(profile.get("role")))
    throw new HttpsError(
      "permission-denied",
      "Solo los administradores pueden publicar.",
    );
  return uid;
}
/** How a member is shown to the rest of the team: nickname first, linked player when approved. */
export async function identity(req: CallableRequest, uid: string) {
  const profile = await db.doc(`users/${uid}`).get();
  return {
    name:
      (profile.get("nickname") as string | undefined) ||
      (req.auth?.token.name as string | undefined) ||
      "Miembro",
    playerId: (profile.get("playerId") as string | undefined) ?? null,
  };
}
