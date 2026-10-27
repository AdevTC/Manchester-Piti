// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnyRouter } from "@tanstack/react-router";
import { warmSections } from "./warmSections";

const router = (pathname: string) => {
  const preloaded: string[] = [];
  const r = { state: { location: { pathname } }, preloadRoute: vi.fn(async ({ to }: { to: string }) => void preloaded.push(to)) };
  return { r: r as unknown as AnyRouter, preloaded };
};
const flush = async () => {
  for (let i = 0; i < 12; i++) {
    await vi.runAllTimersAsync();
  }
};

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(navigator, "connection", { value: undefined, configurable: true });
});

describe("warming the sections", () => {
  it("warms the other four sections, one after the other, at idle moments", async () => {
    vi.useFakeTimers();
    const { r, preloaded } = router("/partidos/tabla");
    warmSections(r, 100);
    expect(preloaded).toEqual([]);
    await flush();
    expect(preloaded).toEqual(["/", "/plantilla", "/estadisticas", "/club"]);
  });

  it("does nothing on a connection that asks to save data", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
    const { r, preloaded } = router("/");
    warmSections(r, 100);
    await flush();
    expect(preloaded).toEqual([]);
  });
});
