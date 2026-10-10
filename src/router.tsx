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
  MatchDetailPending,
  PlayerProfilePending,
} from "./components/route-states";

// Source of truth for the Plantilla route's `validateSearch` (below); exported
// so it can be reused elsewhere (e.g. Phase 4). Invalid `mode` falls back to
// "expedientes" (via .catch), preserving the old localStorage-default behavior.
export const plantillaSearchSchema = z.object({
  mode: z
    .enum(["expedientes", "pizarra"])
    .default("expedientes")
    .catch("expedientes"),
});

// Root-level search schema: `season` is inherited by all child routes so any
// page can be deep-linked with ?season=<id>. Uses .optional() (not .default)
// so an absent param reads as `undefined`, letting SeasonUrlSync distinguish
// "no season in URL" (seed from context/localStorage) from an explicit value.
// .catch("all") guards a malformed value.
export const rootSearchSchema = z.object({
  season: z.string().optional().catch("all"),
});

// Stats route's `validateSearch`: the active tab is deep-linkable/persistent.
// Merges with the inherited root `season`, so reading/writing via the route api
// preserves `season`. Invalid `tab` falls back to "general" (via .catch),
// matching the old useState default.
export const statsSearchSchema = z.object({
  tab: z.enum(["general", "compare"]).default("general").catch("general"),
  view: z
    .enum(["summary", "players", "minutes", "rivals", "compare", "explore"])
    .optional()
    .catch(undefined),
  section: z
    .enum(["individual", "streaks", "team", "evolution"])
    .optional()
    .catch(undefined),
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
const optionalString = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined);
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
  /** «Alta» starting on this free dorsal (1–99; anything else is dropped). */
  dorsal: z.coerce.number().int().min(1).max(99).optional().catch(undefined),
});
export const adminContenidoSearchSchema = z.object({
  /** The content section whose editor drawer is open. */
  seccion: optionalString,
});

const rootRoute = createRootRoute({
  component: RootLayout,
  validateSearch: rootSearchSchema,
  // Parity with the old hash router, which fell back to "matches" for any
  // invalid hash. Unknown clean URLs now redirect to "/" instead of blanking.
  notFoundComponent: () => <Navigate to="/" replace />,
});

const matchesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(() => import("./pages/Home"), "HomePage"),
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stats",
  validateSearch: statsSearchSchema,
  component: lazyRouteComponent(() => import("./pages/stats/StatsPage"), "StatsPage"),
});

const plantillaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/plantilla",
  validateSearch: plantillaSearchSchema,
  component: lazyRouteComponent(() => import("./pages/squad/SquadPage"), "SquadPage"),
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: lazyRouteComponent(() => import("./pages/perfil/ProfilePage"), "ProfilePage"),
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
const adminEnJuegoRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "en-juego/$matchId",
  component: lazyRouteComponent(() => import("./pages/admin/views/EnJuego"), "EnJuego"),
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
const adminContenidoRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "contenido",
  validateSearch: adminContenidoSearchSchema,
  component: lazyRouteComponent(() => import("./pages/admin/views/Contenido"), "Contenido"),
});

// Detail pages share the realtime collection cache with the club pages.
const matchDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/matches/$matchId",
  pendingComponent: MatchDetailPending,
  component: lazyRouteComponent(
    () => import("./pages/match/MatchPage"),
    "MatchPage",
  ),
});

const playerProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/jugadores/$playerId",
  pendingComponent: PlayerProfilePending,
  component: lazyRouteComponent(
    () => import("./pages/jugador/JugadorPage"),
    "JugadorPage",
  ),
});

const fixturesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/partidos",
  component: lazyRouteComponent(
    () => import("./pages/partidos/PartidosPage"),
    "PartidosPage",
  ),
});
const clubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/club",
  component: lazyRouteComponent(() => import("./pages/club/ClubPage"), "ClubPage"),
});
const vestuarioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/vestuario",
  component: lazyRouteComponent(
    () => import("./pages/vestuario/VestuarioPage"),
    "VestuarioPage",
  ),
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
  component: lazyRouteComponent(
    () => import("./pages/pizarra/PizarraRoute"),
    "PizarraRoute",
  ),
});
const routeTree = rootRoute.addChildren([
  invitationRoute,
  fixturesRoute,
  clubRoute,
  vestuarioRoute,
  pizarraRoute,
  matchesRoute,
  statsRoute,
  plantillaRoute,
  profileRoute,
  adminRoute.addChildren([
    adminIndexRoute,
    adminPartidosRoute.addChildren([adminPartidoRoute]),
    adminEnJuegoRoute,
    adminConvocarRoute,
    adminConvocatoriasRoute,
    adminFichasRoute,
    adminPlantillaRoute,
    adminTemporadasRoute,
    adminCapitanesRoute,
    adminContenidoRoute,
  ]),
  matchDetailRoute,
  playerProfileRoute,
]);

// One router per app instance: the browser has one, the server render makes one per request.
export const createAppRouter = (history?: RouterHistory) =>
  createRouter({
    routeTree,
    history,
    defaultPreload: "intent",
    scrollRestoration: true,
    // Per-route boundaries (Phase 4). defaultPendingComponent only fires for routes
    // WITH a loader (the detail routes; list routes are realtime, so they handle
    // their own component-level loading) and only after defaultPendingMs (1000ms)
    // for at least defaultPendingMinMs (500ms). defaultErrorComponent gives every
    // route an error boundary so a loader/render failure never blanks the screen.
    defaultPendingComponent: RoutePending,
    defaultErrorComponent: RouteError,
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
