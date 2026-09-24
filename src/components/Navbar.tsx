import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Home,
  CalendarDays,
  Users,
  ChartNoAxesColumnIncreasing,
  LockKeyhole,
} from "lucide-react";
import { Crest } from "./Crest";
import { ThemeToggle } from "./ThemeToggle";
const links = [
  { to: "/", name: "Inicio", icon: Home },
  { to: "/partidos", name: "Partidos", icon: CalendarDays },
  { to: "/plantilla", name: "Plantilla", icon: Users },
  { to: "/stats", name: "Estadísticas", icon: ChartNoAxesColumnIncreasing },
] as const;
export function Navbar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <>
      <div className="club-topline">
        <span>MANCHESTER PITI · FÚTBOL 7</span>
        <Link to="/club">
          Conoce nuestra historia <ArrowUpRight size={12} />
        </Link>
      </div>
      <header className="club-nav">
        <Link
          to="/"
          className="club-wordmark"
          aria-label="Manchester Piti, inicio"
        >
          <Crest size={49} />
          <span>
            MANCHESTER
            <b>
              PITI<span className="club-wordmark-dot">.</span>
            </b>
          </span>
        </Link>
        <nav className="club-nav-links" aria-label="Navegación principal">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              search={{}}
              className={
                path === l.to ||
                (l.to === "/partidos" && path.startsWith("/matches/"))
                  ? "active"
                  : ""
              }
            >
              {l.name}
            </Link>
          ))}
          <Link to="/club" className={path === "/club" ? "active" : ""}>
            El club
          </Link>
        </nav>
        <div className="club-nav-actions">
          <ThemeToggle />
          <Link className="club-lock-link" to="/vestuario">
            <LockKeyhole size={15} />
            <span>Vestuario</span>
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
      <nav className="club-mobile-nav" aria-label="Navegación móvil">
        {[
          ...links,
          { to: "/vestuario" as const, name: "Vestuario", icon: LockKeyhole },
        ].map((l) => (
          <Link
            key={l.to}
            to={l.to}
            search={{}}
            className={path === l.to ? "active" : ""}
          >
            <l.icon size={20} />
            <span>{l.name === "Estadísticas" ? "Datos" : l.name}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
