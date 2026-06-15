import React from "react";
import { useAuth } from "../context/AuthContext";
import { User, Mail, Calendar, LogOut, ShieldCheck } from "lucide-react";

const BAND_BG = "#0c1733";
const HALFTONE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  backgroundImage: "radial-gradient(rgba(108,171,221,0.16) 1px, transparent 1.5px)",
  backgroundSize: "22px 22px",
  opacity: 0.5,
  WebkitMaskImage: "linear-gradient(120deg, #000, transparent 65%)",
  maskImage: "linear-gradient(120deg, #000, transparent 65%)",
};

export const Profile: React.FC = () => {
  const { user, profile, logout } = useAuth();

  if (!profile) return null;

  const joinDate = profile.createdAt?.seconds
    ? new Date(profile.createdAt.seconds * 1000)
    : new Date();

  const isAdmin = profile.role === "superadmin" || profile.role === "admin";
  const roleLabel = profile.role === "superadmin" ? "Super Admin" : profile.role === "admin" ? "Administrador" : "Miembro · Jugador";
  const initials = profile.nickname.slice(0, 2).toUpperCase();

  const rows = [
    { icon: Mail, label: "Correo electrónico", value: profile.email, mono: false },
    { icon: User, label: "ID de usuario", value: user?.uid || "—", mono: true },
    { icon: Calendar, label: "Fecha de registro", value: joinDate.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" }), mono: false },
  ];

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "2rem", maxWidth: "640px", margin: "0 auto" }}>
      {/* Editorial header */}
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, textTransform: "uppercase", fontSize: "clamp(2.2rem, 6vw, 3.4rem)", lineHeight: 0.9, letterSpacing: "0.01em", color: "var(--text-primary)" }}>
          Mi Perfil
        </h2>
        <span style={{ display: "block", width: "84px", height: "6px", background: "var(--accent-cyan)", margin: "0.9rem 0 0.75rem" }} />
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          Tu carné de socio del club.
        </p>
      </div>

      {/* Membership card */}
      <section style={{ position: "relative", overflow: "hidden", background: BAND_BG, color: "#fff", border: "1px solid rgba(108,171,221,0.18)", borderRadius: "10px", padding: "clamp(1.5rem, 5vw, 2.25rem)" }}>
        <div aria-hidden="true" style={HALFTONE} />
        <img
          src="/crest.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{
            position: "absolute",
            top: "-18px",
            right: "-18px",
            width: "150px",
            height: "150px",
            objectFit: "contain",
            opacity: 0.13,
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
            {/* Initials disc */}
            <div style={{
              flexShrink: 0,
              width: "4.75rem",
              height: "4.75rem",
              borderRadius: "8px",
              background: "var(--accent-cyan)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: "2.1rem",
              color: BAND_BG,
              lineHeight: 1,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--accent-cyan)" }}>
                Socio del club
              </span>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 400, textTransform: "uppercase", fontSize: "clamp(1.8rem, 7vw, 2.6rem)", lineHeight: 0.95, letterSpacing: "0.01em", margin: "0.25rem 0 0.55rem", wordBreak: "break-word" }}>
                @{profile.nickname}
              </h3>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontFamily: "var(--font-sans)",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "0.3rem 0.7rem",
                borderRadius: "9999px",
                color: isAdmin ? "#FFC659" : "#9fcdec",
                background: isAdmin ? "rgba(255,198,89,0.14)" : "rgba(108,171,221,0.16)",
                border: `1px solid ${isAdmin ? "rgba(255,198,89,0.45)" : "rgba(108,171,221,0.45)"}`,
              }}>
                {isAdmin && <ShieldCheck size={13} />}
                {roleLabel}
              </span>
            </div>
          </div>

          <div style={{ marginTop: "1.5rem", paddingTop: "1.1rem", borderTop: "1px solid rgba(255,255,255,0.16)", display: "flex", alignItems: "baseline", gap: "0.5rem", fontSize: "0.82rem", color: "#9fb6d6" }}>
            <span>Socio desde</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "1.35rem", color: "#fff", lineHeight: 1 }}>{joinDate.getFullYear()}</span>
          </div>
        </div>
      </section>

      {/* Account details */}
      <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", overflow: "hidden", background: "var(--bg-secondary)" }}>
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: "0.9rem", padding: "1rem 1.25rem", borderTop: i === 0 ? "none" : "1px solid var(--border-color)" }}>
              <span style={{ flexShrink: 0, width: "2.25rem", height: "2.25rem", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "6px", background: "var(--bg-tertiary)", color: "var(--accent-ink)" }}>
                <Icon size={16} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>{r.label}</p>
                <p style={{ fontSize: r.mono ? "0.82rem" : "0.95rem", fontWeight: 500, color: "var(--text-primary)", fontFamily: r.mono ? "monospace" : "inherit", wordBreak: "break-all" }}>{r.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={logout}
        className="btn btn-danger"
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
      >
        <LogOut size={16} />
        Cerrar sesión
      </button>
    </div>
  );
};
