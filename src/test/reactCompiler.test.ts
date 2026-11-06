// The React Compiler skips a component silently (the build says nothing; the page just ships unmemoised): this keeps
// the pages with the slowest taps measured in the field compiled. A failure names the function and the reason; the
// whole list is `node scripts/compiler-audit.mjs`. It needs the Babel the compiler is written for (@babel/core 7):
// under Babel 8 every component with a default value in its props is skipped.
import { transformAsync } from "@babel/core";
import { describe, expect, it } from "vitest";

// (node:fs without @types/node in the app's tsconfig: the pushRoute.test pattern)
type Fs = { readFileSync: (path: string, encoding: "utf8") => string };
const fsModule = "node:fs";
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;

/** Files whose every component and hook must compile. */
const MUST_COMPILE = [
  "src/pages/home/HomePage.tsx",
  "src/pages/partidos/PartidosPage.tsx",
  "src/pages/partidos/vidrio/venuePlace.ts",
  "src/pages/stats/Panes.tsx",
  "src/pages/stats/Charts.tsx",
  "src/pages/stats/Posiciones.tsx",
  "src/pages/stats/Explorar.tsx",
  "src/pages/stats/Ahora.tsx",
  "src/pages/match/partido/ScreenNumeros.tsx",
  "src/pages/perfil/bandeja/AvisosMain.tsx",
  // a component with a default value in its props (`{ iconName = "calPlus" }`): Babel 8 made the compiler skip these
  "src/components/celeste/AddToCalendar.tsx",
];

async function skipped(file: string): Promise<string[]> {
  const out: string[] = [];
  const logger = {
    logEvent(_name: string, event: { kind: string; fnLoc?: { start?: { line?: number } } | null; detail?: { options?: { reason?: string }; reason?: string } }) {
      if (event.kind === "CompileError" || event.kind === "PipelineError") {
        out.push(`${file}:${event.fnLoc?.start?.line ?? "?"} ${event.detail?.options?.reason ?? event.detail?.reason ?? event.kind}`);
      }
    },
  };
  await transformAsync(readFileSync(file, "utf8"), {
    filename: file,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: file.endsWith(".ts") ? ["typescript"] : ["typescript", "jsx"] },
    plugins: [["babel-plugin-react-compiler", { panicThreshold: "none", logger }]],
  });
  return out;
}

describe("React Compiler", () => {
  it.each(MUST_COMPILE)("compiles every component and hook in %s", async (file) => {
    expect(await skipped(file)).toEqual([]);
  }, 30_000);
});
