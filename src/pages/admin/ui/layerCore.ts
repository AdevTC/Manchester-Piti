// The layer stack's core (no components): the store, its context and the hooks every layer uses.
// See layers.tsx for the components and the behaviour.
import { createContext, useContext, useId, useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from "react";

// ───────────────────────── the stack ─────────────────────────
export interface LayerEntry {
  id: string;
  /** Modal layers make everything below them inert and draw a scrim. */
  modal: boolean;
  /** Tab / Shift+Tab stay inside this layer while it is on top. */
  trap: boolean;
  el: () => HTMLElement | null;
  close: () => void;
}
export class LayerStore {
  private list: readonly LayerEntry[] = [];
  private listeners = new Set<() => void>();
  add(entry: LayerEntry) {
    this.list = [...this.list.filter((e) => e.id !== entry.id), entry];
    this.emit();
  }
  remove(id: string) {
    if (!this.list.some((e) => e.id === id)) return;
    this.list = this.list.filter((e) => e.id !== id);
    this.emit();
  }
  top(): LayerEntry | undefined {
    return this.list[this.list.length - 1];
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = (): readonly LayerEntry[] => this.list;
  private emit() {
    this.listeners.forEach((l) => l());
  }
}

export interface LayerContextValue {
  store: LayerStore;
  host: HTMLElement | null;
}
export const LayerContext = createContext<LayerContextValue | null>(null);

const FOCUSABLE = 'button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
const isJsdom = () => typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom");
/** The keyboard-reachable elements of a layer (visible, enabled, not inside an inert/hidden part). */
export function focusablesIn(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (x) =>
      !(x as HTMLButtonElement).disabled &&
      x.tabIndex >= 0 &&
      !x.closest("[inert],[aria-hidden=true]") &&
      (isJsdom() || x.offsetParent !== null || x.getClientRects().length > 0),
  );
}

export function useLayers(): LayerContextValue {
  const ctx = useContext(LayerContext);
  if (!ctx) throw new Error("Admin layers need a <LayerProvider> (AdminLayout provides one).");
  return ctx;
}
/** The open layers, bottom → top. `modalOpen` = something modal is open (the app behind must be inert). */
export function useLayerStack() {
  const { store } = useLayers();
  const stack = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { stack, modalOpen: stack.some((e) => e.modal), top: stack[stack.length - 1] };
}
/** The portal host for things that must live outside the inert app (toasts, layers). */
export function useLayerHost(): HTMLElement | null {
  return useLayers().host;
}

interface UseLayerOptions {
  modal: boolean;
  trap: boolean;
  onClose: () => void;
  ref: RefObject<HTMLElement | null>;
  initialFocus?: RefObject<HTMLElement | null>;
  /** Where the focus goes back on close; by default whatever had it when the layer opened. */
  returnFocus?: RefObject<HTMLElement | null>;
}
/**
 * Registers a mounted layer on the stack (mount = open). Focuses it on open (no scroll), returns the focus
 * on close, and reports its depth / whether it is on top. Build custom layers on it (the palette does).
 */
export function useLayer({ modal, trap, onClose, ref, initialFocus, returnFocus }: UseLayerOptions) {
  const { store } = useLayers();
  const id = useId();
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });
  useLayoutEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    store.add({ id, modal, trap, el: () => ref.current, close: () => closeRef.current() });
    const back = returnFocus?.current ?? previous;
    const target = initialFocus?.current ?? ref.current;
    target?.focus({ preventScroll: true });
    return () => {
      store.remove(id);
      if (back && back.isConnected) back.focus({ preventScroll: true });
    };
    // A layer's kind and refs are fixed for its lifetime (mount = open, unmount = close).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, id]);
  const stack = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const at = stack.findIndex((e) => e.id === id);
  const depth = at < 0 ? stack.length : at;
  return { depth, isTop: at < 0 || at === stack.length - 1 };
}

