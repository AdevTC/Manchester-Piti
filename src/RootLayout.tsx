import { lazy, Suspense, useEffect } from "react";
import { Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Navbar } from "./components/Navbar";
import { SeasonUrlSync } from "./components/SeasonUrlSync";
import { useAuth } from "./context/AuthContext";
import { useTeam } from "./context/TeamContext";
import { Crest } from "./components/Crest";
import { RoutePending } from "./components/route-states";
import { StateScreen } from "./components/celeste/StatePanel";
import { useWelcome } from "./lib/doorWelcome";
import { useRecordTrail } from "./lib/backTrail";
import { under } from "./lib/paths";
import { viewerOf } from "./hooks/useViewer";
import { publishViewer } from "./hooks/viewerSignal";
import "./styles/club.css";
// Only private pages (and invitation links) show the door: keep it out of the entry chunk.
const AccessGate = lazy(() => import("./pages/acceso/AccessGate").then((m) => ({ default: m.AccessGate })));
// The live island (a pill while a match is on) loads apart from the entry: it renders nothing otherwise.
const LiveIsland = lazy(() => import("./components/celeste/LiveIsland").then((m) => ({ default: m.LiveIsland })));
export function RootLayout() {
  const { profile, loading } = useAuth();
  const { member, ready } = useTeam();
  // The chrome's bell (NoticesGate) learns who is looking from here, after the first paint.
  const { member: inside, admin: captain, playerId } = viewerOf(member, profile);
  useEffect(() => publishViewer({ member: inside, admin: captain, playerId }), [inside, captain, playerId]);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The 404 (the catch-all route, or a notFound() thrown by a route) brings the Celeste chrome.
  const lost = useRouterState({ select: (s) => s.matches.some((m) => m.routeId === "/$" || m.status === "notFound") });
  // Every page the app shows, by history entry: «Volver» knows whether the one behind is ours.
  useRecordTrail();
  const privatePage = ["/admin", "/profile", "/pizarra", "/vestuario"].some((p) => under(pathname, p));
  const adminPath = under(pathname, "/admin");
  // La mesa is the live match itself: the island would sit on its scoreboard.
  const mesaPath = /^\/matches\/[^/]+\/mesa\/?$/.test(pathname);
  // (the pizarra has its own live plate and the mesa's pitch: the island covered its header)
  const pizarraPath = /^\/pizarra\/?$/.test(pathname);
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
  // While the session is being checked, /admin shows no site chrome either (no flash of the old menu).
  const adminApp = adminPath && (checking || (!door && admin));
  // A member who is not a captain, on /admin: a Celeste page that sends him back to the vestuario.
  const adminDoor = adminPath && !checking && !door && !admin;
  const immersive = adminApp || adminDoor || lost || pathname === "/" || pathname === "/plantilla" || pathname === "/partidos" || pathname === "/stats" || pathname === "/club" || pathname.startsWith("/matches/") || pathname.startsWith("/jugadores/") || ((pathname === "/vestuario" || pathname === "/pizarra" || pathname === "/profile") && (checking || (member && !!profile))) || ((privatePage || invitation) && !checking && door);
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
      {!adminPath && !mesaPath && !pizarraPath && (
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
        ) : adminDoor ? (
          <StateScreen
            kind="empty"
            icon="crown"
            kicker="Sala de control · capitanes"
            sub="Sala de control"
            title="Solo para la capitanía"
            body="Aquí se cuecen las convocatorias y las actas, y el brazalete no es tuyo (de momento). Lo tuyo te espera en el vestuario."
            action={
              <Link className="sp-btn" to="/vestuario">
                Volver al vestuario
              </Link>
            }
          />
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
