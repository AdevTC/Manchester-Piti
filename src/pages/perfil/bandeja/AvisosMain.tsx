// /avisos and /avisos/a-medida: la bandeja (TuCarta «avisos») — the head («5 cosas te tocan», what is unread,
// «Marcar todo como leído» with «Deshacer»), the five filters with their counts (?ver=), «Te toca» first answered
// in place with Tú's own cards (TodoCards: usePending's items, la caja and the porra too), each match one
// group (G/E/P and OUR score first), the vestuario by day, the season's fixture as ONE «Calendario: N jornadas
// nuevas» that opens, and «Este móvil» at the side (its state, the shortcuts, the pause, the silenced matches, the
// topics in Ajustes › Avisos) — and «A medida»: this device, the shortcuts, every topic, the pause, a test notice and
// the calendar. A fan (no session) gets «A medida» only: the notices are the vestuario's. ProfilePage draws the sky,
// the bars and the toast around this <main>; moving between filters goes through the router in a View Transition.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { DotsMenu, Switch, TuIcon } from "../../../components/vidrio/tu/ui";
import { tuGo, type TuDir } from "../../../components/vidrio/tu/kit";
import { useAuth } from "../../../context/AuthContext";
import { useClock } from "../../../hooks/useClock";
import { useSeason } from "../../../context/SeasonContext";
import { nameFor, nextFixture, useClubData } from "../../../lib/clubData";
import { googleSubscribeUrl, webcalUrl } from "../../../lib/calendarLinks";
import { groupNotices, relativeTime, type Notice } from "../../../lib/derived/notices";
import { capital } from "../../../lib/derived/words";
import { siteOrigin } from "../../../lib/derived/venue";
import { currentSeasonId } from "../../../lib/vestuario";
import { pushSaveError, toggleTopic } from "../../../lib/push";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { jornadaOf } from "../../../components/vidrio/account/accountModel";
import { useMe } from "../../vestuario/writes";
import { upcomingRows } from "../avisos";
import { showTestNotice } from "../device";
import { copyText } from "../fxRuntime";
import { usePending, type PendingItem } from "../tu/usePending";
import type { Say } from "../tu/places/types";
import type { Inbox, Pend, StackView } from "./useInbox";
import { noticeMenu, stackMenu } from "./menus";
import { TodoCards } from "../tu/places/tu/TodoCards";
import { useAvisoActions, type AvisoActions } from "./actions";
import { useThisDevice, type ThisDevice } from "./device";
import { PauseChips, PresetSeg } from "./deviceParts";
import { actsOf, calendarBatch, filterOf, filterRows, iconOf, isNewFixture, kindOf, nextLine, pauseLine, pendTitle, pl, PRESET_NOTE, shownBy, stackLine, testNotice, tocaTitle, topicsFor, unreadText, verOf, type AvFilter } from "./model";
import { takeFlyBell } from "./flyBell";
import { CAL_ID, useCalendarFold } from "./useCalendar";
import "../../../styles/tu-avisos.css";

/** Where a member chooses topic by topic now (Ajustes › Avisos). */
const AJ_AVISOS = "/perfil/ajustes/avisos";

export function AvisosMain({ say }: { say: Say }) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const search = useLocation({ select: (l) => l.search }) as { ver?: unknown };
  const navigate = useNavigate();
  const { matches } = useClubData();
  const { seasons } = useSeason();
  const me = useMe();
  const now = useClock(60_000);
  const next = nextFixture(matches, now);
  const seasonId = currentSeasonId(next, matches, seasons);
  // (one reader: usePending holds la bandeja's inbox and adds la caja and the porra)
  const probe = usePending({ enabled: !!me, seasonId, playerId: me?.playerId ?? null, next: next ? { id: next.id, rival: next.rival, status: "scheduled", date: dateMillis(next.date) } : null, now });
  const inbox = probe.inbox;
  const member = inbox.member;
  const items: PendingItem[] = member ? probe.items.filter((p) => (p.kind === "caja" ? inbox.viewer.who === "jugador" : true)) : [];
  const d = useThisDevice();
  const a = useAvisoActions(inbox, say);
  const sec: "bandeja" | "amedida" = !member || pathname.replace(/\/+$/, "").endsWith("/a-medida") ? "amedida" : "bandeja";
  const f = filterOf(search.ver);
  const [fly] = useState(takeFlyBell);
  const [flyOn, setFlyOn] = useState(fly);
  useEffect(() => {
    if (!flyOn) return;
    const t = window.setTimeout(() => setFlyOn(false), 900);
    return () => window.clearTimeout(t);
  }, [flyOn]);

  const move = (dir: TuDir, to: "bandeja" | "amedida", nf: AvFilter | null, replace = false) => {
    const ver = nf ? verOf(nf) : undefined;
    tuGo(dir, async () => {
      await navigate({ to: to === "amedida" ? "/avisos/a-medida" : "/avisos", search: ver ? { ver } : {}, replace, resetScroll: !replace } as never);
    });
  };

  if (sec === "bandeja") {
    return (
      <main className="tup nx tc-av" id="tu-main">
        <Bandeja inbox={inbox} items={items} d={d} a={a} f={f} say={say} fly={flyOn} onFilter={(nf) => move("up", "bandeja", nf, true)} />
      </main>
    );
  }
  return <AMedidaMain inbox={inbox} d={d} a={a} say={say} onBandeja={() => move("left", "bandeja", null)} />;
}

/** /avisos/a-medida (and /avisos for a fan): today's head, then «A medida». */
function AMedidaMain({ inbox, d, a, say, onBandeja }: { inbox: Inbox; d: ThisDevice; a: AvisoActions; say: Say; onBandeja: () => void }) {
  const member = inbox.member;
  const tabs = [
    { k: "bandeja" as const, t: "Bandeja", hint: member ? unreadText(inbox.unread) : "De los socios" },
    { k: "amedida" as const, t: "A medida", hint: d.line },
  ];
  const lede = !member ? "Los avisos del vestuario son de los socios. Aquí eliges qué te avisamos del partido en este móvil." : "Qué te llega a este móvil: los atajos, tema a tema, la pausa, una prueba y el calendario.";
  return (
    <main className="tu-main tu-av" id="tu-main">
      <header className="tu-av__head vd-reg-1">
        <div className="tu-av__tt">
          <p className="tu-kick">Tu bandeja</p>
          <h1 className="tu-h1">Avisos</h1>
          <p className="tu-lede">{lede}</p>
        </div>
        <nav className="tu-avtabs" aria-label="Avisos">
          {tabs.map((t) => {
            const on = t.k === "amedida";
            return (
              <button key={t.k} type="button" className={`tu-avtab${on ? " is-on" : ""}`} aria-current={on ? "page" : "false"} onClick={() => !on && onBandeja()}>
                {on && <span className="tu-nav__bead" aria-hidden="true" />}
                <b>{t.t}</b>
                <small>{t.hint}</small>
              </button>
            );
          })}
        </nav>
      </header>
      <AMedida inbox={inbox} d={d} a={a} say={say} />
    </main>
  );
}

// ---------- the bandeja

/** A day group shows this many before «Ver N más»; a match group, its newest this many. */
const DAY_MAX = 6;
const STACK_MAX = 3;

function Bandeja({ inbox, items, d, a, f, say, fly, onFilter }: { inbox: Inbox; items: readonly PendingItem[]; d: ThisDevice; a: AvisoActions; f: AvFilter; say: Say; fly: boolean; onFilter: (f: AvFilter) => void }) {
  const { matches } = useClubData();
  const [exp, setExp] = useState<Record<string, boolean>>({});
  const [calOpen, setCalOpen] = useState(false);
  const show = shownBy(f);
  const one = f.startsWith("m:") ? f.slice(2) : null;
  const open = items.filter((p) => !p.done).length;

  // the season's fixture: one item instead of a stack per jornada
  const { stacks: allStacks, cal, unread: calUnread } = useCalendarFold(inbox);
  const calNotice: Notice | null = cal ? { id: CAL_ID, topic: "dates", title: cal.title, body: cal.body, url: "", at: cal.at, audience: "team" } : null;

  const partidosN = allStacks.reduce((s, x) => s + x.rows.length, 0);
  const rows = filterRows({ toca: open, unread: inbox.unread, partidos: partidosN, loose: inbox.loose, batch: !!cal });
  const stacks = show.stacks === "all" ? allStacks : show.stacks === "one" ? inbox.stacks.filter((x) => x.matchId === one) : [];
  const withCal = (list: readonly Notice[]) => (calNotice ? [...list, calNotice].sort((x, y) => y.at - x.at) : [...list]);
  const loose = show.loose === "all" ? withCal(inbox.loose) : show.loose === "vestuario" ? withCal(inbox.loose.filter((n) => kindOf(n) === "vestuario")) : show.loose === "tuyos" ? inbox.feed.filter((n) => kindOf(n) === "tuyo") : [];
  const unreadRows = show.unread ? [...inbox.feed.filter((n) => inbox.reads.unread(n) && !(cal && isNewFixture(n))), ...(calNotice && calUnread ? [calNotice] : [])].sort((x, y) => y.at - x.at) : [];
  const empty = !inbox.loading && !inbox.failed && !inbox.list.length && !items.length;
  const list = !inbox.loading && !inbox.failed && !empty;
  const nextT = nextLine(inbox.next);
  const oneStack = one ? inbox.stackOf(one) : undefined;
  const jOf = (id: string): number | null => {
    const m = matches.find((x) => x.id === id);
    return m ? jornadaOf(matches, m) : null;
  };

  // «Marcar todo como leído» and its «Deshacer»: the ones unread then turn unread again
  const readsRef = useRef(inbox.reads);
  useEffect(() => {
    readsRef.current = inbox.reads;
  });
  const markAll = () => {
    const was = inbox.list.filter((n) => inbox.reads.unread(n)).map((n) => n.id);
    inbox.reads.markAll().then(
      () => say("Todo leído. Te avisamos de lo nuevo.", () => void readsRef.current.mark(was, false).catch(() => say("No se ha podido deshacer. Inténtalo otra vez."))),
      () => say("No se ha podido guardar. Inténtalo otra vez."),
    );
  };
  const toCal = () => {
    if (!cal) return;
    if (!calOpen && calUnread) a.markRead(cal.ids, true);
    setCalOpen((o) => !o);
  };
  const row = (n: Notice) => (n.id === CAL_ID && cal ? <CalRow key={CAL_ID} cal={cal} unread={calUnread} open={calOpen} onToggle={toCal} now={inbox.now} /> : <Row key={n.id} n={n} inbox={inbox} a={a} />);
  const sub = `${inbox.unread ? `${inbox.unread} sin leer` : "Nada sin leer"} · ${open ? "primero lo que te toca, luego cada partido y el vestuario por días." : "cada partido en un solo bloque y el vestuario por días."}`;

  return (
    <>
      <header className="tc-head">
        <div className="tc-head__t">
          <p className="tc-kick">La bandeja · lo que llega a la campana</p>
          <h1 className="nx-h2">{tocaTitle(open)}</h1>
          <p className="nx-sub">{sub}</p>
        </div>
        {inbox.unread > 0 && (
          <button type="button" className="nx-lnk" onClick={markAll}>
            Marcar todo como leído
          </button>
        )}
      </header>
      <div className="tc-ib">
        <div className="tc-ib__main" style={fly ? { viewTransitionName: "tu-bell" } : undefined}>
          {d.pause && (
            <p className="tc-note is-warn">
              <b>{pauseLine(d.pause.kind)}</b> Siguen llegando aquí.{" "}
              <button type="button" className="nx-lnk" onClick={a.resume}>
                Reanudar ahora
              </button>
            </p>
          )}
          {!d.ready && (
            <p className={`tc-note is-${d.words.tone}`}>
              <b>{d.words.title}</b> Los avisos siguen llegando aquí.{" "}
              <button type="button" className="nx-lnk" onClick={() => a.go(AJ_AVISOS)}>
                Cómo arreglarlo
              </button>
            </p>
          )}
          <div className="tc-filt" role="group" aria-label="Filtrar la bandeja">
            {rows.map((x) => {
              const on = f === x.f;
              return (
                <button key={x.f} type="button" className="vd-glass vd-press" aria-pressed={on} aria-label={`${x.t}, ${x.n}`} onClick={() => !on && onFilter(x.f)}>
                  {x.t}
                  <small aria-hidden="true">{x.n}</small>
                </button>
              );
            })}
            {one && (
              <button type="button" className="vd-glass vd-press" aria-pressed="true" aria-label={`Solo ${oneStack ? stackName(oneStack) : "este partido"}. Quitar el filtro`} onClick={() => onFilter("todos")}>
                {oneStack ? stackName(oneStack) : "Este partido"}
                <TuIcon name="close" className="nx-ic" />
              </button>
            )}
          </div>
          {inbox.loading && (
            <div className="tu-skel" role="status">
              <span className="vd-vh">Cargando los avisos…</span>
              <i />
              <i />
              <i />
            </div>
          )}
          {inbox.failed && (
            <div className="tc-empty" role="alert">
              <TuIcon name="wifiOff" className="nx-ic" />
              <b>No se han podido cargar los avisos.</b>
              <span>Comprueba la conexión y vuelve a intentarlo. Lo que ya habías visto sigue en tu móvil.</span>
              <button type="button" className="vd-glass vd-press nx-btn" onClick={() => window.location.reload()}>
                Reintentar
              </button>
            </div>
          )}
          {empty && (
            <div className="tc-empty" role="status">
              <TuIcon name="bell" className="nx-ic" />
              <b>Aquí verás los avisos del equipo.</b>
              <span>{nextT} La convocatoria llegará aquí y la contestas sin salir.</span>
            </div>
          )}
          {list && (
            <>
              {show.pend && (items.length > 0 || f === "toca") && (
                <section className="tc-grp tc-grp--toca" aria-labelledby="tc-ibt-h">
                  <div className="tc-grp__h">
                    <h2 id="tc-ibt-h">{pendTitle(open)}</h2>
                    <p className="nx-meta">Contesta aquí: lo mismo que en tu página</p>
                  </div>
                  <TodoCards items={items} say={say} layout="list" jornadaOf={jOf} calm={nextT} labelledBy="tc-ibt-h" onAnswered={(x) => isPend(x) && a.answered(x)} />
                </section>
              )}
              {stacks.map((x) => (
                <Stack key={x.matchId} x={x} inbox={inbox} a={a} all={one === x.matchId || !!exp[x.matchId]} onMore={() => setExp((e) => ({ ...e, [x.matchId]: !e[x.matchId] }))} />
              ))}
              {show.unread &&
                (unreadRows.length ? (
                  <section className="tc-grp" aria-labelledby="tc-un-h">
                    <div className="tc-grp__h">
                      <h2 id="tc-un-h">Sin leer</h2>
                      <p className="nx-meta">{pl(unreadRows.length, "aviso", "avisos")}</p>
                    </div>
                    <ul className="tc-nts">{unreadRows.map(row)}</ul>
                  </section>
                ) : (
                  <p className="tc-calm">
                    <span className="tk-tile">
                      <TuIcon name="check" className="nx-ic" />
                    </span>
                    <span>
                      <b>Nada sin leer.</b> Te avisamos de lo nuevo.
                    </span>
                  </p>
                ))}
              {groupNotices(loose, inbox.now).map((g) => {
                const dayKey = `d:${g.key}`;
                const more = !!exp[dayKey];
                const shown = more ? g.items : g.items.slice(0, DAY_MAX);
                return (
                  <section key={g.key} className="tc-grp" aria-labelledby={`tc-day-${g.key}`}>
                    <div className="tc-grp__h">
                      <h2 id={`tc-day-${g.key}`}>{g.label}</h2>
                      <p className="nx-meta">{f === "tuyos" ? "Tuyos" : "Del vestuario"}</p>
                    </div>
                    <ul className="tc-nts">{shown.map(row)}</ul>
                    {g.items.length > DAY_MAX && (
                      <button type="button" className="nx-lnk tc-more" aria-expanded={more} onClick={() => setExp((e) => ({ ...e, [dayKey]: !more }))}>
                        {more ? "Ver menos" : `Ver ${pl(g.items.length - DAY_MAX, "más", "más")}`}
                      </button>
                    )}
                  </section>
                );
              })}
              {(f === "partidos" && !stacks.length) || (f === "vestuario" && !loose.length) ? (
                <p className="tc-calm">
                  <span className="tk-tile">
                    <TuIcon name="check" className="nx-ic" />
                  </span>
                  <span>
                    <b>{f === "partidos" ? "Ningún aviso de partidos." : "Nada del vestuario."}</b> {nextT}
                  </span>
                </p>
              ) : null}
            </>
          )}
        </div>
        <Device inbox={inbox} d={d} a={a} say={say} />
      </div>
    </>
  );
}

/** One of la bandeja's own items (it stands for notices: answered, they turn read). */
const isPend = (p: PendingItem): p is Pend => "noticeIds" in p;

/** «J2 · Pitutis». */
const stackName = (x: StackView): string => `${x.j ? `J${x.j} · ` : ""}${x.rival}`;

/** A match's group: «J2 · Pitutis», G/E/P with OUR score first, its newest notices («Ver los N»), its «⋯». */
function Stack({ x, inbox, a, all, onMore }: { x: StackView; inbox: Inbox; a: AvisoActions; all: boolean; onMore: () => void }) {
  const muted = inbox.muted.includes(x.matchId);
  const id = `tc-ms-${x.matchId}`;
  const shown = all ? x.rows : x.rows.slice(0, STACK_MAX);
  const hidden = x.rows.slice(STACK_MAX);
  const hiddenNew = hidden.filter((n) => inbox.reads.unread(n)).length;
  const line = stackLine(x.res, x.gf, x.ga, x.at ?? NaN, x.home);
  return (
    <section className={`tc-grp tc-ms${muted ? " is-muted" : ""}`} aria-labelledby={id}>
      <div className="tc-grp__h">
        <h2 id={id}>{stackName(x)}</h2>
        <p className="nx-meta tc-ms__line">
          {x.res && (
            <span className={`tc-res is-${x.res}`} aria-hidden="true">
              {x.res}
            </span>
          )}
          <span>{line}</span>
          {muted && <span className="tk-st is-off">Silenciado aquí</span>}
        </p>
        <span className="tc-ms__acts">
          <button type="button" className="nx-lnk" onClick={() => a.go(`/partidos/${encodeURIComponent(x.matchId)}`)}>
            {x.res ? "Abrir el partido" : "Ver la previa"}
          </button>
          <DotsMenu items={stackMenu(x, inbox, a)} label={`Más opciones del ${x.j ? `J${x.j}` : "partido"}`} right />
        </span>
      </div>
      <ul className="tc-nts">
        {shown.map((n) => (
          <Row key={n.id} n={n} inbox={inbox} a={a} />
        ))}
      </ul>
      {hidden.length > 0 && (
        <button type="button" className="nx-lnk tc-more" aria-expanded={all} onClick={onMore}>
          {all ? "Ver menos" : `Ver ${hidden.length === 1 ? "el otro aviso" : `los otros ${hidden.length}`}${hiddenNew ? ` (${hiddenNew === 1 ? "1 nuevo" : `${hiddenNew} nuevos`})` : ""}`}
        </button>
      )}
    </section>
  );
}

/** A notice: its glyph, title and body (opens it), its own action, «Nuevo» and when, its «⋯». Gold only for our
 *  goals and the MVP. */
function Row({ n, inbox, a }: { n: Notice; inbox: Inbox; a: AvisoActions }) {
  const un = inbox.reads.unread(n);
  const acts = actsOf(n);
  const gold = (n.topic === "goals" && !/^Gol de /.test(n.title)) || (n.topic === "mvp" && /^MVP/.test(n.title));
  return (
    <li className={`tc-nt${un ? " is-new" : ""}`}>
      <span className={`tk-tile${gold ? " tk-tile--gold" : ""}`}>
        <TuIcon name={iconOf(n)} className="nx-ic" />
      </span>
      <span className="tc-nt__t">
        <button type="button" className="tc-nt__open" onClick={() => a.open(n)} aria-label={`${n.title}${un ? ", sin leer" : ""}. Abrir`}>
          <b>{n.title}</b>
          <span>{n.body}</span>
        </button>
        {acts.length > 0 && (
          <span className="tc-nt__acts">
            {acts.map((x) => (
              <button key={x.k} type="button" className="nx-lnk" onClick={() => a.act(x.k, n)}>
                {x.t}
              </button>
            ))}
          </span>
        )}
      </span>
      <span className="tc-nt__w">
        {un && <span className="tc-new">Nuevo</span>}
        {capital(relativeTime(n.at, inbox.now))}
      </span>
      <DotsMenu items={noticeMenu(n, inbox, a)} label={`Más opciones: ${n.title}`} right />
    </li>
  );
}

/** The season's fixture as one notice: «Calendario: 20 jornadas nuevas», «Ver las 20 jornadas». */
function CalRow({ cal, unread, open, onToggle, now }: { cal: ReturnType<typeof calendarBatch>; unread: boolean; open: boolean; onToggle: () => void; now: number }) {
  const n = cal.rows.length;
  return (
    <li className={`tc-nt tc-nt--cal${unread ? " is-new" : ""}`}>
      <span className="tk-tile">
        <TuIcon name="cal" className="nx-ic" />
      </span>
      <span className="tc-nt__t">
        <b>{cal.title}</b>
        <span>{cal.body}</span>
        <span>
          <button type="button" className="nx-lnk" aria-expanded={open} aria-controls="tc-cal20" onClick={onToggle}>
            {open ? `Recoger ${n === 1 ? "la jornada" : `las ${n}`}` : `Ver ${n === 1 ? "la jornada" : `las ${n} jornadas`}`}
          </button>
        </span>
        {open && (
          <ul className="tc-cal20" id="tc-cal20" aria-label={n === 1 ? "La jornada nueva" : `Las ${n} jornadas nuevas`}>
            {cal.rows.map((r) => (
              <li key={r.key}>{r.t}</li>
            ))}
          </ul>
        )}
      </span>
      <span className="tc-nt__w">
        {unread && <span className="tc-new">Nuevo</span>}
        {capital(relativeTime(cal.at, now))}
      </span>
    </li>
  );
}

/** «Este móvil» (the side panel): its state, the shortcuts, the pause, the silenced matches, the topics in Ajustes. */
function Device({ inbox, d, a, say }: { inbox: Inbox; d: ThisDevice; a: AvisoActions; say: Say }) {
  const line = d.pause ? pauseLine(d.pause.kind) : d.ready ? `${d.words.title}.` : d.words.dev;
  return (
    <aside className="tk-panel tc-dev" aria-labelledby="tc-dev-h">
      <h2 className="nx-h3" id="tc-dev-h">
        Este móvil
      </h2>
      <p className="tc-dev__st">
        <span className={`tk-st is-${d.words.tone}`}>{d.pause ? "En pausa" : d.words.chip}</span> <span className="nx-meta">{line}</span>
      </p>
      <p className="tc-dev__l" id="tc-dev-p">
        Te llega a este móvil
      </p>
      <PresetSeg d={d} four say={say} labelledBy="tc-dev-p" cls="nx-seg tc-dev__seg" onCustom={() => a.go(AJ_AVISOS)} />
      <p className="nx-meta">{PRESET_NOTE[d.choice]}</p>
      <p className="tc-dev__l" id="tc-dev-pause">
        Pausar
      </p>
      <PauseChips d={d} a={a} wrap="tk-quick" chip="tk-chip" labelledBy="tc-dev-pause" />
      {inbox.muted.length > 0 && (
        <>
          <p className="tc-dev__l">Partidos silenciados</p>
          <ul className="tc-mutes">
            {inbox.muted.map((id) => {
              const x = inbox.stackOf(id);
              return (
                <li key={id}>
                  <span>{x ? stackName(x) : inbox.matchName(id)}</span>
                  <button type="button" className="nx-lnk" onClick={() => a.muteMatch(id, false)}>
                    Volver a avisarme
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p>
        <button type="button" className="nx-lnk" onClick={() => a.go(AJ_AVISOS)}>
          Tema a tema, en Ajustes › Avisos
        </button>
      </p>
    </aside>
  );
}

/** The matches this device stays quiet for, each with «Volver a avisarme». */
function Muted({ inbox, a, h }: { inbox: Inbox; a: AvisoActions; h: ReactNode }) {
  if (!inbox.muted.length) return null;
  return (
    <>
      {h}
      <ul className="tu-mutes">
        {inbox.muted.map((id) => {
          const x = inbox.stackOf(id);
          return (
            <li key={id}>
              <span>{x ? `${x.j ? `J${x.j} · ` : ""}${x.rival}` : inbox.matchName(id)}</span>
              <button type="button" className="vd-link" onClick={() => a.muteMatch(id, false)}>
                Volver a avisarme
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ---------- A medida

export function AMedida({ inbox, d, a, say }: { inbox: Inbox; d: ThisDevice; a: AvisoActions; say: (t: string) => void }) {
  const { profile } = useAuth();
  const { matches, players } = useClubData();
  const [busy, setBusy] = useState<string | null>(null);
  const [testN, setTestN] = useState(0);
  const [calCp, setCalCp] = useState(false);
  const firstTopic = useRef<HTMLLIElement | null>(null);
  const topics = topicsFor(inbox.viewer);
  const on = (id: string) => d.ready && inbox.topics.includes(id as never);
  const nOn = topics.filter((t) => on(t.id)).length;
  const lead = !d.ready ? "Se activan cuando este móvil esté listo." : d.choice === "custom" ? `A medida: ${pl(nOn, "tema activo", "temas activos")}.` : PRESET_NOTE[d.choice];
  const flip = (id: string) => {
    if (!d.ready) {
      say("Primero, este móvil tiene que estar listo.");
      return;
    }
    if (busy) return;
    const want = !inbox.topics.includes(id as never);
    setBusy(id);
    toggleTopic(id as never, want)
      .then(
        () => undefined,
        (e: unknown) => say(pushSaveError(e)),
      )
      .finally(() => setBusy(null));
  };
  const me = players.find((p) => p.id === profile?.playerId);
  const name = me ? nameFor(me).toLocaleUpperCase("es") : profile?.nickname ? `@${profile.nickname}` : "PITI";
  const next = inbox.next;
  const cantTest = !(d.ready && d.choice !== "nada");
  const why = !d.ready ? "Se activa cuando este móvil esté listo." : d.choice === "nada" ? "Con «Nada» no hay nada que probar." : "";
  const test = testN > 0 && d.ready ? testNotice(testN, { name, rival: next?.rival ?? null, j: next?.j ?? null }) : null;
  const probar = () => {
    if (cantTest) return;
    const n = testN + 1;
    const t = testNotice(n, { name, rival: next?.rival ?? null, j: next?.j ?? null });
    setTestN(n);
    showTestNotice(t.title, t.body).then(
      () => say("Aviso de prueba enviado a este móvil."),
      () => say("No se ha podido mostrar el aviso en este móvil. Recarga la página y vuelve a probar."),
    );
  };
  const feed = `${siteOrigin()}/calendario.ics`;
  const cal = upcomingRows(matches, inbox.now, 3);
  const fix = () => {
    d.refresh();
    if (d.kind === "nosoporta") {
      document.getElementById("tu-cal")?.scrollIntoView({ block: "start" });
      return;
    }
    say(d.kind === "iphone" ? "Aquí sigues en Safari: abre Manchester Piti desde el icono de tu pantalla de inicio." : "Siguen bloqueados: sigue los tres pasos y recarga la página.");
  };
  const copyCal = () =>
    void copyText(webcalUrl(feed)).then((ok) => {
      if (ok) {
        setCalCp(true);
        say("Enlace del calendario copiado.");
      } else say("No se ha podido copiar el enlace.");
    });
  return (
    <div className="tu-av__body tu-am vd-reg-2">
      <section className="tu-blk" aria-labelledby="tu-dev-t">
        <h2 className="tu-h3" id="tu-dev-t">
          Este móvil
        </h2>
        <div className={`tu-devcard is-${d.words.tone}`}>
          <span className={`tu-pill is-${d.words.tone}`}>{d.words.chip}</span>
          <b>{d.words.title}</b>
          <small>{d.words.dev}</small>
          {d.words.steps.length > 0 && (
            <ol className="tu-steps">
              {d.words.steps.map((s, i) => (
                <li key={s}>
                  <span aria-hidden="true">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          )}
          {d.words.btn && (
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={fix}>
              <TuIcon name="check" />
              {d.words.btn}
            </button>
          )}
        </div>
        <h2 className="tu-h3" id="tu-what-t">
          Atajos
        </h2>
        <PresetSeg d={d} four say={say} labelledBy="tu-what-t" onCustom={() => firstTopic.current?.querySelector<HTMLElement>(".vd-switch")?.focus()} />
        <p className="tu-blk__d" role="status">
          {lead}
        </p>
        <h2 className="tu-h3">Tema a tema</h2>
        <ul className="tu-topics">
          {topics.map((t, i) => (
            <li key={t.id} ref={i === 0 ? firstTopic : undefined}>
              <span className="tu-opts__i">
                <TuIcon name={t.icon} />
              </span>
              <span className="tu-opts__t">
                <b>
                  {t.t}
                  {t.who === "cap" && <span className="tu-pill">Capitanes</span>}
                </b>
                <small>{t.d}</small>
              </span>
              <Switch id={`tu-tp-${t.id}`} on={on(t.id)} dis={!d.ready} label={`${t.t}${t.who === "cap" ? ", solo capitanes" : ""}`} onToggle={() => flip(t.id)} />
            </li>
          ))}
        </ul>
        <div className="tu-optrow">
          <span className="tu-opts__t">
            <b>Vibrar con los goles</b>
            <small>Con «Solo goles», «Todo» o a medida.</small>
          </span>
          <Switch
            on={d.vibrate}
            dis={!d.ready || d.choice === "nada"}
            label="Vibrar con los goles"
            onToggle={() =>
              d.setVibrate(!d.vibrate).then(
                () => undefined,
                (e: unknown) => say(pushSaveError(e)),
              )
            }
          />
        </div>
      </section>
      <section className="tu-blk" aria-labelledby="tu-pause-t">
        <h2 className="tu-h3" id="tu-pause-t">
          Pausar
        </h2>
        <p className="tu-blk__d">El móvil deja de sonar; la campana sigue guardándolo todo.</p>
        <PauseChips d={d} a={a} />
        {d.pause && (
          <p className="tu-state is-warn">
            <b>{pauseLine(d.pause.kind)}</b>
            <span>
              <button type="button" className="vd-link" onClick={a.resume}>
                Reanudar ahora
              </button>
            </span>
          </p>
        )}
        <Muted inbox={inbox} a={a} h={<h3 className="tu-h4">Partidos silenciados</h3>} />
        <h2 className="tu-h3">Probar en este móvil</h2>
        <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm tu-self" aria-disabled={cantTest} aria-describedby={why ? "tu-test-why" : undefined} onClick={probar}>
          <TuIcon name="bell" />
          Mandar un aviso de prueba
        </button>
        {why && (
          <p className="tu-small" id="tu-test-why">
            {why}
          </p>
        )}
        {test && (
          <div className="vd-glass tu-push" role="status">
            <p className="tu-push__h">
              <img src="/crest-128.webp" alt="" />
              <span>Manchester Piti</span>
              <span>ahora</span>
            </p>
            <b>{test.title}</b>
            <span>{test.body}</span>
          </div>
        )}
        <h2 className="tu-h3" id="tu-cal">
          Calendario
        </h2>
        <p className="tu-blk__d">Los partidos del club en tu calendario de siempre. Se actualiza solo, también sin avisos.</p>
        {cal.length > 0 ? (
          <ul className="tu-cal" aria-label="Próximos partidos">
            {cal.map((c) => (
              <li key={c.id}>
                <span className="tu-cal__d">
                  <small>{c.mon}</small>
                  <b>{c.day}</b>
                </span>
                <span>
                  <b>{c.rival}</b>
                  <small>{c.meta}</small>
                </span>
                <span className="tu-cal__j">{c.j}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tu-small">No hay partidos por jugar todavía. En cuanto el capitán programe uno, sale aquí y en tu calendario.</p>
        )}
        <div className="tu-row">
          <a className="vd-glass vd-press vd-btn vd-btn--sm" href={googleSubscribeUrl(feed)} target="_blank" rel="noopener noreferrer" onClick={() => say("Se abre Google Calendar para suscribirte.")}>
            <TuIcon name="google" />
            Google
          </a>
          <a className="vd-glass vd-press vd-btn vd-btn--sm" href={webcalUrl(feed)} onClick={() => say("Se abre Calendario de Apple para suscribirte.")}>
            <TuIcon name="apple" />
            Apple
          </a>
          <button type="button" className="vd-link" onClick={copyCal}>
            {calCp ? "Enlace copiado" : "Copiar enlace"}
          </button>
        </div>
      </section>
    </div>
  );
}
