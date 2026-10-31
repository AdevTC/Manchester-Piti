// «Ver mi petición» (a new account's sobre cerrado): open from anywhere — the place's own button, or the card's
// sobre on the stage (the shell's CardStage `onPack`, which should call `openPetition`). A tiny store, so the
// shell needn't hold the place's state.
import { useSyncExternalStore } from "react";

let open = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function openPetition(): void {
  open = true;
  emit();
}
export function closePetition(): void {
  open = false;
  emit();
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export const usePetitionOpen = (): boolean => useSyncExternalStore(subscribe, () => open, () => false);
