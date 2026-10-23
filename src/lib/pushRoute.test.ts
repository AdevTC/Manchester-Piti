import { describe, expect, it } from "vitest";
import { pushClickUrl, type PushClickData } from "./pushRoute";
import { RSVP_CACHE, RSVP_TICKET_MS } from "./rsvpTicket";

// Node modules come in through typed dynamic imports (the app's tsconfig has no Node types).
type Fs = { readFileSync: (path: string, encoding: "utf8") => string };
type Vm = { runInNewContext: (code: string, context: Record<string, unknown>) => unknown };
const fsModule = "node:fs";
const vmModule = "node:vm";
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;
const { runInNewContext } = (await import(/* @vite-ignore */ vmModule)) as Vm;

// The service worker keeps its own copy of pushClickUrl (public/push-sw.js, between the «pushRoute»
// marks): every case runs against both, so the copies can't drift apart.
const sw = readFileSync("public/push-sw.js", "utf8"); // vitest runs from the repo root
const block = /\/\/ <pushRoute>([\s\S]*?)\/\/ <\/pushRoute>/.exec(sw)?.[1] ?? "";
const swClickUrl = runInNewContext(`${block}\npushClickUrl;`, { encodeURIComponent }) as typeof pushClickUrl;

const N = "3f2b8c1e-9a4d-4e2f-8b1a-0c9d7e6f5a4b";
const CASES: [string, PushClickData | null | undefined, string | null | undefined, string | null | undefined, string][] = [
  ["«Voy» opens the vestuario with the answer and its ticket", { url: "/matches/m8", matchId: "m8" }, "yes", N, `/vestuario?rsvp=yes&m=m8&n=${N}`],
  ["«No puedo» too", { url: "/matches/m8?tab=vestuario", matchId: "m8" }, "no", N, `/vestuario?rsvp=no&m=m8&n=${N}`],
  ["without a ticket (no Cache API in the worker): no n, the vestuario asks", { url: "/matches/m8", matchId: "m8" }, "no", "", "/vestuario?rsvp=no&m=m8"],
  ["a ticket that isn't a string is left out", { url: "/matches/m8", matchId: "m8" }, "yes", undefined, "/vestuario?rsvp=yes&m=m8"],
  ["a plain tap keeps the notice's link", { url: "/matches/m8", matchId: "m8" }, "", N, "/matches/m8"],
  ["a plain tap without action at all", { url: "/matches/m8?tab=vestuario" }, undefined, undefined, "/matches/m8?tab=vestuario"],
  ["an unknown button is a plain tap", { url: "/matches/m8", matchId: "m8" }, "maybe", N, "/matches/m8"],
  ["a button without its match is a plain tap", { url: "/matches/m8" }, "yes", N, "/matches/m8"],
  ["the match id and the ticket are escaped", { url: "/", matchId: "a b&c" }, "yes", "x&y", "/vestuario?rsvp=yes&m=a%20b%26c&n=x%26y"],
  ["no data: the home", null, "yes", N, "/"],
  ["a malformed link: the home", { url: 7, matchId: 3 }, "no", N, "/"],
  ["another site's address: the home", { url: "https://evil.example/x" }, undefined, undefined, "/"],
  ["a protocol-relative address: the home", { url: "//evil.example/x" }, undefined, undefined, "/"],
  ["a backslash trick: the home", { url: "/\\evil.example" }, undefined, undefined, "/"],
  ["a script: the home", { url: "javascript:alert(1)" }, undefined, undefined, "/"],
];

describe("where a tap on a notice leads", () => {
  it("the service worker has its copy", () => {
    expect(block).toContain("const pushClickUrl");
    expect(typeof swClickUrl).toBe("function");
  });

  for (const [name, data, action, nonce, url] of CASES) {
    it(name, () => {
      expect(pushClickUrl(data, action, nonce)).toBe(url);
      expect(swClickUrl(data, action, nonce)).toBe(url);
    });
  }

  it("the worker's click handler leaves a ticket and routes through it; the buttons reach showNotification", () => {
    expect(sw).toMatch(/pushClickUrl\(data, action, nonce\)/);
    expect(sw).toMatch(/self\.crypto\.randomUUID\(\)/);
    expect(sw).toMatch(/options\.actions = actions/);
  });

  it("the worker's ticket is the one the page reads (same cache, same life)", () => {
    expect(sw).toContain(`const RSVP_CACHE = "${RSVP_CACHE}";`);
    expect(RSVP_TICKET_MS).toBe(10 * 60_000);
    expect(sw).toContain("const RSVP_TICKET_MS = 10 * 60_000;");
    expect(sw).toContain('cache.put("/rsvp/" + nonce');
  });
});
