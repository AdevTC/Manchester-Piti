import { RouterProvider } from "@tanstack/react-router";
import { AuthProvider } from "./context/AuthContext";
import { TeamProvider } from "./context/TeamContext";
import { SeasonProvider } from "./context/SeasonContext";
import { Toaster } from "./components/ui/toast";
import { UpdateNotice } from "./components/vidrio/UpdateNotice";
import { usePushKeepAlive } from "./hooks/usePushKeepAlive";
import type { createAppRouter } from "./router";

/** Keeps this device's push subscription alive (lost or renewed ones are re-asserted on boot). */
function PushKeepAlive() {
  usePushKeepAlive();
  return null;
}

export default function App({ router }: { router: ReturnType<typeof createAppRouter> }) {
  return (
    <AuthProvider>
      <PushKeepAlive />
      <TeamProvider>
        <SeasonProvider>
          {/* (no TooltipProvider here: each <Hint> brings its own with the tooltip, loaded on first hover) */}
          <RouterProvider router={router} />
          <Toaster />
          <UpdateNotice />
        </SeasonProvider>
      </TeamProvider>
    </AuthProvider>
  );
}
