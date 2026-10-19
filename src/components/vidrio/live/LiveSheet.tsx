// The sheet the floating score opens (V-Vivo «Tócalo para abrirlo»): the score and the state, the last three
// plays with «N jugadas más · Ver todo el partido», who is on the pitch, «Abrir el partido» (a View Transition
// into the match page's scoreboard), «Sacar el marcador» on desktop, the state's own action (la mesa, the
// vote, «¿Vas hoy?») and «Ocultar…». A dialog: focus goes to it, Escape and a tap outside close it.
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { PlayRow } from "../../../lib/derived/vidrio/plays";
import { SeeAll } from "../SeeAll";
import { moreText, SHEET_PLAYS, type SheetModel } from "./liveModel";

export type RsvpAnswer = "yes" | "maybe" | "no";
const ANSWERS: { a: RsvpAnswer; label: string }[] = [
  { a: "yes", label: "Voy" },
  { a: "maybe", label: "Duda" },
  { a: "no", label: "No voy" },
];

export function PlayGlyph({ row }: { row: Pick<PlayRow, "kind" | "card"> }) {
  if (row.card) return <span className={`vd-glyph${row.card === "r" ? " vd-glyph--roja" : ""}`} aria-hidden="true"><i /></span>;
  if (row.kind === "gol")
    return (
      <span className="vd-glyph vd-glyph--gol" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 7.5l4 2.9-1.5 4.7h-5L8 10.4z" fill="currentColor" />
        </svg>
      </span>
    );
  if (row.kind === "cambio")
    return (
      <span className="vd-glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M7 4v14M7 18l-3-3M7 18l3-3M17 20V6M17 6l-3 3M17 6l3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  return <span className="vd-glyph vd-glyph--dot" aria-hidden="true"><i /></span>;
}

export function PlayList({ rows }: { rows: readonly PlayRow[] }) {
  return (
    <ol className="vd-plays">
      {rows.map((r) => (
        <li key={r.id} className={`vd-play${(r.goal ? r.goal === "against" : r.side === "them") ? " vd-play--them" : ""}`}>
          <span className="vd-clock">{r.minuteText}</span>
          <PlayGlyph row={r} />
          <div>
            <b>{r.title}</b>
            {r.sub && <span>{r.sub}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export interface LiveSheetProps {
  model: SheetModel;
  rival: string;
  matchId: string;
  rows: readonly PlayRow[];
  phone: boolean;
  /** Where it sits (fixed; computed from the float). */
  style?: CSSProperties;
  up?: boolean;
  /** The View Transition name it lands on the match page with (none on match pages). */
  vtName?: string;
  /** Spread on the plays (useGrow().summaryProps). */
  growProps?: { className: string; style?: CSSProperties };
  onMore: () => void;
  onClose: () => void;
  onHide: () => void;
  /** «Sacar el marcador» (desktop only). */
  onPip?: () => void;
  pipOn?: boolean;
  mine?: RsvpAnswer | null;
  onAnswer?: (a: RsvpAnswer) => void;
  /** A connection note («Reconectando…»). */
  sync?: string;
  /** Navigating with the View Transition (not under reduced motion). */
  transition?: boolean;
  children?: ReactNode;
}

const crossIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export function LiveSheet(props: LiveSheetProps) {
  const { model, rival, matchId, rows, phone, style, up, vtName, growProps, onMore, onClose, onHide, onPip, pipOn, mine, onAnswer, sync, transition = true } = props;
  const ref = useRef<HTMLDivElement | null>(null);
  const close = useRef<HTMLButtonElement | null>(null);
  // (the latest onClose, for the listener set up once per opening)
  const closeNow = useRef(onClose);
  useEffect(() => {
    closeNow.current = onClose;
  }, [onClose]);

  // focus into it on open, back to the drop on close; a tap outside (not on the drop) closes it
  useEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus({ preventScroll: true });
    const outside = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t || ref.current?.contains(t)) return;
      if (t instanceof Element && t.closest(".vd-float,.vd-livelog,.vd-pip")) return;
      closeNow.current();
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, []);

  const shown = rows.slice(0, SHEET_PLAYS);
  const more = rows.length - shown.length;
  const pick = ANSWERS.findIndex((x) => x.a === mine);
  const cls = `vd-glass vd-glass--deep vd-sheet${phone ? " vd-sheet--phone" : ""}${up && !phone ? " vd-sheet--up" : ""}${vtName ? " vd-morph" : ""}`;
  return (
    <div
      ref={ref}
      className={cls}
      style={vtName ? { ...style, viewTransitionName: vtName } : style}
      role="dialog"
      aria-label={`El partido contra ${rival}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {phone && <div className="vd-sheet__grab" aria-hidden="true" />}
      <div className="vd-sheet__head">
        <img src="/crest-128.webp" alt="" width={40} height={40} />
        {model.big && <span className="vd-score vd-sheet__big">{model.big}</span>}
        <div className="vd-sheet__who">
          <h3>{rival}</h3>
          <span className="vd-sheet__status">
            {model.live && (
              <span className="vd-sheet__live">
                <span className="vd-livedot" aria-hidden="true" />
                En directo
              </span>
            )}
            {model.clock && <span className="vd-clock">{model.clock}</span>}
            <span>{model.status}</span>
          </span>
        </div>
        <button ref={close} type="button" className="vd-glass vd-press vd-sheet__x" aria-label="Cerrar" onClick={onClose}>
          {crossIcon}
        </button>
      </div>
      {model.plays && shown.length > 0 && (
        <section className={growProps?.className} style={growProps?.style} aria-label="Las últimas jugadas">
          <PlayList rows={shown} />
          <SeeAll summary={<b>{moreText(more)}</b>} count={more} label="Ver todo el partido" onOpen={onMore} />
        </section>
      )}
      {model.onField && <p className="vd-sheet__note">{model.onField}</p>}
      {model.note && <p className="vd-sheet__note">{model.note}</p>}
      {sync && <p className="vd-sheet__note">{sync}</p>}
      {model.rsvp && onAnswer && (
        <div className="vd-glass vd-seg" style={{ "--n": 3, "--i": Math.max(0, pick) } as CSSProperties} role="group" aria-label="¿Vas hoy?">
          {pick >= 0 && <span className="vd-shelf__bead" aria-hidden="true" />}
          {ANSWERS.map(({ a, label }) => (
            <button key={a} type="button" className="vd-seg__b" aria-pressed={mine === a} onClick={() => onAnswer(a)}>
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="vd-sheet__btns">
        {model.action?.kind === "mesa" && (
          <Link className="vd-glass vd-btn vd-btn--pri vd-press" to="/matches/$matchId/mesa" params={{ matchId }}>
            {model.action.label}
          </Link>
        )}
        {model.action?.kind === "votar" && (
          <Link className="vd-glass vd-btn vd-btn--pri vd-press" to="/matches/$matchId" params={{ matchId }} search={{ tab: "vestuario" }}>
            {model.action.label}
          </Link>
        )}
        <Link className={`vd-glass vd-btn vd-press${model.action ? "" : " vd-btn--pri"}`} to="/matches/$matchId" params={{ matchId }} viewTransition={transition && !!vtName}>
          {model.open}
        </Link>
        {onPip && (
          <button type="button" className="vd-glass vd-btn vd-press" aria-pressed={!!pipOn} onClick={onPip}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4.5" width="18" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
              <rect x="11.5" y="11.5" width="7" height="5.5" rx="1.5" fill="currentColor" />
            </svg>
            Sacar el marcador
          </button>
        )}
      </div>
      <button type="button" className="vd-sheet__hide" onClick={onHide}>
        {model.hide}
      </button>
    </div>
  );
}
