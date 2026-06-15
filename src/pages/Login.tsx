import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { LogIn, ShieldCheck } from "lucide-react";
import { Crest } from "../components/Crest";

export const Login: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg || "Error al iniciar sesión con Google. Inténtalo de nuevo."
      );
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
        padding: "1.5rem",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Decorative Blur Spheres */}
      <div
        style={{
          position: "absolute",
          width: "250px",
          height: "250px",
          borderRadius: "50%",
          background: "rgba(6, 182, 212, 0.15)",
          filter: "blur(60px)",
          top: "20%",
          left: "20%"
        }}
      ></div>
      <div
        style={{
          position: "absolute",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: "rgba(16, 185, 129, 0.1)",
          filter: "blur(80px)",
          bottom: "20%",
          right: "20%"
        }}
      ></div>

      <div
        className="card"
        style={{
          maxWidth: "420px",
          width: "100%",
          textAlign: "center",
          padding: "3rem 2rem",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5), var(--shadow-glow)",
          animation: "fadeIn 0.6s ease"
        }}
      >
        {/* Emblem */}
        <Crest size={112} alt="Manchester Piti" style={{ margin: "0 auto 1.5rem" }} />

        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: "0.25rem",
            lineHeight: 1.1
          }}
        >
          MANCHESTER <span style={{ color: "var(--accent-cyan)" }}>PITI</span>
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.85rem",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            marginBottom: "2rem"
          }}
        >
          Portal de Club & Estadísticas
        </p>

        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "0.95rem",
            lineHeight: 1.5,
            marginBottom: "2.5rem"
          }}
        >
          Accede para ver la Plantilla del equipo, el histórico de partidos de cada temporada y competir en los leaderboards del club.
        </p>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "var(--accent-red)",
              padding: "0.75rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              marginBottom: "1.5rem",
              textAlign: "left"
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="btn btn-primary"
          style={{
            width: "100%",
            padding: "1rem",
            fontSize: "1rem",
            borderRadius: "0.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem"
          }}
        >
          <LogIn size={20} />
          {loading ? "Iniciando sesión..." : "Iniciar Sesión con Google"}
        </button>

        <div
          style={{
            marginTop: "2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            fontSize: "0.75rem",
            color: "var(--text-muted)"
          }}
        >
          <ShieldCheck size={14} style={{ color: "var(--accent-emerald)" }} />
          <span>Conexión segura vía Firebase Auth</span>
        </div>
      </div>
    </div>
  );
};
