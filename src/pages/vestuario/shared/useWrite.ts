import { useState } from "react";
import { apiError } from "../../../lib/clubApi";

/**
 * Direct writes land in the local cache at once (the listeners redraw immediately), so
 * nothing waits for the server: the control never locks, and a refusal shows as an error
 * while the SDK rolls the local change back.
 */
export function useWrite() {
  const [error, setError] = useState("");
  /** `onSaved` runs once the server has accepted the write (never on a refusal). */
  const write = (fn: () => Promise<unknown>, onSaved?: () => void) => {
    setError("");
    fn().then(onSaved, (e: unknown) => setError(apiError(e)));
  };
  return { error, write };
}
