import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Navigate,
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

// Admin route's `validateSearch`: same pattern for the admin tab. (The role
// guard is unchanged — it lives in RootLayout.) Invalid `tab` → "matches".
export const adminSearchSchema = z.object({
  tab: z
    .enum(["matches", "roster", "seasons", "admins"])
    .default("matches")
    .catch("matches"),
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
  component: lazyRouteComponent(() => import("./pages/Profile"), "Profile"),
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  validateSearch: adminSearchSchema,
  component: lazyRouteComponent(
    () => import("./pages/admin/AdminHub"),
    "AdminHub",
  ),
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
const contentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/contenido",
  component: lazyRouteComponent(
    () => import("./pages/admin/ContentEditor"),
    "ContentEditor",
  ),
});
const routeTree = rootRoute.addChildren([
  invitationRoute,
  fixturesRoute,
  clubRoute,
  vestuarioRoute,
  pizarraRoute,
  contentRoute,
  matchesRoute,
  statsRoute,
  plantillaRoute,
  profileRoute,
  adminRoute,
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
