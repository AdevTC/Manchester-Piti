// CLUB · La web del club (/admin/club/web[/<sección>]; board part-club.html § la web): the index of the six sections
// with what each says now and what it asks, and beside it (on the phone, its own screen) the section's editor. Every
// change is a draft on the server (clubDrafts/content, M-20: the other captain sees it, it follows you to any device)
// until «Publicar contenido». The networks are a list (M-45: Instagram, YouTube, TikTok, WhatsApp, X…; the old two
// fields are written beside it for today's web) and one colaborador can be featured in Inicio, with its dates.
// Publishing a player's story writes only what changed here: a photo put in his ficha is never written back over
// (B-CLUB-06).
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { VIcon } from "../../../../components/vidrio/VIcon";
import { useAuth } from "../../../../context/AuthContext";

import { useClubContent, type ClubContent } from "../../../../lib/clubContent";
import type { ClubSocial } from "../../../../lib/clubContentDefaults";
import { SOCIAL_NETS } from "../../../../lib/clubContentDefaults";
import { legacySocialFields, readSocials, SOCIAL_NAME, type SocialNet } from "../../../../lib/clubExtras";
import { nameFor } from "../../../../lib/clubData";
import { venueKey, venueName, VENUE_LIMITS } from "../../../../lib/derived/venue";
import { plural } from "../../../../lib/derived/words";
import { WEB_SECTIONS } from "../../../../lib/adminUrls";
import { applyClub, CLUB_FIELDS, contentIssues, emailOk, LIMITS, monthLabel, pendingKeys, publishPlan, putClubDraft, putStoryDrafts, removePublished, sliceOf, staleKeys, storyOf, storyWith, type ClubKey, type Drafts, type PlayerStory } from "../../club/contentModel";
import { useContentDraftState } from "../../club/contentDraftStore";
import { linkState } from "../../club/plantillaLogic";
import { useClubWrites } from "../../club/useClubWrites";
import { ScreenError, ScreenLoading } from "../../shell/Screen";
import { SalaLink } from "../../shell/SalaLink";
import { useAdmin } from "../../shell/context";
import { useStatus } from "../../shell/statusContext";
import { relWhen } from "./model";
import { RoomScreen } from "./Room";
import { ALIAS, SECTIONS, sectionMiss, type WebSection } from "./webModel";
import { Shirt } from "./shirts";
import { shirtOf, useStills } from "./stills";

const FIELD_KEY: Record<string, ClubKey> = Object.fromEntries(Object.entries(CLUB_FIELDS).flatMap(([k, fs]) => fs.map((f) => [f, k as ClubKey])));
const ok = (u: string) => linkState(u) !== "bad";
const listUp = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const upFirst = (s: string) => s.charAt(0).toLocaleUpperCase("es") + s.slice(1);

export function WebScreen() {
  return <WebRoom section={null} />;
}
/** /admin/club/web/<sección>: historia · contacto · momentos · historias · preguntas · galeria (and the old names). */
export function WebSeccionScreen() {
  const { seccion = "" } = useParams({ strict: false }) as { seccion?: string };
  const navigate = useNavigate();
  const known = (WEB_SECTIONS as readonly string[]).includes(seccion) ? (seccion as WebSection) : (ALIAS[seccion] ?? null);
  useEffect(() => {
    if (known && known !== seccion) void navigate({ href: `/admin/club/web/${known}${window.location.search}`, replace: true });
  }, [known, seccion, navigate]);
  return <WebRoom section={known} />;
}

function WebRoom({ section }: { section: WebSection | null }) {
  const data = useAdmin();
  const status = useStatus();
  const writes = useClubWrites();
  const { user, profile } = useAuth();
  const content = useClubContent();
  // (the content published when «Deshacer» runs out: the commit builds the document from it)
  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);
  const draft = useContentDraftState(user ? { uid: user.uid, name: profile?.nickname || user.displayName || "" } : null);
  const sid = data.season?.id ?? "";
  const squad = useMemo(() => data.players.filter((p) => (p.seasons ?? []).includes(sid)), [data.players, sid]);
  const liveStory = (id: string) => storyOf(data.players.find((p) => p.id === id));
  const drafts = draft.drafts;
  const cur = applyClub(content, drafts);
  const pending = pendingKeys(drafts, content, liveStory);
  const stale = staleKeys(drafts, content, liveStory);
  const stories = squad.map((p) => ({ id: p.id, name: shirtOf(p, sid).name, story: storyWith(drafts, p.id, liveStory(p.id)) }));
  // (the stories' photos are the fichas': never checked nor written here, B-CLUB-06)
  const issues = contentIssues(cur);
  const withStory = stories.filter((s) => s.story.bio.trim()).length;
  const sec = section ? (SECTIONS.find((s) => s.id === section) ?? null) : null;
  const [publishing, setPublishing] = useState(false);
  // `?jugador=<id>` (the ficha's «Escribir su historia») opens his story; a tap on another player picks him
  const param = useRouterState({ select: (s) => new URLSearchParams(s.location.searchStr).get("jugador") });
  const [picked, setPicked] = useState<{ param: string | null; id: string } | null>(null);
  const jugador = picked && picked.param === param ? picked.id : param;
  const setJugador = (id: string) => setPicked({ param, id });

  const index = SECTIONS.map((s) => {
    const miss = sectionMiss(s.id, cur, withStory, squad.length);
    const bad = issues.filter((i) => s.keys.includes(i.key));
    const changed = s.keys.some((k) => pending.includes(k));
    const revisa = s.keys.some((k) => stale.includes(k));
    return { ...s, miss, bad, changed, revisa, sum: summary(s.id, cur, withStory, squad.length, stories) };
  });
  const allMiss = index.reduce((n, s) => n + s.miss.length, 0);
  const firstBad = index.find((s) => s.bad.length);
  const blocked = pending.length > 0 && issues.length > 0;

  // ── edits: each a draft of its section's slice (or of a player's story) ──
  const setField = <K extends keyof ClubContent>(field: K, value: ClubContent[K]) => {
    const key = FIELD_KEY[field as string];
    if (!key) return;
    draft.update((d) => putClubDraft(d, key, { ...sliceOf(applyClub(content, d), key), [field]: value }, content, Date.now()));
  };
  const setFields = (patch: Partial<ClubContent>) => {
    const key = FIELD_KEY[Object.keys(patch)[0]];
    if (!key) return;
    draft.update((d) => putClubDraft(d, key, { ...sliceOf(applyClub(content, d), key), ...patch }, content, Date.now()));
  };
  const setStory = (id: string, patch: Partial<PlayerStory>) => draft.update((d) => putStoryDrafts(d, { [id]: { ...storyWith(d, id, liveStory(id)), ...patch } }, liveStory, Date.now()));
  const discardSection = () => {
    if (!sec) return;
    draft.update((d): Drafts => {
      const club = { ...d.club };
      for (const k of sec.keys) if (k !== "historias") delete club[k as ClubKey];
      return { club, stories: sec.id === "historias" ? {} : d.stories };
    });
    status.show({ tag: "Web", message: `Borrador de «${sec.name}» descartado · vuelve a lo publicado` });
  };

  const publish = () => {
    if (!pending.length || publishing) return;
    if (issues.length) {
      status.show({ tone: "error", message: `Antes de publicar: ${issues[0].text}` });
      return;
    }
    const sending = drafts;
    setPublishing(true);
    status.defer({
      tag: "Web",
      message: "Contenido publicado · la web ya lo enseña",
      commit: async () => {
        const live = contentRef.current;
        const plan = publishPlan(sending, live, liveStory);
        await writes.publishContent(plan.content, plan.stories);
        draft.update((d) => removePublished(d, sending));
      },
      onUndo: () => setPublishing(false),
      onDone: () => setPublishing(false),
      onError: () => setPublishing(false),
      errorMessage: "No se ha podido publicar el contenido",
    });
  };

  const barTitle = publishing ? "Publicando…" : pending.length ? plural(pending.length, "cambio sin publicar", "cambios sin publicar") : "Todo publicado";
  const barLine = pending.length
    ? blocked
      ? `Para publicar, arregla: ${issues[0].text}`
      : `En borrador desde ${relWhen(Math.min(...Object.values(drafts.club).map((e) => e?.at ?? data.now), ...Object.values(drafts.stories).map((e) => e.at)), data.now)}${draft.byName ? ` · lo último, de ${draft.byName}` : ""} · la web sigue igual hasta publicar.`
    : "La web enseña lo mismo que ves aquí.";
  const lede = allMiss || issues.length ? [allMiss + issues.length ? plural(allMiss + issues.length, "cosa por completar", "cosas por completar") : "", pending.length ? plural(pending.length, "cambio sin publicar", "cambios sin publicar") : ""].filter(Boolean).join(" · ") : pending.length ? plural(pending.length, "cambio sin publicar", "cambios sin publicar") : "Todo completo y publicado";

  return (
    <RoomScreen
      room="web"
      title={sec?.name}
      lede={sec ? `La web del club · ${lede}` : lede}
      back={sec ? { to: "/admin/club/web", label: "Volver a la web del club", word: "‹ La web del club" } : undefined}
      primary={{ label: "Publicar contenido", onClick: publish, disabled: !pending.length || blocked || publishing || draft.conflict, why: !pending.length ? "No hay nada sin publicar." : blocked ? `Antes, arregla: ${issues[0].text}` : undefined }}
    >
      {!draft.loaded && data.loading ? (
        <ScreenLoading label="Cargando la web del club" />
      ) : data.error ? (
        <ScreenError what="la web del club" onRetry={() => window.location.reload()} />
      ) : (
        <div className={`cl-grid cl-web${sec ? " has-sec" : ""}`}>
          <nav className="cl-col cl-web__idx sc-scroll" aria-label="Las secciones de la web del club">
            <div className="cl-pubbar" aria-live="polite">
              <p>
                <b>{barTitle}</b>
                <span>{barLine}</span>
              </p>
              {blocked && firstBad && (
                <SalaLink className="vd-link" to={`/admin/club/web/${firstBad.id}`}>
                  Ir a arreglarlo
                </SalaLink>
              )}
            </div>
            {draft.conflict && (
              <div className="cl-alert" role="alert">
                <p>
                  <b>Otro capitán ha cambiado el borrador</b>
                  {draft.byName ? ` (${draft.byName}, ${relWhen(draft.at, data.now)})` : ""}. Tus cambios siguen aquí, sin guardar.
                </p>
                <div className="sc-btnrow">
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={draft.reload}>
                    Recargar el suyo
                  </button>
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => void draft.mine()}>
                    Guardar el mío encima
                  </button>
                </div>
              </div>
            )}
            {draft.error && (
              <p className="cl-alert" role="alert">
                No se ha podido guardar el borrador: {draft.error}. Lo escrito sigue aquí.
              </p>
            )}
            <ul className="sc-rows">
              {index.map((s) => (
                <li key={s.id}>
                  <SalaLink className="sc-row sc-row--btn cl-sec" to={`/admin/club/web/${s.id}`} aria-current={sec?.id === s.id ? "page" : undefined}>
                    <span className="sc-row__t">
                      <b>{s.name}</b>
                      <span>{s.sum}</span>
                      {s.miss.length > 0 && <span className="cl-miss">{upFirst(listUp(s.miss))}</span>}
                      {s.revisa && <span className="cl-miss">Ha cambiado en la web desde tu borrador</span>}
                    </span>
                    {(s.bad.length > 0 || s.changed) && <span className={`sc-tag ${s.bad.length ? "sc-tag--mal" : "sc-tag--toca"}`}>{s.bad.length ? "Revisar" : "Sin publicar"}</span>}
                  </SalaLink>
                </li>
              ))}
            </ul>
            <p className="sc-small cl-foot">{draft.saving ? "Guardando el borrador…" : "El borrador se guarda en el servidor mientras escribes: lo ve el otro capitán y sigue en cualquier dispositivo."}</p>
          </nav>
          <section className="cl-col cl-web__ed sc-scroll" aria-labelledby="cl-ed-t">
            {!sec ? (
              <>
                <h2 className="vd-vh" id="cl-ed-t">
                  El editor
                </h2>
                <p className="sc-p cl-empty">Elige una sección para escribirla. Solo se marca lo que pide algo: {allMiss ? plural(allMiss, "cosa por completar", "cosas por completar") : "todo completo"}.</p>
              </>
            ) : (
              <>
                <header className="cl-ed__h">
                  <div>
                    <h2 className="sc-h2" id="cl-ed-t">
                      {sec.name}
                    </h2>
                    <p className="sc-small">Sale en {sec.where}</p>
                  </div>
                  {sec.keys.some((k) => pending.includes(k)) && (
                    <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={discardSection}>
                      Descartar borrador
                    </button>
                  )}
                </header>
                {index.find((s) => s.id === sec.id)?.bad.map((b) => (
                  <p key={b.text} className="cl-alert" role="alert">
                    {b.text}
                  </p>
                ))}
                {sec.id === "historia" && <Historia c={cur} setField={setField} />}
                {sec.id === "contacto" && <Contacto c={cur} setField={setField} setFields={setFields} />}
                {sec.id === "momentos" && <Momentos c={cur} setField={setField} now={data.now} />}
                {sec.id === "historias" && <Historias stories={stories} sid={sid} jugador={jugador} pick={setJugador} setStory={setStory} squadIds={squad.map((p) => p.id)} />}
                {sec.id === "preguntas" && <Preguntas c={cur} setField={setField} />}
                {sec.id === "galeria" && <Galeria c={cur} setField={setField} />}
              </>
            )}
          </section>
        </div>
      )}
    </RoomScreen>
  );
}

function summary(id: WebSection, c: ClubContent, withStory: number, squad: number, stories: { name: string; story: PlayerStory }[]): string {
  if (id === "historia") return [c.intro.trim() ? `«${c.intro.trim().slice(0, 42)}${c.intro.trim().length > 42 ? "…" : ""}»` : "Sin frase", c.location.trim() || "sin localidad", plural(c.venues.length, "campo", "campos")].join(" · ");
  if (id === "contacto") {
    const nets = readSocials(c);
    return [c.email.trim() || "sin correo", nets.length ? nets.map((n) => SOCIAL_NAME[n.net]).join(", ") : "sin redes", c.photoUrl.trim() ? "con foto del equipo" : "sin foto del equipo"].join(" · ");
  }
  if (id === "momentos") return plural(c.milestones.length, "momento", "momentos") + (c.milestones[0] ? ` · «${c.milestones[0].title}»` : "");
  if (id === "historias") {
    const missing = stories.filter((s) => !s.story.bio.trim()).map((s) => s.name);
    return `${withStory} de ${squad} perfiles con historia${missing.length ? ` · faltan ${missing.length > 2 ? `${missing.slice(0, 2).join(", ")} y ${missing.length - 2} más` : listUp(missing)}` : ""}`;
  }
  if (id === "preguntas") return plural((c.faq ?? []).length, "pregunta", "preguntas");
  const nh = c.gallery.filter((g) => !ok(g.url) || !g.url.trim()).length;
  const feat = c.sponsors.find((s) => s.featured);
  return [plural(c.gallery.length, "foto", "fotos"), plural(c.sponsors.length, "colaborador", "colaboradores"), feat ? `${feat.name} en Inicio` : "", nh ? `${plural(nh, "enlace no es", "enlaces no son")} HTTPS` : ""].filter(Boolean).join(" · ");
}

// ───────────────────────── the editors ─────────────────────────
type SetField = <K extends keyof ClubContent>(field: K, value: ClubContent[K]) => void;

function Count({ v, max }: { v: string; max: number }) {
  return <small className={v.length > max ? "is-bad" : ""}>{`${v.length}/${max}`}</small>;
}
function LinkHint({ v, okText = "Enlace seguro", empty = "Opcional" }: { v: string; okText?: string; empty?: string }) {
  const s = linkState(v);
  return <small className={s === "bad" ? "is-bad" : s === "ok" ? "is-ok" : ""}>{s === "empty" ? empty : s === "ok" ? okText : "Tiene que empezar por https://"}</small>;
}
function Remove({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={label} onClick={onClick}>
      Quitar
    </button>
  );
}
function Add({ label, onClick, off }: { label: string; onClick: () => void; off?: boolean }) {
  return (
    <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm cl-addrow" aria-disabled={off || undefined} onClick={() => !off && onClick()}>
      <VIcon name="plus" size={16} />
      {label}
    </button>
  );
}

function Historia({ c, setField }: { c: ClubContent; setField: SetField }) {
  const data = useAdmin();
  const venues = c.venues;
  const setVenue = (i: number, patch: Partial<(typeof venues)[number]>) => setField("venues", venues.map((v, k) => (k === i ? { ...v, ...patch } : v)));
  const used = new Map<string, { name: string; n: number }>();
  for (const m of data.published) {
    const v = typeof m.venue === "string" ? m.venue : "";
    const key = venueKey(v);
    if (!key) continue;
    const e = used.get(key) ?? { name: venueName(v.split(" · ")[0]), n: 0 };
    e.n++;
    used.set(key, e);
  }
  const out = [...used.entries()].filter(([k]) => !venues.some((v) => venueKey(v.name) === k));
  return (
    <>
      <div className="sc-form sc-form--1">
        <label className="sc-field">
          <span>Frase de presentación</span>
          <textarea className="vd-input" value={c.intro} onChange={(e) => setField("intro", e.target.value)} />
          <Count v={c.intro} max={LIMITS.intro} />
        </label>
        <div className="sc-form">
          <label className="sc-field">
            <span>Localidad</span>
            <input className="vd-input" type="text" maxLength={60} value={c.location} onChange={(e) => setField("location", e.target.value)} />
          </label>
          <label className="sc-field">
            <span>Fundado en</span>
            <input className="vd-input" type="text" inputMode="numeric" maxLength={4} placeholder="2025" value={c.founded} onChange={(e) => setField("founded", e.target.value.replace(/\D/g, "").slice(0, 4))} />
            <small className={c.founded && !/^\d{4}$/.test(c.founded) ? "is-bad" : ""}>Cuatro cifras.</small>
          </label>
        </div>
        <label className="sc-field">
          <span>Nuestra historia</span>
          <textarea className="vd-input" value={c.story} onChange={(e) => setField("story", e.target.value)} />
          <Count v={c.story} max={LIMITS.story} />
        </label>
        <label className="sc-field">
          <span>La historia del escudo</span>
          <textarea className="vd-input" placeholder="De dónde sale el escudo, quién lo dibujó…" value={c.crestStory} onChange={(e) => setField("crestStory", e.target.value)} />
          <Count v={c.crestStory} max={LIMITS.crestStory} />
        </label>
      </div>
      <h3 className="sc-h3 cl-sub">Campos</h3>
      <ul className="sc-rows cl-items">
        {venues.map((v, i) => (
          <li key={i} className="cl-item">
            <div className="sc-form">
              <label className="sc-field">
                <span>Campo {i + 1} · nombre, como en los partidos</span>
                <input className="vd-input" type="text" maxLength={VENUE_LIMITS.name} value={v.name} onChange={(e) => setVenue(i, { name: e.target.value })} aria-invalid={!v.name.trim() || undefined} />
                <small className={!v.name.trim() ? "is-bad" : ""}>{v.name.trim() ? `${v.name.length}/${VENUE_LIMITS.name}` : "Ponle nombre"}</small>
              </label>
              <label className="sc-field">
                <span>Dirección</span>
                <input className="vd-input" type="text" maxLength={VENUE_LIMITS.address} value={v.address ?? ""} onChange={(e) => setVenue(i, { address: e.target.value })} />
              </label>
              <label className="sc-field">
                <span>Cómo llegar</span>
                <input className="vd-input" type="text" maxLength={VENUE_LIMITS.transit} placeholder="Metro, línea 1, 8 min a pie" value={v.transit ?? ""} onChange={(e) => setVenue(i, { transit: e.target.value })} />
              </label>
              <label className="sc-field">
                <span>Búsqueda en el mapa (opcional)</span>
                <input className="vd-input" type="text" maxLength={VENUE_LIMITS.mapsQuery} placeholder="Si el mapa no lo encuentra por la dirección" value={v.mapsQuery ?? ""} onChange={(e) => setVenue(i, { mapsQuery: e.target.value })} />
              </label>
            </div>
            <Remove label={`Quitar el campo ${i + 1}`} onClick={() => setField("venues", venues.filter((_, k) => k !== i))} />
          </li>
        ))}
      </ul>
      <Add label="Añadir campo" off={venues.length >= VENUE_LIMITS.max} onClick={() => setField("venues", [...venues, { name: "", address: "", transit: "" }])} />
      {out.length > 0 && (
        <div className="cl-note">
          <p className="sc-small">
            <b>Campos de partidos que no están en la lista</b> (la web no sabe cómo llegar):
          </p>
          <ul className="sc-rows">
            {out.map(([k, o]) => (
              <li key={k} className="sc-row">
                <span className="sc-row__t">
                  <b>{o.name}</b>
                  <span>{plural(o.n, "partido", "partidos")}</span>
                </span>
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-disabled={venues.length >= VENUE_LIMITS.max || undefined} onClick={() => venues.length < VENUE_LIMITS.max && setField("venues", [...venues, { name: o.name, address: "", transit: "" }])}>
                  Añadirlo
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Contacto({ c, setField, setFields }: { c: ClubContent; setField: SetField; setFields: (p: Partial<ClubContent>) => void }) {
  const nets: ClubSocial[] = c.socials?.length ? c.socials : readSocials(c);
  const setNets = (list: ClubSocial[]) => setFields({ socials: list, ...legacySocialFields(list) });
  const free = SOCIAL_NETS.filter((n) => !nets.some((x) => x.net === n));
  return (
    <>
      <div className="sc-form sc-form--1">
        <label className="sc-field">
          <span>Correo</span>
          <input className="vd-input" type="email" placeholder="hola@manchesterpiti.es" value={c.email} onChange={(e) => setField("email", e.target.value)} />
          <small className={c.email && !emailOk(c.email) ? "is-bad" : c.email ? "is-ok" : ""}>{c.email ? (emailOk(c.email) ? "Correo correcto" : "No parece un correo: nombre@dominio.es") : "Opcional"}</small>
        </label>
        <label className="sc-field">
          <span>Foto del equipo (HTTPS)</span>
          <input className="vd-input" type="url" placeholder="https://" value={c.photoUrl} onChange={(e) => setField("photoUrl", e.target.value)} />
          <LinkHint v={c.photoUrl} okText="Enlace seguro · sale en El club › El equipo" empty="Sin foto: la web enseña el escudo" />
        </label>
      </div>
      <h3 className="sc-h3 cl-sub">Redes</h3>
      <p className="sc-small">El enlace entero de cada perfil (https://…). Salen en El club y en «Síguenos» de Inicio, en este orden.</p>
      <ul className="sc-rows cl-items">
        {nets.map((n, i) => (
          <li key={`${n.net}-${i}`} className="cl-net">
            <label className="sc-field">
              <span>Red {i + 1}</span>
              <select className="vd-input" value={n.net} onChange={(e) => setNets(nets.map((x, k) => (k === i ? { ...x, net: e.target.value as SocialNet } : x)))}>
                {[n.net, ...free].map((net) => (
                  <option key={net} value={net}>
                    {SOCIAL_NAME[net]}
                  </option>
                ))}
              </select>
            </label>
            <label className="sc-field">
              <span>Enlace de {SOCIAL_NAME[n.net]}</span>
              <input className="vd-input" type="url" placeholder="https://" maxLength={300} value={n.url} onChange={(e) => setNets(nets.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} />
              <LinkHint v={n.url} empty="Falta el enlace" />
            </label>
            <Remove label={`Quitar ${SOCIAL_NAME[n.net]}`} onClick={() => setNets(nets.filter((_, k) => k !== i))} />
          </li>
        ))}
      </ul>
      <Add label="Añadir una red" off={!free.length || nets.length >= 8} onClick={() => setNets([...nets, { net: free[0], url: "" }])} />
    </>
  );
}

function Momentos({ c, setField, now }: { c: ClubContent; setField: SetField; now: number }) {
  const ms = c.milestones;
  const set = (i: number, patch: Partial<(typeof ms)[number]>) => setField("milestones", ms.map((m, k) => (k === i ? { ...m, ...patch } : m)));
  return (
    <>
      <ul className="sc-rows cl-items">
        {ms.map((m, i) => (
          <li key={i} className="cl-item">
            <div className="sc-form">
              <label className="sc-field">
                <span>Momento {i + 1}</span>
                <input className="vd-input" type="text" maxLength={80} placeholder="Primer hat-trick de…" value={m.title} onChange={(e) => set(i, { title: e.target.value })} aria-invalid={!m.title.trim() || undefined} />
                <small className={!m.title.trim() ? "is-bad" : ""}>{m.title.trim() ? `${m.title.length}/80` : "Ponle título"}</small>
              </label>
              <label className="sc-field">
                <span>Fecha</span>
                <input className="vd-input" type="text" maxLength={30} placeholder="Oct 2026" value={m.year} onChange={(e) => set(i, { year: e.target.value })} />
              </label>
              <label className="sc-field sc-field--wide">
                <span>Recuerdo (opcional)</span>
                <input className="vd-input" type="text" maxLength={300} value={m.text} onChange={(e) => set(i, { text: e.target.value })} />
              </label>
            </div>
            <Remove label={`Quitar «${m.title || `el momento ${i + 1}`}»`} onClick={() => setField("milestones", ms.filter((_, k) => k !== i))} />
          </li>
        ))}
      </ul>
      <Add label="Nuevo momento" off={ms.length >= LIMITS.milestones} onClick={() => setField("milestones", [...ms, { title: "", year: monthLabel(now), text: "" }])} />
    </>
  );
}

function Historias({ stories, sid, jugador, pick, setStory, squadIds }: { stories: { id: string; name: string; story: PlayerStory }[]; sid: string; jugador: string | null; pick: (id: string) => void; setStory: (id: string, p: Partial<PlayerStory>) => void; squadIds: string[] }) {
  const data = useAdmin();
  const shirts = squadIds.map((id) => shirtOf(data.players.find((p) => p.id === id), sid));
  const src = useStills(shirts);
  const jp = jugador ? stories.find((s) => s.id === jugador) : undefined;
  const jpShirt = jp ? shirtOf(data.players.find((p) => p.id === jp.id), sid) : null;
  return (
    <>
      <ul className="cl-players" aria-label="Jugadores">
        {stories.map((s, i) => (
          <li key={s.id}>
            <button type="button" className="cl-pl" aria-current={jugador === s.id ? "true" : undefined} onClick={() => pick(s.id)}>
              <Shirt shirt={shirts[i]} src={src(shirts[i])} size="xs" />
              <span>
                <b>{s.name || nameFor(data.players.find((p) => p.id === s.id), sid)}</b>
                <small>{s.story.bio.trim() ? "Con historia" : "Sin historia"}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!jp || !jpShirt ? (
        <p className="sc-p cl-empty">Elige un jugador para escribir su historia. Desde su ficha, «Escribir su historia» abre aquí la suya.</p>
      ) : (
        <div className="cl-bio">
          <Shirt shirt={jpShirt} src={src(jpShirt)} size="m" alt={jp.name} />
          <div className="sc-form sc-form--1">
            <label className="sc-field">
              <span>Su frase</span>
              <input className="vd-input" type="text" maxLength={160} value={jp.story.quote} onChange={(e) => setStory(jp.id, { quote: e.target.value })} />
              <Count v={jp.story.quote} max={160} />
            </label>
            <label className="sc-field">
              <span>Presentación</span>
              <textarea className="vd-input" value={jp.story.bio} onChange={(e) => setStory(jp.id, { bio: e.target.value })} />
              <Count v={jp.story.bio} max={1200} />
            </label>
          </div>
          <p className="sc-small">
            Aquí van su frase y su presentación. Su foto ({jp.story.photoUrl ? "ya tiene" : "todavía sin foto"}) se cambia en su ficha: publicar la web nunca la toca.{" "}
            <SalaLink className="vd-link" to={`/admin/plantilla/${jp.id}`}>
              Abrir su ficha
            </SalaLink>
          </p>
        </div>
      )}
    </>
  );
}

function Preguntas({ c, setField }: { c: ClubContent; setField: SetField }) {
  const faq = c.faq ?? [];
  const set = (i: number, patch: Partial<(typeof faq)[number]>) => setField("faq", faq.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  return (
    <>
      <ul className="sc-rows cl-items">
        {faq.map((q, i) => (
          <li key={i} className="cl-item">
            <div className="sc-form sc-form--1">
              <label className="sc-field">
                <span>Pregunta {i + 1}</span>
                <input className="vd-input" type="text" maxLength={200} value={q.q} onChange={(e) => set(i, { q: e.target.value })} aria-invalid={!q.q.trim() || undefined} />
              </label>
              <label className="sc-field">
                <span>Respuesta</span>
                <textarea className="vd-input" maxLength={1000} value={q.a} onChange={(e) => set(i, { a: e.target.value })} aria-invalid={!q.a.trim() || undefined} />
                {(!q.q.trim() || !q.a.trim()) && <small className="is-bad">Pregunta y respuesta, las dos.</small>}
              </label>
            </div>
            <Remove label={`Quitar la pregunta ${i + 1}`} onClick={() => setField("faq", faq.filter((_, k) => k !== i))} />
          </li>
        ))}
      </ul>
      <Add label="Añadir pregunta" off={faq.length >= LIMITS.faq} onClick={() => setField("faq", [...faq, { q: "", a: "" }])} />
    </>
  );
}

function Galeria({ c, setField }: { c: ClubContent; setField: SetField }) {
  const g = c.gallery;
  const sp = c.sponsors;
  const setG = (i: number, patch: Partial<(typeof g)[number]>) => setField("gallery", g.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const setS = (i: number, patch: Partial<(typeof sp)[number]>) => setField("sponsors", sp.map((x, k) => (k === i ? { ...x, ...patch } : patch.featured ? { ...x, featured: false } : x)));
  return (
    <>
      <h3 className="sc-h3 cl-sub">Galería</h3>
      <ul className="sc-rows cl-items">
        {g.map((x, i) => (
          <li key={i} className="cl-item">
            <div className="sc-form">
              <label className="sc-field">
                <span>Foto {i + 1} (HTTPS)</span>
                <input className="vd-input" type="url" placeholder="https://" value={x.url} onChange={(e) => setG(i, { url: e.target.value })} />
                <LinkHint v={x.url} empty="Falta el enlace" />
              </label>
              <label className="sc-field">
                <span>Pie de la foto (opcional)</span>
                <input className="vd-input" type="text" maxLength={120} value={x.caption} onChange={(e) => setG(i, { caption: e.target.value })} />
              </label>
            </div>
            <Remove label={`Quitar la foto ${i + 1}`} onClick={() => setField("gallery", g.filter((_, k) => k !== i))} />
          </li>
        ))}
      </ul>
      <Add label="Añadir foto" off={g.length >= LIMITS.gallery} onClick={() => setField("gallery", [...g, { url: "", caption: "" }])} />
      <h3 className="sc-h3 cl-sub">Colaboradores</h3>
      <p className="sc-small">El orden es el de la lista. Uno puede salir destacado en Inicio, entre unas fechas (vacías: siempre).</p>
      <ul className="sc-rows cl-items">
        {sp.map((s, i) => (
          <li key={i} className="cl-item">
            <div className="sc-form">
              <label className="sc-field">
                <span>Colaborador {i + 1}</span>
                <input className="vd-input" type="text" maxLength={60} value={s.name} onChange={(e) => setS(i, { name: e.target.value })} aria-invalid={!s.name.trim() || undefined} />
                <small className={!s.name.trim() ? "is-bad" : ""}>{s.name.trim() ? `${s.name.length}/60` : "Ponle nombre"}</small>
              </label>
              <label className="sc-field">
                <span>Web (HTTPS)</span>
                <input className="vd-input" type="url" placeholder="https://" value={s.url} onChange={(e) => setS(i, { url: e.target.value })} />
                <LinkHint v={s.url} />
              </label>
              <label className="sc-field">
                <span>Logo (HTTPS)</span>
                <input className="vd-input" type="url" placeholder="https://" value={s.logo} onChange={(e) => setS(i, { logo: e.target.value })} />
                <LinkHint v={s.logo} />
              </label>
              <div className="cl-feat sc-field--wide">
                <button type="button" className="vd-switch" role="switch" aria-checked={!!s.featured} onClick={() => setS(i, { featured: !s.featured })}>
                  <span className="vd-switch__track" aria-hidden="true">
                    <span className="vd-switch__knob" />
                  </span>
                  Destacado en Inicio
                </button>
                {s.featured && (
                  <>
                    <label className="sc-field">
                      <span>Desde</span>
                      <input className="vd-input" type="date" value={s.from ?? ""} onChange={(e) => setS(i, { from: e.target.value || undefined })} />
                    </label>
                    <label className="sc-field">
                      <span>Hasta</span>
                      <input className="vd-input" type="date" value={s.to ?? ""} onChange={(e) => setS(i, { to: e.target.value || undefined })} />
                      {s.from && s.to && s.to < s.from && <small className="is-bad">La fecha final va después de la primera.</small>}
                    </label>
                  </>
                )}
              </div>
            </div>
            <span className="cl-acts">
              <button type="button" className="vd-ibtn vd-glass vd-press" aria-label={`Subir a ${s.name || `el colaborador ${i + 1}`}`} aria-disabled={i === 0 || undefined} onClick={() => i > 0 && setField("sponsors", sp.map((x, k) => (k === i - 1 ? sp[i] : k === i ? sp[i - 1] : x)))}>
                <VIcon name="chevR" size={18} className="cl-up" />
              </button>
              <Remove label={`Quitar el colaborador ${i + 1}`} onClick={() => setField("sponsors", sp.filter((_, k) => k !== i))} />
            </span>
          </li>
        ))}
      </ul>
      <Add label="Añadir colaborador" off={sp.length >= LIMITS.sponsors} onClick={() => setField("sponsors", [...sp, { name: "", url: "", logo: "" }])} />
    </>
  );
}

