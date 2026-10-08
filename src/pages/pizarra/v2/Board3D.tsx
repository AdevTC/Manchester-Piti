// The board's one 3D stadium (never two WebGL contexts): mounted the first time a 3D moment wants it
// (the intro, the charla, a jugada playing «En 3D») — only then is the three.js chunk fetched — and kept
// under the 2D board after that, paused while no moment needs it (the engine also sleeps on its own while
// off-screen or with the tab hidden). The director (director.ts) films what the board asks for. Whatever
// goes wrong — the device can't, the chunk doesn't load, the GPU drops the context, the engine refuses a
// sequence — the board stays 2D and is told why. Disposed with the board.
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import type { Stadium3DHandle } from "../../../components/pitch3d/Stadium3D";
import type { PlayerSpec } from "../../../components/pitch3d/types";
import { Director, type DirectorEvents, type Shot } from "./director";

const Stadium3D = lazy(() => import("../../../components/pitch3d/Stadium3D").then((m) => ({ default: m.Stadium3D })));

/** A chunk that fails to load must not take the board down: it reports and renders nothing. */
class Guard extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("No se ha podido cargar la pizarra 3D:", error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface Board3DProps {
  /** What the stadium films now. */
  shot: Shot;
  /** The seven and the LED boards the stadium starts with (only read when it mounts). */
  players: PlayerSpec[];
  board: string[];
  /** First frame drawn: the stadium can be shown. */
  onReady: () => void;
  /** The device can't, or the stadium broke: the board goes 2D. */
  onFail: (why: "unsupported" | "failed") => void;
  events: Omit<DirectorEvents, "onFail">;
}

export function Board3D(p: Board3DProps) {
  const ref = useRef<Stadium3DHandle>(null);
  const [ready, setReady] = useState(false);
  const [start] = useState(() => ({ players: p.players, board: p.board }));
  const latest = useRef(p);
  useEffect(() => {
    latest.current = p;
  });
  const director = useRef<Director | null>(null);

  // the director lives while the engine is up
  useEffect(() => {
    const h = ref.current;
    if (!ready || !h) return;
    const d = new Director(h, {
      onIntroDone: () => latest.current.events.onIntroDone(),
      onFrame: (i) => latest.current.events.onFrame(i),
      onStep: (s) => latest.current.events.onStep(s),
      onFail: (err) => {
        console.error("La pizarra 3D no ha podido seguir:", err);
        latest.current.onFail("failed");
      },
    });
    director.current = d;
    d.direct(latest.current.shot);
    return () => {
      d.dispose();
      director.current = null;
    };
  }, [ready]);
  // every shot the board asks for (the director skips the ones already on)
  useEffect(() => {
    director.current?.direct(p.shot);
  });

  return (
    <Guard onError={() => latest.current.onFail("failed")}>
      <Suspense fallback={null}>
        <Stadium3D
          ref={ref}
          className="p3d-in"
          players={start.players}
          camera="tv"
          board={start.board}
          onReady={() => {
            setReady(true);
            latest.current.onReady();
          }}
          onUnsupported={() => latest.current.onFail("unsupported")}
          onError={() => latest.current.onFail("failed")}
        />
      </Suspense>
    </Guard>
  );
}
