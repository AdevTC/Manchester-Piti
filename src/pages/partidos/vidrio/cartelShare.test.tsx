// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCartelShare } from "./cartelShare";
import type { Cartel } from "../../../lib/derived/vidrio/cartel";
import type { SegmentPaint } from "./model";

const paint = { a: "noche", b: "noche", m0: 0, m1: 1, sun: null, floods: null } as unknown as SegmentPaint;

describe("useCartelShare", () => {
  it("builds a cartel given as a function only when the image is asked for", async () => {
    const build = vi.fn(() => null as Cartel | null);
    const { result, rerender } = renderHook(() => useCartelShare(build, paint));
    rerender();
    rerender();
    expect(build).not.toHaveBeenCalled();
    let ok = true;
    await act(async () => {
      ok = await result.current.run(false);
    });
    expect(build).toHaveBeenCalledTimes(1);
    // (nothing to draw: nothing goes out)
    expect(ok).toBe(false);
  });
});
