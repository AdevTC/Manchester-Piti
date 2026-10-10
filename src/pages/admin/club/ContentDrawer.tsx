// The editor of one entry of the «Programa del club» (Contenido, `?seccion=`): `.ce`, a column beside the
// index on desktop (non-modal: Esc closes it) and a sheet from the bottom on phones (modal). It holds the
// fields of the old editor — frase, localidad, fundación, campo, nuestra historia and the crest's; contacto,
// Instagram and the team photo; momentos (list + add, the new ones in amber, edit, remove); player stories;
// preguntas; galería (✓ HTTPS / ✕ No es HTTPS, remove, add with the check) and colaboradores — and SAVES AS
// IT IS WRITTEN: every change becomes this device's draft at once («Se guarda como borrador al escribir»),
// so there is nothing to lose on the way out; «Listo» closes, «Descartar borrador» goes back to the web.
import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ClubContent } from "../../../lib/clubContent";
import type { PlayerDoc } from "../../../lib/schemas";
import { useFrame } from "../ui/frame";
import { AdIcon } from "../ui/icons";
import { useLayer, useLayerHost, zLayer, zScrim } from "../ui/layerCore";
import { CloseButton } from "../ui/layers";
import { LIMITS, emailOk, monthLabel, same, sliceOf, type ClubKey, type ContentGroup, type PlayerStory, type Slice } from "./contentModel";
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
export interface ContentEditorProps {
  group: ContentGroup;
  /** Published content (as the web shows it). */
  live: ClubContent;
  /** Published content with this captain's drafts (what the editor starts from). */
  effective: ClubContent;
  /** Players for «Historias», squad first. */
  players: readonly StoryPlayer[];
  /** A player's story as the web shows it, and with this captain's draft. */
  liveStory: (id: string) => PlayerStory;
  draftStory: (id: string) => PlayerStory;
  /** The web changed since a draft of this entry was saved. */
  stale: boolean;
  /** The entry has a draft (shows «Descartar borrador»). */
  hasDraft: boolean;
  /** Each change, as it is written: the section's new value / a player's new story. */
  onClub: (key: ClubKey, value: Slice) => void;
  onStory: (id: string, value: PlayerStory) => void;
  onDiscard: () => void;
  onClose: () => void;
  /** Today (the date a new momento starts with). */
  now: number;
}

/** ✓ HTTPS / ✕ No es HTTPS under a link (nothing while empty). */
function LinkCheck({ value, id }: { value: string; id?: string }) {
  const s = linkState(value);
  if (s === "empty") return null;
  return s === "ok" ? (
    <span className="okk" id={id} style={{ fontSize: 13 }}>
      <AdIcon name="check" size={13} />
      HTTPS · se ve en la web
    </span>
  ) : (
    <span className="bad" id={id} style={{ fontSize: 13 }}>
      <AdIcon name="x" size={13} />
      No es HTTPS · no se verá en la web
    </span>
  );
}
function Field({ label, children, check }: { label: string; children: (id: string) => ReactNode; check?: ReactNode }) {
  const id = useId();
  return (
    <div className="fld">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {check}
    </div>
  );
}
function LinkField({ label, value, onChange, placeholder = "https://…" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const cid = useId();
  return (
    <Field label={label} check={<LinkCheck value={value} id={cid} />}>
      {(id) => <input id={id} className={`inp ${linkState(value) === "bad" ? "bad" : ""}`.trim()} value={value} inputMode="url" placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-describedby={linkState(value) === "empty" ? undefined : cid} autoComplete="off" />}
    </Field>
  );
}

export function ContentEditor(props: ContentEditorProps) {
  const { desktop } = useFrame();
  return desktop ? <InlineEditor {...props} /> : <SheetEditor {...props} />;
}
function InlineEditor(props: ContentEditorProps) {
  const ref = useRef<HTMLElement>(null);
  const tid = useId();
  useLayer({ modal: false, trap: false, onClose: props.onClose, ref });
  return (
    <aside ref={ref} className="ce" role="dialog" aria-labelledby={tid} tabIndex={-1}>
      <EditorBody {...props} tid={tid} />
    </aside>
  );
}
function SheetEditor(props: ContentEditorProps) {
  const ref = useRef<HTMLElement>(null);
  const host = useLayerHost();
  const tid = useId();
  const { depth, isTop } = useLayer({ modal: true, trap: true, onClose: props.onClose, ref });
  const node = (
    <>
      <div className={depth ? "scrim hi" : "scrim"} style={{ zIndex: zScrim(depth) }} onClick={isTop ? props.onClose : undefined} aria-hidden="true" />
      <aside ref={ref} className="ce" role="dialog" aria-modal="true" aria-labelledby={tid} tabIndex={-1} style={{ zIndex: zLayer(depth) }}>
        <EditorBody {...props} tid={tid} />
      </aside>
    </>
  );
  return host ? createPortal(node, host) : null;
}

function EditorBody({ group, live, effective, players, liveStory, draftStory, stale, hasDraft, onClub, onStory, onDiscard, onClose, now, tid }: ContentEditorProps & { tid: string }) {
  // The editor's own copy (the inputs read it; every change is also saved as the draft at once).
  const [value, setValue] = useState<ClubContent>(effective);
  const set = <K extends keyof ClubContent>(section: ClubKey, k: K, v: ClubContent[K]) => {
    const next = { ...value, [k]: v };
    setValue(next);
    onClub(section, sliceOf(next, section));
  };
  return (
    <>
      <div className="hh">
        <span>
          <h3 id={tid}>{group.title}</h3>
          <small>Se ve en: {group.where}</small>
        </span>
        <CloseButton onClick={onClose} />
      </div>
      <div className="fx2">
        {stale && (
          <p className="warn" role="status">
            <AdIcon name="alert" size={15} />
            Ha cambiado en la web desde tu borrador: si publicas, tu versión sustituye a la de la web.
          </p>
        )}
        {group.key === "frase" && (
          <>
            <Field label="Frase de presentación">{(id) => <textarea id={id} className="inp" maxLength={LIMITS.intro} value={value.intro} onChange={(e) => set("frase", "intro", e.target.value)} />}</Field>
            <div className="f2">
              <Field label="Localidad">{(id) => <input id={id} className="inp" value={value.location} onChange={(e) => set("frase", "location", e.target.value)} autoComplete="off" />}</Field>
              <Field label="Fundado en">{(id) => <input id={id} className="inp" inputMode="numeric" maxLength={4} value={value.founded} onChange={(e) => set("frase", "founded", e.target.value)} autoComplete="off" />}</Field>
            </div>
            <Field label="Campo y dirección">{(id) => <input id={id} className="inp" value={value.venue} onChange={(e) => set("frase", "venue", e.target.value)} autoComplete="off" />}</Field>
            <Field label="Nuestra historia">{(id) => <textarea id={id} className="inp" rows={6} maxLength={LIMITS.story} value={value.story} onChange={(e) => set("historia", "story", e.target.value)} />}</Field>
            <Field label="La historia del escudo">
              {(id) => <textarea id={id} className="inp" rows={4} maxLength={LIMITS.crestStory} placeholder="Quién lo dibujó, qué significa cada pieza…" value={value.crestStory ?? ""} onChange={(e) => set("historia", "crestStory", e.target.value)} />}
            </Field>
          </>
        )}
        {group.key === "contacto" && (
          <>
            <Field
              label="Correo"
              check={
                value.email.trim() ? (
                  emailOk(value.email) ? (
                    <span className="okk" style={{ fontSize: 13 }}>
                      <AdIcon name="check" size={13} />
                      Correo válido
                    </span>
                  ) : (
                    <span className="bad" style={{ fontSize: 13 }}>
                      <AdIcon name="x" size={13} />
                      Revisa el correo
                    </span>
                  )
                ) : null
              }
            >
              {(id) => <input id={id} className={`inp ${value.email.trim() && !emailOk(value.email) ? "bad" : ""}`.trim()} type="email" value={value.email} onChange={(e) => set("contacto", "email", e.target.value)} autoComplete="off" />}
            </Field>
            <LinkField label="Instagram" value={value.instagram} placeholder="https://instagram.com/…" onChange={(v) => set("contacto", "instagram", v)} />
            <LinkField label="Foto del equipo (HTTPS)" value={value.photoUrl} onChange={(v) => set("contacto", "photoUrl", v)} />
          </>
        )}
        {group.key === "momentos" && <Moments live={live.milestones} list={value.milestones} now={now} onChange={(l) => set("momentos", "milestones", l)} />}
        {group.key === "historias" && <Stories players={players} liveStory={liveStory} draftStory={draftStory} onStory={onStory} />}
        {group.key === "preguntas" && <Questions list={value.faq ?? []} onChange={(l) => set("preguntas", "faq", l)} />}
        {group.key === "galeria" && (
          <>
            <Gallery list={value.gallery} onChange={(l) => set("galeria", "gallery", l)} />
            <Sponsors list={value.sponsors} onChange={(l) => set("colaboradores", "sponsors", l)} />
          </>
        )}
      </div>
      <div className="ft">
        <span className="hint sp">Se guarda como borrador al escribir</span>
        {hasDraft && (
          <button type="button" className="btn sm red" onClick={onDiscard}>
            Descartar borrador
          </button>
        )}
        <button type="button" className="btn sm line" onClick={onClose}>
          Listo
        </button>
      </div>
    </>
  );
}

// ───────────────────────── momentos ─────────────────────────
function Moments({ live, list, now, onChange }: { live: readonly Milestone[]; list: readonly Milestone[]; now: number; onChange: (l: Milestone[]) => void }) {
  const blank = (): Milestone => ({ year: monthLabel(now), title: "", text: "" });
  const [form, setForm] = useState<Milestone>(blank);
  const [editing, setEditing] = useState<number | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const fid = useId();
  const ok = !!form.year.trim() && !!form.title.trim();
  const full = editing == null && list.length >= LIMITS.milestones;
  const published = (m: Milestone) => live.some((x) => same(x, m));
  const reset = () => {
    setForm(blank());
    setEditing(null);
  };
  const submit = () => {
    if (!ok || full) return;
    const m = { year: form.year.trim(), title: form.title.trim(), text: form.text.trim() };
    onChange(editing == null ? [...list, m] : list.map((x, i) => (i === editing ? m : x)));
    reset();
  };
  return (
    <>
      {list.length ? (
        <ul className="hl" aria-label="Momentos">
          {list.map((m, i) => {
            const fresh = !published(m);
            return (
              <li key={i} className={fresh ? "dr" : undefined}>
                <span className="d">{m.year || "—"}</span>
                <button
                  type="button"
                  className="hlb"
                  aria-label={`Editar «${m.title || "momento"}»`}
                  onClick={() => {
                    setEditing(i);
                    setForm({ ...m });
                    requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
                  }}
                >
                  {m.title || "Sin título"}
                  {fresh && (
                    <>
                      <br />
                      <span className="warn" style={{ fontSize: 13 }}>
                        Sin publicar
                      </span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="ib2"
                  aria-label={`Quitar «${m.title || "momento"}»`}
                  onClick={() => {
                    onChange(list.filter((_, j) => j !== i));
                    if (editing === i) reset();
                  }}
                >
                  <AdIcon name="x" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="hint">Todavía no hay momentos: el primer partido, el primer gol, la primera copa…</p>
      )}
      <div className="fld">
        <label htmlFor={fid}>{editing == null ? "Nuevo momento" : "Momento"}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={titleRef}
            id={fid}
            className="inp"
            value={form.title}
            placeholder="Primer hat-trick de…"
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            autoComplete="off"
          />
          <button type="button" className="btn sm line" aria-disabled={!ok || full} onClick={submit}>
            {editing == null ? "Añadir" : "Guardar"}
          </button>
        </div>
      </div>
      <div className="f2">
        <Field label="Fecha">{(id) => <input id={id} className="inp" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} autoComplete="off" />}</Field>
        <Field label="Recuerdo (opcional)">{(id) => <input id={id} className="inp" value={form.text} placeholder="Cómo fue, quién estaba…" onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} autoComplete="off" />}</Field>
      </div>
      {editing != null && (
        <button type="button" className="btn sm line" style={{ alignSelf: "flex-start" }} onClick={reset}>
          Cancelar la edición
        </button>
      )}
      {full && <p className="hint">Máximo {LIMITS.milestones} momentos.</p>}
    </>
  );
}

// ───────────────────────── preguntas ─────────────────────────
function Questions({ list, onChange }: { list: readonly Faq[]; onChange: (l: Faq[]) => void }) {
  const edit = (i: number, p: Partial<Faq>) => onChange(list.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <>
      {list.length ? (
        <ul className="hl" aria-label="Preguntas">
          {list.map((f, i) => (
            <li key={i} style={{ gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "start" }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <Field label={`Pregunta ${i + 1}`}>{(id) => <input id={id} className={`inp ${f.q.trim() ? "" : "bad"}`.trim()} value={f.q} onChange={(e) => edit(i, { q: e.target.value })} autoComplete="off" />}</Field>
                <Field label="Respuesta">{(id) => <textarea id={id} className={`inp ${f.a.trim() ? "" : "bad"}`.trim()} rows={2} value={f.a} onChange={(e) => edit(i, { a: e.target.value })} />}</Field>
              </span>
              <button type="button" className="ib2" aria-label={`Quitar la pregunta ${i + 1}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>
                <AdIcon name="x" size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Sin preguntas: la página del club no enseña el bloque.</p>
      )}
      <button type="button" className="btn sm line" style={{ alignSelf: "flex-start" }} aria-disabled={list.length >= LIMITS.faq} onClick={() => list.length < LIMITS.faq && onChange([...list, { q: "", a: "" }])}>
        <AdIcon name="plus" size={16} />
        Añadir pregunta
      </button>
    </>
  );
}

// ───────────────────────── galería ─────────────────────────
function Gallery({ list, onChange }: { list: readonly Photo[]; onChange: (l: Photo[]) => void }) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const uid = useId();
  const cid = useId();
  const okNew = /^https:\/\/\S+$/.test(url.trim());
  const badNew = !!url.trim() && !okNew;
  const full = list.length >= LIMITS.gallery;
  const add = () => {
    if (!okNew || full) return;
    onChange([...list, { url: url.trim(), caption: caption.trim() }]);
    setUrl("");
    setCaption("");
  };
  return (
    <>
      {list.length ? (
        <ul className="hl" aria-label="Fotos de la galería">
          {list.map((g, i) => {
            const ok = linkState(g.url) === "ok";
            return (
              <li key={i} style={{ gridTemplateColumns: "minmax(0, 1fr) auto auto" }}>
                <span style={{ overflowWrap: "anywhere", fontSize: 14 }}>{g.url || "(sin enlace)"}</span>
                {ok ? (
                  <span className="okk" style={{ fontSize: 13 }}>
                    <AdIcon name="check" size={13} />
                    HTTPS
                  </span>
                ) : (
                  <span className="bad" style={{ fontSize: 13 }}>
                    <AdIcon name="x" size={13} />
                    No es HTTPS
                  </span>
                )}
                <button type="button" className="ib2" aria-label={`Quitar la foto ${i + 1}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>
                  <AdIcon name="x" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="hint">La galería está vacía.</p>
      )}
      <div className="fld">
        <label htmlFor={uid}>Añadir foto (HTTPS)</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id={uid}
            className={`inp ${badNew ? "bad" : ""}`.trim()}
            value={url}
            inputMode="url"
            placeholder="https://…"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            aria-invalid={badNew || undefined}
            aria-describedby={badNew ? cid : undefined}
            autoComplete="off"
          />
          <button type="button" className="btn sm line" aria-disabled={!okNew || full} onClick={add}>
            Añadir
          </button>
        </div>
        {badNew && (
          <span className="bad" id={cid} style={{ fontSize: 13 }}>
            <AdIcon name="x" size={13} />
            Tiene que empezar por https://
          </span>
        )}
        {full && <span className="hint">Máximo {LIMITS.gallery} fotos.</span>}
      </div>
      <Field label="Pie de la foto nueva (opcional)">{(id) => <input id={id} className="inp" value={caption} onChange={(e) => setCaption(e.target.value)} autoComplete="off" />}</Field>
    </>
  );
}

// ───────────────────────── colaboradores ─────────────────────────
function Sponsors({ list, onChange }: { list: readonly Sponsor[]; onChange: (l: Sponsor[]) => void }) {
  const edit = (i: number, p: Partial<Sponsor>) => onChange(list.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <>
      <h4 className="ceh">Colaboradores</h4>
      {list.length ? (
        <ul className="hl" aria-label="Colaboradores">
          {list.map((s, i) => (
            <li key={i} style={{ gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "start" }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <Field label={`Colaborador ${i + 1}`}>{(id) => <input id={id} className={`inp ${s.name.trim() ? "" : "bad"}`.trim()} value={s.name} placeholder="Nombre" onChange={(e) => edit(i, { name: e.target.value })} autoComplete="off" />}</Field>
                <LinkField label="Web (HTTPS)" value={s.url} onChange={(v) => edit(i, { url: v })} />
                <LinkField label="Logo (HTTPS)" value={s.logo} onChange={(v) => edit(i, { logo: v })} />
              </span>
              <button type="button" className="ib2" aria-label={`Quitar ${s.name.trim() || `el colaborador ${i + 1}`}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>
                <AdIcon name="x" size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Sin colaboradores todavía.</p>
      )}
      <button type="button" className="btn sm line" style={{ alignSelf: "flex-start" }} aria-disabled={list.length >= LIMITS.sponsors} onClick={() => list.length < LIMITS.sponsors && onChange([...list, { name: "", url: "", logo: "" }])}>
        <AdIcon name="plus" size={16} />
        Añadir colaborador
      </button>
    </>
  );
}

// ───────────────────────── historias de jugadores ─────────────────────────
function Stories({ players, liveStory, draftStory, onStory }: { players: readonly StoryPlayer[]; liveStory: (id: string) => PlayerStory; draftStory: (id: string) => PlayerStory; onStory: (id: string, s: PlayerStory) => void }) {
  const [stories, setStories] = useState<Record<string, PlayerStory>>({});
  const valueOf = (id: string) => stories[id] ?? draftStory(id);
  const [pid, setPid] = useState(() => players.find((p) => !draftStory(p.id).bio.trim())?.id ?? players[0]?.id ?? "");
  if (!players.length) return <p className="hint">Todavía no hay jugadores en la plantilla.</p>;
  const p = players.find((x) => x.id === pid);
  const s = valueOf(pid);
  const set = (k: keyof PlayerStory, v: string) => {
    const next = { ...s, [k]: v };
    setStories((all) => ({ ...all, [pid]: next }));
    onStory(pid, next);
  };
  const withStory = players.filter((x) => valueOf(x.id).bio.trim()).length;
  return (
    <>
      <p className="hint">
        Cada historia sale en el perfil del jugador. Faltan las que no tienen ✓ · {withStory} de {players.length} escritas.
      </p>
      <div className="tgl" role="group" aria-label="Jugadores">
        {players.map((x) => {
          const has = !!valueOf(x.id).bio.trim();
          const changed = !same(valueOf(x.id), liveStory(x.id));
          return (
            <button key={x.id} type="button" className={has ? "ok" : undefined} aria-current={x.id === pid ? "true" : undefined} onClick={() => setPid(x.id)}>
              {x.number != null ? `${x.number} ` : ""}
              {x.name} {has ? "✓" : "· falta"}
              {changed ? " ●" : ""}
            </button>
          );
        })}
      </div>
      {p && (
        <>
          <LinkField label={`Foto de ${p.name} (HTTPS)`} value={s.photoUrl} onChange={(v) => set("photoUrl", v)} />
          <Field label="Su frase">{(id) => <input id={id} className="inp" value={s.quote} onChange={(e) => set("quote", e.target.value)} autoComplete="off" />}</Field>
          <Field label="Presentación">{(id) => <textarea id={id} className="inp" rows={5} value={s.bio} onChange={(e) => set("bio", e.target.value)} />}</Field>
        </>
      )}
    </>
  );
}
