// When TanStack Query tells its readers that data changed. By default each batch of notifications runs in its own
// `setTimeout(0)`, and every reader re-renders synchronously (Query subscribes through useSyncExternalStore). On a
// match day the listeners keep bringing snapshots (the score, la mesa, the live minute): one landing between the
// finger going down and the click it makes is a whole render the tap waits behind, and one landing right after the
// click delays the frame that shows the tap's answer.
// So while a finger (or a key) is down, notifications are held, and released together just after the next frame
// that follows its release: the tap's own frame paints first, then the data. Outside a press nothing changes (the
// same `setTimeout(0)`), and a press held longer than MAX_HOLD_MS (a drag on the pizarra) releases them anyway.

/** The longest a notification waits behind a press, in ms. */
export const MAX_HOLD_MS = 1000;

type Task = () => void;

/** What the scheduler needs from the window (method syntax, so `window` itself fits). */
interface SchedulerHost {
  addEventListener(type: string, listener: (event: Event) => void, options: AddEventListenerOptions): void;
  requestAnimationFrame?(cb: () => void): unknown;
  setTimeout(cb: () => void, ms: number): unknown;
  clearTimeout(id: ReturnType<SchedulerHost["setTimeout"]>): void;
}

/**
 * A scheduler for `notifyManager.setScheduler` that holds notifications while the user is pressing something.
 * `host` is the window (a stand-in in tests); listeners are passive and in the capture phase, so they never delay or
 * change an event.
 */
export function createPressAwareScheduler(host: SchedulerHost): (task: Task) => void {
  /** Pointers and keys down right now. */
  const down = new Set<string>();
  /** Notifications waiting for the press to end, or null when nothing is held. */
  let held: Task[] | null = null;
  let maxTimer: unknown = null;
  /** Bumped on every press, so a release scheduled by an earlier one does not cut a newer press short. */
  let press = 0;

  const release = () => {
    if (maxTimer !== null) host.clearTimeout(maxTimer);
    maxTimer = null;
    const tasks = held;
    held = null;
    if (tasks) for (const task of tasks) task();
  };

  const pressStart = (id: string) => {
    down.add(id);
    press++;
    if (held) return;
    held = [];
    maxTimer = host.setTimeout(() => {
      // A long press (a drag): stop holding until the next one.
      down.clear();
      release();
    }, MAX_HOLD_MS);
  };

  const pressEnd = (id: string) => {
    if (!down.delete(id) || down.size || !held) return;
    const mine = press;
    const afterFrame = () => host.setTimeout(() => {
      if (mine === press && !down.size) release();
    }, 0);
    // After the next frame (the one painting what the press did); without frames (a hidden tab), at once.
    if (host.requestAnimationFrame) host.requestAnimationFrame(afterFrame);
    else afterFrame();
  };

  const opts: AddEventListenerOptions = { capture: true, passive: true };
  host.addEventListener("pointerdown", (e) => pressStart(`p${(e as PointerEvent).pointerId}`), opts);
  host.addEventListener("pointerup", (e) => pressEnd(`p${(e as PointerEvent).pointerId}`), opts);
  host.addEventListener("pointercancel", (e) => pressEnd(`p${(e as PointerEvent).pointerId}`), opts);
  host.addEventListener("keydown", (e) => {
    if (!(e as KeyboardEvent).repeat) pressStart(`k${(e as KeyboardEvent).code}`);
  }, opts);
  host.addEventListener("keyup", (e) => pressEnd(`k${(e as KeyboardEvent).code}`), opts);
  // Leaving the tab mid-press never sends the release. (Bubbling phase: an element's blur does not bubble, so only
  // the window's own reaches here; in the capture phase every change of focus would.)
  host.addEventListener("blur", () => {
    down.clear();
    release();
  }, { passive: true });

  return (task) => {
    if (held) held.push(task);
    else host.setTimeout(task, 0);
  };
}
