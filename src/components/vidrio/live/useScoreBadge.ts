// «El icono con el marcador» (V-Integracion): while a match of ours is on, the installed app's icon carries our
// goals as its badge (Badging API, where the browser has it); it clears when the match isn't on any more or the
// page goes. Client only; nothing where the API is missing.
import { useEffect } from "react";

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/** What the badge should say: our goals while the ball rolls (0 is a plain dot), nothing otherwise. */
export const badgeOf = (playing: boolean, ours: number): number | null => (playing ? Math.max(0, ours) : null);

export function useScoreBadge(playing: boolean, ours: number): void {
  const value = badgeOf(playing, ours);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as BadgeNavigator;
    if (typeof nav.setAppBadge !== "function") return;
    if (value === null) {
      void nav.clearAppBadge?.().catch(() => undefined);
      return;
    }
    void nav.setAppBadge(value).catch(() => undefined);
  }, [value]);
  useEffect(
    () => () => {
      const nav = typeof navigator === "undefined" ? null : (navigator as BadgeNavigator);
      void nav?.clearAppBadge?.().catch(() => undefined);
    },
    [],
  );
}
