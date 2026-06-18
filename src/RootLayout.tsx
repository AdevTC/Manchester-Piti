import React from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Navbar } from "./components/Navbar";
import { useAuth } from "./context/AuthContext";

// Devtools are dev-only and lazily imported so they are stripped from the
// production bundle. The component renders null in prod (see App mount).
const TanStackRouterDevtools = import.meta.env.DEV
  ? React.lazy(() =>
      import("@tanstack/router-devtools").then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    )
  : () => null;

export const RootLayout: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";

  // Admin route guard. Role logic lives in React/Context, not the router.
  React.useEffect(() => {
    if (pathname.startsWith("/admin") && !isAdmin) {
      void navigate({ to: "/profile", replace: true });
    }
  }, [pathname, isAdmin, navigate]);

  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
      {import.meta.env.DEV && (
        <React.Suspense fallback={null}>
          <TanStackRouterDevtools />
        </React.Suspense>
      )}
    </div>
  );
};
