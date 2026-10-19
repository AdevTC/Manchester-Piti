// The top bar's account control (V-Integracion «El club y la cuenta», V-Vivo top bar): a member gets his avatar
// pill («J Jordi»: the initial in a celeste disc and his first name) that opens «Tú» (a jugador) or his account
// (a socio); a fan gets «Entrar», which opens the door's sheet (the porra, the avisos and the MVP are a member's;
// «Pedir entrar al vestuario»). The server and the hydrating browser render the fan's link to /vestuario (the
// public pages' HTML stays the fan's, and without JavaScript it is still the way in); the member arrives right
// after (RootLayout publishes him: hooks/viewerSignal, accountSignal). The sheet's chunk loads on first use.
import { lazy, Suspense, useCallback, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { usePublishedViewer } from "../../hooks/viewerSignal";
import { firstName, initialOf, usePublishedAccount } from "./accountSignal";

const AccountSheet = lazy(() => import("../vidrio/account/AccountSheet").then((m) => ({ default: m.AccountSheet })));

const noop = () => () => undefined;
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

export function AccountGate({ here }: { here?: boolean }) {
  const hydrated = useHydrated();
  const viewer = usePublishedViewer();
  const account = usePublishedAccount();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLElement | null>(null);
  const close = useCallback(() => {
    setOpen(false);
    button.current?.focus({ preventScroll: true });
  }, []);
  const member = hydrated && viewer.member;
  const name = account?.name ? firstName(account.name) : "";
  const jugador = member && !!viewer.playerId;

  if (!member) {
    return (
      <>
        <Link
          ref={(el) => {
            button.current = el;
          }}
          className={`vd-glass vd-press vd-acct vd-acct--in${here ? " on" : ""}`}
          to="/vestuario"
          aria-label="Entrar al vestuario"
          aria-current={here ? "page" : undefined}
          aria-haspopup={hydrated ? "dialog" : undefined}
          aria-expanded={hydrated ? open : undefined}
          onClick={(e) => {
            // (with the page alive the door's sheet opens here; its «Pedir entrar al vestuario» leads in)
            if (!hydrated || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            setOpen((o) => !o);
          }}
        >
          Entrar
        </Link>
        {open && (
          <Suspense fallback={null}>
            <AccountSheet kind="aficion" onClose={close} />
          </Suspense>
        )}
      </>
    );
  }
  return (
    <>
      <button
        ref={(el) => {
          button.current = el;
        }}
        type="button"
        className={`vd-glass vd-press vd-acct${here ? " on" : ""}`}
        aria-label={jugador ? `Tú, ${name || "tu cuenta"}` : `Tu cuenta${name ? `, ${name}` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <i aria-hidden="true">{name ? initialOf(name) : "·"}</i>
        <span className="vd-acct__name">{name || "Tú"}</span>
      </button>
      {open && (
        <Suspense fallback={null}>
          <AccountSheet kind={jugador ? "jugador" : "socio"} onClose={close} />
        </Suspense>
      )}
    </>
  );
}
