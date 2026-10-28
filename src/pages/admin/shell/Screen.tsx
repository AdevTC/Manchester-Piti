// The shared pieces a screen of the sala is built with (MARCO.md says how): its head with the one primary action
// (law 6: on the desktop at the end of the head; on the phone and the tablet pinned above the dock, on its own
// tray), regions that scroll inside with their head stuck (law 7, ≥ 1100), and the loading, error and not-found
// states. Every screen tells the frame its title, its line and its way back (useSalaHead) through SalaScreen.
import { useId, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { VIcon, type VIconName } from "../../../components/vidrio/VIcon";
import { useNoIndex } from "../../../hooks/useNoIndex";
import { useSalaHead, type SalaHead } from "./head";
import { SalaLink } from "./SalaLink";
import { useFrame } from "../ui/frame";

export interface PrimarySpec {
  label: string;
  onClick: () => void;
  /** aria-disabled (it stays focusable and says why with `why`). */
  disabled?: boolean;
  /** Why it is off, or what it will do: read with it (aria-describedby) and shown under it on the phone. */
  why?: string;
  icon?: VIconName;
  /** aria-keyshortcuts («n»). */
  keys?: string;
  /** It opens a dialog or a sheet. */
  popup?: boolean;
}

/** The one primary action of a screen. `place`: `head` (the desktop's, at the end of the screen's head) or `pin`
 *  (the phone's and the tablet's, sticky above the dock in the thumb zone). SalaScreen draws both. */
export function PrimaryAction({ spec, place, whyId }: { spec: PrimarySpec; place: "head" | "pin"; whyId?: string }) {
  return (
    <div className={`sc-primary sc-primary--${place}`}>
      <button
        type="button"
        className="vd-btn vd-glass vd-press vd-btn--pri"
        aria-disabled={spec.disabled || undefined}
        aria-describedby={spec.why && whyId ? whyId : undefined}
        aria-keyshortcuts={place === "head" ? spec.keys : undefined}
        aria-haspopup={spec.popup ? "dialog" : undefined}
        onClick={() => !spec.disabled && spec.onClick()}
      >
        {spec.icon && <VIcon name={spec.icon} size={18} />}
        {spec.label}
      </button>
    </div>
  );
}

export interface SalaScreenProps {
  /** The h1 (one per screen). On the phone and the tablet the frame's header says it (the h1 stays for readers). */
  title: ReactNode;
  /** Its plain words for the frame's header and the tab (default: `title` when it is a string). */
  headTitle?: string;
  kicker?: ReactNode;
  /** The line under the title (and the frame header's, as `headSub` or this when it is a string). */
  lede?: ReactNode;
  headSub?: string;
  /** «‹ Volver»: where and its name (with one, the dock hides below 1100). */
  back?: SalaHead["back"];
  /** The head's other actions (glass buttons, links), before the primary one. */
  actions?: ReactNode;
  primary?: PrimarySpec | null;
  /** `fit`: the screen fills the frame (its regions scroll inside, ≥ 1100); default: it scrolls in the frame. */
  fit?: boolean;
  className?: string;
  children?: ReactNode;
}

export function SalaScreen({ title, headTitle, kicker, lede, headSub, back, actions, primary, fit, className = "", children }: SalaScreenProps) {
  const id = useId();
  // (below 1100 the frame's header says the title and its line: they stay here for the readers, one h1)
  const { desktop } = useFrame();
  const whyId = `${id}-why`;
  const plain = headTitle ?? (typeof title === "string" ? title : "");
  useSalaHead(plain ? { title: plain, sub: headSub ?? (typeof lede === "string" ? lede : undefined), back } : null);
  return (
    <section className={`sc-screen${fit ? " sc-screen--fit" : ""} ${className}`.trim()} aria-labelledby={`${id}-t`}>
      <header className="sc-shead sc-shead--framed">
        <div className={`sc-shead__t${desktop ? "" : " vd-vh"}`}>
          {kicker && <p className="sc-k">{kicker}</p>}
          <h1 className="sc-h1" id={`${id}-t`}>
            {title}
          </h1>
          {lede && <p className="sc-lede">{lede}</p>}
        </div>
        {(actions || primary) && (
          <div className="sc-shead__a">
            {actions}
            {primary && <PrimaryAction spec={primary} place="head" whyId={whyId} />}
          </div>
        )}
      </header>
      <div className="sc-screen__body">{children}</div>
      {primary && (
        <>
          {primary.why && (
            <p className="sc-why vd-vh" id={whyId}>
              {primary.why}
            </p>
          )}
          <PrimaryAction spec={primary} place="pin" whyId={whyId} />
        </>
      )}
    </section>
  );
}

/** A region of a screen: its own head (stuck at the top while it scrolls) and a body that scrolls inside at ≥ 1100,
 *  fading at its foot while more waits below. Put regions side by side in `.sc-split` (a list and its detail). */
export function Region({ title, count, actions, label, className = "", children, as: As = "section" }: { title?: ReactNode; count?: ReactNode; actions?: ReactNode; label?: string; className?: string; children: ReactNode; as?: "section" | "div" | "aside" }) {
  const id = useId();
  return (
    <As className={`sc-region ${className}`.trim()} aria-labelledby={title ? id : undefined} aria-label={title ? undefined : label}>
      {(title || actions) && (
        <header className="sc-region__h">
          {title && (
            <h2 className="sc-h2" id={id}>
              {title}
            </h2>
          )}
          {count !== undefined && <span className="sc-sec__n">{count}</span>}
          {actions}
        </header>
      )}
      <div className="sc-scroll">{children}</div>
    </As>
  );
}

/** Loading: a few lines of rhythm, said in words (role=status). */
export function ScreenLoading({ label = "Cargando la sala de control" }: { label?: string }) {
  return (
    <section className="sc-loading vd-reg-1" role="status" aria-label={label}>
      <i />
      <i />
      <i />
      <i />
      <i />
      <span>Cargando…</span>
    </section>
  );
}

/** Could not load: what happened, that nothing saved is lost, and «Reintentar». `what`: «la plantilla», «la caja»… */
export function ScreenError({ what, onRetry }: { what?: string; onRetry?: () => void }) {
  return (
    <section className="sc-failed vd-reg-1" role="alert">
      <h2>{what ? `No se ha podido cargar ${what}` : "No se ha podido cargar"}</h2>
      <p>Revisa la conexión y vuelve a intentarlo. Lo que ya estaba guardado no se pierde.</p>
      {onRetry && (
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </section>
  );
}

/** An address the sala does not have. */
export function NotFoundScreen() {
  useSalaHead({ title: "No existe", back: { to: "/admin", label: "Volver a Hoy" } });
  useNoIndex();
  return (
    <section className="sc-failed vd-reg-1" aria-labelledby="sc-nf-t" data-kind="notfound">
      <h1 id="sc-nf-t">Esta sección no existe</h1>
      <p>Puede que el enlace sea de antes del cambio. Todo lo de la sala está en Hoy, Partidos, Plantilla, Caja y Club.</p>
      <Link className="vd-btn vd-glass vd-press vd-btn--pri" to="/admin">
        Ir a Hoy
      </Link>
    </section>
  );
}

/** TEMPORARY (r12): a new screen whose page wave 2 draws, with the way to where today's sala does it. */
export function ComingScreen({ title, sub, back, body, links }: { title: string; sub?: string; back?: SalaHead["back"]; body: string; links?: { to: string; label: string }[] }) {
  return (
    <SalaScreen title={title} lede={sub} back={back}>
      <p className="sc-p">{body}</p>
      {links && links.length > 0 && (
        <ul className="sc-rows" style={{ marginTop: 16 }}>
          {links.map((l) => (
            <li key={l.to}>
              <SalaLink className="sc-row sc-row--btn" to={l.to}>
                <span className="sc-row__t">
                  <b>{l.label}</b>
                </span>
                <VIcon name="chevR" size={18} />
              </SalaLink>
            </li>
          ))}
        </ul>
      )}
    </SalaScreen>
  );
}
