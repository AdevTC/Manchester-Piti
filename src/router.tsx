import {
  createRootRoute,
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
  AdminRouteNotFound,
} from "./components/route-states";
import { matchSearchSchema } from "./lib/matchTabs";
import { analysisSearchFields, statsScopeSearchFields } from "./lib/analysisSearch";
import { legacyHref } from "./lib/legacyUrls";

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
const idList = statsScopeSearchFields.matches;

// Inicio: / (?min= holds the moviola), its screens and its sheets.
export const homeSearchSchema = z.object({
  min: minute,
  hoja: z.enum(["porra", "mvp", "cartel"]).optional().catch(undefined),
});
export const hoyCampoSearchSchema = homeSearchSchema.extend({ jugador: slug });

// Números: the time bar's parameters (every screen) and each screen's own. Today's page still reads the
// /stats ones (statsShape) until Números lands.
export const numerosSearchSchema = z.object({
  ...statsShape,
  temporada: z.string().max(400).optional().catch(undefined),
  hasta: z.string().regex(/^j\d{1,2}$/).optional().catch(undefined),
  campo: z.enum(["casa", "fuera"]).optional().catch(undefined),
  partidos: idList,
  jugadores: idList,
  buscar: z.string().max(160).optional().catch(undefined),
  ver: z.enum(["todo"]).optional().catch(undefined),
  ranking: z.enum(["goles", "asistencias", "minutos", "mvp", "porra"]).optional().catch(undefined),
  jugador: slug,
  estrella: slug,
  puesto: slug,
  equipo: z.enum(["rival"]).optional().catch(undefined),
  parte: z.coerce.number().int().min(1).max(8).optional().catch(undefined),
  familia: z.string().max(160).optional().catch(undefined),
  metrica: z.string().regex(/^(\d{3}|A\d{2})$/).optional().catch(undefined),
  "fuera-del-audio": z.coerce.number().int().min(1).max(1).optional().catch(undefined),
  rival: slug,
  hoja: slug,
}).transform(({ tab, ...rest }) => (rest.view || tab !== "compare" ? rest : { ...rest, view: "compare" as const }));

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
  faceta: slug,
  ver: z.enum(["todo"]).optional().catch(undefined),
});

// /admin is the admin app's shell (a layout route; the admin-only guard lives in RootLayout). Hoy's only
// search param is the legacy `tab` of the old single page: /admin?tab=matches|roster|seasons|admins
// redirects to the new section (old links and bookmarks keep working), like /admin/convocatorias → convocar.
export const adminSearchSchema = z.object({
  tab: z.enum(["matches", "roster", "seasons", "admins"]).optional().catch(undefined),
});
const LEGACY_ADMIN_TAB = {
  matches: "/admin/partidos",
  roster: "/admin/plantilla",
  seasons: "/admin/temporadas",
  admins: "/admin/capitanes",
} as const;
// The admin sections' deep-linkable state (drawers, modals and tabs live in the URL).
const optionalTrue = z.boolean().optional().catch(undefined);
export const adminPartidosSearchSchema = z.object({
  /** Open the «Nuevo partido» modal. */
  nuevo: optionalTrue,
});
export const adminPartidoSearchSchema = z.object({
  /** The match's tab; absent = the view's default (acta for drafts / played matches). */
  tab: z.enum(["encuentro", "convocatoria", "acta", "publicar"]).optional().catch(undefined),
  /** The publish peak (the vitrina) of a published acta. */
  vitrina: optionalTrue,
});
export const adminConvocarSearchSchema = z.object({
  /** The match whose convocatoria is open (match id). */
  j: optionalString,
});
export const adminPlantillaSearchSchema = z.object({
  /** The player whose edit drawer is open (player id). */
  jugador: optionalString,
  /** The «Alta de jugador» drawer is open. */
  nuevo: optionalTrue,
  /** «Todos en cromos» instead of the list + ficha. */
  vista: z.enum(["cromos"]).optional().catch(undefined),
  /** «Alta» starting on this free dorsal (1–99; anything else is dropped). */
  dorsal: z.coerce.number().int().min(1).max(99).optional().catch(undefined),
});
// /pizarra?tablero=<id> opens that board (v2/deeplink.ts reads it on the first render). Declared so the
// match page, the admin and the perfil link to a board through the typed route.
export const pizarraSearchSchema = z.object({
  tablero: optionalString,
});
export const adminContenidoSearchSchema = z.object({
  /** The content section whose editor drawer is open. */
  seccion: optionalString,
});
export const adminCajaSearchSchema = z.object({
  /** «Coste del partido» open for this match (match id): the match workspace's shortcut. */
  coste: optionalString,
});

// Every old address (/matches/*, /stats?view=…, /profile and its tabs, /partidos?view=…, the /, /club and
// /vestuario hashes) is answered here, before any route loads: a permanent move to its new address with its
// parameters, replacing the old entry (lib/legacyUrls: the same table the server render answers 308 with).
const rootRoute = createRootRoute({
  component: RootLayout,
  validateSearch: rootSearchSchema,
  beforeLoad: ({ location }) => {
    const href = legacyHref(location.pathname + location.searchStr + (location.hash ? `#${location.hash}` : ""));
    if (href) throw redirect({ href, replace: true });
  },
  // An unknown address is the 404 («Fuera de juego»), with the site chrome and a way back, never a
  // silent redirect. The catch-all route below answers it; this covers a notFound() thrown anywhere.
  notFoundComponent: RouteNotFound,
});

// The screens of an area are child routes of its layout route. Until the area's redesign gives each screen
// its own component, the layout renders today's page for all of them (it reads which screen from the
// address: lib/interimScreens) and the screens render nothing of their own.

// ── Inicio: la portada and its screens (today's home on each until Inicio lands)
const homePage = lazyRouteComponent(() => import("./pages/Home"), "HomePage");
const matchesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: homeSearchSchema,
  component: homePage,
});
const hoyCampoRoute = createRoute({ getParentRoute: () => rootRoute, path: "/hoy/campo", validateSearch: hoyCampoSearchSchema, component: homePage });
const hoyJugadasRoute = createRoute({ getParentRoute: () => rootRoute, path: "/hoy/jugadas", validateSearch: homeSearchSchema, component: homePage });
// (players only: Inicio sends anyone else to /)
const hoyLoTuyoRoute = createRoute({ getParentRoute: () => rootRoute, path: "/hoy/lo-tuyo", validateSearch: homeSearchSchema, component: homePage });
const camisetaRoute = createRoute({ getParentRoute: () => rootRoute, path: "/camiseta", validateSearch: homeSearchSchema, component: homePage });

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

// ── Números: one address per screen, under the time bar
const statsPage = lazyRouteComponent(() => import("./pages/stats/StatsPage"), "StatsPage");
const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/numeros",
  validateSearch: numerosSearchSchema,
  component: statsPage,
});
const numerosIndexRoute = createRoute({ getParentRoute: () => statsRoute, path: "/" });
const numerosYSiRoute = createRoute({ getParentRoute: () => statsRoute, path: "y-si" });
const numerosJugadoresRoute = createRoute({ getParentRoute: () => statsRoute, path: "jugadores" });
const numerosCampoRoute = createRoute({ getParentRoute: () => statsRoute, path: "campo" });
const numerosPuestosRoute = createRoute({ getParentRoute: () => statsRoute, path: "campo/puestos" });
const numerosSistemasRoute = createRoute({ getParentRoute: () => statsRoute, path: "campo/sistemas" });
const numerosJuegoRoute = createRoute({ getParentRoute: () => statsRoute, path: "juego" });
const numerosJuegoTablaRoute = createRoute({ getParentRoute: () => statsRoute, path: "juego/tabla" });
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
  q: z.string().max(80).optional().catch(undefined),
});
const plantillaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/plantilla",
  validateSearch: plantillaSearchSchema,
  component: lazyRouteComponent(() => import("./pages/squad/SquadPage"), "SquadPage"),
});
const plantillaIndexRoute = createRoute({ getParentRoute: () => plantillaRoute, path: "/" });
const plantillaAlbumRoute = createRoute({
  getParentRoute: () => plantillaRoute,
  path: "album",
  validateSearch: z.object({ ver: z.enum(["tengo", "faltan"]).optional().catch(undefined) }),
});
// (the duel is today's Números «Comparar» until Plantilla lands)
const caraACaraRoute = createRoute({ getParentRoute: () => rootRoute, path: "/plantilla/cara-a-cara", validateSearch: statsSearchSchema, component: statsPage });

const playerProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/jugadores/$playerId",
  component: lazyRouteComponent(() => import("./pages/jugador/JugadorPage"), "JugadorPage"),
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

// ── Tú: tu página (members; the layout shows the door to anybody else), los avisos, buscar
const profilePage = lazyRouteComponent(() => import("./pages/perfil/ProfilePage"), "ProfilePage");
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: "/perfil", component: profilePage });
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
  getParentRoute: () => rootRoute,
  path: "/avisos",
  validateSearch: z.object({ ver: z.enum(["sin-leer", "partido", "vestuario", "tuyos"]).optional().catch(undefined) }),
  component: profilePage,
});
const avisosIndexRoute = createRoute({ getParentRoute: () => avisosRoute, path: "/" });
const avisosAMedidaRoute = createRoute({ getParentRoute: () => avisosRoute, path: "a-medida" });
// (the phone's search as an address, so «atrás» closes it; on a desktop the dialog keeps the address)
const buscarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/buscar",
  validateSearch: z.object({ q: z.string().max(160).optional().catch(undefined) }),
  component: lazyRouteComponent(() => import("./components/celeste/BuscarPage"), "BuscarPage"),
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: lazyRouteComponent(() => import("./pages/admin/shell/AdminLayout"), "AdminLayout"),
});
const adminIndexRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/",
  validateSearch: adminSearchSchema,
  beforeLoad: ({ search }) => {
    if (search.tab) throw redirect({ to: LEGACY_ADMIN_TAB[search.tab], replace: true });
  },
  component: lazyRouteComponent(() => import("./pages/admin/views/Hoy"), "Hoy"),
});
const adminPartidosRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "partidos",
  validateSearch: adminPartidosSearchSchema,
  component: lazyRouteComponent(() => import("./pages/admin/views/Partidos"), "Partidos"),
});
const adminPartidoRoute = createRoute({
  getParentRoute: () => adminPartidosRoute,
  path: "$matchId",
  validateSearch: adminPartidoSearchSchema,
  component: lazyRouteComponent(() => import("./pages/admin/views/Partidos"), "PartidoDetail"),
});
// An address under /admin the Sala de control does not have: the 404 inside its frame (not the public one).
const adminNotFoundRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "$",
  component: AdminRouteNotFound,
});
const adminConvocarRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "convocar",
  validateSearch: adminConvocarSearchSchema,
  component: lazyRouteComponent(() => import("./pages/admin/views/Convocar"), "Convocar"),
});
// v1's path: old links keep working.
const adminConvocatoriasRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "convocatorias",
  validateSearch: adminConvocarSearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/admin/convocar", search: { j: search.j }, replace: true });
  },
});
const adminFichasRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "fichas",
  component: lazyRouteComponent(() => import("./pages/admin/views/Fichas"), "Fichas"),
});
const adminPlantillaRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "plantilla",
  validateSearch: adminPlantillaSearchSchema,
  component: lazyRouteComponent(() => import("./pages/admin/views/Plantilla"), "Plantilla"),
});
const adminTemporadasRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "temporadas",
  component: lazyRouteComponent(() => import("./pages/admin/views/Temporadas"), "Temporadas"),
});
const adminCapitanesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "capitanes",
  component: lazyRouteComponent(() => import("./pages/admin/views/Capitanes"), "Capitanes"),
});
const adminCajaRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "caja",
  validateSearch: adminCajaSearchSchema,
  component: lazyRouteComponent(() => import("./pages/admin/views/Caja"), "Caja"),
});
const adminClasificacionRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "clasificacion",
  component: lazyRouteComponent(() => import("./pages/admin/views/Clasificacion"), "Clasificacion"),
});
const adminTurnosRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "turnos",
  component: lazyRouteComponent(() => import("./pages/admin/views/Turnos"), "Turnos"),
});
const adminContenidoRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "contenido",
  validateSearch: adminContenidoSearchSchema,
  component: lazyRouteComponent(() => import("./pages/admin/views/Contenido"), "Contenido"),
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
  matchesRoute,
  hoyCampoRoute,
  hoyJugadasRoute,
  hoyLoTuyoRoute,
  camisetaRoute,
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
    numerosCatalogoRoute,
    numerosRivalesRoute,
    numerosRecordsRoute,
    numerosMarcasRoute,
    numerosCromosRoute,
    numerosEvolucionRoute,
  ]),
  plantillaRoute.addChildren([plantillaIndexRoute, plantillaAlbumRoute]),
  caraACaraRoute,
  playerProfileRoute.addChildren([playerIndexRoute, playerTemporadaRoute, playerJornadasRoute, playerJuegoRoute, playerAnalisisRoute, playerCromoRoute]),
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
  buscarRoute,
  pizarraRoute,
  adminRoute.addChildren([
    adminIndexRoute,
    adminPartidosRoute.addChildren([adminPartidoRoute]),
    adminConvocarRoute,
    adminConvocatoriasRoute,
    adminFichasRoute,
    adminPlantillaRoute,
    adminTemporadasRoute,
    adminCapitanesRoute,
    adminContenidoRoute,
    adminCajaRoute,
    adminClasificacionRoute,
    adminTurnosRoute,
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
    scrollRestoration: true,
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
