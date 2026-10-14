// On app boot, once the session is known (the personal topics need it): re-asserts this device's push
// subscription if it was lost or renewed (src/lib/push.ts reassertPush, at most once a day). Silent: it
// never asks for permission and never shows anything.
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { reassertPush } from "../lib/push";

export function usePushKeepAlive(): void {
  const { loading } = useAuth();
  useEffect(() => {
    if (!loading) void reassertPush();
  }, [loading]);
}
