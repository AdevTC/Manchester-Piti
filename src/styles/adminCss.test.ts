// admin.css is generated (scripts/port-admin-css.mjs from scripts/admin-design/ad-v2-full-css.mjs): it is
// exactly what the port writes, and its result marks speak the app's alphabet, G · E · P
// (functions/src/result.ts), the classes ResultMark and the vitrina / balda put on `.ved`.
import { describe, expect, it } from "vitest";
import { RESULT_WORD } from "../lib/derived/result";

// Node modules come in through typed dynamic imports (the app's tsconfig has no Node types).
type Fs = { readFileSync: (path: string, encoding: "utf8") => string };
type ChildProcess = { execFileSync: (file: string, args: string[], options: { encoding: "utf8"; stdio: "pipe" }) => string };
const fsModule = "node:fs";
const cpModule = "node:child_process";
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;
const { execFileSync } = (await import(/* @vite-ignore */ cpModule)) as ChildProcess;
const admin = readFileSync("src/styles/admin.css", "utf8"); // vitest runs from the repo root
const adminApp = readFileSync("src/styles/admin-app.css", "utf8");

describe("admin.css (generated)", () => {
  it("is exactly what `node scripts/port-admin-css.mjs` writes", () => {
    expect(() => execFileSync("node", ["scripts/port-admin-css.mjs", "--check"], { encoding: "utf8", stdio: "pipe" })).not.toThrow();
  });

  it("says where it comes from", () => {
    expect(admin).toContain("by `node scripts/port-admin-css.mjs`");
    expect(admin).toContain("Do not edit by hand");
  });

  it("marks every result letter with its own rule, G · E · P", () => {
    expect(Object.keys(RESULT_WORD)).toEqual(["G", "E", "P"]);
    for (const l of Object.keys(RESULT_WORD)) expect(admin, l).toMatch(new RegExp(`\\.adm \\.ved\\.${l}\\{`));
    // a victoria in sky, a derrota hatched (never the colour alone: the letter is in the mark)
    expect(admin).toMatch(/\.adm \.ved\.G\{background:#6CABDD;color:#0c1733\}/);
    expect(admin).toMatch(/\.adm \.ved\.P\{[^}]*repeating-linear-gradient/);
  });

  it("no canvas letters (V / D) left on a mark, and no G / P patch in admin-app.css", () => {
    expect(admin).not.toMatch(/\.ved\.[VD](?![\w-])/);
    expect(adminApp).not.toMatch(/\.ved:where\(\.[GP]\)/);
  });
});
