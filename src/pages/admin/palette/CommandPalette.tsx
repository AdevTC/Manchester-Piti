// ⌘K / Ctrl K / «Buscar»: the command palette (`.pal`, the v2 canvas). A combobox input drives a grouped listbox
// through aria-activedescendant: ↑↓ move (wrapping), Enter runs, Esc closes (the layer stack), a click
// runs. Running a command closes the palette first, then acts (so a command can open another layer).
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AdIcon } from "../ui/icons";
import { useLayer, useLayerHost, zLayer, zScrim } from "../ui/layerCore";
import { usePaletteCommands } from "./registry";
import { buildPaletteGroups, flatten, type PaletteCommand } from "./search";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <PaletteLayer onClose={onClose} /> : null;
}

function PaletteLayer({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const host = useLayerHost();
  const { depth, isTop } = useLayer({ modal: true, trap: true, onClose, ref, initialFocus: input });
  const commands = usePaletteCommands();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const groups = useMemo(() => buildPaletteGroups(commands, query), [commands, query]);
  const flat = useMemo(() => flatten(groups), [groups]);
  const at = flat.length ? Math.min(active, flat.length - 1) : -1;
  const base = useId();
  const optId = (i: number) => `${base}-o${i}`;
  const listId = `${base}-l`;

  const runCommand = (c: PaletteCommand) => {
    onClose();
    c.run();
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!flat.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = (at + (e.key === "ArrowDown" ? 1 : -1) + flat.length) % flat.length;
      setActive(n);
      document.getElementById(optId(n))?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      runCommand(flat[at]);
    }
  };

  // Where each group starts in the flat (keyboard) order.
  const starts = groups.map((_, gi) => groups.slice(0, gi).reduce((n, g) => n + g.items.length, 0));
  const node = (
    <>
      <div className={depth ? "scrim hi" : "scrim"} style={{ zIndex: zScrim(depth) }} onClick={isTop ? onClose : undefined} aria-hidden="true" />
      <div ref={ref} className="pal" role="dialog" aria-modal="true" aria-label="Buscar" tabIndex={-1} style={{ zIndex: zLayer(depth) }}>
        <div className="qi">
          <AdIcon name="search" size={20} />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={at >= 0 ? optId(at) : undefined}
            aria-label="Busca un partido, un jugador o una acción"
            autoComplete="off"
            spellCheck={false}
            placeholder="Busca un partido, un jugador o una acción"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="scr" id={listId} role="listbox" aria-label="Resultados">
          {groups.map((g, gi) => (
            <div role="group" aria-label={g.title} key={g.title}>
              <p className="gh" aria-hidden="true">
                {g.title}
              </p>
              {g.items.map((c, ci) => {
                const i = starts[gi] + ci;
                return (
                  <button
                    type="button"
                    className="op"
                    role="option"
                    id={optId(i)}
                    key={c.id}
                    aria-selected={i === at}
                    aria-keyshortcuts={c.keys ? c.keys.toLowerCase() : undefined}
                    tabIndex={-1}
                    onMouseMove={() => i !== at && setActive(i)}
                    onClick={() => runCommand(c)}
                  >
                    <AdIcon name="right" size={16} />
                    {c.title}
                    {c.description || c.hint ? <small>{c.description || c.hint}</small> : null}
                    {c.keys && (
                      <kbd className="ks" aria-hidden="true">
                        {c.keys}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {!flat.length && <p className="none">Nada con «{query}».</p>}
        </div>
        <div className="ft" aria-hidden="true">
          <span>↑↓ moverse</span>
          <span>Enter abrir</span>
          <span>Esc cerrar</span>
          <span className="gk">G + letra ir a una sección</span>
        </div>
      </div>
    </>
  );
  return host ? createPortal(node, host) : null;
}
