// «Buscar, con ⌘K» (V-Integracion): a glass window over the dimmed page. The field (a combobox: it keeps the focus;
// ↑ ↓ move the active option, Intro opens it, Esc empties it and, empty, closes) and the results grouped in the
// boards' order — «Ahora» first (the match of the moment), then Jugadores, Jornadas, Equipos, Acciones, Páginas —
// three per group (two for «Ahora») with «N más» on the group's head (which shows the rest of that group), rows
// with an icon chip or the player's shirt and dorsal, «Intro» on the active one. Below: «↑ ↓ para moverte · Intro
// para abrir · Ver los N resultados · N resultados»; «Ver los N resultados» grows the same window to almost the
// whole screen with its own scroll («Ver menos» brings it back). Empty, it offers «Ahora», «Acciones» and the last
// searches (lib/recentSearches). Portalled to the body. The data and the navigation come from SearchDialog, so
// this is testable bare.
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { readRecent, rememberSearch } from "../../lib/recentSearches";
import { VIcon } from "../vidrio/VIcon";
import { countText, groupCap, groupResults, type PanelEntry, type PanelKind } from "./searchModel";
import "../../styles/vidrio/reading.css";

type Option = { key: string; type: "entry"; entry: PanelEntry } | { key: string; type: "recent"; query: string };
interface Section {
  key: string;
  title: string;
  options: Option[];
  /** Hits of the group not shown (its «N más»). */
  more: number;
  kind?: PanelKind;
}

export interface SearchPanelProps {
  entries: readonly PanelEntry[];
  /** A result was chosen (the query that found it is already remembered). */
  onGo: (entry: PanelEntry) => void;
  onClose: (refocus?: boolean) => void;
}

const FOCUSABLE = 'input,button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function SearchPanel({ entries, onGo, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const [all, setAll] = useState(false);
  const [opened, setOpened] = useState<ReadonlySet<PanelKind>>(() => new Set());
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const listId = useId();

  const groups = useMemo(() => groupResults(entries, query), [entries, query]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const sections: Section[] = useMemo(() => {
    const out: Section[] = groups.map((g) => {
      const cap = all || opened.has(g.kind) ? g.items.length : groupCap(g.kind);
      const items = g.items.slice(0, cap);
      return { key: g.kind, kind: g.kind, title: g.title, more: g.items.length - items.length, options: items.map((entry) => ({ key: entry.id, type: "entry" as const, entry })) };
    });
    if (!query.trim() && recent.length) out.push({ key: "recent", title: "Búsquedas recientes", more: 0, options: recent.map((q) => ({ key: `r-${q}`, type: "recent" as const, query: q })) });
    return out;
  }, [groups, all, opened, query, recent]);
  const options = useMemo(() => sections.flatMap((s) => s.options), [sections]);
  const shownCount = options.filter((o) => o.type === "entry").length;
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
    } else if (e.key === "Escape" && query) {
      // (Esc empties the field first; empty, it closes)
      e.preventDefault();
      e.stopPropagation();
      setQuery("");
      setActive(0);
      setAll(false);
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

  const typed = !!query.trim();
  const status = typed ? (total ? countText(total) : "Sin resultados") : "";
  const showAll = !all && total > shownCount;

  let index = -1;
  return createPortal(
    <div className="sr-portal vd-sr">
      <div className="sr-scrim vd-sr__scrim" aria-hidden="true" onPointerDown={() => onClose()} />
      <div ref={panel} className={`vd-glass vd-glass--deep vd-sr__win${all ? " is-all" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onPanelKey} style={{ viewTransitionName: "vd-search" } as CSSProperties}>
        <h2 className="vd-vh" id={titleId}>
          Buscar en la web
        </h2>
        <div className="vd-sr__field">
          <VIcon name="search" size={22} />
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-label="Busca jugadores, jornadas, equipos y cosas que hacer"
            aria-autocomplete="list"
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-activedescendant={at >= 0 ? optionId(at) : undefined}
            placeholder="Un jugador, una jornada o algo que hacer"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpened(new Set());
            }}
            onKeyDown={onFieldKey}
          />
          <button type="button" className="vd-sr__esc" aria-label="Cerrar la búsqueda" onClick={() => onClose()}>
            <kbd aria-hidden="true">Esc</kbd>
          </button>
        </div>
        <div className="vd-sr__hits">
          <div role="listbox" id={listId} aria-label={typed ? "Resultados" : "Ahora y cosas que hacer"}>
            {sections.map((s, si) => (
              <div key={s.key} role="group" aria-labelledby={`${listId}-g${si}`} className="vd-sr__group">
                <div className="vd-sr__gh" role="presentation">
                  <span id={`${listId}-g${si}`}>{s.title}</span>
                  {s.more > 0 && s.kind && (
                    <button
                      type="button"
                      className="vd-sr__more"
                      onClick={() => {
                        const kind = s.kind as PanelKind;
                        setOpened((o) => new Set([...o, kind]));
                        input.current?.focus();
                      }}
                      aria-label={`Ver ${s.more} más en ${s.title}`}
                    >
                      {s.more} más
                    </button>
                  )}
                </div>
                {s.options.map((o) => {
                  index++;
                  const i = index;
                  const on = i === at;
                  const e = o.type === "entry" ? o.entry : null;
                  return (
                    <div
                      key={o.key}
                      id={optionId(i)}
                      role="option"
                      aria-selected={on}
                      className={`vd-sr__hit${on ? " is-sel" : ""}${e?.live ? " is-live" : ""}`}
                      onPointerDown={(ev) => ev.preventDefault()}
                      onPointerMove={() => i !== at && setActive(i)}
                      onClick={() => choose(o)}
                    >
                      {e?.shirt ? (
                        <span className="vd-shirt vd-sr__shirt" aria-hidden="true">
                          <b>{e.shirt}</b>
                        </span>
                      ) : (
                        <span className="vd-sr__i" aria-hidden="true">
                          <VIcon name={e?.icon ?? "search"} size={20} />
                        </span>
                      )}
                      <span className="vd-sr__t">
                        <b>{e ? e.title : o.type === "recent" ? o.query : ""}</b>
                        {e?.detail ? <span>{e.detail}</span> : o.type === "recent" ? <span>Búsqueda reciente</span> : null}
                      </span>
                      <kbd className="vd-sr__go" aria-hidden="true">
                        Intro
                      </kbd>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {typed && !groups.some((g) => g.kind !== "ahora") && <p className="vd-sr__empty">Nada con «{query.trim()}». Prueba con un dorsal, un rival o «calendario».</p>}
        </div>
        <div className="vd-sr__foot">
          <span aria-hidden="true">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            para moverte
          </span>
          <span aria-hidden="true">
            <kbd>Intro</kbd>
            para abrir
          </span>
          {showAll && (
            <button type="button" className="vd-more__btn vd-sr__all" onClick={() => setAll(true)}>
              Ver los {total} resultados
              <VIcon name="expand" size={16} />
            </button>
          )}
          {all && (
            <button type="button" className="vd-more__btn vd-sr__all" onClick={() => setAll(false)}>
              Ver menos
              <VIcon name="collapse" size={16} />
            </button>
          )}
          {typed && <span className="vd-sr__count">{countText(total)}</span>}
        </div>
        <p className="vd-vh" role="status">
          {status}
        </p>
      </div>
    </div>,
    document.body,
  );
}
