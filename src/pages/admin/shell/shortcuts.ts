// The Sala de control's keyboard (DIRECTION.md § Atajos): `g` then a place's key jumps there (g h Hoy · g p
// Partidos · g l pLantilla · g a cAja · g b cluB), `/` goes to the screen's search («buscar en listas»: the first
// search field of the screen, <input type="search"> or role=searchbox), `n` opens «Nuevo partido» (a screen that
// handles `n` itself calls preventDefault first). ⌘K / Ctrl K is the search's (SalaSearch); ← → between stations
// is the match's (partido/). Never while typing, never with a modifier, never while a layer is open (the search,
// a sheet, a dialog: they own the keyboard).
import { useEffect, useRef } from "react";
import { placeForGo, type PlaceKey } from "./places";

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

export type KeyResult = { kind: "none" } | { kind: "armed" } | { kind: "go"; place: PlaceKey } | { kind: "search" } | { kind: "nuevo" };
/** One key (pure): `armedAt` = when `g` was pressed (or null). Returns what to do and the new armed time. */
export function keyStep(armedAt: number | null, key: string, now: number): { result: KeyResult; armedAt: number | null } {
  const armed = armedAt !== null && now - armedAt <= CHORD_MS;
  if (armed) {
    const place = placeForGo(key);
    if (place) return { result: { kind: "go", place }, armedAt: null };
  }
  if (key === "g" || key === "G") return { result: { kind: "armed" }, armedAt: now };
  if (key === "/") return { result: { kind: "search" }, armedAt: null };
  if (key === "n" || key === "N") return { result: { kind: "nuevo" }, armedAt: null };
  return { result: { kind: "none" }, armedAt: null };
}

/** The screen's list search, if it has one (inside the sala's <main>). */
export function screenSearch(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>('.sc-main input[type="search"], .sc-main [role="searchbox"]');
}

/** Listens on the document. `blocked()` = a layer is open. */
export function useSalaShortcuts({ onGo, onNuevo, blocked }: { onGo: (k: PlaceKey) => void; onNuevo: () => void; blocked: () => boolean }) {
  const latest = useRef({ onGo, onNuevo, blocked });
  useEffect(() => {
    latest.current = { onGo, onNuevo, blocked };
  });
  useEffect(() => {
    let armedAt: number | null = null;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const l = latest.current;
      if (l.blocked()) {
        armedAt = null;
        return;
      }
      const step = keyStep(armedAt, e.key, Date.now());
      armedAt = step.armedAt;
      const r = step.result;
      if (r.kind === "go") {
        e.preventDefault();
        l.onGo(r.place);
      } else if (r.kind === "search") {
        const field = screenSearch();
        if (!field) return;
        e.preventDefault();
        field.focus();
      } else if (r.kind === "nuevo") {
        e.preventDefault();
        l.onNuevo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
