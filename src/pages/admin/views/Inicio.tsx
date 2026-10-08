// Inicio · «Centro de mando» (one screen at 1440×900; compact on phones): Por hacer (each item ticks
// itself when done), the Jornada (the last acta's progress and whether it squares; the next match's
// RSVP and convocatoria; the MVP line), Fichas approved / rejected inline behind an undo toast, and the
// five summary tiles. All from useAdmin(); writes go through resolvePlayerClaim.
import { useRef, useState } from "react";
import { opponentInitials } from "../../../lib/clubAnalytics";
import { resolvePlayerClaim } from "../../../lib/clubApi";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { clockTime, jLabel, longDay, shortDate, type TodoItem } from "../data/adminLogic";
import type { AdminData } from "../data/useAdminData";
import { AdminView } from "../shell/AdminView";
import { useAdmin, useAdminGo } from "../shell/context";
import { DOOR_HREF } from "../shell/nav";
import { Chip, EmptyState, SkeletonRows } from "../ui/controls";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const where = (home: boolean | undefined) => (home === false ? "fuera" : "en casa");
/** «T1» for «Temporada 1»; the first letters otherwise. */
const seasonCode = (name: string) => {
  const n = /(\d+)/.exec(name)?.[1];
  return n ? `T${n}` : name.slice(0, 3).toUpperCase();
};

export function Inicio() {
  const data = useAdmin();
  return <InicioView data={data} />;
}

export function InicioView({ data }: { data: AdminData }) {
  const go = useAdminGo();
  const toast = useToast();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const ficRef = useRef<HTMLDivElement>(null);
  const { overview, last, next } = data;
  const pending = overview.pending;
  const claims = data.claims.filter((c) => !hidden.has(c.uid));
  const nF = claims.length;
  const fChip = nF ? plural(nF, "pendiente", "pendientes") : "Al día";

  const lead = `${longDay(data.now)}${data.season ? ` · ${data.season.name}` : ""} · ${pending ? plural(pending, "cosa por hacer", "cosas por hacer") : "todo al día"}`;

  const decide = (uid: string, approve: boolean) => {
    const c = data.claims.find((x) => x.uid === uid);
    if (!c) return;
    const who = c.nickname ? `@${c.nickname}` : c.email;
    const num = c.player?.number != null ? ` (${c.player.number})` : "";
    const unhide = () =>
      setHidden((h) => {
        const n = new Set(h);
        n.delete(uid);
        return n;
      });
    setHidden((h) => new Set(h).add(uid));
    toast.defer({
      message: approve ? `Ficha aprobada · ${who} ya es ${c.playerLabel}${num}.` : `Petición de ${who} rechazada · puede volver a pedirla.`,
      commit: () => resolvePlayerClaim({ uid, approve }),
      onUndo: unhide,
      onError: unhide,
      errorMessage: approve ? "No se ha podido aprobar la ficha" : "No se ha podido rechazar la petición",
    });
    // The row leaves: the focus moves to the next decision (or «Ver todas las fichas»).
    requestAnimationFrame(() => {
      const next = ficRef.current?.querySelector<HTMLElement>(".mfr .ib.ok") ?? ficRef.current?.querySelector<HTMLElement>(".mfc > .btn");
      next?.focus({ preventScroll: true });
    });
  };

  const lastCard = last ? <LastActa data={data} /> : (
    <div className="jm2">
      <p className="lbl">Última</p>
      <p className="hint ad-show">Todavía no se ha jugado ningún partido esta temporada.</p>
    </div>
  );

  const actaChip = last
    ? last.publishedClean
      ? { tone: "ok" as const, text: `${jLabel(last.match)} · acta publicada` }
      : last.review.cuadra
        ? { tone: "ok" as const, text: `${jLabel(last.match)} · acta lista` }
        : { tone: "warn" as const, text: `${jLabel(last.match)} · acta en borrador` }
    : null;
  const nextLine = next ? `${jLabel(next.match)} · ${shortDate(dateMillis(next.match.date))} · ${clockTime(dateMillis(next.match.date))} · ${where(next.match.home)}` : "";

  return (
    <AdminView
      className="vin"
      kicker="Vestuario · Administración"
      title="Centro de mando"
      lead={lead}
      chips={
        <>
          {actaChip && (
            <li>
              <Chip tone={actaChip.tone}>{actaChip.text}</Chip>
            </li>
          )}
          {next && (
            <li>
              <Chip tone="sky" icon="clock">
                {nextLine}
              </Chip>
            </li>
          )}
          <li>
            <Chip tone={nF ? "gold" : "ok"} icon="inbox">
              {nF ? plural(nF, "ficha pendiente", "fichas pendientes") : "Fichas al día"}
            </Chip>
          </li>
        </>
      }
    >
      {data.error ? (
        <div className="vb scr">
          <div className="empty ad-err" role="alert">
            <AdIcon name="alert" size={22} />
            <b>No se han podido cargar los datos</b>
            <small>Comprueba la conexión y vuelve a intentarlo.</small>
            <button type="button" className="btn sm line" onClick={() => window.location.reload()}>
              Reintentar
            </button>
          </div>
        </div>
      ) : data.loading ? (
        <div className="vb scr">
          <SkeletonRows rows={6} label="Cargando el centro de mando…" />
        </div>
      ) : (
        <div className="vb scr ing">
          <section className="tdo" aria-labelledby="h-todo">
            <div className="tdo-h">
              <h2 className="h2s" id="h-todo">
                Por hacer
              </h2>
              <Chip tone={pending ? "warn" : "ok"} icon={null}>
                {pending ? `${pending} de ${overview.todo.length} pendientes` : "✓ Todo hecho"}
              </Chip>
            </div>
            <ol className="tdl">
              {overview.todo.map((t, i) => (
                <TodoRow key={t.key} item={t} n={i + 1} onGo={() => go(t.action.target)} />
              ))}
            </ol>
          </section>

          <section className="cd in-jor" aria-labelledby="h-jor">
            <div className="ch">
              <div className="t">
                <h2 className="h2s" id="h-jor">
                  Jornada
                </h2>
              </div>
              <button type="button" className="btn sm line" onClick={() => go({ section: "partidos" })}>
                Todos los partidos
                <AdIcon name="right" size={16} />
              </button>
            </div>
            <div className="jg2">
              {lastCard}
              {next ? (
                <div className="jm2">
                  <p className="lbl">Siguiente · {nextLine}</p>
                  <div className="vs">
                    <img src="/crest-128.webp" alt="Piti" width={24} height={24} />
                    <b className="tn time">{clockTime(dateMillis(next.match.date))}</b>
                    <span className="ini" aria-label={next.match.rival ?? "Rival"}>
                      {next.match.rivalInitials || opponentInitials(next.match.rival ?? "")}
                    </span>
                  </div>
                  <div className="rsvp" aria-label="Respuestas">
                    <Chip tone="ok">{plural(next.rsvp.yes, "viene", "vienen")}</Chip>
                    <Chip tone="warn">{`${next.rsvp.maybe} en duda`}</Chip>
                    <Chip>{`${next.rsvp.no} no`}</Chip>
                  </div>
                  <p className={`st ${next.conv.tone === "warn" ? "" : next.conv.tone}`.trim()}>
                    <span className="ic" aria-hidden="true">
                      {next.conv.mark}
                    </span>
                    {next.conv.text}
                  </p>
                  <p className="hint">{[next.match.kit === "away" ? "2ª equipación" : next.match.kit === "home" ? "1ª equipación" : "", next.note.split("\n")[0]].filter(Boolean).join(" · ") || next.match.venue || "Sin nota para el equipo"}</p>
                  <button type="button" className="btn" onClick={() => go({ section: "convocatorias", matchId: next.match.id })}>
                    <AdIcon name="list" size={16} />
                    <span className="ss">{next.conv.published ? "Ver la convocatoria" : "Preparar convocatoria"}</span>
                    <span className="sl">Convocar</span>
                  </button>
                </div>
              ) : (
                <div className="jm2">
                  <p className="lbl">Siguiente</p>
                  <p className="hint ad-show">No hay partidos programados.</p>
                  <button type="button" className="btn" onClick={() => go({ section: "partidos", nuevo: true })}>
                    <AdIcon name="plus" size={16} />
                    <span className="ss">Nuevo partido</span>
                    <span className="sl">Nuevo</span>
                  </button>
                </div>
              )}
            </div>
            <p className="mvp">
              <AdIcon name="star" size={18} />
              <span>
                <b>MVP:</b> {data.mvp}
              </span>
            </p>
          </section>

          <section className="cd in-fic" aria-labelledby="h-fic">
            <div className="ch">
              <div className="t">
                <h2 className="h2s" id="h-fic">
                  Fichas
                </h2>
                <span className="hint">Aprobar une la cuenta al jugador</span>
              </div>
              <Chip tone={nF ? "gold" : "ok"} icon={null}>
                {fChip}
              </Chip>
            </div>
            <div className="mfc" ref={ficRef}>
              {claims.slice(0, 3).map((c) => (
                <div className="mfr" key={c.uid}>
                  <span className="w">
                    <span>
                      <b>{c.nickname ? `@${c.nickname}` : c.email}</b> pide la ficha de{" "}
                      <span className="pchip">
                        {c.player?.number != null && <i>{c.player.number}</i>}
                        {c.playerLabel}
                      </span>
                    </span>
                    <small>{c.email}</small>
                  </span>
                  <span className="a">
                    <button type="button" className="ib ok" onClick={() => decide(c.uid, true)} aria-label={`Aprobar: ${c.nickname ? `@${c.nickname}` : c.email} es ${c.playerLabel}`}>
                      <AdIcon name="check" size={18} />
                    </button>
                    <button type="button" className="ib no" onClick={() => decide(c.uid, false)} aria-label={`Rechazar la petición de ${c.nickname ? `@${c.nickname}` : c.email}`}>
                      <AdIcon name="x" size={18} />
                    </button>
                  </span>
                </div>
              ))}
              {!nF && (
                <EmptyState title="Fichas al día">
                  Cuando un socio pida su ficha, aparece aquí.
                </EmptyState>
              )}
              <button type="button" className="btn sm line" onClick={() => go({ section: "fichas" })}>
                {nF > 3 ? `Ver las ${nF} fichas` : "Ver todas las fichas"}
                <AdIcon name="right" size={16} />
              </button>
            </div>
          </section>

          <Tiles data={data} fichas={fChip} onGo={go} />
        </div>
      )}
    </AdminView>
  );
}

function TodoRow({ item, n, onGo }: { item: TodoItem; n: number; onGo: () => void }) {
  return (
    <li className={item.done ? "done" : undefined}>
      <span className="tk" aria-hidden="true">
        <span className="n">{n}</span>
        <span className="c">
          <AdIcon name="check" size={15} />
        </span>
      </span>
      <span className="w">
        <b>
          {item.done && <span className="sr">Hecho: </span>}
          {item.title}
        </b>
        <small>{item.detail}</small>
      </span>
      <button type="button" className={`btn sm ${item.action.tone}`} onClick={onGo} aria-label={`${item.action.label}: ${item.title}`}>
        {item.action.label}
      </button>
    </li>
  );
}

function LastActa({ data }: { data: AdminData }) {
  const go = useAdminGo();
  const last = data.last!;
  const { match, review, publishedClean } = last;
  const t = dateMillis(match.date);
  const st = publishedClean ? { cls: "pub", mk: "✓", text: "Acta publicada" } : review.cuadra ? { cls: "ok", mk: "✓", text: "Cuadra · lista para publicar" } : { cls: "", mk: "!", text: "No cuadra todavía" };
  const open = !!match.voteClosesAt && match.voteClosesAt > data.now;
  const hint = publishedClean
    ? open
      ? `MVP abierto · cierra el ${shortDate(match.voteClosesAt!)} a las ${clockTime(match.voteClosesAt!)}`
      : "Calendario, perfiles y estadísticas al día"
    : match.draft
      ? match.draftSavedAt
        ? `Borrador guardado a las ${clockTime(match.draftSavedAt)}`
        : "Borrador guardado"
      : "Acta sin empezar";
  return (
    <div className="jm2">
      <p className="lbl">
        Última · {jLabel(match)} · {shortDate(t)} · {where(match.home)}
      </p>
      <div className="vs">
        <img src="/crest-128.webp" alt="Piti" width={24} height={24} />
        <b className="tn">
          {review.goalsFor}–{review.goalsAgainst}
        </b>
        <span className="ini" aria-label={match.rival ?? "Rival"}>
          {match.rivalInitials || opponentInitials(match.rival ?? "")}
        </span>
      </div>
      <ol className="prog2" aria-label="Pasos del acta">
        {review.steps.map((s) => (
          <li key={s.key} className={s.tone || undefined} aria-label={`${s.label}: ${s.summary}`} />
        ))}
      </ol>
      <p className={`st ${st.cls}`.trim()}>
        <span className="ic" aria-hidden="true">
          {st.mk}
        </span>
        {st.text}
      </p>
      <p className="hint">{hint}</p>
      <button type="button" className="btn gold" onClick={() => go({ section: "partidos", matchId: match.id, tab: "acta" })}>
        <AdIcon name="pencil" size={16} />
        <span className="ss">{publishedClean ? "Ver el acta" : "Abrir el acta"}</span>
        <span className="sl">Acta</span>
      </button>
    </div>
  );
}

function Tiles({ data, fichas, onGo }: { data: AdminData; fichas: string; onGo: ReturnType<typeof useAdminGo> }) {
  const c = data.overview.counters;
  const porteros = data.roster.filter((p) => p.position === "POR").length;
  const injured = data.roster.filter((p) => p.injured).length;
  const nums = data.roster.map((p) => p.number).filter((n): n is number => n != null);
  const dup = nums.length - new Set(nums).size;
  const plSum = [plural(porteros, "portero", "porteros"), injured ? plural(injured, "lesionado", "lesionados") : "", dup ? plural(dup, "dorsal repetido", "dorsales repetidos") : "dorsales únicos"].filter(Boolean).join(" · ");
  const sid = data.season?.id;
  const inSeason = data.matches.filter((m) => m.seasonId === sid && m.status !== "cancelled");
  const played = inSeason.filter((m) => data.stateOf(m) === "published").length;
  const archived = data.seasons.filter((s) => s.archived).length;
  const users = data.people.filter((p) => !p.removed).length - data.admins;
  return (
    <div className="tiles">
      <button type="button" className="tl" onClick={() => onGo({ section: "plantilla" })}>
        <AdIcon name="team" size={20} />
        <b>Plantilla</b>
        <span className="big">{data.roster.length}</span>
        <small>{plSum}</small>
      </button>
      <button type="button" className="tl" onClick={() => onGo({ section: "temporadas" })}>
        <AdIcon name="flag" size={20} />
        <b>Temporadas</b>
        <span className="big">{data.season ? seasonCode(data.season.name) : "—"}</span>
        <small>{[data.season ? `Activa · ${played} de ${inSeason.length} jornadas` : "Sin temporada activa", archived ? plural(archived, "archivada", "archivadas") : ""].filter(Boolean).join(" · ")}</small>
      </button>
      <button type="button" className="tl" onClick={() => onGo({ section: "capitanes" })}>
        <AdIcon name="shield" size={20} />
        <b>Capitanes</b>
        <span className="big">{data.admins}</span>
        <small>{`${plural(data.admins, "administrador", "administradores")} · ${plural(Math.max(0, users), "usuario", "usuarios")}`}</small>
      </button>
      <button type="button" className="tl" onClick={() => onGo({ section: "contenido" })}>
        <AdIcon name="doc" size={20} />
        <b>Contenido</b>
        <span className="big">{c.contenido.n}</span>
        <small>{data.content.gaps.length ? `Por completar: ${data.content.gaps.map((g) => g.title.split(":")[0].toLowerCase()).join(", ")}` : "Todo completo"}</small>
      </button>
      <a className="tl" href={DOOR_HREF}>
        <AdIcon name="door" size={20} />
        <b>
          La puerta
          <AdIcon name="ext" size={12} />
        </b>
        <span className="big">{data.doorRequests}</span>
        <small>{data.doorRequests ? "Llamando · se abre en el vestuario" : "Nadie llamando · en el vestuario"}</small>
      </a>
      <button type="button" className="tl mob" onClick={() => onGo({ section: "fichas" })}>
        <AdIcon name="inbox" size={20} />
        <b>Fichas</b>
        <small>{fichas}</small>
      </button>
    </div>
  );
}
