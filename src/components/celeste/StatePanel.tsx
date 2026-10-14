// The Celeste states: loading, empty, error and not found. One panel (StatePanel), the hero sky it
// sits on (StateStage), and a whole page with the site chrome around it (StateScreen) for the router's
// error and 404 and the admin's door. An error never reads as «no encontrado»: it says the data did not
// arrive and offers to try again.
import { useId, type ReactNode } from "react";
import { ThemeToggle } from "../ThemeToggle";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader, type CelestePage } from "./Chrome";
import { Icon, type IconName } from "./icons";
// (its CSS, state-panel.css, comes with the Celeste chrome: Chrome.tsx)

export type StateKind = "loading" | "empty" | "error" | "notfound";

const KICKER: Record<StateKind, string> = {
  loading: "Calentando en la banda",
  empty: "Sin jugadas todavía",
  error: "¡Falta! · Error",
  notfound: "404 · Fuera de juego",
};
const ICON: Record<Exclude<StateKind, "error">, IconName> = { loading: "ball", empty: "ball", notfound: "flag" };

export interface StatePanelProps {
  kind: StateKind;
  title: string;
  body?: ReactNode;
  /** Its buttons or links (className "sp-btn", "sp-btn ghost"). */
  action?: ReactNode;
  /** The small line above the title (each kind has its own by default). */
  kicker?: string;
  /** The mark's icon instead of the kind's (an error always shows «!»). */
  icon?: IconName;
  /** h1 when the panel is the page; h2 (default) inside a page that has its own. */
  heading?: "h1" | "h2";
  /** Inline in a page that keeps its other blocks. */
  compact?: boolean;
  /** An error's technical message, folded away. */
  detail?: string;
  className?: string;
}

export function StatePanel({ kind, title, body, action, kicker, icon, heading = "h2", compact, detail, className }: StatePanelProps) {
  const id = useId();
  const H = heading;
  return (
    <div
      className={["sp", kind, compact && "compact", className].filter(Boolean).join(" ")}
      role={kind === "error" ? "alert" : kind === "loading" ? "status" : undefined}
      aria-busy={kind === "loading" || undefined}
      aria-labelledby={id}
      data-kind={kind}
    >
      <span className="sp-mark" aria-hidden="true">
        {kind === "error" ? "!" : <Icon name={icon ?? ICON[kind]} size={compact ? 20 : 24} stroke={2.2} />}
      </span>
      <span className="sp-kick">{kicker ?? KICKER[kind]}</span>
      <H className="sp-title" id={id}>
        {title}
      </H>
      {body && <p className="sp-body">{body}</p>}
      {action && <div className="sp-acts">{action}</div>}
      {detail && (
        <details className="sp-detail">
          <summary>Detalle técnico</summary>
          <code>{detail}</code>
        </details>
      )}
    </div>
  );
}

/** The hero sky under the header, with the panel centred in it (and an optional giant word behind). */
export function StateStage({ children, ghost }: { children: ReactNode; ghost?: string }) {
  return (
    <section className="sp-stage">
      {ghost && (
        <div className="sp-ghost" aria-hidden="true">
          {ghost}
        </div>
      )}
      {children}
    </section>
  );
}

/** A whole page: the Celeste header, the stage with the panel (its title is the page's h1), the footer and the dock. */
export function StateScreen({ active, sub, ghost, ...panel }: Omit<StatePanelProps, "heading" | "compact"> & { active?: CelestePage; sub: string; ghost?: string }) {
  return (
    <div className="vx sp-screen">
      <CelesteBackdrop />
      <CelesteHeader active={active} sub={sub} actions={<ThemeToggle />} />
      <StateStage ghost={ghost}>
        <StatePanel heading="h1" {...panel} />
      </StateStage>
      <CelesteFooter />
      <CelesteDock active={active} />
    </div>
  );
}

/** The club's data (matches, players) did not arrive: the same words and the same retry on every page. */
export function ClubDataError({ heading, compact }: { heading?: "h1" | "h2"; compact?: boolean }) {
  return (
    <StatePanel
      kind="error"
      heading={heading}
      compact={compact}
      title="El marcador no carga"
      body="No nos han llegado los datos del club. Suele ser la conexión: dale otra vez en un momento."
      action={
        <button type="button" className="sp-btn" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      }
    />
  );
}
