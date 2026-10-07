// «En 3D»: the jugada played in the 3D stadium, as a full-bleed layer under the HUD. The stadium chunk
// (three.js) is only fetched the first time it is wanted; the engine plays the jugada while the replay
// plays and rests (paused, the 2D board back on top) while it doesn't. Whatever goes wrong — the device
// can't, the chunk doesn't load, the GPU drops the context — the board stays 2D and is told why.
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Stadium3DHandle } from "../../../components/pitch3d/Stadium3D";
import type { PlayController, PlayerSpec } from "../../../components/pitch3d/types";
import type { Roles } from "../formations";
import { engineRivals, toEngineFrames, toEnginePoint, type Play } from "../plays";
import { pasoPose, participants } from "./jugadas";
import { GALONES, type Squad } from "./model";

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

export interface Replay3DProps {
  play: Play;
  /** The paso on screen when the engine takes over (it starts there). */
  frame: number;
  /** The replay plays: the engine plays the jugada; else it rests. */
  active: boolean;
  slow: boolean;
  /** Who the players are (name, dorsal), their galones, and whose shirt is yours. */
  squad: Squad;
  roles: Roles;
  meId: string | null;
  /** Messages for the LED boards. */
  led: string[];
  /** The engine reached paso i. */
  onFrame: (i: number) => void;
  /** First frame drawn: the stadium can be shown. */
  onReady: () => void;
  onFail: (why: "unsupported" | "failed") => void;
}

export function Replay3D(p: Replay3DProps) {
  const { play, squad, roles, meId } = p;
  const ref = useRef<Stadium3DHandle>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef(p);
  useEffect(() => {
    latest.current = p;
  });
  const frames = useMemo(() => toEngineFrames(play), [play]);
  const n = play.frames.length;
  // Our players and the rivals at their first spots (new arrays only when the jugada changes: the
  // stadium moves everyone to them on every new array).
  const players = useMemo(() => {
    const pose0 = pasoPose(play, 0);
    return participants(play).flatMap((id): PlayerSpec[] => {
      const c = squad.byId.get(id);
      const at = pose0.players[id];
      if (!c || !at) return [];
      const role = GALONES.find((g) => roles[g.key] === id)?.letter;
      return [{ id, name: c.name, num: c.num, ...toEnginePoint(at), kit: "home", highlight: id === meId, ...(role ? { role } : {}) }];
    });
  }, [play, squad, roles, meId]);
  const rivals = useMemo(() => engineRivals(play), [play]);
  const ball = useMemo(() => toEnginePoint(play.frames[0].ball), [play]);
  const ledKey = p.led.filter(Boolean).join("\n");
  const board = useMemo(() => ledKey.split("\n"), [ledKey]);

  useEffect(() => {
    const h = ref.current;
    if (!ready || !h) return;
    if (!p.active) {
      // back to 2D: the engine rests a moment later (after the crossfade)
      const t = window.setTimeout(() => h.pause(), 1100);
      return () => window.clearTimeout(t);
    }
    h.resume();
    h.setRivals(rivals, { animate: true });
    let ctl: PlayController | null = null;
    try {
      ctl = h.play(frames, { loop: true, speed: p.slow ? 0.5 : 1, onFrame: (i) => latest.current.onFrame(i) });
      const from = latest.current.frame;
      if (ctl && n > 1 && from > 0) ctl.seek(from / (n - 1));
    } catch (err) {
      console.error("La jugada no se ha podido reproducir en 3D:", err);
      latest.current.onFail("failed");
    }
    return () => ctl?.stop();
  }, [ready, p.active, p.slow, frames, n, rivals]);

  return (
    <Guard onError={() => latest.current.onFail("failed")}>
      <Suspense fallback={null}>
        <Stadium3D
          ref={ref}
          className="p3d-in"
          players={players}
          rivals={rivals}
          ball={ball}
          camera="tv"
          board={board}
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
