import { RouterProvider } from "@tanstack/react-router";
import { AuthProvider } from "./context/AuthContext";
import { TeamProvider } from "./context/TeamContext";
import { SeasonProvider } from "./context/SeasonContext";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
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
          <TooltipProvider delayDuration={300}>
            <RouterProvider router={router} />
            <Toaster />
            <UpdateNotice />
          </TooltipProvider>
        </SeasonProvider>
      </TeamProvider>
    </AuthProvider>
  );
}
