import { z } from "zod";
import { reportDroppedDoc } from "./docTelemetry";
import { SYSTEM_IDS } from "./formations";
import { POS_CODES } from "./positions";
import { GUEST_ID_RE, GUEST_NAME_MAX, MAX_GUESTS } from "./derived/guests";
import { MESA_NAME_MAX } from "../../functions/src/mesaLogic";
import { parseKickoffWeather } from "../../functions/src/weatherLogic";
import { parseStoredNotas } from "../../functions/src/rating/frozen";
import { storedVideoMarks } from "../../functions/src/matchExtrasLogic";
import { SOCIAL_NETS } from "./clubContentDefaults";

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
 * - `seasonId` es OPCIONAL: la suscripción compartida a `matches` y la lista de
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
 * Timestamp) que el MatchDoc de Admin necesita. Los demás consumidores solo leen
 * los campos conocidos, así que el passthrough no les afecta.
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
  // Invitados en el acta (derived/guests): 0–4 named guests; a malformed list is dropped, never the match.
  guests: z
    .array(z.object({ id: z.string().regex(GUEST_ID_RE), name: z.string().min(1).max(GUEST_NAME_MAX) }))
    .max(MAX_GUESTS)
    .optional()
    .catch(undefined),
  // Who keeps la mesa (backend-written, public name): malformed → absent, never the match.
  mesa: z
    .object({ name: z.string().trim().min(1).max(MESA_NAME_MAX), since: z.number().refine(Number.isFinite) })
    .optional()
    .catch(undefined),
  // Aplazado: the admin's reason (≤ 140) and the new date (a Timestamp in Firestore → ms here; absent = por decidir).
  postponedReason: z.string().max(140).optional().catch(undefined),
  postponedTo: firestoreDate
    .transform((v) => dateMs(v))
    .pipe(z.number().refine(Number.isFinite))
    .optional()
    .catch(undefined),
  // The weather at kick-off of a played match (backend stamp): malformed → absent.
  weatherAtKickoff: z
    .unknown()
    .transform((v) => parseKickoffWeather(v) ?? undefined)
    .optional()
    .catch(undefined),
  // The notas frozen with the acta (backend stamp, rating/frozen): malformed → absent, rated again on the web.
  notas: z
    .unknown()
    .transform((v) => parseStoredNotas(v) ?? undefined)
    .optional()
    .catch(undefined),
  // r12 (backend stamps; malformed → absent, never the match): the first publication, the MVP moved by hand,
  // the video marks of each goal.
  actaPublishedAt: z.number().refine(Number.isFinite).optional().catch(undefined),
  mvpManual: z
    .object({ action: z.enum(["close", "reopen"]), by: z.string(), at: z.number() })
    .optional()
    .catch(undefined),
  videoMarks: z
    .unknown()
    .transform((v) => storedVideoMarks(v))
    .optional()
    .catch(undefined),
});
/** A firestoreDate value in ms (NaN when it isn't one). */
function dateMs(v: unknown): number {
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  const t = v as { toMillis?: () => number; seconds?: number };
  if (typeof t?.toMillis === "function") return t.toMillis();
  return typeof t?.seconds === "number" ? t.seconds * 1000 : NaN;
}
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
 * `naturalPosition` es texto libre heredado (códigos o palabras); la fuente de verdad es
 * `positions` y se lee siempre con `resolvePositions`.
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
/** Topes de la sanción a mano (los mismos que firestore.rules). */
export const SANCTION_LIMITS = { games: 10, reason: 80, matchId: 128 } as const;
/**
 * `players/{id}.sanction` (Admin → Plantilla → Estado «Sancionado»). Permisivo: lo que sobra se recorta
 * (partidos a 1–10, motivo a 80) y un campo opcional inválido (o null) se queda en ausente; solo sin
 * `games` / `from` numéricos la sanción entera se ignora — nunca el jugador (`.catch` en playerSchema).
 */
export const sanctionSchema = z.object({
  games: z
    .number()
    .refine(Number.isFinite)
    .transform((v) => Math.min(SANCTION_LIMITS.games, Math.max(1, Math.round(v)))),
  from: z.number().refine(Number.isFinite),
  untilMatchId: z.string().min(1).max(SANCTION_LIMITS.matchId).optional().catch(undefined),
  reason: z
    .string()
    .transform((v) => v.trim().slice(0, SANCTION_LIMITS.reason))
    .optional()
    .catch(undefined),
  by: z.string().optional().catch(undefined),
});
export type SanctionDoc = z.infer<typeof sanctionSchema>;

/** `players/{id}.positions` / `.positionsProposal`: permisivos (códigos raros se limpian al leer con
 *  `resolvePositions`; un valor que no es un mapa se queda en ausente — nunca tira el jugador). */
const positionSetSchema = z.object({
  main: z.string().nullable().catch(null),
  also: z.array(z.string()).catch([]),
});
const positionsReviewSchema = z.object({
  status: z.enum(["aprobada", "ajustada", "rechazada"]),
  at: z.unknown(),
  by: z.string().optional().catch(undefined),
});

export const playerSchema = z.object({
  id: z.string(),
  /** Retained by the private admin mapper; public mapPlayer excludes archived records. */
  archived: z.boolean().optional().catch(undefined),
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
  positions: positionSetSchema.optional().catch(undefined),
  positionsProposal: positionSetSchema.extend({ at: z.unknown() }).nullable().optional().catch(undefined),
  positionsReview: positionsReviewSchema.nullable().optional().catch(undefined),
  injured: z.boolean().optional(),
  // Sanción a mano y «Levantar la sanción» (ms): opcionales y permisivos (un valor roto no tira el doc).
  sanction: sanctionSchema.optional().catch(undefined),
  sanctionClearedAt: z.number().refine(Number.isFinite).optional().catch(undefined),
  photoUrl: z.string().optional(),
  bio: z.string().optional(),
  quote: z.string().optional(),
  seasonDetails: z.record(z.string(), z.unknown()).optional(),
});
export type PlayerDoc = z.infer<typeof playerSchema>;

/** Alias explícito para el consumidor de la pizarra (mismo schema). */
export const pizarraPlayerSchema = playerSchema;

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

/**
 * Campos del tablero, validados uno a uno al leer (`dataToLineupDoc`): un campo
 * inválido se repara a un valor seguro (y se avisa por telemetría) en vez de
 * descartar el tablero o romper la pizarra. Los mismos topes que firestore.rules.
 */
export const LINEUP_LIMITS = {
  slots: 7,
  name: 60,
  nickname: 40,
  id: 128,
  position: 8,
  tactic: 40,
  playerPositions: 60,
} as const;
export const LINEUP_FORMATIONS = SYSTEM_IDS;
export const LINEUP_ZONES = ["POR", "DEF", "MED", "DEL"] as const;
const lineupRef = z.string().min(1).max(LINEUP_LIMITS.id);
/** Coordenada del campo en %: un número fuera de 0–100 se lleva al borde. */
const lineupPct = z.number().refine(Number.isFinite).transform((v) => Math.min(100, Math.max(0, v)));
export const lineupSlotSchema = z.object({
  slotId: z.string().min(1).max(40),
  playerId: lineupRef.nullable(),
  position: z.string().max(LINEUP_LIMITS.position),
  zone: z.enum(LINEUP_ZONES),
  x: lineupPct,
  y: lineupPct,
});
export const lineupSlotsSchema = z.array(lineupSlotSchema).length(LINEUP_LIMITS.slots);
export const lineupRolesSchema = z.object({
  captainId: lineupRef.optional(),
  viceId: lineupRef.optional(),
  penaltiesId: lineupRef.optional(),
  freekicksId: lineupRef.optional(),
  cornersId: lineupRef.optional(),
});
export const lineupTacticsSchema = z.record(z.string().max(LINEUP_LIMITS.tactic), z.string().max(LINEUP_LIMITS.tactic));
/** What a «Jugar de» may hold: a position code (MCD…) or, as saved before them, a line (POR is both). */
export const LINEUP_PLAYS_AS = [...POS_CODES, "DEF", "MED", "DEL"] as const;
export const lineupPositionsSchema = z
  .record(lineupRef, z.enum(LINEUP_PLAYS_AS))
  .refine((r) => Object.keys(r).length <= LINEUP_LIMITS.playerPositions, { message: "Demasiadas posiciones." });

// ── Pizarra: el día de partido (cambios por tandas y lanzadores en orden) ──────
/** Topes de los cambios y los lanzadores (los mismos que firestore.rules). */
export const MATCHDAY_LIMITS = {
  /** Cambios planeados en un tablero. */
  subs: 20,
  /** El minuto más alto que un cambio puede llevar (la duración real lo acota al editarlo). */
  subMinute: 149,
  /** Lanzadores por pelota parada (1º, 2º, 3º). */
  takers: 3,
} as const;
/** Un cambio planeado: en el minuto `min`, `in` entra por `out`. */
export const lineupSubSchema = z
  .object({
    id: z.string().min(1).max(40),
    min: z.number().int().min(1).max(MATCHDAY_LIMITS.subMinute),
    out: lineupRef,
    in: lineupRef,
  })
  .refine((s) => s.out !== s.in, { message: "Un cambio necesita dos jugadores distintos." });
const takerList = z
  .array(lineupRef)
  .max(MATCHDAY_LIMITS.takers)
  .refine((l) => new Set(l).size === l.length, { message: "Un lanzador repetido." });
/** Los lanzadores en orden: el primero de cada lista que esté en el campo la toca. */
export const lineupTakersSchema = z.object({
  penalties: takerList.default([]),
  freekicks: takerList.default([]),
  corners: takerList.default([]),
});

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
  /** Jugadores a los que va pegado un trazo «Unir» (línea o polígono de 2 a 4). */
  strokeAnchors: 4,
  /** Trayectorias curvas (un punto de control por jugador) en un paso. */
  curves: 7,
} as const;

/** Punto del campo en % (x 0→100 izquierda→derecha, y 0 = portería rival → 100 = la nuestra). */
const pitchCoord = z.number().min(0).max(100);
export const boardPointSchema = z.object({ x: pitchCoord, y: pitchCoord });
export type BoardPoint = z.infer<typeof boardPointSchema>;
const itemId = z.string().min(1).max(PIZARRA_LIMITS.id);

export const STROKE_KINDS = ["carrera", "pase", "conduccion", "zona", "lapiz", "texto", "unir", "foco", "medir", "fuera"] as const;
/** De qué lado se mira el fuera de juego: nuestra última línea o la del rival. */
export const OFFSIDE_SIDES = ["nos", "rival"] as const;
export const STROKE_COLORS = ["sky", "gold", "white"] as const;
/**
 * Trazo de la pizarra (telestrator). `texto` es un único punto con su texto;
 * el resto, un camino de 2 o más puntos (flechas: inicio, medio, fin; zona:
 * dos esquinas opuestas; lápiz: el trazo simplificado). Los de Bloque 4:
 * `unir` va pegado a 2–4 jugadores (`anchors`, con un punto de reserva por
 * cada uno), `foco` a uno, `medir` son dos puntos (o dos jugadores) y `fuera`
 * es la línea del fuera de juego de un lado (`side`), que se recoloca sola.
 */
const strokeOk = (s: { kind: string; points: unknown[]; text?: string; anchors?: string[]; side?: string }): boolean => {
  const a = s.anchors;
  switch (s.kind) {
    case "texto":
      return s.text !== undefined && s.points.length === 1;
    case "unir":
      return !!a && a.length >= 2 && new Set(a).size === a.length && s.points.length === a.length;
    case "foco":
      return !!a && a.length === 1 && s.points.length === 1;
    case "medir":
      return s.points.length === 2 && (!a || (a.length === 2 && a[0] !== a[1]));
    case "fuera":
      return s.points.length === 2 && s.side !== undefined;
    default:
      return s.points.length >= 2;
  }
};
export const strokeSchema = z
  .object({
    id: itemId,
    kind: z.enum(STROKE_KINDS),
    color: z.enum(STROKE_COLORS),
    points: z.array(boardPointSchema).min(1).max(PIZARRA_LIMITS.strokePoints),
    text: z.string().trim().min(1).max(PIZARRA_LIMITS.strokeText).optional(),
    anchors: z.array(itemId).min(1).max(PIZARRA_LIMITS.strokeAnchors).optional(),
    side: z.enum(OFFSIDE_SIDES).optional(),
  })
  .refine(strokeOk, {
    message: "Un texto lleva un punto y su texto; «Unir» de 2 a 4 jugadores; «Foco» uno; «Medir» y el fuera de juego, dos puntos; el resto, dos puntos o más.",
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
    /** Trayectorias curvas: el punto de control del camino de cada jugador que llega a este paso. */
    curves: z.record(itemId, boardPointSchema).optional(),
  })
  .refine((f) => Object.keys(f.curves ?? {}).length <= PIZARRA_LIMITS.curves, { message: "Demasiadas curvas en un paso." })
  .refine((f) => Object.keys(f.players).length <= PIZARRA_LIMITS.framePlayers, { message: "Como mucho siete jugadores por paso." })
  .refine((f) => new Set(f.rivals.map((r) => r.id)).size === f.rivals.length, { message: "Rivales repetidos en un paso." });
export type PlayFrame = z.infer<typeof playFrameSchema>;

/** El vídeo enlazado a una jugada (Bloque 5): un enlace https y el momento (segundos) en que empieza. */
export const PLAY_VIDEO_LIMITS = { url: 300, at: 5 * 3600 } as const;
const httpsUrl = (v: string): boolean => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !!u.hostname && !u.username && !u.password;
  } catch {
    return false;
  }
};
export const playVideoSchema = z.object({
  url: z.string().trim().min(12).max(PLAY_VIDEO_LIMITS.url).refine(httpsUrl, { message: "El enlace tiene que empezar por https://" }),
  at: z.number().int().min(0).max(PLAY_VIDEO_LIMITS.at),
});
export type PlayVideo = z.infer<typeof playVideoSchema>;

export const PLAY_KINDS = ["propia", "corner", "falta", "banda", "salida"] as const;
export const playSchema = z.object({
  id: itemId,
  name: z.string().trim().min(1).max(PIZARRA_LIMITS.playName),
  kind: z.enum(PLAY_KINDS),
  frames: z.array(playFrameSchema).min(PIZARRA_LIMITS.framesMin).max(PIZARRA_LIMITS.framesMax),
  /** (lenient: a broken link is dropped, never the jugada) */
  video: playVideoSchema.optional().catch(undefined),
});
export type Play = z.infer<typeof playSchema>;
export type PlayKind = Play["kind"];

// ── Pizarra: variantes del siete («2ª parte», «Plan B») ──────────────────────

/** Variantes de un tablero: sus ids fijos y sus topes (los mismos que firestore.rules: variantsOk). */
export const VARIANT_IDS = ["v2", "vb"] as const;
export const VARIANT_LIMITS = { variants: 2, name: 24 } as const;
export const lineupVariantSchema = z.object({
  id: z.enum(VARIANT_IDS),
  name: z.string().trim().min(1).max(VARIANT_LIMITS.name),
  formation: z.enum(LINEUP_FORMATIONS),
  freeMode: z.boolean(),
  slots: lineupSlotsSchema,
  tactics: lineupTacticsSchema,
});
export const lineupVariantsSchema = z
  .array(lineupVariantSchema)
  .max(VARIANT_LIMITS.variants)
  .refine((vs) => new Set(vs.map((v) => v.id)).size === vs.length, { message: "Variantes repetidas." });
export type LineupVariantData = z.infer<typeof lineupVariantSchema>;

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
  /** When the member last opened the bell's panel (centro de avisos). Null while its serverTimestamp is
   *  pending; anything malformed reads as never, so it can never block the session. */
  noticesSeenAt: firestoreDate.nullish().catch(undefined),
});
export type UserProfileParsed = z.infer<typeof userProfileSchema>;

/** A kept notice of the centro de avisos (`notices/{id}`, written only by functions/src/push.ts). */
export const noticeSchema = z.object({
  id: z.string(),
  topic: z.string(),
  title: z.string(),
  body: z.string(),
  url: z.string(),
  at: firestoreDate,
  audience: z.enum(["team", "captains", "personal"]),
  uid: z.string().optional(),
});

// ── r12 · la Sala de control: lo nuevo de clubContent, pushSent, clubDrafts y matchPrivate ──────────────────
const https = z.string().max(300).regex(/^https:\/\/.+/);
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** clubContent.kits (M-19): a malformed kit reads as absent (the web paints the one in its code). */
export const clubKitSchema = z.object({
  name: z.string().max(30).optional(),
  note: z.string().max(200),
  colors: z.array(z.object({ name: z.string().min(1).max(20), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).min(1).max(4),
});
export const clubKitsSchema = z.object({ home: clubKitSchema.optional().catch(undefined), away: clubKitSchema.optional().catch(undefined) });
/** clubContent.trophies (M-19): only the valid ones. */
export const clubTrophySchema = z.object({
  name: z.string().trim().min(1).max(80),
  date: z.union([ymd, z.string().regex(/^\d{4}$/)]),
  photoUrl: z.union([https, z.literal("")]).optional(),
  note: z.string().max(200).optional(),
});
/** clubContent.socials (M-45). */
export const clubSocialSchema = z.object({ net: z.enum(SOCIAL_NETS), url: https });
/** clubContent.sponsors[] with M-45's optional featured / from / to. */
export const clubSponsorSchema = z.object({
  name: z.string().max(60),
  url: z.string().max(300).catch(""),
  logo: z.string().max(300).catch(""),
  featured: z.boolean().optional().catch(undefined),
  from: ymd.optional().catch(undefined),
  to: ymd.optional().catch(undefined),
});
/** A list read item by item: the valid entries only (one bad one never drops the rest). */
export const validItems = <T>(schema: z.ZodType<T>, v: unknown, max: number): T[] =>
  (Array.isArray(v) ? v : []).flatMap((x) => {
    const r = schema.safeParse(x);
    return r.success ? [r.data] : [];
  }).slice(0, max);
/** pushSent/{id} (M-18 «Lo que se ha mandado»). */
export const pushSentSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  topic: z.string(),
  url: z.string(),
  tag: z.string().catch(""),
  matchId: z.string().nullable().catch(null),
  audience: z.enum(["publico", "equipo", "capitanes", "convocados"]).catch("publico"),
  kind: z.enum(["auto", "manual", "recordatorio"]).catch("auto"),
  devices: z.number().int().min(0).catch(0),
  members: z.number().int().min(0).catch(0),
  by: z.string().nullable().catch(null),
  at: firestoreDate.transform((v) => dateMs(v)),
});
/** clubDrafts/content (M-20): anything malformed reads as no draft on the server. */
export const clubContentDraftSchema = z.object({
  club: z.record(z.string(), z.unknown()),
  stories: z.record(z.string(), z.unknown()),
  by: z.string(),
  byName: z.string().optional(),
  at: firestoreDate.transform((v) => dateMs(v)).nullable().catch(null),
});
/** matchPrivate/{id}.notasError (M-42). */
export const notasErrorSchema = z.object({ at: z.number(), message: z.string() });

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
