// The sheet the top bar's account control opens (V-Integracion «El club y la cuenta», «La cuenta en el móvil»):
// desktop, a glass window under the avatar; phone/tablet, a sheet rising above the tab bar. A jugador gets «Tú»
// (his shirt and line, then «Esta noche», the convocatoria to answer in place, his porra, his turno, the open
// poll with its votes, the next logro and the caja); a socio his account (his porra, «Avisos a medida» in the
// bell, the MVP vote, «Cerrar sesión»); a fan the door («Entrar · Para la porra, los avisos y el MVP», «Pedir
// entrar al vestuario»). Everyone gets the theme switch here (it left the top bar). A dialog: focus goes in,
// Escape and a tap outside close it, focus goes back to the avatar.
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../hooks/useTheme";
import { useDesktop } from "../env";
import { VIcon, type VIconName } from "../VIcon";
import { initialOf } from "../../celeste/accountSignal";
import { useAccount, type Answer } from "./useAccount";
import "../../../styles/vidrio/reading.css";
import "./account.css";

export type AccountKind = "jugador" | "socio" | "aficion";

const ANSWERS: { a: Answer; label: string }[] = [
  { a: "yes", label: "Voy" },
  { a: "maybe", label: "Duda" },
  { a: "no", label: "No voy" },
];

function Row({ icon, title, live, children }: { icon: VIconName; title: ReactNode; live?: boolean; children?: ReactNode }) {
  return (
    <li className={`vd-arow${live ? " is-live" : ""}`}>
      <span className="vd-arow__i" aria-hidden="true">
        <VIcon name={icon} size={18} />
      </span>
      <div>
        <b>{title}</b>
        {children}
      </div>
    </li>
  );
}

function ThemeRow() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" onClick={toggle} aria-label={`Cambiar a tema ${theme === "dark" ? "claro" : "oscuro"}`}>
      <VIcon name={theme === "dark" ? "sun" : "moon"} size={16} />
      {theme === "dark" ? "Tema claro" : "Tema oscuro"}
    </button>
  );
}

function Foot({ member, onClose }: { member: boolean; onClose: () => void }) {
  const { logout } = useAuth();
  return (
    <div className="vd-acct-foot">
      {member && (
        <>
          <Link className="vd-glass vd-btn vd-btn--sm vd-press" to="/vestuario" onClick={onClose}>
            <VIcon name="lock" size={16} />
            El vestuario
          </Link>
          <Link className="vd-glass vd-btn vd-btn--sm vd-press" to="/profile" onClick={onClose}>
            Tu perfil
          </Link>
        </>
      )}
      <ThemeRow />
      {member && (
        <button
          type="button"
          className="vd-link vd-acct-out"
          onClick={() => {
            onClose();
            void logout();
          }}
        >
          Cerrar sesión
        </button>
      )}
    </div>
  );
}

function JugadorBody({ phone, onClose }: { phone: boolean; onClose: () => void }) {
  const t = useAccount(true);
  const pick = t.rsvp ? ANSWERS.findIndex((x) => x.a === t.rsvp?.value) : -1;
  return (
    <>
      <header className="vd-acct-head">
        <span className="vd-shirt" style={{ "--s": phone ? "44px" : "54px" } as CSSProperties} aria-hidden="true">
          <b>{t.number ?? initialOf(t.name)}</b>
          {t.captain && <i className="vd-arm">C</i>}
        </span>
        <div>
          <h2 id="vd-acct-t">Tú, {t.name}</h2>
          {t.line && <span>{t.line}</span>}
        </div>
      </header>
      <ul className="vd-arows">
        {t.tonight && (
          <Row icon="ball" title="Esta noche" live>
            <p>{t.tonight.text}</p>
          </Row>
        )}
        {t.rsvp && (
          <Row icon="check" title={t.rsvp.question}>
            <p>{t.rsvp.sub}</p>
            <div className="vd-glass vd-seg" style={{ "--n": 3, "--i": Math.max(0, pick) } as CSSProperties} role="group" aria-label={t.rsvp.question}>
              {pick >= 0 && <span className="vd-shelf__bead" aria-hidden="true" />}
              {ANSWERS.map(({ a, label }) => (
                <button key={a} type="button" className="vd-seg__b" aria-pressed={t.rsvp?.value === a} disabled={t.rsvp?.busy} onClick={() => t.rsvp?.pick(a)}>
                  {label}
                </button>
              ))}
            </div>
            {t.rsvp.error && (
              <p className="vd-acct-err" role="alert">
                {t.rsvp.error}
              </p>
            )}
          </Row>
        )}
        {t.porra && (
          <Row icon="star" title="La porra">
            <p>{t.porra}</p>
          </Row>
        )}
        {!phone && t.turno && (
          <Row icon="wash" title={t.turno.title}>
            <p>{t.turno.text}</p>
          </Row>
        )}
        {!phone && t.poll && (
          <Row icon="poll" title={t.poll.title}>
            <div className="vd-bars" role="group" aria-label={t.poll.title}>
              {t.poll.options.map((o) => (
                <button key={o.id} type="button" className="vd-bar" aria-pressed={o.mine} onClick={() => t.poll?.pick(o.id)} aria-label={`${o.label}: ${o.n} ${o.n === 1 ? "voto" : "votos"}`}>
                  <i style={{ width: `${o.pct}%` }} aria-hidden="true" />
                  <span>{o.label}</span>
                  <span>{o.n}</span>
                </button>
              ))}
            </div>
            {t.poll.error && (
              <p className="vd-acct-err" role="alert">
                {t.poll.error}
              </p>
            )}
          </Row>
        )}
        {t.logro && (
          <Row icon="bolt" title="Logros y cromos">
            <p>{t.logro}</p>
          </Row>
        )}
        {!phone && t.caja && (
          <Row icon="euro" title="La caja">
            <p>{t.caja.text}</p>
          </Row>
        )}
      </ul>
      <Foot member onClose={onClose} />
    </>
  );
}

function SocioBody({ phone, onClose }: { phone: boolean; onClose: () => void }) {
  const t = useAccount(false);
  return (
    <>
      <header className="vd-acct-head">
        <span className="vd-ava" aria-hidden="true">
          {initialOf(t.name)}
        </span>
        <div>
          <h2 id="vd-acct-t">{t.name}</h2>
          <span>{t.line}</span>
        </div>
      </header>
      <ul className="vd-arows">
        <Row icon="star" title="Tu porra">
          <p>{t.porra ?? "Se abre antes del pitido de cada jornada."}</p>
        </Row>
        {!phone && (
          <>
            <Row icon="bell" title="Avisos a medida">
              <p>Solo goles, todo o nada; lo eliges en la campana.</p>
            </Row>
            <Row icon="poll" title="Votas al MVP">
              <p>Cuando acaba cada partido, durante 48 horas.</p>
            </Row>
            <Row icon="lock" title="Tu cuenta">
              <p>«Tú», la convocatoria y los turnos son de los jugadores; tu cuenta no los tiene, y no se enseñan huecos vacíos.</p>
            </Row>
          </>
        )}
      </ul>
      <Foot member onClose={onClose} />
    </>
  );
}

function FanBody({ onClose }: { onClose: () => void }) {
  return (
    <>
      <header className="vd-acct-head">
        <div>
          <h2 id="vd-acct-t">Entrar</h2>
          <span>Para la porra, los avisos y el MVP</span>
        </div>
      </header>
      <ul className="vd-arows">
        <Row icon="lock" title="¿Juegas en el Piti?">
          <p>Un compañero te deja pasar al vestuario y ya ves la convocatoria, tus turnos y «Tú».</p>
          <Link className="vd-glass vd-btn vd-btn--sm vd-btn--pri vd-press" to="/vestuario" onClick={onClose}>
            Pedir entrar al vestuario
          </Link>
        </Row>
      </ul>
      <Foot member={false} onClose={onClose} />
    </>
  );
}

export function AccountSheet({ kind, onClose }: { kind: AccountKind; onClose: () => void }) {
  const desktop = useDesktop();
  const ref = useRef<HTMLDivElement | null>(null);
  const closeNow = useRef(onClose);
  useEffect(() => {
    closeNow.current = onClose;
  }, [onClose]);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const outside = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t || ref.current?.contains(t)) return;
      if (t instanceof Element && t.closest(".vd-acct")) return;
      closeNow.current();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const phone = !desktop;
  // (on the page's body, over the floating score and the page: the header is its own stacking layer)
  return createPortal(
    <div
      ref={ref}
      tabIndex={-1}
      className={`vd-glass vd-glass--deep vd-acctsheet${phone ? " vd-acctsheet--phone" : ""}`}
      role="dialog"
      aria-labelledby="vd-acct-t"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {phone && <div className="vd-sheet__grab" aria-hidden="true" />}
      <button type="button" className="vd-glass vd-press vd-acct-x" aria-label="Cerrar" onClick={onClose}>
        <VIcon name="close" size={16} />
      </button>
      {kind === "jugador" ? <JugadorBody phone={phone} onClose={onClose} /> : kind === "socio" ? <SocioBody phone={phone} onClose={onClose} /> : <FanBody onClose={onClose} />}
    </div>,
    document.body,
  );
}
