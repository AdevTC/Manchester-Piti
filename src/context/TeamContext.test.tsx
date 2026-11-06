// TeamContext: the «let in» welcome starts only for the account that was waiting at the door — not for another
// account, already inside, that signs in on the same device afterwards.
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Snap = { exists: () => boolean; data: () => Record<string, unknown> | undefined };
const listeners = new Map<string, (s: Snap) => void>();
const auth = { user: null as { uid: string } | null, loading: false };
const startWelcome = vi.fn();

vi.mock("./AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../lib/doorWelcome", () => ({ startWelcome: (...a: unknown[]) => startWelcome(...a) }));
vi.mock("../lib/fb", () => {
  const fb = {
    db: {},
    doc: (_db: unknown, col: string, id: string) => `${col}/${id}`,
    onSnapshot: (path: string, next: (s: Snap) => void) => {
      listeners.set(path, next);
      return () => listeners.delete(path);
    },
    signOut: () => Promise.resolve(),
    auth: {},
  };
  return { withFirebase: (open: (f: typeof fb) => () => void) => open(fb), loadFirebase: () => Promise.resolve(fb) };
});

import { TeamProvider } from "./TeamContext";

const doc = (data: Record<string, unknown> | null): Snap => ({ exists: () => data !== null, data: () => data ?? undefined });
const inside = doc({ expiresAt: { toMillis: () => Date.now() + 86_400_000 } });
const fire = (path: string, s: Snap) => act(() => listeners.get(path)?.(s));

beforeEach(() => {
  listeners.clear();
  startWelcome.mockClear();
});

describe("TeamProvider · the welcome of someone let in", () => {
  it("welcomes the account that waited at the door when a captain lets it in", () => {
    auth.user = { uid: "a" };
    render(<TeamProvider>{null}</TeamProvider>);
    fire("accessRequests/a", doc({ status: "pending" }));
    fire("teamMembers/a", doc(null));
    fire("teamMembers/a", inside);
    expect(startWelcome).toHaveBeenCalledTimes(1);
  });

  it("another account already inside, signing in after one that was waiting, gets no welcome", () => {
    auth.user = { uid: "a" };
    const { rerender } = render(<TeamProvider>{null}</TeamProvider>);
    fire("accessRequests/a", doc({ status: "pending" }));
    fire("teamMembers/a", doc(null));
    auth.user = { uid: "b" };
    rerender(<TeamProvider>{null}</TeamProvider>);
    fire("teamMembers/b", inside);
    fire("accessRequests/b", doc(null));
    expect(startWelcome).not.toHaveBeenCalled();
  });
});
