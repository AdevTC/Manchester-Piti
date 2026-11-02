// r14 «La pizarra» · the sheets host (the web's sheet frame: kicker, title, ×, Esc, focus trap, focus returned).
// Desktop: over the side column, never over the pitch. Tablet: over the right column. Phone: a modal from the
// bottom with its grabber, portaled to <body> (a container is the containing block of fixed boxes).
import { Suspense, useEffect, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { usePz } from "../store/context";
import { sheetReg } from "../store/registry";
import { PzIcon } from "../campo/Shirt";
import { MasRows, Missing } from "./parts";
import type { Layout } from "../store/types";

const FOCUSABLE = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';

function trap(e: KeyboardEvent<HTMLDivElement>, close: () => void) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    close();
    return;
  }
  if (e.key !== "Tab") return;
  const f = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null || x === document.activeElement);
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    last.focus();
    e.preventDefault();
  } else if (!e.shiftKey && document.activeElement === last) {
    first.focus();
    e.preventDefault();
  }
}

function SheetBody({ layout }: { layout: Layout }) {
  const P = usePz();
  const sh = P.state.sheet;
  if (!sh) return null;
  if (sh.name === "mas") return <MasRows />;
  const reg = sheetReg(sh.name);
  if (!reg?.Component) return <Missing icon="dots" title={P.sel.sheetMeta()?.title || sh.name} text="Esta hoja llega con su parte." />;
  const C = reg.Component;
  return (
    <Suspense fallback={<p className="pz-meta">Cargando…</p>}>
      <C layout={layout} args={sh.args} />
    </Suspense>
  );
}

export function SheetFrame({ layout }: { layout: Layout }) {
  const P = usePz();
  const sh = P.state.sheet;
  const box = useRef<HTMLDivElement | null>(null);
  const from = useRef<Element | null>(null);
  const name = sh?.name ?? null;
  // focus moves into the sheet when it opens and back to what opened it when it closes
  useEffect(() => {
    if (!name) return;
    from.current = document.activeElement;
    const t = setTimeout(() => box.current?.querySelector<HTMLElement>(".pz-s__x")?.focus(), 30);
    return () => {
      clearTimeout(t);
      const back = from.current as HTMLElement | null;
      setTimeout(() => {
        if (back?.isConnected) back.focus();
      }, 30);
    };
  }, [name]);
  if (!sh) return null;
  const meta = P.sel.sheetMeta();
  const title = meta?.title || (sh.name === "mas" ? "Más" : sh.name === "compartir" ? "Compartir" : sh.name === "ajustes" ? "Ajustes de la pizarra" : sh.name);
  const close = () => P.act.closeSheet();
  const head = (
    <div className="pz-s__shead">
      <div>
        <p>{meta?.kicker}</p>
        <h2 id="pz-sh-h">{title}</h2>
      </div>
      <button type="button" className="vd-glass vd-press nx-ib pz-s__x" onClick={close} aria-label="Cerrar" aria-keyshortcuts="Escape">
        <PzIcon name="close" />
      </button>
    </div>
  );
  if (layout !== "phone") {
    return (
      <div ref={box} className={`vd-glass vd-glass--deep pz-s__panel${sheetReg(sh.name)?.wide ? " is-wide" : ""}`} role="dialog" aria-modal="false" aria-labelledby="pz-sh-h" onKeyDown={(e) => trap(e, close)}>
        {head}
        <div className="pz-s__sbody">
          <SheetBody layout={layout} />
        </div>
      </div>
    );
  }
  return createPortal(
    <div className="pz pz-float pz-l-phone">
      <button type="button" className="pz-s__scrim" aria-label="Cerrar" tabIndex={-1} onClick={close} />
      <div ref={box} className="vd-glass vd-glass--deep pz-s__modal" role="dialog" aria-modal="true" aria-labelledby="pz-sh-h" onKeyDown={(e) => trap(e, close)}>
        <button type="button" className="pz-s__grab" onClick={close} aria-label="Cerrar la hoja" />
        {head}
        <div className="pz-s__sbody">
          <SheetBody layout={layout} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
