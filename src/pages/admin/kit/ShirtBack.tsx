// The admin v2's shared objects, part 1: the shirt seen from the back (`.sh`: name + dorsal), the peg it
// hangs on (`.peg`: name and a line under it), the rails (`.rail2`) and the peg wall (`.wall`). Markup and
// sizes as on the canvas (stats-gen/ad-v2-full.mjs `sh`, `frontPegs`, `wallT`).
import type { CSSProperties, ReactNode } from "react";
import { AdIcon } from "../ui/icons";
import { railsOf } from "./wall";

/** `empty` = the dashed «Libre» shirt (a free peg, a new player); `dim` = not placed yet. */
export type ShirtState = "" | "empty" | "dim";

const SHIRT_PATH = "M30 8 C37 15 63 15 70 8 L94 20 L87 42 L77 38 L77 96 L23 96 L23 38 L13 42 L6 20 Z";
const COLLAR_PATH = "M30 8 C37 15 63 15 70 8";

export interface ShirtBackProps {
  /** The dorsal (empty for a free peg). */
  num?: string | number | null;
  /** The name printed over the dorsal (front pegs and cromos); the small back pegs leave it out. */
  name?: string;
  /** Width = height, px (the canvas: 96 front pegs, 66 back rail, 52 bench, 44 phones). */
  size?: number;
  /** `big`: the dorsal sits a little lower (the name is printed above it). */
  big?: boolean;
  state?: ShirtState;
  className?: string;
}
/** `.sh`: a shirt from the back, decorative (the peg / row around it carries the accessible name). */
export function ShirtBack({ num, name, size = 64, big = false, state = "", className = "" }: ShirtBackProps) {
  const style = { "--w": `${size}px` } as CSSProperties;
  return (
    <span className={["sh", big ? "big" : "", state, className].filter(Boolean).join(" ")} style={style} aria-hidden="true">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path className="sf" d={SHIRT_PATH} />
        <path className="cl" d={COLLAR_PATH} />
      </svg>
      {name ? <i>{name}</i> : null}
      <b>{num ?? ""}</b>
    </span>
  );
}

/** A sticker on a shirt: a goal ball, a yellow card or a red card. */
export type Sticker = "goal" | "yellow" | "red";
/** `.stk`: the stickers stuck on a shirt (goals, cards), stacked by its shoulder. */
export function Stickers({ list }: { list: readonly Sticker[] }) {
  if (!list.length) return null;
  return (
    <span className="stk" aria-hidden="true">
      {list.map((s, i) => (
        <i key={i} className={s === "yellow" ? "y" : s === "red" ? "r" : ""}>
          {s === "goal" ? <AdIcon name="ball" size={14} /> : null}
        </i>
      ))}
    </span>
  );
}

export interface PegProps {
  num?: string | number | null;
  /** Printed on the shirt (front pegs). */
  shirtName?: string;
  /** The name under the shirt (`.nm`). */
  label: ReactNode;
  /** The line under the name (`.rv`): position, «Banquillo», «Duda»… */
  sub?: ReactNode;
  /** `duda` = amber (doubt / no answer: something is missing). */
  subTone?: "" | "duda";
  size?: number;
  big?: boolean;
  state?: ShirtState;
  stickers?: readonly Sticker[];
  /** Just hung: the shirt swings in (`.peg.open`). */
  fresh?: boolean;
  /** Makes it a button. */
  onClick?: () => void;
  ariaLabel?: string;
  /** Extra classes (`nop` = no peg dot, `alta`, `sel`…). */
  className?: string;
}
/** `.peg`: one shirt on its peg — a button when it does something, a plain figure otherwise. */
export function Peg({ num, shirtName, label, sub, subTone = "", size = 96, big = false, state = "", stickers, fresh = false, onClick, ariaLabel, className = "" }: PegProps) {
  const cls = ["peg", fresh ? "open" : "", className].filter(Boolean).join(" ");
  const body = (
    <>
      <ShirtBack num={num} name={shirtName} size={size} big={big} state={state} />
      {stickers ? <Stickers list={stickers} /> : null}
      <span className="nm">{label}</span>
      {sub != null && sub !== "" ? <span className={subTone ? `rv ${subTone}` : "rv"}>{sub}</span> : null}
    </>
  );
  if (onClick)
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={ariaLabel}>
        {body}
      </button>
    );
  return (
    <span className={cls} aria-label={ariaLabel} role={ariaLabel ? "group" : undefined}>
      {body}
    </span>
  );
}

export interface PegRailProps {
  /** The label over the rail (`.lbr`); a rail without label is a plain row of pegs. */
  label?: ReactNode;
  /** `lb` = labelled rail (the bar sits under the label); `back` = the back rail (smaller pegs). */
  variant?: "front" | "back";
  /** Pegs from the left instead of spread across the rail. */
  start?: boolean;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}
/** `.rail2`: the rail bar with its pegs (front = el siete, back = banquillo and whoever can come). */
export function PegRail({ label, variant = "front", start = false, children, className = "", ariaLabel }: PegRailProps) {
  const cls = ["rail2", label ? "lb" : "", variant === "back" ? "back" : "", className].filter(Boolean).join(" ");
  return (
    <div className={cls} role={ariaLabel ? "group" : undefined} aria-label={ariaLabel}>
      {label ? <p className="lbr">{label}</p> : null}
      <div className="pegs" style={start ? { justifyContent: "flex-start", gap: 18 } : undefined}>
        {children}
      </div>
    </div>
  );
}


export interface PegWallProps<T> {
  items: readonly T[];
  /** Pegs per rail (pegsPerRail()). */
  perRail: number;
  render: (item: T) => ReactNode;
  /** What the wall says when it has nothing to hang (`.nores`). */
  empty?: ReactNode;
  ariaLabel?: string;
  className?: string;
}
/** `.wall`: the dressing-room wall — the items hung on rails of `perRail`, scrolling inside. */
export function PegWall<T>({ items, perRail, render, empty, ariaLabel = "La percha del vestuario", className = "" }: PegWallProps<T>) {
  return (
    <div className={`wall ${className}`.trim()} aria-label={ariaLabel} role="group">
      {railsOf(items, perRail).map((row, i) => (
        <PegRail key={i}>{row.map(render)}</PegRail>
      ))}
      {!items.length && empty ? <p className="nores">{empty}</p> : null}
    </div>
  );
}
