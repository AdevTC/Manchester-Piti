import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSeason } from "../context/SeasonContext";
import {
  Calendar,
  Trophy,
  Users,
  User as UserIcon,
  ShieldAlert,
  LogOut,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Crest } from "./Crest";
import "./Navbar.css";

interface NavbarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  short: string;
  Icon: LucideIcon;
  admin?: boolean;
}

const BASE_NAV: NavItem[] = [
  { id: "matches", label: "Partidos", short: "Partidos", Icon: Calendar },
  { id: "stats", label: "Estadísticas", short: "Stats", Icon: Trophy },
  { id: "plantilla", label: "Plantilla", short: "Plantilla", Icon: Users },
  { id: "profile", label: "Mi Perfil", short: "Perfil", Icon: UserIcon },
];

const ADMIN_ITEM: NavItem = { id: "admin", label: "Admin", short: "Admin", Icon: ShieldAlert, admin: true };

export const Navbar: React.FC<NavbarProps> = ({ currentPage, setCurrentPage }) => {
  const { profile, logout } = useAuth();
  const { seasons, selectedSeasonId, setSelectedSeasonId, loadingSeasons } = useSeason();

  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const navItems = isAdmin ? [...BASE_NAV, ADMIN_ITEM] : BASE_NAV;

  const handleNavClick = (page: string) => {
    setCurrentPage(page);
    window.location.hash = page;
  };

  // ---- Sliding indicator on the desktop rail ----
  const railRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [ink, setInk] = useState<{ x: number; w: number }>({ x: 0, w: 0 });

  const activeIsAdmin = navItems.find((n) => n.id === currentPage)?.admin ?? false;

  useLayoutEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const el = tabRefs.current[currentPage];
      if (el) setInk({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    // Anton loads after first paint and changes tab widths; re-measure once
    // the webfonts settle so the indicator lands on the right tab from a cold cache.
    if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {});
    return () => {
      cancelled = true;
      window.removeEventListener("resize", measure);
    };
  }, [currentPage, isAdmin]);

  // ---- Custom season selector ----
  const [seasonOpen, setSeasonOpen] = useState(false);
  const seasonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!seasonOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (seasonRef.current && !seasonRef.current.contains(e.target as Node)) setSeasonOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSeasonOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [seasonOpen]);

  const seasonOptions = [{ id: "all", name: "Histórico Total" }, ...seasons];
  const currentSeasonName =
    selectedSeasonId === "all"
      ? "Histórico Total"
      : seasons.find((s) => s.id === selectedSeasonId)?.name ?? "Histórico Total";

  const pickSeason = (id: string) => {
    setSelectedSeasonId(id);
    setSeasonOpen(false);
  };

  const roleLabel =
    profile?.role === "superadmin" ? "Super Admin" : profile?.role === "admin" ? "Administrador" : "Jugador";

  return (
    <>
      {/* ---------- Top gantry ---------- */}
      <header className="mp-gantry">
        <div className="mp-gantry-inner">
          <button type="button" className="mp-gantry-brand" onClick={() => handleNavClick("matches")}>
            <Crest className="mp-crest" size={40} />
            <span className="mp-gantry-word">
              Manchester <i>Piti</i>
            </span>
          </button>

          {/* Desktop tab rail */}
          <nav className="mp-rail mp-gantry-desktop" ref={railRef} aria-label="Navegación principal">
            {navItems.map((item) => (
              <button
                key={item.id}
                ref={(el) => {
                  tabRefs.current[item.id] = el;
                }}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`mp-tab${currentPage === item.id ? " is-active" : ""}${item.admin ? " is-admin" : ""}`}
                aria-current={currentPage === item.id ? "page" : undefined}
              >
                {item.label}
              </button>
            ))}
            <span
              className={`mp-rail-ink${activeIsAdmin ? " is-admin" : ""}`}
              style={{ transform: `translateX(${ink.x}px)`, width: ink.w }}
              aria-hidden="true"
            />
          </nav>

          {/* Right cluster */}
          <div className="mp-gantry-actions">
            <div className="mp-season" ref={seasonRef}>
              {loadingSeasons ? (
                <span className="mp-season-loading">Cargando...</span>
              ) : (
                <>
                  <button
                    type="button"
                    className="mp-season-btn"
                    onClick={() => setSeasonOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={seasonOpen}
                    aria-label={`Temporada: ${currentSeasonName}. Cambiar.`}
                  >
                    <span className="mp-season-text">
                      <span className="mp-season-cap">Temporada</span>
                      <span className="mp-season-val">{currentSeasonName}</span>
                    </span>
                    <ChevronDown className="mp-season-chev" size={16} aria-hidden="true" />
                  </button>
                  {seasonOpen && (
                    <ul className="mp-season-menu" role="listbox" aria-label="Seleccionar temporada">
                      {seasonOptions.map((opt) => (
                        <li key={opt.id} role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={selectedSeasonId === opt.id}
                            className={`mp-season-opt${selectedSeasonId === opt.id ? " is-active" : ""}`}
                            onClick={() => pickSeason(opt.id)}
                          >
                            <span>{opt.name}</span>
                            <span className="mp-season-opt-dot" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <ThemeToggle className="mp-gantry-toggle" />

            {profile && (
              <div className="mp-user">
                <div className="mp-user-meta mp-gantry-desktop">
                  <div className="mp-user-nick">@{profile.nickname}</div>
                  <div className="mp-user-role">{roleLabel}</div>
                </div>
                <button type="button" className="mp-user-out" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ---------- Mobile bottom rail ---------- */}
      <nav className="mp-tabbar mp-gantry-mobile" aria-label="Navegación principal">
        {navItems.map((item) => {
          const Icon = item.Icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`mp-tabb${currentPage === item.id ? " is-active" : ""}${item.admin ? " is-admin" : ""}`}
              aria-current={currentPage === item.id ? "page" : undefined}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{item.short}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
