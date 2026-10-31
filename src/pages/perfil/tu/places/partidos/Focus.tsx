// Tus partidos › the jornada in focus: A's match sheet (TuFicha tf-md) — the big nota and its band word against
// his average, the result with G/E/P (our score first), his minutes on the match's real length with its stints,
// the acta's figures that exist, «Ver el acta» — shown inline under the river on desktop (C's focus panel, with
// its J±1 in the head) and as a sheet on the phone (with A's ‹ ›). What isn't played: «No jugaste» / the
// absence with its why; the next one with his convocatoria; the ones to come with their date.
import { useEffect, useRef, useSyncExternalStore, type KeyboardEvent, type Ref } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { TuIcon } from "../../../../../components/vidrio/tu/ui";
import { resultTitle } from "../../../../../lib/derived/result";
import { SheetFrame } from "../../../../stats/palco/kit";
import type { Focus } from "../partidosView";
import { RsvpSeg, type Rsvp } from "./River";

/** The sheet's body and the panel's (everything but the head). `arrows`: A's ‹ › around «Ver el acta» (the sheet). */
export function MatchBody({ fo, rsvp, go, arrows, inline }: { fo: Focus; rsvp: Rsvp | null; go: (i: number) => void; arrows: boolean; inline: boolean }) {
  const r = fo.r;
  const acta = (
    <Link className="nx-lnk" to="/partidos/$matchId" params={{ matchId: r.matchId }}>
      {fo.mode === "next" || fo.mode === "up" ? "Ver la previa" : "Ver el acta"}
      <TuIcon name="arrow" className="nx-ic" />
    </Link>
  );
  const nav = arrows ? (
    <div className="tf-md__nav">
      <button type="button" className="tf-md__arrow" onClick={() => fo.prev && go(fo.prev.i)} disabled={!fo.prev} aria-label={fo.prev?.aria ?? "No hay jornada anterior"}>
        <TuIcon name="chev-l" className="nx-ic" />
        {fo.prev?.t ?? "Anterior"}
      </button>
      {acta}
      <button type="button" className="tf-md__arrow" onClick={() => fo.next && go(fo.next.i)} disabled={!fo.next} aria-label={fo.next?.aria ?? "No hay jornada siguiente"}>
        {fo.next?.t ?? "Siguiente"}
        <TuIcon name="chev-r" className="nx-ic" />
      </button>
    </div>
  ) : (
    <div className="tk-acts tp-md__acts">{acta}</div>
  );
  const res = r.result && (
    <p className="tf-md__res">
      <span className={`tf-res is-${r.result}`} aria-hidden="true">
        {r.result}
      </span>
      <span className="nx-vh">{resultTitle(r.result)}: </span>
      <b>{fo.score}</b>
      {fo.resLine}
    </p>
  );
  if (fo.mode === "played") {
    const a = (
      <>
        <div className="tf-md__hero">
          <span className={`tf-nb tf-nb--hero is-${fo.band}`}>{fo.notaT}</span>
          <div>
            <b>{fo.word}</b>
            <span>{fo.notaLine}</span>
            {r.mvp && <span className="tt-mvp tp-mvp">MVP de la jornada</span>}
          </div>
        </div>
        {res}
        <div className="tf-stint">
          <p className="tp-k">Tus minutos</p>
          <div className="tf-stint__bar" role="img" aria-label={fo.stintAria}>
            {fo.stints.map((s) => (
              <i key={s.left} style={{ left: s.left, width: s.width }} />
            ))}
          </div>
          <div className="tf-stint__ax" aria-hidden="true">
            <span>0′</span>
            <span>{fo.half}</span>
            <span>{fo.durT}</span>
          </div>
          <p>{fo.stintT}</p>
        </div>
      </>
    );
    const b = (
      <>
        {fo.ledger.length > 0 && (
          <div>
            <p className="tp-k">Lo tuyo en el acta</p>
            <dl className="tf-led">
              {fo.ledger.map((f) => (
                <div key={f.k}>
                  <dt>{f.k}</dt>
                  <dd>
                    <b>{f.v}</b>
                    {f.s && <span>{f.s}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {nav}
      </>
    );
    return inline ? (
      <div className="tf-md tp-md">
        <div className="tp-md__a">{a}</div>
        <div className="tp-md__b">{b}</div>
      </div>
    ) : (
      <>
        {a}
        {b}
      </>
    );
  }
  const body = (
    <>
      {fo.mode === "out" && (
        <>
          {res}
          <div className="tf-md__out">
            <b>{fo.outT}</b>
            <p>{fo.outLine}</p>
          </div>
        </>
      )}
      {(fo.mode === "next" || fo.mode === "up") && <p className="tp-lead">{fo.lead}</p>}
      {fo.mode === "next" && rsvp && rsvp.matchId === r.matchId && (
        <div className="vd-glass vd-glass--deep tk-card tp-vas">
          <p className="tk-card__k">{rsvp.question}</p>
          <RsvpSeg rsvp={rsvp} />
          <p className="nx-meta">{rsvp.body}</p>
        </div>
      )}
      {nav}
    </>
  );
  return inline ? <div className="tf-md tp-md tp-md--other">{body}</div> : body;
}

/** Desktop / tablet: the panel under the river. */
export function FocusPanel({ fo, rsvp, go, panelRef }: { fo: Focus; rsvp: Rsvp | null; go: (i: number) => void; panelRef: Ref<HTMLElement> }) {
  return (
    <section className="tt-panel tp-focus" aria-labelledby="tp-fo-h" ref={panelRef}>
      <div className="tt-jd__head">
        <div>
          <p className="tt-k">{fo.kick}</p>
          <h2 id="tp-fo-h" tabIndex={-1}>
            {fo.title}
          </h2>
        </div>
        <div className="tt-step2">
          <button type="button" className="vd-glass vd-press nx-btn" onClick={() => fo.prev && go(fo.prev.i)} disabled={!fo.prev} aria-label={fo.prev?.aria ?? "No hay jornada anterior"}>
            <TuIcon name="chev-l" className="nx-ic" />
            {fo.prev?.t ?? "Anterior"}
          </button>
          <button type="button" className="vd-glass vd-press nx-btn" onClick={() => fo.next && go(fo.next.i)} disabled={!fo.next} aria-label={fo.next?.aria ?? "No hay jornada siguiente"}>
            {fo.next?.t ?? "Siguiente"}
            <TuIcon name="chev-r" className="nx-ic" />
          </button>
        </div>
      </div>
      <MatchBody fo={fo} rsvp={rsvp} go={go} arrows={false} inline />
    </section>
  );
}

const subscribeNothing = () => () => {};
const useInBrowser = (): boolean =>
  useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

/** The phone: the same content as a sheet (a dialog: the focus goes in, Esc and the scrim close it, the focus
 *  returns to what opened it; ← → step through the jornadas). Portaled to the body (a container is the containing
 *  block of fixed boxes) inside a `.tup` so the place's rules reach it. */
export function FocusSheet({ fo, rsvp, go, onClose }: { fo: Focus; rsvp: Rsvp | null; go: (i: number) => void; onClose: () => void }) {
  const inBrowser = useInBrowser();
  const ref = useRef<HTMLElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    opener.current = document.activeElement;
    ref.current?.focus();
    return () => {
      const o = opener.current;
      if (o instanceof HTMLElement && o.isConnected) o.focus();
    };
  }, []);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.defaultPrevented) {
      const t = e.key === "ArrowLeft" ? fo.prev : fo.next;
      if (t) {
        e.preventDefault();
        go(t.i);
      }
    }
  };
  const sheet = (
    <div className="tup tp-sheetwrap" onKeyDown={onKey}>
      <SheetFrame
        id="tp-sh-h"
        className="tf-md tp-sheet"
        sheetRef={ref}
        onClose={onClose}
        head={
          <div>
            <p className="nx-sheet__k">{fo.kick}</p>
            <h2 id="tp-sh-h">{fo.title}</h2>
          </div>
        }
      >
        <MatchBody fo={fo} rsvp={rsvp} go={go} arrows inline={false} />
      </SheetFrame>
    </div>
  );
  return inBrowser ? createPortal(sheet, document.body) : sheet;
}
