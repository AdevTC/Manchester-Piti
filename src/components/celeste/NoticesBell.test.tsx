import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Notice } from "../../lib/derived/notices";
import type { Inbox, Pend } from "../../pages/perfil/bandeja/useInbox";

// The bell (TU boards `tu-bell`): its button and count, its sheet — «Te toca» answered in place, «Todo», the device's
// line — for a member, and the device's shortcuts only for a fan. The inbox and this device are stubbed.
const state = vi.hoisted(() => ({
  inbox: null as unknown,
  navigate: vi.fn(async (_o: unknown) => undefined),
  mark: vi.fn(async (_ids: readonly string[], _v: boolean) => undefined),
  pick: vi.fn(async (_a: string) => undefined),
}));
vi.mock("../../firebase", () => ({ db: {}, functions: {}, auth: { currentUser: null }, FUNCTIONS_REGION: "europe-southwest1" }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => state.navigate }));
vi.mock("../../pages/perfil/bandeja/useInbox", () => ({ useInbox: () => state.inbox }));
vi.mock("../../components/jersey3d/usePageKitStills", () => ({ usePageKitStills: () => () => undefined }));
vi.mock("../../pages/perfil/bandeja/device", () => ({
  useThisDevice: () => ({ kind: "listo", ready: true, words: { tone: "ok", chip: "Listo", title: "Este móvil recibe avisos", dev: "", steps: [], btn: "" }, blocked: "", choice: "todo", vibrate: false, pause: null, line: "Todo", setPreset: async () => undefined, setVibrate: async () => undefined, refresh: () => undefined }),
  PresetSeg: () => <div role="group" aria-label="Qué te avisamos" />,
}));

const { NoticesBell, FanBell } = await import("./NoticesBell");
const { NoticesGate } = await import("./NoticesGate");
const { publishViewer } = await import("../../hooks/viewerSignal");

const now = Date.now();
const notice = (id: string, extra: Partial<Notice> = {}): Notice => ({ id, topic: "dates", title: `Aviso ${id}`, body: "Domingo, 25 oct.", url: `/vestuario`, at: now - 60_000, audience: "team", ...extra });
const rsvp = (): Pend => ({
  kind: "rsvp",
  key: "rsvp-j2",
  noticeIds: ["conv"],
  title: "¿Vas el domingo 25 a Pitutis?",
  body: "J2 · 14:00 · fuera · contestan 6 de 16",
  icon: "check",
  done: false,
  after: "",
  error: "",
  value: null,
  busy: false,
  pick: state.pick,
});
function inboxWith(o: Partial<Inbox> = {}): Inbox {
  const list = o.list ?? [notice("a"), notice("b")];
  return {
    viewer: { who: "jugador", captain: false },
    member: true,
    uid: "u1",
    now,
    loading: false,
    failed: false,
    list,
    reads: { seenAt: null, read: {}, unread: () => true, mark: state.mark, markAll: async () => undefined },
    unread: list.length,
    pends: [rsvp()],
    openPend: 1,
    feed: list,
    stacks: [],
    loose: list,
    stackOf: () => undefined,
    next: null,
    topics: ["goals"],
    muted: [],
    matchName: () => "J2",
    ...o,
  };
}

beforeEach(() => {
  state.inbox = inboxWith();
  state.navigate.mockClear();
  state.mark.mockClear();
  state.pick.mockClear();
});

describe("NoticesGate", () => {
  it("nothing until the browser owns the page; then a member's bell, or a fan's", async () => {
    render(<NoticesGate />);
    act(() => publishViewer({ member: true, admin: false, playerId: "adri" }));
    expect(await screen.findByRole("button", { name: "Avisos, 2 sin leer" })).toBeInTheDocument();
    act(() => publishViewer({ member: false, admin: false, playerId: null }));
    expect(await screen.findByRole("button", { name: "Avisos" })).toBeInTheDocument();
  });
});

describe("the member's bell", () => {
  it("the count on its dot, in words for its name", () => {
    render(<NoticesBell />);
    const bell = screen.getByRole("button", { name: "Avisos, 2 sin leer" });
    expect(bell).toHaveClass("tu-cbtn", "tu-cbtn--bell");
    expect(bell).toHaveTextContent("2");
    state.inbox = inboxWith({ unread: 0 });
    render(<NoticesBell />);
    expect(screen.getByRole("button", { name: "Avisos" })).not.toHaveTextContent(/\d/);
  });

  it("opens «Te toca» first, answered in place: the answer is written and its notice turns read", () => {
    render(<NoticesBell />);
    fireEvent.click(screen.getByRole("button", { name: /^Avisos/ }));
    const sheet = screen.getByRole("dialog", { name: "Avisos" });
    expect(within(sheet).getByText("2 sin leer")).toBeInTheDocument();
    expect(within(sheet).getByRole("tab", { name: /Te toca/ })).toHaveAttribute("aria-selected", "true");
    expect(within(sheet).getByText("¿Vas el domingo 25 a Pitutis?")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Voy" }));
    expect(state.pick).toHaveBeenCalledWith("yes");
    expect(state.mark).toHaveBeenCalledWith(["conv"], true);
    expect(within(sheet).getByRole("button", { name: /Este móvil: Todo/ })).toBeInTheDocument();
  });

  it("«Todo» lists the notices; opening one marks it read and goes through the router", async () => {
    render(<NoticesBell />);
    fireEvent.click(screen.getByRole("button", { name: /^Avisos/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Todo/ }));
    const open = screen.getByRole("button", { name: "Aviso a, sin leer. Abrir" });
    fireEvent.click(open);
    expect(state.mark).toHaveBeenCalledWith(["a"], true);
    await vi.waitFor(() => expect(state.navigate).toHaveBeenCalledWith({ href: "/vestuario" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("nothing waiting and nothing kept: «Estás al día» and what comes next", () => {
    state.inbox = inboxWith({ list: [], pends: [], openPend: 0, unread: 0, feed: [], loose: [] });
    render(<NoticesBell />);
    fireEvent.click(screen.getByRole("button", { name: "Avisos" }));
    expect(screen.getByText("Estás al día.")).toBeInTheDocument();
  });

  it("a failed read says so", () => {
    state.inbox = inboxWith({ list: [], pends: [], failed: true });
    render(<NoticesBell />);
    fireEvent.click(screen.getByRole("button", { name: /^Avisos/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("No se han podido cargar.");
  });

  it("Esc closes it and the focus goes back to the bell", async () => {
    render(<NoticesBell />);
    const bell = screen.getByRole("button", { name: /^Avisos/ });
    fireEvent.click(bell);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(bell));
  });

  it("a tap on the scrim closes it", () => {
    render(<NoticesBell />);
    fireEvent.click(screen.getByRole("button", { name: /^Avisos/ }));
    fireEvent.click(document.querySelector(".tu-scrim") as Element);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("the fan's bell", () => {
  it("only this device's shortcuts: the notices are the vestuario's", () => {
    render(<FanBell />);
    fireEvent.click(screen.getByRole("button", { name: "Avisos" }));
    const sheet = screen.getByRole("dialog", { name: "Avisos" });
    expect(within(sheet).getByText(/Los avisos del vestuario son de los socios/)).toBeInTheDocument();
    expect(within(sheet).getByRole("group", { name: "Qué te avisamos" })).toBeInTheDocument();
    expect(within(sheet).queryByRole("tab")).toBeNull();
    expect(within(sheet).queryByText("Abrir el centro de avisos")).toBeNull();
  });
});
