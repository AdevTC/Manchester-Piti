import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Jersey } from "../Jersey";
import type { JerseyHandle, JerseyOptions } from "./scene";

export interface Jersey3DRef {
  turn(): void;
}
interface Props extends JerseyOptions {
  ref?: Ref<Jersey3DRef>;
  label: string;
  className?: string;
}
/** Real 3D kit (three.js, lazy chunk). Falls back to the flat SVG shirt if WebGL is unavailable. */
export function Jersey3D({ ref, label, className, ...options }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const handle = useRef<JerseyHandle | null>(null);
  const latest = useRef(options);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  useEffect(() => {
    latest.current = options;
  });
  useImperativeHandle(ref, () => ({ turn: () => handle.current?.turn() }), []);
  useEffect(() => {
    let cancelled = false;
    const el = canvas.current;
    if (!el) return;
    import("./scene")
      .then(({ mountJersey }) => mountJersey(el, latest.current))
      .then((h) => {
        if (cancelled) return h.dispose();
        handle.current = h;
        h.set(latest.current); // options may have changed while the chunk and model loaded
        setState("ready");
      })
      .catch((error: unknown) => {
        console.error("No se ha podido cargar la camiseta 3D:", error);
        if (!cancelled) setState("failed");
      });
    return () => {
      cancelled = true;
      handle.current?.dispose();
      handle.current = null;
    };
  }, []);
  const { kit, theme, name, num, zoom, lift } = options;
  useEffect(() => {
    handle.current?.set({ kit, theme, name, num, zoom, lift });
  }, [kit, theme, name, num, zoom, lift]);
  return (
    <div className={className} data-state={state}>
      {state === "failed" ? (
        <div className="vx-shirt-flat">
          <Jersey name={name} number={Number(num) || 0} size="xl" />
        </div>
      ) : (
        <canvas ref={canvas} tabIndex={0} role="img" aria-label={label} />
      )}
    </div>
  );
}
