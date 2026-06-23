import type { ReactElement, ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Test-only render helpers (Phase 9). The app is Router + Query heavy, which is
 * highly testable: a fresh QueryClient (retry disabled so a mocked `onError`
 * fires immediately) + a memory RouterProvider + mocked context providers let us
 * exercise the seams the agent cannot verify in a browser (Admin form
 * validation, SeasonUrlSync, the mutation onError/isPending path).
 */

/** A QueryClient tuned for tests: no retries (a rejecting mutationFn surfaces
 *  onError at once, no backoff delays → no flakiness) and no gc churn. */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

/** Wrap arbitrary UI in a fresh QueryClientProvider. Returns the client so a
 *  test can read/seed the cache. */
export function renderWithQueryClient(
  ui: ReactElement,
  queryClient: QueryClient = makeTestQueryClient(),
): RenderResult & { queryClient: QueryClient } {
  const result = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
  return { ...result, queryClient };
}

/** A QueryClientProvider wrapper component (for `renderHook`'s `wrapper`). */
export function makeQueryWrapper(
  queryClient: QueryClient = makeTestQueryClient(),
): ({ children }: { children: ReactNode }) => ReactElement {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
