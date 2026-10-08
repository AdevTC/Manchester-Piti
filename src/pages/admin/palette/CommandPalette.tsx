// ⌘K / Ctrl K / «Buscar»: the command palette (`.ovl.cmd`). A combobox input drives a grouped listbox
// through aria-activedescendant: ↑↓ move (wrapping), Enter runs, Esc closes (the layer stack), a click
// runs. Running a command closes the palette first, then acts (so a command can open another layer).
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AdIcon } from "../ui/icons";
import { useLayer, useLayerHost } from "../ui/layerCore";
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
      <div className={depth ? "scrim hi" : "scrim"} style={{ zIndex: 20 + depth * 2 }} onClick={isTop ? onClose : undefined} aria-hidden="true" />
      <div ref={ref} className="ovl cmd" role="dialog" aria-modal="true" aria-label="Buscar en la administración" tabIndex={-1} style={{ zIndex: 21 + depth * 2 }}>
        <div className="ci">
          <AdIcon name="search" size={20} />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={at >= 0 ? optId(at) : undefined}
            aria-label="Buscar sección, partido, jugador o acción"
            autoComplete="off"
            spellCheck={false}
            placeholder="Sección, partido (J7), jugador o acción…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
          />
          <button type="button" className="kbd" onClick={onClose} aria-label="Cerrar">
            Esc
          </button>
        </div>
        <div className="cres scr" id={listId} role="listbox" aria-label="Resultados">
          {groups.map((g, gi) => (
            <div className="cg2" role="group" aria-label={g.title} key={g.title}>
              <p className="lbl" aria-hidden="true">
                {g.title}
              </p>
              {g.items.map((c, ci) => {
                const i = starts[gi] + ci;
                return (
                  <button
                    type="button"
                    className="co"
                    role="option"
                    id={optId(i)}
                    key={c.id}
                    aria-selected={i === at}
                    tabIndex={-1}
                    onMouseMove={() => i !== at && setActive(i)}
                    onClick={() => runCommand(c)}
                  >
                    <span className="ci2" aria-hidden="true">
                      {c.icon}
                    </span>
                    <span className="w">
                      <b>{c.title}</b>
                      {c.description && <small>{c.description}</small>}
                    </span>
                    {c.hint && <em>{c.hint}</em>}
                  </button>
                );
              })}
            </div>
          ))}
          {!flat.length && (
            <div className="empty" style={{ margin: 10 }}>
              <AdIcon name="search" size={22} />
              <b>Nada con «{query}»</b>
              <small>Prueba con una jornada (J8), un rival, un dorsal o «nuevo».</small>
            </div>
          )}
        </div>
        <div className="ft" aria-hidden="true">
          <span>
            <AdIcon name="updown" size={14} />
            moverse
          </span>
          <span>
            <AdIcon name="enter" size={14} />
            abrir
          </span>
          <span>
            <span className="kbd">Esc</span>cerrar
          </span>
        </div>
      </div>
    </>
  );
  return host ? createPortal(node, host) : null;
}
