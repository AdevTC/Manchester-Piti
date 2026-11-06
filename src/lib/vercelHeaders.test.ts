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

// The script policy, report-only for now (csp-scripts): every inline script the pages run has its hash listed, and
// nothing else inline. The built pages are checked too, at build time (scripts/ssr-shell.mjs).
const { cspHash, inlineScripts, jsonScript, ROUTE_PRELOAD_JS, routerScrollScript, SSR_BOOT_JS } = await import("../../scripts/inlineScripts.mjs");
const scriptRule = config.headers.find((h) => h.headers.some((x) => x.key === "Content-Security-Policy-Report-Only"));
const policy = scriptRule?.headers.find((x) => x.key === "Content-Security-Policy-Report-Only")?.value ?? "";
const directive = (name: string) =>
  policy
    .split(";")
    .map((d) => d.trim().split(/\s+/))
    .find(([n]) => n === name)
    ?.slice(1) ?? [];

describe("vercel.json: Content-Security-Policy-Report-Only for scripts", () => {
  it("lists exactly the inline scripts: index.html's theme, the shell's route preload, the server page's boot and the router's scroll restoration", () => {
    const theme = inlineScripts(readFileSync("index.html", "utf8"));
    expect(theme).toHaveLength(1);
    const hashes = directive("script-src").filter((s) => s.startsWith("'sha256-"));
    expect(hashes.sort()).toEqual([cspHash(theme[0]), cspHash(ROUTE_PRELOAD_JS), cspHash(SSR_BOOT_JS), cspHash(routerScrollScript())].sort());
  });
  it("only the app's own files, Google's sign-in script and WebAssembly (the shirt's meshopt decoder); no eval, no plugins", () => {
    expect(directive("script-src").filter((s) => !s.startsWith("'sha256-"))).toEqual(["'self'", "'wasm-unsafe-eval'", "https://apis.google.com"]);
    expect(directive("worker-src")).toEqual(["'self'"]);
    expect(directive("object-src")).toEqual(["'none'"]);
    expect(directive("base-uri")).toEqual(["'self'"]);
    expect(policy).not.toMatch(/'unsafe-inline'|'unsafe-eval'/);
  });
  it("everywhere except the share pages (their own redirect script, served by clubShare)", () => {
    expect(scriptRule?.source).toBe("/:path((?!compartir/|social/).*)");
  });
  it("the JSON beside the scripts never closes its element; only scripts the browser runs count", () => {
    expect(jsonScript("x", ["</script><script>alert(1)</script>"])).toBe('<script type="application/json" id="x">["\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"]</script>');
    expect(inlineScripts('<script type="application/json" id="x">[1]</script><script src="/a.js"></script><script>go()</script><script type="module">m()</script>')).toEqual(["go()", "m()"]);
  });
});
