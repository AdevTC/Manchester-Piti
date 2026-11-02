// r14 «La pizarra» · the shell (PiPizarra.dc.html, SHELL-API.md): the web's top bar, the board bar with the places
// (desktop/tablet) or the phone header + the pizarra dock, the stage with THE pitch (still between places:
// view-transition-name pz-stage), each place's regions, the sheets host, the toast, the announcer, the drag ghost,
// the states (cargando · error al leer · sin conexión), the door, the 404 and the charla takeover. Places only
// render their regions: lead · side (desktop) · lead + side stacked (tablet) · peek / panel (phone sheet) · stage
// (Tableros' gallery) · full (the charla) · dock (Dibujar).
import { Suspense, useEffect, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CelesteHeader } from "../../../../components/celeste/Chrome";
import { VidrioSky } from "../../../../components/vidrio";
import { useTheme } from "../../../../hooks/useTheme";
import { usePz } from "../store/context";
import { placeReg, toolReg } from "../store/registry";
import { placeOf } from "../store/store";
import { PiCampo } from "../campo/PiCampo";
import { BoardBar, Dock, FullState, Ghost, Missing, PhoneHeader, ReadError, Skeleton, Toast } from "./parts";
import { SheetFrame } from "./SheetFrame";
import type { Layout, PlaceId, Region, SheetHeight } from "../store/types";
import "../../../../styles/vidrio/tokens.css";
import "../../../../styles/vidrio/glass.css";
import "../../../../styles/vidrio/components.css";
import "../../../../styles/vidrio/reading.css";
import "../../../../styles/vidrio/sky.css";
import "../../../../styles/vidrio-paginas.css";
import "../../../../styles/palco/palco.css";
import "../../../../styles/pz/kit.css";
import "../../../../styles/pz/base.css";
import "../../../../styles/pz/shell.css";

const ORDER: SheetHeight[] = ["peek", "half", "full"];

/** A place's region (its registered component), or the calm placeholder while the place isn't built. */
function Region({ place, region, layout }: { place: PlaceId; region: Region; layout: Layout }) {
  const C = placeReg(place)?.Component;
  const pl = placeOf(place);
  if (!C) return region === "lead" || region === "peek" || region === "full" ? <Missing icon={pl?.icon ?? "dots"} title={pl?.t ?? place} text="Esta parte de la pizarra llega con su propio archivo. El campo ya está listo para ella." /> : null;
  return (
    <Suspense fallback={null}>
      <C region={region} layout={layout} />
    </Suspense>
  );
}

function Stage({ layout, place, children }: { layout: Layout; place: PlaceId | null; children?: ReactNode }) {
  const P = usePz();
  const S = P.state;
  const none = P.sel.stage().source === "none";
  const Draw = toolReg("dibujar");
  const dim = S.estado === "cargando" || S.estado === "error";
  return (
    <div className={`pz-s__stage${dim ? " is-dim" : ""}`} aria-label="El campo">
      {!none && <PiCampo layout={layout} main />}
      {none && place && <Region place={place} region="stage" layout={layout} />}
      {S.drawing && Draw && (
        <Suspense fallback={null}>
          <Draw region="dock" layout={layout} />
        </Suspense>
      )}
      {S.drawing && !Draw && (
        <div className="pz-s__over">
          <div className="vd-glass">
            <b>Dibujar</b>
            <p>La caja de herramientas llega con su parte.</p>
            <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.setDrawing(false)}>
              Listo
            </button>
          </div>
        </div>
      )}
      {dim && (
        <div className="pz-s__over">
          <div className="vd-glass" role="status">
            <b>{S.estado === "cargando" ? "Cargando la plantilla y tus tableros…" : "Sin leer"}</b>
            <p>{S.estado === "cargando" ? "En un momento" : "Reintenta desde el panel"}</p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

function Body({ layout, place }: { layout: Layout; place: PlaceId }) {
  const P = usePz();
  const S = P.state;
  const loading = S.estado === "cargando";
  const error = S.estado === "error";
  const ok = !loading && !error;
  const pl = placeOf(place);
  const sheet = !!S.sheet;
  const grabT = useRef(0);
  if (layout === "desktop") {
    return (
      <main className="pz-s__body" id="pz-main">
        <section className="pz-s__lead" aria-label={pl?.t}>
          <div className="pz-s__slot">
            {ok && <Region place={place} region="lead" layout={layout} />}
            {loading && <Skeleton phone={false} />}
            {error && <ReadError phone={false} why={S.error} onRetry={() => P.act.retry()} />}
          </div>
        </section>
        <Stage layout={layout} place={place} />
        <aside className="pz-s__side" aria-label={`${pl?.t ?? ""}: ${place === "siete" ? "el banquillo" : "detalle"}`}>
          <div className={`pz-s__slot${sheet ? " is-under" : ""}`}>{ok && <Region place={place} region="side" layout={layout} />}</div>
          <SheetFrame layout={layout} />
        </aside>
      </main>
    );
  }
  if (layout === "tablet") {
    return (
      <main className="pz-s__body" id="pz-main">
        <Stage layout={layout} place={place} />
        <div className="pz-s__right">
          <div className={`pz-s__rin${sheet ? " is-under" : ""}`}>
            {ok && <Region place={place} region="lead" layout={layout} />}
            {ok && <Region place={place} region="side" layout={layout} />}
            {loading && <Skeleton phone={false} />}
            {error && <ReadError phone={false} why={S.error} onRetry={() => P.act.retry()} />}
          </div>
          <SheetFrame layout={layout} />
        </div>
      </main>
    );
  }
  // the phone: the pitch, the bottom sheet (peek · half · full), the dock
  const h = S.sheetH;
  const setH = (x: SheetHeight) => P.act.setSheetHeight(x);
  const grabDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const y0 = e.clientY;
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointerup", up);
      const dy = ev.clientY - y0;
      if (Math.abs(dy) < 30) return;
      grabT.current = Date.now() + 300;
      const i = ORDER.indexOf(P.state.sheetH);
      setH(ORDER[Math.max(0, Math.min(2, i + (dy < 0 ? 1 : -1) * (Math.abs(dy) > 220 ? 2 : 1)))]);
    };
    window.addEventListener("pointerup", up);
  };
  return (
    <>
      <main className="pz-s__stagewrap" id="pz-main">
        <Stage layout={layout} place={place} />
      </main>
      <section className={`vd-glass vd-glass--deep pz-s__sheet is-${h}`} aria-label={`${pl?.t ?? ""} · ${h === "peek" ? "abajo" : h === "half" ? "a media altura" : "entera"}`}>
        <button
          type="button"
          className="pz-s__grab"
          onClick={() => {
            if (Date.now() < grabT.current) return;
            setH(({ peek: "half", half: "full", full: "peek" } as const)[h]);
          }}
          onPointerDown={grabDown}
          onKeyDown={(e) => {
            const i = ORDER.indexOf(h);
            if (e.key === "ArrowUp" && i < 2) {
              e.preventDefault();
              setH(ORDER[i + 1]);
            }
            if (e.key === "ArrowDown" && i > 0) {
              e.preventDefault();
              setH(ORDER[i - 1]);
            }
          }}
          aria-label={h === "full" ? "Bajar la hoja" : "Subir la hoja"}
          aria-keyshortcuts="ArrowUp ArrowDown"
        />
        <div className="pz-s__sheetin">
          {ok && <Region place={place} region={h === "peek" ? "peek" : "panel"} layout={layout} />}
          {loading && <Skeleton phone />}
          {error && <ReadError phone why={S.error} onRetry={() => P.act.retry()} />}
        </div>
      </section>
      <Dock />
      <SheetFrame layout={layout} />
    </>
  );
}

export function Shell() {
  const P = usePz();
  const S = P.state;
  const { theme } = useTheme();
  const layout = S.layout;
  const phone = layout === "phone";
  const route = S.route;
  const place = route.place === "perdido" ? null : route.place;
  const m = S.me;
  const lost = route.place === "perdido";
  const charla = place === "charla" && !m.fuera;
  const sheetH = phone ? (S.sheetH === "full" ? "calc(100% - 196px)" : S.sheetH === "half" ? "262px" : "150px") : "0px";
  const vars = { "--sh": sheetH, "--peek": "150px", "--stb": S.sheetH === "peek" ? "150px" : "262px" } as CSSProperties;
  const xl = typeof window !== "undefined" && window.matchMedia?.("(min-width: 1800px)").matches;

  // Ctrl Z / Ctrl ⇧ Z / Ctrl Y and Esc (sheet → drawing → charla → the hand)
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented) return;
    const t = e.target as HTMLElement;
    const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && (k === "z" || k === "Z") && !typing) {
      e.preventDefault();
      if (e.shiftKey) P.act.redo();
      else P.act.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (k === "y" || k === "Y") && !typing) {
      e.preventDefault();
      P.act.redo();
      return;
    }
    if (k === "Escape") {
      if (S.sheet) {
        P.act.closeSheet();
        e.preventDefault();
        return;
      }
      if (S.drawing) {
        P.act.setDrawing(false);
        return;
      }
      if (route.place === "charla") {
        P.nav("/pizarra/siete");
        return;
      }
      if (S.sel) P.act.release();
    }
  };
  // a document title that says where you are
  useEffect(() => {
    const pl = place ? placeOf(place) : null;
    document.title = (pl ? pl.t + " · " : "") + "La pizarra · Manchester Piti";
  }, [place]);

  const cls = ["vx", "vd-pg", "pz", "pz-s", `nx--${layout === "desktop" ? "desk" : layout === "tablet" ? "tab" : "phone"}`, `pz-l-${layout}`, xl ? "pz-s--xl" : "", phone && S.sheet ? "is-modal" : "", phone && S.sheetH === "full" && !S.sheet ? "is-full" : "", charla ? "pz-s--charla" : "", S.drag ? "is-dragging" : "", theme === "light" ? "is-dia" : ""].filter(Boolean).join(" ");

  return (
    <div className={cls} style={vars} onKeyDown={onKey} lang="es">
      <VidrioSky light={theme === "light" ? "noon" : "noche"} floodlit={false} />
      <CelesteHeader active="vestuario" />
      <div className="pz-s__frame">
        {m.fuera ? (
          <FullState id="pz-door-h" kicker="La pizarra · Manchester Piti" title="La pizarra es del equipo" line="El siete de cada partido, las jugadas y la charla del domingo. Entra con la cuenta del vestuario.">
            <a className="vd-glass vd-press pz-btn pz-btn--pri" href="/vestuario">
              Entrar al vestuario
            </a>
          </FullState>
        ) : lost ? (
          <FullState id="pz-404-h" kicker={route.sub || "/pizarra/…"} title="Esta parte de la pizarra no existe" line="El enlace es antiguo o está mal copiado. Tu siete sigue donde lo dejaste.">
            <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => P.nav("/pizarra/siete")}>
              Volver al siete
            </button>
            <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.nav("/pizarra/tableros")}>
              Ver los tableros
            </button>
          </FullState>
        ) : place ? (
          <>
            {phone ? <PhoneHeader /> : <BoardBar xl={!!xl} />}
            <Body layout={layout} place={place} />
          </>
        ) : null}
      </div>
      {charla && (
        <div className="pz-s__takeover">
          <Region place="charla" region="full" layout={layout} />
        </div>
      )}
      {typeof document !== "undefined" &&
        createPortal(
          <div className={`pz pz-float pz-l-${layout}${charla ? " pz-s--charla" : ""}`} style={vars}>
            <Toast />
            <Ghost />
          </div>,
          document.body,
        )}
    </div>
  );
}
