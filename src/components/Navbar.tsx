import React, { useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "../context/AuthContext";
import { useSeason } from "../context/SeasonContext";
import {
  Calendar,
  Trophy,
  Users,
  User as UserIcon,
  ShieldAlert,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Crest } from "./Crest";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "./ui/select";
import "./Navbar.css";

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

// Nav id <-> router path. The brand button and rails address nav ids; the
// router owns the URL, so derive the active id from the current pathname.
const PATHS: Record<string, string> = {
  matches: "/",
  stats: "/stats",
  plantilla: "/plantilla",
  profile: "/profile",
  admin: "/admin",
};

export const Navbar: React.FC = () => {
  const { profile, logout } = useAuth();
  const { seasons, selectedSeasonId, loadingSeasons } = useSeason();

  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentPage =
    pathname === "/"
      ? "matches"
      : Object.keys(PATHS).find((k) => PATHS[k] === pathname) ?? "matches";

  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const navItems = isAdmin ? [...BASE_NAV, ADMIN_ITEM] : BASE_NAV;

  const handleNavClick = (page: string) => {
    const path = PATHS[page];
    if (path) void navigate({ to: path, search: (prev) => prev });
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

  // ---- Season selector (Radix Select: accessible, portal-based, keyboard nav) ----
  const seasonOptions = [{ id: "all", name: "Histórico Total" }, ...seasons];
  const currentSeasonName =
    selectedSeasonId === "all"
      ? "Histórico Total"
      : seasons.find((s) => s.id === selectedSeasonId)?.name ?? "Histórico Total";

  const pickSeason = (id: string) => {
    void navigate({ to: ".", search: (prev) => ({ ...prev, season: id }) });
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
              style={{ transform: `translateX(${ink.x}px) scaleX(${ink.w})` }}
              aria-hidden="true"
            />
          </nav>

          {/* Right cluster */}
          <div className="mp-gantry-actions">
            <div className="mp-season">
              {loadingSeasons ? (
                <span className="mp-season-loading">Cargando...</span>
              ) : (
                <Select value={selectedSeasonId} onValueChange={pickSeason}>
                  <SelectTrigger
                    className="mp-season-trigger h-auto min-w-[9.5rem] gap-2 rounded-md border-border bg-transparent px-3 py-1.5 text-left hover:border-primary focus-visible:ring-primary/50"
                    aria-label={`Temporada: ${currentSeasonName}. Cambiar.`}
                  >
                    <span className="flex flex-col leading-tight">
                      <span className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Temporada
                      </span>
                      <span className="text-sm font-semibold leading-none text-foreground">
                        {currentSeasonName}
                      </span>
                    </span>
                  </SelectTrigger>
                  <SelectContent align="end">
                    {seasonOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
