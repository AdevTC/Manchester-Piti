import { useId, useState } from "react";
import "./analysis-panels.css";

export interface ScopeOption { id: string; label: string }

/** Native disclosure keeps the long lists usable with touch and keyboard, without trapping focus. */
export function ScopePicker({ label, options, selected = [], onChange, disabled = false }: {
  label: string; options: ScopeOption[]; selected?: string[]; onChange: (ids: string[]) => void; disabled?: boolean;
}) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const missing = selected.filter(id => !options.some(option => option.id === id));
  const choices = [...options, ...missing.map(id => ({ id, label: `No disponible · ${id}` }))];
  const filtered = choices.filter(option => option.label.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
  const caption = !selected.length ? "Todos" : selected.length === 1 ? choices.find(option => option.id === selected[0])?.label : `${selected.length} seleccionados`;
  return <details className="an-scope" onKeyDown={event => {
    if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
  }}>
    <summary aria-label={`Filtrar ${label.toLocaleLowerCase("es")}`}><span>{label}</span><b>{caption}</b><span aria-hidden="true">⌄</span></summary>
    <div className="an-scope__body">
      <label htmlFor={uid}>Buscar {label.toLocaleLowerCase("es")}</label>
      <input id={uid} type="search" value={query} onChange={event => setQuery(event.target.value)} disabled={disabled} />
      <button type="button" disabled={disabled || !selected.length} onClick={() => onChange([])}>Quitar selección</button>
      <fieldset disabled={disabled}><legend className="sr-only">Seleccionar {label.toLocaleLowerCase("es")}</legend>
        {filtered.map(option => <label key={option.id}><input type="checkbox" checked={selected.includes(option.id)} onChange={event => onChange(event.target.checked ? [...selected, option.id] : selected.filter(id => id !== option.id))}/><span>{option.label}</span></label>)}
      </fieldset>
      {!filtered.length && <p>No hay coincidencias.</p>}
    </div>
  </details>;
}
