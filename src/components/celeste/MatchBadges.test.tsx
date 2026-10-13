import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MatchBadges } from "./MatchBadges";
import { Stickers } from "../../pages/admin/kit/ShirtBack";

it("shows one ball/boot with multiplicity, plus separate accessible card totals", () => {
  const { container } = render(<MatchBadges goals={3} assists={2} yellowCards={2} redCards={1} />);
  expect(screen.getByRole("img", { name: "3 goles" })).toHaveTextContent("×3");
  expect(screen.getByRole("img", { name: "2 asistencias" })).toHaveTextContent("×2");
  expect(screen.getByRole("img", { name: "2 amarillas" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "1 roja" })).toBeInTheDocument();
  expect(container.querySelectorAll(".goal svg")).toHaveLength(1);
  expect(container.querySelectorAll(".assist svg")).toHaveLength(1);
});

it("groups the published acta's repeated stickers too", () => {
  const { container } = render(<Stickers list={["goal", "goal", "goal", "assist", "assist"]} />);
  expect(screen.getAllByRole("img")).toHaveLength(2);
  expect(container.querySelectorAll("svg")).toHaveLength(2);
});
