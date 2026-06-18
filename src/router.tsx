import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { z } from "zod";
import { RootLayout } from "./RootLayout";

// Shared so the Plantilla page can reuse it for typed `getRouteApi` search.
// Invalid `mode` falls back to "expedientes" (via .catch), preserving the
// old localStorage-default behavior.
export const plantillaSearchSchema = z.object({
  mode: z.enum(["expedientes", "pizarra"]).default("expedientes").catch("expedientes"),
});

const rootRoute = createRootRoute({ component: RootLayout });

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
