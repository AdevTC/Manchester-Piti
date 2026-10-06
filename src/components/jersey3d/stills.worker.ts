/// <reference lib="webworker" />
// Renders the kit stills off the main thread: WebGL on an OffscreenCanvas inside a Web Worker
// (Chrome, Firefox, Safari 17+). The page never freezes while the squad's photos are made.
import semi600 from "@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-600-normal.woff2?url";
import semi700 from "@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-700-normal.woff2?url";
import cond600 from "@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2?url";
import cond700 from "@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2?url";
import { renderStill, setFaceLoader } from "./scene";
import type { StillJob, StillReply } from "./stillsClient";

declare const self: DedicatedWorkerGlobalScope & { fonts: FontFaceSet };

// No stylesheet here: register the print faces from the same files the page uses.
setFaceLoader(async () => {
  const faces = [
    new FontFace("Barlow Semi Condensed", `url(${semi600})`, { weight: "600" }),
    new FontFace("Barlow Semi Condensed", `url(${semi700})`, { weight: "700" }),
    new FontFace("Barlow Condensed", `url(${cond600})`, { weight: "600" }),
    new FontFace("Barlow Condensed", `url(${cond700})`, { weight: "700" }),
  ];
  await Promise.all(
    faces.map((f) =>
      f.load().then(
        (loaded) => self.fonts.add(loaded),
        () => undefined,
      ),
    ),
  );
});

self.onmessage = async (e: MessageEvent<StillJob>) => {
  const { id, req, type, scale, dpr } = e.data;
  try {
    const blob = await renderStill(req, type, scale, dpr);
    self.postMessage({ id, blob } satisfies StillReply);
  } catch (error) {
    self.postMessage({ id, error: String(error) } satisfies StillReply);
  }
};

// Tell the page whether WebGL2 works here (Safari < 17 has OffscreenCanvas but no WebGL in workers).
const webgl2 = () => {
  try {
    return !!new OffscreenCanvas(1, 1).getContext("webgl2");
  } catch {
    return false;
  }
};
self.postMessage({ ready: webgl2() } satisfies StillReply);
