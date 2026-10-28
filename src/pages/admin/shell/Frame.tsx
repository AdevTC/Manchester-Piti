// The Sala de control's frame in its three forms (r12 boards SC-Admin390/820/1440/1920, shell.html):
//   desktop (≥ 1100): the web's top bar — the crest and «Sala de control» (with the season under it), the glass
//     capsule «Hoy · Partidos · Plantilla · Caja · Club» with its bead and counters, «Buscar ⌘K», «Ver la web ↗» and
//     the avatar with the armband and its menu;
//   tablet (700–1099) and phone: the header with the screen's title, its line and «‹» when it has a way back, the
//     search and the avatar; at the foot the glass dock with the five places and their counters (hidden inside a
//     match, a ficha or any screen with a way back).
// Then the offline line (M-22), the screen (the one <main>, B-SH-04) and the status strip. The light field is
// behind everything; glass only on what is touched.
import { useRef, type ReactNode, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { VidrioSky } from "../../../components/vidrio/VidrioSky";
import { VIcon } from "../../../components/vidrio/VIcon";
import { useBead } from "../../../components/celeste/bead";
import { useLightPointer } from "../../../components/vidrio/useLightPointer";
import { AccountButton, type Viewer } from "./Account";
import { SalaLink } from "./SalaLink";
import { goKeys, placeLabel, PLACES, type PlaceKey } from "./places";
import type { SalaSeason } from "./season";
import { OFFLINE_LINE } from "./season";
import { StatusStrip } from "./StatusStrip";
import type { SalaHead } from "./head";

export interface FrameProps {
  /** `door`: someone without the armband — no places, no search. */
  mode: "sala" | "door";
  /** The place lit (null: none, as on a not-found address). */
  place: PlaceKey | null;
  head: SalaHead;
  counts?: Record<PlaceKey, number>;
  viewer: Viewer;
  season?: SalaSeason | null;
  online: boolean;
  /** The status strip at rest. */
  rest: string;
  dark: boolean;
  onTheme: () => void;
  onSearch?: () => void;
  /** ≥ 1100 (the frame's width, measured). */
  desktop: boolean;
  /** The app (inert while a modal layer is open). */
  appRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

export function SalaFrame({ mode, place, head, counts, viewer, season, online, rest, dark, onTheme, onSearch, desktop, appRef, children }: FrameProps) {
  const sala = mode === "sala";
  const dock = sala && !desktop && !head.back;
  return (
    <>
      <VidrioSky light="noche" floodlit={false} />
      <div ref={appRef} className={`sc-app${dock ? " has-dock" : ""}`}>
        {desktop && <TopBar sala={sala} place={place} counts={counts} viewer={viewer} season={season} dark={dark} onTheme={onTheme} onSearch={onSearch} />}
        {!desktop && (
          <header className="sc-phead">
            {head.back && (
              <SalaLink className="vd-ibtn vd-glass vd-press sc-phead__back" to={head.back.to} aria-label={head.back.label}>
                <VIcon name="chevL" size={20} />
              </SalaLink>
            )}
            <div className="sc-phead__t">
              <p className="sc-phead__h">{head.title}</p>
              {head.sub && <p>{head.sub}</p>}
            </div>
            {sala && onSearch && (
              <button type="button" className="vd-ibtn vd-glass vd-press" onClick={onSearch} aria-label="Buscar" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K">
                <VIcon name="search" size={20} />
              </button>
            )}
            <AccountButton viewer={viewer} phone season={season} dark={dark} onTheme={onTheme} />
          </header>
        )}
        {!online && (
          <p className="sc-offline" role="status">
            <VIcon name="wifiOff" size={20} />
            <span>
              <b>Sin conexión.</b> {OFFLINE_LINE}
            </span>
          </p>
        )}
        <main id="contenido" className="sc-main" tabIndex={-1}>
          {children}
        </main>
        <StatusStrip rest={rest} />
        {dock && <Dock place={place} counts={counts} />}
      </div>
    </>
  );
}

function TopBar({ sala, place, counts, viewer, season, dark, onTheme, onSearch }: { sala: boolean; place: PlaceKey | null; counts?: Record<PlaceKey, number>; viewer: Viewer; season?: SalaSeason | null; dark: boolean; onTheme: () => void; onSearch?: () => void }) {
  const capsule = useRef<HTMLDivElement | null>(null);
  useBead(capsule, "sala-capsule", place ?? undefined, JSON.stringify(counts ?? {}));
  useLightPointer(capsule);
  return (
    <header className="vx-top sc-top">
      <Link className="vx-brand sc-brand" to="/admin" aria-label={sala ? "Sala de control, Hoy" : "Sala de control"}>
        <img src="/crest-128.webp" alt="" width={36} height={36} />
        <span className="sc-brand__t">
          <span className="sc-brand__name">Sala de control</span>
          {season?.season && <span className="sc-brand__season">{season.season.name}</span>}
        </span>
      </Link>
      {sala ? (
        <nav className="vx-nav sc-nav" aria-label="Sala de control">
          <div ref={capsule} className="vx-nav-in vd-glass">
            <span className="vd-bead" aria-hidden="true" />
            {PLACES.map((p) => {
              const on = p.key === place;
              const n = counts?.[p.key] ?? 0;
              return (
                <span key={p.key} className="vx-nav-item">
                  <SalaLink to={p.path} className={on ? "on" : undefined} aria-current={on ? "page" : undefined} aria-label={placeLabel(p.name, n)} aria-keyshortcuts={goKeys(p.key)}>
                    {p.name}
                    {n > 0 && (
                      <i className="sc-count" aria-hidden="true">
                        {n}
                      </i>
                    )}
                  </SalaLink>
                </span>
              );
            })}
          </div>
        </nav>
      ) : (
        <span aria-hidden="true" />
      )}
      <div className="vx-actions sc-actions">
        {sala && onSearch && (
          <button type="button" className="sr-btn sc-search vd-glass vd-press" onClick={onSearch} aria-label="Buscar (Ctrl K)" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K">
            <VIcon name="search" size={20} />
            <span className="sc-search__t">Buscar</span>
            <kbd className="sc-search__k" aria-hidden="true">
              ⌘K
            </kbd>
          </button>
        )}
        <a className="vd-btn vd-glass vd-press vd-btn--sm sc-web" href="/" target="_blank" rel="noopener">
          Ver la web
          <VIcon name="expand" size={16} />
          <span className="vd-vh"> (se abre en otra pestaña)</span>
        </a>
        <AccountButton viewer={viewer} season={season} dark={dark} onTheme={onTheme} />
      </div>
    </header>
  );
}

function Dock({ place, counts }: { place: PlaceKey | null; counts?: Record<PlaceKey, number> }) {
  const cap = useRef<HTMLDivElement | null>(null);
  useBead(cap, "sala-dock", place ?? undefined, JSON.stringify(counts ?? {}));
  return (
    <nav className="sc-dock vd-glass" aria-label="Sala de control">
      <div ref={cap} className="sc-dock__in">
        <span className="vd-bead" aria-hidden="true" />
        {PLACES.map((p) => {
          const on = p.key === place;
          const n = counts?.[p.key] ?? 0;
          return (
            <SalaLink key={p.key} to={p.path} className="sc-dock__a" aria-current={on ? "page" : undefined} aria-label={placeLabel(p.name, n)} aria-keyshortcuts={goKeys(p.key)}>
              <span className="sc-dock__i">
                <VIcon name={p.icon} size={22} />
                {n > 0 && (
                  <i className="sc-count" aria-hidden="true">
                    {n}
                  </i>
                )}
              </span>
              <span className="sc-dock__l" aria-hidden="true">
                {p.name}
              </span>
            </SalaLink>
          );
        })}
      </div>
    </nav>
  );
}
