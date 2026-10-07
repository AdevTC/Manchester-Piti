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
  /** Archived: kept in Firestore, hidden everywhere except Admin. */
  archived: z.boolean().optional(),
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
  photoUrl: z.string().optional(),
  bio: z.string().optional(),
  quote: z.string().optional(),
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

// ── Pizarra: dibujos, jugadas y reacciones ───────────────────────────────────

/**
 * Límites de los campos nuevos del tablero. Las reglas de Firestore solo pueden
 * comprobar el tamaño de las listas (dibujos ≤ 60, jugadas ≤ 12); el resto se
 * valida aquí, al leer (un elemento inválido se descarta, no el tablero entero).
 */
export const PIZARRA_LIMITS = {
  strokes: 60,
  strokePoints: 64,
  strokeText: 40,
  plays: 12,
  playName: 40,
  framesMin: 2,
  framesMax: 8,
  /** Jugadores nuestros por paso (el siete). */
  framePlayers: 7,
  rivals: 7,
  arrows: 10,
  frameTitle: 40,
  frameNote: 140,
  id: 40,
} as const;

/** Punto del campo en % (x 0→100 izquierda→derecha, y 0 = portería rival → 100 = la nuestra). */
const pitchCoord = z.number().min(0).max(100);
export const boardPointSchema = z.object({ x: pitchCoord, y: pitchCoord });
export type BoardPoint = z.infer<typeof boardPointSchema>;
const itemId = z.string().min(1).max(PIZARRA_LIMITS.id);

export const STROKE_KINDS = ["carrera", "pase", "conduccion", "zona", "lapiz", "texto"] as const;
export const STROKE_COLORS = ["sky", "gold", "white"] as const;
/**
 * Trazo de la pizarra (telestrator). `texto` es un único punto con su texto;
 * el resto, un camino de 2 o más puntos (flechas: inicio, medio, fin; zona:
 * dos esquinas opuestas; lápiz: el trazo simplificado).
 */
export const strokeSchema = z
  .object({
    id: itemId,
    kind: z.enum(STROKE_KINDS),
    color: z.enum(STROKE_COLORS),
    points: z.array(boardPointSchema).min(1).max(PIZARRA_LIMITS.strokePoints),
    text: z.string().trim().min(1).max(PIZARRA_LIMITS.strokeText).optional(),
  })
  .refine((s) => (s.kind === "texto" ? s.text !== undefined && s.points.length === 1 : s.points.length >= 2), {
    message: "Un texto lleva un punto y su texto; el resto de trazos, dos puntos o más.",
  });
export type Stroke = z.infer<typeof strokeSchema>;
export type StrokeKind = Stroke["kind"];
export type StrokeColor = Stroke["color"];

export const ARROW_KINDS = ["pase", "carrera", "conduccion"] as const;
export const playArrowSchema = z.object({ from: boardPointSchema, to: boardPointSchema, kind: z.enum(ARROW_KINDS) });
export type PlayArrow = z.infer<typeof playArrowSchema>;

export const playRivalSchema = z.object({ id: itemId, x: pitchCoord, y: pitchCoord });
export type PlayRival = z.infer<typeof playRivalSchema>;

/** Un paso de una jugada: dónde está cada uno de los nuestros (por id), el balón, los rivales y las flechas. */
export const playFrameSchema = z
  .object({
    players: z.record(itemId, boardPointSchema),
    ball: boardPointSchema,
    rivals: z.array(playRivalSchema).max(PIZARRA_LIMITS.rivals),
    arrows: z.array(playArrowSchema).max(PIZARRA_LIMITS.arrows),
    title: z.string().trim().max(PIZARRA_LIMITS.frameTitle).optional(),
    note: z.string().trim().max(PIZARRA_LIMITS.frameNote).optional(),
  })
  .refine((f) => Object.keys(f.players).length <= PIZARRA_LIMITS.framePlayers, { message: "Como mucho siete jugadores por paso." })
  .refine((f) => new Set(f.rivals.map((r) => r.id)).size === f.rivals.length, { message: "Rivales repetidos en un paso." });
export type PlayFrame = z.infer<typeof playFrameSchema>;

export const PLAY_KINDS = ["propia", "corner", "falta", "banda", "salida"] as const;
export const playSchema = z.object({
  id: itemId,
  name: z.string().trim().min(1).max(PIZARRA_LIMITS.playName),
  kind: z.enum(PLAY_KINDS),
  frames: z.array(playFrameSchema).min(PIZARRA_LIMITS.framesMin).max(PIZARRA_LIMITS.framesMax),
});
export type Play = z.infer<typeof playSchema>;
export type PlayKind = Play["kind"];

/** `lineups/{id}/reactions/{uid}`: lo que opina cada miembro del siete oficial. */
export const REACTION_VALUES = ["ok", "dudas"] as const;
export const reactionSchema = z.object({
  id: z.string(),
  value: z.enum(REACTION_VALUES),
  at: firestoreDate.optional(),
});
export type ReactionDoc = z.infer<typeof reactionSchema>;
export type ReactionValue = ReactionDoc["value"];

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
  /** Player file linked to this account once an admin approves the claim. */
  playerId: z.string().optional(),
  /** Name to show for members who aren't in the squad (chosen at the door). */
  displayName: z.string().optional(),
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
