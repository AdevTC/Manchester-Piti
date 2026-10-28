// The top bar's account control (TU boards, `tu-acct`): a member gets his avatar pill («J Jordi»: the initial on a
// celeste disc and his first name, with a dot while something waits on him) that opens «Tú»; a fan gets «Entrar»,
// which opens the door's sheet («Entrar con Google», «¿Juegas en el Piti? Pide entrar al vestuario»). The server
// and the hydrating browser render the fan's link to /vestuario (the public pages' HTML stays the fan's, and without
// JavaScript it is still the way in); the member arrives right after (RootLayout publishes him: hooks/viewerSignal,
// accountSignal), first as the bare pill, then with «Tú» and its dot once their chunk is in.
import { lazy, Suspense, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { Link } from "@tanstack/react-router";
import { usePublishedViewer } from "../../hooks/viewerSignal";
import { readTuMaqueta } from "../vidrio/tu/maqueta";
import { tuSurface } from "../vidrio/tu/surface";
import { firstName, initialOf, usePublishedAccount } from "./accountSignal";
import type { AccountSala } from "../vidrio/account/AccountSheet";
// (the bar's magnifier, bell and avatar from the first paint, on every page: tu.css comes later, with the sheets)
import "../../styles/tu-chrome.css";

const MemberAccount = lazy(() => import("../vidrio/account/AccountSheet").then((m) => ({ default: m.MemberAccount })));
const FanAccountLayer = lazy(() => import("../vidrio/account/AccountSheet").then((m) => ({ default: m.FanAccountLayer })));

const noop = () => () => undefined;
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

/** `sala`: the Sala de control's avatar (someone signed in, always: «Tú» with the sala's things, AccountSheet). */
export function AccountGate({ here, sala }: { here?: boolean; sala?: AccountSala & { name: string } }) {
  const hydrated = useHydrated();
  const viewer = usePublishedViewer();
  const account = usePublishedAccount();
  const maqFan = hydrated && readTuMaqueta()?.quien === "fan";
  const member = !!sala || (hydrated && viewer.member && !maqFan);
  const name = account?.name ? firstName(account.name) : sala ? firstName(sala.name) : "";
  if (!member) return <FanEntrar here={here} hydrated={hydrated} />;
  return (
    <Suspense
      fallback={
        <button type="button" className={`vd-glass vd-press tu-acct${here ? " on" : ""}`} aria-label={viewer.playerId ? `Tú, ${name || "tu cuenta"}` : `Tu cuenta${name ? `, ${name}` : ""}`} aria-haspopup="dialog" aria-expanded={false}>
          <i aria-hidden="true">{name ? initialOf(name) : "·"}</i>
          <span className="tu-acct__name">{name || "Tú"}</span>
        </button>
      }
    >
      <MemberAccount name={name} here={here} sala={sala} />
    </Suspense>
  );
}

function FanEntrar({ here, hydrated }: { here?: boolean; hydrated: boolean }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLAnchorElement | null>(null);
  const close = (refocus = true) => {
    tuSurface(false, btn.current, "tu-acct", () => flushSync(() => setOpen(false)));
    if (refocus) window.setTimeout(() => btn.current?.focus({ preventScroll: true }), 60);
  };
  return (
    <>
      <Link
        ref={btn}
        className={`vd-glass vd-press tu-acct tu-acct--in${here ? " on" : ""}`}
        to="/vestuario"
        aria-label="Entrar al vestuario"
        aria-current={here ? "page" : undefined}
        aria-haspopup={hydrated ? "dialog" : undefined}
        aria-expanded={hydrated ? open : undefined}
        onClick={(e) => {
          // (with the page alive the door's sheet opens here; its «Pide entrar al vestuario» leads in)
          if (!hydrated || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          if (open) close();
          else tuSurface(true, btn.current, "tu-acct", () => flushSync(() => setOpen(true)));
        }}
      >
        Entrar
      </Link>
      {open && (
        <Suspense fallback={null}>
          <FanAccountLayer close={close} />
        </Suspense>
      )}
    </>
  );
}
