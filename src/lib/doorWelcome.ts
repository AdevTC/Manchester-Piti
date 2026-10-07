// The moment of being let in: it must outlive the account becoming a member (the layout would
// otherwise swap the door for the vestuario at once), so it lives outside React.
// "ok": the captain just opened (your spot on the wall lights up «Dentro»); "walk": the walkout.
import { useSyncExternalStore } from "react";

export interface Welcome {
  name: string;
  num: string;
  phase: "ok" | "walk";
}
let current: Welcome | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const startWelcome = (w: Welcome) => {
  current = w;
  emit();
};
export const walkOut = () => {
  if (!current) return;
  current = { ...current, phase: "walk" };
  emit();
};
export const endWelcome = () => {
  current = null;
  emit();
};
export function useWelcome() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
