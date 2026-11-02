// r14 «La pizarra»: a lazily loaded part (a place's regions, a sheet, the drawing dock) that can be fetched ahead of
// time. React.lazy alone suspends the first time it renders even when its chunk is already here, so the first visit
// of a place drew its regions empty inside the View Transition and they popped in afterwards. A part that was
// preloaded (store/registry preloadParts: the pizarra fetches them when idle; P.nav waits for the place it goes to)
// renders its component directly; one that wasn't falls back to React.lazy (Suspense, as before).
import { createElement, lazy, useState, type ComponentType, type ReactElement } from "react";

export interface LazyPart<P extends object> {
  (props: P): ReactElement;
  /** Fetches the chunk (once); resolves when the component can render without suspending. */
  preload(): Promise<void>;
  /** The chunk is here. */
  loaded(): boolean;
}

/** `lazyPart(() => import("./Plan").then((m) => m.Plan))` instead of `lazy(() => import("./Plan").then((m) => ({ default: m.Plan })))`. */
export function lazyPart<P extends object>(load: () => Promise<ComponentType<P>>): LazyPart<P> {
  let C: ComponentType<P> | null = null;
  let pending: Promise<void> | null = null;
  const preload = (): Promise<void> => {
    if (!pending)
      pending = load().then(
        (c) => {
          C = c;
        },
        (e: unknown) => {
          // (a failed fetch — offline — is tried again next time)
          pending = null;
          throw e;
        },
      );
    return pending;
  };
  const Lazy = lazy(() => preload().then(() => ({ default: C as ComponentType<P> })));
  function Part(props: P): ReactElement {
    // (chosen once per mount: the loaded component, or the lazy one until then — never a remount when it arrives)
    const [T] = useState<ComponentType<P>>(() => C ?? Lazy);
    return createElement(T, props);
  }
  Part.preload = preload;
  Part.loaded = () => C !== null;
  return Part;
}

/** A registered component's preload (a lazyPart), or null when there is nothing to fetch. */
export function partPreload(C: unknown): Promise<void> | null {
  if (typeof C !== "function") return null;
  const p = C as Partial<LazyPart<object>>;
  if (typeof p.preload !== "function" || typeof p.loaded !== "function") return null;
  return p.loaded() ? null : p.preload();
}
