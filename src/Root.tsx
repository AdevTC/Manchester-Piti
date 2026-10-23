// The whole tree, the same for the server render (entry-server.tsx) and the browser (main.tsx): React takes a
// server-rendered page over only if both build exactly this.
import { StrictMode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import App from "./App";
import type { createAppRouter } from "./router";

export function Root({ router, client }: { router: ReturnType<typeof createAppRouter>; client: QueryClient }) {
  return (
    <StrictMode>
      <QueryClientProvider client={client}>
        {/* (motion is only the admin's, whose layout sets reducedMotion itself: none of it ships with the public pages) */}
        <App router={router} />
      </QueryClientProvider>
    </StrictMode>
  );
}
