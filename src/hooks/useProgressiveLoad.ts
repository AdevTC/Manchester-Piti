import { useEffect, useRef } from "react";

/** Load the next batch near the end of the real scrolling region; the button remains a fallback. */
export function useProgressiveLoad(enabled: boolean, batchKey: string, loadMore: () => void) {
  const sentinel = useRef<HTMLDivElement>(null);
  const callback = useRef(loadMore);
  useEffect(() => { callback.current = loadMore; }, [loadMore]);
  useEffect(() => {
    const node = sentinel.current;
    if (!enabled || !node || typeof IntersectionObserver === "undefined") return;
    let root = node.parentElement;
    while (root && !(/auto|scroll/.test(getComputedStyle(root).overflowY) && root.scrollHeight > root.clientHeight + 1)) root = root.parentElement;
    let active = true;
    const observer = new IntersectionObserver((entries) => {
      if (!active || !entries.some((entry) => entry.isIntersecting)) return;
      active = false;
      observer.disconnect();
      callback.current();
    }, { root, rootMargin: "240px 0px" });
    observer.observe(node);
    return () => { active = false; observer.disconnect(); };
  }, [enabled, batchKey]);
  return sentinel;
}
