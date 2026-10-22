// El cartel de la jornada: a poster made from the match itself — the light of its kick-off, the jornada, the
// rival, when and where, the big line (the time before, the score after, «Aplazado»…), the MVP and the match's
// signature once played. Shown in a glass sheet; «Compartir» sends the image (Web Share with a file where the
// browser can, else it is saved) and «Guardar la imagen» downloads it. The image is drawn on a canvas only
// when asked for.
import { useEffect, useRef, type CSSProperties } from "react";
import type { Cartel } from "../../../lib/derived/vidrio/cartel";
import { venueName } from "../model";
import { paintGradient, type SegmentPaint } from "./model";
import { Glyph, SignatureSvg } from "./bits";
import { useCartelShare } from "./cartelShare";

export function Poster({ cartel, paint }: { cartel: Cartel; paint: SegmentPaint }) {
  const style = { "--a": paintGradient(paint.a), "--b": paintGradient(paint.b), "--m0": `${paint.m0}%`, "--m1": `${paint.m1}%` } as CSSProperties;
  return (
    <div className="vp-poster" role="img" aria-label={cartel.aria}>
      <div className="vp-poster__sky vp-paint" style={style} />
      <div className="vp-poster__grain" />
      <div className="vp-poster__in">
        <div className="vp-poster__top">
          <img src="/crest-128.webp" alt="" />
          <span>
            {cartel.seasonName}
            <br />
            Liga de fútbol 7
          </span>
        </div>
        {cartel.signature && (
          <span className="vp-poster__ring">
            <SignatureSvg sig={cartel.signature} />
          </span>
        )}
        <div className="vp-poster__j">{cartel.jornadaLabel || "J"}</div>
        <div className="vp-poster__vs">
          Manchester Piti<i>{cartel.home ? "contra" : "en casa de"}</i>
          {cartel.rival}
        </div>
        <div className="vp-poster__foot">
          <div className="vp-poster__when">
            <span>
              {cartel.dateLine}
              {cartel.time ? `, ${cartel.time}` : ""}
            </span>
            <span className="vp-poster__where">{venueName(cartel.venue)}</span>
          </div>
          <div className="vp-poster__big">
            <b>{cartel.big}</b>
            {cartel.mvp && <span className="vp-poster__mvp">MVP {cartel.mvp}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── the image ─────────────────────────

export function CartelInline({ cartel, paint }: { cartel: Cartel; paint: SegmentPaint }) {
  const { busy, note, run } = useCartelShare(cartel, paint);
  return (
    <div className="vp-cartel-inline">
      <Poster cartel={cartel} paint={paint} />
      <p className="vp-sub">El cartel de la jornada, listo para mandar al grupo.</p>
      <div className="vp-btns">
        <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" onClick={() => void run(true)} aria-busy={busy}>
          <Glyph name="share" />
          Compartir el cartel
        </button>
      </div>
      <p className="vp-note" role="status">
        {note}
      </p>
    </div>
  );
}

export function CartelSheet({ cartel, paint, onClose }: { cartel: Cartel; paint: SegmentPaint; onClose: () => void }) {
  const close = useRef<HTMLButtonElement | null>(null);
  const { busy, note, run } = useCartelShare(cartel, paint);
  useEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus();
    return () => {
      if (back?.isConnected) back.focus();
    };
  }, []);
  return (
    <div
      className="vp-sheetwrap"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="vd-glass vd-glass--deep vd-sheet vp-cartel" role="dialog" aria-modal="true" aria-labelledby="vp-ct">
        <header>
          <h2 id="vp-ct">Cartel de la {cartel.jornadaLabel || "jornada"}</h2>
          <button ref={close} type="button" className="vd-glass vd-ibtn vd-press" aria-label="Cerrar el cartel" onClick={onClose}>
            <Glyph name="close" />
          </button>
        </header>
        <Poster cartel={cartel} paint={paint} />
        <p className="vp-sub">Se hace solo con la hora, el campo y la luz del pitido; al acabar, con el resultado y la firma del partido.</p>
        <div className="vp-btns">
          <button type="button" className="vd-glass vd-btn vd-btn--pri vd-press" onClick={() => void run(true)} aria-busy={busy}>
            <Glyph name="share" />
            Compartir
          </button>
          <button type="button" className="vd-glass vd-btn vd-press" onClick={() => void run(false)} aria-busy={busy}>
            <Glyph name="down" />
            Guardar la imagen
          </button>
        </div>
        <p className="vp-note" role="status">
          {note}
        </p>
      </div>
    </div>
  );
}
