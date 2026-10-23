// «Tú» (TU boards, shell.html `tu-tu`, component.js menuModel): the avatar's sheet. A member: who you are (your
// printed shirt, your name and line, your card's chip), the one thing that waits on you now (answered right there,
// «N cosas más te tocan» to the bandeja), your places as a menu (↑ ↓ Intro, Esc closes), the theme (Día · Noche ·
// Sistema) and «Salir en este dispositivo» (Cuenta with its confirmation open). A fan: «Entrar con Google» and «¿Juegas
// en el Piti? Pide entrar al vestuario», «Avisos sin cuenta» and the search. A dialog that grows out of the avatar
// (desktop: under it; phone: over the tab bar); the focus goes back to the avatar.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "../../../context/AuthContext";
import { useTheme, type ThemePref } from "../../../hooks/useTheme";
import { usePageKitStills } from "../../jersey3d/usePageKitStills";
import { readTuMaqueta } from "../tu/maqueta";
import { Seg, TuIcon, TuLayer, type TuIconName } from "../tu/ui";
import { rove, tuGo, useToast } from "../tu/kit";
import { useInbox, type Inbox } from "../../../pages/perfil/bandeja/useInbox";
import { PendList } from "../../../pages/perfil/bandeja/parts";
import { useAvisoActions } from "../../../pages/perfil/bandeja/actions";
import { tuSurface } from "../tu/surface";
import { useThisDevice } from "../../../pages/perfil/bandeja/device";
import { pl, tocaMore } from "../../../pages/perfil/bandeja/model";
import { useProfileData } from "../../../pages/perfil/useProfileData";
import { wantedNumber } from "../../../pages/perfil/tu/view";
import { initialOf } from "../../celeste/accountSignal";
import "../../../styles/tu-avisos.css";

/** «Jordi Alejandro Sumba Rodríguez» → «Jordi Sumba» (the first name and the first surname). */
function shortName(full: string): string {
  const p = full.trim().split(/\s+/).filter(Boolean);
  return p.length > 2 ? `${p[0]} ${p[p.length - 2]}` : p.join(" ");
}

interface Item {
  t: string;
  hint: string;
  icon: TuIconName;
  badge: number;
  go: () => void;
}

/** Opens and closes a sheet out of its button (the board's openSurface / closeSurface). */
function useSurface(name: string, btn: { readonly current: HTMLElement | null }) {
  const [open, setOpen] = useState(false);
  const show = () => tuSurface(true, btn.current, name, () => flushSync(() => setOpen(true)));
  const close = (refocus = true) => {
    tuSurface(false, btn.current, name, () => flushSync(() => setOpen(false)));
    if (refocus) window.setTimeout(() => btn.current?.focus({ preventScroll: true }), 60);
  };
  return { open, show, close };
}

function useSheetKeys(close: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => ref.current?.querySelector<HTMLElement>("[data-nav]")?.focus({ preventScroll: true }), 40);
    return () => window.clearTimeout(t);
  }, []);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    rove(e, "[data-nav]");
  };
  return { ref, onKey };
}

const THEMES: { v: ThemePref; t: string; icon: TuIconName }[] = [
  { v: "light", t: "Día", icon: "sun" },
  { v: "dark", t: "Noche", icon: "moon" },
  { v: "system", t: "Sistema", icon: "phone" },
];
function Theme() {
  const { pref, setPref } = useTheme();
  return (
    <div className="tu-tu__theme">
      <span className="tu-label" id="tu-th-t">
        Tema
      </span>
      <Seg nav labelledBy="tu-th-t" value={pref} onPick={setPref} opts={THEMES.map((o) => ({ v: o.v, t: o.t, icon: o.icon }))} />
    </div>
  );
}

function MenuList({ items }: { items: Item[] }) {
  return (
    <nav className="tu-mlist" aria-label="Tu sitio">
      {items.map((d) => (
        <button key={d.t} type="button" className="tu-mi" data-nav="1" onClick={d.go}>
          <TuIcon name={d.icon} />
          <span className="tu-mi__t">{d.t}</span>
          {d.badge > 0 && <span className="tu-badge">{d.badge}</span>}
          {d.hint && <small className="tu-mi__h">{d.hint}</small>}
          <TuIcon name="chev-r" className="tu-mi__c" />
        </button>
      ))}
    </nav>
  );
}

/** The member's avatar («J Jordi», a dot while something waits on him) and his «Tú». */
export function MemberAccount({ name, here }: { name: string; here?: boolean }) {
  const inbox = useInbox();
  const btn = useRef<HTMLButtonElement | null>(null);
  const s = useSurface("tu-acct", btn);
  const toast = useToast();
  const jugador = inbox.viewer.who === "jugador";
  const shown = name || "Tú";
  const waits = inbox.openPend;
  const label = `${jugador ? "Tú, " : "Tu cuenta, "}${shown}${waits ? `, ${pl(waits, "cosa pendiente", "cosas pendientes")}` : ""}`;
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`vd-glass vd-press tu-acct${here ? " on" : ""}`}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={s.open}
        onClick={() => (s.open ? s.close() : s.show())}
      >
        <i aria-hidden="true">
          {name ? initialOf(name) : "·"}
          {waits > 0 && <span className="tu-acct__dot" />}
        </i>
        <span className="tu-acct__name">{shown}</span>
      </button>
      <TuLayer cls={s.open ? "o-tu" : undefined}>
        {s.open && (
          <>
            <div className="tu-scrim" aria-hidden="true" onClick={() => s.close()} />
            {inbox.member ? <MemberSheet inbox={inbox} say={toast.say} close={s.close} /> : <FanSheet close={s.close} />}
          </>
        )}
        {toast.node}
      </TuLayer>
    </>
  );
}

function MemberSheet({ inbox, say, close }: { inbox: Inbox; say: (t: string) => void; close: (refocus?: boolean) => void }) {
  const d = useProfileData(readTuMaqueta());
  const { theme } = useTheme();
  const navigate = useNavigate();
  const a = useAvisoActions(inbox, say, () => close(false));
  const { ref, onKey } = useSheetKeys(() => close());
  const who = inbox.viewer.who;
  const jugador = who === "jugador";
  const card = d.card;
  const num = card.number || d.shirt.number;
  const still = usePageKitStills({ on: jugador && !!num, theme, kits: ["home"], players: jugador && num ? [{ name: d.shirt.current, num }] : [] });
  const img = jugador && num ? still("home", num) : undefined;
  const go = (path: string) => () => a.go(path);
  const nick = d.nickname ? `@${d.nickname}` : "";
  const pending = d.ficha.state === "pendiente";
  const rated = card.showNumbers && card.rating !== null;
  const title = shortName(jugador && d.shirt.fullName ? d.shirt.fullName : d.google.name || d.nickname) || "Tú";
  const line = jugador
    ? [nick, num, card.posLong].filter(Boolean).join(" · ")
    : who === "socio"
      ? [nick, "socio sin ficha"].filter(Boolean).join(" · ")
      : [nick, pending ? `ficha del ${wantedNumber(d)} pendiente` : "sin ficha todavía"].filter(Boolean).join(" · ");
  const chip = jugador ? (rated ? `${card.tierName} · ${card.rating}` : "Carta nueva") : who === "socio" ? "Socio" : pending ? "Pendiente" : "Por revelar";
  const first = inbox.pends.find((p) => !p.done) ?? null;
  const doors = d.captain?.doorRequests.length ?? 0;
  const items: Item[] = [
    { t: who === "socio" ? "Tu carné" : "Tu carta", hint: jugador ? (rated ? `${card.tierName} · ${card.rating}` : "Nueva") : who === "socio" ? `Desde ${d.access.sinceText}` : pending ? "Pendiente" : "Por revelar", icon: who === "socio" ? "user" : "cardi", badge: 0, go: go("/perfil") },
    ...(jugador ? [{ t: "Temporada", hint: card.totals.played ? pl(card.totals.played, "partido", "partidos") : "Sin partidos", icon: "chart" as const, badge: 0, go: go("/perfil/temporada") }] : []),
    { t: "Avisos", hint: inbox.unread ? "" : "Al día", icon: "bell", badge: inbox.unread, go: go("/avisos") },
    { t: "Ajustes", hint: "", icon: "gear", badge: 0, go: go("/perfil/ajustes") },
    { t: "Cuenta", hint: "", icon: "user", badge: 0, go: go("/perfil/cuenta") },
    ...(inbox.viewer.captain ? [{ t: "Capitanía", hint: doors ? `${doors} en la puerta` : "Nadie en la puerta", icon: "door" as const, badge: doors, go: go("/perfil/capitania") }] : []),
  ];
  const salir = () => {
    close(false);
    tuGo("right", async () => {
      await navigate({ to: "/perfil/cuenta", search: { salir: "1" } } as never);
    });
  };
  return (
    <div ref={ref} className="vd-glass vd-glass--deep tu-sheet tu-tu" role="dialog" aria-modal="true" aria-labelledby="tu-tu-t" onKeyDown={onKey}>
      <span className="tu-grab" aria-hidden="true" />
      <header className="tu-tu__head">
        {jugador ? img ? <img className="tu-tu__shirt" src={img.src} alt="" /> : <span className="tu-tu__shirt" aria-hidden="true" /> : <span className="tu-ava" aria-hidden="true">{initialOf(d.nickname || title)}</span>}
        <div className="tu-tu__who">
          <h2 id="tu-tu-t">{title}</h2>
          <p>{line}</p>
        </div>
        <span className="tu-pill tu-tu__chip">{chip}</span>
        <button type="button" className="tu-x2" aria-label="Cerrar" onClick={() => close()}>
          <TuIcon name="close" />
        </button>
      </header>
      {first && (
        <section className="tu-tu__toca" aria-label="Te toca">
          <p className="tu-label">Te toca</p>
          <PendList pends={[first]} a={a} say={say} sm />
          {inbox.openPend > 1 && (
            <button type="button" className="vd-link" data-nav="1" onClick={() => a.goAv("bandeja", "toca")}>
              {tocaMore(inbox.openPend)}
            </button>
          )}
        </section>
      )}
      <MenuList items={items} />
      <Theme />
      <footer className="tu-tu__foot">
        <button type="button" className="tu-mi tu-mi--quiet" data-nav="1" onClick={salir}>
          <TuIcon name="logout" />
          <span className="tu-mi__t">Salir en este dispositivo</span>
        </button>
        <span className="tu-small tu-tu__keys" aria-hidden="true">
          <kbd>↑</kbd>
          <kbd>↓</kbd> moverte · <kbd>Esc</kbd> cerrar
        </span>
      </footer>
    </div>
  );
}

/** A fan's «Entrar» sheet. */
export function FanSheet({ close }: { close: (refocus?: boolean) => void }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const dev = useThisDevice();
  const { ref, onKey } = useSheetKeys(() => close());
  const [err, setErr] = useState("");
  const go = (path: string) => () => {
    close(false);
    tuGo("right", async () => {
      await navigate({ href: path });
    });
  };
  const items: Item[] = [
    { t: "Avisos sin cuenta", hint: dev.line, icon: "bell", badge: 0, go: go("/avisos/a-medida") },
    {
      t: "Buscar en la web",
      hint: "Ctrl K",
      icon: "search",
      badge: 0,
      go: () => {
        close(false);
        window.setTimeout(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })), 80);
      },
    },
  ];
  return (
    <div ref={ref} className="vd-glass vd-glass--deep tu-sheet tu-tu" role="dialog" aria-modal="true" aria-labelledby="tu-tu-t" onKeyDown={onKey}>
      <span className="tu-grab" aria-hidden="true" />
      <header className="tu-tu__head">
        <div className="tu-tu__who">
          <h2 id="tu-tu-t">Entra en el vestuario</h2>
          <p>La porra, el MVP, tus avisos y tu carta</p>
        </div>
        <button type="button" className="tu-x2" aria-label="Cerrar" onClick={() => close()}>
          <TuIcon name="close" />
        </button>
      </header>
      <div className="tu-tu__fan">
        <button
          type="button"
          className="vd-glass vd-press vd-btn vd-btn--pri tu-wide"
          data-nav="1"
          onClick={() => {
            setErr("");
            loginWithGoogle().then(
              () => close(false),
              () => setErr("No se ha podido entrar con Google. Inténtalo otra vez."),
            );
          }}
        >
          <TuIcon name="google" />
          Entrar con Google
        </button>
        {err && (
          <p className="tu-small" role="alert">
            {err}
          </p>
        )}
        <button type="button" className="vd-link" data-nav="1" onClick={go("/vestuario")}>
          ¿Juegas en el Piti? Pide entrar al vestuario
        </button>
      </div>
      <MenuList items={items} />
      <Theme />
    </div>
  );
}

/** The fan's «Entrar» sheet in its layer (AccountGate opens it from the server-rendered link). */
export function FanAccountLayer({ close }: { close: (refocus?: boolean) => void }) {
  return (
    <TuLayer cls="o-tu">
      <div className="tu-scrim" aria-hidden="true" onClick={() => close()} />
      <FanSheet close={close} />
    </TuLayer>
  );
}

