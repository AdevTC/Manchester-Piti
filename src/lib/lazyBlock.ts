// Member-only blocks as their own chunks: a fan never downloads them. One cached import() per block
// (not React.lazy: its promise is made on the first render, so tests and a page that preloads still
// saw one suspension; here a block whose chunk is in renders at once and never suspends again).
// `preload()` starts the download early (a page shell calls it once it knows a member is looking), so
// the block is usually there by the time it renders: no fallback, no layout shift. If the chunk cannot
// arrive (offline, an old deploy's file gone) the block renders nothing instead of breaking the page.
import { createElement, Suspense, use, type ComponentType, type ReactNode } from "react";

export interface LazyBlock<P> {
  (props: P): ReactNode;
  /** Starts the chunk's download (once); resolves when the block can render without waiting. */
  preload: () => Promise<void>;
}

const Nothing = (): null => null;

/** A block loaded on demand. `when` (optional) says if it renders at all: when false nothing loads. */
export function lazyBlock<P extends object>(load: () => Promise<ComponentType<P>>, when?: (props: P) => boolean): LazyBlock<P> {
  let loaded: ComponentType<P> | undefined;
  let pending: Promise<void> | undefined;
  const preload = (): Promise<void> =>
    (pending ??= load().then(
      (c) => {
        loaded = c;
      },
      () => {
        loaded = Nothing;
      },
    ));
  function Loaded(props: P) {
    if (!loaded) use(preload());
    return createElement(loaded ?? Nothing, props);
  }
  function LazyBlockView(props: P) {
    if (when && !when(props)) return null;
    return createElement(Suspense, { fallback: null }, createElement(Loaded, props));
  }
  LazyBlockView.preload = preload;
  return LazyBlockView;
}

/** Waits (suspending) until every block is in: a page calls it on its first render, so they all paint with it. */
export function useBlocksReady(blocks: readonly { preload: () => Promise<void> }[]): void {
  use(blocksReady(blocks));
}
const ready = new WeakMap<readonly unknown[], Promise<void>>();
function blocksReady(blocks: readonly { preload: () => Promise<void> }[]): Promise<void> {
  let p = ready.get(blocks);
  if (!p) {
    p = Promise.all(blocks.map((b) => b.preload())).then(() => undefined);
    ready.set(blocks, p);
  }
  return p;
}
