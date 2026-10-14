// api/now.js (the Vercel function fans' phones ask for the server's clock): the time, never cached.
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.useRealTimers());

it("answers { now } as JSON with no-store for the browser, the CDN and Vercel's CDN", async () => {
  // @ts-expect-error -- api/ holds plain JS for Vercel (no declaration file); its shape is asserted below
  const mod: unknown = await import("../../api/now.js");
  const { GET } = mod as { GET: () => Response };
  vi.useFakeTimers();
  vi.setSystemTime(1_760_000_000_000);
  const r = GET();
  expect(r.status).toBe(200);
  expect(r.headers.get("content-type")).toContain("application/json");
  expect(r.headers.get("cache-control")).toBe("no-store, max-age=0");
  expect(r.headers.get("cdn-cache-control")).toBe("no-store");
  expect(r.headers.get("vercel-cdn-cache-control")).toBe("no-store");
  await expect(r.json()).resolves.toEqual({ now: 1_760_000_000_000 });
});
