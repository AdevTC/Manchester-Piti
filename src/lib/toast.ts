import type { ExternalToast } from "sonner";

type Sonner = typeof import("sonner");
type Message = Parameters<Sonner["toast"]>[0];

// sonner (≈10 KB gzip) stays out of the first load: the first toast brings it and asks the app's
// <Toaster> (components/ui/toast) to mount. The toast is only created once that Toaster is in the page,
// so its live region is there to announce it (and sonner replays what was created before it subscribed).
let wanted = false;
const listeners = new Set<() => void>();
let resolveMounted: () => void = () => {};
const mounted = new Promise<void>((resolve) => {
  resolveMounted = resolve;
});
let sonner: Promise<Sonner> | null = null;

function ready(): Promise<Sonner> {
  if (!wanted) {
    wanted = true;
    listeners.forEach((listener) => listener());
  }
  sonner ??= Promise.all([import("sonner"), mounted]).then(
    ([m]) => m,
    (error: unknown) => {
      sonner = null; // (offline: the next toast tries again)
      throw error;
    },
  );
  return sonner;
}

function show(kind: "default" | "success" | "error") {
  return (message: Message, data?: ExternalToast): void => {
    ready().then(
      (m) => {
        if (kind === "default") m.toast(message, data);
        else m.toast[kind](message, data);
      },
      () => {},
    );
  };
}

/** sonner's `toast`, `toast.success` and `toast.error`, loaded on first use. */
export const toast = Object.assign(show("default"), { success: show("success"), error: show("error") });

/** For the lazy <Toaster>: whether a toast has asked for it yet. */
export const toasterWanted = () => wanted;
export function subscribeToasterWanted(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
/** The lazy <Toaster> is in the page: the waiting toasts can be created. */
export const toasterMounted = () => resolveMounted();
