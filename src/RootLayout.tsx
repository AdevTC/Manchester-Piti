import { lazy, Suspense, useEffect } from "react";
import { Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Navbar } from "./components/Navbar";
import { SeasonUrlSync } from "./components/SeasonUrlSync";
import { InterimLanding } from "./components/InterimLanding";
import { useAuth } from "./context/AuthContext";
import { useTeam } from "./context/TeamContext";
import { Crest } from "./components/Crest";
import { RoutePending } from "./components/route-states";
import { useWelcome } from "./lib/doorWelcome";
import { useRecordTrail } from "./lib/backTrail";
import { under } from "./lib/paths";
import { viewerOf } from "./hooks/useViewer";
import { publishViewer } from "./hooks/viewerSignal";
import { publishAccount } from "./components/celeste/accountSignal";
import { useTakingOver } from "./hooks/useClock";
import "./styles/club.css";
// Only private pages (and invitation links) show the door: keep it out of the entry chunk.
const AccessGate = lazy(() => import("./pages/acceso/AccessGate").then((m) => ({ default: m.AccessGate })));
// The live score («Vidrio»: the floating score, its sheet and the goal) loads apart from the entry: it renders
// nothing outside the match day.
const LiveScore = lazy(() => import("./components/vidrio/live/LiveScore").then((m) => ({ default: m.LiveScore })));
export function RootLayout() {
  const { profile, loading } = useAuth();
  const { member, ready } = useTeam();
  // The chrome's bell (NoticesGate) learns who is looking from here, after the first paint.
  const { member: inside, admin: captain, playerId } = viewerOf(member, profile);
  useEffect(() => publishViewer({ member: inside, admin: captain, playerId }), [inside, captain, playerId]);
  // (and his name, for the top bar's avatar «J Jordi»)
  const nickname = inside ? (profile?.nickname ?? "") : "";
  useEffect(() => publishAccount(nickname ? { name: nickname } : null), [nickname]);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The 404 (the catch-all route, or a notFound() thrown by a route) brings the Celeste chrome.
  const lost = useRouterState({ select: (s) => s.matches.some((m) => m.routeId === "/$" || m.status === "notFound") });
  // Every page the app shows, by history entry: «Volver» knows whether the one behind is ours.
  useRecordTrail();
  // (Tú, /perfil and /avisos, draws its own door: the page's link works as soon as you are in, and «A medida» is a fan's too)
  const privatePage = ["/admin", "/pizarra", "/vestuario"].some((p) => under(pathname, p));
  const adminPath = under(pathname, "/admin");
  // La mesa is the live match itself: the floating score would sit on its scoreboard.
  const mesaPath = /^\/partidos\/[^/]+\/mesa\/?$/.test(pathname);
  // (the pizarra has its own live plate and the mesa's pitch: the score would cover its header)
  const pizarraPath = /^\/pizarra\/?$/.test(pathname);
  const takingOver = useTakingOver();
  const invitation = pathname.startsWith("/invitacion/");
  // The door stays up through the walkout after being let in.
  const welcome = useWelcome();
  const door = (privatePage || invitation) && (!member || !profile || !!welcome);
  // Celeste pages (home, plantilla, vestuario) bring their own header, dock and footer: hide the site chrome there.
  // While the session is being restored, private pages wait on a neutral skeleton (no gate flash).
  const checking = (privatePage || invitation) && (!ready || (member && loading));
  // The pizarra and the profile are Celeste pages too.
  // The Sala de control is its own app (its frame, its bar, its dock): no site chrome around it, and it decides who
  // looks (a member without the armband gets «Solo para la capitanía» in its frame: pages/admin/shell). Its <main>
  // is its own (one main: B-SH-04). While the session is being checked, /admin shows no site chrome either.
  const adminApp = adminPath && (checking || !door);
  const Main = adminApp && !checking ? "div" : "main";
  const immersive = adminApp || lost || pathname === "/" || pathname === "/camiseta" || ["/hoy", "/partidos", "/plantilla", "/estadisticas", "/club", "/jugadores", "/buscar", "/perfil", "/avisos"].some((p) => under(pathname, p)) || (["/vestuario", "/pizarra"].some((p) => under(pathname, p)) && (checking || (member && !!profile))) || ((privatePage || invitation) && !checking && door);
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
      <InterimLanding />
      {/* (not while React takes over a server-rendered page: the server has no copy of it to match) */}
      {!takingOver && !adminPath && !mesaPath && !pizarraPath && (
        <Suspense fallback={null}>
          <LiveScore />
        </Suspense>
      )}
      <Main {...(adminApp && !checking ? {} : { id: "contenido" })} className={immersive ? "club-main vx-main-shell" : "club-main"}>
        {checking ? (
          <RoutePending />
        ) : door ? (
          <Suspense fallback={<RoutePending />}>
            <AccessGate />
          </Suspense>
        ) : (
          <Outlet />
        )}
      </Main>
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
