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
  /** Change name/number with a turn of the shirt instead of instantly. */
  flip?: boolean;
}
/** Real 3D kit (three.js, lazy chunk). Falls back to the flat SVG shirt if WebGL is unavailable. */
export function Jersey3D({ ref, label, className, flip = false, ...options }: Props) {
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
    // Nothing (chunk, model, shaders) loads until the shirt is about to scroll into view.
    let stopWatching = () => {};
    const near = new Promise<void>((ok) => {
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io.disconnect();
          ok();
        },
        { rootMargin: "300px" },
      );
      io.observe(el);
      stopWatching = () => io.disconnect();
    });
    near
      .then(() => (cancelled ? Promise.reject(new DOMException("unmounted", "AbortError")) : import("./scene")))
      .then(({ mountJersey }) => mountJersey(el, latest.current))
      .then((h) => {
        if (cancelled) return h.dispose();
        handle.current = h;
        h.set(latest.current); // options may have changed while the chunk and model loaded
        setState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("No se ha podido cargar la camiseta 3D:", error);
        setState("failed");
      });
    return () => {
      cancelled = true;
      stopWatching();
      handle.current?.dispose();
      handle.current = null;
    };
  }, []);
  const { kit, theme, name, num, zoom, lift } = options;
  const printed = useRef({ name, num });
  useEffect(() => {
    const h = handle.current;
    if (!h) return;
    const changed = printed.current.name !== name || printed.current.num !== num;
    printed.current = { name, num };
    if (flip && changed) {
      h.set({ kit, theme, zoom, lift });
      h.swap({ name, num });
    } else h.set({ kit, theme, name, num, zoom, lift });
  }, [kit, theme, name, num, zoom, lift, flip]);
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
