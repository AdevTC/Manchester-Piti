// The ribbon of light: the whole season as a minimap of small skies (drag the window, tap a jornada, «Hoy»,
// pages back and forth), and the window of 6–10 jornadas, each painted in the light of its own kick-off with
// its result, its signature, the countdown or «Aplazado». The chosen jornada sits under a glass cursor that
// morphs from one to the next (view-transition-name). In Tabla, on a desktop, the jornadas still to play
// carry «¿Y si…?» (G · E · P). Tonight's live jornada is where the floating score docks (useLiveDock anchor).
import { Fragment, useEffect, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { region, useLiveDock } from "../../../components/vidrio";
import { matchSignature } from "../../../lib/derived/vidrio/signature";
import type { SeasonStrip, StripSegment, StripWindow } from "../../../lib/derived/vidrio/strip";
import type { PickLetter } from "../../../lib/derived/vidrio/table";
import { lightLine, minimapOf, nearestOnTrack, paintGradient, paintOf, ribbonGaps, segmentAria, shortDay, tinyDay, untilText } from "./model";
import { Glyph, SignatureSvg } from "./bits";

export interface RibbonProps {
  strip: SeasonStrip;
  /** The jornadas the filter keeps, in order (the window pages over them). */
  list: readonly StripSegment[];
  win: StripWindow;
  selId: string | null;
  now: number;
  /** The live jornada's shown minute. */
  liveMinute: number | null;
  /** «¿Y si…?» on the ribbon (Tabla, desktop). */
  simMode: boolean;
  /** The viewer's picks and the results each open fixture got (picks or the preset's). */
  picks: Readonly<Record<string, PickLetter>>;
  results: Readonly<Record<string, PickLetter>>;
  onPick: (id: string, focus?: boolean) => void;
  onPage: (dir: 1 | -1) => void;
  onWindowAround: (index: number) => void;
  onSim: (id: string, letter: PickLetter) => void;
  onHoy: () => void;
  hoyDisabled: boolean;
  /** The floating score docks on tonight's live segment (a desktop only: below, it keeps the phone's home). */
  dock: boolean;
  /** Tonight's forecast temperature (the cockpit's light line, «Atardecer y focos, 14°»). */
  tonightTemp: number | null;
}

/** Where the floating score docks while tonight's jornada is live (mounted only on that segment). */
function DockAnchor() {
  const ref = useRef<HTMLSpanElement | null>(null);
  useLiveDock(ref, "anchor");
  return <span ref={ref} className="vp-dock" aria-hidden="true" />;
}

function Paint({ seg, selected }: { seg: StripSegment; selected: boolean }) {
  const p = paintOf(seg);
  const style = { "--a": paintGradient(p.a), "--b": paintGradient(p.b), "--m0": `${p.m0}%`, "--m1": `${p.m1}%` } as CSSProperties;
  const off = seg.state === "aplazado" || seg.state === "suspendido";
  return (
    <span className={`vp-paint${selected ? " is-sel" : ""}${off ? " is-pp" : ""}`} style={style} aria-hidden="true">
      <i className="vp-phz" />
      <i className="vp-pturf" />
      <i className="vp-pscr" />
      {p.sun && !off && <i className={p.sun.noon ? "vp-pnoon" : "vp-psun"} style={{ left: `${p.sun.x}%`, top: `${p.sun.y}%` }} />}
      {p.floods && !off && <i className="vp-pfl" style={{ left: "26%" }} />}
    </span>
  );
}

const LETTER_WORD: Record<PickLetter, string> = { G: "Ganamos", E: "Empatamos", P: "Perdemos" };

function Segment({ seg, selected, now, minute, tabbable, simLetter, temp, onPick, onKey }: { seg: StripSegment; selected: boolean; now: number; minute: number | null; tabbable: boolean; simLetter: PickLetter | null; temp: number | null; onPick: () => void; onKey: (e: KeyboardEvent<HTMLButtonElement>) => void }) {
  const live = seg.state === "directo";
  const played = seg.state === "jugado";
  const sig = live || played ? matchSignature(seg.match, now, "s") : null;
  const off = seg.state === "aplazado" || seg.state === "suspendido";
  const dayLine = off || seg.at === null ? "Sin fecha" : shortDay(seg.at, now);
  const tinyLine = off || seg.at === null ? "Sin fecha" : tinyDay(seg.at, now);
  // (the cockpit's wide segments say the light of the kick-off; not once it is live or played)
  const light = seg.state === "hoy" || seg.state === "proximo" ? lightLine(seg, seg.state === "hoy" ? temp : null) : "";
  const cls = ["vp-seg", live && "vp-seg--live", off && "vp-seg--pp", played && "vp-seg--done"].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} aria-pressed={selected} tabIndex={tabbable ? 0 : -1} aria-label={segmentAria(seg, now, minute)} onClick={onPick} onKeyDown={onKey} data-seg={seg.id}>
      {selected && (
        <span className="vd-glass vp-cur" aria-hidden="true">
          <span className="vd-glint" />
        </span>
      )}
      <span className="vp-seg__top" aria-hidden="true">
        <b className="vp-seg__j">J{seg.jornada ?? "·"}</b>
        <span className="vp-seg__d">{dayLine}</span>
        <span className="vp-seg__d vp-seg__d--s">{tinyLine}</span>
        <span className="vp-seg__rv">{seg.rival}</span>
        {light && <span className="vp-seg__l">{light}</span>}
      </span>
      <span className="vp-seg__res" aria-hidden="true">
        {seg.state === "hoy" && seg.at !== null && <span className="vp-seg__cd">{untilText(seg.at, now)}</span>}
        {sig && (
          <span className="vp-seg__ring">
            <SignatureSvg sig={sig} />
          </span>
        )}
        {(live || played) && seg.score && (
          <span className="vp-seg__score">
            {seg.score.gf}–{seg.score.ga}
            {live && minute !== null && (
              <span className="vd-live">
                <span className="vd-clock">{minute}′</span>
              </span>
            )}
            {played && seg.letter && <em className="vp-seg__let">{seg.letter}</em>}
          </span>
        )}
        {off && <span className="vp-seg__pp">{seg.state === "aplazado" ? "Aplazado" : "Suspendido"}</span>}
        {seg.state === "pendiente" && <span className="vp-seg__pp vp-seg__pp--pend">Pendiente del acta</span>}
      </span>
      {simLetter && (
        <span className="vp-seg__sim" aria-hidden="true">
          {simLetter}
        </span>
      )}
      <span className="vp-seg__bot" aria-hidden="true">
        <b>{seg.rival}</b>
        <span>{seg.home ? "En casa" : "Fuera"}</span>
      </span>
    </button>
  );
}

export function Ribbon({ strip, list, win, selId, now, liveMinute, simMode, picks, results, onPick, onPage, onWindowAround, onSim, onHoy, hoyDisabled, dock, tonightTemp }: RibbonProps) {
  const track = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: number; x0: number; moved: boolean } | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);
  // (a phone scrolls the whole season: the chosen jornada comes to the left edge)
  useEffect(() => {
    const w = wrap.current;
    if (!w || w.scrollWidth <= w.clientWidth + 1 || !selId) return;
    const slot = w.querySelector<HTMLElement>(`.vp-seg[data-seg="${selId}"]`)?.parentElement;
    if (!slot) return;
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    w.scrollTo({ left: Math.max(0, slot.offsetLeft - 16), behavior: reduced || !w.dataset.ready ? "auto" : "smooth" });
    w.dataset.ready = "1";
  }, [selId]);
  const visible = list.slice(win.start, win.end);
  const listIds = new Set(list.map((s) => s.id));
  const mm = minimapOf(strip.segments, visible.map((s) => s.id), listIds, selId, strip.todayIndex, now);
  const gaps = ribbonGaps(visible);
  const first = visible[0];
  const last = visible[visible.length - 1];
  const winTxt = first && last ? `de la J${first.jornada ?? "·"} a la J${last.jornada ?? "·"}` : "sin jornadas";
  const selInView = visible.some((s) => s.id === selId);
  const tabStop = selInView ? selId : (visible[0]?.id ?? null);

  const fractionAt = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || !r.width) return null;
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { id: e.pointerId, x0: e.clientX, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* an old engine: the drag still works without capture */
    }
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.x0) > 4) d.moved = true;
    if (!d.moved) return;
    const f = fractionAt(e.clientX);
    const i = f === null ? null : nearestOnTrack(mm.marks, f);
    if (i !== null) onWindowAround(i);
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const f = fractionAt(e.clientX);
    const i = f === null ? null : nearestOnTrack(mm.marks, f);
    if (i !== null) onPick(strip.segments[i].id);
  };
  const onTrackKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      onPage(1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      onPage(-1);
    }
  };
  const onSegKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const at = list.findIndex((s) => s.id === selId);
    let to: number | null = null;
    if (e.key === "ArrowRight") to = Math.min(list.length - 1, at + 1);
    else if (e.key === "ArrowLeft") to = Math.max(0, at - 1);
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = list.length - 1;
    if (to === null || to < 0 || !list[to]) return;
    e.preventDefault();
    onPick(list[to].id, true);
  };

  return (
    <div className="vp-ribzone">
      <div className="vp-mm">
        <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press vp-hoy" onClick={onHoy} aria-disabled={hoyDisabled} aria-label="Volver a hoy">
          Hoy
        </button>
        <div
          ref={track}
          className="vp-mm__track"
          role="slider"
          tabIndex={0}
          aria-label="La temporada entera: arrastra la ventana para moverte"
          aria-valuemin={1}
          aria-valuemax={Math.max(1, strip.segments.length)}
          aria-valuenow={first?.jornada ?? 1}
          aria-valuetext={winTxt}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={onTrackKey}
        >
          {mm.marks.map((m) => (
            <span
              key={m.id}
              className={["vp-mm__s", m.inWindow && "is-win", m.selected && "is-sel", !m.inList && "is-dim", (m.state === "aplazado" || m.state === "suspendido") && "is-pp", m.state === "directo" && "is-live"].filter(Boolean).join(" ")}
              style={{ left: `${m.x}%`, width: `${m.w}%`, background: paintGradient(m.paint) }}
            >
              <i>{m.letter}</i>
            </span>
          ))}
          {mm.months.map((mo) => (
            <span key={`${mo.label}-${mo.x}`} className="vp-mm__mo" style={{ left: `${mo.x}%` }}>
              {mo.label}
            </span>
          ))}
          {mm.hoy !== null && <span className="vp-mm__hoy" style={{ left: `${mm.hoy}%` }} aria-hidden="true" />}
          <span className="vp-mm__win" style={{ left: `${mm.win.x}%`, width: `${mm.win.w}%` }} aria-hidden="true" />
        </div>
        <button type="button" className="vd-glass vd-ibtn vd-press vp-pg" onClick={() => onPage(-1)} aria-disabled={!win.hasPrev} aria-label="Jornadas anteriores">
          <Glyph name="left" />
        </button>
        <button type="button" className="vd-glass vd-ibtn vd-press vp-pg" onClick={() => onPage(1)} aria-disabled={!win.hasNext} aria-label="Jornadas siguientes">
          <Glyph name="right" />
        </button>
      </div>
      <div ref={wrap} className="vp-ribwrap">
        <div className={`vp-rib ${region(5)}${simMode ? " vp-simmode" : ""}`} role="group" aria-label={`Jornadas ${winTxt}. Las flechas te mueven entre jornadas.`}>
          <div className="vp-rib__band" aria-hidden="true" />
          {visible.map((seg, k) => {
            const gap = k > 0 ? gaps[k - 1] : null;
            const open = seg.state === "hoy" || seg.state === "proximo" || seg.state === "aplazado";
            const pick = picks[seg.id] ?? null;
            const shown = results[seg.id] ?? null;
            return (
              <Fragment key={seg.id}>
                {gap && (
                  <span className={`vp-gap${gap.label ? " has-label" : ""}`} style={{ "--u": gap.units } as CSSProperties} aria-hidden="true">
                    {gap.label && <small>{gap.label}</small>}
                  </span>
                )}
                <div className={`vp-slot${seg.id === selId ? " is-sel" : ""}`} style={{ "--rd": `${k * 60}ms` } as CSSProperties}>
                  <Paint seg={seg} selected={seg.id === selId} />
                  <Segment seg={seg} selected={seg.id === selId} now={now} minute={seg.state === "directo" ? liveMinute : null} tabbable={seg.id === tabStop} simLetter={open ? shown : null} temp={tonightTemp} onPick={() => onPick(seg.id)} onKey={onSegKey} />
                  {dock && seg.state === "directo" && <DockAnchor />}
                  {simMode && open && (
                    <div className="vd-glass vp-sim" role="group" aria-label={`¿Y si en la J${seg.jornada ?? ""} contra ${seg.rival}…?`}>
                      {(["G", "E", "P"] as const).map((l) => (
                        <button key={l} type="button" aria-pressed={pick === l} aria-label={LETTER_WORD[l]} onClick={() => onSim(seg.id, l)}>
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
