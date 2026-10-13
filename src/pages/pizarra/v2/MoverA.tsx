// «Mover a…» (from the fan): the seven's puestos as FUT rows; choosing one moves the cromo there (swapping
// with whoever is in it). A dialog: the focus goes to the first puesto, Tab stays inside, Escape closes, and
// the focus goes back to where it was (the cromo) when it closes.
import { useEffect, useRef } from "react";
import type { MoveOption } from "./moveTo";

export interface MoverAProps {
  name: string;
  num: number;
  options: MoveOption[];
  onPick: (i: number) => void;
  onClose: () => void;
}

export function MoverA({ name, num, options, onPick, onClose }: MoverAProps) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const prev = document.activeElement as HTMLElement | null;
    node.querySelector<HTMLElement>(".mv-o:not([disabled])")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const f = Array.from(node.querySelectorAll<HTMLElement>("button:not([disabled])"));
      if (!f.length) return;
      const a = f[0];
      const z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus({ preventScroll: true });
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus({ preventScroll: true });
      }
    };
    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      if (prev?.isConnected) prev.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div ref={ref} className="mva" role="dialog" aria-modal="true" aria-labelledby="mva-h">
      <button type="button" className="mva-bk" onClick={onClose} aria-label="Cerrar" tabIndex={-1} />
      <div className="mva-p">
        <h3 className="lg-h" id="mva-h">
          <b aria-hidden="true">{num}</b> Mover a {name}
        </h3>
        <ul>
          {options.map((o) => (
            <li key={o.i}>
              <button type="button" className={"mv-o" + (o.here ? " here" : "")} disabled={o.here} aria-label={o.aria} onClick={() => onPick(o.i)}>
                <span className="mv-l">{o.lab}</span>
                {o.pos ? (
                  // (the puesto by name and how well he fits it, over who is there)
                  <span className="mv-s pzp-mv2">
                    <span>{o.pos}</span>
                    <span>{o.sub}</span>
                  </span>
                ) : (
                  <span className="mv-s">{o.sub}</span>
                )}
                {o.fam && (
                  <span className={"mv-f" + (o.fam === "!" ? " no" : "")} aria-hidden="true">
                    {o.fam}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="b3" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
