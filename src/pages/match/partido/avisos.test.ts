// @vitest-environment jsdom
// «Avisos de este partido» (avisos.ts): the sheet starts from this device's real choice for the match, a
// device that can't get notices shows the switches off with the reason, and a switch saves the match's
// override (optimistic; a failure goes back and says why).
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: "ready" as string,
  saved: [] as string[],
  match: {} as Record<string, string[]>,
  set: vi.fn(),
  subscribed: true as boolean | null,
  ls: new Set<() => void>(),
}));
vi.mock("../../../lib/push", () => ({
  PUSH_WHY: { "ios-install": "IOS", denied: "BLOQUEADOS", unsupported: "SIN AVISOS" },
  pushSaveError: (e: unknown) => (e instanceof Error && /permiso/i.test(e.message) ? "Sin permiso para avisos en este navegador." : "No se han podido guardar tus avisos. Inténtalo otra vez."),
  pushState: () => h.state,
  pushChoiceKey: () => JSON.stringify([h.saved, h.match]),
  pushChoiceOf: (key: string) => {
    const [topics, matches] = key ? (JSON.parse(key) as [string[], Record<string, string[]>]) : [[], {}];
    return { topics, matches };
  },
  subscribePushChoice: (cb: () => void) => {
    h.ls.add(cb);
    return () => h.ls.delete(cb);
  },
  setMatchTopics: h.set,
}));
vi.mock("../../perfil/device", () => ({ pushSubscribed: async () => h.subscribed, watchPermission: () => () => undefined }));

import { avisosView, notifyTopic, toggled, useAvisos, withoutOver } from "./avisos";

beforeEach(() => {
  h.state = "ready";
  h.saved = [];
  h.match = {};
  h.subscribed = true;
  h.set.mockReset().mockResolvedValue(null);
});

describe("avisosView", () => {
  it("before the match: on is what the device has for it", () => {
    const v = avisosView({ fase: "antes", rival: "MAD SKY", topics: ["goals", "final"], state: "ready" });
    expect(v.rows.filter((r) => r.on).map((r) => r.id)).toEqual(["goles", "final"]);
    expect(v.label).toBe("Avisos: 2");
    expect(v.sub).toBe("Te avisamos de los goles y el descanso y el final.");
    expect(v.rows.find((r) => r.id === "goles")?.d).toBe("Los nuestros y los de MAD SKY, al momento");
    expect(v.show).toBe(true);
  });
  it("what already happened is off and says so", () => {
    const v = avisosView({ fase: "segunda", rival: "x", topics: ["start", "goals", "lineup"], state: "ready" });
    const inicio = v.rows.find((r) => r.id === "inicio");
    expect(inicio).toMatchObject({ on: false, off: true, d: "Ya ha pasado en este partido" });
    expect(v.line).toBe("Te avisamos de los goles.");
  });
  it("a device that can't get notices: all off, disabled, with the reason — the header still offers them", () => {
    const v = avisosView({ fase: "antes", rival: "x", topics: ["goals"], state: "ios-install" });
    expect(v.rows.every((r) => r.off && !r.on)).toBe(true);
    expect(v.rows.find((r) => r.id === "goles")?.d).toBe("Los nuestros y los de x, al momento");
    expect(v.sub).toBe("IOS");
    expect(v.show).toBe(true);
    expect(v.label).toBe("Avisarme");
  });
  it("aplazado: «Avísame cuando haya fecha» is the dates; pendiente: the acta is the mvp", () => {
    expect(notifyTopic("aplazado")).toBe("dates");
    expect(notifyTopic("pendiente")).toBe("mvp");
    expect(avisosView({ fase: "aplazado", rival: "x", topics: ["dates"], state: "ready" }).notifyOn).toBe(true);
    expect(avisosView({ fase: "pendiente", rival: "x", topics: ["dates"], state: "ready" }).notifyOn).toBe(false);
    expect(toggled(["goals"], "dates", true)).toEqual(["goals", "dates"]);
    expect(toggled(["goals", "dates"], "goals", false)).toEqual(["dates"]);
  });
  it("once kicked off, «Cuando empiece» and «El siete oficial» leave what is saved (they show off)", () => {
    const all = ["start", "goals", "cards", "final", "lineup", "mvp", "dates"] as const;
    expect(withoutOver("antes", all)).toEqual([...all]);
    expect(withoutOver("pitido", all)).toEqual([...all]);
    expect(withoutOver("segunda", all)).toEqual(["goals", "cards", "final", "mvp", "dates"]);
    expect(withoutOver("despues", ["start", "mvp"])).toEqual(["mvp"]);
    // (an aplazado keeps its choice for the new date)
    expect(withoutOver("aplazado", all)).toEqual([...all]);
  });
});

describe("useAvisos", () => {
  it("starts from the override, else the global topics; nothing without a subscription", async () => {
    h.saved = ["goals", "cards", "convocatoria"];
    const { result, rerender } = renderHook(({ id }) => useAvisos(id, "antes", true), { initialProps: { id: "j8" } });
    await waitFor(() => expect(result.current.rows.filter((r) => r.on).map((r) => r.id)).toEqual(["goles", "tarjetas"]));
    h.match = { j9: ["final"] };
    rerender({ id: "j9" });
    await waitFor(() => expect(result.current.rows.filter((r) => r.on).map((r) => r.id)).toEqual(["final"]));
    h.subscribed = false;
    const off = renderHook(() => useAvisos("j8", "antes", true));
    await waitFor(() => expect(off.result.current.n).toBe(0));
  });
  it("a switch saves the match's whole choice, optimistically", async () => {
    h.saved = ["goals"];
    let done: (v: null) => void = () => undefined;
    h.set.mockReturnValue(new Promise((r) => (done = r)));
    const say = vi.fn();
    const { result } = renderHook(() => useAvisos("j8", "antes", false, "MAD SKY", say));
    await waitFor(() => expect(result.current.n).toBe(1));
    act(() => result.current.rows.find((r) => r.id === "tarjetas")!.toggle());
    expect(result.current.rows.find((r) => r.id === "tarjetas")?.on).toBe(true);
    expect(say).toHaveBeenCalledWith("Te avisamos de las tarjetas.");
    await waitFor(() => expect(h.set).toHaveBeenCalledWith("j8", ["goals", "cards"]));
    // (lib/push keeps the server's answer and tells its listeners, then resolves)
    await act(async () => {
      h.match = { j8: ["goals", "cards"] };
      h.ls.forEach((l) => l());
      done(null);
    });
    expect(result.current.rows.find((r) => r.id === "tarjetas")?.on).toBe(true);
  });
  it("a failure goes back and says why", async () => {
    h.saved = ["goals"];
    h.set.mockRejectedValue(new Error("Sin permiso para avisos en este navegador."));
    const say = vi.fn();
    const { result } = renderHook(() => useAvisos("j8", "antes", false, "x", say));
    await waitFor(() => expect(result.current.n).toBe(1));
    act(() => result.current.rows.find((r) => r.id === "goles")!.toggle());
    expect(result.current.n).toBe(0);
    await waitFor(() => expect(say).toHaveBeenLastCalledWith("Sin permiso para avisos en este navegador."));
    await waitFor(() => expect(result.current.n).toBe(1));
  });
  it("the aplazado's «Avísame cuando haya fecha» adds the dates to the match's choice", async () => {
    h.saved = ["goals", "final"];
    const { result } = renderHook(() => useAvisos("j8", "aplazado", true));
    await waitFor(() => expect(result.current.notify.on).toBe(false));
    act(() => result.current.notify.toggle());
    expect(result.current.notify.on).toBe(true);
    await waitFor(() => expect(h.set).toHaveBeenCalledWith("j8", ["goals", "final", "dates"]));
  });
  it("can't get notices: switches do nothing and say why", () => {
    h.state = "denied";
    const say = vi.fn();
    const { result } = renderHook(() => useAvisos("j8", "antes", true, "x", say));
    act(() => result.current.rows[1].toggle());
    act(() => result.current.notify.toggle());
    expect(h.set).not.toHaveBeenCalled();
    expect(result.current.sub).toBe("BLOQUEADOS");
    expect(say).toHaveBeenCalledWith("BLOQUEADOS");
  });
});
