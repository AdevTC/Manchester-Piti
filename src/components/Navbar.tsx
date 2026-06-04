import React from "react";
import { useAuth } from "../context/AuthContext";
import { useSeason } from "../context/SeasonContext";
import { 
  Trophy, 
  Calendar, 
  Users, 
  User as UserIcon, 
  LogOut, 
  ShieldAlert 
} from "lucide-react";

interface NavbarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, setCurrentPage }) => {
  const { profile, logout } = useAuth();
  const { seasons, selectedSeasonId, setSelectedSeasonId, loadingSeasons } = useSeason();

  const handleNavClick = (page: string) => {
    setCurrentPage(page);
    window.location.hash = page;
  };

  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";

  return (
    <>
      {/* DESKTOP HEADER & NAVBAR */}
      <header
        style={{
          background: "rgba(15, 23, 42, 0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border-color)",
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "1rem 1.5rem"
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem"
          }}
        >
          {/* Logo & Team Name */}
          <div 
            onClick={() => handleNavClick("matches")} 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "0.5rem", 
              cursor: "pointer" 
            }}
          >
            <div
              style={{
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent-cyan), #ffffff)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--shadow-glow)",
                fontWeight: "bold",
                color: "#0f172a",
                fontSize: "1.2rem"
              }}
            >
              M
            </div>
            <div>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.025em" }}>
                MANCHESTER <span style={{ color: "var(--accent-cyan)" }}>PITI</span>
              </h1>
              <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Club de Fútbol
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="desktop-only" style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => handleNavClick("matches")}
              className={`btn ${currentPage === "matches" ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
            >
              <Calendar size={16} />
              Partidos
            </button>
            <button
              onClick={() => handleNavClick("stats")}
              className={`btn ${currentPage === "stats" ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
            >
              <Trophy size={16} />
              Estadísticas
            </button>
            <button
              onClick={() => handleNavClick("plantilla")}
              className={`btn ${currentPage === "plantilla" ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
            >
              <Users size={16} />
              Plantilla
            </button>
            <button
              onClick={() => handleNavClick("profile")}
              className={`btn ${currentPage === "profile" ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
            >
              <UserIcon size={16} />
              Mi Perfil
            </button>
            {isAdmin && (
              <button
                onClick={() => handleNavClick("admin")}
                className={`btn ${currentPage === "admin" ? "btn-primary" : "btn-secondary"}`}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  borderColor: "rgba(245, 158, 11, 0.4)",
                  background: currentPage === "admin" ? "var(--accent-gold)" : "rgba(245, 158, 11, 0.05)",
                  color: currentPage === "admin" ? "#0f172a" : "var(--accent-gold)"
                }}
              >
                <ShieldAlert size={16} />
                Admin
              </button>
            )}
          </nav>

          {/* Season Filter and User Menu */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {/* Season Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <label 
                htmlFor="season-select" 
                style={{ 
                  fontSize: "0.75rem", 
                  fontWeight: 600, 
                  color: "var(--text-secondary)", 
                  textTransform: "uppercase" 
                }}
              >
                Temporada:
              </label>
              {loadingSeasons ? (
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Cargando...</span>
              ) : (
                <select
                  id="season-select"
                  value={selectedSeasonId}
                  onChange={(e) => setSelectedSeasonId(e.target.value)}
                  style={{
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "0.375rem",
                    padding: "0.375rem 1.75rem 0.375rem 0.75rem",
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    outline: "none",
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: "right 0.5rem center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "1.25rem",
                    appearance: "none"
                  }}
                >
                  <option value="all">Histórico Total</option>
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Profile Info */}
            {profile && (
              <div 
                className="desktop-only" 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "0.75rem", 
                  borderLeft: "1px solid var(--border-color)", 
                  paddingLeft: "1rem" 
                }}
              >
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: "0.875rem", fontWeight: 700 }}>@{profile.nickname}</p>
                  <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    {profile.role === "superadmin" ? "Super Admin" : profile.role === "admin" ? "Administrador" : "Jugador"}
                  </p>
                </div>
                <button
                  onClick={logout}
                  title="Cerrar Sesión"
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "none",
                    borderRadius: "0.375rem",
                    width: "2rem",
                    height: "2rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--accent-red)",
                    cursor: "pointer",
                    transition: "var(--transition-smooth)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--accent-red)";
                    e.currentTarget.style.color = "white";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                    e.currentTarget.style.color = "var(--accent-red)";
                  }}
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav
        className="mobile-only"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(15, 23, 42, 0.95)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-around",
          padding: "0.5rem 0",
          zIndex: 100,
          boxShadow: "0 -8px 30px rgba(0, 0, 0, 0.4)"
        }}
      >
        <button
          onClick={() => handleNavClick("matches")}
          style={{
            background: "none",
            border: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.25rem",
            color: currentPage === "matches" ? "var(--accent-cyan)" : "var(--text-secondary)",
            fontSize: "0.7rem",
            fontWeight: currentPage === "matches" ? 600 : 400,
            cursor: "pointer"
          }}
        >
          <Calendar size={20} />
          <span>Partidos</span>
        </button>
        <button
          onClick={() => handleNavClick("stats")}
          style={{
            background: "none",
            border: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.25rem",
            color: currentPage === "stats" ? "var(--accent-cyan)" : "var(--text-secondary)",
            fontSize: "0.7rem",
            fontWeight: currentPage === "stats" ? 600 : 400,
            cursor: "pointer"
          }}
        >
          <Trophy size={20} />
          <span>Stats</span>
        </button>
        <button
          onClick={() => handleNavClick("plantilla")}
          style={{
            background: "none",
            border: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.25rem",
            color: currentPage === "plantilla" ? "var(--accent-cyan)" : "var(--text-secondary)",
            fontSize: "0.7rem",
            fontWeight: currentPage === "plantilla" ? 600 : 400,
            cursor: "pointer"
          }}
        >
          <Users size={20} />
          <span>Plantilla</span>
        </button>
        <button
          onClick={() => handleNavClick("profile")}
          style={{
            background: "none",
            border: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.25rem",
            color: currentPage === "profile" ? "var(--accent-cyan)" : "var(--text-secondary)",
            fontSize: "0.7rem",
            fontWeight: currentPage === "profile" ? 600 : 400,
            cursor: "pointer"
          }}
        >
          <UserIcon size={20} />
          <span>Perfil</span>
        </button>
        {isAdmin && (
          <button
            onClick={() => handleNavClick("admin")}
            style={{
              background: "none",
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.25rem",
              color: currentPage === "admin" ? "var(--accent-gold)" : "var(--text-secondary)",
              fontSize: "0.7rem",
              fontWeight: currentPage === "admin" ? 600 : 400,
              cursor: "pointer"
            }}
          >
            <ShieldAlert size={20} />
            <span>Admin</span>
          </button>
        )}
      </nav>

      {/* CSS details to toggle desktop vs mobile layout in CSS */}
      <style>{`
        @media (min-width: 769px) {
          .mobile-only {
            display: none !important;
          }
        }
        @media (max-width: 768px) {
          .desktop-only {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};
