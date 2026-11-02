// r14 «La pizarra» · Siete: the regions and the sheets against the fake store (no Firebase, no router).
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderWithPz, makeTestStore, fakeBoard, fakeWorld, ME_CAPTAIN, ME_PLAYER } from "../../store/testkit";
import { Siete } from "./Siete";
import { DesdeSheet, GalonesSheet } from "./SieteSheets";
import { PublicarSheet } from "../../sheets/publicar/Publicar";
import { CandidatosSheet } from "../../sheets/candidatos/Candidatos";
import { MoverSheet } from "../../sheets/mover/Mover";
import { SistemaSheet } from "../../sheets/sistema/Sistema";
import { FichaSheet } from "../../sheets/ficha/Ficha";
import { benchGroups, countChips, publishCheck, verLine, ringOff, galRows } from "./sieteView";

const guess = vi.hoisted(() => ({ current: null as null | { uid: string; slots: string[]; at: number | null }, save: vi.fn(async () => undefined) }));
vi.mock("../../../data/guesses", () => ({
  useMyGuess: () => ({ guess: guess.current, loading: false }),
  saveGuess: guess.save,
  guessHits: (g: string[], off: (string | null)[]) => ({ hits: g.filter((x) => off.includes(x)).length, exact: g.filter((x, i) => off[i] === x).length }),
  guessLine: (h: { hits: number; exact: number }) => `Acertaste ${h.hits} de 7`,
}));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children, className }: { children: ReactNode; className?: string }) => <a className={className}>{children}</a> }));

const FULL = ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"];

describe("Siete · lead", () => {
  it("says the state: 6 of 7, what is missing, and offers Sugerir / Empezar desde…", () => {
    renderWithPz(<Siete region="lead" layout="desktop" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^Te falta/);
    expect(screen.getByRole("img", { name: "6 de 7 en el campo" })).toBeTruthy();
    expect(screen.getByText("Faltan 1")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sugerir siete/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Empezar desde/ })).toBeTruthy();
    // a captain with a full seven may publish; with 6/7 not yet
    expect(screen.queryByRole("button", { name: /Publicar como oficial/ })).toBeNull();
  });

  it("the arrows change the system (undoable through the session)", async () => {
    const { host, flush } = renderWithPz(<Siete region="lead" layout="desktop" />);
    fireEvent.click(screen.getByRole("button", { name: "Sistema siguiente" }));
    await flush();
    expect(host.commit).toHaveBeenCalled();
  });

  it("creating «2ª parte» is a copy of the titular, and the line says what changes", async () => {
    const { P, flush } = renderWithPz(<Siete region="lead" layout="desktop" />);
    fireEvent.click(screen.getByRole("button", { name: /Crear la versión «2ª parte»/ }));
    await flush();
    expect(P.state.version).toBe("segunda");
    expect(screen.getByText(/^En el descanso: los mismos siete/)).toBeTruthy();
  });

  it("an official read by a player: read only, reactions first, «Duplicar para editar», no arrows", () => {
    const world = fakeWorld({ boards: [fakeBoard({ isOfficial: true, ids: FULL })], official: { boardId: "b1", matchId: "j3" } });
    renderWithPz(<Siete region="lead" layout="desktop" />, { world, me: ME_PLAYER });
    expect(screen.getByText(/Oficial · solo lectura/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "¿Qué te parece?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Duplicar para editar/ })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Sistema siguiente" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /Sugerir siete/ })).toBeNull();
  });

  it("«Adivina el siete»: a player bets the board's titular before the official (seven, keeper first)", async () => {
    guess.current = null;
    const world = fakeWorld({ boards: [fakeBoard({ ownerUid: "u-erik", ids: FULL })] });
    const { flush } = renderWithPz(<Siete region="lead" layout="desktop" />, { world, me: ME_PLAYER });
    fireEvent.click(screen.getByRole("button", { name: /Apostar con mi siete/ }));
    await flush();
    expect(guess.save).toHaveBeenCalledWith("j3", "u-erik", FULL);
  });

  it("after the official: «Acertaste N de 7»", () => {
    guess.current = { uid: "u-erik", slots: ["evans", "fer", "erik", "jordi", "adrian", "kevin", "josito"], at: 1 };
    const world = fakeWorld({ boards: [fakeBoard({ isOfficial: true, ids: FULL })], official: { boardId: "b1", matchId: "j3" } });
    renderWithPz(<Siete region="lead" layout="desktop" />, { world, me: ME_PLAYER });
    expect(screen.getByText("Acertaste 5 de 7")).toBeTruthy();
    guess.current = null;
  });

  it("the phone panel carries the layers", async () => {
    const { P, flush } = renderWithPz(<Siete region="panel" layout="phone" />);
    fireEvent.click(within(screen.getByRole("group", { name: "Capa del campo" })).getByRole("button", { name: "Química" }));
    await flush();
    expect(P.state.layer).toBe("quimica");
  });
});

describe("Siete · bench", () => {
  it("can play first (Voy before no answer), «No va» under «No pueden»; the filters work", async () => {
    const { P, flush } = renderWithPz(<Siete region="side" layout="desktop" />);
    const groups = screen.getAllByRole("list");
    expect(within(groups[0]).getAllByRole("button")[0].getAttribute("aria-label")).toMatch(/^KEVIN/);
    expect(screen.getByText("No pueden")).toBeTruthy();
    expect(within(groups[1]).getByRole("button").getAttribute("aria-label")).toMatch(/^JOSITO.*No se puede colocar/);
    fireEvent.click(screen.getByRole("button", { name: "Solo los que van" }));
    await flush();
    expect(P.state.bench.van).toBe(true);
    expect(screen.queryByText("No pueden")).toBeNull();
  });

  it("tapping a bench player then the hole places him (tap-tap)", async () => {
    const { P, host, flush } = renderWithPz(<Siete region="side" layout="desktop" />);
    fireEvent.click(screen.getByRole("button", { name: /^KEVIN/ }));
    await flush();
    expect(P.state.sel?.pid).toBe("kevin");
    P.act.tapSlot(6);
    await flush();
    expect(host.commit).toHaveBeenCalled();
    expect(P.sel.ver()?.slots[6].playerId).toBe("kevin");
  });

  it("the captain may copy a message for the ones who doubt or haven't answered (never a «No va»)", async () => {
    const write = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText: write } });
    const { flush } = renderWithPz(<Siete region="side" layout="desktop" />, { me: ME_CAPTAIN });
    fireEvent.click(screen.getByRole("button", { name: /Avisar a los que dudan · 7/ }));
    await flush();
    expect(write).toHaveBeenCalledTimes(1);
    const calls = write.mock.calls as unknown as string[][];
    expect(calls[0][0]).not.toMatch(/JOSITO/);
    expect(calls[0][0]).toMatch(/^J3 · Red Demons: .*¿venís\?/);
  });

  it("the phone peek: headline, the primary action and the strip", () => {
    renderWithPz(<Siete region="peek" layout="phone" />, { layout: "phone" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^Te falta/);
    expect(screen.getByRole("group", { name: /El banquillo/ })).toBeTruthy();
  });
});

describe("Siete · sheets", () => {
  it("Publicar renders without touching the store during render (no update loop) and blocks a 6/7 titular", () => {
    // regression: act.publishCheck is an action (it bumps the store); called in render it looped forever
    renderWithPz(<PublicarSheet />);
    expect(screen.getByRole("alert").textContent).toMatch(/Completa el titular para publicarlo \(6\/7\)/);
    expect((screen.getByRole("button", { name: /Publicar/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("B-PZ-02: publishing checks the TITULAR even while «2ª parte» is on screen", () => {
    const h = makeTestStore();
    h.P.act.setVersion("segunda");
    h.P.act.place("kevin", 6);
    expect(h.P.sel.status().full).toBe(true);
    expect(publishCheck(h.P).block).toMatch(/6\/7/);
  });

  it("Publicar with a full titular publishes with the convocatoria switch, then says it is done", async () => {
    const world = fakeWorld({ boards: [fakeBoard({ ids: FULL })] });
    const { host, flush } = renderWithPz(<PublicarSheet />, { world });
    fireEvent.click(screen.getByRole("button", { name: /La convocatoria de la J3/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Publicar$/ }));
    await flush();
    await flush();
    expect(host.publish).toHaveBeenCalledWith({ convocatoria: false });
    expect(screen.getByRole("status").textContent).toMatch(/Publicado · el oficial de la J3/);
  });

  it("Candidatos: the best first with its reasons; picking one places him", async () => {
    const { P, flush } = renderWithPz(<CandidatosSheet layout="desktop" args={{ hueco: 6 }} />);
    expect(screen.getByText("Mejor opción")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button")[0]);
    await flush();
    expect(P.sel.ver()?.slots[6].playerId).not.toBeNull();
  });

  it("Mover a: a taken slot swaps", async () => {
    const { P, flush } = renderWithPz(<MoverSheet layout="desktop" args={{ pid: "erik" }} />);
    const from = P.sel.ver()?.slots.findIndex((s) => s.playerId === "erik") ?? -1;
    const buttons = screen.getAllByRole("button");
    expect((buttons[from] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(buttons[0]);
    await flush();
    expect(P.sel.ver()?.slots[0].playerId).toBe("erik");
  });

  it("Sistema: 15 systems with their fit; picking one changes the system", async () => {
    const { P, flush } = renderWithPz(<SistemaSheet />);
    expect(screen.getAllByRole("button", { name: /de 7 en su sitio/ })).toHaveLength(15);
    fireEvent.click(screen.getByRole("button", { name: /^2-3-1 ·/ }));
    await flush();
    expect(P.sel.ver()?.formation).toBe("2-3-1");
  });

  it("Galones: the captain is one of the seven on the pitch", async () => {
    const { P, flush } = renderWithPz(<GalonesSheet layout="desktop" args={{ k: "C" }} />);
    fireEvent.click(screen.getByRole("button", { name: /ERIK/ }));
    await flush();
    expect(P.sel.board()?.lineup.roles.captainId).toBe("erik");
    expect(screen.queryByRole("button", { name: /KEVIN/ })).toBeNull();
  });

  it("Empezar desde…: with no played seven nor official, the sources say why", () => {
    renderWithPz(<DesdeSheet />);
    expect(screen.getByText("Aún no hay un siete jugado")).toBeTruthy();
    expect(screen.getByText("Aún no hay siete oficial")).toBeTruthy();
  });

  it("La ficha: La carta's number, his notas, his answer and the actions", () => {
    renderWithPz(<FichaSheet layout="desktop" args={{ pid: "kevin" }} />);
    expect(screen.getByRole("img", { name: /^La carta de KEVIN: 58/ })).toBeTruthy();
    expect(screen.getByText("6,4")).toBeTruthy();
    expect(screen.getByText(/^Va/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Mover a/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Quitar del siete/ })).toBeNull();
    expect(screen.getByText("Ver su página")).toBeTruthy();
  });
});

describe("sieteView", () => {
  it("nobody has answered → one chip that says so", () => {
    const h = makeTestStore({ world: fakeWorld({ rsvp: {} }) });
    expect(countChips(h.P)).toEqual([{ t: "Nadie ha respondido aún", n: null, tone: "mute", icon: "dots" }]);
  });
  it("the titular's line, the ring, the galones", () => {
    const h = makeTestStore();
    expect(verLine(h.P, h.P.sel.board(), h.P.sel.ver())).toMatch(/^El titular es el que se publica\. Crea/);
    expect(ringOff(7)).toBe("0");
    expect(ringOff(0)).toBe("213.6");
    expect(galRows(h.P, h.P.sel.board(), h.P.sel.ver(), false).map((g) => g.who)).toEqual(Array(5).fill("Sin asignar"));
  });
  it("the bench search ignores accents", () => {
    const h = makeTestStore({ world: fakeWorld({ boards: [fakeBoard({ ids: [] })] }) });
    h.P.act.setBench({ q: "adrian" });
    expect(benchGroups(h.P, h.P.sel.ver()).can).toEqual(["adrian"]);
  });
});
