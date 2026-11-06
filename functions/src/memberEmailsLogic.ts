// Decisión pura de functions/scripts/migrate-member-emails.mjs: el correo de cada socio sale del perfil que
// lista todo el vestuario (users/{uid}.email) a memberEmails/{uid} (solo lo leen el socio y los capitanes).
// Separada para probarla sin Firestore (src/lib/memberEmails.test.ts). Solo sintaxis borrable.

/** Qué hacer con un perfil: `copy` = el correo a escribir en memberEmails (null: nada), `strip` = quitar
 *  `email` del perfil. null = el perfil ya no tiene el campo: nada que hacer. */
export interface EmailMove {
  copy: string | null;
  strip: boolean;
}

/**
 * `user`: los datos de users/{uid}; `stored`: el `email` de memberEmails/{uid} si existe. El de memberEmails,
 * si ya hay uno, es el bueno (lo escribe la puerta con el token de Google de ahora): nunca se pisa.
 */
export function planEmailMove(user: Record<string, unknown>, stored: unknown): EmailMove | null {
  if (!("email" in user)) return null;
  const email = typeof user.email === "string" ? user.email.trim() : "";
  const has = typeof stored === "string" && stored.trim() !== "";
  return { copy: email && !has ? email : null, strip: true };
}
