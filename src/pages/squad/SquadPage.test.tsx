import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";

// /plantilla subscribes to mvpResults only while a ficha is open (the ficha's ratings by position need
// them; the percha doesn't), and the open ficha still gets its mvpOf. Data, season and the 3D are stubbed.

const mvp = vi.hoisted(() => ({ reads: 0 }));
const ficha = vi.hoisted(() => ({ mvpOf: undefined as unknown }));

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children?: ReactNode }) => <a>{children}</a> }));
vi.mock("../../lib/clubData", async (orig) => ({
  ...(await orig<typeof import("../../lib/clubData")>()),
  useClubData: () => ({ matches: [], players: [{ id: "erik", shirtName: "ERIK", number: 9, seasons: ["t1"] }], loading: false, error: null }),
}));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [{ id: "t1", name: "Temporada 1" }], selectedSeasonId: "t1", loadingSeasons: false }) }));
vi.mock("../vestuario/live", () => ({
  useMvpResults: () => {
    mvp.reads++;
    return new Map();
  },
}));
vi.mock("../../components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("../../components/celeste/Chrome", () => ({ CelesteBackdrop: () => null, CelesteDock: () => null, CelesteFooter: () => null, CelesteHeader: () => null }));
vi.mock("../../components/jersey3d/useShirtStills", () => ({ useShirtStills: () => () => undefined }));
vi.mock("./Percha", () => ({
  Percha: ({ rows, onOpen }: { rows: { id: string; name: string }[]; onOpen: (id: string) => void }) => (
    <div>
      {rows.map((r) => (
        <button key={r.id} type="button" onClick={() => onOpen(r.id)}>
          {r.name}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("./FichaModal", () => ({
  FichaModal: ({ mvpOf }: { mvpOf: unknown }) => {
    ficha.mvpOf = mvpOf;
    return <div role="dialog" aria-label="Ficha" />;
  },
}));
vi.mock("./CaraACara", () => ({ CaraACara: () => null }));
vi.mock("../home/Sections", () => ({ RaceAndBirthdays: () => null }));

const { SquadPage } = await import("./SquadPage");
// (the open/close transition asks for reduced motion; jsdom has no matchMedia)
window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);

it("no mvpResults until a ficha opens; the open ficha gets its mvpOf", () => {
  render(<SquadPage />);
  expect(mvp.reads).toBe(0);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "ERIK" }));
  expect(screen.getByRole("dialog", { name: "Ficha" })).toBeInTheDocument();
  expect(mvp.reads).toBeGreaterThan(0);
  expect(typeof ficha.mvpOf).toBe("function");
});
