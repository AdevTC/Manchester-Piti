// La pizarra «Noche de partido» — the director of the board's one 3D stadium. The board says what the
// stadium should show (a «shot»: at rest, the intro, a jugada playing, or a step of the charla) and the
// director turns each change into engine calls, as designed: the intro once; a jugada played on a loop
// while the replay plays; the charla filmed step by step (the system from the stands down to the TV
// camera, the hero shots of the seven with the engine reporting each one, the plan from above, the
// jugada with the engine reporting each paso, «¡A por ellos!» back in the stands); and, at rest, the
// seven back at their spots and the engine paused once the 2D board has faded back in. Shots that don't
// change don't touch the engine. No React here: the board owns the stadium, the director only talks to
// its handle.
import type { Stadium3DHandle } from "../../../components/pitch3d/Stadium3D";
import type { PitchPoint, PlayController, PlayFrame, PlayerSpec, RivalSpec } from "../../../components/pitch3d/types";
import type { Lineup } from "../formations";
import { toEnginePoint, type Play } from "../plays";
import { charlaLast, STEP_JUGADA, STEP_PLAN, stepKind } from "./charla";
import { slotPos } from "./geometry";
import { participants, pasoPose } from "./jugadas";
import { GALONES, type Squad } from "./model";

/** The 2D board fades back in over this long (ms); then the engine rests. */
export const REST_PAUSE_MS = 1100;
/** Time on each of the seven in the charla's hero shots (ms), as designed. */
export const HERO_MS = 2300;

/** One paso of a jugada as the engine films it (engine coordinates). */
export interface EnginePaso {
  /** Our players present in this paso. */
  players: { id: string; x: number; y: number }[];
  rivals: RivalSpec[];
  ball: PitchPoint;
}

export type Shot =
  /** The stadium is there but waits (the intro is about to start): nothing moves. */
  | { kind: "hold" }
  | { kind: "rest"; players: PlayerSpec[]; board: string[] }
  | { kind: "intro"; players: PlayerSpec[] }
  | {
      kind: "jugada";
      /** Changes when the jugada (or its speed) changes: it starts over. */
      key: string;
      board: string[];
      players: PlayerSpec[];
      rivals: RivalSpec[];
      frames: PlayFrame[];
      /** The paso on screen when the engine takes over (it starts there). */
      from: number;
      slow: boolean;
    }
  | {
      kind: "charla";
      step: number;
      playing: boolean;
      /** The seven at their spots (the hero, when paused on him, highlighted). */
      players: PlayerSpec[];
      /** Who is in each slot (step i + 1 presents slot i). */
      slots: (string | null)[];
      /** The charla's jugada: its key, the engine frames and every paso's pose. */
      jugada: { key: string; frames: PlayFrame[]; pasos: EnginePaso[] };
      /** LED boards: during the charla and at «¡A por ellos!». */
      board: string[];
      boardEnd: string[];
    };

export interface DirectorEvents {
  /** The intro finished (or could not run): the 2D board comes back. */
  onIntroDone: () => void;
  /** The replay's jugada reached paso i. */
  onFrame: (i: number) => void;
  /** The charla reached a step on its own (a hero shot, a paso, the end of the jugada). */
  onStep: (step: number) => void;
  /** The engine refused a sequence: the board goes 2D. */
  onFail: (err: unknown) => void;
}

/** The charla steps the engine itself paces while it plays: the seven (hero shots) and the jugada. */
export function engineDriven(step: number, last: number, playing: boolean, slots: (string | null)[]): boolean {
  if (!playing) return false;
  const k = stepKind(step, last);
  if (k === "siete") return slots.slice(step - 1).some(Boolean);
  return k === "jugada";
}

const shotKey = (s: Shot): string =>
  s.kind === "jugada"
    ? "j:" + s.key + ":" + (s.slow ? 2 : 1)
    : s.kind === "charla"
      ? "c:" + s.step + ":" + (s.playing ? 1 : 0) + ":" + s.jugada.key
      : s.kind;

export class Director {
  private key = "";
  private kind: Shot["kind"] | "" = "";
  private ctl: PlayController | null = null;
  /** The running jugada (a token: the engine's reports of an older one are ignored). */
  private playTok: object | null = null;
  /** The running hero shots (a token: a newer run or a pause makes the old one stale). */
  private rv: object | null = null;
  private restT = 0;
  private introRun: object | null = null;
  private h: Stadium3DHandle;
  private ev: DirectorEvents;

  constructor(h: Stadium3DHandle, ev: DirectorEvents) {
    this.h = h;
    this.ev = ev;
  }

  /** The board's events (the latest callbacks). */
  listen(ev: DirectorEvents): void {
    this.ev = ev;
  }

  /** Films `shot` (nothing happens when it is the shot already on). */
  direct(shot: Shot): void {
    const key = shotKey(shot);
    if (key === this.key) return;
    this.key = key;
    const h = this.h;
    try {
      if (shot.kind !== this.kind) {
        this.stopPlay();
        this.rv = null;
        window.clearTimeout(this.restT);
        const was = this.kind;
        this.kind = shot.kind;
        if (shot.kind === "hold") return;
        if (shot.kind === "rest") {
          // back to the board: the seven at their spots, the TV camera; the engine rests after the fade
          if (was === "intro") this.introRun = null;
          h.setPlayers(shot.players, { animate: false });
          h.setBoard(shot.board);
          void h.setCamera("tv", { duration: was === "intro" ? 0 : 600 }).catch(() => undefined);
          this.restT = window.setTimeout(() => {
            if (this.kind === "rest") h.pause();
          }, REST_PAUSE_MS);
          return;
        }
        h.resume();
      }
      if (shot.kind === "intro") return this.intro(shot.players);
      if (shot.kind === "jugada") return this.jugada(shot);
      if (shot.kind === "charla") return this.charla(shot);
    } catch (err) {
      this.ev.onFail(err);
    }
  }

  /** The board is going: stop whatever plays (the stadium itself is disposed by its wrapper). */
  dispose(): void {
    window.clearTimeout(this.restT);
    this.stopPlay();
    this.rv = null;
    this.introRun = null;
  }

  private stopPlay(): void {
    const c = this.ctl;
    this.ctl = null;
    this.playTok = null;
    try {
      c?.stop();
    } catch {
      /* already over */
    }
  }

  private intro(players: PlayerSpec[]): void {
    const tok = {};
    this.introRun = tok;
    this.h.setPlayers(players, { animate: false });
    const done = () => {
      if (this.introRun === tok) {
        this.introRun = null;
        this.ev.onIntroDone();
      }
    };
    this.h.intro().then(done, done);
  }

  private jugada(s: Extract<Shot, { kind: "jugada" }>): void {
    const h = this.h;
    this.stopPlay();
    h.setBoard(s.board);
    h.setPlayers(s.players, { animate: true });
    h.setRivals(s.rivals, { animate: true });
    const n = s.frames.length;
    const tok = {};
    this.playTok = tok;
    this.ctl = h.play(s.frames, { loop: true, speed: s.slow ? 0.5 : 1, onFrame: (i) => this.playTok === tok && this.ev.onFrame(i) });
    if (this.ctl && n > 1 && s.from > 0) this.ctl.seek(Math.min(1, s.from / (n - 1)));
  }

  private charla(s: Extract<Shot, { kind: "charla" }>): void {
    const h = this.h;
    const c = s.step;
    const last = charlaLast(s.jugada.pasos.length);
    const k = stepKind(c, last);
    const pl = s.playing;
    if (!(k === "jugada" && pl)) this.stopPlay();
    if (!(k === "siete" && pl)) this.rv = null;
    if (k === "sistema") {
      h.setPlayers(s.players, { animate: false });
      h.setBoard(s.board);
      const run = this.key;
      void h
        .setCamera("stands", { duration: 0 })
        .then(() => (this.key === run ? h.setCamera("tv", { duration: 2200 }) : undefined))
        .catch(() => undefined);
      return;
    }
    if (k === "siete") {
      if (pl) {
        if (this.rv) return;
        // the hero shots from this step on (empty slots have nobody to film: they are skipped)
        const rest = s.slots
          .slice(c - 1, 7)
          .map((id, j) => ({ id, step: c + j }))
          .filter((x): x is { id: string; step: number } => !!x.id);
        if (!rest.length) return;
        const tok = {};
        this.rv = tok;
        h.setPlayers(s.players, { animate: true });
        h.reveal(
          rest.map((x) => x.id),
          { stepMs: HERO_MS, onStep: (i) => this.rv === tok && rest[i] && this.ev.onStep(rest[i].step) },
        ).then(
          () => {
            if (this.rv === tok) {
              this.rv = null;
              this.ev.onStep(STEP_PLAN);
            }
          },
          (err: unknown) => {
            if (this.rv === tok) {
              this.rv = null;
              this.ev.onFail(err);
            }
          },
        );
        return;
      }
      // paused on one of the seven: low camera, his shirt lit
      h.setPlayers(s.players, { animate: true });
      void h.setCamera("low", { duration: 900 }).catch(() => undefined);
      return;
    }
    if (k === "plan") {
      h.setPlayers(s.players, { animate: true });
      void h.setCamera("top", { duration: 1400 }).catch(() => undefined);
      return;
    }
    if (k === "jugada") {
      const p = c - STEP_JUGADA;
      if (pl) {
        if (this.playTok) return;
        const paso = s.jugada.pasos[p];
        if (paso) h.setRivals(paso.rivals, { animate: true });
        const tok = {};
        this.playTok = tok;
        this.ctl = h.play(s.jugada.frames.slice(p), {
          speed: 1,
          loop: false,
          onFrame: (i) => this.playTok === tok && this.ev.onStep(c + i),
          // (the engine holds the last picture until the next shot stops the jugada)
          onEnd: () => this.playTok === tok && this.ev.onStep(last),
        });
        return;
      }
      // paused on a paso: everyone where that paso has them
      const paso = s.jugada.pasos[p];
      if (!paso) return;
      const at = new Map(paso.players.map((q) => [q.id, q]));
      h.setPlayers(
        s.players.map((q) => {
          const w = at.get(q.id);
          return w ? { ...q, x: w.x, y: w.y } : q;
        }),
        { animate: true },
      );
      h.setRivals(paso.rivals, { animate: true });
      h.setBall(paso.ball);
      void h.setCamera("tv", { duration: 900 }).catch(() => undefined);
      return;
    }
    // «¡A por ellos!»: back in the stands
    h.setPlayers(s.players, { animate: true });
    h.setBoard(s.boardEnd);
    void h.setCamera("stands", { duration: 2600 }).catch(() => undefined);
  }
}

/** The seven at their spots on the board, as the engine draws them (`highlight`: whose shirt is lit). */
export function engineSeven(L: Lineup, sq: Squad, highlight: string | null): PlayerSpec[] {
  return L.slots.flatMap((s, i): PlayerSpec[] => {
    const id = s.playerId;
    const c = id ? sq.byId.get(id) : undefined;
    if (!id || !c) return [];
    const p = slotPos(L, i);
    const role = GALONES.find((g) => L.roles[g.key] === id)?.letter;
    return [{ id, name: c.name, num: c.num, x: +p.u.toFixed(1), y: +(100 - p.v).toFixed(1), kit: "home", highlight: id === highlight, ...(role ? { role } : {}) }];
  });
}

/** Every paso of a jugada as the engine poses it (who is where, the rivals, the ball). */
export function enginePasos(play: Play): EnginePaso[] {
  return play.frames.map((_, k) => {
    const pose = pasoPose(play, k);
    return {
      players: Object.entries(pose.players).map(([id, p]) => ({ id, ...toEnginePoint(p) })),
      rivals: pose.rivals.map((r) => ({ id: r.id, ...toEnginePoint(r) })),
      ball: toEnginePoint(pose.ball),
    };
  });
}

/** Those in a jugada at their first spot (the replay «En 3D»: only they are on the pitch). */
export function engineCast(play: Play, sq: Squad, L: Lineup, meId: string | null): PlayerSpec[] {
  const pose0 = pasoPose(play, 0);
  return participants(play).flatMap((id): PlayerSpec[] => {
    const c = sq.byId.get(id);
    const at = pose0.players[id];
    if (!c || !at) return [];
    const role = GALONES.find((g) => L.roles[g.key] === id)?.letter;
    return [{ id, name: c.name, num: c.num, ...toEnginePoint(at), kit: "home", highlight: id === meId, ...(role ? { role } : {}) }];
  });
}
