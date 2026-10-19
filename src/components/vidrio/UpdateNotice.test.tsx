import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startAppUpdates } from "../../lib/appUpdate";
import { UpdateNotice } from "./UpdateNotice";

class FakeSw extends EventTarget {
  controller = {} as ServiceWorker;
  register = vi.fn(() => Promise.resolve({ update: () => Promise.resolve() } as unknown as ServiceWorkerRegistration));
}
const router = { subscribe: () => () => {}, state: { location: { pathname: "/matches/m1/mesa" } } };
let stop: () => void = () => {};
afterEach(() => stop());

describe("UpdateNotice", () => {
  it("offers the new version when the page could not switch by itself", () => {
    const sw = new FakeSw();
    const reload = vi.fn();
    stop = startAppUpdates({ router, busy: () => false, sw, reload });
    render(<UpdateNotice />);
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();

    act(() => void sw.dispatchEvent(new Event("controllerchange"))); // la mesa: held, so the notice
    expect(status).toHaveTextContent("Hay una versión nueva");
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("«Ahora no» puts it away", () => {
    const sw = new FakeSw();
    stop = startAppUpdates({ router, busy: () => false, sw, reload: vi.fn() });
    render(<UpdateNotice />);
    act(() => void sw.dispatchEvent(new Event("controllerchange")));
    fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(screen.queryByText("Hay una versión nueva")).toBeNull();
  });
});
