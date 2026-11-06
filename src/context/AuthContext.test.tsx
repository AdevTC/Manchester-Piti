// AuthContext.logout: a sign-out that fails reaches the caller (Cuenta's «Salir» says why) and leaves «loading» off.
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const signOut = vi.fn<() => Promise<void>>();
vi.mock("../lib/fb", () => {
  const fb = {
    auth: {},
    db: {},
    signOut: () => signOut(),
    onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
      cb(null);
      return () => undefined;
    },
  };
  return { firebaseNow: () => fb, loadFirebase: () => Promise.resolve(fb), withFirebase: (open: (f: typeof fb) => () => void) => open(fb) };
});
vi.mock("../lib/push", () => ({ reassertPush: vi.fn(() => Promise.resolve("skip")) }));

import { AuthProvider, useAuth } from "./AuthContext";

type Ctx = ReturnType<typeof useAuth>;
function Probe({ onCtx }: { onCtx: (c: Ctx) => void }) {
  onCtx(useAuth());
  return null;
}
function grab() {
  const out: { ctx: Ctx | null } = { ctx: null };
  render(
    <AuthProvider>
      <Probe onCtx={(c) => (out.ctx = c)} />
    </AuthProvider>,
  );
  return out;
}

describe("AuthContext · logout", () => {
  it("a failed sign-out rejects (the caller says why) and stops loading", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    signOut.mockRejectedValueOnce(Object.assign(new Error("offline"), { code: "auth/network-request-failed" }));
    const out = grab();
    let caught: unknown = null;
    await act(async () => {
      await out.ctx!.logout().catch((e: unknown) => {
        caught = e;
      });
    });
    expect((caught as { code?: string } | null)?.code).toBe("auth/network-request-failed");
    expect(out.ctx!.loading).toBe(false);
  });

  it("a sign-out that works resolves", async () => {
    signOut.mockResolvedValueOnce(undefined);
    const out = grab();
    await act(async () => {
      await expect(out.ctx!.logout()).resolves.toBeUndefined();
    });
  });
});
