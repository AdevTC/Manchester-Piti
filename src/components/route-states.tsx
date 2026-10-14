import React, { useEffect } from "react";
import { Link, useRouter, useRouterState, type ErrorComponentProps } from "@tanstack/react-router";
import { Skeleton } from "./ui/skeleton";
import { StatePanel, StateScreen } from "./celeste/StatePanel";
import { sectionOf } from "./celeste/sectionOf";
import { under } from "../lib/paths";

/**
 * Sober, on-brand route-level pending/error states (issue #5, Phase 4).
 *
 * - Skeletons render while a route's `loader` is pending (after the router's
 *   `defaultPendingMs`, for at least `defaultPendingMinMs`). Only the detail
 *   routes have loaders, so only they actually trigger a route pendingComponent;
 *   the list routes are realtime and handle their own component-level loading.
 * - The error boundary catches loader/render errors per route so a failure shows
 *   a recoverable Celeste panel (with the site chrome) instead of a blank screen.
 *   `router.invalidate()` re-runs the loader and resets the boundary (the canonical
 *   TanStack retry pattern). RouteNotFound is the 404 («Fuera de juego»).
 *
 * The skeletons use the shadcn semantic tokens (bg-muted/border/etc.) which are
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

/** Ficha skeleton for /matches/$matchId — mirrors the MatchDetail header + list. */
export const MatchDetailPending: React.FC = () => (
  <div className="mx-auto w-full max-w-[760px] px-4 pb-12 pt-6" role="status" aria-busy="true">
    <span className="sr-only">Cargando partido…</span>
    <Skeleton className="h-4 w-36" />
    {/* Structure mirrors MatchDetail's header + events list — keep in sync if its layout changes */}
    <Skeleton className="mt-4 h-48 w-full rounded-[14px]" />
    <div className="mt-6 space-y-3">
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
    </div>
  </div>
);

/** Ficha skeleton for /jugadores/$playerId — mirrors the PlayerProfile card. */
export const PlayerProfilePending: React.FC = () => (
  <div className="mx-auto w-full max-w-[620px] px-4 pb-12 pt-6" role="status" aria-busy="true">
    <span className="sr-only">Cargando jugador…</span>
    <Skeleton className="h-4 w-40" />
    {/* Structure mirrors PlayerProfile's main card — keep in sync if its layout changes */}
    <div className="mt-4 overflow-hidden rounded-[14px] border border-border bg-card">
      <div className="flex items-center gap-5 border-b border-border p-6">
        <Skeleton className="h-20 w-16 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-28" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        </div>
      </div>
      <div className="space-y-3 px-6 py-5">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
      </div>
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

/** While mounted, tells crawlers not to index the page (the 404 is served with a 200 by the SPA shell);
 *  the previous robots value, or none, comes back on unmount. */
function useNoIndex() {
  useEffect(() => {
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const before = meta?.getAttribute("content") ?? null;
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex";
    return () => {
      if (created) meta.remove();
      else if (before === null) meta.removeAttribute("content");
      else meta.content = before;
    };
  }, []);
}

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
