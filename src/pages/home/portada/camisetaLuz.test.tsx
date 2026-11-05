// @vitest-environment jsdom
// /camiseta and /club/equipo/camiseta start in the visitor's theme: «Con focos» in Noche, «De día» in Día. The
// server can't know the theme (and React takes its page over as the server painted it): there the light is the
// floodlit one marked .is-auto, and the «día» theme shows its own by CSS. It used to be fixed from the first render,
// where the theme reads «Día», so a first visit in Noche stayed «De día».
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";

vi.mock("../../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));
vi.mock("./links", () => ({ PageLink: () => null }));
vi.mock("./print", () => ({ drawPrint: () => undefined }));

const { Camiseta } = await import("./Camiseta");
const { Maker } = await import("../../club/cb/Maker");

const say = () => undefined;
const cam = (day: boolean) => <Camiseta initialName="" initialNum="" initialKit="home" day={day} mine={null} fan={false} say={say} />;
const maker = (day: boolean) => <Maker people={[]} mine={null} day={day} back={say} say={say} />;
const fig = (root: ParentNode, sel: string) => root.querySelector(sel)?.className ?? "";

describe("the shirt maker's light", () => {
  it("on the server: the floodlit one, marked for the «día» theme's CSS", () => {
    const html = document.createElement("div");
    html.innerHTML = renderToString(cam(true));
    expect(fig(html, ".ik-fig")).toContain("is-focos");
    expect(fig(html, ".ik-fig")).toContain("is-auto");
    expect(html.querySelectorAll(".ik-segw.is-auto")).toHaveLength(1);
    html.innerHTML = renderToString(maker(true));
    expect(fig(html, ".cb-mk__pic")).toContain("is-auto");
    expect(fig(html, ".cb-mk__pic")).not.toContain("is-dia");
    expect(html.querySelector<HTMLElement>(".cb-mk__luz.is-auto")?.style.getPropertyValue("--i")).toBe("0");
  });

  it("in the browser: the theme's, Noche or Día", () => {
    const night = render(cam(false));
    expect(fig(night.container, ".ik-fig")).toMatch(/is-focos(?!.*is-auto)/);
    night.unmount();
    const day = render(cam(true));
    expect(fig(day.container, ".ik-fig")).toContain("is-dia");
    expect(day.container.querySelector(".is-auto")).toBeNull();
    day.unmount();
    const club = render(maker(false));
    expect(fig(club.container, ".cb-mk__pic")).not.toContain("is-dia");
    club.unmount();
    const clubDay = render(maker(true));
    expect(fig(clubDay.container, ".cb-mk__pic")).toContain("is-dia");
    expect(clubDay.container.querySelector<HTMLElement>(".cb-mk__luz")?.style.getPropertyValue("--i")).toBe("1");
  });

  it("follows the theme until a light is picked, then keeps it", () => {
    const { container, rerender, getByRole } = render(cam(false));
    rerender(cam(true));
    expect(fig(container, ".ik-fig")).toContain("is-dia");
    fireEvent.click(getByRole("radio", { name: "Con focos" }));
    rerender(cam(false));
    rerender(cam(true));
    expect(fig(container, ".ik-fig")).toContain("is-focos");
  });
});
