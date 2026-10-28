// The content drafts (r12 M-20): on the server, in clubDrafts/content — one draft for the captaincy, the same on
// every device, with who and when — instead of one browser's localStorage. An external store: every reader re-renders
// on a change. A change shows at once (here) and is written a moment later, one write at a time; each write carries
// rev + 1 of the draft it read, so a save over another captain's newer one is refused by the rules: the store then
// says «Otro capitán ha cambiado el borrador» and keeps yours until you reload his or save yours over it. A draft
// left from before in this browser's localStorage is moved up to the server once (when the server has none).
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, type DocumentData } from "firebase/firestore";
import { db } from "../../../firebase";
import { NO_DRAFTS, parseDrafts, withoutUndefined, type Drafts } from "./contentModel";

const LEGACY_PREFIX = "mp.admin.contentDrafts.v1:";
/** How long after the last change the draft is written. */
export const DRAFT_WRITE_DELAY = 700;

export interface DraftState {
  drafts: Drafts;
  /** Read from the server at least once. */
  loaded: boolean;
  /** The server's rev (-1: no draft there). */
  rev: number;
  /** Who saved the server's draft last, and when (ms). */
  by: string;
  byName: string;
  at: number | null;
  /** Changes here not written yet (or on their way). */
  saving: boolean;
  /** Another captain saved over the draft this one started from: ours stays here, unsaved. */
  conflict: boolean;
  /** The last write failed for another reason (its message). */
  error: string;
}

const EMPTY: DraftState = { drafts: NO_DRAFTS, loaded: false, rev: -1, by: "", byName: "", at: null, saving: false, conflict: false, error: "" };

const isEmpty = (d: Drafts) => !Object.keys(d.club).length && !Object.keys(d.stories).length;
const toMs = (v: unknown): number | null => (v && typeof v === "object" && typeof (v as { toMillis?: unknown }).toMillis === "function" ? (v as { toMillis: () => number }).toMillis() : typeof v === "number" ? v : null);

/** What the doc holds, as drafts (anything malformed: none). */
export function draftsOfDoc(d: DocumentData | undefined): Drafts {
  if (!d) return NO_DRAFTS;
  return parseDrafts(JSON.stringify({ club: d.club ?? {}, stories: d.stories ?? {} }));
}

interface Me {
  uid: string;
  name: string;
}

class DraftStore {
  state: DraftState = EMPTY;
  private listeners = new Set<() => void>();
  private stop: (() => void) | null = null;
  /** Our drafts not on the server yet (null: none: the server's stand). */
  private local: Drafts | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private me: Me | null = null;
  private server: { drafts: Drafts; rev: number } = { drafts: NO_DRAFTS, rev: -1 };
  private migrated = false;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  private emit(patch: Partial<DraftState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
  /** Opens the listener for this captain (once; a second captain on the same tab reopens it). */
  open(me: Me) {
    if (this.stop && this.me?.uid === me.uid) {
      this.me = me;
      return;
    }
    this.close();
    this.me = me;
    this.stop = onSnapshot(
      doc(db, "clubDrafts", "content"),
      (s) => {
        const d = s.exists() ? s.data() : undefined;
        const rev = d && typeof d.rev === "number" ? d.rev : -1;
        const drafts = draftsOfDoc(d);
        const changedUnder = this.local !== null && !this.inFlight && rev !== this.server.rev && !this.state.conflict;
        this.server = { drafts, rev };
        this.emit({
          loaded: true,
          rev,
          by: typeof d?.by === "string" ? d.by : "",
          byName: typeof d?.byName === "string" ? d.byName : "",
          at: toMs(d?.at),
          drafts: this.local ?? drafts,
          conflict: this.state.conflict || changedUnder,
        });
        this.migrate(rev);
      },
      (e) => this.emit({ loaded: true, error: e.message }),
    );
  }
  close() {
    this.stop?.();
    this.stop = null;
  }
  /** A draft left in this browser from before r12, moved up once when the server has none. */
  private migrate(rev: number) {
    if (this.migrated || !this.me) return;
    this.migrated = true;
    let legacy = NO_DRAFTS;
    const key = `${LEGACY_PREFIX}${this.me.uid}`;
    try {
      legacy = parseDrafts(localStorage.getItem(key));
    } catch {
      return;
    }
    if (isEmpty(legacy)) return;
    if (rev < 0) this.update(() => legacy);
    try {
      localStorage.removeItem(key);
    } catch {
      // storage unavailable: nothing to clean
    }
  }
  update(fn: (d: Drafts) => Drafts) {
    const next = fn(this.state.drafts);
    this.local = next;
    this.emit({ drafts: next, saving: true, error: "" });
    if (this.state.conflict) return;
    this.schedule();
  }
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, DRAFT_WRITE_DELAY);
  }
  /** Writes what is pending now (also before leaving: `flush()` without waiting for the delay). */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.inFlight || this.local === null || !this.me || this.state.conflict) return;
    const sending = this.local;
    const ref = doc(db, "clubDrafts", "content");
    this.inFlight = true;
    try {
      if (isEmpty(sending)) {
        if (this.server.rev >= 0) await deleteDoc(ref);
        this.server = { drafts: NO_DRAFTS, rev: -1 };
      } else {
        const rev = this.server.rev + 1;
        await setDoc(ref, { rev, club: withoutUndefined(sending.club), stories: withoutUndefined(sending.stories), by: this.me.uid, byName: this.me.name.slice(0, 40), at: serverTimestamp() });
        this.server = { drafts: sending, rev };
      }
      if (this.local === sending) {
        this.local = null;
        this.emit({ saving: false });
      }
    } catch (e) {
      const denied = (e as { code?: string }).code === "permission-denied";
      this.emit(denied ? { conflict: true } : { error: e instanceof Error ? e.message : String(e) });
    } finally {
      this.inFlight = false;
    }
    if (this.local !== null && this.local !== sending && !this.state.conflict) void this.flush();
  }
  /** «Recargar el suyo»: drop ours, show the server's. */
  reload() {
    this.local = null;
    if (this.timer) clearTimeout(this.timer);
    this.emit({ drafts: this.server.drafts, conflict: false, saving: false, error: "" });
  }
  /** «Guardar el mío encima»: write ours over the server's newest. */
  async mine() {
    this.emit({ conflict: false });
    await this.flush();
  }
  /** Tests: back to nothing. */
  reset() {
    this.close();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.local = null;
    this.inFlight = false;
    this.me = null;
    this.migrated = false;
    this.server = { drafts: NO_DRAFTS, rev: -1 };
    this.state = EMPTY;
    this.listeners.forEach((l) => l());
  }
}

const store = new DraftStore();
const getState = () => store.state;
const getEmpty = () => EMPTY;

/** The captaincy's content drafts and their state; `me` opens the listener (null: nothing is read). */
export function useContentDraftState(me: Me | null): DraftState & { update: (fn: (d: Drafts) => Drafts) => void; flush: () => Promise<void>; reload: () => void; mine: () => Promise<void> } {
  const uid = me?.uid ?? "";
  const name = me?.name ?? "";
  useEffect(() => {
    if (uid) store.open({ uid, name });
  }, [uid, name]);
  const state = useSyncExternalStore(store.subscribe, uid ? getState : getEmpty, getEmpty);
  const update = useCallback((fn: (d: Drafts) => Drafts) => store.update(fn), []);
  const flush = useCallback(() => store.flush(), []);
  const reload = useCallback(() => store.reload(), []);
  const mine = useCallback(() => store.mine(), []);
  return { ...state, update, flush, reload, mine };
}

/** The drafts and an updater (what Hoy's «Por hacer» and the counters read). */
export function useContentDrafts(uid: string | undefined, name = ""): [Drafts, (update: (d: Drafts) => Drafts) => void] {
  const s = useContentDraftState(uid ? { uid, name } : null);
  return [s.drafts, s.update];
}

/** Tests: forget everything. */
export function resetContentDraftsForTests() {
  store.reset();
}
