// /profile «La carta»: the hero — the walkout tunnel behind the header (CSS 3D LED walls with the club's
// ambience, lamps, floor reflection, pitch glow, haze, rays, vignette), the dot-matrix LED videoboard,
// and the stage: the card on its pedestal with the light beam, the walkout sequence, «Saltar», the tier
// chip, who you are, the state note, the CTAs, the undo strip and the hint. As designed (pf-g.mjs).
import type { MouseEvent } from "react";
import { Faces } from "./CardFaces";
import { BOLTS, EMBERS, SPARKS, STEAM, TICKS, vars } from "./fx";
import type { HeroView } from "./heroView";
import { CREST, Ic } from "./icons";

type Pz = (el: Element | null) => void;

/** The tunnel (decorative): its walls scroll the club's name and the season. */
export function Arena({ led1, led2, pz }: { led1: string; led2: string; pz: Pz }) {
  const wall = (s: "l" | "r") => (
    <div className={"ar-w " + s} key={s}>
      <div className="led" />
      <div className="mq-r r1">
        <span className="mq">
          <b>{led1}</b>
          <b>{led1}</b>
        </span>
      </div>
      <div className="mq-r r2">
        <span className="mq">
          <b>{led2}</b>
          <b>{led2}</b>
        </span>
      </div>
      <div className="mq-r r3">
        <span className="mq">
          <b>{led1}</b>
          <b>{led1}</b>
        </span>
      </div>
      <div className="dots" />
      <div className="fog" />
    </div>
  );
  return (
    <div className="ar" aria-hidden="true" ref={pz}>
      <div className="ar-sky" />
      <div className="ar-sun">
        <i />
        <i />
      </div>
      <div className="ar-cloud c1" />
      <div className="ar-cloud c2" />
      <div className="ar-tn">
        <div className="ar-box">
          {wall("l")}
          {wall("r")}
          <div className="ar-c">
            <span className="ar-lamp" />
          </div>
          <div className="ar-f" />
          <div className="ar-end" />
        </div>
      </div>
      <div className="ar-glow" />
      <div className="ar-rays" />
      <div className="ar-haze">
        <i />
        <i />
      </div>
      <div className="ar-flare" />
      <div className="ar-vig" />
      <div className="ar-top" />
      <div className="ar-scrim" />
    </div>
  );
}

/** The LED videoboard: the state in words (the marquee is decorative; the same line is read out). */
export function Videoboard({ hv, pz }: { hv: HeroView; pz: Pz }) {
  return (
    <div className={"vb " + hv.ticker.tone} ref={pz}>
      <span className="vb-rod l" aria-hidden="true" />
      <span className="vb-rod r" aria-hidden="true" />
      <div className="vb-in">
        <span className="vb-cr" aria-hidden="true">
          <img src={CREST} alt="" />
          <i />
        </span>
        <div className="vb-led" aria-hidden="true">
          <span className="mq">
            <b>{hv.ticker.text}</b>
            <b>{hv.ticker.text}</b>
          </span>
        </div>
        <span className="vb-dots" aria-hidden="true" />
        <span className="vb-scan" aria-hidden="true" />
        <span className="vb-glare" aria-hidden="true" />
      </div>
      <p className="sr">Videomarcador: {hv.ticker.sr}</p>
    </div>
  );
}

const PRESS = (
  <span className="cp" aria-hidden="true">
    <span className="cp-mv">
      <span className="cp-arm" />
      <span className="cp-plate">
        <i />
      </span>
    </span>
    <span className="cp-hit" />
    <span className="cp-st">
      {STEAM.map((s, i) => (
        <i key={i} style={vars({ "--x": s.x, "--s": s.s, "--w": s.w, "--dx": s.dx })} />
      ))}
    </span>
  </span>
);

const stop = (e: MouseEvent) => e.stopPropagation();

export interface StageProps {
  hv: HeroView;
  nick: string;
  captainRole: boolean;
  since: string;
  intro: boolean;
  /** The heat press pieces only exist on the hero card (vinculada). */
  pz: Pz;
  cardRef: (el: HTMLElement | null) => void;
  onSkip: () => void;
  onCard: () => void;
  onFlip: () => void;
  onReplay: () => void;
  onGoFicha: () => void;
  onGoPick: () => void;
  onCancel: () => void;
  cancelBusy: boolean;
  share: { ready: boolean; open: () => void };
  undo: { name: string; n: number; busy: boolean; onUndo: () => void } | null;
  /** «Datos de ejemplo…» while the season has no finished match. */
  example: string | null;
  srStatus: string;
}

export function Stage({ pz, cardRef, ...p }: StageProps) {
  const { hv } = p;
  const flipped = hv.cardCls.split(" ").includes("flipped");
  return (
    <section className="wk" id="pe-top" aria-labelledby="pe-h" ref={pz} onClick={p.onSkip}>
      <h1 className="sr" id="pe-h">
        Tu perfil · {hv.heroName}
      </h1>
      <p className="sr" role="status">
        {p.srStatus}
      </p>
      <div className="wk-card">
        <div className="wk-fx" aria-hidden="true">
          <span className="wk-big">{hv.bigTxt}</span>
          <span className="wk-beam" />
          <span className="wk-pil" />
          <svg className="wk-bolt" viewBox="0 0 100 80" preserveAspectRatio="none">
            {BOLTS.map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
          <span className="wk-em">
            {EMBERS.map((e, i) => (
              <i key={i} style={vars({ "--x": e.x, "--y": e.y, "--d": e.d, "--w": e.w })} />
            ))}
          </span>
          <span className="wk-flash" />
          <span className="wk-sp">
            {SPARKS.map((s, i) => (
              <i key={i} style={vars({ "--a": s.a, "--d": s.d, "--w": s.w, "--s": s.s })} />
            ))}
          </span>
        </div>
        <div className="ped" aria-hidden="true">
          <span className="ped-up" />
          <span className="ped-drum" />
          <span className="ped-top">
            <i className="ped-disc" />
            <i className="ped-ring" />
          </span>
        </div>
        {hv.vinc && (
          <>
            <div className="sq sq-pos" aria-hidden="true">
              <b>{hv.seq.pos}</b>
              <small>{hv.seq.posLongUp}</small>
            </div>
            <div className="sq sq-crest" aria-hidden="true">
              <img src={CREST} alt="" />
            </div>
            <div className="sq sq-num" aria-hidden="true">
              <b>{hv.seq.num || "?"}</b>
              <small>DORSAL</small>
            </div>
            <div className="sq sq-rt" aria-hidden="true">
              <span className="tk">
                {TICKS.map((t, i) => (
                  <i key={i} style={vars({ "--r": t.r, "--h": t.h, "--w": t.w })} />
                ))}
              </span>
              {hv.showN ? (
                <span className="rt">
                  <span className="odo">
                    <span style={vars({ "--k": hv.seq.odoT })}>
                      {Array.from({ length: 10 }, (_, i) => (
                        <i key={i}>{i}</i>
                      ))}
                    </span>
                  </span>
                  <span className="odo">
                    <span style={vars({ "--k": hv.seq.odoU })}>
                      {Array.from({ length: 30 }, (_, i) => (
                        <i key={i}>{i % 10}</i>
                      ))}
                    </span>
                  </span>
                </span>
              ) : (
                <span className="rt">—</span>
              )}
              <small>VALORACIÓN</small>
            </div>
          </>
        )}
        <button
          type="button"
          className={"cd " + hv.cardCls}
          ref={cardRef}
          onClick={(e) => {
            if (p.intro) return;
            e.stopPropagation();
            p.onCard();
          }}
          aria-label={hv.cardAria}
        >
          <span className="cd-burst" aria-hidden="true">
            <span className="cd-float">
              <span className="cd-tilt">
                <span className="cd-flip">
                  <Faces kind={hv.kind} front={hv.front} back={hv.back} nick={p.nick} packNum={hv.num || "?"} />
                </span>
              </span>
              {hv.vinc && PRESS}
            </span>
          </span>
        </button>
      </div>
      {p.intro && (
        <button
          type="button"
          className="wk-skip"
          onClick={(e) => {
            e.stopPropagation();
            p.onSkip();
          }}
        >
          Saltar <Ic n="right" w={16} />
        </button>
      )}
      <div className="wk-info">
        <p className="tr">
          <span className={"tier " + hv.tierKey}>
            {hv.tierKey === "racha" && <Ic n="flame" w={13} />}
            {hv.tierName}
          </span>
          <span>{hv.tierWhy}</span>
        </p>
        <p className="who">
          <b>@{p.nick}</b>
          <span className={"role" + (p.captainRole ? " cap" : "")}>
            {p.captainRole && <Ic n="armband" w={13} />}
            {p.captainRole ? "Capitán" : "Jugador"}
          </span>
          <span>Socio desde {p.since}</span>
        </p>
        {hv.pend && (
          <p className="wk-st">
            <Ic n="alert" w={18} />
            <span>
              <b>Sobre cerrado.</b> Pediste la carta del {hv.num}; el capitán la revisa y te avisamos.
            </span>
          </p>
        )}
        {hv.sin && (
          <p className="wk-st off">
            <Ic n="shirt" w={18} />
            <span>
              <b>Aún sin carta.</b> Elige tu dorsal de la plantilla y el capitán la confirma.
            </span>
          </p>
        )}
        <div className="cta">
          {hv.vinc && (
            <>
              {p.share.ready && (
                <button type="button" className="btn gold first" onClick={(e) => (stop(e), p.share.open())}>
                  <Ic n="share" w={17} />
                  Compartir mi carta <span className="nv">nuevo</span>
                </button>
              )}
              <button type="button" className="btn span2" onClick={(e) => (stop(e), p.onFlip())} aria-pressed={flipped}>
                <Ic n="flip" w={17} />
                {flipped ? "Ver el frente" : "Ver el dorso"}
              </button>
            </>
          )}
          {hv.pend && (
            <>
              <button type="button" className="btn gold first" onClick={(e) => (stop(e), p.onGoFicha())}>
                <Ic n="shirt" w={17} />
                Ver mi petición
              </button>
              {p.share.ready && (
                <button type="button" className="btn" onClick={(e) => (stop(e), p.share.open())}>
                  <Ic n="share" w={17} />
                  Mi póster
                </button>
              )}
              <button type="button" className={"btn" + (p.share.ready ? "" : " span2")} disabled={p.cancelBusy} aria-busy={p.cancelBusy || undefined} onClick={(e) => (stop(e), p.onCancel())}>
                <Ic n="x" />
                {p.cancelBusy ? "Cancelando…" : "Cancelar"}
              </button>
            </>
          )}
          {hv.sin && (
            <>
              <button type="button" className={"btn gold " + (p.share.ready ? "first" : "span2")} onClick={(e) => (stop(e), p.onGoPick())}>
                <Ic n="shirt" w={17} />
                Reclamar mi ficha
              </button>
              {p.share.ready && (
                <button type="button" className="btn span2" onClick={(e) => (stop(e), p.share.open())}>
                  <Ic n="share" w={17} />
                  Mi póster de socio
                </button>
              )}
            </>
          )}
          <button type="button" className="ib" onClick={(e) => (stop(e), p.onReplay())} aria-label="Repetir la salida de la carta">
            <Ic n="replay" w={18} />
          </button>
        </div>
        {p.undo && (
          <div className="undo" role="status" key={p.undo.n}>
            <span className="undo-t">
              <Ic n="press" w={16} />
              <span>
                Estampado <b>{p.undo.name}</b>
              </span>
            </span>
            <button type="button" className="btn sm" disabled={p.undo.busy} onClick={(e) => (stop(e), p.undo?.onUndo())}>
              <Ic n="undo" w={16} />
              Deshacer
            </button>
            <span className="undo-bar" aria-hidden="true">
              <i />
            </span>
            <span className="sr">Puedes deshacerlo durante 6 segundos.</span>
          </div>
        )}
        <p className="hint">
          <Ic n="tilt" w={14} />
          {hv.hint}
        </p>
        {p.example && <span className="ex">{p.example}</span>}
      </div>
    </section>
  );
}
