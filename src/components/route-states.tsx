import React from "react";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { Button } from "./ui/button";

/**
 * Sober, on-brand route-level pending/error states (issue #5, Phase 4).
 *
 * - Skeletons render while a route's `loader` is pending (after the router's
 *   `defaultPendingMs`, for at least `defaultPendingMinMs`). Only the detail
 *   routes have loaders, so only they actually trigger a route pendingComponent;
 *   the list routes are realtime and handle their own component-level loading.
 * - The error boundary catches loader/render errors per route so a failure shows
 *   a recoverable card instead of a blank screen. `router.invalidate()` re-runs
 *   the loader and resets the boundary (the canonical TanStack retry pattern).
 *
 * Everything below uses the shadcn semantic tokens (bg-muted/border/etc.) which
 * are bridged to the brand --mp-* palette, so they follow the [data-theme] toggle.
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
 */
export const RouteError: React.FC<ErrorComponentProps<unknown>> = ({ error, reset }) => {
  const router = useRouter();
  // A loader/beforeLoad can `throw` a non-Error (e.g. a string), which reaches the
  // boundary as `unknown`; String(error) keeps the technical detail useful for debug.
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div
      role="alert"
      className="mx-auto mt-10 w-full max-w-[560px] px-4 text-center"
    >
      <div className="rounded-[14px] border border-dashed border-border bg-card px-6 py-12">
        <AlertTriangle className="mx-auto mb-4 size-7 text-destructive" aria-hidden="true" />
        <h2 className="font-display text-lg font-extrabold tracking-wide text-foreground">
          Algo ha fallado
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          No hemos podido cargar esta sección. Vuelve a intentarlo en un momento.
        </p>
        <p className="mx-auto mt-3 max-w-sm break-words text-xs text-muted-foreground/70">
          {message}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-6"
          onClick={() => {
            // Re-run the loader, then reset the boundary so the route re-renders.
            void router.invalidate();
            reset();
          }}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Reintentar
        </Button>
      </div>
    </div>
  );
};
