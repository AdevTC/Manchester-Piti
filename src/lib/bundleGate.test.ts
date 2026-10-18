import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetBundleGateForTesting, afterBundle, holdListenersFor } from "./bundleGate";

describe("bundleGate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    _resetBundleGateForTesting();
  });

  it("sin paquete pendiente abre la escucha en el acto", () => {
    const open = vi.fn(() => () => {});
    afterBundle(open);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("con el paquete cargándose espera a que entre y luego abre", async () => {
    let finish!: () => void;
    holdListenersFor(new Promise<void>((r) => (finish = r)), 4000);
    const open = vi.fn(() => () => {});
    afterBundle(open);
    await vi.advanceTimersByTimeAsync(100);
    expect(open).not.toHaveBeenCalled();
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(open).toHaveBeenCalledTimes(1);
    // Ya entró: las siguientes escuchas abren sin esperar.
    const later = vi.fn(() => () => {});
    afterBundle(later);
    expect(later).toHaveBeenCalledTimes(1);
  });

  it("un paquete que falla también suelta las escuchas", async () => {
    holdListenersFor(Promise.reject(new Error("bundle 500")), 4000);
    const open = vi.fn(() => () => {});
    afterBundle(open);
    await vi.advanceTimersByTimeAsync(0);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("un paquete que no llega no las retiene más del máximo", async () => {
    holdListenersFor(new Promise(() => {}), 4000);
    const open = vi.fn(() => () => {});
    afterBundle(open);
    await vi.advanceTimersByTimeAsync(3999);
    expect(open).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("parar antes de que abra la cancela; parar después la cierra", async () => {
    let finish!: () => void;
    holdListenersFor(new Promise<void>((r) => (finish = r)), 4000);
    const cancelledOpen = vi.fn(() => () => {});
    afterBundle(cancelledOpen)();
    const unsub = vi.fn();
    const stop = afterBundle(() => unsub);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(cancelledOpen).not.toHaveBeenCalled();
    stop();
    expect(unsub).toHaveBeenCalledTimes(1);
  });
});
