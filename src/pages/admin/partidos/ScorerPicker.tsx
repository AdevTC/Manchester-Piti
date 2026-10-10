// «¿Quién marcó?» — the scorer picker of a goal row, as on the canvas (stats-gen/ad-v2-full.mjs `pkBody`,
// shots-adv2f/partidos-acta.png): the v2 Popover, IN PLACE right under its row (the row goes to the top
// of the panel, so the scoreboard never scrolls away), a bottom sheet on phones. Step 1: the scorer by
// dorsal — on the pitch first («titulares primero»), then the banquillo — or «Autogol de RIVAL» /
// «Lo completo luego» / «Quitar este gol»; step 2: the pass, optional («Sin asistencia», «← Cambiar
// goleador»). Esc / a press outside close it; typing a dorsal picks that player.
import { useEffect, useRef, type RefObject } from "react";
import { Popover } from "../ui/layers";
import type { PickOption } from "./pickModel";

export interface ScorerPickerProps {
  step: "s" | "a";
  /** 1-based goal number, its minute and (step 2) its scorer's name. */
  goal: { n: number; minute: number | undefined; scorerName: string };
  /** Starters (and step 2: without the scorer). */
  field: PickOption[];
  bench: PickOption[];
  /** The current choice (highlighted). */
  current: string | null;
  rival: string;
  anchorRef: RefObject<HTMLElement | null>;
  onScorer: (id: string | "og") => void;
  onAssist: (id: string | null) => void;
  /** Step 2 → back to step 1. */
  onBack: () => void;
  onRemove: () => void;
  onClose: () => void;
  /** Nobody is called up yet: go and make the convocatoria. */
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
  const first = useRef<HTMLButtonElement>(null);
  const { step, goal, field, bench, current, rival } = p;
  const all = [...field, ...bench];
  useDorsalKeys(all, (id) => (step === "s" ? p.onScorer(id) : p.onAssist(id)));
  const option = (o: PickOption, i: number, isBench: boolean) => (
    <button
      key={o.id}
      ref={!isBench && i === 0 ? first : undefined}
      type="button"
      className={["pp", isBench ? "bench" : "", current === o.id ? "on" : ""].filter(Boolean).join(" ")}
      aria-pressed={current === o.id}
      aria-label={step === "s" ? `${o.name} marcó el gol ${goal.n}` : `Pase de ${o.name}`}
      onClick={() => (step === "s" ? p.onScorer(o.id) : p.onAssist(o.id))}
    >
      <b>{o.num}</b>
      <small>{o.name}</small>
    </button>
  );
  const footer =
    step === "s" ? (
      <>
        <button type="button" onClick={() => p.onScorer("og")} aria-pressed={current === "og"}>
          Autogol de {rival}
        </button>
        <button type="button" onClick={p.onClose}>
          Lo completo luego
        </button>
        <button type="button" onClick={p.onRemove}>
          Quitar este gol
        </button>
      </>
    ) : (
      <>
        <button type="button" onClick={() => p.onAssist(null)}>
          Sin asistencia
        </button>
        <button type="button" onClick={p.onBack}>
          ← Cambiar goleador
        </button>
      </>
    );
  return (
    <Popover
      open
      onClose={p.onClose}
      anchorRef={p.anchorRef}
      title={step === "s" ? "¿Quién marcó?" : "¿Quién le dio el pase?"}
      subtitle={step === "s" ? `Gol ${goal.n}${goal.minute !== undefined ? ` (${goal.minute}′)` : ""} · paso 1 de 2` : `Gol de ${goal.scorerName} · paso 2 de 2`}
      footer={footer}
      initialFocus={all.length ? first : undefined}
    >
      {!all.length ? (
        <>
          <p className="pk-lb">Aún no hay convocados: el goleador sale de la convocatoria.</p>
          <div className="pkx">
            <button type="button" onClick={p.onGoConvocatoria}>
              Hacer la convocatoria
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="pk-lb">{step === "s" ? "En el campo · titulares primero" : "Asistencia (opcional)"}</p>
          <div className="pg">{field.map((o, i) => option(o, i, false))}</div>
          {bench.length ? (
            <>
              <p className="pk-lb">Banquillo</p>
              <div className="pg">{bench.map((o, i) => option(o, i, true))}</div>
            </>
          ) : null}
        </>
      )}
    </Popover>
  );
}
