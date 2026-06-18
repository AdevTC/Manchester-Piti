import React from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Navbar } from "./components/Navbar";
import { SeasonUrlSync } from "./components/SeasonUrlSync";
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
  const blockedFromAdmin = pathname.startsWith("/admin") && !isAdmin;

  // Belt-and-suspenders redirect for non-admins who deep-link /admin.
  React.useEffect(() => {
    if (blockedFromAdmin) {
      void navigate({ to: "/profile", replace: true });
    }
  }, [blockedFromAdmin, navigate]);

  // Synchronous gate: don't render <Admin/> (and start its Firestore reads)
  // for a non-admin even for a single frame; the effect above redirects.
  if (blockedFromAdmin) {
    return null;
  }

  return (
    <div className="app-container">
      <Navbar />
      <SeasonUrlSync />
      <main className="main-content">
        <React.Suspense fallback={null}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </React.Suspense>
      </main>
      {import.meta.env.DEV && (
        <React.Suspense fallback={null}>
          <TanStackRouterDevtools />
        </React.Suspense>
      )}
    </div>
  );
};
