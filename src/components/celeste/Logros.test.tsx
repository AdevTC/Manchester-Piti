import { act, cleanup, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Achievement } from "../../lib/derived/achievements";
import { Logros } from "./Logros";
import { groupLogros, medalDay, progressText, progressWords } from "./logrosView";

// «Logros»: the earned crests with their tier in words and the match they were won in, «Lo próximo» with
// «7 / 10», the rest folded; and a pure render (the host's `now`, Madrid dates) the SSR can hydrate.
// The router's Link is stubbed to the href it would build; the medals are fixtures of the model's contract.

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, to = "", params = {} }: { children?: ReactNode; className?: string; to?: string; params?: Record<string, string> }) => (
    <a className={className} href={to.replace(/\$(\w+)/g, (_, k: string) => params[k] ?? "")}>
      {children}
    </a>
  ),
}));

const NOW = Date.UTC(2026, 9, 16, 10);
const medal = (o: Partial<Achievement> & Pick<Achievement, "id" | "family" | "label">): Achievement => ({ tier: 0, detail: "", earned: false, ...o });
const LIST: Achievement[] = [
  medal({ id: "debut", family: "debut", label: "Debut", earned: true, detail: "Su primer partido", at: { matchId: "m1", date: Date.UTC(2025, 4, 3, 17), rival: "Atlético Bajo" } }),
  medal({ id: "hattrick", family: "hattrick", label: "Hat-trick", earned: true, detail: "3 goles en un partido", at: { matchId: "m9", date: Date.UTC(2026, 9, 12, 18), rival: "Rayo" } }),
  medal({ id: "partidos-1", family: "partidos", tier: 1, label: "10 partidos", earned: true, detail: "10 partidos jugados", at: { matchId: "m5", date: Date.UTC(2026, 8, 20, 18), rival: "MAD SKY" }, progress: { now: 14, goal: 10 } }),
  medal({ id: "goles-2", family: "goles", tier: 2, label: "10 goles", detail: "Marca 10 goles", progress: { now: 7, goal: 10 } }),
  medal({ id: "asistencias-1", family: "asistencias", tier: 1, label: "3 asistencias", detail: "Da 3 pases de gol", progress: { now: 2, goal: 3 } }),
  medal({ id: "mvp-3", family: "mvp", tier: 3, label: "MVP ×5", detail: "Gana 5 votaciones", progress: { now: 1, goal: 5 } }),
  medal({ id: "comodin", family: "comodin", label: "Comodín", detail: "Juega en 4 posiciones", progress: { now: 1, goal: 4 } }),
  medal({ id: "cero", family: "cero", label: "Portería a cero", detail: "Gana sin encajar" }),
];
const NEXT = LIST.filter((a) => ["goles-2", "asistencias-1", "mvp-3"].includes(a.id));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("groupLogros", () => {
  it("separa lo ganado (lo último primero), lo próximo y el resto", () => {
    const g = groupLogros(LIST, NEXT);
    expect(g.earned.map((a) => a.id)).toEqual(["hattrick", "partidos-1", "debut"]);
    expect(g.next.map((a) => a.id)).toEqual(["goles-2", "asistencias-1", "mvp-3"]);
    expect(g.rest.map((a) => a.id)).toEqual(["comodin", "cero"]);
  });
});

describe("textos", () => {
  it("la fecha en Madrid, con el año solo si no es el de ahora", () => {
    expect(medalDay(Date.UTC(2026, 9, 12, 18), NOW)).toBe("12 oct");
    expect(medalDay(Date.UTC(2025, 4, 3, 17), NOW)).toBe("3 may 2025");
    // 23:30 in Madrid on the 31st is still the 31st (UTC already says 1 nov)
    expect(medalDay(Date.UTC(2026, 9, 31, 22, 30), NOW)).toBe("31 oct");
  });
  it("el progreso en palabras, sin pasarse de la meta", () => {
    expect(progressText({ now: 7, goal: 10 })).toBe("7 / 10");
    expect(progressText({ now: 14, goal: 10 })).toBe("10 / 10");
    // minutes with seconds: whole ones, and 999.6 never reads 1000
    expect(progressText({ now: 523.45, goal: 1000 })).toBe("523 / 1000");
    expect(progressText({ now: 999.6, goal: 1000 })).toBe("999 / 1000");
    expect(progressWords({ now: 999.6, goal: 1000 })).toBe("999 de 1000");
  });
});

describe("Logros", () => {
  it("cada medalla ganada lleva su nivel en palabras y enlaza al partido en que se ganó", () => {
    render(<Logros list={LIST} next={NEXT} now={NOW} />);
    const won = screen.getByRole("list", { name: "Sus logros" });
    const items = within(won).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Hat-trick");
    const hat = within(items[0]).getByRole("link", { name: "12 oct · vs Rayo" });
    expect(hat).toHaveAttribute("href", "/matches/m9");
    expect(items[1]).toHaveTextContent("10 partidosBronce");
    expect(within(items[1]).getByRole("link")).toHaveAttribute("href", "/matches/m5");
    expect(within(items[2]).getByRole("link", { name: "3 may 2025 · vs Atlético Bajo" })).toHaveAttribute("href", "/matches/m1");
    expect(screen.getByText("de 8 logros", { exact: false })).toHaveTextContent("3 de 8 logros");
  });

  it("«Lo próximo»: las tres que toca perseguir, con barra y «7 / 10» en texto", () => {
    render(<Logros list={LIST} next={NEXT} now={NOW} />);
    const next = screen.getByRole("region", { name: "Lo próximo" });
    const rows = within(next).getAllByRole("listitem");
    expect(rows.map((r) => r.querySelector("b")?.textContent)).toEqual(["10 goles", "3 asistencias", "MVP ×5"]);
    expect(rows[0]).toHaveTextContent("Plata");
    expect(rows[0]).toHaveTextContent("7 / 10");
    expect(rows[2]).toHaveTextContent("Oro");
    expect(rows[2]).toHaveTextContent("1 / 5");
    expect(rows[0].querySelector(".lg-bar i")).toHaveStyle({ width: "70%" });
  });

  it("lo próximo se lee en palabras sin repetir el detalle, y su título sigue al del bloque", () => {
    const { rerender } = render(<Logros list={LIST} next={NEXT} now={NOW} />);
    const next = screen.getByRole("region", { name: "Lo próximo" });
    expect(next).toHaveTextContent("7 de 10");
    expect(next).not.toHaveTextContent("Marca 10 goles");
    expect(within(next).getByRole("heading", { level: 3, name: "Lo próximo" })).toBeInTheDocument();
    rerender(<Logros list={LIST} next={NEXT} now={NOW} headingLevel={4} />);
    expect(within(screen.getByRole("region", { name: "Lo próximo" })).getByRole("heading", { level: 4, name: "Lo próximo" })).toBeInTheDocument();
  });

  it("el resto, plegado en «Todos los logros»", () => {
    const { container } = render(<Logros list={LIST} next={NEXT} now={NOW} />);
    const all = container.querySelector("details.lg-all") as HTMLDetailsElement;
    expect(all.open).toBe(false);
    expect(within(all).getByText("Todos los logros")).toBeInTheDocument();
    expect(all).toHaveTextContent("2 por conseguir");
    expect(all).toHaveTextContent("Comodín");
    expect(all).toHaveTextContent("1 / 4");
    expect(all).toHaveTextContent("Gana sin encajar");
  });

  it("sin ninguna ganada lo dice, en tercera o en segunda persona", () => {
    const none = LIST.map((a) => ({ ...a, earned: false, at: undefined }));
    const { rerender } = render(<Logros list={none} next={[]} now={NOW} />);
    expect(screen.getByText("Aún no ha ganado ninguno.")).toBeInTheDocument();
    rerender(<Logros list={none} next={[]} now={NOW} self />);
    expect(screen.getByText(/Aún no has ganado ninguno/)).toBeInTheDocument();
  });

  it("se pinta en el servidor sin mirar el reloj y el cliente lo hidrata igual", async () => {
    const clock = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Date.now() en el render");
    });
    const html = renderToString(<Logros list={LIST} next={NEXT} now={NOW} />);
    expect(html).toContain("12 oct · vs Rayo");
    expect(clock).not.toHaveBeenCalled();
    clock.mockRestore();
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.append(host);
    const errors: unknown[] = [];
    const root = await act(async () => hydrateRoot(host, <Logros list={LIST} next={NEXT} now={NOW} />, { onRecoverableError: (e) => errors.push(e) }));
    expect(errors).toEqual([]);
    act(() => root.unmount());
    host.remove();
  });
});
