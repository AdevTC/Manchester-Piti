import { z } from "zod";
import { reportDroppedDoc } from "./docTelemetry";

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

// ── Colección: seasons ───────────────────────────────────────────────────────

/**
 * Doc de la colección `seasons`. Solo `name` es obligatorio; `captainPlayerId`
 * es opcional (ausente en docs creados antes de la feature de capitán).
 */
export const seasonSchema = z.object({
  id: z.string(),
  name: z.string(),
  captainPlayerId: z.string().optional(),
});
export type SeasonDoc = z.infer<typeof seasonSchema>;

// ── Colección: matches ───────────────────────────────────────────────────────

/**
 * Doc crudo de la colección `matches` (los campos que lleguen de Firestore).
 * - `seasonId` es OPCIONAL: las queries "all" (useSeasonMatches) y la lista de
 *   Admin leen todos los partidos sin filtrar por temporada, y partidos legacy
 *   sin `seasonId` renderizaban antes — requerirlo los descartaría (regresión).
 * - `goalsFor`/`goalsAgainst` son opcionales (partido en curso) pero, si están
 *   presentes, deben ser enteros no negativos. Un valor negativo indica
 *   corrupción y el doc se descarta+loguea.
 * - `date` acepta las tres formas que emite Firestore (Timestamp, string, ms).
 * - `events` se modela como array OPCIONAL y NO-rechazante: el contenido pasa
 *   como `z.unknown()` (cada consumidor re-tipa sus eventos con su propia
 *   interfaz), pero `.catch(undefined)` garantiza que si `events` está presente
 *   sea un array; un valor corrupto no-array se normaliza a ausente en vez de
 *   pasar tal cual (lo que rompería los `events.forEach` downstream) y SIN
 *   descartar el doc. Todos los consumidores leen `match.events || []` /
 *   `?? []`, así que tolerar `undefined` es seguro. Endurecer aquí es seguro:
 *   ningún doc renderizable se descarta y se evita un crash por dato corrupto.
 *
 * Es un `z.looseObject`: deja pasar campos extra (competition, date en forma de
 * Timestamp) que el MatchDoc de Admin necesita. useSeasonMatches solo lee los
 * campos conocidos, así que el passthrough no le afecta.
 */
export const seasonMatchSchema = z.looseObject({
  id: z.string(),
  seasonId: z.string().optional(),
  rival: z.string().optional(),
  goalsFor: z.number().int().min(0).optional(),
  goalsAgainst: z.number().int().min(0).optional(),
  // null se normaliza a ausente en parseDocs, así que basta con .optional().
  date: firestoreDate.optional(),
  // Ver nota arriba: array-o-ausente, nunca descarta el doc (.catch).
  events: z.array(z.unknown()).optional().catch(undefined),
});
export type SeasonMatchDoc = z.infer<typeof seasonMatchSchema>;

// ── Colección: players ───────────────────────────────────────────────────────

/**
 * Doc crudo de la colección `players`. Un único schema permisivo sirve a DOS
 * consumidores (usePizarraPlayers y Admin) que leen la misma colección.
 *
 * Decisión sobre dualidad playerSchema/pizarraPlayerSchema:
 * Ambos leen la misma colección → se usa un único `playerSchema` que refleja la
 * unión de campos necesarios. Exportar `pizarraPlayerSchema` como alias del
 * mismo schema evita divergencia y hace el commit body más claro.
 *
 * `naturalPosition` es de tipo Zone (string literal union en runtime); se acepta
 * como `z.string()` para no acoplar el schema a la lista de zonas ni rechazar
 * valores futuros. El código downstream ya los trata como Zone via cast.
 *
 * `seasonDetails` se acepta como record<string, unknown> permisivo para no
 * rechazar docs cuyas sub-keys no nos importan validar aquí.
 *
 * `firstName`/`lastName`/`shirtName`/`number` son OPCIONALES: ambos consumidores
 * los leen defensivamente (`doc.data().firstName || ""`, `number || 0`,
 * `resolve()` con `|| 0`), el formulario de Admin no los marca todos como
 * obligatorios y hay docs sin alguno que renderizaban antes. Requerirlos sería
 * una regresión; los defaults `|| ""` / `|| 0` downstream siguen aplicando.
 */
export const playerSchema = z.object({
  id: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  shirtName: z.string().optional(),
  number: z.number().optional(),
  birthDate: z.string().optional(),
  seasons: z.array(z.string()).optional(),
  height: z.number().optional(),
  weight: z.number().optional(),
  active: z.boolean().optional(),
  naturalPosition: z.string().optional(),
  injured: z.boolean().optional(),
  seasonDetails: z.record(z.string(), z.unknown()).optional(),
});
export type PlayerDoc = z.infer<typeof playerSchema>;

/** Alias explícito para el consumidor de la pizarra (mismo schema). */
export const pizarraPlayerSchema = playerSchema;

// ── Colección: users ─────────────────────────────────────────────────────────

/**
 * Doc de la colección `users`. Nota: Firestore usa el uid del usuario como
 * document ID; `parseDocs` inyecta `{ id: d.id, ...data }` pero UserDoc usa
 * `uid` como campo. Por ello los call sites de Admin pasan `{ uid: d.id, ...data }`
 * manualmente (ver Admin.tsx) para que el campo quede como `uid`.
 *
 * `role` es `z.string()` permisivo (no el `roleSchema` enum) para no descartar
 * ninguna fila aunque el role tenga un valor inesperado.
 */
export const userDocSchema = z.object({
  uid: z.string(),
  nickname: z.string(),
  email: z.string(),
  role: z.string(),
});
export type UserDocParsed = z.infer<typeof userDocSchema>;

// ── Colección: lineups ───────────────────────────────────────────────────────

/**
 * Doc crudo de la colección `lineups` — schema permisivo.
 *
 * `seasonId` es el único campo requerido además de `id`; la query ya filtra por
 * él (where("seasonId","==",seasonId)), por lo que un doc sin seasonId es
 * inconsistente y se descarta. Todos los demás campos del tablero (formation,
 * slots, bench, roles…) son opcionales: `dataToLineupDoc` los tolera con
 * fallbacks y es la fuente de verdad para los defaults. Solo se descarta un doc
 * que no es un objeto utilizable (seasonId ausente o tipo incorrecto).
 *
 * z.looseObject() permite que el resto de campos del tablero pasen sin
 * enumerarlos todos (Zod v4: passthrough → looseObject).
 */
export const lineupSchema = z.looseObject({
  id: z.string(),
  seasonId: z.string(),
});
export type LineupRawDoc = z.infer<typeof lineupSchema>;

export const roleSchema = z.enum(["superadmin", "admin", "user"]);

/** Reutilizable en NicknameSetup (RHF). Normaliza igual que registerNickname. */
export const nicknameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "El nickname debe tener entre 3 y 15 caracteres.")
  .max(15, "El nickname debe tener entre 3 y 15 caracteres.")
  .regex(/^[a-z0-9_]+$/, "Solo letras, números y guiones bajos (_).");

/**
 * Normalización canónica del nickname (trim + lowercase), EXACTAMENTE igual que
 * `nicknameSchema` y `AuthContext.registerNickname`. Centralizarla evita que la
 * comprobación de disponibilidad inline y la consulta server-side diverjan en
 * la key/valor que comparan.
 */
export const normalizeNickname = (raw: string): string => raw.trim().toLowerCase();

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

/** Match create/edit form (Admin). Reuses matchResultSchema's shape. */
export const matchFormSchema = matchResultSchema.extend({
  seasonId: z.string().min(1, "Debes seleccionar una Temporada."),
  competition: z.string().min(1),
  date: z.string().min(1, "Escribe la fecha y hora del partido."),
  // Friendly required-message for the empty number inputs (RHF maps empty→undefined);
  // without this they'd surface Zod's raw "expected number, received undefined".
  goalsFor: z.number({ message: "Introduce los goles a favor." }).int().min(0, "No puede ser negativo."),
  goalsAgainst: z.number({ message: "Introduce los goles en contra." }).int().min(0, "No puede ser negativo."),
});
export type MatchFormValues = z.infer<typeof matchFormSchema>;

/** Player create/edit form (Admin) — scalar fields only. Per-season details and
 *  the dorsal-duplicate check stay imperative in onSubmit (data-dependent). */
export const playerFormSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es obligatorio."),
  lastName: z.string().trim().optional(),
  shirtName: z.string().trim().min(1, "El nombre en camiseta es obligatorio."),
  number: z.number({ message: "El dorsal es obligatorio." }).int("Dorsal inválido.").min(0, "No puede ser negativo."),
  birthDate: z.string().optional(),
  // Allow 0 (the old handler stored any parsed integer; only NaN→null). `.positive()`
  // would silently reject a 0 — e.g. when editing a doc that holds height/weight 0.
  height: z.number().int("Altura inválida.").min(0, "No puede ser negativa.").optional(),
  weight: z.number().int("Peso inválido.").min(0, "No puede ser negativo.").optional(),
});
export type PlayerFormValues = z.infer<typeof playerFormSchema>;

/** Season create/edit form (Admin). */
export const seasonFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre de la temporada es obligatorio."),
});
export type SeasonFormValues = z.infer<typeof seasonFormSchema>;

/**
 * Valida `data` y, si falla, loguea y devuelve `fallback` (no rompe la UI).
 * Úsalo en el borde de lecturas Firestore en vez de `as`.
 */
export function safeParseDoc<T>(schema: z.ZodType<T>, data: unknown, fallback: T, ctx: string): T {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  // Single doc: no id in the signature, so report with "-" as the placeholder id.
  reportDroppedDoc(ctx, "-", r.error.issues);
  return fallback;
}

/** Firestore guarda `null` para campos borrados; nuestros consumidores los
 *  tratan como ausentes (`|| ""`, `|| 0`, `?? undefined`). z.optional() acepta
 *  `undefined` pero NO `null`, así que un campo a null descartaría el doc entero.
 *  Normalizamos null → ausente antes de validar. */
export function dropNullFields(data: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) if (v !== null) out[k] = v;
  return out;
}

/**
 * Valida una colección Firestore: descarta (y loguea) los docs inválidos en
 * vez de romper. Úsalo en el borde de cada onSnapshot para sustituir los
 * casts `as X[]`.
 */
export function parseDocs<T>(
  schema: z.ZodType<T>,
  docs: { id: string; data: () => unknown }[],
  ctx: string,
): T[] {
  const out: T[] = [];
  for (const d of docs) {
    const r = schema.safeParse({ id: d.id, ...dropNullFields(d.data() as object) });
    if (r.success) out.push(r.data);
    else reportDroppedDoc(ctx, d.id, r.error.issues);
  }
  return out;
}
