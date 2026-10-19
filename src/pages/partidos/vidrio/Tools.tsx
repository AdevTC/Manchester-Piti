// The ribbon's ornaments: the season (a select-only combobox with a glass list), which jornadas to see
// (Todos · Próximos · Resultados; one cycling button on a phone), the count line, and «Buscar rival» (a
// searchbox whose matches jump to their jornada).
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { STRIP_FILTERS, type StripFilter, type StripSegment } from "../../../lib/derived/vidrio/strip";
import { searchRival } from "../../../lib/derived/vidrio/strip";
import { Glyph } from "./bits";
import { shortDay } from "./model";

export interface SeasonOption {
  id: string;
  name: string;
  /** «La de ahora, liga de fútbol 7» · «Cerrada: de septiembre a mayo». */
  sub: string;
  /** A short tail next to the name on a desktop («liga de fútbol 7»). */
  tail: string;
}

export function SeasonPicker({ options, value, onPick }: { options: readonly SeasonOption[]; value: string; onPick: (id: string) => void }) {
  const id = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement | null>(null);
  const current = options.find((o) => o.id === value) ?? options[0];
  const openAt = (i: number) => {
    setActive(Math.max(0, i));
    setOpen(true);
  };
  const choose = (i: number) => {
    const o = options[i];
    setOpen(false);
    button.current?.focus();
    if (o && o.id !== value) onPick(o.id);
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const at = options.findIndex((o) => o.id === value);
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openAt(at);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  };
  if (!current) return null;
  return (
    <div className="vp-pop">
      <span id={`${id}-l`} className="vd-vh">
        Temporada
      </span>
      <button
        ref={button}
        type="button"
        role="combobox"
        className="vd-glass vd-btn vd-press vp-season"
        aria-labelledby={`${id}-l`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-o${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openAt(options.findIndex((o) => o.id === value)))}
        onKeyDown={onKey}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <span id={`${id}-v`}>{current.name}</span>
        {current.tail && <small aria-hidden="true">{current.tail}</small>}
        <Glyph name="chev" />
      </button>
      <ul className="vd-glass vp-menu" id={`${id}-list`} role="listbox" aria-label="Temporadas" hidden={!open}>
        {options.map((o, i) => (
          <li
            key={o.id}
            id={`${id}-o${i}`}
            role="option"
            aria-selected={o.id === value}
            className={`vp-menu__i${i === active ? " is-active" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(i)}
          >
            <b>{o.name}</b>
            <span>{o.sub}</span>
            {o.id === value && <Glyph name="check" />}
          </li>
        ))}
      </ul>
    </div>
  );
}

const NEXT: Record<StripFilter, StripFilter> = { todos: "proximos", proximos: "resultados", resultados: "todos" };

export function Filters({ value, onChange }: { value: StripFilter; onChange: (f: StripFilter) => void }) {
  const at = STRIP_FILTERS.findIndex((f) => f.id === value);
  const label = STRIP_FILTERS[at]?.label ?? "Todos";
  return (
    <>
      <div className="vd-glass vd-seg vp-filt" role="group" aria-label="Qué jornadas ver" style={{ "--n": 3, "--i": at } as CSSProperties}>
        <span className="vd-shelf__bead" aria-hidden="true" />
        {STRIP_FILTERS.map((f) => (
          <button key={f.id} type="button" className="vd-seg__b" aria-pressed={f.id === value} onClick={() => onChange(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press vp-filtbtn" onClick={() => onChange(NEXT[value])} aria-label={`Ver: ${label}. Cambiar`}>
        <Glyph name="filter" />
        {label}
      </button>
    </>
  );
}

export function RivalSearch({ segments, onJump }: { segments: readonly StripSegment[]; onJump: (id: string) => void }) {
  const id = useId().replace(/:/g, "");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const list = useRef<HTMLUListElement | null>(null);
  const found = searchRival(segments, q, 6);
  const typed = q.trim().length > 0;
  const jump = (s: StripSegment) => {
    setQ(s.rival);
    setOpen(false);
    onJump(s.id);
  };
  const sub = (s: StripSegment) => {
    const day = s.at !== null && s.state !== "aplazado" ? shortDay(s.at) : "Sin fecha";
    const tail = s.state === "jugado" && s.score ? `, ${s.score.gf}–${s.score.ga}` : s.state === "directo" ? ", en directo" : s.state === "aplazado" ? ", aplazado" : "";
    return `${day}${tail}`;
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && found[0]) {
      e.preventDefault();
      jump(found[0]);
    } else if (e.key === "ArrowDown" && found.length) {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>("button")?.focus());
    } else if (e.key === "Escape") setOpen(false);
  };
  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      buttons[Math.min(buttons.length - 1, at + 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (at <= 0) input.current?.focus();
      else buttons[at - 1]?.focus();
    } else if (e.key === "Escape") {
      setOpen(false);
      input.current?.focus();
    }
  };
  return (
    <div
      className="vp-pop vp-pop--find"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label className="vd-glass vp-find">
        <span className="vd-vh">Buscar rival</span>
        <Glyph name="search" />
        <input
          ref={input}
          type="search"
          placeholder=" "
          value={q}
          autoComplete="off"
          aria-describedby={`${id}-n`}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (q) setOpen(true);
          }}
          onKeyDown={onKey}
        />
        <span className="vp-find__ph" aria-hidden="true">
          <span className="vp-find__ph-d">Buscar rival</span>
          <span className="vp-find__ph-m">Rival</span>
        </span>
      </label>
      <span id={`${id}-n`} className="vd-vh" role="status">
        {typed ? (found.length ? `${found.length} ${found.length === 1 ? "jornada" : "jornadas"} con ese rival` : "Ningún rival se llama así esta temporada") : ""}
      </span>
      {open && typed && (
        <div className="vd-glass vp-menu vp-menu--r">
          {found.length ? (
            <ul ref={list} aria-label="Jornadas encontradas" onKeyDown={onListKey}>
              {found.map((s) => (
                <li key={s.id}>
                  <button type="button" className="vp-menu__i" onClick={() => jump(s)}>
                    <b>
                      J{s.jornada ?? "·"}, {s.rival}
                    </b>
                    <span>{sub(s)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="vp-menu__none">Ningún rival se llama así esta temporada.</p>
          )}
        </div>
      )}
    </div>
  );
}
