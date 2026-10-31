import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PositionsInfo } from "../../profileData";
import { buildMe } from "../me";
import { Juego } from "./Juego";
import { info, input, NOW, PLAYED } from "./juego/fixture";
import type { PlaceProps } from "./types";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, search, className }: { children: ReactNode; to: string; search?: Record<string, string>; className?: string }) => (
    <a className={className} href={`${to}${search ? `?${new URLSearchParams(search).toString()}` : ""}`}>
      {children}
    </a>
  ),
}));

const me = buildMe(input);
function props(positions: PositionsInfo | null, over: Partial<PlaceProps> = {}) {
  const proposePositions = vi.fn(() => Promise.resolve());
  const say = vi.fn();
  const p = {
    data: {
      positions,
      played: PLAYED,
      card: { posLong: "Lateral derecho" },
      seasonId: "t1",
      seasonName: "Temporada 1",
      ficha: { playerId: "jordi" },
      raw: { matches: input.matches, players: input.players, seasons: input.seasons, mvpResults: input.mvpResults, standings: input.standings },
    },
    me,
    now: NOW,
    say,
    actions: { proposePositions },
    ...over,
  } as unknown as PlaceProps;
  return { p, proposePositions, say };
}

describe("Tu juego", () => {
  it("draws the pitch, the proposal, the ladders and the partner from his data", () => {
    render(<Juego {...props(info()).p} />);
    expect(screen.getByRole("heading", { name: "De lateral derecho, y donde haga falta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lateral derecho, tu preferida, has jugado 40 minutos. Toca para cambiar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Las de tu ficha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar al capitán" })).toBeDisabled();
    expect(screen.getByText("Lateral derecho: 40′.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Goles: aún a cero" })).toBeInTheDocument();
    expect(screen.getByText("Aún a cero, como 2 más · lidera Alcides, 1")).toBeInTheDocument();
    expect(screen.getByText("Alcides")).toBeInTheDocument();
  });

  it("a tap makes a draft, «Enviar al capitán» sends it with «Deshacer»", async () => {
    const { p, proposePositions, say } = props(info());
    render(<Juego {...p} />);
    fireEvent.click(screen.getByRole("button", { name: /^Punta, sin marcar/ }));
    expect(screen.getByRole("heading", { name: "Cambios sin enviar" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enviar al capitán" }));
    });
    expect(proposePositions).toHaveBeenCalledWith({ main: "LD", also: ["LI", "DC"] });
    expect(say).toHaveBeenCalledWith("Propuesta enviada al capitán.", expect.any(Function));
  });

  it("pending: «Retirar la propuesta»; answered: «Ahora en tu ficha»; out of season: read-only", async () => {
    const pend = props(info({ state: "pendiente", proposal: { main: "MD", also: [] } }));
    const { unmount } = render(<Juego {...pend.p} />);
    expect(screen.getByRole("heading", { name: "Enviada: pendiente de que el capitán la vea" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retirar la propuesta" }));
    });
    expect(pend.proposePositions).toHaveBeenCalledWith(null);
    expect(pend.say).toHaveBeenCalledWith("Propuesta retirada.", expect.any(Function));
    unmount();

    const adj = render(<Juego {...props(info({ state: "ajustada" })).p} />);
    expect(screen.getByText("Ahora en tu ficha: Lateral derecho ★, Lateral izquierdo.")).toBeInTheDocument();
    adj.unmount();

    const out = props(info({ inSeason: false }));
    render(<Juego {...out.p} />);
    expect(screen.queryByRole("button", { name: "Enviar al capitán" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Punta/ }));
    expect(screen.getByRole("heading", { name: "Tu ficha no está en esta temporada" })).toBeInTheDocument();
  });

  it("«Compararte con…»: pick a teammate, three numbers side by side, the cara a cara with both", () => {
    render(<Juego {...props(info()).p} />);
    fireEvent.click(screen.getByRole("button", { name: "Elegir compañero" }));
    const dialog = screen.getByRole("dialog", { name: "Compararte con…" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Kevin/ }));
    const sheet = screen.getByRole("dialog", { name: "Tú y Kevin" });
    expect(within(sheet).getByText("Kevin, por 2")).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: "Abrir el cara a cara" })).toHaveAttribute("href", "/plantilla/cara-a-cara?a=jordi&b=kevin");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elegir compañero" })).toHaveFocus();
  });
});
