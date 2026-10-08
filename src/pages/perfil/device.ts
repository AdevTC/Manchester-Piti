// /profile › Avisos: what this browser says about notices right now — the permission, whether the web
// runs installed, whether the service worker holds a live push subscription — and the local test notice.
// Thin wrappers over the browser (the tests replace this module).

export type Permission = NotificationPermission | "unknown";

export function notificationPermission(): Permission {
  try {
    return typeof Notification === "undefined" ? "unknown" : Notification.permission;
  } catch {
    return "unknown";
  }
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

export function userAgent(): string {
  return typeof navigator === "undefined" ? "" : navigator.userAgent;
}

/** Whether the service worker of this site has a push subscription (null: can't tell). */
export async function pushSubscribed(): Promise<boolean | null> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !("pushManager" in reg)) return reg ? null : false;
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return null;
  }
}

/** Calls `fn` when the notification permission changes (the member allowed it in the browser's settings). */
export function watchPermission(fn: () => void): () => void {
  let status: PermissionStatus | null = null;
  let stopped = false;
  try {
    void navigator.permissions
      ?.query({ name: "notifications" })
      .then((s) => {
        if (stopped) return;
        status = s;
        s.addEventListener("change", fn);
      })
      .catch(() => undefined);
  } catch {
    /* no Permissions API: the visibility check below still catches it */
  }
  // Back from the settings app: check again.
  const onVisible = () => {
    if (!document.hidden) fn();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    stopped = true;
    status?.removeEventListener("change", fn);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

const TIMEOUT = 4000;
/** A real notification on this device, from the service worker (like the club's). Rejects if it can't. */
export async function showTestNotice(title: string, body: string): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) throw new Error("no-sw");
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("no-sw")), TIMEOUT)),
  ]);
  await reg.showNotification(title, {
    body,
    icon: "/crest-icon.png",
    badge: "/crest-icon.png",
    tag: "piti-prueba",
    data: { url: "/profile#avisos" },
  });
}
