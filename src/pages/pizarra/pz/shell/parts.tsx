// r14 «La pizarra» · the shell's pieces (SHELL-API): the board bar with the places, the phone header, the pizarra
// dock, the toast with «Deshacer», the drag ghost, the announcer. Ported from PiPizarra.dc.html.
import { useEffect, useRef, type ReactNode } from "react";
import { usePz } from "../store/context";
import { PLACES } from "../store/store";
import { fmt } from "../store/fmt";
import { PzIcon, CampoShirt } from "../campo/Shirt";
import type { Layout, PlaceId } from "../store/types";

const placeHref = (id: PlaceId) => "/pizarra/" + id;

/** The board's line: its name, the match, the save state. */
export function useBoardLine(phone: boolean) {
  const P = usePz();
  const b = P.sel.board();
  const M = P.sel.match();
  const save = P.sel.saveLine();
  const matchT = M ? (b && b.name.includes(M.rival) ? "" : `${M.j ? "J" + M.j + " · " : ""}${M.rival} · `) + fmt.day(M.at) + (M.at ? " · " + fmt.hm(M.at) : "") : "Sin partido";
  return { name: b ? b.name : "Sin tablero", match: matchT + (phone ? "" : " · "), save, aria: `Tablero ${b ? b.name : "sin tablero"}, ${save.t}: ver los tableros` };
}

export function BoardBar({ xl }: { xl: boolean }) {
  const P = usePz();
  const S = P.state;
  const place = S.route.place;
  const line = useBoardLine(false);
  const pri = P.sel.primary(place === "perdido" ? "siete" : place);
  const desk = S.layout === "desktop";
  const label = pri ? (desk && !xl && pri.short && pri.label.length > 16 ? pri.short : pri.label) : "";
  const openShare = () => P.act.openSheet(P.sel.shareSheet(), {}, { title: "Compartir" });
  return (
    <div className="vd-glass pz-s__bar" role="navigation" aria-label="La pizarra">
      <button type="button" className="pz-s__board" onClick={() => P.nav(placeHref("tableros"))} aria-label={line.aria}>
        <span>
          <b>{line.name}</b>
          <small>
            {line.match}
            <span className={`pz-s__save is-${line.save.tone}`}>
              <PzIcon name={line.save.icon || "check"} />
              {line.save.t}
            </span>
          </small>
        </span>
        <PzIcon name="chevR" />
      </button>
      <span className="pz-s__sep" aria-hidden="true" />
      <div className="pz-s__places">
        {PLACES.filter((x) => !x.hidden).map((x) => {
          const bd = P.sel.placeBadge(x.id);
          const sub = P.sel.placeSub(x.id);
          const cur = x.id === place;
          return (
            <button key={x.id} type="button" className="pz-s__place" aria-current={cur ? "page" : undefined} onClick={() => !cur && P.nav(placeHref(x.id))} aria-label={`${x.t}: ${bd ? (bd.word ? bd.word + ", " : "") + bd.t : sub}`} aria-keyshortcuts={`Alt+${x.key}`}>
              <PzIcon name={x.icon} />
              <span>
                <b>{x.t}</b>
                {bd ? (
                  <small className={`pz-s__live${bd.live ? " is-on" : ""}`}>
                    <i aria-hidden="true" />
                    {bd.word} <span className="tt">{bd.t}</span>
                  </small>
                ) : (
                  <small>{sub}</small>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="pz-s__acts">
        <button type="button" className="vd-glass vd-press nx-ib" onClick={() => P.act.undo()} disabled={!P.sel.canUndo()} aria-label={P.sel.canUndo() ? "Deshacer: " + P.sel.undoLabel() : "Nada que deshacer"} aria-keyshortcuts="Control+Z">
          <PzIcon name="undoA" />
        </button>
        <button type="button" className="vd-glass vd-press nx-ib" onClick={() => P.act.redo()} disabled={!P.sel.canRedo()} aria-label={P.sel.canRedo() ? "Rehacer: " + P.sel.redoLabel() : "Nada que rehacer"} aria-keyshortcuts="Control+Shift+Z Control+Y">
          <PzIcon name="redo" />
        </button>
        <button type="button" className="vd-glass vd-press pz-btn pz-s__share" onClick={openShare} aria-label="Compartir">
          <PzIcon name="share" />
          <span>Compartir</span>
        </button>
        {pri && (
          <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri pz-s__pri" onClick={pri.run} disabled={!!pri.disabled}>
            <PzIcon name={pri.icon || "arrow"} />
            {label}
          </button>
        )}
      </div>
    </div>
  );
}

export function PhoneHeader() {
  const P = usePz();
  const line = useBoardLine(true);
  const live = P.sel.placeBadge("partido");
  const short = line.save.tone === "ok" ? "Guardado" : line.save.t.split(" · ")[0];
  return (
    <div className="pz-s__ph">
      <button type="button" className="pz-s__phb" onClick={() => P.nav(placeHref("tableros"))} aria-label={line.aria}>
        <span>
          <b>{line.name}</b>
          <small>{line.match}</small>
        </span>
        <PzIcon name="chevR" />
      </button>
      {live && (
        <span className={`vd-glass pz-s__chip pz-s__live${live.live ? " is-on" : ""}`} role="status" aria-label={(live.word ?? "") + " " + live.t}>
          <i aria-hidden="true" />
          <span className="tt">{live.t}</span>
        </span>
      )}
      {line.save.t && (
        <span className={`vd-glass pz-s__chip is-${line.save.tone}${live ? " is-icon" : ""}`} role="status" aria-label={line.save.t}>
          <PzIcon name={line.save.icon || "check"} />
          <span className="pz-s__chipt">{short}</span>
        </span>
      )}
      <button type="button" className="vd-glass vd-press nx-ib" onClick={() => P.act.undo()} disabled={!P.sel.canUndo()} aria-label={P.sel.canUndo() ? "Deshacer: " + P.sel.undoLabel() : "Nada que deshacer"}>
        <PzIcon name="undoA" />
      </button>
    </div>
  );
}

export function Dock() {
  const P = usePz();
  const place = P.state.route.place;
  const items = (["siete", "plan", "jugadas", "partido"] as const).map((id) => PLACES.find((x) => x.id === id) ?? PLACES[0]);
  return (
    <nav className="vd-glass pz-s__dock" aria-label="La pizarra">
      {items.map((x) => (
        <button key={x.id} type="button" aria-current={place === x.id ? "page" : undefined} onClick={() => place !== x.id && P.nav(placeHref(x.id))}>
          <PzIcon name={x.icon} />
          {x.t}
        </button>
      ))}
      <button type="button" aria-current={place === "tableros" || place === "pachanga" ? "page" : undefined} onClick={() => P.act.openSheet("mas", {}, { title: "Más" })}>
        <PzIcon name="dots" />
        Más
      </button>
    </nav>
  );
}

/** The toast (web style, never over a control) and the aria-live announcer. */
export function Toast() {
  const P = usePz();
  const t = P.state.toast;
  return (
    <>
      {t && (
        <div className="vx-toast" role="status">
          <PzIcon name={t.icon} />
          <span>{t.text}</span>
          {t.undo && (
            <button
              type="button"
              className="pz-s__tact"
              onClick={() => {
                const u = t.undo;
                P.act.dismissToast();
                u?.();
              }}
            >
              Deshacer
            </button>
          )}
          {t.action && (
            <button
              type="button"
              className="pz-s__tact"
              onClick={() => {
                const a = t.action;
                P.act.dismissToast();
                a?.run();
              }}
            >
              {t.action.t}
            </button>
          )}
        </div>
      )}
      <p className="pz-vh" aria-live="polite" role="status">
        {P.state.say}
      </p>
    </>
  );
}

/** The shirt that follows the pointer while dragging (positioned by the store's controller, no re-render). */
export function Ghost() {
  const P = usePz();
  const el = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    P.drag.onGhost((x, y) => {
      if (el.current) el.current.style.transform = `translate(${x - 27}px,${y - 46}px)`;
    });
    return () => P.drag.onGhost(null);
  }, [P]);
  const d = P.state.drag;
  return (
    <div className="pz-s__ghost" ref={el} aria-hidden="true" style={d ? { transform: `translate(${d.x - 27}px,${d.y - 46}px)` } : undefined}>
      {d && (
        <>
          <CampoShirt still={P.sel.shirt(d.pid)} className="pz-s__gshirt" />
          <b>{d.label}</b>
        </>
      )}
    </div>
  );
}

/** «Más» (the phone's fifth dock item) and the account: the shell's own sheets. */
export function MasRows() {
  const P = usePz();
  const rows: { t: string; s: string; icon: string; go: () => void; href?: string }[] = [
    { t: "Tableros", s: P.sel.placeSub("tableros") + " · los tuyos, el oficial y los del equipo", icon: "boards", go: () => P.nav("/pizarra/tableros") },
    { t: "Pachanga", s: "Equipos para el entreno", icon: "bib", go: () => P.nav("/pizarra/pachanga") },
    { t: "Compartir", s: "El cartel, la jugada en vídeo, el enlace", icon: "share", go: () => P.act.openSheet(P.sel.shareSheet(), {}, { title: "Compartir" }) },
    { t: "Ajustes de la pizarra", s: "Sonido, cámara, capa, animaciones", icon: "gear", go: () => P.act.openSheet("ajustes", {}, { title: "Ajustes de la pizarra" }) },
  ];
  return (
    <div className="pz-rows">
      {rows.map((r) => (
        <button key={r.t} type="button" className="pz-row" onClick={r.go}>
          <span className="vx-tile">
            <PzIcon name={r.icon} />
          </span>
          <span className="pz-row__t">
            <b>{r.t}</b>
            <span>{r.s}</span>
          </span>
          <PzIcon name="chevR" />
        </button>
      ))}
      <a className="pz-row" href="/">
        <span className="vx-tile">
          <PzIcon name="home" />
        </span>
        <span className="pz-row__t">
          <b>Volver a la web</b>
          <span>Inicio del club</span>
        </span>
        <PzIcon name="chevR" />
      </a>
    </div>
  );
}

/** A calm placeholder for a part not built yet. */
export function Missing({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="pz-ph">
      <span className="vx-tile">
        <PzIcon name={icon} />
      </span>
      <b>{title}</b>
      <span>{text}</span>
    </div>
  );
}

export function Skeleton({ phone }: { phone: boolean }) {
  return (
    <div className="pz-s__skel" aria-busy="true">
      {!phone && <p className="pz-kick">La pizarra</p>}
      <p className="pz-h1" role="status" style={{ fontSize: phone ? 26 : 40 }}>
        Cargando tus tableros…
      </p>
      <i style={{ width: "70%" }} />
      <i style={{ width: "55%" }} />
      <i className="h" />
      {!phone && <i style={{ width: "80%" }} />}
    </div>
  );
}

export function ReadError({ phone, why, onRetry }: { phone: boolean; why: string; onRetry: () => void }) {
  return (
    <div className="pz-hero" role="alert">
      {!phone && <p className="pz-kick">La pizarra</p>}
      <h1 className="pz-h1" style={{ fontSize: phone ? 26 : 44 }}>
        No se han podido leer tus tableros
      </h1>
      <p className="pz-line">{why || "Sin conexión con el club. No es que no tengas: tus tableros siguen guardados en el servidor."}</p>
      <div className="pz-acts" style={{ marginTop: 10 }}>
        <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={onRetry}>
          Reintentar
        </button>
      </div>
    </div>
  );
}

/** A full-page state (the pizarra's 404, the door): a blurred pitch beside the words. */
export function FullState({ id, kicker, title, line, children }: { id: string; kicker: string; title: string; line: string; children: ReactNode }) {
  return (
    <main className="pz-s__full" id="contenido-pz" aria-labelledby={id}>
      <div className="pz-s__ghostpitch" aria-hidden="true" />
      <section className="pz-hero">
        <p className="pz-kick">{kicker}</p>
        <h1 className="pz-h1" id={id}>
          {title}
        </h1>
        <p className="pz-line">{line}</p>
        <div className="pz-acts" style={{ marginTop: 14 }}>
          {children}
        </div>
      </section>
    </main>
  );
}

export const isPhone = (l: Layout) => l === "phone";
