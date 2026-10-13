// La pizarra · Bloque 5 — Tableros organizados and the capitán rotativo, as Tableros shows them: the tags
// of the board on screen, the search / sort / tag filter over Mis tableros, the «Recientes» strip and,
// in Partido, who should wear the brazalete next. Classes are b5e- (the generated pizarra.css owns the
// short names).
import { useId, useState } from "react";
import { Icon } from "./icons";
import { SORTS, type BoardSort } from "./boardList";
import { addTag, removeTag, tagError, tagSuggestions, TAG_MAX, TAGS_MAX } from "./tags";
import "../../../styles/pizarra-equipo.css";

/** The tags of the board on screen: chips to take off, a field and the usual suggestions to add. */
export function TagEditor({ tags, inUse, ro, onChange }: { tags: readonly string[]; inUse: readonly string[]; ro: boolean; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const errId = useId();
  const add = (t: string) => {
    const e = tagError(t, tags);
    setErr(e);
    if (e) return;
    onChange(addTag(tags, t));
    setDraft("");
  };
  const full = tags.length >= TAGS_MAX;
  const sugg = full || ro ? [] : tagSuggestions(tags, inUse);
  return (
    <div className="b5e-tags" role="group" aria-label="Etiquetas del tablero">
      {tags.length > 0 && (
        <ul className="b5e-chips">
          {tags.map((t) => (
            <li key={t}>
              <span>{t}</span>
              {!ro && (
                <button type="button" onClick={() => onChange(removeTag(tags, t))} aria-label={"Quitar la etiqueta «" + t + "»"}>
                  <Icon n="x" w={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!ro && !full && (
        <div className="b5e-add">
          <input
            type="text"
            value={draft}
            maxLength={TAG_MAX}
            placeholder="Liga, Copa, Entreno…"
            aria-label="Nueva etiqueta"
            aria-invalid={!!err}
            aria-describedby={err ? errId : undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              setErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
          />
          <button type="button" className="b3" onClick={() => add(draft)}>
            <Icon n="plus" w={14} />
            Etiquetar
          </button>
        </div>
      )}
      {sugg.length > 0 && (
        <div className="b5e-sugg">
          {sugg.map((t) => (
            <button key={t} type="button" onClick={() => add(t)} aria-label={"Añadir la etiqueta «" + t + "»"}>
              + {t}
            </button>
          ))}
        </div>
      )}
      {full && !ro && <small className="b5e-note">{TAGS_MAX} de {TAGS_MAX} etiquetas: quita una para poner otra.</small>}
      {err && (
        <p className="b5e-err" id={errId} role="alert">
          {err}
        </p>
      )}
    </div>
  );
}

/** Search, sort and tag filter over Mis tableros. */
export function BoardOrganizer(p: {
  q: string;
  onQ: (q: string) => void;
  sort: BoardSort;
  onSort: (s: BoardSort) => void;
  tags: readonly string[];
  tag: string | null;
  onTag: (t: string | null) => void;
  count: string | null;
}) {
  return (
    <div className="b5e-org">
      <label className="b5e-q">
        <Icon n="search" w={16} />
        <input type="search" value={p.q} onChange={(e) => p.onQ(e.target.value)} placeholder="Nombre, rival o etiqueta" aria-label="Buscar tableros" />
      </label>
      <div className="b5e-seg" role="group" aria-label="Ordenar los tableros">
        {SORTS.map((s) => (
          <button key={s.k} type="button" onClick={() => p.onSort(s.k)} aria-pressed={p.sort === s.k}>
            {s.l}
          </button>
        ))}
      </div>
      {p.tags.length > 0 && (
        <div className="b5e-sugg" role="group" aria-label="Filtrar por etiqueta">
          <button type="button" onClick={() => p.onTag(null)} aria-pressed={!p.tag}>
            Todas
          </button>
          {p.tags.map((t) => (
            <button key={t} type="button" onClick={() => p.onTag(p.tag === t ? null : t)} aria-pressed={p.tag === t}>
              {t}
            </button>
          ))}
        </div>
      )}
      <p className="b5e-n" role="status">
        {p.count ?? ""}
      </p>
    </div>
  );
}

/** «Recientes»: the boards opened last on this device, one tap away. */
export function RecentStrip({ rows, onOpen }: { rows: { id: string; name: string }[]; onOpen: (id: string) => void }) {
  if (!rows.length) return null;
  return (
    <nav className="b5e-rec" aria-label="Tableros recientes">
      <span className="k2">Recientes</span>
      <div className="b5e-rl">
        {rows.map((b) => (
          <button key={b.id} type="button" onClick={() => onOpen(b.id)} aria-label={"Abrir " + b.name}>
            {b.name}
          </button>
        ))}
      </div>
    </nav>
  );
}

/** The row's tags in Mis tableros. */
export function RowTags({ tags }: { tags?: readonly string[] }) {
  if (!tags?.length) return null;
  return (
    <span className="b5e-rt">
      {tags.map((t) => (
        <i key={t}>{t}</i>
      ))}
    </span>
  );
}

export interface CaptainView {
  /** The suggestion's name (null = nobody to suggest). */
  name: string | null;
  why: string;
  rows: { id: string; name: string; txt: string }[];
  already: boolean;
  canApply: boolean;
  onApply: () => void;
}

/** «Capitán rotativo» (Tableros → Partido): who should wear the brazalete next, applied with one tap. */
export function CaptainCard({ c }: { c: CaptainView }) {
  const hId = useId();
  return (
    <section className="b5e-cap" aria-labelledby={hId}>
      <h3 id={hId}>Capitán rotativo</h3>
      {c.name ? (
        <p className="b5e-who">
          Le toca el brazalete a <b>{c.name}</b>
        </p>
      ) : null}
      <small>{c.why}</small>
      {c.name && (
        <button type="button" className="b3 gold" onClick={c.onApply} disabled={!c.canApply || c.already}>
          <Icon n="check" w={14} />
          {c.already ? "Ya lleva el brazalete" : "Darle el brazalete"}
        </button>
      )}
      {c.rows.length > 1 && (
        <details className="b5e-det">
          <summary>Brazaletes del siete</summary>
          <ul>
            {c.rows.map((r) => (
              <li key={r.id}>
                <b>{r.name}</b> <span>{r.txt}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
