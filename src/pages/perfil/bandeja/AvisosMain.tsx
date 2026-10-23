// /avisos and /avisos/a-medida (TU boards, shell.html «Avisos»): the bandeja — what waits on you first, answered in
// place («Te toca»), then each match as one stack with its timeline, then the rest by day, with the rail of filters
// (?ver=) and this device at the side — and «A medida»: this device, the shortcuts, every topic, the pause, a test
// notice and the calendar. A fan (no session) gets «A medida» only: the notices are the vestuario's. TuPage draws
// the sky, the bars and the footer around this <main>; moving between the two and between filters goes through
// the router inside a View Transition.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Switch, TuIcon, tuGo, type TuDir } from "../../../components/vidrio/tu/ui";
import { useAuth } from "../../../context/AuthContext";
import { nameFor, useClubData } from "../../../lib/clubData";
import { googleSubscribeUrl, webcalUrl } from "../../../lib/calendarLinks";
import { groupNotices, type Notice } from "../../../lib/derived/notices";
import { siteOrigin } from "../../../lib/derived/venue";
import { pushSaveError, toggleTopic } from "../../../lib/push";
import { upcomingRows } from "../avisos";
import { showTestNotice } from "../device";
import { copyText } from "../fxRuntime";
import { useInbox, type Inbox } from "./useInbox";
import { MatchStack, NoticeRow, PendList, useAvisoActions, type AvisoActions } from "./parts";
import { PauseChips, PresetSeg, useThisDevice, type ThisDevice } from "./device";
import { filterOf, filterRows, kindOf, nextLine, pauseLine, pendTitle, pl, PRESET_NOTE, RES_WORD, shownBy, testNotice, topicsFor, unreadText, verOf, type AvFilter } from "./model";
import { takeFlyBell } from "./flyBell";
import "../../../styles/tu-avisos.css";

export function AvisosMain({ say }: { say: (t: string) => void }) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const search = useLocation({ select: (l) => l.search }) as { ver?: unknown };
  const navigate = useNavigate();
  const inbox = useInbox();
  const d = useThisDevice();
  const a = useAvisoActions(inbox, say);
  const member = inbox.member;
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
  const goSec = (to: "bandeja" | "amedida") => {
    if (to === sec) return;
    move(to === "bandeja" ? "left" : "right", to, to === "bandeja" ? f : null);
  };

  const tabs = [
    { k: "bandeja" as const, t: "Bandeja", hint: member ? unreadText(inbox.unread) : "De los socios" },
    { k: "amedida" as const, t: "A medida", hint: d.line },
  ];
  const lede = !member ? "Los avisos del vestuario son de los socios. Aquí eliges qué te avisamos del partido en este móvil." : inbox.openPend ? "Primero lo que te toca, respondido aquí mismo; luego cada partido en un solo bloque y el vestuario por días." : "Cada partido en un solo bloque, el vestuario por días. Nada pendiente.";

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
            const on = sec === t.k;
            return (
              <button key={t.k} type="button" className={`tu-avtab${on ? " is-on" : ""}`} aria-current={on ? "page" : "false"} onClick={() => goSec(t.k)}>
                {on && <span className="tu-nav__bead" aria-hidden="true" />}
                <b>{t.t}</b>
                <small>{t.hint}</small>
              </button>
            );
          })}
        </nav>
      </header>
      {sec === "bandeja" ? <Bandeja inbox={inbox} d={d} a={a} f={f} say={say} fly={flyOn} onFilter={(nf) => move("up", "bandeja", nf, true)} /> : <AMedida inbox={inbox} d={d} a={a} say={say} />}
    </main>
  );
}

// ---------- the bandeja

function Bandeja({ inbox, d, a, f, say, fly, onFilter }: { inbox: Inbox; d: ThisDevice; a: AvisoActions; f: AvFilter; say: (t: string) => void; fly: boolean; onFilter: (f: AvFilter) => void }) {
  const [exp, setExp] = useState<Record<string, boolean>>({});
  const show = shownBy(f);
  const one = f.startsWith("m:") ? f.slice(2) : null;
  const rows = filterRows(inbox.list, inbox.openPend, inbox.unread);
  const stacks = show.stacks === "all" ? inbox.stacks : show.stacks === "one" ? inbox.stacks.filter((x) => x.matchId === one) : [];
  const loose = show.loose === "all" ? inbox.loose : show.loose === "vestuario" ? inbox.loose.filter((n) => kindOf(n) === "vestuario") : show.loose === "tuyos" ? inbox.feed.filter((n) => kindOf(n) === "tuyo") : [];
  const unreadRows = show.unread ? inbox.feed.filter((n) => inbox.reads.unread(n)) : [];
  const empty = !inbox.loading && !inbox.failed && !inbox.list.length && !inbox.pends.length;
  const list = !inbox.loading && !inbox.failed && !empty;
  const next = nextLine(inbox.next);
  const markAll = () =>
    inbox.reads.markAll().then(
      () => say("Todo leído. Te avisamos de lo nuevo."),
      () => say("No se ha podido guardar. Inténtalo otra vez."),
    );
  return (
    <div className="tu-av__body vd-reg-2">
      <nav className="tu-rail" data-scroll-x="1" aria-label="Qué avisos">
        <ul className="tu-rail__l">
          {rows.map((x) => {
            const on = f === x.f;
            return (
              <li key={x.f}>
                <button type="button" className={`tu-rail__b${on ? " is-on" : ""}`} aria-pressed={on} aria-label={`${x.t}, ${x.n}`} onClick={() => !on && onFilter(x.f)}>
                  <span>{x.t}</span>
                  <b>{x.n}</b>
                </button>
              </li>
            );
          })}
        </ul>
        {inbox.stacks.length > 0 && (
          <>
            <p className="tu-rail__g">Por partido</p>
            <ul className="tu-rail__l tu-rail__m">
              {inbox.stacks.map((x) => {
                const on = f === `m:${x.matchId}`;
                const muted = inbox.muted.includes(x.matchId);
                return (
                  <li key={x.matchId}>
                    <button type="button" className={`tu-rail__b${on ? " is-on" : ""}${muted ? " is-muted" : ""}`} aria-pressed={on} onClick={() => !on && onFilter(`m:${x.matchId}`)}>
                      <span>
                        <b>{`${x.j ? `J${x.j} · ` : ""}${x.rival}`}</b>
                        <small>{x.res ? `${RES_WORD[x.res]} ${x.gf}–${x.ga}` : "Por jugar"}</small>
                      </span>
                      <b>{x.rows.length}</b>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>
      <div className="tu-av__list" style={fly ? { viewTransitionName: "tu-bell" } : undefined}>
        {d.pause && (
          <p className="tu-state is-warn">
            <b>{pauseLine(d.pause.kind)}</b>
            <span>
              Siguen llegando aquí.{" "}
              <button type="button" className="vd-link" onClick={a.resume}>
                Reanudar ahora
              </button>
            </span>
          </p>
        )}
        {!d.ready && (
          <p className={`tu-state is-${d.words.tone}`}>
            <b>{d.words.title}</b>
            <span>
              Los avisos siguen llegando aquí.{" "}
              <button type="button" className="vd-link" onClick={() => a.goAv("amedida")}>
                Cómo arreglarlo
              </button>
            </span>
          </p>
        )}
        <div className="tu-av__tools">
          <span className="tu-small">
            {pl(inbox.list.length, "aviso", "avisos")} · {unreadText(inbox.unread)}
          </span>
          {inbox.unread > 0 && (
            <button type="button" className="vd-link" onClick={markAll}>
              Marcar todo como leído
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
          <div className="tu-empty" role="alert">
            <TuIcon name="wifiOff" />
            <b>No se han podido cargar los avisos.</b>
            <span>Comprueba la conexión y vuelve a intentarlo. Lo que ya habías visto sigue en tu móvil.</span>
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={() => window.location.reload()}>
              Reintentar
            </button>
          </div>
        )}
        {empty && (
          <div className="tu-empty" role="status">
            <TuIcon name="bell" />
            <b>Aquí verás los avisos del equipo.</b>
            <span>{next} La convocatoria llegará aquí y la contestas sin salir.</span>
          </div>
        )}
        {list && (
          <>
            {show.pend && inbox.pends.length > 0 && (
              <section className="tu-toca" aria-labelledby="tu-toca-t">
                <h2 className="tu-day__h" id="tu-toca-t">
                  {pendTitle(inbox.openPend)}
                </h2>
                <PendList pends={inbox.pends} a={a} say={say} />
              </section>
            )}
            {f === "toca" && !inbox.pends.length && (
              <div className="tu-empty">
                <b>Nada te toca ahora.</b>
                <span>{next}</span>
              </div>
            )}
            {stacks.length > 0 && (
              <section className="tu-day" aria-label="Por partido">
                <h2 className="tu-day__h">Por partido</h2>
                {stacks.map((x) => (
                  <MatchStack key={x.matchId} x={x} inbox={inbox} a={a} exp={one === x.matchId || !!exp[x.matchId]} onToggle={() => setExp((e) => ({ ...e, [x.matchId]: !(one === x.matchId || e[x.matchId]) }))} />
                ))}
              </section>
            )}
            {show.unread &&
              (unreadRows.length ? (
                <section className="tu-day" aria-label="Sin leer">
                  <h2 className="tu-day__h">Sin leer</h2>
                  <Rows list={unreadRows} inbox={inbox} a={a} />
                </section>
              ) : (
                <div className="tu-empty">
                  <b>Estás al día.</b>
                  <span>{next}</span>
                </div>
              ))}
            {loose.length > 0 &&
              groupNotices(loose, inbox.now).map((g) => (
                <section key={g.key} className="tu-day" aria-label={g.label}>
                  <h2 className="tu-day__h">{g.label}</h2>
                  <Rows list={g.items} inbox={inbox} a={a} />
                </section>
              ))}
          </>
        )}
      </div>
      <aside className="tu-av__side" aria-label="Este móvil">
        <div className={`tu-devcard is-${d.words.tone}`}>
          <span className={`tu-pill is-${d.words.tone}`}>{d.words.chip}</span>
          <b>{d.words.title}</b>
          <small>{d.words.dev}</small>
        </div>
        <p className="tu-label" id="tu-side-p">
          Te llega a este móvil
        </p>
        <PresetSeg d={d} four say={say} labelledBy="tu-side-p" onCustom={() => a.goAv("amedida")} />
        <p className="tu-small">{PRESET_NOTE[d.choice]}</p>
        <p className="tu-label">Pausar</p>
        <PauseChips d={d} a={a} />
        <Muted inbox={inbox} a={a} h={<p className="tu-label">Partidos silenciados</p>} />
        <button type="button" className="vd-link" onClick={() => a.goAv("amedida")}>
          Todo lo de este móvil, en A medida
        </button>
      </aside>
    </div>
  );
}

function Rows({ list, inbox, a }: { list: readonly Notice[]; inbox: Inbox; a: AvisoActions }) {
  return (
    <ol className="tu-nts">
      {list.map((n) => (
        <NoticeRow key={n.id} n={n} inbox={inbox} a={a} />
      ))}
    </ol>
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

function AMedida({ inbox, d, a, say }: { inbox: Inbox; d: ThisDevice; a: AvisoActions; say: (t: string) => void }) {
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
