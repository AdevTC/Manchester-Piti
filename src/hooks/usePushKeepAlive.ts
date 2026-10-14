// On app boot, once the session is known (the personal topics need it), and on every session change
// (signing out, or another account signing in): re-asserts this device's push subscription when
// src/lib/push.ts reassertPush says so — a lost or renewed subscription, a stale uid on the server, the
// weekly check. Silent: it never asks for permission and never shows anything.
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { reassertPush } from "../lib/push";

export function usePushKeepAlive(): void {
  const { loading, user } = useAuth();
  const uid = user?.uid ?? "";
  useEffect(() => {
    if (!loading) void reassertPush();
  }, [loading, uid]);
}
