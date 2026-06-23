import React, { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "../context/AuthContext";
import { UserCheck, LogOut, AtSign, Loader2, CheckCircle2 } from "lucide-react";
import { Crest } from "../components/Crest";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { nicknameSchema } from "../lib/schemas";
import { nicknameAvailableQuery } from "../lib/detailQueries";
import { decideNicknameError } from "../lib/nicknameAvailability";

const formSchema = z.object({ nickname: nicknameSchema });
type FormValues = z.infer<typeof formSchema>;

const TAKEN_MESSAGE = "Este nickname ya está en uso. Elige otro diferente.";

export const NicknameSetup: React.FC = () => {
  const { registerNickname, logout, user } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { nickname: "" },
  });

  // Reactively watch the raw input so we can debounce an availability check.
  const rawNickname = useWatch({ control, name: "nickname" }) ?? "";

  // Only query when the value passes the SYNC schema (length/regex). The schema
  // normalizes (trim+lowercase), so `parsed.data` is the canonical value the
  // availability query keys/queries by — same normalization as registerNickname.
  const parsed = nicknameSchema.safeParse(rawNickname);
  const validNickname = parsed.success ? parsed.data : null;

  // Debounce the valid nickname (~400ms, no extra dep) so we don't fire a query
  // on every keystroke. The query itself is cached by React Query per value.
  // State is only ever set from an async timer (never synchronously in the
  // effect body — that is a `react-hooks/set-state-in-effect` error): on a valid
  // value after the debounce, and on an invalid value we reset to null on the
  // next tick so a stale "checking/available/taken" signal can't linger.
  const [debouncedNickname, setDebouncedNickname] = useState<string | null>(null);
  useEffect(() => {
    if (!validNickname) {
      const reset = setTimeout(() => setDebouncedNickname(null), 0);
      return () => clearTimeout(reset);
    }
    const t = setTimeout(() => setDebouncedNickname(validNickname), 400);
    return () => clearTimeout(t);
  }, [validNickname]);

  const availability = useQuery({
    ...nicknameAvailableQuery(debouncedNickname ?? ""),
    enabled: !!debouncedNickname,
  });

  // Is the debounced value currently being checked (debounce window OR in-flight)?
  const isChecking =
    !!validNickname &&
    (validNickname !== debouncedNickname || (availability.isFetching && !!debouncedNickname));
  // Available only when we have a settled result for the CURRENT valid value.
  const isAvailable =
    !!validNickname && validNickname === debouncedNickname && availability.data === true;

  // Reflect the debounced availability result into the inline field error. Like
  // the dorsal check, this is UX only — registerNickname keeps the race-safe
  // server check at submit. We track our own "taken" error so we never stomp a
  // Zod (length/regex) error and only clear what we set.
  const takenErrorSetRef = useRef(false);
  useEffect(() => {
    const action = decideNicknameError({
      validNickname,
      debouncedNickname,
      availabilitySuccess: availability.isSuccess,
      available: availability.data,
      ownsTakenError: takenErrorSetRef.current,
    });
    if (action === "set") {
      setError("nickname", { type: "manual", message: TAKEN_MESSAGE });
      takenErrorSetRef.current = true;
    } else if (action === "clear") {
      clearErrors("nickname");
      takenErrorSetRef.current = false;
    } else if (action === "release") {
      // Value became invalid: drop ownership WITHOUT clearing — the Zod resolver
      // owns the field error now (clearing would stomp its length/regex error).
      takenErrorSetRef.current = false;
    }
  }, [validNickname, debouncedNickname, availability.isSuccess, availability.data, setError, clearErrors]);

  const onSubmit = handleSubmit(async ({ nickname }) => {
    try {
      const ok = await registerNickname(nickname);
      if (!ok) {
        setError("nickname", { message: TAKEN_MESSAGE });
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
              <Input
                {...register("nickname")}
                id="nickname"
                type="text"
                placeholder="ej: piti_goleador"
                style={{ paddingLeft: "2.5rem", paddingRight: "2.5rem" }}
                disabled={isSubmitting}
                autoFocus
                aria-invalid={!!errors.nickname}
                aria-describedby={errors.nickname ? "nickname-error" : undefined}
              />
              {(isChecking || isAvailable) && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "inline-flex",
                  }}
                >
                  {isChecking ? (
                    <Loader2 size={18} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <CheckCircle2 size={18} style={{ color: "var(--accent-cyan, #6CABDD)" }} />
                  )}
                </span>
              )}
            </div>
            <span aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
              {isChecking ? "Comprobando disponibilidad…" : isAvailable ? "Nickname disponible" : ""}
            </span>
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
