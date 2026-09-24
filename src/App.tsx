import { RouterProvider } from "@tanstack/react-router";
import { AuthProvider } from "./context/AuthContext";
import { TeamProvider } from "./context/TeamContext";
import { SeasonProvider } from "./context/SeasonContext";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { router } from "./router";
export default function App() {
  return (
    <AuthProvider>
      <TeamProvider>
        <SeasonProvider>
          <TooltipProvider delayDuration={300}>
            <RouterProvider router={router} />
            <Toaster />
          </TooltipProvider>
        </SeasonProvider>
      </TeamProvider>
    </AuthProvider>
  );
}
