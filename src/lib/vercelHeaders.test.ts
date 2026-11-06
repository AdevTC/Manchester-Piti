import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The security headers every response of the site carries (vercel.json, the catch-all source).
const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const everywhere = new Map((config.headers.find((h) => h.source === "/(.*)")?.headers ?? []).map((h) => [h.key.toLowerCase(), h.value]));

describe("vercel.json: the headers on every response", () => {
  it("no framing, and no MIME sniffing", () => {
    expect(everywhere.get("x-frame-options")).toBe("DENY");
    expect(everywhere.get("content-security-policy")).toBe("frame-ancestors 'none'");
    expect(everywhere.get("x-content-type-options")).toBe("nosniff");
  });
});
