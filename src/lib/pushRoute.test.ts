import { describe, expect, it } from "vitest";
import { pushClickUrl, type PushClickData } from "./pushRoute";

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

const CASES: [string, PushClickData | null | undefined, string | null | undefined, string][] = [
  ["«Voy» opens the vestuario with the answer", { url: "/matches/m8", matchId: "m8" }, "yes", "/vestuario?rsvp=yes&m=m8"],
  ["«No puedo» too", { url: "/matches/m8?tab=vestuario", matchId: "m8" }, "no", "/vestuario?rsvp=no&m=m8"],
  ["a plain tap keeps the notice's link", { url: "/matches/m8", matchId: "m8" }, "", "/matches/m8"],
  ["a plain tap without action at all", { url: "/matches/m8?tab=vestuario" }, undefined, "/matches/m8?tab=vestuario"],
  ["an unknown button is a plain tap", { url: "/matches/m8", matchId: "m8" }, "maybe", "/matches/m8"],
  ["a button without its match is a plain tap", { url: "/matches/m8" }, "yes", "/matches/m8"],
  ["the match id is escaped", { url: "/", matchId: "a b&c" }, "yes", "/vestuario?rsvp=yes&m=a%20b%26c"],
  ["no data: the home", null, "yes", "/"],
  ["a malformed link: the home", { url: 7, matchId: 3 }, "no", "/"],
];

describe("where a tap on a notice leads", () => {
  it("the service worker has its copy", () => {
    expect(block).toContain("const pushClickUrl");
    expect(typeof swClickUrl).toBe("function");
  });

  for (const [name, data, action, url] of CASES) {
    it(name, () => {
      expect(pushClickUrl(data, action)).toBe(url);
      expect(swClickUrl(data, action)).toBe(url);
    });
  }

  it("the worker's click handler routes through it and passes the buttons to showNotification", () => {
    expect(sw).toMatch(/pushClickUrl\(event\.notification\.data, event\.action\)/);
    expect(sw).toMatch(/options\.actions = actions/);
  });
});
