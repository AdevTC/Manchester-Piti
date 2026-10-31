// The compact stage on every place but Tú (TuCarta tc-mast): the mini card (his GLOBAL over his printed shirt; a
// dot when something waits on him) — a button back to Tú that carries the card's View Transition name, so the
// card morphs —, his name and his line.
import type { CSSProperties } from "react";
import { Shirt, type CardModel } from "../TuCard";
import { tierCls } from "./tierCls";

export interface MastheadProps {
  card: CardModel;
  /** «Jordi». */
  name: string;
  /** «28 · Lateral derecho · 59 Bronce, provisional» / «Socio del club · @jordi». */
  line: string;
  /** What waits on him (the mini card's dot and its name). */
  pending: number;
  onTu: () => void;
  /** View Transition name shared with the stage's card. */
  vt?: string;
}

export function Masthead(p: MastheadProps) {
  const big = p.card.kind === "face" ? p.card.rating || "—" : p.card.kind === "carne" ? "S" : "?";
  const num = p.card.kind === "face" ? p.card.num : undefined;
  const label = `Volver a tu carta${p.pending ? `: ${p.pending} ${p.pending === 1 ? "cosa" : "cosas"} por hacer` : ""}`;
  return (
    <div className="tc-mast">
      <button type="button" className={`tc-mini ${tierCls(p.card)}`} onClick={p.onTu} aria-label={label} style={p.vt ? ({ viewTransitionName: p.vt } as CSSProperties) : undefined}>
        <b>{big}</b>
        <Shirt num={num} className="tc-mini__shirt" />
        {p.pending > 0 && <i aria-hidden="true" />}
      </button>
      <div className="tc-mast__t">
        <b>{p.name}</b>
        <span>{p.line}</span>
      </div>
    </div>
  );
}
