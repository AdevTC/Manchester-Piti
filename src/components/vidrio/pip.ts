// «Sacar el marcador»: the live score in a window of its own. Document Picture-in-Picture where the browser has
// it (Chromium desktop: a real always-on-top window the OS moves and remembers), with the page's stylesheets
// copied in so the kit's glass and type come along; elsewhere the in-page draggable glass window (PipWindow).
// Call openScorePip() from the click itself (the browser asks for a user gesture), then render <PipWindow pip>.
export interface DocumentPip {
  kind: "document";
  win: Window;
  /** Where PipWindow portals the score. */
  container: HTMLElement;
  close: () => void;
}
export interface InPagePip {
  kind: "inpage";
  close: () => void;
}
export type ScorePip = DocumentPip | InPagePip;

interface DocumentPictureInPicture {
  requestWindow: (options?: { width?: number; height?: number; disallowReturnToOpener?: boolean }) => Promise<Window>;
}
type PipHost = Window & { documentPictureInPicture?: DocumentPictureInPicture };

/** Whether the real Document Picture-in-Picture is there. */
export const hasDocumentPip = (): boolean => typeof window !== "undefined" && typeof (window as PipHost).documentPictureInPicture?.requestWindow === "function";

/** Copies the page's stylesheets (rules inline; cross-origin sheets as links) and the theme into the PiP document. */
export function copyStyles(from: Document, to: Document): void {
  for (const sheet of Array.from(from.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join("\n");
      const style = to.createElement("style");
      style.textContent = css;
      to.head.appendChild(style);
    } catch {
      if (!sheet.href) continue;
      const link = to.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      to.head.appendChild(link);
    }
  }
  const theme = from.documentElement.getAttribute("data-theme");
  if (theme) to.documentElement.setAttribute("data-theme", theme);
  to.documentElement.lang = from.documentElement.lang || "es";
}

/** Opens the score's window: the real PiP when possible (falls back to the in-page window if it is refused). */
export async function openScorePip({ width = 340, height = 150, title = "Marcador del Manchester Piti" }: { width?: number; height?: number; title?: string } = {}): Promise<ScorePip> {
  const api = typeof window !== "undefined" ? (window as PipHost).documentPictureInPicture : undefined;
  if (api && typeof api.requestWindow === "function") {
    try {
      const win = await api.requestWindow({ width, height });
      copyStyles(document, win.document);
      win.document.title = title;
      const container = win.document.createElement("div");
      container.className = "vd-pipdoc";
      win.document.body.appendChild(container);
      return { kind: "document", win, container, close: () => win.close() };
    } catch {
      // (refused or no gesture: the in-page window instead)
    }
  }
  return { kind: "inpage", close: () => undefined };
}
