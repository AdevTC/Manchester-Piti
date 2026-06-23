import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Navigate,
} from "@tanstack/react-router";
import { z } from "zod";
import { RootLayout } from "./RootLayout";
import { queryClient } from "./lib/queryClient";
import { matchDetailQuery, playerDetailQuery, playersNameMapQuery } from "./lib/detailQueries";
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
  mode: z.enum(["expedientes", "pizarra"]).default("expedientes").catch("expedientes"),
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
});

// Admin route's `validateSearch`: same pattern for the admin tab. (The role
// guard is unchanged — it lives in RootLayout.) Invalid `tab` → "matches".
export const adminSearchSchema = z.object({
  tab: z.enum(["matches", "roster", "seasons", "admins"]).default("matches").catch("matches"),
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
  component: lazyRouteComponent(() => import("./pages/MatchCenter"), "MatchCenter"),
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stats",
  validateSearch: statsSearchSchema,
  component: lazyRouteComponent(() => import("./pages/Stats"), "Stats"),
});

const plantillaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/plantilla",
  validateSearch: plantillaSearchSchema,
  component: lazyRouteComponent(() => import("./pages/Plantilla"), "Plantilla"),
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
  component: lazyRouteComponent(() => import("./pages/Admin"), "Admin"),
});

// Deep, one-shot detail routes. The `loader` prefetches via
// queryClient.ensureQueryData (warmed by hover-intent thanks to
// defaultPreload:"intent"); the page reads the SAME queryKey with useQuery, so
// it hits the hot cache with no second fetch. These by-id reads are genuinely
// one-shot (getDoc), unlike the realtime onSnapshot pages — left untouched.
const matchDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/matches/$matchId",
  // Warm BOTH the match doc and the players name map so a deep-link arrives with
  // the event labels already hot (the page reads the same queryKeys via useQuery
  // → no second fetch on mount). Promise.all keeps the two reads concurrent.
  loader: ({ params }) =>
    Promise.all([
      queryClient.ensureQueryData(matchDetailQuery(params.matchId)),
      queryClient.ensureQueryData(playersNameMapQuery),
    ]),
  pendingComponent: MatchDetailPending,
  component: lazyRouteComponent(() => import("./pages/MatchDetail"), "MatchDetail"),
});

const playerProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/jugadores/$playerId",
  loader: ({ params }) => queryClient.ensureQueryData(playerDetailQuery(params.playerId)),
  pendingComponent: PlayerProfilePending,
  component: lazyRouteComponent(() => import("./pages/PlayerProfile"), "PlayerProfile"),
});

const routeTree = rootRoute.addChildren([
  matchesRoute,
  statsRoute,
  plantillaRoute,
  profileRoute,
  adminRoute,
  matchDetailRoute,
  playerProfileRoute,
]);

export const router = createRouter({
  routeTree,
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
    router: typeof router;
  }
}
