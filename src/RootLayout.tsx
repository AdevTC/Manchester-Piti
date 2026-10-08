import { lazy, Suspense } from "react";
import { Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Navbar } from "./components/Navbar";
import { SeasonUrlSync } from "./components/SeasonUrlSync";
import { useAuth } from "./context/AuthContext";
import { useTeam } from "./context/TeamContext";
import { Crest } from "./components/Crest";
import { RoutePending } from "./components/route-states";
import { useWelcome } from "./lib/doorWelcome";
import "./styles/club.css";
// Only private pages (and invitation links) show the door: keep it out of the entry chunk.
const AccessGate = lazy(() => import("./pages/acceso/AccessGate").then((m) => ({ default: m.AccessGate })));
// The live island (a pill while a match is on) loads apart from the entry: it renders nothing otherwise.
const LiveIsland = lazy(() => import("./components/celeste/LiveIsland").then((m) => ({ default: m.LiveIsland })));
export function RootLayout() {
  const { profile, loading } = useAuth();
  const { member, ready } = useTeam();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const privatePage = ["/admin", "/profile", "/pizarra", "/vestuario"].some(
    (p) => pathname.startsWith(p),
  );
  const invitation = pathname.startsWith("/invitacion/");
  // The door stays up through the walkout after being let in.
  const welcome = useWelcome();
  const door = (privatePage || invitation) && (!member || !profile || !!welcome);
  const admin = profile?.role === "admin" || profile?.role === "superadmin";
  // Celeste pages (home, plantilla, vestuario) bring their own header, dock and footer: hide the site chrome there.
  // While the session is being restored, private pages wait on a neutral skeleton (no gate flash).
  const checking = (privatePage || invitation) && (!ready || (member && loading));
  // The pizarra and the profile are Celeste pages too.
  // The admin is its own app (fixed frame, slim header, own mobile bar): no site chrome around it.
  const adminApp = pathname.startsWith("/admin") && !checking && !door && admin;
  const immersive = adminApp || pathname === "/" || pathname === "/plantilla" || pathname === "/partidos" || pathname === "/stats" || pathname === "/club" || pathname.startsWith("/matches/") || pathname.startsWith("/jugadores/") || ((pathname === "/vestuario" || pathname === "/pizarra" || pathname === "/profile") && (checking || (member && !!profile))) || ((privatePage || invitation) && !checking && door);
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
      {!pathname.startsWith("/admin") && (
        <Suspense fallback={null}>
          <LiveIsland />
        </Suspense>
      )}
      <main id="contenido" className={immersive ? "club-main vx-main-shell" : "club-main"}>
        {checking ? (
          <RoutePending />
        ) : door ? (
          <Suspense fallback={<RoutePending />}>
            <AccessGate />
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
