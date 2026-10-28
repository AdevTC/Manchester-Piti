import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Navigate,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";
import { z } from "zod";
import { RootLayout } from "./RootLayout";
import {
  RoutePending,
  RouteError,
  RouteNotFound,
} from "./components/route-states";
import { matchSearchSchema } from "./lib/matchTabs";
import { analysisSearchFields, statsScopeSearchFields } from "./lib/analysisSearch";
import { legacyHref } from "./lib/legacyUrls";
import { pageChangeTransition } from "./components/celeste/pageTransition";

// Root-level search schema: `season` is inherited by all child routes so any
// page can be deep-linked with ?season=<id>. Uses .optional() (not .default)
// so an absent param reads as `undefined`, letting SeasonUrlSync distinguish
// "no season in URL" (seed from context/localStorage) from an explicit value.
// .catch("all") guards a malformed value.
export const rootSearchSchema = z.object({
  season: z.string().optional().catch("all"),
});

// Stats route's `validateSearch`: the active view is deep-linkable/persistent.
// Merges with the inherited root `season`, so reading/writing via the route api
// preserves `season`. `a`/`b` are Comparar's two players (ids; the pane ignores one nobody in the
// period has), so «X vs Y» can be linked from the jugador page.
const optionalString = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined);
const statsShape = {
  ...analysisSearchFields,
  ...statsScopeSearchFields,
  a: optionalString,
  b: optionalString,
  view: z
    .enum(["summary", "players", "minutes", "positions", "rivals", "compare", "explore", "game"])
    .optional()
    .catch(undefined),
  section: z
    .enum(["individual", "streaks", "team", "evolution"])
    .optional()
    .catch(undefined),
  // Legacy ?tab=compare (links shared before ?view=): read once, turned into view=compare, never written.
  tab: z.enum(["general", "compare"]).optional().catch(undefined),
};
export const statsSearchSchema = z.object(statsShape).transform(({ tab, ...rest }) => (rest.view || tab !== "compare" ? rest : { ...rest, view: "compare" as const }));
export type StatsSearch = z.infer<typeof statsSearchSchema>;

// The boards' parameters, declared on their routes so every page reads them typed (each page session gives
// them their meaning). The URL scheme is in each round's Main board: an address per screen, sheets as ?hoja=.
const slug = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional().catch(undefined);
const minute = z.coerce.number().int().min(0).max(200).optional().catch(undefined);
const jornada = z.coerce.number().int().min(1).max(99).optional().catch(undefined);
// Números writes its lists as the boards do, «a,b» (an array would come back to the address as JSON)
const plainList = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => [...new Set((Array.isArray(v) ? v : v.split(",")).map((x) => x.trim()).filter(Boolean))].slice(0, 300).join(","))
  .refine((v) => v.split(",").every((x) => x.length <= 128))
  .optional()
  .catch(undefined);

// Inicio: / (?min= holds the moviola), its screens and its sheets.
export const homeSearchSchema = z.object({
  min: minute,
  hoja: z.enum(["porra", "mvp", "cartel"]).optional().catch(undefined),
});
export const hoyCampoSearchSchema = homeSearchSchema.extend({ jugador: slug });

// Números: the boards' parameters — the time bar's (every screen) and each screen's own (NU-Main «La dirección»).
// The old /stats ones redirect here renamed (legacyUrls); the page reads only these.
export const numerosSearchSchema = z.object({
  temporada: z.string().max(400).optional().catch(undefined),
  hasta: z.string().regex(/^j\d{1,2}$/).optional().catch(undefined),
  campo: z.enum(["casa", "fuera"]).optional().catch(undefined),
  partidos: plainList,
  jugadores: plainList,
  buscar: z.string().max(160).optional().catch(undefined),
  ver: z.enum(["todo"]).optional().catch(undefined),
  /** goles · asistencias · minutos · mvp · porra, or any other of the 38 by its label («amarillas»). */
  ranking: slug,
  jugador: slug,
  estrella: slug,
  puesto: slug,
  equipo: z.enum(["rival"]).optional().catch(undefined),
  parte: z.coerce.number().int().min(1).max(8).optional().catch(undefined),
  familia: z.string().max(160).optional().catch(undefined),
  metrica: z.string().regex(/^(\d{3}|A\d{2})$/).optional().catch(undefined),
  "fuera-del-audio": z.coerce.number().int().min(1).max(1).optional().catch(undefined),
  /** The catalogue's search. */
  q: z.string().max(160).optional().catch(undefined),
  /** Configurable game-analysis table; an empty column list is deliberate. */
  vista: z.enum(["resumen", "pases", "remates", "defensa", "porteria", "rotaciones", "disciplina"]).optional().catch(undefined),
  columnas: z.union([z.string(), z.number()]).transform(String).pipe(z.string().max(2048).regex(/^(?:(?:\d{3}|A\d{2})(?:,(?:\d{3}|A\d{2}))*)?$/)).optional().catch(undefined),
  orden: z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^(\d{3}|A\d{2})$/)).optional().catch(undefined),
  sentido: z.enum(["asc", "desc"]).optional().catch(undefined),
  "buscar-columna": z.string().max(160).optional().catch(undefined),
  "familia-columna": z.string().max(160).optional().catch(undefined),
  rival: slug,
  hoja: slug,
});

// /vestuario?rsvp=yes|no&m=<matchId>&n=<nonce>: a notice's «Voy» / «No puedo» button (public/push-sw.js,
// `n` its one-time ticket). The vestuario writes the answer once with a valid ticket (only asks without
// one) and clears them all (useRsvpFromNotice). Anything else is dropped.
export const vestuarioSearchSchema = z.object({
  rsvp: z.enum(["yes", "no"]).optional().catch(undefined),
  m: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional().catch(undefined),
  n: z.string().regex(/^[A-Za-z0-9-]{8,64}$/).optional().catch(undefined),
});

// Partidos: Jornadas (/partidos), Tabla and Balance, each with ?temporada= for another season (page state
// only, never the remembered choice). The old ?view=tabla|numeros redirects to /partidos/tabla|balance.
export const partidosSearchSchema = z.object({ temporada: slug });
export const jornadasSearchSchema = z.object({
  jornada,
  lente: z.enum(["previa", "directo", "acta"]).optional().catch(undefined),
  ver: z.enum(["proximos", "resultados"]).optional().catch(undefined),
  hoja: slug,
});
export const partidosTablaSearchSchema = z.object({
  ver: z.enum(["entera"]).optional().catch(undefined),
  "y-si": z.string().regex(/^[A-Za-z0-9,]{1,200}$/).optional().catch(undefined),
});
export const partidosBalanceSearchSchema = z.object({
  jornada,
  faceta: z.enum(["goles", "minutos", "rachas", "porteria", "tarjetas", "cuando", "rivales"]).optional().catch(undefined),
  ver: z.enum(["todo"]).optional().catch(undefined),
});

// /admin is the Sala de control (r12): a layout route (who looks is decided there) over the five places' screens.
// Every old address of the sala redirects through lib/adminUrls (the root's beforeLoad, with the season). The
// screens' own parameters:
export const adminAltaSearchSchema = z.object({
  /** «Alta» starting on this free dorsal (1–99; anything else is dropped). */
  dorsal: z.coerce.number().int().min(1).max(99).optional().catch(undefined),
});
export const adminSociosSearchSchema = z.object({
  /** Which part of the door: who asks for a ficha, who is inside, the invitations. */
  ver: z.enum(["fichas", "dentro", "invitaciones", "llaman"]).optional().catch(undefined),
});
// /pizarra?tablero=<id> opens that board (v2/deeplink.ts reads it on the first render). Declared so the
// match page, the admin and the perfil link to a board through the typed route.
export const pizarraSearchSchema = z.object({
  tablero: optionalString,
});

// Every old address (/matches/*, /stats?view=…, /profile and its tabs, /partidos?view=…, the /, /club and
// /vestuario hashes) is answered here, before any route loads: a permanent move to its new address with its
// parameters, replacing the old entry (lib/legacyUrls: the same table the server render answers 308 with).
// An old hash is an old address only on arrival: once a page is shown, a change of its #hash alone (a chapter
// link, a page noting its tab) is the page's own business. The router hears those too (@tanstack/history
// listens to popstate and to every pushState/replaceState), so each router remembers the page it showed.
interface RouterContext {
  shown: { page: string | null };
}
const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  validateSearch: rootSearchSchema,
  beforeLoad: ({ location, context, preload }) => {
    const page = location.pathname + location.searchStr;
    const samePage = context.shown.page === page;
    if (!preload) context.shown.page = page;
    const href = legacyHref(page + (location.hash && !samePage ? `#${location.hash}` : ""));
    if (href) {
      if (!preload) context.shown.page = null;
      throw redirect({ href, replace: true });
    }
  },
  // An unknown address is the 404 («Fuera de juego»), with the site chrome and a way back, never a
  // silent redirect. The catch-all route below answers it; this covers a notFound() thrown anywhere.
  notFoundComponent: RouteNotFound,
});

// The screens of an area are child routes of its layout route. Until the area's redesign gives each screen
// its own component, the layout renders today's page for all of them (it reads which screen from the
// address: lib/interimScreens) and the screens render nothing of their own.

// ── Inicio: la portada and its screens, one HomePage mounted across them (a pathless layout)
const inicioRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "inicio",
  validateSearch: homeSearchSchema,
  component: lazyRouteComponent(() => import("./pages/Home"), "HomePage"),
});
const matchesRoute = createRoute({ getParentRoute: () => inicioRoute, path: "/" });
const hoyCampoRoute = createRoute({ getParentRoute: () => inicioRoute, path: "hoy/campo", validateSearch: hoyCampoSearchSchema });
const hoyJugadasRoute = createRoute({ getParentRoute: () => inicioRoute, path: "hoy/jugadas" });
// (players only: Inicio sends anyone else to /)
const hoyLoTuyoRoute = createRoute({ getParentRoute: () => inicioRoute, path: "hoy/lo-tuyo" });
const camisetaRoute = createRoute({ getParentRoute: () => inicioRoute, path: "camiseta" });

// ── Partidos: Jornadas, Tabla, Balance («tabla» and «balance» are reserved: no match is called that)
const fixturesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/partidos",
  validateSearch: partidosSearchSchema,
  component: lazyRouteComponent(() => import("./pages/partidos/PartidosPage"), "PartidosPage"),
});
const jornadasRoute = createRoute({ getParentRoute: () => fixturesRoute, path: "/", validateSearch: jornadasSearchSchema });
const partidosTablaRoute = createRoute({ getParentRoute: () => fixturesRoute, path: "tabla", validateSearch: partidosTablaSearchSchema });
const partidosBalanceRoute = createRoute({ getParentRoute: () => fixturesRoute, path: "balance", validateSearch: partidosBalanceSearchSchema });

// ── The match: /partidos/<id> (El partido) and its screens; la mesa is a screen of its own, full-screen.
// The id is Firestore's: it never changes when the jornadas are renumbered.
const matchDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/partidos/$matchId",
  validateSearch: matchSearchSchema,
  component: lazyRouteComponent(() => import("./pages/match/MatchPage"), "MatchPage"),
});
const matchIndexRoute = createRoute({ getParentRoute: () => matchDetailRoute, path: "/" });
const matchSieteRoute = createRoute({ getParentRoute: () => matchDetailRoute, path: "siete" });
const matchNumerosRoute = createRoute({ getParentRoute: () => matchDetailRoute, path: "numeros" });
const matchVestuarioRoute = createRoute({ getParentRoute: () => matchDetailRoute, path: "vestuario" });

// La mesa: the full-screen scoring screen of a match (admins and its anotadores; the page checks).
// ?vista=cronica opens «Lo que va pasando».
export const mesaSearchSchema = z.object({
  vista: z.enum(["cronica"]).optional().catch(undefined),
});
const mesaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/partidos/$matchId/mesa",
  validateSearch: mesaSearchSchema,
  component: lazyRouteComponent(() => import("./pages/mesa/Mesa"), "Mesa"),
});

// ── Estadísticas: one address per screen, under the time bar (the screens only name themselves: NumerosPage reads
// the address).
const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/estadisticas",
  validateSearch: numerosSearchSchema,
  component: lazyRouteComponent(() => import("./pages/stats/NumerosPage"), "NumerosPage"),
});
const numerosIndexRoute = createRoute({ getParentRoute: () => statsRoute, path: "/" });
const numerosYSiRoute = createRoute({ getParentRoute: () => statsRoute, path: "y-si" });
const numerosJugadoresRoute = createRoute({ getParentRoute: () => statsRoute, path: "jugadores" });
const numerosCampoRoute = createRoute({ getParentRoute: () => statsRoute, path: "campo" });
const numerosPuestosRoute = createRoute({ getParentRoute: () => statsRoute, path: "campo/puestos" });
const numerosSistemasRoute = createRoute({ getParentRoute: () => statsRoute, path: "campo/sistemas" });
const numerosJuegoRoute = createRoute({ getParentRoute: () => statsRoute, path: "juego" });
const numerosJuegoTablaRoute = createRoute({ getParentRoute: () => statsRoute, path: "juego/tabla" });
const numerosGraficasRoute = createRoute({ getParentRoute: () => statsRoute, path: "juego/graficas" });
const numerosCatalogoRoute = createRoute({ getParentRoute: () => statsRoute, path: "juego/catalogo" });
const numerosRivalesRoute = createRoute({ getParentRoute: () => statsRoute, path: "rivales" });
const numerosRecordsRoute = createRoute({ getParentRoute: () => statsRoute, path: "records" });
const numerosMarcasRoute = createRoute({ getParentRoute: () => statsRoute, path: "records/marcas" });
const numerosCromosRoute = createRoute({ getParentRoute: () => statsRoute, path: "records/cromos" });
const numerosEvolucionRoute = createRoute({ getParentRoute: () => statsRoute, path: "records/evolucion" });

// ── Plantilla: el vestuario, el cara a cara, el álbum (?season= is the root's); a player and his sections
export const plantillaSearchSchema = z.object({
  kit: z.coerce.number().int().min(1).max(2).optional().catch(undefined),
  orden: z.enum(["posicion"]).optional().catch(undefined),
  // (the router parses «?q=11» as a number: a dorsal searched stays text)
  q: z.union([z.string(), z.number()]).transform(String).pipe(z.string().max(80)).optional().catch(undefined),
});
// One page for la percha and its players (pathless, like Inicio and Tú): moving between /plantilla and
// /jugadores/<id> keeps it mounted, so the shirt flies from its hanger to the player without a remount.
const plantillaLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "plantilla",
  component: lazyRouteComponent(() => import("./pages/squad/SquadPage"), "SquadPage"),
});
const plantillaRoute = createRoute({
  getParentRoute: () => plantillaLayoutRoute,
  path: "/plantilla",
  validateSearch: plantillaSearchSchema,
});
const plantillaIndexRoute = createRoute({ getParentRoute: () => plantillaRoute, path: "/" });
const plantillaAlbumRoute = createRoute({
  getParentRoute: () => plantillaRoute,
  path: "album",
  validateSearch: z.object({ ver: z.enum(["tengo", "faltan"]).optional().catch(undefined) }),
});
// The duel: ?a= and ?b= are its two corners (player ids; one nobody in the squad has is left out).
const caraACaraRoute = createRoute({
  getParentRoute: () => plantillaRoute,
  path: "cara-a-cara",
  validateSearch: z.object({ a: slug, b: slug }),
});

const playerProfileRoute = createRoute({
  getParentRoute: () => plantillaLayoutRoute,
  path: "/jugadores/$playerId",
});
const playerIndexRoute = createRoute({ getParentRoute: () => playerProfileRoute, path: "/" });
const playerTemporadaRoute = createRoute({ getParentRoute: () => playerProfileRoute, path: "temporada" });
const playerJornadasRoute = createRoute({ getParentRoute: () => playerProfileRoute, path: "jornadas" });
const playerJuegoRoute = createRoute({ getParentRoute: () => playerProfileRoute, path: "juego" });
const playerAnalisisRoute = createRoute({ getParentRoute: () => playerProfileRoute, path: "analisis" });
const playerCromoRoute = createRoute({ getParentRoute: () => playerProfileRoute, path: "cromo" });

// ── El club: la vitrina and its four doors (the fourth is /vestuario)
const clubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/club",
  component: lazyRouteComponent(() => import("./pages/club/ClubPage"), "ClubPage"),
});
const clubIndexRoute = createRoute({ getParentRoute: () => clubRoute, path: "/" });
const clubVitrinaRoute = createRoute({ getParentRoute: () => clubRoute, path: "vitrina" });
const clubPiezaRoute = createRoute({ getParentRoute: () => clubRoute, path: "vitrina/$pieza" });
const clubHistoriaRoute = createRoute({ getParentRoute: () => clubRoute, path: "historia" });
const clubEquipoRoute = createRoute({ getParentRoute: () => clubRoute, path: "equipo" });
const clubCamisetaRoute = createRoute({ getParentRoute: () => clubRoute, path: "equipo/camiseta" });
const clubGenteRoute = createRoute({ getParentRoute: () => clubRoute, path: "gente" });

// ── El vestuario: the door without a session, the vestuario with one; each block its screen
const vestuarioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/vestuario",
  validateSearch: vestuarioSearchSchema,
  component: lazyRouteComponent(() => import("./pages/vestuario/VestuarioPage"), "VestuarioPage"),
});
const vestuarioIndexRoute = createRoute({ getParentRoute: () => vestuarioRoute, path: "/" });
const vestuarioCajaRoute = createRoute({ getParentRoute: () => vestuarioRoute, path: "caja" });
const vestuarioEncuestasRoute = createRoute({ getParentRoute: () => vestuarioRoute, path: "encuestas" });
const vestuarioEncuestaRoute = createRoute({ getParentRoute: () => vestuarioRoute, path: "encuestas/$pollId" });
const vestuarioAusenciasRoute = createRoute({ getParentRoute: () => vestuarioRoute, path: "ausencias" });
const vestuarioTurnosRoute = createRoute({ getParentRoute: () => vestuarioRoute, path: "turnos" });
const vestuarioEntrenosRoute = createRoute({ getParentRoute: () => vestuarioRoute, path: "entrenos" });
const vestuarioTablonRoute = createRoute({ getParentRoute: () => vestuarioRoute, path: "tablon" });
const vestuarioPuertaRoute = createRoute({ getParentRoute: () => vestuarioRoute, path: "puerta" });
const vestuarioFichaRoute = createRoute({ getParentRoute: () => vestuarioRoute, path: "ficha" });

// ── Tú: tu página (members; the layout shows the door to anybody else) and los avisos, one page mounted across
// both (a pathless layout: the carta travels between them); buscar
const tuRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "tu",
  component: lazyRouteComponent(() => import("./pages/perfil/ProfilePage"), "ProfilePage"),
});
const profileRoute = createRoute({ getParentRoute: () => tuRoute, path: "perfil" });
const perfilIndexRoute = createRoute({ getParentRoute: () => profileRoute, path: "/" });
const perfilTemporadaRoute = createRoute({ getParentRoute: () => profileRoute, path: "temporada" });
const perfilCromosRoute = createRoute({ getParentRoute: () => profileRoute, path: "temporada/cromos" });
const perfilPosicionesRoute = createRoute({ getParentRoute: () => profileRoute, path: "posiciones" });
const perfilNombreRoute = createRoute({ getParentRoute: () => profileRoute, path: "nombre" });
const perfilAjustesRoute = createRoute({ getParentRoute: () => profileRoute, path: "ajustes" });
const perfilCuentaRoute = createRoute({ getParentRoute: () => profileRoute, path: "cuenta" });
const perfilCapitaniaRoute = createRoute({ getParentRoute: () => profileRoute, path: "capitania" });
const perfilCompartirRoute = createRoute({ getParentRoute: () => profileRoute, path: "compartir" });
// (today: the profile's Avisos tab, members only, until Tú lands; then /avisos opens «A medida» to anybody)
const avisosRoute = createRoute({
  getParentRoute: () => tuRoute,
  path: "avisos",
  // (the TU board's filters: «Te toca», «Sin leer», «Partidos», «Del vestuario», «Tuyos» and one match)
  validateSearch: z.object({
    ver: z
      .string()
      .regex(/^(te-toca|sin-leer|partidos|vestuario|tuyos|partido-[A-Za-z0-9_-]{1,64})$/)
      .optional()
      .catch(undefined),
  }),
});
const avisosIndexRoute = createRoute({ getParentRoute: () => avisosRoute, path: "/" });
const avisosAMedidaRoute = createRoute({ getParentRoute: () => avisosRoute, path: "a-medida" });
// (the phone's search as an address, so «atrás» closes it; on a desktop the dialog keeps the address)
const buscarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/buscar",
  // (a typed ?q=11 reaches here as the number 11: a dorsal or a jornada is a search too)
  validateSearch: z.object({ q: z.union([z.string(), z.number()]).transform(String).pipe(z.string().max(160)).optional().catch(undefined) }),
  component: lazyRouteComponent(() => import("./components/celeste/BuscarPage"), "BuscarPage"),
});

// ── La Sala de control (r12, DIRECTION.md § Los cinco sitios): Hoy · Partidos · Plantilla · Caja · Club. Each screen
// is its area's file (pages/admin/areas/<area>, MARCO.md says whose); the match is a layout of its own (its head and
// carril) over its six stations.
const hoyPartidos = () => import("./pages/admin/areas/hoy-partidos/screens");
const actaArea = () => import("./pages/admin/areas/acta/screens");
const plantillaArea = () => import("./pages/admin/areas/plantilla/screens");
const cajaArea = () => import("./pages/admin/areas/caja/Caja");
const clubArea = () => import("./pages/admin/areas/club/screens");
// (the old addresses' parameters, typed for the links that still write them: see «TEMPORARY» below)
const legacySearch = z.object({ j: optionalString, jugador: optionalString, seccion: optionalString, tab: optionalString, vitrina: z.boolean().optional().catch(undefined), nuevo: z.boolean().optional().catch(undefined), vista: optionalString, coste: optionalString });
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: lazyRouteComponent(() => import("./pages/admin/shell/AdminLayout"), "AdminLayout"),
});
const adminHoyRoute = createRoute({ getParentRoute: () => adminRoute, path: "/", component: lazyRouteComponent(hoyPartidos, "HoyScreen") });
// Partidos: la temporada, nuevo, archivados (and one), and the match
const adminPartidosRoute = createRoute({ getParentRoute: () => adminRoute, path: "partidos", validateSearch: legacySearch });
const adminTemporadaRoute = createRoute({ getParentRoute: () => adminPartidosRoute, path: "/", component: lazyRouteComponent(hoyPartidos, "TemporadaScreen") });
const adminNuevoRoute = createRoute({ getParentRoute: () => adminPartidosRoute, path: "nuevo", component: lazyRouteComponent(hoyPartidos, "NuevoScreen") });
const adminArchivadosRoute = createRoute({ getParentRoute: () => adminPartidosRoute, path: "archivados", component: lazyRouteComponent(hoyPartidos, "ArchivadosScreen") });
const adminArchivadoRoute = createRoute({ getParentRoute: () => adminPartidosRoute, path: "archivados/$matchId", component: lazyRouteComponent(hoyPartidos, "ArchivadoScreen") });
const adminPartidoRoute = createRoute({
  getParentRoute: () => adminPartidosRoute,
  path: "$matchId",
  component: lazyRouteComponent(() => import("./pages/admin/partido/PartidoLayout"), "PartidoLayout"),
});
const adminStationAutoRoute = createRoute({ getParentRoute: () => adminPartidoRoute, path: "/", component: lazyRouteComponent(hoyPartidos, "StationAuto") });
const adminConvocatoriaRoute = createRoute({ getParentRoute: () => adminPartidoRoute, path: "convocatoria", component: lazyRouteComponent(hoyPartidos, "ConvocatoriaScreen") });
const adminDatosRoute = createRoute({ getParentRoute: () => adminPartidoRoute, path: "datos", component: lazyRouteComponent(hoyPartidos, "DatosScreen") });
const adminEnJuegoRoute = createRoute({ getParentRoute: () => adminPartidoRoute, path: "en-juego", component: lazyRouteComponent(hoyPartidos, "EnJuegoScreen") });
const adminActaRoute = createRoute({ getParentRoute: () => adminPartidoRoute, path: "acta", component: lazyRouteComponent(actaArea, "ActaScreen") });
const adminNarracionRoute = createRoute({ getParentRoute: () => adminPartidoRoute, path: "acta/narracion", component: lazyRouteComponent(actaArea, "NarracionScreen") });
const adminHistorialRoute = createRoute({ getParentRoute: () => adminPartidoRoute, path: "acta/historial", component: lazyRouteComponent(actaArea, "HistorialScreen") });
const adminPublicarRoute = createRoute({ getParentRoute: () => adminPartidoRoute, path: "publicar", component: lazyRouteComponent(actaArea, "PublicarScreen") });
const adminDespuesRoute = createRoute({ getParentRoute: () => adminPartidoRoute, path: "despues", component: lazyRouteComponent(actaArea, "DespuesScreen") });
// Plantilla: Jugadores · Socios · Capitanes, the ficha, the alta, the cromos, the old ones
const adminPlantillaRoute = createRoute({ getParentRoute: () => adminRoute, path: "plantilla", validateSearch: legacySearch, component: lazyRouteComponent(plantillaArea, "PlantillaArea") });
// (the list, the ficha, the alta and the cromos: PlantillaArea draws them itself, one instance across the four)
const adminJugadoresRoute = createRoute({ getParentRoute: () => adminPlantillaRoute, path: "/" });
const adminAltaRoute = createRoute({ getParentRoute: () => adminPlantillaRoute, path: "alta", validateSearch: adminAltaSearchSchema });
const adminCromosRoute = createRoute({ getParentRoute: () => adminPlantillaRoute, path: "cromos" });
const adminAntiguosRoute = createRoute({ getParentRoute: () => adminPlantillaRoute, path: "antiguos", component: lazyRouteComponent(plantillaArea, "AntiguosScreen") });
const adminSociosRoute = createRoute({ getParentRoute: () => adminPlantillaRoute, path: "socios", validateSearch: adminSociosSearchSchema, component: lazyRouteComponent(plantillaArea, "SociosScreen") });
const adminCapitanesRoute = createRoute({ getParentRoute: () => adminPlantillaRoute, path: "capitanes", component: lazyRouteComponent(plantillaArea, "CapitanesScreen") });
const adminFichaRoute = createRoute({ getParentRoute: () => adminPlantillaRoute, path: "$playerId" });
// Caja: la caja and the cost of a match
const adminCajaRoute = createRoute({ getParentRoute: () => adminRoute, path: "caja", validateSearch: legacySearch });
const adminCajaIndexRoute = createRoute({ getParentRoute: () => adminCajaRoute, path: "/", component: lazyRouteComponent(cajaArea, "CajaScreen") });
const adminCosteRoute = createRoute({ getParentRoute: () => adminCajaRoute, path: "coste/$matchId", component: lazyRouteComponent(cajaArea, "CosteScreen") });
// Club: the office and its rooms
const adminClubRoute = createRoute({ getParentRoute: () => adminRoute, path: "club" });
const adminOficinaRoute = createRoute({ getParentRoute: () => adminClubRoute, path: "/", component: lazyRouteComponent(clubArea, "OficinaScreen") });
const adminTemporadasRoute = createRoute({ getParentRoute: () => adminClubRoute, path: "temporadas", component: lazyRouteComponent(clubArea, "TemporadasScreen") });
const adminClasificacionRoute = createRoute({ getParentRoute: () => adminClubRoute, path: "clasificacion", component: lazyRouteComponent(clubArea, "ClasificacionScreen") });
const adminWebRoute = createRoute({ getParentRoute: () => adminClubRoute, path: "web", component: lazyRouteComponent(clubArea, "WebScreen") });
const adminWebSeccionRoute = createRoute({ getParentRoute: () => adminClubRoute, path: "web/$seccion", component: lazyRouteComponent(clubArea, "WebSeccionScreen") });
const adminTurnosRoute = createRoute({ getParentRoute: () => adminClubRoute, path: "turnos", component: lazyRouteComponent(clubArea, "TurnosScreen") });
const adminVestuarioRoute = createRoute({ getParentRoute: () => adminClubRoute, path: "vestuario", component: lazyRouteComponent(clubArea, "VestuarioScreen") });
const adminAvisosRoute = createRoute({ getParentRoute: () => adminClubRoute, path: "avisos", component: lazyRouteComponent(clubArea, "AvisosScreen") });
const adminEquipacionesRoute = createRoute({ getParentRoute: () => adminClubRoute, path: "equipaciones", component: lazyRouteComponent(clubArea, "EquipacionesScreen") });
// TEMPORARY (r12): the old addresses some links still name (today's views, the pizarra's «Convocar», Plantilla's
// «Editar en la sala»): typed here so those links compile; they never render — the root redirects each one first
// (lib/adminUrls). Wave 2 points the links at the new addresses and deletes these.
const adminLegacyConvocarRoute = createRoute({ getParentRoute: () => adminRoute, path: "convocar", validateSearch: legacySearch });
const adminLegacyFichasRoute = createRoute({ getParentRoute: () => adminRoute, path: "fichas" });
const adminLegacyContenidoRoute = createRoute({ getParentRoute: () => adminRoute, path: "contenido", validateSearch: legacySearch });
const adminLegacyTurnosRoute = createRoute({ getParentRoute: () => adminRoute, path: "turnos" });
// An address under /admin the sala does not have: its own not-found screen, inside its frame.
const adminNotFoundRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "$",
  component: lazyRouteComponent(() => import("./pages/admin/shell/Screen"), "NotFoundScreen"),
});

// Invitation links (/invitacion/<code>): the layout shows the door until the account is inside;
// once it is, the link just leads into the vestuario.
const invitationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/invitacion/$code",
  component: () => <Navigate to="/vestuario" replace />,
});
const pizarraRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pizarra",
  validateSearch: pizarraSearchSchema,
  component: lazyRouteComponent(
    () => import("./pages/pizarra/PizarraRoute"),
    "PizarraRoute",
  ),
});
// Any address no route above takes: the 404 page. Its id ("/$") is how RootLayout knows to give it no
// legacy chrome.
const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "$",
  component: RouteNotFound,
});
const routeTree = rootRoute.addChildren([
  invitationRoute,
  inicioRoute.addChildren([matchesRoute, hoyCampoRoute, hoyJugadasRoute, hoyLoTuyoRoute, camisetaRoute]),
  fixturesRoute.addChildren([jornadasRoute, partidosTablaRoute, partidosBalanceRoute]),
  matchDetailRoute.addChildren([matchIndexRoute, matchSieteRoute, matchNumerosRoute, matchVestuarioRoute]),
  mesaRoute,
  statsRoute.addChildren([
    numerosIndexRoute,
    numerosYSiRoute,
    numerosJugadoresRoute,
    numerosCampoRoute,
    numerosPuestosRoute,
    numerosSistemasRoute,
    numerosJuegoRoute,
    numerosJuegoTablaRoute,
    numerosGraficasRoute,
    numerosCatalogoRoute,
    numerosRivalesRoute,
    numerosRecordsRoute,
    numerosMarcasRoute,
    numerosCromosRoute,
    numerosEvolucionRoute,
  ]),
  plantillaLayoutRoute.addChildren([
    plantillaRoute.addChildren([plantillaIndexRoute, plantillaAlbumRoute, caraACaraRoute]),
    playerProfileRoute.addChildren([playerIndexRoute, playerTemporadaRoute, playerJornadasRoute, playerJuegoRoute, playerAnalisisRoute, playerCromoRoute]),
  ]),
  clubRoute.addChildren([clubIndexRoute, clubVitrinaRoute, clubPiezaRoute, clubHistoriaRoute, clubEquipoRoute, clubCamisetaRoute, clubGenteRoute]),
  vestuarioRoute.addChildren([
    vestuarioIndexRoute,
    vestuarioCajaRoute,
    vestuarioEncuestasRoute,
    vestuarioEncuestaRoute,
    vestuarioAusenciasRoute,
    vestuarioTurnosRoute,
    vestuarioEntrenosRoute,
    vestuarioTablonRoute,
    vestuarioPuertaRoute,
    vestuarioFichaRoute,
  ]),
  tuRoute.addChildren([
    profileRoute.addChildren([
      perfilIndexRoute,
      perfilTemporadaRoute,
      perfilCromosRoute,
      perfilPosicionesRoute,
      perfilNombreRoute,
      perfilAjustesRoute,
      perfilCuentaRoute,
      perfilCapitaniaRoute,
      perfilCompartirRoute,
    ]),
    avisosRoute.addChildren([avisosIndexRoute, avisosAMedidaRoute]),
  ]),
  buscarRoute,
  pizarraRoute,
  adminRoute.addChildren([
    adminHoyRoute,
    adminPartidosRoute.addChildren([
      adminTemporadaRoute,
      adminNuevoRoute,
      adminArchivadosRoute,
      adminArchivadoRoute,
      adminPartidoRoute.addChildren([adminStationAutoRoute, adminConvocatoriaRoute, adminDatosRoute, adminEnJuegoRoute, adminActaRoute, adminNarracionRoute, adminHistorialRoute, adminPublicarRoute, adminDespuesRoute]),
    ]),
    adminPlantillaRoute.addChildren([adminJugadoresRoute, adminAltaRoute, adminCromosRoute, adminAntiguosRoute, adminSociosRoute, adminCapitanesRoute, adminFichaRoute]),
    adminCajaRoute.addChildren([adminCajaIndexRoute, adminCosteRoute]),
    adminClubRoute.addChildren([adminOficinaRoute, adminTemporadasRoute, adminClasificacionRoute, adminWebRoute, adminWebSeccionRoute, adminTurnosRoute, adminVestuarioRoute, adminAvisosRoute, adminEquipacionesRoute]),
    adminLegacyConvocarRoute,
    adminLegacyFichasRoute,
    adminLegacyContenidoRoute,
    adminLegacyTurnosRoute,
    adminNotFoundRoute,
  ]),
  notFoundRoute,
]);

// One router per app instance: the browser has one, the server render makes one per request.
export const createAppRouter = (history?: RouterHistory) =>
  createRouter({
    routeTree,
    history,
    defaultPreload: "intent",
    // Every change of page gets the choreography, the browser's back and forward included (components/celeste/
    // pageTransition decides: changes inside a page keep their own, the first load none).
    defaultViewTransition: pageChangeTransition(),
    scrollRestoration: true,
    context: { shown: { page: null } },
    // Per-route boundaries (Phase 4). No route has a loader (the pages are realtime and
    // handle their own loading), so defaultPendingComponent only shows when a page's
    // code takes longer than defaultPendingMs (1000ms) to arrive, for at least
    // defaultPendingMinMs (500ms). defaultErrorComponent gives every route an error
    // boundary so a render failure never blanks the screen.
    defaultPendingComponent: RoutePending,
    defaultErrorComponent: RouteError,
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
