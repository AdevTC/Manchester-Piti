// «El palco» (Estadísticas): the pieces every place uses, ported from the canvas prototype (Numeros.dc.html) —
// its glyphs (stroked 24×24 paths), the glass segmented control with its bead, a player's printed shirt, the window
// that grows in place, the sheet over the page (the number helpers are in num.ts).
import { useContext, useEffect, type CSSProperties, type ReactNode, type Ref } from "react";
import { KitStillContext } from "../../../components/jersey3d/kitStill";
import { ICON, type IconName } from "./icons";

/** A glyph of the prototype (decorative: the control around it carries the words). */
export function Ic({ name, className, style }: { name: IconName; className?: string; style?: CSSProperties }) {
  return (
    <svg className={`nx-ic${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={style}>
      <path d={ICON[name]} />
    </svg>
  );
}

export interface SegOpt {
  t: ReactNode;
  on: boolean;
  pick: () => void;
  off?: boolean;
  key?: string;
}
/** The glass segmented control (vd-seg) with its bead under the chosen option; `aria-pressed` on each. */
export function Seg({ label, opts, className, style, scroll }: { label: string; opts: SegOpt[]; className?: string; style?: CSSProperties; scroll?: boolean }) {
  const i = Math.max(0, opts.findIndex((o) => o.on));
  const seg = (
    <div className={`vd-glass vd-seg nx-seg${className ? ` ${className}` : ""}`} role="group" aria-label={label} style={{ "--n": opts.length, "--i": i, ...style } as CSSProperties}>
      <span className="vd-shelf__bead" aria-hidden="true" />
      {opts.map((o, k) => (
        <button key={o.key ?? k} type="button" className="vd-seg__b" aria-pressed={o.on} onClick={o.pick} disabled={o.off}>
          {o.t}
        </button>
      ))}
    </div>
  );
  // (more options than fit: the strip scrolls sideways, the options keep their width)
  return scroll ? <div className="nx-scrollx">{seg}</div> : seg;
}

/** A player's printed shirt (home kit): the still the page renders (his name and dorsal), the blank shirt with the
 *  dorsal until it is ready. Decorative: the row next to it says who. */
export function PShirt({ n, size, className }: { n: number | string | ""; size?: number; className?: string }) {
  const num = n === "" || n == null ? undefined : String(n);
  const still = useContext(KitStillContext)("home", num);
  const style = { ...(size ? { "--s": `${size}px` } : {}), ...(still ? { "--vd-shirt-img": `url("${still.src}")` } : {}) } as CSSProperties;
  return (
    <span className={`vd-shirt${still ? " vd-shirt--img" : ""}${className ? ` ${className}` : ""}`} style={style} aria-hidden="true">
      {num && !still?.printed ? <b>{num}</b> : null}
    </span>
  );
}

/** A window that grows in place over a place (Gráficas, Todos los números, Catálogo, Toda la plantilla): its title,
 *  «← back» and «Cerrar»; the page owns the focus (it moves to the title) and Esc. */
export function Win({ id, title, back, onClose, actions, children }: { id: string; title: string; back: string; onClose: () => void; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="vd-glass vd-glass--deep nx-win" aria-labelledby={id}>
      <header className="nx-win__head">
        <button type="button" className="nx-win__back" onClick={onClose}>
          <Ic name="arrow" />
          {back}
        </button>
        <h2 id={id} tabIndex={-1}>
          {title}
        </h2>
        {actions}
        <button type="button" className="vd-glass vd-press nx-btn" onClick={onClose}>
          <Ic name="close" />
          Cerrar
        </button>
      </header>
      <div className="nx-win__body">{children}</div>
    </section>
  );
}

/** The page behind a sheet stays still while one is drawn. */
function PageLock() {
  useEffect(() => {
    const html = document.documentElement;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = "";
    };
  }, []);
  return null;
}

/** A sheet over the page: the scrim (a tap closes), the dialog with its title and «Cerrar»; Esc and the focus are the
 *  page's. `head` replaces the plain title (a kicker over it, say). */
export function SheetFrame({ id, title, head, onClose, sheetRef, className, children }: { id: string; title?: string; head?: ReactNode; onClose: () => void; sheetRef: Ref<HTMLElement>; className?: string; children: ReactNode }) {
  return (
    <>
      <PageLock />
      <button type="button" className="nx-scrim" aria-label="Cerrar" tabIndex={-1} onClick={onClose} />
      <section ref={sheetRef} tabIndex={-1} className={`vd-glass vd-glass--deep nx-sheet${className ? ` ${className}` : ""}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="nx-sheet__head">
          {head ?? <h2 id={id}>{title}</h2>}
          <button type="button" className="vd-glass vd-press nx-ib" aria-label="Cerrar" onClick={onClose}>
            <Ic name="close" />
          </button>
        </div>
        {children}
      </section>
    </>
  );
}

/** Loading or failed, in a window or a sheet: the spinner with its words, or the words and «Reintentar». */
export function Wait({ t, fail, retry }: { t: string; fail?: string | null; retry?: () => void }) {
  if (fail)
    return (
      <div className="nx-wait nx-wait--err" role="alert">
        <p>{fail}</p>
        {retry && (
          <button type="button" className="vd-glass vd-press nx-btn" onClick={retry}>
            Reintentar
          </button>
        )}
      </div>
    );
  return (
    <div className="nx-wait" role="status">
      <i aria-hidden="true" />
      {t}
    </div>
  );
}
