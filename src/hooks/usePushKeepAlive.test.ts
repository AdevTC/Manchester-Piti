// The boot check runs once the session is known (the personal topics need the member's sign-in).
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ loading: true, reassert: vi.fn(async () => "skip" as const) }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ loading: h.loading }) }));
vi.mock("../lib/push", () => ({ reassertPush: h.reassert }));

import { usePushKeepAlive } from "./usePushKeepAlive";

beforeEach(() => {
  h.loading = true;
  h.reassert.mockClear();
});

describe("usePushKeepAlive", () => {
  it("waits for the session, then re-asserts the subscription", () => {
    const { rerender } = renderHook(() => usePushKeepAlive());
    expect(h.reassert).not.toHaveBeenCalled();
    h.loading = false;
    rerender();
    expect(h.reassert).toHaveBeenCalledTimes(1);
    // (a re-render with the same session asks nothing more)
    rerender();
    expect(h.reassert).toHaveBeenCalledTimes(1);
  });
});
