// «Tú»'s toast (the kit's tk-toast): `say(text)` shows it for 3.2 s in a live region; `say(text, undo)` adds
// «Deshacer», which runs `undo` once and closes it. Fixed at the bottom, outside the content container (a
// container is the containing block of fixed boxes): the shell renders `node` as a child of the page root.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { TuIcon } from "../../../../components/vidrio/tu/ui";
import type { Say } from "../places/types";

export function useTuToast(): { say: Say; node: ReactNode } {
  const [said, setSaid] = useState<{ t: string; on: boolean; undo: (() => void) | null }>({ t: "", on: false, undo: null });
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const say = useCallback<Say>((t, undo) => {
    window.clearTimeout(timer.current);
    setSaid({ t, on: true, undo: undo ?? null });
    timer.current = window.setTimeout(() => setSaid((s) => ({ ...s, on: false, undo: null })), undo ? 6000 : 3200);
  }, []);
  const undo = () => {
    const u = said.undo;
    window.clearTimeout(timer.current);
    setSaid((s) => ({ ...s, on: false, undo: null }));
    u?.();
  };
  const node = (
    <>
      <p className="vd-vh" role="status" aria-live="polite">
        {said.t}
      </p>
      <div className={`vd-glass tk-toast${said.on ? " is-on" : ""}`} aria-hidden={!said.undo}>
        <TuIcon name="check" className="nx-ic" />
        <span aria-hidden="true">{said.t}</span>
        {said.undo && (
          <button type="button" onClick={undo}>
            Deshacer
          </button>
        )}
      </div>
    </>
  );
  return { say, node };
}
