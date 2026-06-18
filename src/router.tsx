import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Navigate,
} from "@tanstack/react-router";
import { z } from "zod";
import { RootLayout } from "./RootLayout";

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
  component: lazyRouteComponent(() => import("./pages/Admin"), "Admin"),
});

const routeTree = rootRoute.addChildren([
  matchesRoute,
  statsRoute,
  plantillaRoute,
  profileRoute,
  adminRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
