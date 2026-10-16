// «Buscar»'s keys: ⌘K / Ctrl+K and «/». Never while someone is typing (a field, a text area, a select or an
// editable block keeps its keys: «/» is a character there, Ctrl+K the field's own), never with Alt or Shift
// held, never when a page already handled the key.

/** Is `target` somewhere a key is text (an input, a text area, a select, an editable block)? */
export function isEditable(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  return !!el.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"],[role="combobox"]');
}

type ShortcutEvent = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "defaultPrevented" | "target"> & { isComposing?: boolean };

/** Does this key press open the search? */
export function isSearchShortcut(e: ShortcutEvent): boolean {
  if (e.defaultPrevented || e.isComposing || e.altKey || isEditable(e.target)) return false;
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "k") return true;
  return e.key === "/" && !e.metaKey && !e.ctrlKey;
}
