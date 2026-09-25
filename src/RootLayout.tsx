import { lazy, Suspense } from "react";
import { Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Navbar } from "./components/Navbar";
import { SeasonUrlSync } from "./components/SeasonUrlSync";
import { useAuth } from "./context/AuthContext";
import { useTeam } from "./context/TeamContext";
import { Crest } from "./components/Crest";
import { RoutePending } from "./components/route-states";
import "./styles/club.css";
import "./styles/analytics.css";
// Only private pages show the gate and the nickname step: keep them out of the entry chunk.
const TeamGate = lazy(() => import("./pages/Vestuario").then((m) => ({ default: m.TeamGate })));
const NicknameSetup = lazy(() => import("./pages/NicknameSetup").then((m) => ({ default: m.NicknameSetup })));
export function RootLayout() {
  const { profile, loading } = useAuth();
  const { member, ready } = useTeam();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const privatePage = ["/admin", "/profile", "/pizarra", "/vestuario"].some(
    (p) => pathname.startsWith(p),
  );
  const admin = profile?.role === "admin" || profile?.role === "superadmin";
  // Celeste pages (home, plantilla, vestuario) bring their own header, dock and footer: hide the site chrome there.
  // While the session is being restored, private pages wait on a neutral skeleton (no gate flash).
  const checking = privatePage && (!ready || (member && loading));
  const immersive = pathname === "/" || pathname === "/plantilla" || (pathname === "/vestuario" && (checking || (member && !!profile)));
  return (
    <div className="club-app">
      {import.meta.env.VITE_USE_FIREBASE_EMULATOR === "1" && (
        <div className="club-demo-banner">
          ENTORNO LOCAL DE PRUEBAS · DATOS FICTICIOS
        </div>
      )}
      <a className="club-skip" href="#contenido">
        Saltar al contenido
      </a>
      {!immersive && <Navbar />}
      <SeasonUrlSync />
      <main id="contenido" className={immersive ? "club-main vx-main-shell" : "club-main"}>
        {checking ? (
          <RoutePending />
        ) : privatePage && !member ? (
          <Suspense fallback={null}>
            <TeamGate />
          </Suspense>
        ) : privatePage && !profile ? (
          <Suspense fallback={null}>
            <NicknameSetup />
          </Suspense>
        ) : pathname.startsWith("/admin") && !admin ? (
          <div className="club-empty">
            <h1>Solo para administradores</h1>
            <Link to="/vestuario">Volver al vestuario</Link>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      {!immersive && (
      <footer className="club-footer">
        <div className="club-footer-brand">
          <Crest size={44} />
          <span>
            MANCHESTER PITI<small>Equipo amateur de fútbol 7</small>
          </span>
        </div>
        <div>
          <Link to="/club">El club</Link>
          <Link to="/partidos">Partidos</Link>
          <Link to="/vestuario">Vestuario</Link>
        </div>
        <p>
          Hecho por y para el equipo.
          <br />© {new Date().getFullYear()} Manchester Piti
          <br />
          {/* CC BY 4.0 requires crediting the 3D kit model used in the vestuario. */}
          Camiseta 3D basada en{" "}
          <a href="https://sketchfab.com/3d-models/football-jersey-style-design-d00dffa54c5b49b2941e0a34995f914e" target="_blank" rel="noopener noreferrer">
            «Football Jersey Style Design»
          </a>{" "}
          de Wearable3D · CC BY 4.0
        </p>
      </footer>
      )}
    </div>
  );
}
