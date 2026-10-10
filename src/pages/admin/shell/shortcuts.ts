// The Sala de control's keyboard: `g` then a section's key jumps there (g h Hoy, g p Partidos, g c Convocar,
// g l pLantilla, g f Fichas, g t Temporadas, g k capitanes, g o cOntenido) and `[` folds / unfolds the rail
// on wide screens. Never while typing (inputs, textareas, selects, contenteditable), never with a modifier,
// never while a layer is open (the palette, a modal, the Más sheet: they own the keyboard).
import { useEffect, useRef } from "react";
import { sectionForGo, type SectionKey } from "./nav";

/** How long the `g` waits for its second key. */
export const CHORD_MS = 1500;

/** The event target is somewhere the user types (so letters are text, not shortcuts). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return !["button", "checkbox", "radio", "range", "reset", "submit", "color", "file", "image"].includes(type);
}

export type ChordResult = { kind: "none" } | { kind: "armed" } | { kind: "go"; section: SectionKey } | { kind: "rail" };
/**
 * One key of the chord (pure): `armedAt` = when `g` was pressed (or null). Returns what to do and the new
 * armed time. `[` toggles the rail; `g` arms; a section key within CHORD_MS of `g` goes there.
 */
export function chordStep(armedAt: number | null, key: string, now: number): { result: ChordResult; armedAt: number | null } {
  const armed = armedAt !== null && now - armedAt <= CHORD_MS;
  if (armed) {
    const section = sectionForGo(key);
    if (section) return { result: { kind: "go", section }, armedAt: null };
  }
  if (key === "g" || key === "G") return { result: { kind: "armed" }, armedAt: now };
  if (key === "[") return { result: { kind: "rail" }, armedAt: null };
  return { result: { kind: "none" }, armedAt: null };
}

/**
 * Listens on the document. `blocked()` = a layer is open (no shortcuts); `onRail` is left out where the rail
 * can't fold (below 1200 px, phones).
 */
export function useShellShortcuts({ onGo, onRail, blocked }: { onGo: (k: SectionKey) => void; onRail?: () => void; blocked: () => boolean }) {
  const latest = useRef({ onGo, onRail, blocked });
  useEffect(() => {
    latest.current = { onGo, onRail, blocked };
  });
  useEffect(() => {
    let armedAt: number | null = null;
    const onKey = (e: KeyboardEvent) => {
      // AltGr (Ctrl+Alt on Windows) is how a Spanish keyboard types `[`: not a modifier here
      const altGr = e.getModifierState?.("AltGraph") ?? false;
      if (e.defaultPrevented || e.repeat || e.metaKey || (!altGr && (e.ctrlKey || e.altKey)) || isTypingTarget(e.target)) return;
      const { onGo: go, onRail: rail, blocked: isBlocked } = latest.current;
      if (isBlocked()) {
        armedAt = null;
        return;
      }
      const step = chordStep(armedAt, e.key, Date.now());
      armedAt = step.armedAt;
      const r = step.result;
      if (r.kind === "go") {
        e.preventDefault();
        go(r.section);
      } else if (r.kind === "rail" && rail) {
        e.preventDefault();
        rail();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
