// Who the header's account control names («J Jordi»): RootLayout publishes the signed-in member's nickname here
// (beside hooks/viewerSignal's member/admin/playerId), and the chrome reads it without the providers above it
// (page tests render it bare: a fan). Server and hydration read nobody, so the HTML stays the fan's.
import { useSyncExternalStore } from "react";

export interface Account {
  /** The name the team knows him by (users/{uid}.nickname). */
  name: string;
}

let current: Account | null = null;
const readers = new Set<() => void>();

export function publishAccount(a: Account | null): void {
  if ((a?.name ?? null) === (current?.name ?? null)) return;
  current = a ? { ...a } : null;
  readers.forEach((r) => r());
}

const subscribe = (r: () => void) => {
  readers.add(r);
  return () => readers.delete(r);
};

export const usePublishedAccount = (): Account | null => useSyncExternalStore(subscribe, () => current, () => null);

/** «Jordi» → «J»; the first letter of the first word, upper case. */
export function initialOf(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return (Array.from(first)[0] ?? "?").toLocaleUpperCase("es");
}

/** The first word of a nickname, capitalised («jordi sumba» → «Jordi»), for the pill and «Tú, Jordi». */
export function firstName(name: string): string {
  const w = name.trim().split(/\s+/)[0] ?? name;
  return w.charAt(0).toLocaleUpperCase("es") + w.slice(1);
}
