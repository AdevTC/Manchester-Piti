import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ShieldCheck, AlertTriangle, Trophy, History, Flame, LayoutGrid } from "lucide-react";
import { Crest } from "../components/Crest";
import { Jersey } from "../components/Jersey";
import { LoginLights } from "../components/LoginLights";
import "./Login.css";

/** Multi-colour Google "G", per Google's sign-in branding. */
const GoogleG: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
  </svg>
);

/** A corner floodlight rig: a banked lamp panel whose lamps strike on in sequence. */
const Pylon: React.FC<{ side: "l" | "r" }> = ({ side }) => {
  const lamps = [];
  let i = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      lamps.push(
        <circle key={`${r}-${c}`} className="lg-lamp" style={{ ["--i" as string]: i++ }} cx={14 + c * 19} cy={13 + r * 16} r={5} />
      );
    }
  }
  return (
    <svg className={`lg-pylon lg-pylon-${side}`} viewBox="0 0 110 72" aria-hidden="true">
      <rect className="lg-pylon-arm" x="50" y="56" width="10" height="18" rx="2" />
      <rect className="lg-pylon-panel" x="2" y="2" width="106" height="58" rx="5" />
      {lamps}
    </svg>
  );
};

const TICKER = [
  "Manchester Piti", "Fútbol de domingo", "Pompa de élite",
  "Zona de socios", "Festival del gol", "Histórico total",
  "El Pichichi", "Récords del club", "La Pizarra", "Temporada 2025/26",
];
// One "half" repeated wide enough to exceed any viewport, so the -50% loop
// never reveals a gap (a single set of short phrases doesn't fill a wide screen).
const TICKER_HALF = [...TICKER, ...TICKER, ...TICKER];

const FEATURES = [
  { Icon: Trophy, t: "El Pichichi", d: "Máximos goleadores y asistentes de cada temporada." },
  { Icon: History, t: "Histórico total", d: "Cada partido, gol y alineación, archivados." },
  { Icon: Flame, t: "Récords y rachas", d: "Marcas del club y química entre jugadores." },
  { Icon: LayoutGrid, t: "La Pizarra", d: "Monta el once y comparte la táctica." },
];

export const Login: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg || "Error al iniciar sesión con Google. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  // Follow-spot + jersey tilt via CSS vars chasing the pointer. Skipped on
  // touch / reduced-motion, leaving a lit static scene.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof window === "undefined" || !window.matchMedia) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (reduced || !finePointer) return;
    let raf = 0;
    let tx = 0.5, ty = 0.38, cx = 0.5, cy = 0.38;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      ty = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    };
    const tick = () => {
      cx += (tx - cx) * 0.09; cy += (ty - cy) * 0.09;
      el.style.setProperty("--mx", `${(cx * 100).toFixed(2)}%`);
      el.style.setProperty("--my", `${(cy * 100).toFixed(2)}%`);
      el.style.setProperty("--px", cx.toFixed(3));
      el.style.setProperty("--py", cy.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    el.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => { el.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="lg" ref={stageRef}>
      <LoginLights />
      <Pylon side="l" />
      <Pylon side="r" />
      <div className="lg-spot" aria-hidden="true" />
      <div className="lg-grain" aria-hidden="true" />
      <div className="lg-ground" aria-hidden="true" />

      <div className="lg-ticker" aria-hidden="true">
        <div className="lg-ticker-track">
          {[0, 1].map((half) => (
            <div className="lg-ticker-half" key={half}>
              {TICKER_HALF.map((t, i) => (
                <span className="lg-ticker-item" key={i}>{t}<span className="lg-ticker-sep">/</span></span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="lg-stage">
        {/* LEFT — brand + access */}
        <div className="lg-col lg-col-brand">
          <div className="lg-brand">
            <Crest size={56} className="lg-crest" alt="Escudo del Manchester Piti" />
            <h1 className="lg-wordmark">
              <span className="lg-w1">Manchester</span>
              <span className="lg-w2">Piti</span>
            </h1>
          </div>
          <span className="lg-rule" aria-hidden="true" />
          <p className="lg-tagline">Bajo los focos</p>
          <p className="lg-sub">
            El portal del club: estadísticas, plantilla e historia. Entra con tu
            cuenta y reclama tu sitio en el once.
          </p>

          <div className="lg-access">
            {error && (
              <div className="lg-error" role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            <button type="button" className="lg-google" onClick={handleLogin} disabled={loading} aria-busy={loading}>
              <span className="lg-google-in">
                <GoogleG />
                {loading ? "Entrando…" : "Entrar con Google"}
              </span>
            </button>
            <p className="lg-secure">
              <ShieldCheck size={15} aria-hidden="true" />
              Acceso seguro vía Firebase Auth
            </p>
          </div>
        </div>

        {/* RIGHT — the kit + a preview of what's inside */}
        <div className="lg-col lg-col-preview">
          <div className="lg-show" aria-hidden="true">
            <div className="lg-jersey">
              <Jersey name="Piti" number={1} size="lg" />
            </div>
          </div>

          <div className="lg-feats">
            <p className="lg-feats-h">Dentro del vestuario</p>
            <ul className="lg-feat-list">
              {FEATURES.map(({ Icon, t, d }) => (
                <li className="lg-feat" key={t}>
                  <Icon className="lg-feat-ico" size={20} aria-hidden="true" />
                  <span className="lg-feat-txt">
                    <span className="lg-feat-t">{t}</span>
                    <span className="lg-feat-d">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="lg-foot">
        <span>Manchester Piti</span>
        <span className="lg-dot" aria-hidden="true" />
        <span>Fútbol de domingo</span>
        <span className="lg-dot" aria-hidden="true" />
        <span>Pompa de élite</span>
      </div>
    </div>
  );
};
