// Tus partidos › the river (TuTemporada tt-river): every jornada of the season. Desktop/tablet: a horizontal
// ribbon (it scrolls inside itself when it doesn't fit), the played bar = his nota with its number and band word,
// G/A marks, the MVP in gold, «No jugaste», the absence with its why, the ones to come as outlines, the next one
// as a card with his convocatoria answered inline, «Tu media» across it, the legend. Phone: a vertical river, the
// next one on top (with his answer), the past from the newest, the rest of the future folded.
import { useEffect, useRef, useState } from "react";
import { TuIcon } from "../../../../../components/vidrio/tu/ui";
import type { Answer, JornadaRow } from "../../me";
import { avgBottom, dec, dShort, hhmm, phoneRiver, where, type RiverCol } from "../partidosView";
import { RadioSeg } from "./RadioSeg";

/** His convocatoria for the next jornada (la bandeja's rsvp item, the one Tú answers too). */
export interface Rsvp {
  matchId: string;
  question: string;
  /** «J3 · 18:00 · en casa · contestan 6 de 16». */
  body: string;
  value: Answer | null;
  busy: boolean;
  pick: (a: Answer) => void;
}
const VAS: { k: Answer; t: string }[] = [
  { k: "yes", t: "Voy" },
  { k: "maybe", t: "Duda" },
  { k: "no", t: "No voy" },
];

export function RsvpSeg({ rsvp }: { rsvp: Rsvp }) {
  return <RadioSeg label={rsvp.question} opts={VAS.map((o) => ({ key: o.k, t: o.t, on: rsvp.value === o.k, pick: () => rsvp.value !== o.k && rsvp.pick(o.k), off: rsvp.busy }))} style={{ width: "100%" }} />;
}

interface RiverProps {
  rows: readonly JornadaRow[];
  cols: readonly RiverCol[];
  /** The jornada shown below the river (null: none, the phone without a sheet). */
  on: number | null;
  pick: (i: number) => void;
  /** Dragging across the ribbon (mouse): focus without writing the address until it ends. */
  scrub: (i: number) => void;
  scrubEnd: () => void;
  rsvp: Rsvp | null;
  average: number | null;
  played: number;
  label: string;
}

/** The ribbon (desktop / tablet). */
export function Ribbon(p: RiverProps) {
  const scrubbing = useRef(false);
  const wrap = useRef<HTMLDivElement>(null);
  const end = useRef(p.scrubEnd);
  useEffect(() => {
    end.current = p.scrubEnd;
  });
  useEffect(() => {
    const up = () => {
      if (!scrubbing.current) return;
      scrubbing.current = false;
      end.current();
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);
  // the next one in view when the ribbon scrolls inside itself (a long season on a narrow screen)
  const nextIdx = p.rows.findIndex((r) => r.kind === "next");
  useEffect(() => {
    const w = wrap.current;
    if (!w || w.scrollWidth <= w.clientWidth) return;
    const el = w.querySelector<HTMLElement>(".is-next") ?? w.querySelector<HTMLElement>("li:last-child");
    if (el) w.scrollLeft = Math.max(0, el.offsetLeft - w.clientWidth / 2 + el.offsetWidth / 2);
  }, [nextIdx]);
  const hasAvg = p.average !== null && p.played > 1;
  return (
    <>
      <div className="tt-ribwrap" ref={wrap}>
        <ol
          className="tt-rib"
          aria-label={p.label}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button === 0) scrubbing.current = true;
          }}
        >
          {hasAvg && (
            <li className="tt-avg" aria-hidden="true" style={{ bottom: avgBottom(p.average as number) }}>
              <span>Tu media {dec(p.average as number)}</span>
            </li>
          )}
          {p.rows.map((r, i) => {
            const x = p.cols[i];
            const on = p.on === i;
            if (r.kind === "next")
              return (
                <li key={r.matchId} className="is-next">
                  <div className="vd-glass vd-glass--deep tt-nextj">
                    <button type="button" className="tt-nextj__f" aria-pressed={on} aria-label={x.aria} onClick={() => p.pick(i)} onPointerEnter={() => scrubbing.current && p.scrub(i)}>
                      <small>La siguiente{r.jLabel !== "—" ? ` · ${r.jLabel}` : ""}</small>
                      <b>{r.rival}</b>
                      <span>{[`${dShort(r.dateMs)} · ${hhmm(r.dateMs)}`, where(r.home)].filter(Boolean).join(" · ")}</span>
                    </button>
                    {p.rsvp && p.rsvp.matchId === r.matchId ? (
                      <div className="tt-vas" role="radiogroup" aria-label={p.rsvp.question}>
                        {VAS.map((o, k) => (
                          <button key={o.k} type="button" role="radio" className={!p.rsvp?.value && k === 0 ? "is-pri" : ""} aria-checked={p.rsvp?.value === o.k} disabled={p.rsvp?.busy} onClick={() => p.rsvp && p.rsvp.value !== o.k && p.rsvp.pick(o.k)}>
                            {o.t}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="nx-meta tp-nextj__m">{r.answer === "no" ? "Has dicho que no vas" : "La convocatoria, más cerca del día"}</p>
                    )}
                  </div>
                </li>
              );
            return (
              <li key={r.matchId}>
                <button type="button" className={`tt-j${x.mvp ? " is-mvp" : ""}`} aria-pressed={on} aria-label={x.aria} onClick={() => p.pick(i)} onPointerEnter={() => scrubbing.current && p.scrub(i)}>
                  <span className="tt-j__col">
                    {x.mvp && <span className="tt-mvp">MVP</span>}
                    {(x.gT || x.aT) && (
                      <span className="tt-mk">
                        {x.gT && <span className="tt-g">{x.gT}</span>}
                        {x.aT && <span className="tt-a">{x.aT}</span>}
                      </span>
                    )}
                    {x.isPlayed ? (
                      <>
                        <span className="tt-j__n">{x.notaT}</span>
                        <span className={`tt-bar tt-b--${x.band}`} style={{ height: x.h }}>
                          <span>{x.word}</span>
                        </span>
                      </>
                    ) : (
                      <span className={`tt-ghost ${x.ghostCls}`}>{x.ghostT && <span>{x.ghostT}</span>}</span>
                    )}
                  </span>
                  <span className="tt-j__lab">
                    <b>{r.jLabel}</b>
                    {x.res ? (
                      <span className={`tt-res is-${x.res}`} aria-hidden="true">
                        {x.res}
                      </span>
                    ) : (
                      <small>{x.tiny}</small>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="tt-legend">
        <span>
          <i className="l-bar" />
          Tu nota (0–10), con su palabra
        </span>
        <span>
          <b className="tt-res is-G">G</b> <b className="tt-res">E</b> <b className="tt-res">P</b> el resultado
        </span>
        <span>G gol · A asistencia · MVP en oro</span>
        <span>
          <i className="l-out" />
          No jugaste
        </span>
        <span>
          <i className="l-abs" />
          Ausente
        </span>
        <span>
          <i className="l-up" />
          Por jugar
        </span>
      </p>
    </>
  );
}

/** The phone's vertical river. */
export function PhoneRiver(p: RiverProps) {
  const [showFuture, setShowFuture] = useState(false);
  const pr = phoneRiver(p.rows, showFuture);
  return (
    <ol className="tt-pr" aria-label={p.label}>
      {pr.future > 0 && (
        <li>
          <button type="button" className="tt-more" aria-expanded={showFuture} onClick={() => setShowFuture(!showFuture)}>
            <span className="tt-pj__node" aria-hidden="true">
              {showFuture ? "−" : "+"}
            </span>
            {pr.futureT}
          </button>
        </li>
      )}
      {pr.list.map(({ r, i }) => {
        const x = p.cols[i];
        const cls = [x.isPlayed ? "is-played" : "", x.mvp ? "is-mvp" : "", r.kind === "absent" ? "is-abs" : ""].filter(Boolean).join(" ");
        return (
          <li key={r.matchId}>
            <button type="button" className={`tt-pj${cls ? ` ${cls}` : ""}`} aria-label={x.aria} aria-haspopup="dialog" onClick={() => p.pick(i)}>
              <span className="tt-pj__node" aria-hidden="true">
                {r.jLabel}
              </span>
              <span className="tt-pj__t">
                <b>{r.rival}</b>
                <span>{x.pline}</span>
                {x.isPlayed && <span className={`tt-pj__bar tt-b--${x.band}`} style={{ width: x.w }} />}
              </span>
              <span className="tt-pj__v">
                {x.isPlayed ? (
                  <>
                    <span className={`tt-nb tt-b--${x.band}`}>{x.notaT}</span>
                    <small>{x.word}</small>
                  </>
                ) : (
                  x.ghostT && <small>{x.ghostT}</small>
                )}
                {x.mvp && <span className="tt-mvp">MVP</span>}
              </span>
            </button>
            {r.kind === "next" && p.rsvp && p.rsvp.matchId === r.matchId && (
              <div className="vd-glass vd-glass--deep tt-pnext">
                <RsvpSeg rsvp={p.rsvp} />
                <p className="nx-meta">{p.rsvp.body}</p>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** «Hoy»: back to the present jornada. */
export function HoyButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" className="vd-glass vd-press nx-btn" onClick={onClick} disabled={disabled}>
      <TuIcon name="clock" className="nx-ic" />
      Hoy
    </button>
  );
}
