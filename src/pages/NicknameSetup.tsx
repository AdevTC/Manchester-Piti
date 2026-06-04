import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { UserCheck, LogOut, AtSign } from "lucide-react";

export const NicknameSetup: React.FC = () => {
  const { registerNickname, logout, user } = useAuth();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = nickname.trim().toLowerCase();
    
    // Regex to allow letters, numbers and underscores only
    const regex = /^[a-zA-Z0-9_]+$/;

    if (trimmed.length < 3 || trimmed.length > 15) {
      setError("El nickname debe tener entre 3 y 15 caracteres.");
      return;
    }

    if (!regex.test(trimmed)) {
      setError("El nickname solo puede contener letras, números y guiones bajos (_).");
      return;
    }

    setLoading(true);
    try {
      const isRegistered = await registerNickname(trimmed);
      if (!isRegistered) {
        setError("Este nickname ya está en uso. Elige otro diferente.");
        setLoading(false);
      }
      // If registered successfully, AuthContext state updates and redirects automatically
    } catch (err: any) {
      setError(err.message || "Error al registrar el nickname. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at center, #0f172a 0%, #070b13 100%)",
        padding: "1.5rem"
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: "450px",
          width: "100%",
          padding: "2.5rem 2rem",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5), var(--shadow-glow)",
          animation: "fadeIn 0.5s ease"
        }}
      >
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>
          ¡Casi listo! 👋
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          Para completar tu perfil en la plataforma de <strong>Manchester Piti</strong>, por favor elige un nickname único. Esto te identificará ante la comunidad.
        </p>

        {user && (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border-color)",
              borderRadius: "0.5rem",
              padding: "0.75rem",
              fontSize: "0.85rem",
              marginBottom: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem"
            }}
          >
            <span style={{ color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.7rem", fontWeight: 700 }}>
              Email Vinculado
            </span>
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{user.email}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ position: "relative" }}>
            <label className="form-label" htmlFor="nickname">
              Elige tu Nickname
            </label>
            <div style={{ position: "relative" }}>
              <AtSign
                size={18}
                style={{
                  position: "absolute",
                  left: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)"
                }}
              />
              <input
                id="nickname"
                type="text"
                className="form-input"
                placeholder="ej: piti_goleador"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                style={{ paddingLeft: "2.5rem" }}
                disabled={loading}
                autoFocus
              />
            </div>
            <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
              De 3 a 15 caracteres. Solo letras, números y guiones bajos (_).
            </span>
          </div>

          {error && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "var(--accent-red)",
                padding: "0.75rem",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                marginBottom: "1.5rem"
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={logout}
              className="btn btn-secondary"
              style={{ flex: 1, gap: "0.35rem" }}
              disabled={loading}
            >
              <LogOut size={16} />
              Cancelar
            </button>
            
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2, gap: "0.35rem" }}
              disabled={loading}
            >
              <UserCheck size={16} />
              {loading ? "Registrando..." : "Guardar Nickname"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
