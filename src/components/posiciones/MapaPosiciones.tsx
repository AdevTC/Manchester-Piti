// «Mapa de posiciones»: a portrait F7 mini-pitch (our goal at the bottom) with the 13 spots. Read-only
// when there is no onChange (an image with its full description); otherwise every spot is a button that
// cycles nada → también → preferida. `compare` marks what changed against a reference (captain's review).
// Themed only through the --pos-* tokens, which the host may set on ANY ancestor (wrapper, [data-theme],
// :root) or on the map via className; the defaults suit a dark navy background. Size m needs a pitch
// ≥ MIN_PITCH_WIDTH (280 px) for 44 px targets.
import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { POSITIONS, POS_CODES, type PosCode, type PositionSet } from "../../lib/positions";
import { cyclePosition, proposalDiff } from "../../lib/positionsEdit";
import { DEFAULT_EMPTY, HIT_NUDGE, PITCH_ASPECT, fullText, hitCentre, nearestSpot, spotState, stateWord, summaryText, type Direction, type SpotState } from "./mapaNav";
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
  className?: string;
}

const KEY_DIR: Record<string, Direction> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
const STATE_ATTR: Record<SpotState, string> = { preferida: "preferida", también: "tambien", nada: "nada" };

/** Where the hit area goes: at the spot, except a nudged one (DFC), whose dot shifts back onto its real place. */
function spotStyle(code: PosCode): CSSProperties {
  const p = POSITIONS[code];
  const style: CSSProperties & Record<`--${string}`, string> = { left: `${p.x}%`, top: `${hitCentre(code)}%` };
  const nudge = HIT_NUDGE[code];
  if (nudge) style["--_pos-shift"] = `${-nudge * PITCH_ASPECT}cqw`; // 1 % of the height = 1.75 % of the width
  return style;
}

function PitchLines() {
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
      <g className="pos-points">
        <circle cx="20" cy="35" r="0.45" />
        <circle cx="20" cy="8" r="0.4" />
        <circle cx="20" cy="62" r="0.4" />
      </g>
    </svg>
  );
}

export function MapaPosiciones({ value, onChange, onRefuse, compare, size = "m", label, emptyText = DEFAULT_EMPTY, className }: MapaPosicionesProps) {
  const editable = Boolean(onChange);
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
    const inner = (
      <>
        <span className="pos-dot" aria-hidden="true">
          <span className="pos-code">{code}</span>
          {state === "también" && <span className="pos-mark">✓</span>}
          {state === "preferida" && <span className="pos-mark pos-mark--pref">★</span>}
          {change && (
            <span className="pos-diff" data-diff={change}>
              {change === "added" ? "+" : "−"}
            </span>
          )}
        </span>
        {state === "preferida" && (
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
      style: spotStyle(code),
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
    <div className={["pos-map", `pos-map--${size}`, editable ? "pos-map--edit" : "pos-map--view", className].filter(Boolean).join(" ")}>
      {editable ? (
        <div className="pos-pitch" role="group" aria-label={label}>
          <PitchLines />
          {spots}
        </div>
      ) : (
        <div className="pos-pitch" role="img" aria-label={`${label}. ${fullText(value, compare, emptyText)}`}>
          <PitchLines />
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
        {summaryText(value, emptyText)}
      </p>
      {editable && (
        <p className="pos-sr" role="status">
          {live.text}
          {/* a trailing no-break space on every other message, so the same text twice is still a change to announce */}
          {live.n % 2 === 1 ? " " : ""}
        </p>
      )}
    </div>
  );
}
