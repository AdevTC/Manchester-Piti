// «Mapa de posiciones»: a portrait F7 mini-pitch (our goal at the bottom) with the 13 spots. Read-only
// when there is no onChange (an image with its full description); otherwise every spot is a button that
// cycles nada → también → preferida. `compare` marks what changed against a reference (captain's review).
// `played` turns it into the read-only history map («Ha jugado de»): a filled disc per position he played,
// sized by √(minutes), with «320′» under it; the positions he never played stay dim.
// Themed only through the --pos-* tokens, which the host may set on ANY ancestor (wrapper, [data-theme],
// :root) or on the map via className; the defaults suit a dark navy background. Size m needs a pitch
// ≥ MIN_PITCH_WIDTH (280 px) for 44 px targets.
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { POSITIONS, POS_CODES, isPosCode, type PosCode, type PositionSet } from "../../lib/positions";
import { cyclePosition, proposalDiff } from "../../lib/positionsEdit";
import { playedSummary } from "../../lib/positionStats";
import {
  DEFAULT_EMPTY,
  ESTIMATED_TEXT,
  HIT_NUDGE,
  PITCH_ASPECT,
  fullText,
  hitCentre,
  nearestSpot,
  geometryVars,
  playedDiscs,
  playedLines,
  playedText,
  spotState,
  stateWord,
  summaryText,
  type Direction,
  type PlayedDisc,
  type SpotState,
} from "./mapaNav";
import "../../styles/posiciones.css";

export const REFUSE_MESSAGE = "Máximo 6 posiciones de «también»";

export interface MapaPosicionesProps {
  value: PositionSet;
  /** Absent = read-only. */
  onChange?: (next: PositionSet) => void;
  /** Called when a change is refused (the 6-también cap). */
  onRefuse?: (message: string) => void;
  /** The reference to compare against: codes added «+» and removed «−». */
  compare?: PositionSet;
  size?: "s" | "m";
  /** Accessible name of the map. */
  label: string;
  /** Summary when nothing is marked (default «Sin posición»). */
  emptyText?: string;
  /** Id of a help text that describes the editable map (its group's aria-describedby). */
  describedBy?: string;
  /** History mode (read-only, onChange is ignored): minutes he played at each position. */
  played?: Partial<Record<PosCode, number>>;
  /** History mode: some of those minutes came from his preferida, not an official board. */
  estimated?: boolean;
  className?: string;
}

const KEY_DIR: Record<string, Direction> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
const STATE_ATTR: Record<SpotState, string> = { preferida: "preferida", también: "tambien", nada: "nada" };

/** Where the hit area goes: at the spot, except a nudged one (DFC), whose dot shifts back onto its real place. */
function spotStyle(code: PosCode, disc?: PlayedDisc, rank?: number): CSSProperties {
  const p = POSITIONS[code];
  const style: CSSProperties & Record<`--${string}`, string> = { left: `${p.x}%`, top: `${hitCentre(code)}%` };
  const nudge = HIT_NUDGE[code];
  if (nudge) style["--_pos-shift"] = `${-nudge * PITCH_ASPECT}cqw`; // 1 % of the height = 1.75 % of the width
  if (disc) {
    style["--_pos-d"] = String(disc.d); // px at a 320 px pitch (posiciones.css scales it)
    style["--_pos-i"] = String(rank ?? 0); // the pop-in order: most minutes first
  }
  return style;
}

/** The drawing geometry (mapaNav GEOMETRY) as the stylesheet reads it: the same on every map. */
const GEOMETRY_STYLE = geometryVars() as CSSProperties;

/** `spots` = the centre and penalty spots (left out of the history map, where they peek out next to the discs). */
function PitchLines({ spots = true }: { spots?: boolean }) {
  // 40 × 70 = the 4 / 7 aspect of .pos-pitch; y grows towards our goal (bottom).
  return (
    <svg className="pos-lines" viewBox="0 0 40 70" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <g fill="none">
        <rect x="1.5" y="1.5" width="37" height="67" rx="0.6" vectorEffect="non-scaling-stroke" />
        <line x1="1.5" y1="35" x2="38.5" y2="35" vectorEffect="non-scaling-stroke" />
        <circle cx="20" cy="35" r="5" vectorEffect="non-scaling-stroke" />
        <rect x="9" y="1.5" width="22" height="9" vectorEffect="non-scaling-stroke" />
        <rect x="14.5" y="1.5" width="11" height="3.5" vectorEffect="non-scaling-stroke" />
        <rect x="9" y="59.5" width="22" height="9" vectorEffect="non-scaling-stroke" />
        <rect x="14.5" y="65" width="11" height="3.5" vectorEffect="non-scaling-stroke" />
        <rect className="pos-goal" x="16.5" y="0.3" width="7" height="1.2" vectorEffect="non-scaling-stroke" />
        <rect className="pos-goal pos-goal--own" x="16.5" y="68.5" width="7" height="1.2" vectorEffect="non-scaling-stroke" />
      </g>
      {spots && (
        <g className="pos-points">
          <circle cx="20" cy="35" r="0.45" />
          <circle cx="20" cy="8" r="0.4" />
          <circle cx="20" cy="62" r="0.4" />
        </g>
      )}
    </svg>
  );
}

export function MapaPosiciones({ value, onChange, onRefuse, compare, size = "m", label, emptyText = DEFAULT_EMPTY, describedBy, played, estimated = false, className }: MapaPosicionesProps) {
  const history = played !== undefined;
  const editable = Boolean(onChange) && !history;
  const marked = [...(value.main ? [value.main] : []), ...value.also].join(",");
  // keyed on the minutes themselves («MCD:320,MC:140»), so a host passing a fresh object each render does not re-run the layout
  const playedKey = history ? playedLines(played).map((l) => `${l.code}:${l.minutes}`).join(",") : "";
  const { lines, discs } = useMemo(() => {
    const ls = playedKey
      ? playedKey.split(",").flatMap((e) => {
          const [code, min] = e.split(":");
          return isPosCode(code) ? [{ code, minutes: Number(min) }] : [];
        })
      : [];
    const record: Partial<Record<PosCode, number>> = Object.fromEntries(ls.map((l) => [l.code, l.minutes]));
    return { lines: ls, discs: ls.length ? playedDiscs(record, size, marked.split(",").filter(isPosCode)) : {} };
  }, [playedKey, size, marked]);
  const rank = new Map(lines.map((l, i) => [l.code, i]));
  const [active, setActive] = useState<PosCode>(value.main ?? "MC");
  const [live, setLive] = useState({ text: "", n: 0 });
  const refs = useRef<Partial<Record<PosCode, HTMLButtonElement | null>>>({});

  const diff = compare ? proposalDiff(compare, value) : null;
  const diffOf = (code: PosCode): "added" | "removed" | null =>
    diff?.added.includes(code) ? "added" : diff?.removed.includes(code) ? "removed" : null;

  const announce = (text: string) => setLive((l) => ({ text, n: l.n + 1 }));

  const toggle = (code: PosCode) => {
    if (!onChange) return;
    const next = cyclePosition(value, code);
    if (next === value) {
      onRefuse?.(REFUSE_MESSAGE);
      announce(REFUSE_MESSAGE);
      return;
    }
    onChange(next);
    announce(`${code} · ${POSITIONS[code].name.toLocaleLowerCase("es")}: ${stateWord(spotState(next, code))}`);
  };

  const moveTo = (code: PosCode | null, e: KeyboardEvent) => {
    if (!code) return;
    e.preventDefault();
    setActive(code);
    refs.current[code]?.focus();
  };

  const onKeyDown = (code: PosCode, e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return; // browser / AT shortcuts
    const dir = KEY_DIR[e.key];
    if (dir) moveTo(nearestSpot(code, dir) ?? code, e);
    else if (e.key === "Home") moveTo(POS_CODES[0], e);
    else if (e.key === "End") moveTo(POS_CODES[POS_CODES.length - 1], e);
  };

  const spots = POS_CODES.map((code) => {
    const p = POSITIONS[code];
    const state = spotState(value, code);
    const change = diffOf(code);
    const disc = discs[code];
    const minutes = disc ? played?.[code] : undefined;
    const inner = (
      <>
        <span className="pos-dot" aria-hidden="true">
          <span className="pos-code">{code}</span>
          {minutes !== undefined && <span className="pos-min">{Math.round(minutes)}′</span>}
          {state === "también" && <span className="pos-mark">✓</span>}
          {state === "preferida" && <span className="pos-mark pos-mark--pref">★</span>}
          {change && (
            <span className="pos-diff" data-diff={change}>
              {change === "added" ? "+" : "−"}
            </span>
          )}
        </span>
        {state === "preferida" && !history && (
          <span className="pos-tag" aria-hidden="true">
            PREF
          </span>
        )}
      </>
    );
    const common = {
      className: "pos-spot",
      "data-code": code,
      "data-state": STATE_ATTR[state],
      "data-side": p.side,
      "data-diff": change ?? undefined,
      "data-played": disc ? "" : undefined,
      "data-label": disc?.label,
      style: spotStyle(code, disc, rank.get(code)),
    };
    if (!editable) {
      return (
        <span key={code} {...common}>
          {inner}
        </span>
      );
    }
    const name = `${code} · ${p.name}: ${stateWord(state)}${change ? `, ${change === "added" ? "añadida" : "quitada"}` : ""}`;
    return (
      <button
        key={code}
        type="button"
        {...common}
        ref={(el) => {
          refs.current[code] = el;
        }}
        aria-label={name}
        tabIndex={code === active ? 0 : -1}
        onFocus={() => setActive(code)}
        onClick={() => toggle(code)}
        onKeyDown={(e) => onKeyDown(code, e)}
      >
        {inner}
      </button>
    );
  });

  return (
    <div className={["pos-map", `pos-map--${size}`, editable ? "pos-map--edit" : "pos-map--view", history && "pos-map--played", className].filter(Boolean).join(" ")} style={GEOMETRY_STYLE}>
      {editable ? (
        <div className="pos-pitch" role="group" aria-label={label} aria-describedby={describedBy}>
          <PitchLines />
          {spots}
        </div>
      ) : (
        <div className="pos-pitch" role="img" aria-label={`${label}. ${history ? playedText(value, played, estimated) : fullText(value, compare, emptyText)}`}>
          <PitchLines spots={!history} />
          {spots}
        </div>
      )}
      <p className="pos-legend" aria-hidden={editable ? undefined : true}>
        <span className="pos-legend-item">
          <span className="pos-legend-sym pos-legend-sym--pref" aria-hidden="true">★</span> Preferida
        </span>
        <span className="pos-legend-item">
          <span className="pos-legend-sym pos-legend-sym--also" aria-hidden="true">✓</span> También
        </span>
        {history && (
          <span className="pos-legend-item">
            <span className="pos-legend-sym pos-legend-sym--played" aria-hidden="true">●</span> Más grande, más minutos
          </span>
        )}
        {compare && (
          <>
            <span className="pos-legend-item">
              <span className="pos-legend-sym pos-legend-sym--added" aria-hidden="true">+</span> Añadida
            </span>
            <span className="pos-legend-item">
              <span className="pos-legend-sym pos-legend-sym--removed" aria-hidden="true">−</span> Quitada
            </span>
          </>
        )}
      </p>
      <p className="pos-summary" aria-hidden={editable ? undefined : true}>
        {history ? playedSummary({ lines }) : summaryText(value, emptyText)}
      </p>
      {history && estimated && lines.length > 0 && (
        <p className="pos-est" aria-hidden="true">
          {ESTIMATED_TEXT}
        </p>
      )}
      {editable && (
        <p className="pos-sr" role="status">
          {live.text}
          {/* a trailing no-break space on every other message, so the same text twice is still a change to announce */}
          {live.n % 2 === 1 ? "\u00a0" : ""}
        </p>
      )}
    </div>
  );
}
