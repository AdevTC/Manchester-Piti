// «Buscar»'s dialog body: the field and its results, the combobox + listbox pattern (the field keeps the focus;
// ↑ ↓ move the active option, Enter opens it, Esc closes, Tab stays inside). Empty, it suggests the next match
// and the pichichi and lists the last searches (lib/recentSearches). Portalled to the body (the header's
// stacking context and the live island would cover it): a sheet from the top on a phone, a centred panel on a
// wider screen (search.css). The data and the navigation come from SearchDialog, so this is testable bare.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { KIND_LABEL, searchEntries, type SearchEntry } from "../../lib/derived/search";
import { readRecent, rememberSearch } from "../../lib/recentSearches";
import { Icon } from "./icons";

type Option = { key: string; type: "entry"; entry: SearchEntry } | { key: string; type: "recent"; query: string };
interface Section {
  title: string;
  options: Option[];
}

export interface SearchPanelProps {
  entries: readonly SearchEntry[];
  /** Shown with an empty field (the next match, the pichichi). */
  suggestions: readonly SearchEntry[];
  /** A result was chosen (the query that found it is already remembered). */
  onGo: (entry: SearchEntry) => void;
  onClose: (refocus?: boolean) => void;
}

const FOCUSABLE = 'input,button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function SearchPanel({ entries, suggestions, onGo, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const listId = useId();

  const sections: Section[] = useMemo(() => {
    if (query.trim()) {
      return searchEntries(entries, query).map((g) => ({ title: g.title, options: g.items.map((entry) => ({ key: entry.id, type: "entry" as const, entry })) }));
    }
    const out: Section[] = [];
    if (suggestions.length) out.push({ title: "Sugerencias", options: suggestions.map((entry) => ({ key: `s-${entry.id}`, type: "entry" as const, entry })) });
    if (recent.length) out.push({ title: "Búsquedas recientes", options: recent.map((q) => ({ key: `r-${q}`, type: "recent" as const, query: q })) });
    return out;
  }, [entries, suggestions, recent, query]);
  const options = useMemo(() => sections.flatMap((s) => s.options), [sections]);
  const at = options.length ? Math.min(active, options.length - 1) : -1;
  const optionId = (i: number) => `${listId}-o${i}`;

  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    if (at < 0) return;
    document.getElementById(`${listId}-o${at}`)?.scrollIntoView?.({ block: "nearest" });
  }, [at, listId]);

  const choose = (o: Option) => {
    if (o.type === "recent") {
      setQuery(o.query);
      setActive(0);
      input.current?.focus();
      return;
    }
    if (query.trim()) setRecent(rememberSearch(query));
    onGo(o.entry);
  };

  const onFieldKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!options.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((Math.max(at, 0) + step + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (at >= 0) choose(options[at]);
    }
  };

  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const shown = options.length;
  const status = query.trim() ? (shown ? `${shown} ${shown === 1 ? "resultado" : "resultados"}` : "Sin resultados") : "";

  let index = -1;
  return createPortal(
    <div className="sr-portal">
      <div className="sr-scrim" aria-hidden="true" onPointerDown={() => onClose()} />
      <div ref={panel} className="sr-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onPanelKey}>
        <h2 className="sr-hide" id={titleId}>
          Buscar en la web
        </h2>
        <div className="sr-field">
          <Icon name="search" size={20} stroke={2.2} />
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-label="Busca jugadores, partidos, rivales y secciones"
            aria-autocomplete="list"
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-activedescendant={at >= 0 ? optionId(at) : undefined}
            placeholder="Un jugador, un rival, J5, 12 oct…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onFieldKey}
          />
          <button type="button" className="sr-close" aria-label="Cerrar la búsqueda" onClick={() => onClose()}>
            <Icon name="x" size={18} stroke={2.2} />
          </button>
        </div>
        <div className="sr-body">
          <div role="listbox" id={listId} aria-label={query.trim() ? "Resultados" : "Sugerencias"} className="sr-list">
            {sections.map((s, si) => (
              <div key={s.title} role="group" aria-labelledby={`${listId}-g${si}`} className="sr-group">
                <div id={`${listId}-g${si}`} className="sr-gh" role="presentation">
                  {s.title}
                </div>
                {s.options.map((o) => {
                  index++;
                  const i = index;
                  const on = i === at;
                  return (
                    <div
                      key={o.key}
                      id={optionId(i)}
                      role="option"
                      aria-selected={on}
                      className={`sr-row${on ? " on" : ""}`}
                      onPointerDown={(e) => e.preventDefault()}
                      onPointerMove={() => i !== at && setActive(i)}
                      onClick={() => choose(o)}
                    >
                      <span className="sr-kind">{o.type === "entry" ? KIND_LABEL[o.entry.kind] : "Reciente"}</span>
                      <span className="sr-txt">
                        <span className="sr-t">{o.type === "entry" ? o.entry.title : o.query}</span>
                        {o.type === "entry" && o.entry.detail && <span className="sr-d">{o.entry.detail}</span>}
                      </span>
                      <span className="sr-go" aria-hidden="true">
                        <Icon name="right" size={16} stroke={2.2} />
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {query.trim() && !options.length && (
            <p className="sr-none">
              Ni rastro de «{query.trim()}» en el club. Prueba con un nombre, un dorsal, un rival, «J5» o una fecha como «12 oct».
            </p>
          )}
          {!query.trim() && !options.length && <p className="sr-none">Escribe un nombre, un rival, una jornada («J5») o una fecha («12 oct»).</p>}
        </div>
        <p className="sr-foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> moverte
          </span>
          <span>
            <kbd>Enter</kbd> abrir
          </span>
          <span>
            <kbd>Esc</kbd> cerrar
          </span>
        </p>
        <p className="sr-hide" role="status">
          {status}
        </p>
      </div>
    </div>,
    document.body,
  );
}
