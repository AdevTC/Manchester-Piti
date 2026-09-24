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
      <Navbar />
      <SeasonUrlSync />
      <main id="contenido" className="club-main">
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
        </p>
      </footer>
    </div>
  );
}
