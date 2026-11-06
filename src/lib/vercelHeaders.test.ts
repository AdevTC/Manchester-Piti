import { describe, expect, it } from "vitest";

// (node:fs without @types/node in the app's tsconfig: the pushRoute.test pattern)
type Fs = { readFileSync: (path: string, encoding: "utf8") => string };
const fsModule = "node:fs";
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;

// The security headers every response of the site carries (vercel.json, the catch-all source).
const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
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
