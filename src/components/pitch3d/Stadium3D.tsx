import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { unsupportedReason, type Unsupported } from "./support";
import type {
  CameraPreset,
  EngineInfo,
  Handle,
  PickResult,
  PitchPoint,
  PlayController,
  PlayFrame,
  PlayOptions,
  PlayerSpec,
  Quality,
  RevealOptions,
  RivalSpec,
} from "./types";

/**
 * What the host can ask of the stadium. Calls made while the engine is still loading are queued and
 * run once it is up; the sequences (intro, reveal, setCamera) reject if the 3D never starts, so a
 * host awaiting them can fall back to its 2D moment.
 */
export interface Stadium3DHandle {
  /** True once the engine has mounted (until it fails or unmounts). */
  isReady(): boolean;
  setPlayers(players: PlayerSpec[], opts?: { animate?: boolean }): void;
  setRivals(rivals: RivalSpec[], opts?: { animate?: boolean }): void;
  setBall(ball: PitchPoint | null): void;
  setCamera(preset: CameraPreset, opts?: { duration?: number }): Promise<void>;
  setBoard(messages: string[]): void;
  /** Overrides the document theme until the next theme change of the page. */
  setTheme(theme: "dark" | "light"): void;
  /** Floodlights on one by one, crane flyover down to the TV camera, players rise onto the grass. */
  intro(): Promise<void>;
  /** La charla: visits each player in `order`, then pulls back to the whole seven. */
  reveal(order: string[], opts?: RevealOptions): Promise<void>;
  /** Plays a jugada (engine coordinates, see pizarra/plays toEngineFrames). Null while not ready. */
  play(frames: PlayFrame[], opts?: PlayOptions): PlayController | null;
  /** Player under the pointer, else the pitch point (engine coordinates). Null while not ready. */
  pick(clientX: number, clientY: number): PickResult;
  /** Screen position of a shirt relative to the stadium element, for host overlays. */
  project(id: string): { x: number; y: number; visible: boolean } | null;
  pause(): void;
  resume(): void;
  info(): EngineInfo | null;
}

export type Stadium3DState = "loading" | "ready" | "unsupported" | "failed";

interface Props {
  ref?: Ref<Stadium3DHandle>;
  /** Our seven. Synced to the engine whenever the array changes (players glide to new spots). */
  players: PlayerSpec[];
  rivals?: RivalSpec[];
  ball?: PitchPoint | null;
  /** Camera at mount (later moves go through the handle). */
  camera?: CameraPreset;
  /** Messages on the LED boards. */
  board?: string[];
  /** Broadcast name plates under the shirts (default true). */
  labels?: boolean;
  quality?: Quality;
  className?: string;
  /** The device does not get the 3D (automation, reduced motion/data, low memory, no WebGL2): keep the 2D board. */
  onUnsupported?: (reason: Unsupported) => void;
  /** The 3D failed to load, or broke later (WebGL context lost): the stadium is gone, show the 2D board. */
  onError?: (error: Error) => void;
  /** First frame drawn. */
  onReady?: () => void;
}

const toError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

/**
 * The 3D stadium of the pizarra (three.js, lazy chunk). Nothing 3D is downloaded unless the device
 * passes `supported()`; the engine sleeps while off-screen or with the tab hidden, follows the
 * document theme and is disposed on unmount.
 */
export function Stadium3D({ ref, players, rivals, ball, board, quality, className, ...rest }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<Handle | null>(null);
  const pending = useRef<Promise<Handle> | null>(null);
  const theme = useDocumentTheme();
  const latest = useRef({ players, rivals, ball, board, quality, theme, ...rest });
  const [reason] = useState<Unsupported | null>(unsupportedReason);
  const [state, setState] = useState<Stadium3DState>(reason ? "unsupported" : "loading");
  useEffect(() => {
    latest.current = { players, rivals, ball, board, quality, theme, ...rest };
  });

  useEffect(() => {
    if (reason) {
      latest.current.onUnsupported?.(reason);
      return;
    }
    const el = host.current;
    if (!el) return;
    const ac = new AbortController();
    const fail = (error: Error) => {
      handle.current?.dispose();
      handle.current = null;
      pending.current = null;
      setState("failed");
      latest.current.onError?.(error);
    };
    const p = import("./engine").then(({ mount }) => {
      if (ac.signal.aborted) throw new DOMException("Pizarra 3D desmontada", "AbortError");
      const o = latest.current;
      return mount(el, {
        theme: o.theme,
        players: o.players,
        rivals: o.rivals,
        ball: o.ball,
        camera: o.camera,
        board: o.board,
        labels: o.labels,
        quality: o.quality,
        signal: ac.signal,
        onReady: () => latest.current.onReady?.(),
        onError: (error) => {
          if (!ac.signal.aborted) fail(error);
        },
      });
    });
    pending.current = p;
    p.then(
      (h) => {
        if (ac.signal.aborted) return h.dispose();
        handle.current = h;
        // the props may have changed while the chunk and the kit loaded
        const o = latest.current;
        h.setPlayers(o.players, { animate: false });
        h.setRivals(o.rivals ?? [], { animate: false });
        h.setBall(o.ball ?? null);
        if (o.board) h.setBoard(o.board);
        h.setTheme(o.theme);
        setState("ready");
      },
      (error: unknown) => {
        if (ac.signal.aborted) return;
        console.error("No se ha podido cargar la pizarra 3D:", error);
        fail(toError(error));
      },
    );
    return () => {
      ac.abort();
      handle.current?.dispose();
      handle.current = null;
      pending.current = null;
    };
  }, [reason]);

  // declarative props → engine (the first values went in with the mount)
  useEffect(() => handle.current?.setPlayers(players), [players]);
  useEffect(() => handle.current?.setRivals(rivals ?? []), [rivals]);
  useEffect(() => handle.current?.setBall(ball ?? null), [ball]);
  useEffect(() => {
    if (board) handle.current?.setBoard(board);
  }, [board]);
  useEffect(() => handle.current?.setTheme(theme), [theme]);

  useImperativeHandle(ref, () => {
    /** Runs now if the engine is up, else once it is (dropped if it never starts). */
    const later = (fn: (h: Handle) => void) => {
      if (handle.current) return fn(handle.current);
      pending.current?.then(fn, () => undefined);
    };
    /** Like `later`, for the sequences: rejects if the 3D is not there. */
    const run = <T,>(fn: (h: Handle) => Promise<T>): Promise<T> => {
      if (handle.current) return fn(handle.current);
      if (pending.current) return pending.current.then(fn);
      return Promise.reject(new Error("La pizarra 3D no está disponible"));
    };
    return {
      isReady: () => handle.current !== null,
      setPlayers: (list, o) => later((h) => h.setPlayers(list, o)),
      setRivals: (list, o) => later((h) => h.setRivals(list, o)),
      setBall: (b) => later((h) => h.setBall(b)),
      setCamera: (preset, o) => run((h) => h.setCamera(preset, o)),
      setBoard: (messages) => later((h) => h.setBoard(messages)),
      setTheme: (t) => later((h) => h.setTheme(t)),
      intro: () => run((h) => h.intro()),
      reveal: (order, o) => run((h) => h.reveal(order, o)),
      play: (frames, o) => handle.current?.play(frames, o) ?? null,
      pick: (x, y) => handle.current?.pick(x, y) ?? null,
      project: (id) => handle.current?.project(id) ?? null,
      pause: () => later((h) => h.pause()),
      resume: () => later((h) => h.resume()),
      info: () => handle.current?.info() ?? null,
    };
  }, []);

  return <div ref={host} className={className} data-state={state} />;
}
