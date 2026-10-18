import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { madridMinutes, SCRUB0, SCRUB1 } from "../../components/palomeras3d";
import { SunScrub } from "./SunScrub";
import { scrubToMs } from "./inicioModel";
import { KO, MIN } from "./inicio.fixtures";

// «Arrastra el sol» is a real slider: arrows move five minutes, Re Pág/Av Pág half an hour, Inicio/Fin the ends
// of the afternoon, Esc back to now; the snaps jump to the whistle, half-time and the final.
const toMs = (m: number) => scrubToMs(KO, m);
const setup = (at = KO - 60 * MIN, scrubbing = false) => {
  const onScrub = vi.fn();
  const onNow = vi.fn();
  render(
    <SunScrub
      at={at}
      scrubbing={scrubbing}
      what="faltan 60 min"
      marks={[
        { key: "pitido", label: "Pitido 19:00", at: KO },
        { key: "descanso", label: "Descanso", at: KO + 26 * MIN },
        { key: "final", label: "Final", at: KO + 61 * MIN },
      ]}
      toMs={toMs}
      onScrub={onScrub}
      onNow={onNow}
    />,
  );
  return { onScrub, onNow, slider: screen.getByRole("slider", { name: "Arrastra el sol" }) };
};
const minutesOf = (fn: ReturnType<typeof vi.fn>) => Math.round(madridMinutes(fn.mock.calls.at(-1)![0] as number));

it("says the time and what it means", () => {
  const { slider } = setup();
  expect(slider).toHaveAttribute("aria-valuetext", "18:00, faltan 60 min");
  expect(slider).toHaveValue(String(18 * 60));
});

it("arrows move five minutes, pages half an hour", () => {
  const { slider, onScrub } = setup();
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  expect(minutesOf(onScrub)).toBe(18 * 60 + 5);
  fireEvent.keyDown(slider, { key: "ArrowDown" });
  expect(minutesOf(onScrub)).toBe(18 * 60 - 5);
  fireEvent.keyDown(slider, { key: "PageUp" });
  expect(minutesOf(onScrub)).toBe(18 * 60 + 30);
});

it("Inicio and Fin go to 14:00 and 21:00; Esc goes back to now only while scrubbing", () => {
  const first = setup();
  fireEvent.keyDown(first.slider, { key: "Home" });
  expect(minutesOf(first.onScrub)).toBe(SCRUB0);
  fireEvent.keyDown(first.slider, { key: "End" });
  expect(minutesOf(first.onScrub)).toBe(SCRUB1);
  fireEvent.keyDown(first.slider, { key: "Escape" });
  expect(first.onNow).not.toHaveBeenCalled();
});

it("while scrubbing: «Volver a ahora» and Esc leave it; the snaps jump to their moment", () => {
  const { slider, onNow, onScrub } = setup(KO + 10 * MIN, true);
  fireEvent.keyDown(slider, { key: "Escape" });
  expect(onNow).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Volver a ahora" }));
  expect(onNow).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Descanso" }));
  expect(onScrub).toHaveBeenLastCalledWith(KO + 26 * MIN);
});

it("a drag lands on a mark when it ends within four minutes of it", () => {
  const { slider, onScrub } = setup();
  fireEvent.change(slider, { target: { value: String(19 * 60 + 3) } });
  expect(minutesOf(onScrub)).toBe(19 * 60);
});
