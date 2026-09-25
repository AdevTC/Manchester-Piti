import { useEffect, useState } from "react";
import type { StillRequest } from "./scene";

// Photos of the real kit (rendered once per name/number/kit/theme/angle, kept for the visit).
const urls = new Map<string, string>();
let failed = false;
const SEP = "\u001f";
export const stillKey = (r: StillRequest) => [r.kit, r.theme, r.name, r.num, r.yaw ?? 0].join(SEP);
const parse = (k: string): StillRequest => {
  const [kit, theme, name, num, yaw] = k.split(SEP);
  return { kit: kit as StillRequest["kit"], theme: theme as StillRequest["theme"], name, num, yaw: Number(yaw) };
};

/** Returns a lookup for the stills of `reqs`; missing ones render in the background, in order. */
export function useShirtStills(reqs: StillRequest[]) {
  const [, bump] = useState(0);
  const keys = reqs.map(stillKey).join("\n");
  useEffect(() => {
    if (failed || !keys) return;
    const todo = keys.split("\n").filter((k) => !urls.has(k));
    if (!todo.length) return;
    let cancelled = false;
    (async () => {
      const { renderStill } = await import("./scene");
      for (const k of todo) {
        if (cancelled) return;
        if (urls.has(k)) continue;
        urls.set(k, URL.createObjectURL(await renderStill(parse(k))));
        if (!cancelled) bump((n) => n + 1);
      }
    })().catch((error: unknown) => {
      console.error("No se han podido preparar las camisetas:", error);
      failed = true;
      if (!cancelled) bump((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [keys]);
  return (r: StillRequest) => urls.get(stillKey(r));
}
