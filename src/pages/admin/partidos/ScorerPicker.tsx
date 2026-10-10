// «¿Quién marcó?» — the scorer picker of a goal row: a popover anchored under the row (it never scrolls
// the acta; it flips above when there is no room) and a bottom sheet on phones. Step 1: the scorer
// (titulares first, suplentes marked) or «Autogol de RIVAL»; step 2: the assist, optional («Sin
// asistencia»). «Lo completo luego» / Esc close it. Typing a dorsal picks that player.
import { useEffect, useRef, type RefObject } from "react";
import { Popover } from "../ui/layersV1";
import { useFrame } from "../ui/frame";
import type { PickOption } from "./pickModel";

export interface ScorerPickerProps {
  step: "s" | "a";
  /** 1-based goal number, its minute and (step 2) its scorer's name. */
  goal: { n: number; minute: number | undefined; scorerName: string };
  /** Called-up players for this step (the scorer is left out in step 2). */
  options: PickOption[];
  /** The current choice (highlighted). */
  current: string | null;
  rival: string;
  /** «Acta · J7 · 3–1» (the phone sheet's kicker). */
  kicker: string;
  anchorRef: RefObject<HTMLElement | null>;
  containerRef?: RefObject<HTMLElement | null>;
  onScorer: (id: string | "og") => void;
  onAssist: (id: string | null) => void;
  onClose: () => void;
  /** No one is called up yet: go and fill the convocatoria. */
  onGoConvocatoria: () => void;
}

/** Digits typed while the picker is open pick the player with that dorsal (as soon as it is unique). */
function useDorsalKeys(options: PickOption[], pick: (id: string) => void) {
  const buf = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ options, pick });
  useEffect(() => {
    latest.current = { options, pick };
  });
  useEffect(() => {
    const flush = () => {
      const exact = latest.current.options.find((o) => o.num === buf.current);
      buf.current = "";
      if (exact) latest.current.pick(exact.id);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !/^\d$/.test(e.key)) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      if (timer.current) clearTimeout(timer.current);
      let next = buf.current + e.key;
      const starts = (b: string) => latest.current.options.filter((o) => o.num.startsWith(b));
      if (!starts(next).length) next = e.key;
      buf.current = next;
      const cands = starts(next);
      if (cands.length === 1 && cands[0].num === next) {
        flush();
        return;
      }
      timer.current = setTimeout(flush, 700);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
}

export function ScorerPicker(p: ScorerPickerProps) {
  const { desktop } = useFrame();
  const first = useRef<HTMLButtonElement>(null);
  const { step, goal, options, current, rival } = p;
  useDorsalKeys(options, (id) => (step === "s" ? p.onScorer(id) : p.onAssist(id)));
  const title = step === "s" ? `Gol ${goal.n}${goal.minute !== undefined ? ` (${goal.minute}′)` : ""} · ¿Quién marcó?` : `Gol ${goal.n} de ${goal.scorerName} · ¿Quién dio el pase?`;
  const subtitle = step === "s" ? "Paso 1 de 2 · goleador" : "Paso 2 de 2 · asistencia, opcional";
  const footer = (
    <>
      <button type="button" className="btn sm line" onClick={p.onClose}>
        Lo completo luego
      </button>
      {desktop && <span className="kb">Esc para cerrar</span>}
    </>
  );
  const players = options.map((o, i) => (
    <button
      key={o.id}
      ref={i === 0 && step === "s" ? first : undefined}
      type="button"
      className={`pp${current === o.id ? " on" : ""}`}
      aria-pressed={current === o.id}
      aria-label={step === "s" ? `Gol ${goal.n}: lo marcó ${o.name}, dorsal ${o.num}` : `Asistencia de ${o.name}, dorsal ${o.num}`}
      onClick={() => (step === "s" ? p.onScorer(o.id) : p.onAssist(o.id))}
    >
      <b>{o.num}</b>
      <small>{o.name}</small>
      <em>{o.tag}</em>
    </button>
  ));
  return (
    <Popover open onClose={p.onClose} anchorRef={p.anchorRef} containerRef={p.containerRef} title={title} subtitle={subtitle} kicker={p.kicker} footer={footer} initialFocus={first} gap={20} className="ad-pick">
      {step === "s" && !options.length && (
        <div className="ad-pk-none">
          <p className="hint">Aún no hay convocados: el goleador sale de la convocatoria.</p>
          <button type="button" className="btn sm" onClick={p.onGoConvocatoria}>
            Hacer la convocatoria
          </button>
        </div>
      )}
      <div className="pg">
        {step === "a" && (
          <button ref={first} type="button" className={`pp wide${current === null ? " on" : ""}`} aria-label={`Gol ${goal.n} sin asistencia`} onClick={() => p.onAssist(null)}>
            <b>Sin asistencia</b>
            <small>Jugada individual, rebote o penalti</small>
          </button>
        )}
        {players}
        {step === "s" && (
          <button ref={options.length ? undefined : first} type="button" className={`pp wide${current === "og" ? " on" : ""}`} aria-label={`Gol ${goal.n}: autogol de ${rival}`} onClick={() => p.onScorer("og")}>
            <b>Autogol de {rival}</b>
            <small>Suma para el Piti, sin goleador nuestro</small>
          </button>
        )}
      </div>
    </Popover>
  );
}
