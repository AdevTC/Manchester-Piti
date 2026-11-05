// @vitest-environment jsdom
// «Lo que te toca» updates its tiles in place: a task that comes, goes or changes no longer re-makes the whole row
// (it was keyed by all its tiles), and a row whose set of tiles changed goes back to its start, as a new row did.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { TasksBand } from "./Portada";
import type { Task, TasksView } from "./bands";

const task = (key: string, t = key): Task => ({ key, icon: "ball", cls: "", t, sub: "", seg: null, btn: null, done: null, pending: false, error: "" });
const view = (list: Task[]): TasksView => ({ h: "Lo que te toca", sub: "", list, all: list, pending: 0, door: false, badge: 0, note: null, layout: `tk-${list.length}` });
const noop = () => undefined;
const go = () => noop;

/** The row, with a scrollLeft that remembers what it is set to (jsdom's is always 0). */
function rowOf(container: HTMLElement) {
  const ul = container.querySelector<HTMLUListElement>(".in-tasks__l");
  if (!ul) throw new Error("no row");
  let x = 0;
  Object.defineProperty(ul, "scrollLeft", { configurable: true, get: () => x, set: (v: number) => {
      x = v;
    } });
  return ul;
}

describe("«Lo que te toca»", () => {
  it("keeps the row and the tiles that stay when a task comes or goes", () => {
    const { container, rerender } = render(<TasksBand tasks={view([task("rsvp"), task("porra")])} onTask={noop} go={go} />);
    const ul = rowOf(container);
    const porra = ul.querySelector("li:nth-child(2)");
    rerender(<TasksBand tasks={view([task("porra"), task("mvp")])} onTask={noop} go={go} />);
    expect(container.querySelector(".in-tasks__l")).toBe(ul);
    expect(ul.querySelector("li:first-child")).toBe(porra);
    expect([...ul.querySelectorAll("li b")].map((b) => b.textContent)).toEqual(["porra", "mvp"]);
  });

  it("goes back to the start of the row when its tiles change, not when one only changes its words", () => {
    const { container, rerender } = render(<TasksBand tasks={view([task("rsvp"), task("porra"), task("mvp")])} onTask={noop} go={go} />);
    const ul = rowOf(container);
    ul.scrollLeft = 310;
    rerender(<TasksBand tasks={view([task("rsvp", "Vas"), task("porra"), task("mvp")])} onTask={noop} go={go} />);
    expect(ul.scrollLeft).toBe(310);
    rerender(<TasksBand tasks={view([task("porra"), task("mvp")])} onTask={noop} go={go} />);
    expect(ul.scrollLeft).toBe(0);
  });
});
