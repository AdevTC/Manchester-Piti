// The «nuevo» badges expire on their own: a feature wears its badge for 21 days after its release date.
// Every badge in the app names its feature here, so a release date lives in one place and nobody has to
// remember to take the badge down. (The pizarra rail has its own rule, on top of this: opened twice.)

/** How long a feature keeps its «nuevo» badge. */
export const NEW_DAYS = 21;
const DAY_MS = 86_400_000;

/** Release dates (ISO, the day the feature went live, from the commit that brought it), by feature. */
export const NEW_FEATURES = {
  // El club (6 Oct 2026)
  clubEscudo: "2026-10-06",
  clubTrofeos: "2026-10-06",
  clubEquipaciones: "2026-10-06",
  clubNumeros: "2026-10-06",
  clubPreguntas: "2026-10-06",
  clubHuecoPatrocinio: "2026-10-06",
  // Estadísticas (6 Oct 2026)
  statsPuntos: "2026-10-06",
  statsPorteriasACero: "2026-10-06",
  statsMasMvp: "2026-10-06",
  statsConstelacion: "2026-10-06",
  statsRelojDeGoles: "2026-10-06",
  statsUltimasJornadas: "2026-10-06",
  statsMapaDeMinutos: "2026-10-06",
  statsDetalleDeRival: "2026-10-06",
  statsCaraACara: "2026-10-06",
  statsCarreraPichichi: "2026-10-06",
  statsFechasSenaladas: "2026-10-06",
  // La página del jugador (6 Oct 2026)
  jugadorCromo: "2026-10-06",
  jugadorPerfil: "2026-10-06",
  jugadorJornadas: "2026-10-06",
  jugadorCuandoMarca: "2026-10-06",
  jugadorSocios: "2026-10-06",
  jugadorVitrina: "2026-10-06",
  jugadorMvp: "2026-10-06",
  // La puerta del vestuario (7 Oct 2026)
  accesoDesdeDentro: "2026-10-07",
  accesoTunel: "2026-10-07",
  accesoMuro: "2026-10-07",
  accesoCapitanes: "2026-10-07",
  capitanAviso: "2026-10-07",
  capitanPeticiones: "2026-10-07",
  capitanCartel: "2026-10-07",
  // La carta, el perfil (8 Oct 2026)
  perfilCompartir: "2026-10-08",
  perfilNombre: "2026-10-08",
  perfilEvoluciones: "2026-10-08",
  perfilProbarAviso: "2026-10-08",
  perfilAjusteSalida: "2026-10-08",
  perfilAjusteBrillo: "2026-10-08",
  perfilQueGuarda: "2026-10-08",
  perfilBaja: "2026-10-08",
  // Posiciones (14 Oct 2026)
  posicionesPlantilla: "2026-10-14",
  posicionesJugador: "2026-10-14",
  posicionesStats: "2026-10-14",
} as const satisfies Record<string, string>;

export type NewFeature = keyof typeof NEW_FEATURES;

/**
 * Whether a feature released on `releasedAt` (ISO date) is still «nuevo» at `now`: from its release day
 * until 21 days later (day 20 yes, day 21 no). An unreadable date never shows the badge.
 */
export function isNew(releasedAt: string, now: number = Date.now()): boolean {
  const from = Date.parse(releasedAt);
  if (Number.isNaN(from)) return false;
  return now < from + NEW_DAYS * DAY_MS;
}

/** `isNew` for a named feature of NEW_FEATURES. */
export function isFeatureNew(feature: NewFeature, now: number = Date.now()): boolean {
  return isNew(NEW_FEATURES[feature], now);
}
