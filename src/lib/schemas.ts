import { z } from "zod";

/**
 * Firestore Timestamp-ish (tiene toMillis) o Date o número epoch.
 *
 * Zod v4 no permite z.function() como valor de propiedad anidado dentro de
 * z.object() (requiere input/output explícitos), y .passthrough() está
 * deprecado a favor de z.looseObject(). Usamos z.custom() para las variantes
 * de Timestamp ya que solo necesitamos aceptarlas, no validar su forma interna.
 */
const firestoreDate = z.union([
  z.date(),
  z.number(),
  z.custom<{ toMillis: () => number }>((val) =>
    typeof val === "object" && val !== null && "toMillis" in val && typeof (val as Record<string, unknown>).toMillis === "function"
  ),
  z.custom<{ seconds: number }>((val) =>
    typeof val === "object" && val !== null && "seconds" in val && typeof (val as Record<string, unknown>).seconds === "number"
  ),
]);

export const roleSchema = z.enum(["superadmin", "admin", "user"]);

/** Reutilizable en NicknameSetup (RHF). Normaliza igual que registerNickname. */
export const nicknameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "El nickname debe tener entre 3 y 15 caracteres.")
  .max(15, "El nickname debe tener entre 3 y 15 caracteres.")
  .regex(/^[a-z0-9_]+$/, "Solo letras, números y guiones bajos (_).");

export const userProfileSchema = z.object({
  email: z.string(),
  nickname: z.string(),
  role: roleSchema,
  createdAt: firestoreDate.optional(),
});
export type UserProfileParsed = z.infer<typeof userProfileSchema>;

/** Forma de un resultado de partido editado en Admin. */
export const matchResultSchema = z.object({
  rival: z.string().trim().min(1, "El rival es obligatorio."),
  goalsFor: z.number().int().min(0, "No puede ser negativo."),
  goalsAgainst: z.number().int().min(0, "No puede ser negativo."),
  seasonId: z.string().min(1),
});
export type MatchResult = z.infer<typeof matchResultSchema>;

/**
 * Valida `data` y, si falla, loguea y devuelve `fallback` (no rompe la UI).
 * Úsalo en el borde de lecturas Firestore en vez de `as`.
 */
export function safeParseDoc<T>(schema: z.ZodType<T>, data: unknown, fallback: T, ctx: string): T {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  console.error(`[schema] documento inválido en ${ctx}:`, r.error.issues);
  return fallback;
}
