import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TablerosPanel, type TablerosProps } from "./Tableros";

// Tableros → Oficial: «Quitar el oficial» asks, then waits a few seconds with a «Deshacer» (leaving the
// panel sends it at once); admins see who has doubts.

const props = (o: Partial<TablerosProps> = {}): TablerosProps => ({
  tab: "o",
  onTab: vi.fn(),
  onBack: vi.fn(),
  ready: true,
  id: "b1",
  name: "Oficial J8",
  ro: false,
  saveTxt: "Guardado",
  saveCls: "",
  seasonName: "Temporada 1",
  boards: [],
  canDelete: false,
  onRename: vi.fn(async () => {}),
  onDuplicate: vi.fn(),
  onNew: vi.fn(),
  onOpen: vi.fn(),
  onCopy: vi.fn(),
  onDelete: vi.fn(),
  pending: [],
  official: { id: "b1", name: "Oficial J8", by: "Por @capi · este partido", viewing: true },
  reactions: { enabled: true, ok: 3, dudas: 2, mine: null },
  isCap: true,
  scopeMatch: null,
  onScreenOfficial: { matchId: null },
  canPublish: true,
  pubBlock: null,
  pubWarn: [],
  onViewOfficial: vi.fn(),
  onDupOfficial: vi.fn(),
  onReact: vi.fn(),
  onPublish: vi.fn(async () => {}),
  onUnpublish: vi.fn(),
  calendar: [],
  matchId: null,
  onLink: vi.fn(),
  seasons: [],
  seasonId: "t1",
  onSeason: vi.fn(),
  ...o,
});

const quitar = () => {
  fireEvent.click(screen.getByRole("button", { name: "Quitar el oficial" }));
  fireEvent.click(within(screen.getByRole("group", { name: "¿Quitar el oficial?" })).getByRole("button", { name: "Quitarlo" }));
};

describe("Tableros · Quitar el oficial", () => {
  it("waits with a «Deshacer», then goes through", () => {
    vi.useFakeTimers();
    const onUnpublish = vi.fn();
    render(<TablerosPanel {...props({ onUnpublish })} />);
    quitar();
    expect(screen.getByRole("status")).toHaveTextContent("«Oficial J8» deja de ser el oficial en unos segundos.");
    vi.advanceTimersByTime(5999);
    expect(onUnpublish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer: «Oficial J8» sigue de oficial" }));
    vi.advanceTimersByTime(10000);
    expect(onUnpublish).not.toHaveBeenCalled();
    quitar();
    vi.advanceTimersByTime(6000);
    expect(onUnpublish).toHaveBeenCalledWith("b1");
    vi.useRealTimers();
  });

  it("leaving the panel sends it at once (it was confirmed)", () => {
    const onUnpublish = vi.fn();
    const { unmount } = render(<TablerosPanel {...props({ onUnpublish })} />);
    quitar();
    unmount();
    expect(onUnpublish).toHaveBeenCalledTimes(1);
  });
});

describe("Tableros · reactions", () => {
  it("admins see who has doubts; everyone else only the counts", () => {
    const { rerender } = render(<TablerosPanel {...props({ reactions: { enabled: true, ok: 3, dudas: 2, mine: null, who: ["@alba", "@zeta"] } })} />);
    expect(screen.getByText("@alba, @zeta")).toBeInTheDocument();
    rerender(<TablerosPanel {...props()} />);
    expect(screen.queryByText(/Con dudas:/)).toBeNull();
    expect(screen.getByRole("button", { name: /Con dudas 2/ })).toBeInTheDocument();
  });
});
