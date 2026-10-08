// Contenido del club — the club page's sections (frase, historia y escudo, contacto, momentos, historias de
// jugadores, preguntas, colaboradores, galería), each Publicado / Sin publicar / Revisar, opening the
// editor drawer (`?seccion=`). Edits are drafts on this device (the published model has no drafts); the
// fixed «Publicar contenido» bar counts the pending changes, says which, warns of broken links (nothing
// with a link that is not HTTPS, or an incomplete item, gets published) and writes every draft at once
// behind an undo toast.
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAuth } from "../../../context/AuthContext";
import type { PlayerDoc } from "../../../lib/schemas";
import { clockTime } from "../data/adminLogic";
import { useLiveClubContent } from "../club/clubLive";
import { LoadError } from "../club/ClubStates";
import { ContentDrawer, type StoryPlayer } from "../club/ContentDrawer";
import { useContentDrafts } from "../club/contentDraftStore";
import {
  SECTIONS,
  applyClub,
  contentIssues,
  discardSection,
  pendingKeys,
  publishPlan,
  putClubDraft,
  putStoryDrafts,
  removePublished,
  resolveSection,
  same,
  sectionTitle,
  staleKeys,
  storyIssues,
  storyOf,
  withoutPublishing,
  type ContentKey,
  type Drafts,
  type PlayerStory,
} from "../club/contentModel";
import { linkState, plantillaRows } from "../club/plantillaLogic";
import { useClubWrites } from "../club/useClubWrites";
import { useRegisterCommands } from "../palette/registry";
import type { PaletteCommand } from "../palette/search";
import { AdminView } from "../shell/AdminView";
import { useAdmin } from "../shell/context";
import { Chip, SkeletonRows } from "../ui/controls";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";
import "../../../styles/admin-club.css";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const clip = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
type RowState = "pub" | "draft" | "bad";
const STATE: Record<RowState, { label: string; tone: "ok" | "warn" | "bad" }> = { pub: { label: "Publicado", tone: "ok" }, draft: { label: "Sin publicar", tone: "warn" }, bad: { label: "Revisar", tone: "bad" } };

export function Contenido() {
  const data = useAdmin();
  const toast = useToast();
  const writes = useClubWrites();
  const navigate = useNavigate();
  const { user } = useAuth();
  const search: { seccion?: unknown } = useSearch({ strict: false });
  const open = resolveSection(search.seccion);
  const { content: live, loaded } = useLiveClubContent();
  const [drafts, update] = useContentDrafts(user?.uid);
  /** Drafts being published (their write waits behind «Deshacer»): shown as published meanwhile. */
  const [publishing, setPublishing] = useState<Drafts | null>(null);

  // The commit builds its document from what is published THEN (not when the button was pressed).
  const latest = useRef({ live, players: data.players });
  useLayoutEffect(() => {
    latest.current = { live, players: data.players };
  });

  const liveStory = useCallback((id: string): PlayerStory => storyOf(data.players.find((p) => p.id === id)), [data.players]);
  const web = useMemo(() => (publishing ? applyClub(live, publishing) : live), [live, publishing]);
  const webStory = useCallback((id: string) => publishing?.stories[id]?.value ?? liveStory(id), [publishing, liveStory]);
  const mine = useMemo(() => withoutPublishing(drafts, publishing), [drafts, publishing]);
  const effective = useMemo(() => applyClub(web, mine), [web, mine]);
  const pend = useMemo(() => pendingKeys(mine, web, webStory), [mine, web, webStory]);
  const stale = useMemo(() => staleKeys(mine, web, webStory), [mine, web, webStory]);

  const rows = useMemo(() => plantillaRows(data.players, data.seasons, data.season?.id), [data.players, data.seasons, data.season?.id]);
  const storyPlayers: StoryPlayer[] = useMemo(() => rows.map((r) => ({ id: r.id, name: r.name, number: r.number, doc: r.doc })), [rows]);
  const effStory = useCallback((id: string) => mine.stories[id]?.value ?? webStory(id), [mine, webStory]);
  const issues = useMemo(() => [...contentIssues(effective), ...storyIssues(storyPlayers.map((p) => ({ name: p.name, story: effStory(p.id) })))], [effective, storyPlayers, effStory]);
  const blocked = issues.length > 0;

  const stateOf = (k: ContentKey): RowState => (issues.some((i) => i.key === k) || stale.includes(k) ? "bad" : pend.includes(k) ? "draft" : "pub");
  const describe = (k: ContentKey): string => {
    const c = effective;
    const base = (() => {
      switch (k) {
        case "frase":
          return [c.intro.trim() ? `«${clip(c.intro.trim(), 48)}»` : "Sin frase", c.location.trim() || "sin localidad", c.venue.trim() ? clip(c.venue.trim(), 32) : "sin campo"].join(" · ");
        case "historia":
          return `${c.story.trim() ? plural(words(c.story), "palabra", "palabras") : "Sin historia"} · escudo: ${c.crestStory?.trim() ? "escrito" : "sin escribir"}`;
        case "contacto":
          return [c.email.trim() || "sin correo", c.instagram.trim() ? "Instagram" : "sin Instagram", c.photoUrl.trim() ? "foto del equipo" : "sin foto del equipo"].join(" · ");
        case "momentos": {
          const last = c.milestones.at(-1);
          return c.milestones.length ? `${plural(c.milestones.length, "hito", "hitos")} · el último, «${clip(last?.title ?? "", 36)}»` : "Todavía sin momentos";
        }
        case "historias": {
          const squad = storyPlayers.filter((p) => rows.find((r) => r.id === p.id)?.inSeason);
          const list = squad.length ? squad : storyPlayers;
          const missing = list.filter((p) => !effStory(p.id).bio.trim()).map((p) => p.name);
          const shown = missing.length > 4 ? [...missing.slice(0, 3), `${missing.length - 3} más`] : missing;
          return missing.length ? `${list.length - missing.length} de ${list.length} · faltan ${andList(shown)}` : `${list.length} de ${list.length} · todas escritas`;
        }
        case "preguntas": {
          const n = (c.faq ?? []).length;
          const open = (c.faq ?? []).filter((f) => !f.q.trim() || !f.a.trim()).length;
          return n ? `${plural(n, "pregunta", "preguntas")}${open ? ` · ${open} sin completar` : " con respuesta"}` : "Sin preguntas";
        }
        case "colaboradores":
          return c.sponsors.length ? plural(c.sponsors.length, "colaborador", "colaboradores") : "Sin colaboradores todavía";
        case "galeria": {
          const bad = c.gallery.filter((g) => linkState(g.url) !== "ok").length;
          return c.gallery.length ? `${plural(c.gallery.length, "foto", "fotos")} · ${bad ? (bad === 1 ? "1 enlace no es HTTPS" : `${bad} enlaces no son HTTPS`) : "todas HTTPS"}` : "La galería está vacía";
        }
      }
    })();
    const at = k === "historias" ? Math.max(0, ...Object.values(mine.stories).map((d) => d.at)) : (mine.club[k]?.at ?? 0);
    const extra = stale.includes(k) ? " · ha cambiado en la web desde tu borrador" : pend.includes(k) && at ? ` · borrador de las ${clockTime(at)}` : "";
    return base + extra;
  };

  // ── drawer ──
  const openSection = (k: ContentKey) => void navigate({ to: "/admin/contenido", search: { seccion: k } });
  const closeDrawer = useCallback(() => void navigate({ to: "/admin/contenido", search: {} }), [navigate]);
  const saveClub = (key: Exclude<ContentKey, "historias">, value: Partial<typeof live>) => {
    const before = pendingKeys(mine, web, webStory).includes(key);
    update((d) => putClubDraft(d, key, value, web, Date.now()));
    closeDrawer();
    const now = pendingKeys(putClubDraft(mine, key, value, web, 0), web, webStory).includes(key);
    toast.show({ message: now ? "Guardado en borrador · falta publicar." : before ? "Igual que lo publicado · borrador descartado." : "Igual que lo publicado · nada que publicar." });
  };
  const saveStories = (values: Record<string, PlayerStory>) => {
    update((d) => putStoryDrafts(d, values, webStory, Date.now()));
    closeDrawer();
    const n = Object.entries(values).filter(([id, v]) => !same(v, webStory(id))).length;
    toast.show({ message: n ? `Guardado en borrador · ${plural(n, "historia", "historias")} sin publicar.` : "Igual que lo publicado · nada que publicar." });
  };
  const discard = (key: ContentKey) => {
    const snapshot = drafts;
    update((d) => discardSection(d, key));
    closeDrawer();
    toast.show({ message: `Borrador de «${sectionTitle(key)}» descartado · vuelve a lo publicado.`, undo: () => update(() => snapshot) });
  };

  // ── publish ──
  const publish = useCallback(() => {
    if (!pend.length || blocked || !loaded || publishing) return;
    const snapshot = mine;
    setPublishing(snapshot);
    const titles = pend.map(sectionTitle);
    toast.defer({
      message: `Contenido publicado · ya sale en «El club» (${titles.length === 1 ? titles[0] : plural(titles.length, "sección", "secciones")}).`,
      commit: async () => {
        const now = latest.current;
        const plan = publishPlan(snapshot, now.live, (id) => storyOf(now.players.find((p: PlayerDoc) => p.id === id)));
        await writes.publishContent(plan.content, plan.stories);
      },
      onUndo: () => setPublishing(null),
      onError: () => setPublishing(null),
      onDone: () => {
        update((d) => removePublished(d, snapshot));
        setPublishing(null);
      },
      errorMessage: "No se ha podido publicar el contenido",
    });
  }, [pend, blocked, loaded, publishing, mine, toast, writes, update]);
  useRegisterCommands(
    useMemo<PaletteCommand[]>(
      () =>
        pend.length && !blocked
          ? [{ id: "contenido:publicar", group: "Acciones", icon: "↑", title: "Publicar contenido", description: `${plural(pend.length, "cambio sin publicar", "cambios sin publicar")} · ${pend.map(sectionTitle).join(" · ")}`, hint: "acción", keywords: "publicar web club borrador", order: -1, run: publish }]
          : [],
      [pend, blocked, publish],
    ),
  );

  const barTitle = pend.length ? plural(pend.length, "cambio sin publicar", "cambios sin publicar") : publishing ? "Publicando…" : "Todo publicado";
  const barDetail = [pend.length ? pend.map(sectionTitle).join(" · ") : "La web está al día", ...(blocked ? [`Para publicar, arregla: ${issues.map((i) => i.text).join(" · ")}`] : [])].join(" · ");
  const drawerKey = open && loaded && !data.loading ? open : null;

  return (
    <AdminView kicker="Club" title="Contenido del club" lead="Textos, momentos, historias y galería. Guardas en borrador (en este dispositivo); nada sale en la web hasta publicar.">
      {data.error ? (
        <LoadError what="el contenido" />
      ) : (
        <div className="vb vfl">
          <div className="scr">
            {!loaded || data.loading ? (
              <SkeletonRows rows={6} label="Cargando el contenido…" />
            ) : (
              <ul className="cl" aria-label="Secciones">
                {SECTIONS.map(({ key, title }) => {
                  const st = STATE[stateOf(key)];
                  return (
                    <li key={key}>
                      <button type="button" className="cr" onClick={() => openSection(key)} aria-haspopup="dialog" aria-label={`Editar ${title} · ${st.label}`}>
                        <span className="ti" aria-hidden="true">
                          <AdIcon name="doc" size={20} />
                        </span>
                        <span className="w">
                          <b>
                            {title} <Chip tone={st.tone}>{st.label}</Chip>
                          </b>
                          <small>{describe(key)}</small>
                        </span>
                        <span className="go">
                          <AdIcon name="pencil" size={15} />
                          <span>Editar</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className={`pubbar ${pend.length ? "" : "clean"} ${blocked ? "ad-blocked" : ""}`.replace(/\s+/g, " ").trim()} aria-live="polite">
            <span className="w">
              <b>{barTitle}</b>
              <small>
                {blocked && <AdIcon name="alert" size={13} />}
                {barDetail}
              </small>
            </span>
            <button
              type="button"
              className="btn sm gold"
              aria-disabled={!pend.length || blocked || !loaded || !!publishing}
              onClick={() => {
                if (blocked && pend.length) toast.show({ tone: "error", message: `Antes de publicar: ${issues[0].text}.` });
                else publish();
              }}
            >
              Publicar contenido
            </button>
          </div>
        </div>
      )}
      {drawerKey && (
        <ContentDrawer
          key={drawerKey}
          section={drawerKey}
          live={web}
          draft={drawerKey === "historias" ? undefined : mine.club[drawerKey]}
          storyDrafts={mine.stories}
          players={storyPlayers}
          liveStory={webStory}
          stale={stale.includes(drawerKey)}
          onClose={closeDrawer}
          onSaveClub={saveClub}
          onSaveStories={saveStories}
          onDiscard={discard}
        />
      )}
    </AdminView>
  );
}
