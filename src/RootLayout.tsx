import { Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Navbar } from "./components/Navbar";
import { SeasonUrlSync } from "./components/SeasonUrlSync";
import { useAuth } from "./context/AuthContext";
import { useTeam } from "./context/TeamContext";
import { TeamGate } from "./pages/Vestuario";
import { NicknameSetup } from "./pages/NicknameSetup";
import { Crest } from "./components/Crest";
import "./styles/club.css";
import "./styles/analytics.css";
export function RootLayout() {
  const { profile } = useAuth();
  const { member } = useTeam();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const privatePage = ["/admin", "/profile", "/pizarra", "/vestuario"].some(
    (p) => pathname.startsWith(p),
  );
  const admin = profile?.role === "admin" || profile?.role === "superadmin";
  // Celeste pages (home, vestuario) bring their own header, dock and footer: hide the site chrome there.
  const immersive = pathname === "/" || (pathname === "/vestuario" && member && !!profile);
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
        {privatePage && !member ? (
          <TeamGate />
        ) : privatePage && !profile ? (
          <NicknameSetup />
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
