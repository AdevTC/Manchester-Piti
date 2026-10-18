import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { frontRowOf } from "../../../lib/derived/frontRow";
import { PrimeraFila } from "./PrimeraFila";
import { ANSWERS, BASE, meOf, scene, SEVEN, SQUAD } from "./primeraFila.fixtures";

// «La primera fila» in every mode and for each viewer, from the design's match night built through frontRowOf.
// The writes and the router are stubbed: no Firebase, no network.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to, hash }: { children?: ReactNode; className?: string; to: string; hash?: string }) => (
    <a className={className} href={`${to}${hash ? `#${hash}` : ""}`}>
      {children}
    </a>
  ),
}));
const writes = vi.hoisted(() => ({ setAvailability: vi.fn(async () => undefined), voteMvp: vi.fn(async () => undefined) }));
vi.mock("../../../pages/vestuario/writes", () => writes);

beforeEach(() => {
  writes.setAvailability.mockReset().mockResolvedValue(undefined);
  writes.voteMvp.mockReset().mockResolvedValue(undefined);
});

const seat = (name: string) => screen.getAllByRole("listitem").find((li) => li.getAttribute("aria-label")?.startsWith(`${name}, dorsal`));
const seatLabel = (name: string) => seat(name)?.getAttribute("aria-label") ?? "";
const seatLabels = () => screen.getAllByRole("listitem").map((li) => li.getAttribute("aria-label") ?? "").filter((l) => l.includes(", dorsal "));
const ANSWER_WORDS = /: (viene|en duda|no va|sin contestar|de baja)\b/;

describe("each mode", () => {
  it("plantilla: every seat folded, the member's seat «tú»", () => {
    render(<PrimeraFila {...scene("pretemporada")} />);
    expect(screen.getByRole("heading", { name: "La primera fila, plegada" })).toBeInTheDocument();
    expect(seatLabels()).toHaveLength(16);
    expect(seatLabels().every((l) => l.includes("asiento plegado"))).toBe(true);
    expect(seatLabel("Jordi")).toMatch(/\(tú\)$/);
    expect(screen.getByText("Tu asiento es el 28. En cuanto haya partido, lo bajas tú.")).toBeInTheDocument();
  });

  it("convocatoria for a member: answers, counts, the seven in gold, «anota», «de baja» and the cartulina", () => {
    render(<PrimeraFila {...scene("antes")} />);
    const counts = screen.getByRole("list", { name: "Respuestas de la plantilla" });
    expect(within(counts).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["✓Vienen 4 de 16", "–11 sin contestar", "B1 ausente"]);
    expect(seatLabel("Jordi")).toBe("Jordi, dorsal 28: viene, en el siete (tú)");
    expect(seatLabel("Erik")).toBe("Erik, dorsal 9: viene");
    expect(seatLabel("Evans")).toBe("Evans, dorsal 1: sin contestar, en el siete");
    expect(seatLabel("Andia")).toContain("de baja");
    expect(seatLabel("Huberoski")).toContain("anota el partido");
    expect(seat("Jordi")).toHaveClass("pf-seat", "up", "gold", "me");
    expect(screen.getByText("Levanta tu cartulina")).toBeInTheDocument();
    expect(screen.getByText("Tu asiento es el 28. Sales de titular, de lateral derecho.")).toBeInTheDocument();
    for (const name of ["Voy", "Duda", "No voy"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voy" })).toHaveAttribute("aria-pressed", "true");
  });

  it("an absent member: «de baja» and «Quitar la ausencia», no controls", () => {
    render(<PrimeraFila {...scene("antes", { viewer: "ausente" })} />);
    expect(seatLabel("Andia")).toBe("Andia, dorsal 19: de baja (tú)");
    expect(screen.getByRole("link", { name: "Quitar la ausencia" })).toHaveAttribute("href", "/vestuario#vx-ausencias");
    expect(screen.queryByRole("button", { name: "Voy" })).toBeNull();
  });

  it("the anotador's seat stays folded with «anota»; he gets a note, not the controls", () => {
    render(<PrimeraFila {...scene("antes", { viewer: "anotador" })} />);
    expect(seat("Huberoski")).toHaveClass("fold");
    expect(within(seat("Huberoski")!).getByText("anota")).toBeInTheDocument();
    expect(screen.getByText(/porque llevas la mesa/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voy" })).toBeNull();
  });

  it("the week: «¿Vienes el domingo?»", () => {
    render(<PrimeraFila {...scene("semana")} />);
    expect(screen.getByRole("heading", { name: "La primera fila del domingo" })).toBeInTheDocument();
    expect(screen.getByText("¿Vienes el domingo?")).toBeInTheDocument();
  });

  it("aplazado: the tape and the note", () => {
    const { container } = render(<PrimeraFila {...scene("aplazado")} />);
    expect(screen.getByRole("heading", { name: "Aplazado" })).toBeInTheDocument();
    expect(container.querySelector(".pf-tape")).not.toBeNull();
    expect(container.querySelector(".pf-root")).toHaveClass("pf-l-nublado");
  });

  it("banquillo: who came on, who went off, the bench and the viewer's line", () => {
    render(<PrimeraFila {...scene("directo2", { viewer: "suplente" })} />);
    expect(screen.getByRole("heading", { name: "El banquillo" })).toBeInTheDocument();
    expect(screen.getByText("Minuto 50, añadido +2, 3–1. Han entrado Erik y Kevin.")).toBeInTheDocument();
    expect(seatLabel("Erik")).toBe("Erik, dorsal 9: entró en el 30 (tú)");
    expect(seatLabel("Illescas")).toBe("Illescas, dorsal 4: salió en el 30, en el siete");
    expect(seatLabel("Kevin")).toBe("Kevin, dorsal 11: entró en el 35, gol en el 44");
    expect(seatLabel("Eguzquiza")).toContain("amarilla en el 15");
    expect(seat("Illescas")).toHaveClass("low");
    expect(within(seat("Kevin")!).getByText("↑35′")).toBeInTheDocument();
    expect(within(seat("Illescas")!).getByText("↓30′")).toBeInTheDocument();
    const plays = screen.getByRole("list", { name: "Lo último del banquillo" });
    expect(within(plays).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["35′Entra Kevin por Eguzquiza", "30′Entra Erik por Illescas"]);
    expect(screen.getByText("Entraste en el 30′.")).toBeInTheDocument();
  });

  it("a red card leaves an empty seat", () => {
    render(<PrimeraFila {...scene("directo2", { variant: "roja", viewer: "aficionado" })} />);
    expect(seat("Fer")).toHaveClass("empty");
    expect(seatLabel("Fer")).toContain("expulsado");
    expect(within(seat("Fer")!).getByText("R 40′")).toBeInTheDocument();
    expect(screen.getByText(/Roja a Fer: su asiento se queda vacío\./)).toBeInTheDocument();
  });

  it("a knock: «+» at its minute on the bench", () => {
    render(<PrimeraFila {...scene("directo1", { variant: "lesion", viewer: "aficionado" })} />);
    expect(within(seat("Illescas")!).getByText("+ 20′")).toBeInTheDocument();
    expect(seatLabel("Illescas")).toContain("salió en el 20");
  });

  it("jugaron: minutes, goals and logros; the MVP in gold once the vote has closed", () => {
    render(<PrimeraFila {...scene("despues")} />);
    expect(seatLabel("Alcides")).toMatch(/^Alcides, dorsal 7: jugó 50 minutos, 1 gol, mejor del partido, logros /);
    expect(seat("Alcides")).toHaveClass("mvp");
    expect(seatLabel("Jorge")).toBe("Jorge, dorsal 30: no llegó a jugar");
    expect(seatLabel("Josito")).toBe("Josito, dorsal 8: no convocado");
    expect(screen.getByText(/^Alcides, mejor del partido\. Siguiente: el domingo, contra Pitutis, fuera\.$/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Votar a/ })).toBeNull();
  });

  it("final: provisional minutes, no logros yet", () => {
    render(<PrimeraFila {...scene("final")} />);
    expect(seatLabel("Illescas")).toBe("Illescas, dorsal 4: jugó 29 minutos");
    expect(screen.getByText("Los logros y la votación del mejor llegan con el acta.")).toBeInTheDocument();
  });
});

describe("fans", () => {
  it("never see answers or counts, in any phase", () => {
    for (const phase of ["semana", "antes", "aplazado", "directo1", "acta"] as const) {
      const { unmount } = render(<PrimeraFila {...scene(phase, { viewer: "aficionado" })} />);
      expect(screen.queryByRole("list", { name: "Respuestas de la plantilla" })).toBeNull();
      expect(seatLabels().some((l) => ANSWER_WORDS.test(l))).toBe(false);
      expect(screen.queryByRole("button", { name: "Voy" })).toBeNull();
      expect(screen.queryByRole("button", { name: /^Votar a/ })).toBeNull();
      unmount();
    }
  });

  it("see the convocados and the seven, and the way into the vestuario", () => {
    render(<PrimeraFila {...scene("antes", { viewer: "aficionado" })} />);
    expect(screen.getByRole("heading", { name: "Los convocados de hoy" })).toBeInTheDocument();
    expect(screen.getByText("Once convocados: los siete del borde dorado salen; cuatro esperan en el banquillo.")).toBeInTheDocument();
    expect(seatLabel("Evans")).toBe("Evans, dorsal 1: convocado, en el siete");
    expect(seatLabel("Erik")).toBe("Erik, dorsal 9: convocado");
    expect(seatLabel("Andia")).toBe("Andia, dorsal 19: no convocado");
    expect(screen.getByRole("link", { name: "¿Juegas en el Piti? Entra al vestuario" })).toHaveAttribute("href", "/vestuario");
  });
});

describe("the member's answer", () => {
  it("writes, optimistically: the seat, the counts and the pressed button move at once", async () => {
    const props = scene("antes", { viewer: "suplente", answers: [{ playerId: "adrian", response: "yes" }] });
    render(<PrimeraFila {...props} />);
    expect(screen.getByRole("button", { name: "Duda" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Duda" }));
    expect(writes.setAvailability).toHaveBeenCalledWith(meOf("suplente"), "j1", "maybe");
    expect(screen.getByRole("button", { name: "Duda" })).toHaveAttribute("aria-pressed", "true");
    expect(seatLabel("Erik")).toBe("Erik, dorsal 9: en duda (tú)");
    expect(screen.getByText("1 en duda")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Cartulina a medias: estás en duda.");
    await act(async () => undefined);
  });

  it("rolls back with a message when the write is refused", async () => {
    writes.setAvailability.mockRejectedValueOnce(new Error("permission-denied"));
    render(<PrimeraFila {...scene("antes", { viewer: "suplente", answers: [] })} />);
    fireEvent.click(screen.getByRole("button", { name: "No voy" }));
    expect(screen.getByRole("button", { name: "No voy" })).toHaveAttribute("aria-pressed", "true");
    await act(async () => undefined);
    expect(screen.getByRole("button", { name: "No voy" })).toHaveAttribute("aria-pressed", "false");
    expect(seatLabel("Erik")).toBe("Erik, dorsal 9: sin contestar (tú)");
    expect(screen.getAllByText("No se ha guardado tu respuesta. Vuelve a intentarlo.")).toHaveLength(2); // the note and the live region
  });

  it("pressing the answer he already has writes nothing", () => {
    render(<PrimeraFila {...scene("antes")} />);
    fireEvent.click(screen.getByRole("button", { name: "Voy" }));
    expect(writes.setAvailability).not.toHaveBeenCalled();
  });

  it("someone else's answer arriving is said once, politely", () => {
    const props = scene("antes");
    const { rerender } = render(<PrimeraFila {...props} />);
    const answers = [...ANSWERS, { playerId: "kevin", response: "yes" as const }];
    const row = frontRowOf({ match: props.day.match, phase: "antes", squad: SQUAD, seven: SEVEN, answers, absentIds: ["andia"], viewerPlayerId: "jordi", scorerIds: ["huberoski"], mvpVoteOpen: false, now: props.now });
    rerender(<PrimeraFila {...props} row={row} />);
    expect(screen.getByRole("status")).toHaveTextContent(/^Kevin viene\.$/);
    expect(seat("Kevin")).toHaveClass("pop");
    rerender(<PrimeraFila {...props} row={{ ...row }} />);
    expect(screen.getByRole("status")).toHaveTextContent(/^Kevin viene\.$/);
  });

  it("no controls once the convocatoria has closed", () => {
    const props = scene("antes");
    render(<PrimeraFila {...props} now={Number(BASE.date && (BASE.date as { seconds: number }).seconds) * 1000 + 60_000} />);
    expect(screen.queryByRole("button", { name: "Voy" })).toBeNull();
    expect(screen.getByText("La convocatoria se cerró a la hora del partido.")).toBeInTheDocument();
  });
});

describe("the MVP vote", () => {
  it("a member taps a seat to vote, sees no tally, and can change it", () => {
    const props = scene("acta");
    const { rerender } = render(<PrimeraFila {...props} />);
    const buttons = screen.getAllByRole("button", { name: /^Votar a .* como mejor del partido$/ });
    expect(buttons).toHaveLength(9);
    expect(screen.getByText("Vota al mejor del partido")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ votos?/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Votar a Alcides como mejor del partido" }));
    expect(writes.voteMvp).toHaveBeenCalledWith(meOf("titular"), "j1", "alcides");
    expect(screen.getByRole("button", { name: "Votar a Alcides como mejor del partido" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Tu voto: Alcides, el 7")).toBeInTheDocument();

    // the listener brings it back; then he changes his mind
    rerender(<PrimeraFila {...props} myVote="alcides" />);
    fireEvent.click(screen.getByRole("button", { name: "Votar a Kevin como mejor del partido" }));
    expect(writes.voteMvp).toHaveBeenLastCalledWith(meOf("titular"), "j1", "kevin");
    expect(screen.getByRole("button", { name: "Votar a Kevin como mejor del partido" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Votar a Alcides como mejor del partido" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Tu voto, para Kevin.");
  });

  it("only who played can be voted", () => {
    render(<PrimeraFila {...scene("acta")} />);
    expect(screen.queryByRole("button", { name: "Votar a Jorge como mejor del partido" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Votar a Josito como mejor del partido" })).toBeNull();
  });

  it("a refused vote goes back to the one he had", async () => {
    writes.voteMvp.mockRejectedValueOnce(new Error("closed"));
    render(<PrimeraFila {...scene("acta", { myVote: "evans" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Votar a Kevin como mejor del partido" }));
    await act(async () => undefined);
    expect(screen.getByRole("button", { name: "Votar a Evans como mejor del partido" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("No se ha guardado tu voto. Vuelve a intentarlo.")).toHaveLength(2);
  });
});

describe("states and motion", () => {
  it("loading: a skeleton where the controls go, no answers", () => {
    render(<PrimeraFila {...scene("antes", { status: "loading" })} />);
    expect(screen.getByText("Comprobando quién eres para enseñarte tu asiento…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voy" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Respuestas de la plantilla" })).toBeNull();
  });

  it("first paint with the public row: the convocados, no note or link yet", () => {
    render(<PrimeraFila {...scene("antes", { viewer: "aficionado", status: "loading" })} />);
    expect(seatLabel("Evans")).toBe("Evans, dorsal 1: convocado, en el siete");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("error: «Reintentar» calls back", () => {
    const onRetry = vi.fn();
    render(<PrimeraFila {...scene("antes", { status: "error" })} onRetry={onRetry} />);
    expect(screen.getByText("No ha llegado la convocatoria.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("offline: how long since the last update", () => {
    render(<PrimeraFila {...scene("directo1", { status: "offline" })} />);
    expect(screen.getByText("Sin actualizar desde hace 2 min.")).toBeInTheDocument();
    expect(screen.getByText(/El banquillo puede ir con retraso\./)).toBeInTheDocument();
  });

  it("reduced motion: the root opts out of every animation (only opacity moves)", () => {
    const { container } = render(<PrimeraFila {...scene("antes")} reduced />);
    expect(container.querySelector(".pf-root")).toHaveClass("pf-rm");
  });

  it("the clac is opt-in and remembered", () => {
    localStorage.removeItem("piti-fila-clac");
    const { unmount } = render(<PrimeraFila {...scene("antes")} />);
    const toggle = screen.getByRole("button", { name: /clac/ });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    unmount();
    render(<PrimeraFila {...scene("antes")} />);
    expect(screen.getByRole("button", { name: /clac/ })).toHaveAttribute("aria-pressed", "true");
    localStorage.removeItem("piti-fila-clac");
  });

  it("the light of the hour and the page's theme are classes, not inline colours", () => {
    const { container } = render(<PrimeraFila {...scene("antes", { light: "noche" })} />);
    expect(container.querySelector(".pf-root")).toHaveClass("pf-l-focos", "pf-m-convocatoria");
  });
});
