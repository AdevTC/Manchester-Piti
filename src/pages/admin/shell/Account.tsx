// The avatar with its armband (the capitán general's is gold) and its menu: who you are, «Mi perfil», the sala's
// season (the frame's one picker), the theme and «Salir en este dispositivo» (asks first). A WAI-ARIA menu on the
// layer stack (Esc closes it and the focus goes back to the avatar; ↑ ↓ Home End move; Tab leaves).
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../../../context/AuthContext";
import { apiError } from "../../../lib/clubApi";
import { leaveDoorNotice } from "../../../lib/doorNotice";
import { VIcon } from "../../../components/vidrio/VIcon";
import { useLayer } from "../ui/layerCore";
import { ConfirmModal } from "../ui/layers";
import type { SalaSeason } from "./season";

export interface Viewer {
  name: string;
  /** «Capitán general», «Capitán», «Anotador de la J3», «Socio». */
  role: string;
  initials: string;
  /** Wears the armband. */
  captain: boolean;
  /** The capitán general: his armband is gold. */
  general: boolean;
}

export function AccountButton({ viewer, phone, season, dark, onTheme }: { viewer: Viewer; phone?: boolean; season?: SalaSeason | null; dark: boolean; onTheme: () => void }) {
  const [open, setOpen] = useState(false);
  const [bye, setBye] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <div className="sc-acctwrap">
      <button
        ref={btn}
        type="button"
        className={`vd-glass vd-press vd-acct sc-acct${phone ? " sc-acct--phone" : ""}`}
        aria-label={`${viewer.name}, ${viewer.role}: abrir el menú`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <i aria-hidden="true">{viewer.initials}</i>
        {!phone && <span className="vd-acct__name">{viewer.name}</span>}
        {viewer.captain && (
          <b className={`sc-arm${viewer.general ? " is-general" : ""}`} aria-hidden="true">
            C
          </b>
        )}
      </button>
      {open && <AccountMenu viewer={viewer} phone={phone} season={season} dark={dark} onTheme={onTheme} onClose={() => setOpen(false)} onLogout={() => setBye(true)} returnRef={btn} />}
      <LogoutConfirm open={bye} onClose={() => setBye(false)} name={viewer.name} />
    </div>
  );
}

function AccountMenu({ viewer, phone, season, dark, onTheme, onClose, onLogout, returnRef }: { viewer: Viewer; phone?: boolean; season?: SalaSeason | null; dark: boolean; onTheme: () => void; onClose: () => void; onLogout: () => void; returnRef: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLAnchorElement>(null);
  useLayer({ modal: false, trap: false, onClose, ref, initialFocus: first, returnFocus: returnRef });
  // A press outside (not on the avatar, which toggles it itself) closes it.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t || ref.current?.contains(t) || returnRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose, returnRef]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Tab") {
      onClose();
      return;
    }
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    const to: Record<string, number> = { ArrowDown: (at + 1) % items.length, ArrowUp: (at - 1 + items.length) % items.length, Home: 0, End: items.length - 1 };
    if (!(e.key in to)) return;
    e.preventDefault();
    items[to[e.key]]?.focus();
  };
  return (
    <div ref={ref} className={`sc-menu vd-glass vd-glass--deep${phone ? " sc-menu--phone" : ""}`} role="menu" aria-label="Tu cuenta" onKeyDown={onKeyDown}>
      <p className="sc-menu__who" role="none">
        <b>{viewer.name}</b>
        <span>{viewer.role}</span>
      </p>
      <Link ref={first} role="menuitem" to="/perfil" onClick={onClose}>
        <VIcon name="shirt" size={18} />
        Mi perfil
      </Link>
      {season && season.options.length > 1 && (
        <div role="group" aria-label="Temporada de la sala">
          <p className="sc-menu__g" aria-hidden="true">
            Temporada
          </p>
          {season.options.map((s) => (
            <button
              key={s.id}
              type="button"
              role="menuitemradio"
              aria-checked={season.season?.id === s.id}
              onClick={() => {
                season.pick(s.id);
                onClose();
              }}
            >
              <span>
                {s.name}
                <small>{s.current ? "La de ahora" : s.archived ? "Archivada" : "Otra temporada"}</small>
              </span>
              {season.season?.id === s.id && <VIcon name="check" size={16} />}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onTheme();
          onClose();
        }}
      >
        <VIcon name={dark ? "sun" : "moon"} size={18} />
        {dark ? "Tema de día" : "Tema de noche"}
      </button>
      <div className="sc-menu__sep" role="separator" />
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onLogout();
        }}
      >
        <VIcon name="logout" size={18} />
        Salir en este dispositivo
      </button>
    </div>
  );
}

/** «¿Salir en este dispositivo?»: signs out here, and only then leaves the door its greeting; a failure stays in
 *  the dialog with its reason (B-SH-08: the notice was left before trying and the error swallowed). */
export function LogoutConfirm({ open, onClose, name }: { open: boolean; onClose: () => void; name: string }) {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await logout();
      leaveDoorNotice("Has salido en este dispositivo");
      onClose();
    } catch (e) {
      setError(`No se ha podido cerrar la sesión: ${apiError(e)}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ConfirmModal
      open={open}
      onClose={() => {
        setError("");
        onClose();
      }}
      title="¿Salir en este dispositivo?"
      lede={`Cierras la sesión de ${name} en este navegador.`}
      consequences={["Para volver a la sala de control tendrás que entrar otra vez.", "Nada de lo publicado cambia."]}
      confirmLabel="Salir"
      busy={busy}
      error={error || undefined}
      onConfirm={() => void confirm()}
    />
  );
}
