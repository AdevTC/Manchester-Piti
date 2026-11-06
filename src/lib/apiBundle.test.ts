import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error -- api/ holds plain JS for Vercel (no declaration file), as in apiNow.test
import { BUNDLE_PATH, GET, withoutQuery } from "../../api/bundle.js";
import { BUNDLE_URL } from "./bundle";

afterEach(() => vi.unstubAllGlobals());

describe("api/bundle.js: one address, one CDN copy", () => {
  it("is the address the app, its preload and the service worker ask", () => {
    expect(BUNDLE_PATH).toBe(BUNDLE_URL);
  });
  it("the bare address is served", () => {
    expect(withoutQuery("https://manchester-piti.vercel.app/api/bundle")).toBeNull();
    expect(withoutQuery("https://manchester-piti.vercel.app/datos/club.bundle")).toBeNull();
    // (a bare «?» is no query)
    expect(withoutQuery("https://manchester-piti.vercel.app/datos/club.bundle?")).toBeNull();
  });
  it("any query is sent to the bare address, without building the bundle", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const q of ["?x=1", "?v=2&nocache=" + Date.now(), "?p=/"]) {
      const res = await GET(new Request("https://manchester-piti.vercel.app/api/bundle" + q));
      expect(res.status).toBe(308);
      expect(res.headers.get("location")).toBe("/datos/club.bundle");
      expect(res.headers.get("vercel-cdn-cache-control")).toBe("max-age=86400");
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
