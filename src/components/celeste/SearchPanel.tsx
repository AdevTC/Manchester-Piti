// «Buscar» as the TU boards draw it (shell.html `tu-sr`, component.js searchModel): a glass window over the dimmed
// page — on a desktop under the top bar with a preview beside the results (the printed shirt, the score and its
// goal line, the rival's initials), on a phone the whole screen. The field is a combobox that keeps the focus:
// ↑ ↓ move the active result, Intro opens it, Tab changes where to search (Todo · Jugadores · Partidos · Rivales ·
// Tu página · Acciones), Backspace on an empty field drops the scope, Esc empties the field, then drops the scope,
// then closes. Empty, it offers «Lo próximo», four «Acciones» and the recent searches (each one removable,
// «Borrar» all). The model is pure (searchModel searchView); the data and where a choice leads come from
// SearchDialog, so this is testable bare. It floats in the boards' layer (TuLayer, `o-buscar`).
import { useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { readRecent, rememberSearch, RECENT_KEY } from "../../lib/recentSearches";
import { KitStillContext } from "../jersey3d/kitStill";
import { TuIcon, TuLayer } from "../vidrio/tu/ui";
import { countText, fold, goLabel, nextScope, SCOPES, searchView, type SrEntry, type SrScope, type SrViewerKind } from "./searchModel";
import "./search.css";

export interface SearchPanelProps {
  entries: readonly SrEntry[];
  viewer: SrViewerKind;
  /** A result was chosen (the query that found it is already remembered). */
  onChoose: (entry: SrEntry) => void;
  /** Close (the scrim, the Esc button, Esc on an empty field). */
  onClose: () => void;
  /** Where it starts (the address's ?q=, or what the last opening left). */
  initial?: { q: string; scope: SrScope };
  /** Every change of the field or the scope (the address keeps ?q=; the next opening starts there). */
  onState?: (s: { q: string; scope: SrScope }) => void;
  /** /buscar: an address of its own (no page under it, so no scrim). */
  page?: boolean;
}

/** Storage may be missing or blocked: the list then lives only in this visit. */
function storeRecent(list: string[]): string[] {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // (blocked or full: this visit keeps it)
  }
  return list;
}

const FOCUSABLE = 'input,button:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** The printed shirt still (his name and number printed by the 3D scene); nothing until it is ready. */
function ShirtStill({ num, className }: { num?: string; className?: string }) {
  const still = useContext(KitStillContext)("home", num);
  if (!still) return null;
  return <img className={className} src={still.src} alt="" width={540} height={600} />;
}

export function SearchPanel({ entries, viewer, onChoose, onClose, initial, onState, page }: SearchPanelProps) {
  const [q, setQ] = useState(initial?.q ?? "");
  const [scope, setScopeRaw] = useState<SrScope>(initial?.scope ?? "todo");
  const [act, setAct] = useState(0);
  const [more, setMore] = useState<Partial<Record<string, boolean>>>({});
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const listId = useId();
  const oid = (i: number) => `${listId}-o${i}`;

  const view = useMemo(() => searchView(entries, { q, scope, more }, viewer), [entries, q, scope, more, viewer]);
  const n = view.flat.length;
  const at = n ? Math.min(act, n - 1) : -1;
  const active = at >= 0 ? view.flat[at] : null;

  const onStateRef = useRef(onState);
  useEffect(() => {
    onStateRef.current = onState;
  });
  useEffect(() => {
    onStateRef.current?.({ q, scope });
  }, [q, scope]);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (at < 0) return;
    document.getElementById(`${listId}-o${at}`)?.scrollIntoView?.({ block: "nearest" });
  }, [at, listId]);

  const type = (v: string) => {
    setQ(v);
    setAct(0);
    setMore({});
  };
  const setScope = (v: SrScope) => {
    setScopeRaw(v);
    setAct(0);
    setMore({});
    // (a chosen scope replaces the prefix that set one)
    setQ((x) => (/^[@#>]/.test(x) ? x.slice(1) : x));
    input.current?.focus({ preventScroll: true });
  };
  const choose = (e: SrEntry) => {
    const t = q.trim();
    if (t) setRecent(rememberSearch(t));
    onChoose(e);
  };
  const back = () => {
    if (q) type("");
    else if (scope !== "todo") setScope("todo");
    else onClose();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" && !e.altKey) {
      e.preventDefault();
      setScope(nextScope(scope, e.shiftKey));
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!n) return;
      setAct((Math.max(at, 0) + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active) choose(active);
    } else if (e.key === "Backspace" && !q && scope !== "todo") {
      e.preventDefault();
      setScope("todo");
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      back();
    }
  };
  // (outside the field: Esc does what it does in the field; Tab stays inside the dialog)
  const onDialogKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target === input.current) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (q || scope !== "todo") {
        back();
        input.current?.focus({ preventScroll: true });
      } else onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null || x === input.current);
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

  const typed = !!view.q;
  const showRecent = !view.q && view.scope === "todo" && recent.length > 0;
  const pv = active;
  let i = -1;

  return (
    <TuLayer cls="o-buscar">
      {!page && <div className="tu-scrim" aria-hidden="true" onClick={onClose} />}
      <div className="vd-glass vd-glass--deep tu-sr" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onDialogKey}>
        <h2 className="vd-vh" id={titleId}>
          Buscar en la web
        </h2>
        <div className="tu-sr__field">
          <TuIcon name="search" />
          {view.chip && (
            <button type="button" className="tu-sr__scope" onClick={() => setScope("todo")} aria-label={`Quitar el filtro ${view.chip}`}>
              {view.chip}
              <TuIcon name="close" />
            </button>
          )}
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-label="Busca jugadores, partidos, rivales y cosas que hacer"
            aria-autocomplete="list"
            aria-expanded={n > 0}
            aria-controls={listId}
            aria-activedescendant={at >= 0 ? oid(at) : undefined}
            placeholder={view.hint}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            value={q}
            onChange={(e) => type(e.target.value)}
            onKeyDown={onKey}
          />
          {typed && (
            <button
              type="button"
              className="tu-sr__clear"
              aria-label="Vaciar la búsqueda"
              onClick={() => {
                type("");
                input.current?.focus({ preventScroll: true });
              }}
            >
              <TuIcon name="close" />
            </button>
          )}
          <button type="button" className="tu-sr__esc" aria-label="Cerrar la búsqueda" onClick={onClose}>
            <kbd aria-hidden="true">Esc</kbd>
            <span className="tu-sr__escp">Cerrar</span>
          </button>
        </div>
        <div className="tu-sr__scopes" data-scroll-x="1" role="group" aria-label="Dónde buscar (Tab para cambiar)">
          {SCOPES.map(([id, t]) => {
            const on = view.scope === id;
            return (
              <button key={id} type="button" className={`tu-sr__sc${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => setScope(id)}>
                {t}
                {typed && id !== "todo" && <span>{view.counts[id]}</span>}
              </button>
            );
          })}
        </div>
        <div className="tu-sr__body">
          <div className="tu-sr__list">
            <div role="listbox" id={listId} aria-label="Resultados">
              {view.groups.map((g) => (
                <div key={g.key} role="group" aria-label={g.title} className={`tu-sr__g${g.best ? " is-best" : ""}`}>
                  <div className="tu-sr__gh" role="presentation">
                    <span>{g.title}</span>
                    {g.more > 0 && (
                      <button
                        type="button"
                        className="tu-sr__more"
                        aria-label={`Ver ${g.more} más en ${g.title}`}
                        onClick={() => {
                          setMore((m) => ({ ...m, [g.key]: true }));
                          input.current?.focus({ preventScroll: true });
                        }}
                      >
                        {g.more} más
                      </button>
                    )}
                  </div>
                  {g.items.map((e) => {
                    i++;
                    const k = i;
                    const on = k === at;
                    return (
                      <div
                        key={e.id}
                        id={oid(k)}
                        role="option"
                        aria-selected={on}
                        className={`tu-sr__hit k-${e.kind}${on ? " is-sel" : ""}`}
                        onPointerDown={(ev) => ev.preventDefault()}
                        onPointerMove={() => k !== at && setAct(k)}
                        onClick={() => choose(e)}
                      >
                        {e.kind === "jugador" ? (
                          <span className="tu-sr__shirt" aria-hidden="true">
                            <ShirtStill num={e.num} />
                          </span>
                        ) : e.kind === "rival" ? (
                          <span className="tu-sr__rv" aria-hidden="true">
                            {e.ini}
                          </span>
                        ) : (
                          <span className="tu-sr__ic" aria-hidden="true">
                            <TuIcon name={e.icon ?? "arrow"} />
                          </span>
                        )}
                        <span className="tu-sr__t">
                          <b>{e.title}</b>
                          <span>{e.detail}</span>
                        </span>
                        {e.res && (
                          <span className={`tu-res is-${e.res}`} aria-hidden="true">
                            {e.res}
                          </span>
                        )}
                        <kbd className="tu-sr__go" aria-hidden="true">
                          Intro
                        </kbd>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {view.none && (
              <div className="tu-sr__none">
                <b>{view.noneText}</b>
                {view.sugg && (
                  <span>
                    ¿Querías decir{" "}
                    <button type="button" className="vd-link" onClick={() => type(view.sugg)}>
                      {view.sugg}
                    </button>
                    ?
                  </span>
                )}
                {view.scope !== "todo" && (
                  <span>
                    <button type="button" className="vd-link" onClick={() => setScope("todo")}>
                      Buscar en todo
                    </button>
                  </span>
                )}
                <span>Prueba con un dorsal (11), una jornada (#1), un jugador (@kevin) o algo que hacer (&gt;tema).</span>
              </div>
            )}
            {showRecent && (
              <div className="tu-sr__g">
                <div className="tu-sr__gh">
                  <span>Búsquedas recientes</span>
                  <button
                    type="button"
                    className="tu-sr__more"
                    onClick={() => {
                      setRecent(storeRecent([]));
                      input.current?.focus({ preventScroll: true });
                    }}
                  >
                    Borrar
                  </button>
                </div>
                <ul className="tu-sr__recent">
                  {recent.map((r) => (
                    <li key={r}>
                      <button
                        type="button"
                        className="tu-sr__rq"
                        onClick={() => {
                          type(r);
                          input.current?.focus({ preventScroll: true });
                        }}
                      >
                        <TuIcon name="clock" />
                        {r}
                      </button>
                      <button
                        type="button"
                        className="tu-sr__rx"
                        aria-label={`Quitar «${r}» de las recientes`}
                        onClick={() => {
                          setRecent((list) => storeRecent(list.filter((x) => fold(x) !== fold(r))));
                          input.current?.focus({ preventScroll: true });
                        }}
                      >
                        <TuIcon name="close" />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="tu-sr__tips">
                  <kbd>@</kbd> jugadores · <kbd>#</kbd> jornadas · <kbd>&gt;</kbd> acciones
                </p>
              </div>
            )}
          </div>
          {pv && (
            <aside className="tu-sr__pv" aria-label="Vista previa">
              {pv.kind === "jugador" && <ShirtStill num={pv.num} className="tu-sr__pvimg" />}
              {pv.kind === "partido" && (
                <>
                  <p className={`tu-sr__score r-${pv.res ?? "x"}`}>
                    <b>{pv.pv.score}</b>
                    <span>{pv.pv.word}</span>
                  </p>
                  {!!pv.pv.marks?.length && (
                    <div className="tu-tl" aria-hidden="true">
                      <span className="tu-tl__half" />
                      {pv.pv.marks.map((m, j) => (
                        <i key={j} className={`k-${m.k}`} style={{ left: `${m.left.toFixed(1)}%` }} />
                      ))}
                    </div>
                  )}
                </>
              )}
              {pv.kind === "rival" && (
                <span className="tu-sr__rv tu-sr__rv--big" aria-hidden="true">
                  {pv.ini}
                </span>
              )}
              {pv.kind !== "jugador" && pv.kind !== "partido" && pv.kind !== "rival" && (
                <span className="tu-sr__ic tu-sr__ic--big" aria-hidden="true">
                  <TuIcon name={pv.icon ?? "arrow"} />
                </span>
              )}
              <b className="tu-sr__pvt">{pv.title}</b>
              <span className="tu-sr__pvd">{pv.detail}</span>
              {pv.pv.line && <p className="tu-sr__pvl">{pv.pv.line}</p>}
              {pv.pv.list && <p className="tu-small">{pv.pv.list}</p>}
              {pv.pv.url && <code className="tu-code">{pv.pv.url}</code>}
              <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={() => choose(pv)}>
                {goLabel(pv.kind)}
                <TuIcon name="arrow" />
              </button>
            </aside>
          )}
        </div>
        <div className="tu-sr__foot">
          <span aria-hidden="true">
            <kbd>↑</kbd>
            <kbd>↓</kbd> moverte
          </span>
          <span aria-hidden="true">
            <kbd>Intro</kbd> abrir
          </span>
          <span aria-hidden="true">
            <kbd>Tab</kbd> dónde buscar
          </span>
          <span aria-hidden="true">
            <kbd>Esc</kbd> vaciar y cerrar
          </span>
          {typed && <span className="tu-sr__count">{countText(view.total)}</span>}
        </div>
        <p className="vd-vh" role="status">
          {typed ? countText(view.total) : ""}
        </p>
      </div>
    </TuLayer>
  );
}
