// Shared "Celeste" chrome: the header, mobile dock and footer of the redesigned pages
// (home and vestuario), so both read as the same web.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Icon, type IconName } from "./icons";
import "../../styles/vestuario.css";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Anybody:wdth,wght@50..150,300..900&family=Geist:wght@300..800&family=Geist+Mono:wght@400..600&display=swap";

export type CelestePage = "inicio" | "partidos" | "plantilla" | "stats" | "club" | "vestuario";
const NAV: { key: CelestePage; to: string; label: string }[] = [
  { key: "inicio", to: "/", label: "Inicio" },
  { key: "partidos", to: "/partidos", label: "Partidos" },
  { key: "plantilla", to: "/plantilla", label: "Plantilla" },
  { key: "stats", to: "/stats", label: "Estadísticas" },
  { key: "club", to: "/club", label: "El club" },
  { key: "vestuario", to: "/vestuario", label: "Vestuario" },
];
const DOCK: { key: CelestePage; to: string; label: string; icon: IconName }[] = [
  { key: "inicio", to: "/", label: "Inicio", icon: "home" },
  { key: "partidos", to: "/partidos", label: "Partidos", icon: "cal" },
  { key: "vestuario", to: "/vestuario", label: "Vestuario", icon: "padlock" },
  { key: "stats", to: "/stats", label: "Estadísticas", icon: "stats" },
  { key: "plantilla", to: "/plantilla", label: "Plantilla", icon: "team" },
];

/** Page fonts + film grain, once per Celeste page. */
export function CelesteBackdrop() {
  return (
    <>
      <link rel="stylesheet" href={FONTS} precedence="default" />
      <svg className="vx-grain" width="100%" height="100%" aria-hidden="true">
        <filter id="vx-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#vx-grain)" />
      </svg>
    </>
  );
}

export function CelesteHeader({ active, sub, actions }: { active: CelestePage; sub: string; actions: ReactNode }) {
  return (
    <header className="vx-top">
      <Link className="vx-brand" to="/">
        <img src="/crest-128.webp" alt="Escudo del Manchester Piti" />
        <span className="vx-brand-name">Manchester Piti</span>
        <span className="vx-brand-sub">{sub}</span>
      </Link>
      <nav className="vx-nav" aria-label="Navegación principal">
        <div className="vx-nav-in">
          {NAV.map((n) => (
            <Link key={n.key} to={n.to} className={n.key === active ? "on" : undefined} aria-current={n.key === active ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="vx-actions">{actions}</div>
    </header>
  );
}

export function CelesteDock({ active }: { active: CelestePage }) {
  return (
    <nav className="vx-dock" aria-label="Navegación móvil">
      {DOCK.map((d) =>
        d.key === active ? (
          <Link key={d.key} to={d.to} className="on" aria-current="page">
            <img src="/crest-128.webp" alt="" />
            <span className="lbl">{d.label}</span>
          </Link>
        ) : (
          <Link key={d.key} to={d.to} aria-label={d.label}>
            <Icon name={d.icon} size={21} />
          </Link>
        ),
      )}
    </nav>
  );
}

export function CelesteFooter() {
  return (
    <footer className="vx-foot">
      <span className="b">
        <img src="/crest-128.webp" alt="" />
        Manchester Piti
      </span>
      <nav aria-label="Pie de página">
        <Link to="/partidos">Partidos</Link>
        <Link to="/plantilla">Plantilla</Link>
        <Link to="/stats">Estadísticas</Link>
        <Link to="/club">El club</Link>
        <Link to="/vestuario">Vestuario</Link>
      </nav>
      <small>
        Hecho por y para el equipo · © {new Date().getFullYear()} Manchester Piti
        <br />
        {/* CC BY 4.0 requires crediting the 3D kit model. */}
        Camiseta 3D basada en{" "}
        <a href="https://sketchfab.com/3d-models/football-jersey-style-design-d00dffa54c5b49b2941e0a34995f914e" target="_blank" rel="noopener noreferrer">
          «Football Jersey Style Design»
        </a>{" "}
        de Wearable3D · CC BY 4.0
      </small>
    </footer>
  );
}
