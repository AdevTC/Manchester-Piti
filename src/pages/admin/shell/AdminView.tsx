// A view of the admin app: `<section class="vw">` (fade + slide in) with its designed header (`.vh`):
// kicker (desktop), title, lead, status chips (desktop) and actions. Put the body (`.vb …`) as children.
import { useId, type ReactNode } from "react";

export interface AdminViewProps {
  kicker: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  /** Status chips (`<li>` items), shown on desktop. */
  chips?: ReactNode;
  /** Header buttons (e.g. «Nuevo partido»). */
  actions?: ReactNode;
  /** Extra classes on the section (e.g. `vpa det`). */
  className?: string;
  children?: ReactNode;
}
export function AdminView({ kicker, title, lead, chips, actions, className = "", children }: AdminViewProps) {
  const id = useId();
  return (
    <section className={`vw ${className}`.trim()} aria-labelledby={id}>
      <div className="vh">
        <div className="t">
          <p className="kk">
            <i />
            {kicker}
          </p>
          <h1 className="h1" id={id}>
            {title}
          </h1>
          {lead && <p className="ld">{lead}</p>}
        </div>
        {chips && (
          <ul className="stl" aria-label="Estado">
            {chips}
          </ul>
        )}
        {actions && <div className="vh-a">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
