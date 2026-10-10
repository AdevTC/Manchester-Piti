// Contenido (/admin/contenido) — «Programa del club»: the cover (desktop, while no entry is open) and the
// numbered index 01–06 of what the web tells about the club off the pitch, each with where it shows. Only
// the exceptions are marked: «Sin publicar» (a draft on this device) and «Revisar» (a broken link, an
// incomplete item, or a draft whose section changed on the web meanwhile). An entry opens its editor
// (`?seccion=`; beside the index on desktop, a sheet on phones), which saves as it is written. The bar at the
// index's foot counts the changes and «Publicar contenido» (gold: THE action here) writes every draft at once
// behind a lower third with «Deshacer». Nothing with a broken link or an incomplete item gets published.
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAuth } from "../../../context/AuthContext";
import type { PlayerDoc } from "../../../lib/schemas";
import { useLiveClubContent } from "../club/clubLive";
import { LoadError } from "../club/ClubStates";
import { ContentEditor, type StoryPlayer } from "../club/ContentDrawer";
import { useContentDrafts } from "../club/contentDraftStore";
import {
  GROUPS,
  applyClub,
  contentIssues,
  discardSection,
  pendingKeys,
  publishPlan,
  putClubDraft,
  putStoryDrafts,
  removePublished,
  resolveGroup,
  staleKeys,
  storyIssues,
  storyOf,
  withoutPublishing,
  type ClubKey,
  type ContentGroup,
  type Drafts,
  type PlayerStory,
  type Slice,
} from "../club/contentModel";
import { linkState, plantillaRows } from "../club/plantillaLogic";
import { useClubWrites } from "../club/useClubWrites";
import { useAdmin } from "../shell/context";
import { useFrame } from "../ui/frame";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const clip = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const MONTH = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "Europe/Madrid" });

export function Contenido() {
  const data = useAdmin();
  const { desktop } = useFrame();
  const toast = useToast();
  const writes = useClubWrites();
  const navigate = useNavigate();
  const { user } = useAuth();
  const search: { seccion?: unknown } = useSearch({ strict: false });
  const open = resolveGroup(search.seccion);
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
  /** Issues in a section about to be published stop the publishing; older ones only ask for a look. */
  const blocking = issues.filter((i) => pend.includes(i.key));
  const blocked = blocking.length > 0;

  const isBad = (g: ContentGroup) => g.keys.some((k) => issues.some((i) => i.key === k) || stale.includes(k));
  const isDraft = (g: ContentGroup) => g.keys.some((k) => pend.includes(k));
  const pendGroups = GROUPS.filter(isDraft);
  const badGroups = GROUPS.filter(isBad);

  const describe = (g: ContentGroup): string => {
    const c = effective;
    const base = (() => {
      switch (g.key) {
        case "frase": {
          const parts = [c.intro.trim() ? `«${clip(c.intro.trim(), 48)}»` : "Sin frase", c.location.trim() || "sin localidad", c.venue.trim() ? clip(c.venue.trim(), 32) : "sin campo"];
          if (!c.story.trim()) parts.push("sin historia");
          if (!c.crestStory?.trim()) parts.push("falta la historia del escudo");
          return parts.join(" · ");
        }
        case "contacto":
          return [c.email.trim() || "sin correo", c.instagram.trim() ? "Instagram" : "sin Instagram", c.photoUrl.trim() ? "foto del equipo" : "sin foto del equipo"].join(" · ");
        case "momentos": {
          const fresh = c.milestones.filter((m) => !web.milestones.some((x) => x.year === m.year && x.title === m.title && x.text === m.text));
          if (!c.milestones.length) return "Todavía sin momentos";
          const n = plural(c.milestones.length, "hito", "hitos");
          if (fresh.length === 1) return `${n} · «${clip(fresh[0].title, 36)}» sin publicar`;
          if (fresh.length) return `${n} · ${fresh.length} sin publicar`;
          return `${n} · el último, «${clip(c.milestones.at(-1)?.title ?? "", 36)}»`;
        }
        case "historias": {
          const squad = storyPlayers.filter((p) => rows.find((r) => r.id === p.id)?.inSeason);
          const list = squad.length ? squad : storyPlayers;
          const missing = list.filter((p) => !effStory(p.id).bio.trim()).map((p) => p.name);
          const shown = missing.length > 4 ? [...missing.slice(0, 3), `${missing.length - 3} más`] : missing;
          return `${list.length - missing.length} de ${list.length} perfiles con historia${missing.length ? ` · faltan ${andList(shown)}` : ""}`;
        }
        case "preguntas": {
          const n = (c.faq ?? []).length;
          const incomplete = (c.faq ?? []).filter((f) => !f.q.trim() || !f.a.trim()).length;
          return n ? `${plural(n, "pregunta", "preguntas")}${incomplete ? ` · ${incomplete} sin completar` : " con respuesta"}` : "Sin preguntas";
        }
        case "galeria": {
          const bad = c.gallery.filter((x) => linkState(x.url) !== "ok").length + c.sponsors.flatMap((s) => [s.url, s.logo]).filter((u) => linkState(u) === "bad").length;
          return [plural(c.gallery.length, "foto", "fotos"), plural(c.sponsors.length, "colaborador", "colaboradores"), ...(bad ? [bad === 1 ? "1 enlace no es HTTPS" : `${bad} enlaces no son HTTPS`] : [])].join(" · ");
        }
      }
    })();
    return base + (g.keys.some((k) => stale.includes(k)) ? " · ha cambiado en la web desde tu borrador" : "");
  };

  // ── the editor ──
  const openGroup = (k: ContentGroup["key"]) => void navigate({ to: "/admin/contenido", search: { seccion: k } });
  const closeEditor = useCallback(() => void navigate({ to: "/admin/contenido", search: {} }), [navigate]);
  const onClub = (key: ClubKey, value: Slice) => update((d) => putClubDraft(d, key, value, web, Date.now()));
  const onStory = (id: string, value: PlayerStory) => update((d) => putStoryDrafts(d, { [id]: value }, webStory, Date.now()));
  const discard = (g: ContentGroup) => {
    const snapshot = drafts;
    update((d) => g.keys.reduce(discardSection, d));
    closeEditor();
    toast.show({ tag: "WEB", message: `Borrador de «${g.title}» descartado · vuelve a lo publicado`, undo: () => update(() => snapshot) });
  };

  // ── publish ──
  const publish = () => {
    if (!pend.length || !loaded || publishing) return;
    if (blocked) {
      toast.show({ tone: "error", message: `Antes de publicar: ${blocking[0].text}` });
      return;
    }
    const snapshot = mine;
    setPublishing(snapshot);
    toast.defer({
      tag: "WEB",
      message: "Contenido publicado · la web ya lo enseña",
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
  };

  const barTitle = pendGroups.length ? plural(pendGroups.length, "cambio sin publicar", "cambios sin publicar") : publishing ? "Publicando…" : "Todo publicado";
  const lookAt = badGroups.filter((g) => !isDraft(g));
  const barDetail = pendGroups.length
    ? [pendGroups.map((g) => g.title).join(" · "), ...(blocked ? [`para publicar, arregla: ${blocking.map((i) => i.text).join(" · ")}`] : lookAt.length ? [`antes, revisa ${andList(lookAt.map((g) => `«${g.title}»`))}`] : [])].join(" · ")
    : issues.length
      ? `Revisa: ${issues.map((i) => i.text).join(" · ")}`
      : "La web enseña lo mismo que ves aquí";
  const group = open && loaded && !data.loading && !data.error ? (GROUPS.find((g) => g.key === open) ?? null) : null;
  const season = data.season?.name ? /temporada\s+(\d+)/i.exec(data.season.name)?.[1] : undefined;

  const body = data.error ? (
    <LoadError what="el contenido" />
  ) : !loaded || data.loading ? (
    <div className="skel" role="status" aria-label="Cargando el contenido">
      <i />
      <i />
      <i />
    </div>
  ) : (
    <div className={`prg ${group && desktop ? "wd" : ""}`.trim()}>
      {desktop && !group && (
        <div className="cover">
          <img src="/crest-128.webp" alt="" width={72} height={72} />
          <span className="k">PROGRAMA DEL CLUB{season ? ` · T${season}` : ""}</span>
          <h2>Manchester Piti</h2>
          <p>Lo que la web cuenta del club fuera del partido. Solo se marca lo que pide algo.</p>
          <span className="ed">Edición de {MONTH.format(data.now)}</span>
        </div>
      )}
      <div className="idx">
        <div className="scr">
          <ul aria-label="Programa del club" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {GROUPS.map((g, i) => {
              const no = String(i + 1).padStart(2, "0");
              const draft = isDraft(g);
              const bad = isBad(g);
              const marks = [...(draft ? ["Sin publicar"] : []), ...(bad ? ["Revisar"] : [])];
              const did = `ir-${g.key}`;
              return (
                <li key={g.key}>
                  <button type="button" className="ir" aria-current={group?.key === g.key ? "true" : undefined} aria-haspopup="dialog" aria-label={`${no} ${g.title}${marks.length ? ` · ${marks.join(" · ")}` : ""}`} aria-describedby={did} onClick={() => openGroup(g.key)}>
                    <span className="no" aria-hidden="true">
                      {no}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <b>{g.title}</b>
                      <small id={did}>{describe(g)}</small>
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      {draft && <span className="tag am">Sin publicar</span>}
                      {bad && (
                        <span className="tag rd">
                          <AdIcon name="alert" size={13} />
                          Revisar
                        </span>
                      )}
                      <span className="pg2">→ {g.where}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="pbar" aria-live="polite">
          <p>
            <b>{barTitle}</b>
            {barDetail}
          </p>
          <button type="button" className="btn gold" aria-disabled={!pend.length || blocked || !!publishing} onClick={publish}>
            Publicar contenido
          </button>
        </div>
      </div>
      {group && (
        <ContentEditor
          key={group.key}
          group={group}
          live={web}
          effective={effective}
          players={storyPlayers}
          liveStory={webStory}
          draftStory={effStory}
          stale={group.keys.some((k) => stale.includes(k))}
          hasDraft={group.keys.some((k) => (k === "historias" ? Object.keys(mine.stories).length > 0 : !!mine.club[k]))}
          onClub={onClub}
          onStory={onStory}
          onDiscard={() => discard(group)}
          onClose={closeEditor}
          now={data.now}
        />
      )}
    </div>
  );

  if (!desktop) return <div className="msc">{body}</div>;
  return (
    <>
      <div className="vh">
        <div>
          <h1 className="ttl">Contenido</h1>
          <p className="ld">El programa del club: todo lo que la web cuenta de vosotros</p>
        </div>
      </div>
      {body}
    </>
  );
}
