import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Notice } from "../../lib/derived/notices";

// The bell and its panel: the session, the viewer, the three reads and the write are stubbed — no Firebase.
const state = vi.hoisted(() => ({
  viewer: { member: true, admin: false, playerId: "adri" as string | null },
  seenAt: null as unknown,
  notices: [] as Notice[],
  reads: [] as [string | undefined, boolean][],
  markNoticesSeen: vi.fn(async (_uid: string) => undefined),
  navigate: vi.fn(async (_o: { href: string }) => undefined),
}));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ navigate: state.navigate }) }));
vi.mock("../../hooks/useViewer", () => ({ useViewer: () => state.viewer }));
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "u1" }, profile: { nickname: "adri", role: "user", noticesSeenAt: state.seenAt } }),
}));
vi.mock("../../pages/vestuario/live", () => ({
  useNotices: (uid: string | undefined, admin: boolean) => (state.reads.push([uid, admin]), { data: state.notices, loading: false, error: false }),
}));
vi.mock("../../pages/vestuario/writes", () => ({ markNoticesSeen: state.markNoticesSeen }));

const { NoticesBell } = await import("./NoticesBell");
const { NoticesGate } = await import("./NoticesGate");
const { publishViewer } = await import("../../hooks/viewerSignal");

const HOUR = 3_600_000;
const now = Date.now();
const notice = (id: string, at: number, extra: Partial<Notice> = {}): Notice => ({
  id,
  topic: "lineup",
  title: `Aviso ${id}`,
  body: "Mira si te toca en la web.",
  url: `/matches/${id}`,
  at,
  audience: "team",
  ...extra,
});

beforeEach(() => {
  state.viewer = { member: true, admin: false, playerId: "adri" };
  state.seenAt = null;
  state.notices = [];
  state.reads = [];
  state.markNoticesSeen.mockClear();
  state.navigate.mockClear();
});

describe("NoticesGate", () => {
  it("shows the bell to a member", async () => {
    render(<NoticesGate />);
    expect(screen.queryByRole("button")).toBeNull();
    act(() => publishViewer(state.viewer));
    expect(await screen.findByRole("button", { name: "Avisos" })).toBeInTheDocument();
  });
  it("renders nothing for a fan and opens no read", async () => {
    state.viewer = { member: false, admin: false, playerId: null };
    publishViewer(state.viewer);
    const { container } = render(<NoticesGate />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    expect(state.reads).toEqual([]);
  });
});

describe("NoticesBell", () => {
  it("names the unread in words and shows the dot; without unread, plain «Avisos» and no dot", () => {
    state.seenAt = { toMillis: () => now - 2 * HOUR };
    state.notices = [notice("a", now - HOUR), notice("b", now - 3 * HOUR)];
    const { container, unmount } = render(<NoticesBell />);
    expect(screen.getByRole("button", { name: "Avisos, 1 sin leer" })).toBeInTheDocument();
    expect(container.querySelector(".nt-dot")).not.toBeNull();
    unmount();

    state.seenAt = { toMillis: () => now };
    const again = render(<NoticesBell />);
    expect(screen.getByRole("button", { name: "Avisos" })).toBeInTheDocument();
    expect(again.container.querySelector(".nt-dot")).toBeNull();
  });

  it("opens only the reads that apply: the captains' for an admin", () => {
    render(<NoticesBell />);
    expect(state.reads.at(-1)).toEqual(["u1", false]);
    state.viewer = { member: true, admin: true, playerId: null };
    render(<NoticesBell />);
    expect(state.reads.at(-1)).toEqual(["u1", true]);
  });

  it("opening the panel writes the look once, marks the new rows and clears the dot", () => {
    state.seenAt = { toMillis: () => now - 2 * HOUR };
    state.notices = [notice("a", now - HOUR), notice("b", now - 3 * HOUR)];
    render(<NoticesBell />);
    fireEvent.click(screen.getByRole("button", { name: "Avisos, 1 sin leer" }));
    expect(state.markNoticesSeen).toHaveBeenCalledTimes(1);
    expect(state.markNoticesSeen).toHaveBeenCalledWith("u1");

    const dialog = screen.getByRole("dialog", { name: "Avisos" });
    const rows = within(dialog).getAllByRole("link");
    expect(rows[0]).toHaveTextContent("Nuevo");
    expect(rows[0]).toHaveClass("is-new");
    expect(rows[1]).not.toHaveTextContent("Nuevo");
    expect(rows[0]).toHaveAttribute("href", "/matches/a");
    expect(screen.getByRole("button", { name: "Avisos" })).toHaveAttribute("aria-expanded", "true");

    // re-rendering the open panel writes nothing more
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar los avisos" }));
    expect(state.markNoticesSeen).toHaveBeenCalledTimes(1);
  });

  it("the panel is portalled to the body, outside the bell's wrapper (and so the header's stacking context)", () => {
    state.notices = [notice("a", now - HOUR)];
    const { container } = render(<NoticesBell />);
    fireEvent.click(screen.getByRole("button", { name: /^Avisos/ }));
    const dialog = screen.getByRole("dialog");
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.closest(".nt-portal")?.parentElement).toBe(document.body);
    // narrow page: the bottom sheet, with its scrim
    expect(dialog).toHaveClass("nt-panel-sheet");
    expect(document.querySelector(".nt-scrim")).not.toBeNull();
  });

  it("from 1100px of page width it is a fixed popover under the bell, without a scrim", () => {
    state.notices = [notice("a", now - HOUR)];
    const page = document.createElement("div");
    page.className = "vx";
    Object.defineProperty(page, "clientWidth", { value: 1280 });
    document.body.appendChild(page);
    render(<NoticesBell />, { container: page });
    const bell = screen.getByRole("button", { name: /^Avisos/ });
    vi.spyOn(bell, "getBoundingClientRect").mockReturnValue({ top: 20, bottom: 64, left: 1100, right: 1144, width: 44, height: 44, x: 1100, y: 20, toJSON: () => ({}) });
    fireEvent.click(bell);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("nt-panel-pop");
    expect(dialog.style.top).toBe("74px");
    expect(dialog.style.maxHeight).toMatch(/^calc\(.*100vh.*74px.*24px|^calc\(.*100vh.*24px.*74px/);
    expect(document.querySelector(".nt-scrim")).toBeNull();
    page.remove();
  });

  it("Esc closes the panel and gives focus back to the bell", () => {
    state.notices = [notice("a", now - HOUR)];
    render(<NoticesBell />);
    const bell = screen.getByRole("button", { name: /^Avisos/ });
    fireEvent.click(bell);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(bell).toHaveFocus();
  });

  it("a click outside closes it; a row's link closes it and goes through the router", () => {
    state.notices = [notice("a", now - HOUR)];
    render(<NoticesBell />);
    fireEvent.click(screen.getByRole("button", { name: /^Avisos/ }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Avisos/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("link"));
    expect(state.navigate).toHaveBeenCalledWith({ href: "/matches/a" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Tab stays inside the panel", () => {
    state.notices = [notice("a", now - HOUR)];
    render(<NoticesBell />);
    fireEvent.click(screen.getByRole("button", { name: /^Avisos/ }));
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "Cerrar los avisos" });
    const link = within(dialog).getByRole("link");
    link.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(link).toHaveFocus();
  });

  it("the empty panel says what will come", () => {
    state.seenAt = { toMillis: () => now };
    render(<NoticesBell />);
    fireEvent.click(screen.getByRole("button", { name: "Avisos" }));
    expect(screen.getByText("Aquí verás los avisos del equipo: convocatorias, el siete, el MVP…")).toBeInTheDocument();
    expect(state.markNoticesSeen).not.toHaveBeenCalled();
  });
});
