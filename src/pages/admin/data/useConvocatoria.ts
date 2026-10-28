// The one convocatoria's writer (the match's Convocatoria station): change el siete / the banquillo / the guests of
// a match and announce it, through the setConvocatoria callable.
//   · set(next) shows the change at once and writes it (notify:false). Writes of one match go one after another
//     (the last one wins); what is shown stays the local lineup until the match's `convocatoriaAt` reaches the stamp
//     the last write returned (no flash back while the snapshot travels).
//   · publish() — «Mandar la convocatoria»: the notice waits 5 s behind «Deshacer» and then goes with the lineup
//     there is THEN (B-HOY-01: a change in those 5 s is not undone and the notice carries it, never the seven of
//     the moment it was pressed). The wait lives per match outside the screen: changing station does not lose it.
// Per match state is module-level (one tab), so the station can unmount and come back without losing a write. What a
// render reads is an immutable view per match (replaced on every change: the React Compiler memoizes on identity);
// the queue, the timer and the latest lineup are the writer's own, never read while rendering.
import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { apiError, setConvocatoria, type SetConvocatoriaResult } from "../../../lib/clubApi";
import { useToast, type ToastApi } from "../ui/toastContext";
import type { AdminMatch } from "./adminLogic";
import { convocatoriaStatus, lineupOf, sameLineup, type ConvocatoriaStatus, type Lineup } from "./lineup";

/** How long the notice waits behind «Deshacer». */
export const NOTICE_DELAY_MS = 5_000;

interface View {
  /** The local change while it is written (and until the snapshot reaches it). */
  overlay: { lineup: Lineup; at: number | null } | null;
  /** The notice waits behind «Deshacer», or is on its way. */
  pending: boolean;
  /** Announced by this tab: the stamp the notice returned (until the snapshot carries it). */
  announcedAt: number | null;
}
type Done = (r: SetConvocatoriaResult | null, e?: unknown) => void;
interface Writer {
  queue: { running: boolean; next: { lineup: Lineup; notify: boolean; done?: Done } | null };
  timer: ReturnType<typeof setTimeout> | null;
  sending: boolean;
  /** The last lineup shown for this match (what a notice sends when it goes). */
  latest: Lineup | null;
}
const EMPTY: View = { overlay: null, pending: false, announcedAt: null };
const views = new Map<string, View>();
const writers = new Map<string, Writer>();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const viewOf = (id: string): View => views.get(id) ?? EMPTY;
function patch(id: string, p: Partial<View>) {
  views.set(id, { ...viewOf(id), ...p });
  listeners.forEach((l) => l());
}
function writerOf(id: string): Writer {
  let w = writers.get(id);
  if (!w) {
    w = { queue: { running: false, next: null }, timer: null, sending: false, latest: null };
    writers.set(id, w);
  }
  return w;
}
/** Tests start clean. */
export function resetConvocatorias(): void {
  writers.forEach((w) => w.timer && clearTimeout(w.timer));
  writers.clear();
  views.clear();
  listeners.forEach((l) => l());
}
const busy = () => [...writers.values()].some((w) => w.queue.running || w.queue.next || w.timer || w.sending);

function write(matchId: string, lineup: Lineup, notify: boolean, toast: ToastApi, done?: Done) {
  const q = writerOf(matchId).queue;
  if (q.running) {
    // (a later quiet write replaces a quiet one waiting; a notice is never dropped: it carries the newest lineup)
    q.next = { lineup, notify: notify || !!q.next?.notify, done: done ?? q.next?.done };
    return;
  }
  q.running = true;
  setConvocatoria({ matchId, starters: lineup.starters, bench: lineup.bench, ...(lineup.guests ? { guests: lineup.guests } : {}), notify }).then(
    (res) => {
      q.running = false;
      const more = q.next;
      q.next = null;
      const o = viewOf(matchId).overlay;
      if (o && sameLineup(o.lineup, lineup)) patch(matchId, { overlay: { ...o, at: res.data.at } });
      done?.(res.data);
      if (more) write(matchId, more.lineup, more.notify, toast, more.done);
    },
    (e: unknown) => {
      q.running = false;
      const more = q.next;
      q.next = null;
      patch(matchId, { overlay: null });
      if (done) done(null, e);
      else toast.show({ tone: "error", message: `No se ha podido guardar la convocatoria: ${apiError(e)}` });
      more?.done?.(null, e);
    },
  );
}

function cancelOf(matchId: string, toast: ToastApi) {
  const w = writerOf(matchId);
  if (!w.timer || w.sending) return;
  clearTimeout(w.timer);
  w.timer = null;
  patch(matchId, { pending: false });
  toast.show({ tag: "Deshecho", message: "El aviso de la convocatoria no sale" });
}

export interface ConvocatoriaApi {
  /** What to show: the local change while it is being written, else the match's. */
  lineup: Lineup;
  status: ConvocatoriaStatus;
  /** The notice waits behind «Deshacer» (or is on its way). */
  pending: boolean;
  /** Shows and writes a new lineup (quietly). */
  set: (next: Lineup) => void;
  /** «Mandar la convocatoria» / «Avisar de los cambios»: waits 5 s, then announces what there is then. */
  publish: (o: { tag: string; sent: (r: SetConvocatoriaResult, called: number) => string }) => void;
  /** «Deshacer» the waiting notice (nobody is told). */
  cancel: () => void;
}

export function useConvocatoria(match: AdminMatch | null): ConvocatoriaApi {
  const toast = useToast();
  const id = match?.id ?? "";
  const view = useSyncExternalStore(
    subscribe,
    () => viewOf(id),
    () => viewOf(id),
  );
  // Leaving the page (reload, close) while a change or a notice is on its way would lose it: the browser asks.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!busy()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  const server = lineupOf(match);
  const serverAt = match?.convocatoriaAt ?? 0;
  const local = view.overlay && (view.overlay.at === null || serverAt < view.overlay.at) ? view.overlay.lineup : null;
  const lineup = local ?? server;
  useLayoutEffect(() => {
    if (id) writerOf(id).latest = lineup;
  });
  const serverStatus = convocatoriaStatus(match);
  const announced = !!view.announcedAt && (match?.convocatoriaNotifiedAt ?? 0) < view.announcedAt;
  // Being announced, or just announced here: published. A local change after a notice: announce again.
  const status: ConvocatoriaStatus = announced && !local ? { notified: true, published: true, changed: false } : local && (serverStatus.notified || announced) ? { notified: true, published: false, changed: true } : serverStatus;

  const set = (change: Lineup) => {
    if (!match) return;
    // (a change of seats keeps the guests as they are: only adding or removing a guest brings a list)
    const next: Lineup = change.guests || !lineup.guests ? change : { ...change, guests: lineup.guests };
    const w = writerOf(match.id);
    w.latest = next;
    patch(match.id, { overlay: { lineup: next, at: null }, ...(w.timer || w.sending ? {} : { announcedAt: null }) });
    write(match.id, next, false, toast);
  };

  const publish: ConvocatoriaApi["publish"] = ({ tag, sent }) => {
    if (!match) return;
    const matchId = match.id;
    const w = writerOf(matchId);
    if (w.timer || w.sending) return;
    w.latest ??= lineup;
    const fire = () => {
      w.timer = null;
      w.sending = true;
      const l = w.latest ?? lineup;
      const called = l.starters.length + l.bench.length;
      write(matchId, l, true, toast, (res, e) => {
        w.sending = false;
        if (res) {
          patch(matchId, { pending: false, announcedAt: res.at });
          toast.show({ tag, message: sent(res, called) });
        } else {
          patch(matchId, { pending: false });
          toast.show({ tone: "error", message: `No se ha podido avisar: ${apiError(e)}`, retry: () => publish({ tag, sent }) });
        }
      });
    };
    w.timer = setTimeout(fire, NOTICE_DELAY_MS);
    patch(matchId, { pending: true });
    toast.show({ tag, message: "El aviso sale en 5 s · si cambias el siete, sale con el nuevo", undo: () => cancelOf(matchId, toast), duration: NOTICE_DELAY_MS + 200 });
  };

  return { lineup, status, pending: view.pending, set, publish, cancel: () => match && cancelOf(match.id, toast) };
}
