import React from "react";
import { useAuth } from "../context/AuthContext";
import { User, Mail, Calendar, LogOut } from "lucide-react";

export const Profile: React.FC = () => {
  const { user, profile, logout } = useAuth();

  if (!profile) return null;

  const joinDate = profile.createdAt?.seconds 
    ? new Date(profile.createdAt.seconds * 1000) 
    : new Date();

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      {/* Title */}
      <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Mi <span className="text-gradient">Perfil</span>
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Configuración de cuenta e información del usuario.
        </p>
      </div>

      {/* Profile Card */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          {/* Avatar Icon */}
          <div
            style={{
              width: "4.5rem",
              height: "4.5rem",
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--accent-cyan), #ffffff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--shadow-glow)",
              fontSize: "2rem",
              fontWeight: 800,
              color: "#0f172a"
            }}
          >
            {profile.nickname.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 style={{ fontSize: "1.5rem", fontWeight: 800 }}>@{profile.nickname}</h3>
            <span className={`badge ${profile.role === "superadmin" || profile.role === "admin" ? "badge-warning" : "badge-info"}`} style={{ borderColor: profile.role === "superadmin" ? "var(--accent-gold)" : undefined }}>
              {profile.role === "superadmin" ? "Super Admin" : profile.role === "admin" ? "Administrador" : "Miembro / Jugador"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem" }}>
          {/* Email Info */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Mail size={18} style={{ color: "var(--text-muted)" }} />
            <div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Correo Electrónico</p>
              <p style={{ fontSize: "0.95rem", fontWeight: 500 }}>{profile.email}</p>
            </div>
          </div>

          {/* UID Info */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <User size={18} style={{ color: "var(--text-muted)" }} />
            <div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>ID de Usuario</p>
              <p style={{ fontSize: "0.85rem", fontFamily: "monospace", color: "var(--text-secondary)" }}>{user?.uid}</p>
            </div>
          </div>

          {/* Creation Info */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Calendar size={18} style={{ color: "var(--text-muted)" }} />
            <div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Fecha de Registro</p>
              <p style={{ fontSize: "0.95rem", fontWeight: 500 }}>{joinDate.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="btn btn-danger"
          style={{ width: "100%", marginTop: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
        >
          <LogOut size={16} />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};
