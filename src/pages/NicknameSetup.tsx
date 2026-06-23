import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../context/AuthContext";
import { UserCheck, LogOut, AtSign } from "lucide-react";
import { Crest } from "../components/Crest";
import { Button } from "../components/ui/button";
import { nicknameSchema } from "../lib/schemas";

const formSchema = z.object({ nickname: nicknameSchema });
type FormValues = z.infer<typeof formSchema>;

export const NicknameSetup: React.FC = () => {
  const { registerNickname, logout, user } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { nickname: "" },
  });

  const onSubmit = handleSubmit(async ({ nickname }) => {
    try {
      const ok = await registerNickname(nickname);
      if (!ok) {
        setError("nickname", { message: "Este nickname ya está en uso. Elige otro diferente." });
      }
      // If registered successfully, AuthContext state updates and redirects automatically
    } catch (err) {
      setError("nickname", {
        message: err instanceof Error ? err.message : "Error al registrar el nickname. Inténtalo de nuevo.",
      });
    }
  });

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
        <Crest size={72} alt="Manchester Piti" style={{ margin: "0 0 1.25rem" }} />
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

        <form onSubmit={onSubmit}>
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
                {...register("nickname")}
                id="nickname"
                type="text"
                className="form-input"
                placeholder="ej: piti_goleador"
                style={{ paddingLeft: "2.5rem" }}
                disabled={isSubmitting}
                autoFocus
                aria-invalid={!!errors.nickname}
                aria-describedby={errors.nickname ? "nickname-error" : undefined}
              />
            </div>
            <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
              De 3 a 15 caracteres. Solo letras, números y guiones bajos (_).
            </span>
          </div>

          {errors.nickname && (
            <div
              id="nickname-error"
              role="alert"
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
              {errors.nickname.message}
            </div>
          )}

          <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
            <Button
              type="button"
              variant="secondary"
              onClick={logout}
              className="flex-1"
              disabled={isSubmitting}
            >
              <LogOut size={16} />
              Cancelar
            </Button>

            <Button
              type="submit"
              className="flex-[2]"
              disabled={isSubmitting}
            >
              <UserCheck size={16} />
              {isSubmitting ? "Registrando..." : "Guardar Nickname"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
