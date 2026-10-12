import { describe, expect, it } from "vitest";
import { charlaLast, STEP_BANQUILLO, STEP_JUGADA, STEP_PLAN } from "./charla";
import { blobToBase64, extraSlots, parseVozDoc, pickMime, slotFor, VOZ_LIMITS, vozByStep, vozErrorTxt, vozKey, vozSrc, vozStepTxt, vozSupport, vozSupportTxt, vozTime, type VozClip } from "./voz";
import { vozWriteError } from "./vozStore";

// Bloque 5 · la voz en off: each step of the charla named so a clip stays with it, the stored clip read
// leniently, six slots at most, the recorder's container and what the browser can do, in Spanish.

const clip = (slot: VozClip["slot"], step: string, at = 1): VozClip => ({ slot, step, mime: "audio/webm", ms: 1000, data: "AAAA", at });

describe("the step a clip belongs to", () => {
  it("is stable: the seven by number, the jugada by paso, the rest by name", () => {
    const last = charlaLast(3);
    expect(vozKey(0, last)).toBe("sistema");
    expect(vozKey(3, last)).toBe("siete-3");
    expect(vozKey(STEP_BANQUILLO, last)).toBe("banquillo");
    expect(vozKey(STEP_PLAN, last)).toBe("plan");
    expect(vozKey(STEP_JUGADA, last)).toBe("jugada-1");
    expect(vozKey(STEP_JUGADA + 2, last)).toBe("jugada-3");
    expect(vozKey(last - 1, last)).toBe("quedada");
    expect(vozKey(last, last)).toBe("final");
    // a longer jugada keeps «el plan» and «la quedada» named the same
    expect(vozKey(charlaLast(5) - 1, charlaLast(5))).toBe("quedada");
    expect(vozStepTxt("siete-3")).toBe("el jugador 3 del siete");
    expect(vozStepTxt("jugada-2")).toBe("el paso 2 de la jugada");
    expect(vozStepTxt("final")).toBe("«¡A por ellos!»");
  });
});

describe("a stored clip", () => {
  const ok = { step: "plan", mime: "audio/webm;codecs=opus", ms: 12000, data: "UklGRg==", by: "u", at: { toMillis: () => 5 } };
  it("is read with its slot, step and time", () => {
    expect(parseVozDoc("v2", ok)).toEqual({ slot: "v2", step: "plan", mime: "audio/webm;codecs=opus", ms: 12000, data: "UklGRg==", at: 5 });
  });
  it("is dropped (never the charla) when it is not one: another doc id, too long, not audio, not base64, an unknown step", () => {
    expect(parseVozDoc("v9", ok)).toBeNull();
    expect(parseVozDoc("v0", { ...ok, ms: 31000 })).toBeNull();
    expect(parseVozDoc("v0", { ...ok, mime: "text/html" })).toBeNull();
    expect(parseVozDoc("v0", { ...ok, data: "<script>" })).toBeNull();
    expect(parseVozDoc("v0", { ...ok, step: "siete-9" })).toBeNull();
    expect(parseVozDoc("v0", { ...ok, data: "A".repeat(VOZ_LIMITS.chars + 4) })).toBeNull();
    expect(parseVozDoc("v0", null)).toBeNull();
  });
});

describe("six slots", () => {
  it("re-recording a step uses its own slot; a new step the first free one; none when six steps have voice", () => {
    const list = [clip("v0", "plan"), clip("v2", "sistema")];
    expect(slotFor(list, "plan")).toBe("v0");
    expect(slotFor(list, "final")).toBe("v1");
    const full = (["v0", "v1", "v2", "v3", "v4", "v5"] as const).map((s, i) => clip(s, "siete-" + (i + 1)));
    expect(slotFor(full, "plan")).toBeNull();
    expect(slotFor(full, "siete-2")).toBe("v1");
  });
  it("two clips of one step (two devices at once): the newest is played, the other goes on the next save", () => {
    const list = [clip("v0", "plan", 10), clip("v3", "plan", 20)];
    expect(vozByStep(list).get("plan")?.slot).toBe("v3");
    expect(extraSlots(list, "plan", "v3")).toEqual(["v0"]);
    expect(extraSlots(list, "plan", null)).toEqual(["v0", "v3"]);
  });
  it("a clip is checked before it is written (the rules check the same)", () => {
    expect(vozWriteError({ mime: "audio/webm", ms: 1000, data: "AAAA" })).toBeNull();
    expect(vozWriteError({ mime: "audio/webm", ms: 40_000, data: "AAAA" })).toMatch(/30 segundos/);
    expect(vozWriteError({ mime: "audio/webm", ms: 1000, data: "A".repeat(VOZ_LIMITS.chars + 1) })).toMatch(/pesa demasiado/);
    expect(vozWriteError({ mime: "audio/webm", ms: 1000, data: "" })).toMatch(/vacía/);
  });
});

describe("what the browser can do", () => {
  it("records webm/opus where it can, else mp4 (Safari), else what the browser chooses", () => {
    expect(pickMime((t) => t === "audio/webm;codecs=opus")).toBe("audio/webm;codecs=opus");
    expect(pickMime((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickMime(() => false)).toBe("");
    expect(pickMime(undefined)).toBe("");
    expect(
      pickMime(() => {
        throw new Error("x");
      }),
    ).toBe("");
  });
  it("says in Spanish why it can't record (no MediaRecorder, no microphone, not https)", () => {
    const rec = function MediaRecorder() {};
    expect(vozSupport({ isSecureContext: true, MediaRecorder: rec, navigator: { mediaDevices: { getUserMedia: () => null } } })).toBe("ok");
    expect(vozSupport({ isSecureContext: true, navigator: {} })).toBe("no-recorder");
    expect(vozSupport({ isSecureContext: true, MediaRecorder: rec, navigator: {} })).toBe("no-mic");
    expect(vozSupport({ isSecureContext: false, MediaRecorder: rec })).toBe("insecure");
    expect(vozSupportTxt("ok")).toBeNull();
    expect(vozSupportTxt("no-recorder")).toMatch(/no puede grabar audio/);
    expect(vozSupportTxt("insecure")).toMatch(/https/);
    expect(vozErrorTxt({ name: "NotAllowedError" })).toMatch(/Sin permiso para el micrófono/);
    expect(vozErrorTxt({ name: "NotFoundError" })).toMatch(/ningún micrófono/);
    expect(vozErrorTxt(new Error("x"))).toMatch(/No se ha podido grabar/);
  });
  it("a clip becomes base64 and plays back as a data: URL", async () => {
    const b64 = await blobToBase64(new Blob([new Uint8Array([1, 2, 3, 250])], { type: "audio/webm" }));
    expect(b64).toBe("AQID+g==");
    expect(vozSrc({ mime: "audio/webm;codecs=opus", data: b64 })).toBe("data:audio/webm;base64,AQID+g==");
    expect(vozTime(12_400)).toBe("0:12");
    expect(vozTime(30_000)).toBe("0:30");
  });
});
