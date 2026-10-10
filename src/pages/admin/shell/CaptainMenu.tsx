// The captain at the rail's foot opens his menu (a small popover above him; on phones the same choices live
// in «Más»): «Mi perfil», «Ver la web», «Tema de día / noche» and «Salir en este dispositivo» (asks first).
// The menu is a non-modal layer on the shared stack (Esc closes it, the focus goes back to the captain), a
// WAI-ARIA menu (↑ ↓ Home End move, Tab leaves) that springs up from him.
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useAuth } from "../../../context/AuthContext";
import { leaveDoorNotice } from "../../../lib/doorNotice";
import { AdIcon } from "../ui/icons";
import { useLayer } from "../ui/layerCore";
import { ConfirmModal } from "../ui/layers";
import { ThemeIcon } from "./ChromeBits";
import { POP, useChromeMotion, type MenuAnchor } from "./chromeMotion";
import type { Captain } from "./nav";

/** The captain's initials with his armband «C» (gold for the capitán general). Decorative. */
export function CaptainAvatar({ captain }: { captain: Captain }) {
  return (
    <span className="av" aria-hidden="true">
      {captain.initials}
      <i className={captain.general ? "cc gen" : "cc"}>C</i>
    </span>
  );
}

interface MenuProps {
  open: boolean;
  anchor: MenuAnchor | null;
  onClose: () => void;
  /** The captain button: the focus goes back there. */
  returnRef: RefObject<HTMLElement | null>;
  captain: Captain;
  dark: boolean;
  onTheme: () => void;
  onLogout: () => void;
}
export function CaptainMenu(props: MenuProps) {
  const animate = useChromeMotion();
  const show = props.open && !!props.anchor;
  if (!animate) return show ? <MenuLayer {...props} animate={false} /> : null;
  return <AnimatePresence>{show && <MenuLayer key="cm" {...props} animate />}</AnimatePresence>;
}

function MenuLayer({ anchor, onClose, returnRef, captain, dark, onTheme, onLogout, animate }: MenuProps & { animate: boolean }) {
  const present = useIsPresent();
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLAnchorElement>(null);
  useLayer({ modal: false, trap: false, onClose, ref, initialFocus: first, returnFocus: returnRef, active: present });
  // A press outside (not on the captain, who toggles it himself) closes it.
  useEffect(() => {
    if (!present) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t || ref.current?.contains(t) || returnRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [present, onClose, returnRef]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Tab") {
      onClose();
      return;
    }
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    const to: Record<string, number> = { ArrowDown: (at + 1) % items.length, ArrowUp: (at - 1 + items.length) % items.length, Home: 0, End: items.length - 1 };
    if (!(e.key in to)) return;
    e.preventDefault();
    items[to[e.key]]?.focus();
  };
  const body = (
    <>
      <div className="cmh" role="none">
        <b>{captain.nickname}</b>
        <small>{captain.role}</small>
      </div>
      <Link ref={first} role="menuitem" className="fr" to="/profile" onClick={onClose}>
        <AdIcon name="card" size={18} />
        Mi perfil
      </Link>
      <Link role="menuitem" className="fr" to="/" onClick={onClose}>
        <AdIcon name="home" size={18} />
        Ver la web
        <span className="x2">
          <AdIcon name="ext" size={14} />
        </span>
      </Link>
      <button type="button" role="menuitem" className="fr" onClick={onTheme}>
        <ThemeIcon dark={dark} />
        {dark ? "Tema de día" : "Tema de noche"}
      </button>
      <div className="sep" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="fr"
        onClick={() => {
          onClose();
          onLogout();
        }}
      >
        <AdIcon name="back" size={18} />
        Salir en este dispositivo
      </button>
    </>
  );
  const common = {
    ref,
    className: "cmenu",
    role: present ? "menu" : undefined,
    "aria-label": "Menú del capitán",
    "aria-hidden": present ? undefined : true,
    style: { left: anchor?.left ?? 12, bottom: anchor?.bottom ?? 80 },
    onKeyDown,
  } as const;
  if (!animate) return <div {...common}>{body}</div>;
  return (
    <motion.div
      {...common}
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: POP }}
      exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.14 } }}
    >
      {body}
    </motion.div>
  );
}

/** «¿Salir en este dispositivo?»: signs out here; the door greets him with what just happened. */
export function LogoutConfirm({ open, onClose, nickname }: { open: boolean; onClose: () => void; nickname: string }) {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    leaveDoorNotice("Has salido en este dispositivo");
    try {
      await logout();
    } finally {
      setBusy(false);
      onClose();
    }
  };
  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title="¿Salir en este dispositivo?"
      lede={`Cierras la sesión de ${nickname} en este navegador.`}
      consequences={["Para volver a la sala de control tendrás que entrar otra vez.", "Nada de lo publicado cambia."]}
      confirmLabel="Salir"
      busy={busy}
      onConfirm={() => void confirm()}
    />
  );
}
