// The content editor drawer (Contenido, `?seccion=`): one section of the club page at a time, with the
// fields the old editor had — frase / localidad / fundación / campo; nuestra historia and the crest's;
// contacto, Instagram and the team photo; momentos (add, edit, remove, reorder); player stories; preguntas;
// colaboradores; galería (each link ✓ HTTPS / ✕ no es HTTPS, live) — saved as a DRAFT on this device
// («Guardar borrador» → «Sin publicar»). «Descartar borrador» goes back to what is published. The
// unsaved-changes guard covers every way out.
import { useId, useRef, useState, type ReactNode } from "react";
import type { ClubContent } from "../../../lib/clubContent";
import type { PlayerDoc } from "../../../lib/schemas";
import { clockTime } from "../data/adminLogic";
import { FieldCheck, TextAreaField, TextField } from "../ui/controls";
import { AdIcon } from "../ui/icons";
import { Drawer } from "../ui/layers";
import { useUnsavedGuard } from "../ui/guard";
import { LIMITS, emailOk, same, sectionTitle, sliceOf, type ClubKey, type ContentKey, type DraftEntry, type PlayerStory, type Slice } from "./contentModel";
import { linkState } from "./plantillaLogic";

type Milestone = ClubContent["milestones"][number];
type Faq = ClubContent["faq"][number];
type Sponsor = ClubContent["sponsors"][number];
type Photo = ClubContent["gallery"][number];

export interface StoryPlayer {
  id: string;
  name: string;
  number: number | null;
  doc: PlayerDoc;
}
export interface ContentDrawerProps {
  section: ContentKey;
  /** Published content (as the web shows it). */
  live: ClubContent;
  /** This section's draft (club sections). */
  draft?: DraftEntry<Slice>;
  /** Player stories' drafts. */
  storyDrafts: Record<string, DraftEntry<PlayerStory>>;
  /** Players for «Historias», squad first. */
  players: readonly StoryPlayer[];
  /** Published story of a player. */
  liveStory: (id: string) => PlayerStory;
  /** The web changed since this section's draft was saved. */
  stale: boolean;
  onClose: () => void;
  /** Saves the draft; `then` closes (or not, for the guard's «Guardar borrador y salir»). */
  onSaveClub: (key: ClubKey, value: Slice) => void;
  onSaveStories: (values: Record<string, PlayerStory>) => void;
  onDiscard: (key: ContentKey) => void;
}

const LINK_TEXT = { empty: "Pega un enlace que empiece por https://", ok: "HTTPS · se ve en la web", bad: "No es HTTPS · no se verá en la web" } as const;
const linkCheck = (v: string) => {
  const s = linkState(v);
  return { tone: s === "empty" ? ("mut" as const) : s === "ok" ? ("ok" as const) : ("bad" as const), text: LINK_TEXT[s] };
};
function LinkField({ label, value, onChange, wide, placeholder = "https://" }: { label: string; value: string; onChange: (v: string) => void; wide?: boolean; placeholder?: string }) {
  const c = linkCheck(value);
  return <TextField label={label} wide={wide} value={value} inputMode="url" placeholder={placeholder} onChange={(e) => onChange(e.target.value)} state={c.tone === "bad" ? "bad" : c.tone === "ok" ? "good" : undefined} check={c} autoComplete="off" />;
}
/** ↑ ↓ 🗑 for a list item. */
function ItemActions({ i, n, what, onMove, onRemove, extra }: { i: number; n: number; what: string; onMove: (from: number, to: number) => void; onRemove: (i: number) => void; extra?: ReactNode }) {
  return (
    <span className="ad-acts">
      {extra}
      <button type="button" className="ib" data-act="up" aria-label={`Subir ${what}`} disabled={i === 0} onClick={() => onMove(i, i - 1)}>
        <AdIcon name="back" size={16} />
      </button>
      <button type="button" className="ib" data-act="down" aria-label={`Bajar ${what}`} disabled={i === n - 1} onClick={() => onMove(i, i + 1)}>
        <AdIcon name="right" size={16} />
      </button>
      <button type="button" className="ib" aria-label={`Quitar ${what}`} onClick={() => onRemove(i)}>
        <AdIcon name="trash" size={16} />
      </button>
    </span>
  );
}
const moved = <T,>(list: readonly T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return [...list];
  const out = [...list];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
};

export function ContentDrawer(props: ContentDrawerProps) {
  const { section, live, draft, storyDrafts, players, liveStory, stale, onClose, onSaveClub, onSaveStories, onDiscard } = props;
  const isStories = section === "historias";
  const title = sectionTitle(section);
  const [start] = useState<Slice>(() => (isStories ? {} : (draft?.value ?? sliceOf(live, section as ClubKey))));
  const [value, setValue] = useState<Slice>(start);
  const storyStart = (id: string) => storyDrafts[id]?.value ?? liveStory(id);
  const [stories, setStories] = useState<Record<string, PlayerStory>>({});
  const firstMissing = players.find((p) => !storyStart(p.id).bio.trim())?.id ?? players[0]?.id ?? "";
  const [pid, setPid] = useState(firstMissing);
  const leaving = useRef(false);

  const dirty = isStories ? Object.entries(stories).some(([id, v]) => !same(v, storyStart(id))) : !same(value, start);
  const hasDraft = isStories ? Object.keys(storyDrafts).length > 0 : !!draft;
  const save = () => {
    if (!dirty) return;
    leaving.current = true;
    if (isStories) onSaveStories(stories);
    else onSaveClub(section as ClubKey, value);
  };
  const guard = useUnsavedGuard(dirty, {
    what: `«${title}»`,
    alt: { label: "Guardar borrador y salir", run: save },
    shouldBlock: () => !leaving.current,
  });
  const close = () => guard.run(onClose);

  const savedAt = isStories ? Math.max(0, ...Object.values(storyDrafts).map((d) => d.at)) : (draft?.at ?? 0);
  const status = dirty
    ? { text: "● Cambios sin guardar", tone: "warn" as const }
    : hasDraft
      ? { text: `● Borrador guardado${savedAt ? ` a las ${clockTime(savedAt)}` : ""} · sin publicar`, tone: "warn" as const }
      : { text: "✓ Igual que lo publicado", tone: "ok" as const };

  const set = <K extends keyof ClubContent>(k: K, v: ClubContent[K]) => setValue((s) => ({ ...s, [k]: v }));
  const v = { ...live, ...value } as ClubContent;

  return (
    <Drawer
      open
      onClose={close}
      kicker="Contenido del club"
      title={title}
      status={status}
      className="ad-cdrw"
      footer={
        <>
          {hasDraft && (
            <button type="button" className="btn sm red" onClick={() => {
              leaving.current = true;
              onDiscard(section);
            }}>
              Descartar borrador
            </button>
          )}
          <span className="sp" />
          <button type="button" className="btn sm line" onClick={close}>
            Cancelar
          </button>
          <button type="button" className="btn sm pri" aria-disabled={!dirty} onClick={save}>
            <AdIcon name="check" size={16} />
            Guardar borrador
          </button>
        </>
      }
    >
      <div className="fg2">
        {stale && (
          <p className="note w2 ad-warn" role="status">
            <AdIcon name="alert" size={15} />
            Ha cambiado en la web desde que guardaste este borrador: si publicas, tu versión sustituye a la de la web.
          </p>
        )}
        {section === "frase" && (
          <>
            <TextAreaField label="Frase de presentación" wide maxLength={LIMITS.intro} value={v.intro} onChange={(e) => set("intro", e.target.value)} hint={`${v.intro.length}/${LIMITS.intro + 1}`} />
            <TextField label="Localidad" value={v.location} onChange={(e) => set("location", e.target.value)} autoComplete="off" />
            <TextField label="Año de fundación" className="tn" inputMode="numeric" maxLength={4} value={v.founded} onChange={(e) => set("founded", e.target.value)} autoComplete="off" />
            <TextField label="Campo y dirección" wide value={v.venue} onChange={(e) => set("venue", e.target.value)} autoComplete="off" />
          </>
        )}
        {section === "historia" && (
          <>
            <TextAreaField label="Nuestra historia" wide rows={7} maxLength={LIMITS.story} value={v.story} onChange={(e) => set("story", e.target.value)} />
            <TextAreaField label="La historia del escudo" wide rows={4} maxLength={LIMITS.crestStory} placeholder="Quién lo dibujó, qué significa cada pieza…" value={v.crestStory} onChange={(e) => set("crestStory", e.target.value)} />
          </>
        )}
        {section === "contacto" && (
          <>
            <TextField
              label="Correo de contacto"
              type="email"
              value={v.email}
              onChange={(e) => set("email", e.target.value)}
              state={v.email.trim() ? (emailOk(v.email) ? "good" : "bad") : undefined}
              check={v.email.trim() ? (emailOk(v.email) ? { tone: "ok", text: "Correo válido" } : { tone: "bad", text: "Revisa el correo" }) : undefined}
              autoComplete="off"
            />
            <LinkField label="Enlace de Instagram" value={v.instagram} onChange={(x) => set("instagram", x)} placeholder="https://instagram.com/…" />
            <LinkField label="Foto de equipo (URL HTTPS)" wide value={v.photoUrl} onChange={(x) => set("photoUrl", x)} />
            {linkState(v.photoUrl) === "ok" && <img className="ad-prev w2" src={v.photoUrl.trim()} alt="Foto del equipo (vista previa)" />}
          </>
        )}
        {section === "momentos" && <Moments live={live.milestones} list={v.milestones} onChange={(x) => set("milestones", x)} />}
        {section === "preguntas" && <Questions list={v.faq ?? []} onChange={(x) => set("faq", x)} />}
        {section === "colaboradores" && <Sponsors list={v.sponsors} onChange={(x) => set("sponsors", x)} />}
        {section === "galeria" && <Gallery list={v.gallery} onChange={(x) => set("gallery", x)} />}
        {isStories && <Stories players={players} pid={pid} onPick={setPid} value={(id) => stories[id] ?? storyStart(id)} edited={(id) => !!stories[id] && !same(stories[id], storyStart(id))} drafted={(id) => !!storyDrafts[id]} onChange={(id, s) => setStories((all) => ({ ...all, [id]: s }))} />}
      </div>
    </Drawer>
  );
}

// ───────────────────────── momentos ─────────────────────────
function Moments({ live, list, onChange }: { live: readonly Milestone[]; list: readonly Milestone[]; onChange: (l: Milestone[]) => void }) {
  const [form, setForm] = useState<Milestone>({ year: "", title: "", text: "" });
  const [editing, setEditing] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const ok = !!form.year.trim() && !!form.title.trim();
  const published = (m: Milestone) => live.some((x) => same(x, m));
  const submit = () => {
    if (!ok) return;
    const m = { year: form.year.trim(), title: form.title.trim(), text: form.text.trim() };
    onChange(editing == null ? [...list, m] : list.map((x, i) => (i === editing ? m : x)));
    setForm({ year: "", title: "", text: "" });
    setEditing(null);
  };
  const move = (from: number, to: number) => {
    onChange(moved(list, from, to));
    requestAnimationFrame(() => listRef.current?.children[to]?.querySelector<HTMLElement>(`[data-act="${to < from ? "up" : "down"}"]:not(:disabled)`)?.focus({ preventScroll: true }));
  };
  return (
    <>
      {list.length ? (
        <ul className="evl w2" ref={listRef} aria-label="Momentos">
          {list.map((m, i) => (
            <li key={i} className={`evr ad-row ${editing === i ? "ad-on" : ""}`.trim()}>
              <span className="mn2">{m.year || "—"}</span>
              <span className="w">
                <b>{m.title || "Sin título"}</b>
                <small>{published(m) ? "✓ Publicado" : "● Sin publicar"}{m.text ? ` · ${m.text}` : ""}</small>
              </span>
              <ItemActions
                i={i}
                n={list.length}
                what={`«${m.title || "momento"}»`}
                onMove={move}
                onRemove={(k) => {
                  onChange(list.filter((_, j) => j !== k));
                  if (editing === k) {
                    setEditing(null);
                    setForm({ year: "", title: "", text: "" });
                  }
                }}
                extra={
                  <button
                    type="button"
                    className="ib"
                    aria-label={`Editar «${m.title || "momento"}»`}
                    onClick={() => {
                      setEditing(i);
                      setForm({ ...m });
                      requestAnimationFrame(() => yearRef.current?.focus({ preventScroll: true }));
                    }}
                  >
                    <AdIcon name="pencil" size={16} />
                  </button>
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint w2">Todavía no hay momentos: el primero partido, el primer gol, la primera copa…</p>
      )}
      <label className="fld">
        <span className="lbl">Fecha</span>
        <input ref={yearRef} className="inp" value={form.year} placeholder="Nov 2026" onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} autoComplete="off" />
      </label>
      <TextField label="Momento" value={form.title} placeholder="Qué pasó" onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} autoComplete="off" />
      <TextField label="Recuerdo (opcional)" wide value={form.text} placeholder="Cómo fue, quién estaba…" onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} autoComplete="off" />
      <div className="row w2">
        <button type="button" className="btn sm" aria-disabled={!ok || list.length >= LIMITS.milestones} onClick={() => list.length < LIMITS.milestones && submit()}>
          <AdIcon name={editing == null ? "plus" : "check"} size={16} />
          {editing == null ? "Añadir momento" : "Guardar momento"}
        </button>
        {editing != null && (
          <button
            type="button"
            className="btn sm line"
            onClick={() => {
              setEditing(null);
              setForm({ year: "", title: "", text: "" });
            }}
          >
            Cancelar edición
          </button>
        )}
      </div>
    </>
  );
}

// ───────────────────────── preguntas ─────────────────────────
function Questions({ list, onChange }: { list: readonly Faq[]; onChange: (l: Faq[]) => void }) {
  const listRef = useRef<HTMLUListElement>(null);
  const edit = (i: number, p: Partial<Faq>) => onChange(list.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (from: number, to: number) => {
    onChange(moved(list, from, to));
    requestAnimationFrame(() => listRef.current?.children[to]?.querySelector<HTMLElement>(`[data-act="${to < from ? "up" : "down"}"]:not(:disabled)`)?.focus({ preventScroll: true }));
  };
  return (
    <>
      <ul className="ad-items w2" ref={listRef} aria-label="Preguntas">
        {list.map((f, i) => (
          <li key={i} className="ad-item">
            <div className="ad-item-h">
              <b>Pregunta {i + 1}</b>
              <ItemActions i={i} n={list.length} what={`la pregunta ${i + 1}`} onMove={move} onRemove={(k) => onChange(list.filter((_, j) => j !== k))} />
            </div>
            <TextField label="Pregunta" value={f.q} onChange={(e) => edit(i, { q: e.target.value })} state={!f.q.trim() ? "bad" : undefined} autoComplete="off" />
            <TextAreaField label="Respuesta" rows={2} value={f.a} onChange={(e) => edit(i, { a: e.target.value })} state={!f.a.trim() ? "bad" : undefined} />
          </li>
        ))}
      </ul>
      {!list.length && <p className="hint w2">Sin preguntas: la página del club no enseña el bloque.</p>}
      <div className="row w2">
        <button type="button" className="btn sm" aria-disabled={list.length >= LIMITS.faq} onClick={() => list.length < LIMITS.faq && onChange([...list, { q: "", a: "" }])}>
          <AdIcon name="plus" size={16} />
          Añadir pregunta
        </button>
      </div>
    </>
  );
}

// ───────────────────────── colaboradores ─────────────────────────
function Sponsors({ list, onChange }: { list: readonly Sponsor[]; onChange: (l: Sponsor[]) => void }) {
  const edit = (i: number, p: Partial<Sponsor>) => onChange(list.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <>
      <ul className="ad-items w2" aria-label="Colaboradores">
        {list.map((s, i) => (
          <li key={i} className="ad-item">
            <div className="ad-item-h">
              <b>{s.name.trim() || `Colaborador ${i + 1}`}</b>
              <ItemActions i={i} n={list.length} what={s.name.trim() || `el colaborador ${i + 1}`} onMove={(a, b) => onChange(moved(list, a, b))} onRemove={(k) => onChange(list.filter((_, j) => j !== k))} />
            </div>
            <TextField label="Nombre" value={s.name} onChange={(e) => edit(i, { name: e.target.value })} state={!s.name.trim() ? "bad" : undefined} autoComplete="off" />
            <LinkField label="Web (HTTPS)" value={s.url} onChange={(x) => edit(i, { url: x })} />
            <LinkField label="Logo (HTTPS)" value={s.logo} onChange={(x) => edit(i, { logo: x })} />
          </li>
        ))}
      </ul>
      {!list.length && <p className="hint w2">Sin colaboradores todavía.</p>}
      <div className="row w2">
        <button type="button" className="btn sm" aria-disabled={list.length >= LIMITS.sponsors} onClick={() => list.length < LIMITS.sponsors && onChange([...list, { name: "", url: "", logo: "" }])}>
          <AdIcon name="plus" size={16} />
          Añadir colaborador
        </button>
      </div>
    </>
  );
}

// ───────────────────────── galería ─────────────────────────
function Gallery({ list, onChange }: { list: readonly Photo[]; onChange: (l: Photo[]) => void }) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const capId = useId();
  const st = linkState(url);
  const full = list.length >= LIMITS.gallery;
  const add = () => {
    if (st !== "ok" || full) return;
    onChange([...list, { url: url.trim(), caption: caption.trim() }]);
    setUrl("");
    setCaption("");
  };
  const move = (from: number, to: number) => {
    onChange(moved(list, from, to));
    requestAnimationFrame(() => listRef.current?.children[to]?.querySelector<HTMLElement>(`[data-act="${to < from ? "up" : "down"}"]:not(:disabled)`)?.focus({ preventScroll: true }));
  };
  return (
    <>
      {list.length ? (
        <ul className="evl w2" ref={listRef} aria-label="Fotos de la galería">
          {list.map((g, i) => {
            const s = linkState(g.url);
            return (
              <li key={i} className="evr ad-row ad-gal">
                <span className="mn2">{s === "ok" ? <img src={g.url.trim()} alt="" width={36} height={36} loading="lazy" /> : <AdIcon name="image" size={18} />}</span>
                <span className="w">
                  <b className="mono ad-url">{g.url || "(sin enlace)"}</b>
                  <FieldCheck tone={s === "ok" ? "ok" : "bad"}>{s === "ok" ? LINK_TEXT.ok : LINK_TEXT.bad}</FieldCheck>
                  <input className="inp ad-capin" aria-label={`Pie de la foto ${i + 1}`} placeholder="Pie de foto (opcional)" value={g.caption} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} autoComplete="off" />
                </span>
                <ItemActions i={i} n={list.length} what={`la foto ${i + 1}`} onMove={move} onRemove={(k) => onChange(list.filter((_, j) => j !== k))} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="hint w2">La galería está vacía.</p>
      )}
      <label className="fld w2">
        <span className="lbl">Añadir foto (URL HTTPS)</span>
        <input
          className={`inp ${st === "bad" ? "bad" : st === "ok" ? "good" : ""}`.trim()}
          value={url}
          inputMode="url"
          placeholder="https://"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          aria-describedby={capId}
          autoComplete="off"
        />
        <FieldCheck id={capId} tone={st === "empty" ? "mut" : st === "ok" ? "ok" : "bad"}>
          {st === "empty" ? "Pega un enlace que empiece por https://" : st === "ok" ? "Enlace seguro · se puede añadir" : "Tiene que empezar por https://"}
        </FieldCheck>
      </label>
      <TextField label="Pie de foto (opcional)" wide value={caption} onChange={(e) => setCaption(e.target.value)} autoComplete="off" />
      <div className="row w2">
        <button type="button" className="btn sm" aria-disabled={st !== "ok" || full} onClick={add}>
          <AdIcon name="plus" size={16} />
          Añadir a la galería
        </button>
        {full && <span className="hint">Máximo {LIMITS.gallery} fotos.</span>}
      </div>
    </>
  );
}

// ───────────────────────── historias de jugadores ─────────────────────────
function Stories({
  players,
  pid,
  onPick,
  value,
  edited,
  drafted,
  onChange,
}: {
  players: readonly StoryPlayer[];
  pid: string;
  onPick: (id: string) => void;
  value: (id: string) => PlayerStory;
  edited: (id: string) => boolean;
  drafted: (id: string) => boolean;
  onChange: (id: string, s: PlayerStory) => void;
}) {
  if (!players.length) return <p className="hint w2">Todavía no hay jugadores en la plantilla.</p>;
  const withStory = players.filter((x) => value(x.id).bio.trim()).length;
  const s = value(pid);
  const p = players.find((x) => x.id === pid);
  const set = (k: keyof PlayerStory, v: string) => onChange(pid, { ...s, [k]: v });
  return (
    <>
      <label className="fld w2">
        <span className="lbl">Jugador</span>
        <select className="inp" value={pid} onChange={(e) => onPick(e.target.value)}>
          {players.map((x) => (
            <option key={x.id} value={x.id}>
              {x.number != null ? `${x.number} · ` : ""}
              {x.name} — {value(x.id).bio.trim() ? "con historia" : "sin historia"}
              {edited(x.id) ? " · ● cambios" : drafted(x.id) ? " · ● borrador" : ""}
            </option>
          ))}
        </select>
        <span className="hint">
          {withStory} de {players.length} con historia
        </span>
      </label>
      {p && (
        <>
          <LinkField label="Foto (URL HTTPS)" wide value={s.photoUrl} onChange={(x) => set("photoUrl", x)} />
          {linkState(s.photoUrl) === "ok" && <img className="ad-prev ad-prev-sq w2" src={s.photoUrl.trim()} alt={`Foto de ${p.name} (vista previa)`} />}
          <TextField label="Su frase" wide value={s.quote} onChange={(e) => set("quote", e.target.value)} autoComplete="off" />
          <TextAreaField label="Presentación" wide rows={5} value={s.bio} onChange={(e) => set("bio", e.target.value)} />
        </>
      )}
    </>
  );
}
