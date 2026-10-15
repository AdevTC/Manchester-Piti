import React from "react";
import { Link, useRouter, useRouterState, type ErrorComponentProps } from "@tanstack/react-router";
import { Skeleton } from "./ui/skeleton";
import { StatePanel, StateScreen } from "./celeste/StatePanel";
import { sectionOf } from "./celeste/sectionOf";
import { under } from "../lib/paths";
import { useNoIndex } from "../hooks/useNoIndex";

/**
 * Sober, on-brand route-level pending/error states (issue #5, Phase 4).
 *
 * - The skeleton renders while a route is pending (after the router's
 *   `defaultPendingMs`, for at least `defaultPendingMinMs`): no route has a loader,
 *   so that is a page's code arriving late; RootLayout also shows it while a private
 *   page checks the session. The pages are realtime and handle their own loading.
 * - The error boundary catches loader/render errors per route so a failure shows
 *   a recoverable Celeste panel (with the site chrome) instead of a blank screen.
 *   `router.invalidate()` re-runs the loader and resets the boundary (the canonical
 *   TanStack retry pattern). RouteNotFound is the 404 («Fuera de juego»).
 *
 * The skeleton uses the shadcn semantic tokens (bg-muted/border/etc.) which are
 * bridged to the brand --mp-* palette, so they follow the [data-theme] toggle.
 */

/** Generic, minimal page skeleton used as the router's defaultPendingComponent. */
export const RoutePending: React.FC = () => (
  <div className="mx-auto w-full max-w-3xl px-4 py-6" role="status" aria-busy="true">
    <span className="sr-only">Cargando…</span>
    <Skeleton className="h-4 w-32" />
    <Skeleton className="mt-6 h-40 w-full rounded-xl" />
    <div className="mt-6 space-y-3">
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  </div>
);

/**
 * Recoverable error boundary used as the router's defaultErrorComponent (and any
 * per-route errorComponent). `reset` is provided by the boundary; we also call
 * `router.invalidate()` so the route's loader re-runs on retry.
 *
 * The page that failed brought its own chrome, so the error brings the Celeste one
 * (header, footer, dock) and is never a dead end. Inside the admin app (its own
 * frame) it is the panel alone.
 */
export const RouteError: React.FC<ErrorComponentProps<unknown>> = ({ error, reset }) => {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // A loader/beforeLoad can `throw` a non-Error (e.g. a string), which reaches the
  // boundary as `unknown`; String(error) keeps the technical detail useful for debug.
  const message = error instanceof Error ? error.message : String(error);
  // (inside the admin app the way out is its own start, Hoy)
  const inAdmin = under(pathname, "/admin");
  const panel = {
    kind: "error" as const,
    title: "Algo se ha torcido",
    body: "No hemos podido cargar esta parte. Puede ser la conexión: dale otra vez en un momento.",
    detail: message,
    action: (
      <>
        <button
          type="button"
          className="sp-btn"
          onClick={() => {
            // Re-run the loader, then reset the boundary so the route re-renders.
            void router.invalidate();
            reset();
          }}
        >
          Reintentar
        </button>
        {inAdmin ? (
          <Link className="sp-btn ghost" to="/admin">
            Ir a Hoy
          </Link>
        ) : (
          <Link className="sp-btn ghost" to="/">
            Ir al inicio
          </Link>
        )}
      </>
    ),
  };
  // (its own .vx: styled the same whether the admin's frame is around it or the frame itself failed)
  if (inAdmin)
    return (
      <div className="vx sp-inframe">
        <StatePanel {...panel} />
      </div>
    );
  return <StateScreen {...sectionOf(pathname)} {...panel} />;
};

/** An address the app does not have (the catch-all route, and the router's notFoundComponent). */
export const RouteNotFound: React.FC = () => {
  useNoIndex();
  return (
    <StateScreen
      kind="notfound"
      sub="Manchester Piti"
      ghost="404"
      title="Fuera de juego"
      body="Esta jugada no existe: el enlace se ha quedado en posición adelantada. Vuelve a ponerte en juego desde el inicio o mira los partidos."
      action={
        <>
          <Link className="sp-btn" to="/">
            Ir al inicio
          </Link>
          <Link className="sp-btn ghost" to="/partidos">
            Ver los partidos
          </Link>
        </>
      }
    />
  );
};

/** An address under /admin the Sala de control does not have: the 404 inside its own frame (its rail
 *  and header stay, the way out is its own start, Hoy). Members and fans never get here: RootLayout
 *  answers /admin/* first (the capitanía panel, the door). */
export const AdminRouteNotFound: React.FC = () => {
  useNoIndex();
  return (
    <div className="vx sp-inframe">
      <StatePanel
        kind="notfound"
        heading="h1"
        title="Esta sección no existe"
        body="En la Sala de control no hay nada en esta dirección: puede que el enlace sea viejo o lleve una errata."
        action={
          <Link className="sp-btn" to="/admin">
            Ir a Hoy
          </Link>
        }
      />
    </div>
  );
};
