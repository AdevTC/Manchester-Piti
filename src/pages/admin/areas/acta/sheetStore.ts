// The acta's edit buffer, kept per match OUTSIDE the stations (r12): Datos, Acta, Narración, Historial and Publicar
// are separate screens of the match (the router remounts each one), and their unsaved edits must survive moving
// between them, as the old workspace's tabs did. One store per match: the version the edits started from
// (`base`), the edits (`value`), the server version it last adopted (`src`), the recovery offer of this device's
// mirror, the save state. Every dirty state is mirrored to localStorage (acta/localDraft) as it changes, whoever
// is mounted. Pure TypeScript (no React): useSheetSession (sheetSession.ts) reads it.
import { clearDraft, draftKey, readDraft, recoverable, writeDraft, type StoredDraft } from "../../acta/localDraft";
import { isSheet, sig, type MatchSheet } from "../../acta/sheetModel";
import { removedIds } from "../../acta/liveMerge";

export type Busy = "draft" | "publish" | "discard" | null;
export interface SheetState {
  /** sig() of the server version the buffer last adopted. */
  src: string;
  base: MatchSheet;
  value: MatchSheet;
  /** This device's unsaved edits from an earlier visit, offered while the buffer is clean. */
  offer: StoredDraft<MatchSheet> | null;
  /** When the last save of this session went through (ms). */
  savedAt: number | null;
  busy: Busy;
  /** The last save was refused because the match changed meanwhile («Otro administrador…»): the conflict bar says it. */
  refused: string | null;
  /** «Guardar borrador» without network: the edits wait on this device and go up when the network is back. */
  pendingSync: boolean;
  /** The ids removed in this editor (the mesa's merge never brings them back). */
  removed: ReadonlySet<string>;
  /** Keep the mirror when the store is dropped dirty (a failed «Guardar borrador y salir»). */
  keep: boolean;
}

const NONE: ReadonlySet<string> = new Set();
export const isDirty = (s: Pick<SheetState, "value" | "base">) => sig(s.value) !== sig(s.base);

export class SheetStore {
  readonly key: string;
  private state: SheetState;
  private listeners = new Set<() => void>();
  constructor(matchId: string, server: MatchSheet, storage?: Storage | null) {
    this.key = draftKey("acta", matchId);
    const src = sig(server);
    const stored = storage === undefined ? readDraft(this.key, isSheet) : readDraft(this.key, isSheet, storage);
    this.state = { src, base: server, value: server, offer: recoverable(stored, src, sig), savedAt: null, busy: null, refused: null, pendingSync: false, removed: NONE, keep: false };
  }
  get = (): SheetState => this.state;
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  get watched(): boolean {
    return this.listeners.size > 0;
  }
  private put(next: SheetState) {
    const prev = this.state;
    this.state = next;
    // the mirror: every dirty state, cleared once clean (unless a recovery is on offer)
    if (next.value !== prev.value || next.base !== prev.base || next.offer !== prev.offer) {
      if (isDirty(next)) writeDraft(this.key, { at: Date.now(), base: sig(next.base), value: next.value });
      else if (!next.offer) clearDraft(this.key);
    }
    this.listeners.forEach((l) => l());
  }
  patch(p: Partial<SheetState>) {
    this.put({ ...this.state, ...p });
  }
  /** The edits, changed (the offer goes: the device's old edits are not mixed with new ones). */
  set(f: (v: MatchSheet) => MatchSheet) {
    const s = this.state;
    const value = f(s.value);
    if (value === s.value) return;
    this.put({ ...s, value, offer: null, refused: null, removed: removedIds(s.removed, s.value.events, value.events), keep: false });
  }
  /** A new server version while clean: it becomes the base and the value. */
  adopt(server: MatchSheet, src: string) {
    const s = this.state;
    if (s.src === src || isDirty(s)) return;
    this.put({ ...s, src, base: server, value: server, refused: null });
  }
  /** Takes the server version in while dirty (it becomes the base the edits follow). */
  rebase(server: MatchSheet, src: string, merge: (value: MatchSheet, base: MatchSheet, server: MatchSheet, removed: ReadonlySet<string>) => MatchSheet) {
    const s = this.state;
    this.put({ ...s, src, base: server, value: merge(s.value, s.base, server, s.removed), offer: null, refused: null });
  }
  /** After a successful save of `saved`: it becomes the base (later edits stay dirty). */
  commit(saved: MatchSheet, src: string, at: number) {
    const s = this.state;
    this.put({ ...s, src, base: saved, value: s.value === saved ? saved : s.value, savedAt: at, refused: null, pendingSync: false });
  }
  /** The edits thrown away (back to the base). */
  reset() {
    const s = this.state;
    this.put({ ...s, value: s.base, refused: null, pendingSync: false, removed: NONE });
  }
  recover(restore: (v: MatchSheet) => MatchSheet) {
    const s = this.state;
    if (!s.offer) return;
    this.put({ ...s, value: restore(s.offer.value), offer: null });
  }
  dismissOffer() {
    this.put({ ...this.state, offer: null });
    clearDraft(this.key);
  }
  /** Gone (the match left, its edits discarded): the mirror goes too unless it was kept. */
  dispose() {
    if (isDirty(this.state) && !this.state.keep) clearDraft(this.key);
    this.listeners.clear();
  }
}

const stores = new Map<string, SheetStore>();
/** The store of a match (created from its server version the first time). */
export function sheetStore(matchId: string, server: MatchSheet): SheetStore {
  let s = stores.get(matchId);
  if (!s) {
    s = new SheetStore(matchId, server);
    stores.set(matchId, s);
  }
  return s;
}
/** Drops a match's store (its edits leave with it). */
export function dropSheetStore(matchId: string) {
  stores.get(matchId)?.dispose();
  stores.delete(matchId);
}
export function resetSheetStoresForTests() {
  stores.forEach((s) => s.dispose());
  stores.clear();
}

/** The addresses of a match where the same edits stay open (no «¿Salir sin guardar?» between them). */
export function sessionPath(matchId: string, pathname: string): boolean {
  const id = matchId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^/admin/partidos/${id}/(convocatoria|datos|acta|acta/narracion|acta/historial|publicar)/?$`).test(pathname);
}

