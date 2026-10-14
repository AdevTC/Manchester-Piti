import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PlayerPositions, PosLine } from "../../../lib/positionStats";
import { PlayedEvidence } from "./PlayedEvidence";
import { evidenceText } from "./plantillaLogic";

// The captain's evidence before approving a proposal: where the player really played (every season's actas).

const line = (code: PosLine["code"], minutes: number): PosLine => ({ code, minutes, matches: 1, goals: 0, assists: 0, yellowCards: 0, redCards: 0, rating: null });
const pos = (lines: PosLine[], estimatedMatches = 0): PlayerPositions => ({ lines, minutes: lines.reduce((s, l) => s + l.minutes, 0), estimatedMatches, matches: lines.length, top: lines[0]?.code ?? null });

describe("Ha jugado de (admin)", () => {
  it("«Ha jugado de: MC 320′ · MCD 140′»: codes by minutes, rounded", () => {
    expect(evidenceText(pos([line("MC", 320.4), line("MCD", 139.6)]))).toBe("Ha jugado de: MC 320′ · MCD 140′");
    render(<PlayedEvidence pos={pos([line("MC", 320), line("MCD", 140)])} />);
    expect(screen.getByText("Ha jugado de:")).toBeInTheDocument();
    expect(screen.getByText("Ha jugado de:").closest("p")).toHaveTextContent("Ha jugado de: MC 320′ · MCD 140′");
  });

  it("each code carries its full name for assistive tech and on hover", () => {
    render(<PlayedEvidence pos={pos([line("MCD", 140)])} />);
    expect(screen.getByTitle("Pivote")).toHaveTextContent("MCD");
  });

  it("at most four positions", () => {
    expect(evidenceText(pos([line("MC", 300), line("MCD", 200), line("DFC", 100), line("MI", 50), line("DC", 10)]))).toBe("Ha jugado de: MC 300′ · MCD 200′ · DFC 100′ · MI 50′");
  });

  it("without minutes at a position: «Sin minutos con posición» (no «0′»)", () => {
    expect(evidenceText(pos([]))).toBe("Sin minutos con posición");
    expect(evidenceText(undefined)).toBe("Sin minutos con posición");
    const { container } = render(<PlayedEvidence pos={pos([])} />);
    expect(container).toHaveTextContent("Sin minutos con posición");
    expect(container).not.toHaveTextContent("0′");
  });

  it("estimated minutes are said in words", () => {
    render(<PlayedEvidence pos={pos([line("MC", 60)], 2)} />);
    expect(screen.getByText(/estimados por su posición preferida/i)).toBeInTheDocument();
  });
});
