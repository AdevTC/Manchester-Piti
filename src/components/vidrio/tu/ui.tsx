// «Tú» (TU boards): the small pieces the page (/perfil, /avisos) and the chrome's surfaces («Tú», the bell, the
// search) share — the board's glyphs (VIcon's plus the few the boards add), the layer the surfaces float in, the
// «Más» and «⋯» menus with their keys, the segmented control and the switch (the behaviour: kit.tsx). The CSS is
// styles/tu.css (the boards' own, ported).
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { VIcon, type VIconName } from "../VIcon";
import "../../../styles/vidrio/tokens.css";
import "../../../styles/vidrio/glass.css";
import "../../../styles/vidrio/components.css";
import "../../../styles/vidrio/reading.css";
import "../../../styles/vidrio/transitions.css";
import "../../../styles/tu.css";
import "../../../styles/tu-app.css";

const ST = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.9 } as const;
/** The glyphs the TU boards add to VIcon's (build.mjs sprite()). */
const EXTRA = {
  more: (
    <>
      <circle fill="currentColor" cx="5.5" cy="12" r="1.8" />
      <circle fill="currentColor" cx="12" cy="12" r="1.8" />
      <circle fill="currentColor" cx="18.5" cy="12" r="1.8" />
    </>
  ),
  "chev-l": <path {...ST} strokeWidth={2.2} d="M15 5l-7 7 7 7" />,
  "chev-r": <path {...ST} strokeWidth={2.2} d="M9 5l7 7-7 7" />,
  play: <path fill="currentColor" d="M8 5.5v13l11-6.5z" />,
  clock: (
    <>
      <circle {...ST} cx="12" cy="12" r="8.5" />
      <path {...ST} d="M12 7.5V12l3 2" />
    </>
  ),
  card: <rect fill="#F2D04B" x="7" y="3.5" width="10" height="15" rx="1.8" transform="rotate(8 12 11)" />,
  door: (
    <>
      <path {...ST} d="M6 20.5V4.5a1 1 0 011-1h10a1 1 0 011 1v16M4 20.5h16" />
      <circle fill="currentColor" cx="14.5" cy="12.5" r="1.1" />
    </>
  ),
  user: (
    <>
      <circle {...ST} cx="12" cy="8.5" r="3.8" />
      <path {...ST} d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4" />
    </>
  ),
  gear: (
    <>
      <circle {...ST} cx="12" cy="12" r="3" />
      <path {...ST} d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
    </>
  ),
  cardi: (
    <>
      <rect {...ST} x="5.5" y="3" width="13" height="18" rx="2.4" />
      <path {...ST} d="M9 8h2.5M9 17h6" />
      <circle {...ST} cx="13.5" cy="12" r="2" />
    </>
  ),
  target: (
    <>
      <circle {...ST} cx="12" cy="12" r="8.5" />
      <circle {...ST} cx="12" cy="12" r="4.5" />
      <circle fill="currentColor" cx="12" cy="12" r="1.3" />
    </>
  ),
  phone: (
    <>
      <rect {...ST} x="7" y="2.8" width="10" height="18.4" rx="2.2" />
      <path {...ST} d="M11 18h2" />
    </>
  ),
  ban: (
    <>
      <circle {...ST} cx="12" cy="12" r="8.5" />
      <path {...ST} d="M6 6l12 12" />
    </>
  ),
  alert: (
    <>
      <path {...ST} d="M12 4l9 15.5H3z" />
      <path {...ST} d="M12 10v4M12 16.8v.2" />
    </>
  ),
  copy: (
    <>
      <rect {...ST} x="8.5" y="8.5" width="11" height="12" rx="2" />
      <path {...ST} d="M15.5 8.5V5.5a2 2 0 00-2-2h-7a2 2 0 00-2 2v9a2 2 0 002 2h2" />
    </>
  ),
  flip: <path {...ST} d="M4 12a8 8 0 0113.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 01-13.7 5.6L4 15.5M4 20v-4.5h4.5" />,
  replay: <path {...ST} d="M4 12a8 8 0 108-8 8 8 0 00-5.7 2.4L4 9M4 4.5V9h4.5" />,
  info: (
    <>
      <circle {...ST} cx="12" cy="12" r="8.5" />
      <path {...ST} d="M12 11v5.5M12 7.8v.2" />
    </>
  ),
  minus: <path {...ST} d="M6 12h12" />,
  download: <path {...ST} d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />,
  google: (
    <>
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h5.4a4.6 4.6 0 01-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0012 22z" />
      <path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 000 9.2z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 003.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" />
    </>
  ),
  apple: (
    <path
      fill="currentColor"
      d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5a4.3 4.3 0 00-3.4-1.8c-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8a4.5 4.5 0 00-3.8 2.3c-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3a10 10 0 001.3-2.6 3.9 3.9 0 01-2.5-3.8zM14.1 5.8A4 4 0 0015 3a4.1 4.1 0 00-2.7 1.4 3.8 3.8 0 00-1 2.7 3.4 3.4 0 002.8-1.3z"
    />
  ),
} satisfies Record<string, ReactNode>;

export type TuIconName = VIconName | keyof typeof EXTRA;
const isExtra = (n: TuIconName): n is keyof typeof EXTRA => n in EXTRA;

/** A board glyph (`tu-i`, 20 px unless the CSS says otherwise). Decorative. */
export function TuIcon({ name, className }: { name: TuIconName; className?: string }) {
  const cls = className ? `tu-i ${className}` : "tu-i";
  if (isExtra(name))
    return (
      <svg className={cls} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {EXTRA[name]}
      </svg>
    );
  return <VIcon name={name} className={cls} />;
}

/**
 * The layer the surfaces float in («Tú», the bell, the search, the studio, the cromos): portalled to the body,
 * a viewport-sized `.vx.tu` (the boards' container `tupg`), so the boards' rules place a sheet under its button on
 * a desktop and over the tab bar on a phone, wherever the page is. `cls`: the page root's surface class
 * (`o-buscar`, `o-compartir`), so the scrim is the board's.
 */
export function TuLayer({ children, cls }: { children: ReactNode; cls?: string }) {
  if (typeof document === "undefined") return null;
  return createPortal(<div className={`vx tu tu-ovl has-open${cls ? ` ${cls}` : ""}`}>{children}</div>, document.body);
}

/** ↑ ↓ Inicio Fin between the items of a menu. */
function roveIn(e: KeyboardEvent<HTMLElement>, sel: string): void {
  const k = e.key;
  if (k !== "ArrowDown" && k !== "ArrowUp" && k !== "Home" && k !== "End") return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(sel)].filter((x) => x.offsetParent !== null);
  if (!items.length) return;
  e.preventDefault();
  const i = items.indexOf(document.activeElement as HTMLElement);
  const n = items.length;
  items[k === "Home" ? 0 : k === "End" ? n - 1 : k === "ArrowDown" ? (i + 1) % n : (i - 1 + n) % n]?.focus();
}

export interface MenuItem {
  t: string;
  icon: TuIconName;
  go: () => void;
}

/**
 * «Más» (kind "more": a glass button with its word) or «⋯» (kind "dots": a notice, a match's stack, the bell) and
 * its menu: role menu, ↑ ↓ Inicio Fin, Esc closes and gives the focus back, a press outside closes. The menu opens
 * under its button (`right`: aligned to its right edge).
 */
export function MoreMenu({ items, label, right, kind = "dots" }: { items: MenuItem[]; label: string; right?: boolean; kind?: "dots" | "more" }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (box.current?.contains(t) || btn.current?.contains(t))) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", down, true);
    const f = window.setTimeout(() => box.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus({ preventScroll: true }), 20);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      window.clearTimeout(f);
    };
  }, [open]);
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) btn.current?.focus({ preventScroll: true });
  };
  const trigger =
    kind === "more" ? (
      <button ref={btn} type="button" className="vd-glass vd-press vd-btn tu-more-btn" data-menu-btn="1" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <TuIcon name="more" />
        <span>Más</span>
      </button>
    ) : (
      <button ref={btn} type="button" className="tu-more" data-menu-btn="1" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        <TuIcon name="more" />
      </button>
    );
  return (
    <div className={kind === "more" ? "tu-more-w" : "tu-nt__more"}>
      {trigger}
      {open && (
        <div
          ref={box}
          className={`vd-glass vd-glass--deep tu-pop${right ? " tu-pop--r" : ""}`}
          role="menu"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close(true);
              return;
            }
            roveIn(e, "[role=menuitem]");
          }}
        >
          {items.map((m) => (
            <button
              key={m.t}
              type="button"
              role="menuitem"
              className="tu-pop__i"
              onClick={() => {
                close(false);
                m.go();
              }}
            >
              <TuIcon name={m.icon} />
              <span>{m.t}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The «⋯» of a notice, a match's stack or the bell. */
export function DotsMenu({ items, label, right }: { items: MenuItem[]; label: string; right?: boolean }) {
  return <MoreMenu items={items} label={label} right={right} kind="dots" />;
}

export interface SegOpt<V extends string> {
  v: V;
  t: ReactNode;
  icon?: TuIconName;
  sub?: string;
  dis?: boolean;
}

/** The boards' segmented control (vd-seg with its bead; `bead` false hides it until something is chosen). */
export function Seg<V extends string>({ opts, value, onPick, label, labelledBy, cls = "", bead = true, nav }: { opts: SegOpt<V>[]; value: V | null; onPick: (v: V) => void; label?: string; labelledBy?: string; cls?: string; bead?: boolean; nav?: boolean }) {
  const i = Math.max(0, opts.findIndex((o) => o.v === value));
  return (
    <div className={`vd-glass vd-seg tu-oseg${cls ? ` ${cls}` : ""}`} role="group" aria-label={label} aria-labelledby={labelledBy} style={{ "--n": opts.length, "--i": i } as CSSProperties}>
      {bead && value !== null && <span className="vd-shelf__bead" aria-hidden="true" />}
      {opts.map((o) => (
        <button key={o.v} type="button" className="vd-seg__b" data-nav={nav ? "1" : undefined} aria-pressed={o.v === value} aria-disabled={o.dis || undefined} onClick={() => !o.dis && onPick(o.v)}>
          {o.icon && <TuIcon name={o.icon} />}
          {o.sub !== undefined ? (
            <span>
              <b>{o.t}</b>
              <small>{o.sub}</small>
            </span>
          ) : (
            o.t
          )}
        </button>
      ))}
    </div>
  );
}

/** The boards' switch (role switch; `dis` keeps it readable but inert). */
export function Switch({ on, onToggle, label, id, dis }: { on: boolean; onToggle: () => void; label: string; id?: string; dis?: boolean }) {
  return (
    <button type="button" className="vd-switch" id={id} role="switch" aria-checked={on} aria-disabled={dis || undefined} aria-label={label} onClick={() => !dis && onToggle()}>
      <span className="vd-switch__track" aria-hidden="true">
        <span className="vd-switch__knob" />
      </span>
    </button>
  );
}

