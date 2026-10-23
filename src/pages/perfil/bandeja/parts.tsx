// Avisos' pieces, shared by the bell, «Tú» and /avisos (TU boards: pend.html, nrow.html, stack.html): a «Te toca»
// item answered in place, a notice row with its «⋯», a match's stack with its timeline, and the actions they
// all take (open, mark read, silence a topic or a match, pause, go to the bandeja or A medida).
import { useCallback, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import { flushSync } from "react-dom";
import { Menu, TuIcon, tuGo, useMenu, type MenuItem } from "../../../components/vidrio/tu/ui";
import { usePageKitStills } from "../../../components/jersey3d/usePageKitStills";
import { useTheme } from "../../../hooks/useTheme";
import { relativeTime } from "../../../lib/derived/notices";
import type { Notice } from "../../../lib/derived/notices";
import { capital } from "../../../lib/derived/words";
import { matchEndAt, pushSaveError, savedVibrate, setMatchTopics, setPushPause, setPushPreset, toggleTopic, tomorrowAtNine, type PauseKind, type Topic } from "../../../lib/push";
import { actsOf, ANSWER_SAID, ANSWER_WORD, iconOf, KIND_LABEL, kindOf, matchOf, MUTABLE, pauseSaid, pl, RES_WORD, TOPIC_NAME, verOf, type ActKey, type Answer, type AvFilter } from "./model";
import type { Inbox, Pend, StackView } from "./useInbox";

// ---------- what a notice or an item does

export interface AvisoActions {
  open: (n: Notice) => void;
  act: (k: ActKey, n: Notice) => void;
  markRead: (ids: readonly string[], read: boolean) => void;
  muteTopic: (topic: string, on: boolean) => void;
  muteMatch: (matchId: string, mute: boolean) => void;
  pause: (k: PauseKind) => void;
  resume: () => void;
  /** To the bandeja (a filter) or A medida, closing whatever surface is open. */
  goAv: (to: "bandeja" | "amedida", f?: AvFilter, anchor?: string) => void;
  go: (path: string) => void;
  answered: (p: Pend) => void;
}

/** The actions, with `say` for the toast and `leave` to close the surface they were taken from (the bell, «Tú»). */
/** What the actions need of the inbox (a fan's bell has none: no reads, no next match). */
export type ActionInbox = { reads: Pick<Inbox["reads"], "mark">; next: Inbox["next"]; matchName: Inbox["matchName"] };

export function useAvisoActions(inbox: ActionInbox, say: (t: string) => void, leave?: () => void): AvisoActions {
  const navigate = useNavigate();
  const fail = useCallback((e: unknown) => say(pushSaveError(e)), [say]);
  const go = useCallback(
    (path: string) => {
      leave?.();
      tuGo("right", async () => {
        await navigate({ href: path });
      });
    },
    [leave, navigate],
  );
  const goAv = useCallback(
    (to: "bandeja" | "amedida", f?: AvFilter, anchor?: string) => {
      leave?.();
      const ver = f ? verOf(f) : undefined;
      tuGo("right", async () => {
        await navigate({ to: to === "amedida" ? "/avisos/a-medida" : "/avisos", search: ver ? { ver } : {} } as never);
        if (anchor) window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ block: "start" }), 120);
      });
    },
    [leave, navigate],
  );
  const markRead = useCallback((ids: readonly string[], read: boolean) => void inbox.reads.mark(ids, read).catch(() => say("No se ha podido guardar. Inténtalo otra vez.")), [inbox.reads, say]);
  const open = useCallback(
    (n: Notice) => {
      markRead([n.id], true);
      if (n.url.startsWith("/") && !n.url.startsWith("//")) go(n.url);
    },
    [markRead, go],
  );
  const pause = useCallback(
    (k: PauseKind) => {
      const now = Date.now();
      const next = inbox.next;
      const until = k === "1h" ? now + 3600_000 : k === "manana" ? tomorrowAtNine(now) : next ? matchEndAt(next.at, next.dur) : NaN;
      if (!Number.isFinite(until) || until <= now) {
        say("No hay un partido próximo para pausar hasta después.");
        return;
      }
      setPushPause({ until, kind: k }).then(() => say(pauseSaid(k)), fail);
    },
    [inbox.next, say, fail],
  );
  return {
    open,
    go,
    goAv,
    markRead,
    pause,
    resume: () => void setPushPause(null).then(() => say("Avisos reanudados."), fail),
    act: (k, n) => {
      markRead([n.id], true);
      if (k === "goles") {
        setPushPreset("goles", savedVibrate()).then(() => say("Este móvil, solo goles. Lo cambias en Avisos a medida."), fail);
        return;
      }
      if (k === "cal") return goAv("amedida", undefined, "tu-cal");
      if (k === "carta") return go("/perfil");
      if (k === "caja") return go("/vestuario/caja");
      go(n.url);
    },
    muteTopic: (topic, on) => {
      const name = TOPIC_NAME[topic] ?? topic;
      toggleTopic(topic as Topic, on).then(() => say(on ? `Te volvemos a avisar de «${name}».` : `«${name}» silenciado en este móvil. Siguen llegando a la campana.`), fail);
    },
    muteMatch: (matchId, mute) => {
      const j = inbox.matchName(matchId);
      setMatchTopics(matchId, mute ? [] : null).then(() => say(mute ? `El ${j} no sonará en este móvil. Lo verás aquí.` : `Te volvemos a avisar del ${j}.`), fail);
    },
    answered: (p) => markRead(p.noticeIds, true),
  };
}

// ---------- a «Te toca» item (pend.html)

export function PendItem({ p, a, stillOf, say }: { p: Pend; a: AvisoActions; stillOf: (num: string) => string | undefined; say: (t: string) => void }) {
  const cls = ["tu-pd", p.done ? "is-done" : "", p.gold ? "is-gold" : ""].filter(Boolean).join(" ");
  const run = (t: Promise<void>, said: string) => {
    a.answered(p);
    t.then(() => say(said), () => undefined);
  };
  return (
    <li className={cls}>
      <div className="tu-pd__h">
        <span className="tu-pd__i" aria-hidden="true">
          <TuIcon name={p.icon} />
        </span>
        <span className="tu-pd__t">
          <b>{p.title}</b>
          <small>{p.body}</small>
        </span>
        {p.done && <span className="tu-pill is-ok">Hecho</span>}
      </div>
      {p.kind === "rsvp" && (
        <div className="vd-glass vd-seg tu-oseg tu-pd__seg" role="group" aria-label={p.title} style={{ "--n": 3, "--i": Math.max(0, (["yes", "maybe", "no"] as Answer[]).indexOf(p.value as Answer)) } as CSSProperties}>
          {p.value && <span className="vd-shelf__bead" aria-hidden="true" />}
          {(["yes", "maybe", "no"] as Answer[]).map((v) => (
            <button key={v} type="button" className="vd-seg__b" data-nav="1" aria-pressed={p.value === v} aria-disabled={p.busy || undefined} onClick={() => !p.busy && run(p.pick(v), `${ANSWER_SAID[v]} El capitán ya lo ve.`)}>
              {ANSWER_WORD[v]}
            </button>
          ))}
        </div>
      )}
      {p.kind === "mvp" && (
        <div className="tu-mvp" data-scroll-x="1" role="group" aria-label={`Candidatos al MVP${p.matchJ ? ` del J${p.matchJ}` : ""}: los que jugaron`}>
          {p.cands.map((c) => {
            const src = stillOf(c.num);
            return (
              <button key={c.id} type="button" className={`tu-mvp__b${c.on ? " is-on" : ""}`} data-nav="1" aria-pressed={c.on} aria-label={`Votar a ${c.name}, ${c.min} minutos`} onClick={() => run(p.pick(c.id), `Voto al MVP guardado: ${c.name.toLocaleUpperCase("es")}.`)}>
                {src ? <img src={src} alt="" /> : <span className="tu-mvp__ph" aria-hidden="true" />}
                <b>{c.name.toLocaleUpperCase("es")}</b>
                <small>{c.min}′</small>
              </button>
            );
          })}
        </div>
      )}
      {p.kind === "poll" && (
        <div className="tu-bars" role="group" aria-label={p.body}>
          {p.opts.map((o) => (
            <button key={o.id} type="button" className="tu-pbar" data-nav="1" aria-pressed={o.on} aria-label={`${o.label}: ${pl(o.n, "voto", "votos")}`} onClick={() => run(p.pick(o.id), "Voto guardado.")}>
              <i style={{ width: `${o.pct}%` }} aria-hidden="true" />
              <span>{o.label}</span>
              <span>{o.n}</span>
            </button>
          ))}
        </div>
      )}
      {p.kind === "turno" && (
        <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm tu-pd__btn" data-nav="1" aria-pressed={p.done} aria-disabled={p.busy || undefined} onClick={() => !p.busy && run(p.mark(), p.done ? "Turno sin marcar." : "Turno hecho. Gracias.")}>
          <TuIcon name="check" />
          {p.done ? "Hecho" : "Marcar como hecho"}
        </button>
      )}
      {p.kind === "door" && (
        <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm tu-pd__btn" data-nav="1" onClick={() => a.go(p.path)}>
          <TuIcon name="door" />
          Abrir La puerta
        </button>
      )}
      {p.error ? (
        <p className="tu-pd__after" role="alert">
          {p.error}
        </p>
      ) : (
        p.after && (
          <p className="tu-pd__after" role="status">
            {p.after}
          </p>
        )
      )}
    </li>
  );
}

/** The printed stills of the MVP's candidates (the home kit, this theme). */
export function useCandStills(pends: readonly Pend[]): (num: string) => string | undefined {
  const { theme } = useTheme();
  const players = pends.flatMap((p) => (p.kind === "mvp" ? p.cands.map((c) => ({ name: c.name, num: c.num })) : [])).filter((x) => x.num);
  const still = usePageKitStills({ on: typeof window !== "undefined" && players.length > 0, theme, kits: ["home"], players });
  return (num) => still("home", num)?.src;
}

export function PendList({ pends, a, say, sm }: { pends: readonly Pend[]; a: AvisoActions; say: (t: string) => void; sm?: boolean }) {
  const stillOf = useCandStills(pends);
  return (
    <ul className={`tu-pds${sm ? " tu-pds--sm" : ""}`}>
      {pends.map((p) => (
        <PendItem key={p.key} p={p} a={a} stillOf={stillOf} say={say} />
      ))}
    </ul>
  );
}

// ---------- a notice row (nrow.html)

export function NoticeRow({ n, inbox, a }: { n: Notice; inbox: Inbox; a: AvisoActions }) {
  const menu = useMenu();
  const un = inbox.reads.unread(n);
  const acts = actsOf(n);
  const matchId = matchOf(n);
  const items: MenuItem[] = [{ t: un ? "Marcar como leído" : "Marcar como no leído", icon: "check", go: () => a.markRead([n.id], un) }];
  if (MUTABLE.has(n.topic) && inbox.member) {
    const on = inbox.topics.includes(n.topic as Topic);
    const tl = TOPIC_NAME[n.topic];
    items.push({ t: on ? `Silenciar «${tl}» en este móvil` : `Volver a avisarme de «${tl}»`, icon: "bell", go: () => a.muteTopic(n.topic, !on) });
  }
  if (matchId) {
    const muted = inbox.muted.includes(matchId);
    const j = inbox.matchName(matchId);
    items.push({ t: muted ? `Volver a avisarme del ${j}` : `Silenciar el ${j} en este móvil`, icon: "fixtures", go: () => a.muteMatch(matchId, !muted) });
  }
  items.push({ t: "Pausar todo una hora", icon: "clock", go: () => a.pause("1h") }, { t: "Avisos a medida", icon: "gear", go: () => a.goAv("amedida") });
  const label = `Más opciones: ${n.title}`;
  const gold = (n.topic === "goals" && !/^Gol de /.test(n.title)) || (n.topic === "mvp" && /^MVP/.test(n.title));
  const rival = n.topic === "goals" && /^Gol de /.test(n.title);
  const cls = ["tu-nt", un ? "is-new" : "", gold ? "is-gold" : "", rival ? "is-rival" : "", menu.open ? "has-menu" : ""].filter(Boolean).join(" ");
  return (
    <li className={cls}>
      <span className="tu-nt__i" aria-hidden="true">
        <TuIcon name={iconOf(n)} />
      </span>
      <div className="tu-nt__t">
        <button type="button" className="tu-nt__open" data-nav="1" onClick={() => a.open(n)} aria-label={`${n.title}${un ? ", sin leer" : ""}. Abrir`}>
          <b className="tu-nt__h">{n.title}</b>
          <span className="tu-nt__b">{n.body}</span>
        </button>
        <p className="tu-nt__m">
          {un && <span className="tu-nt__new">Nuevo</span>}
          <span>{capital(relativeTime(n.at, inbox.now))}</span>
          <span aria-hidden="true">·</span>
          <span>{KIND_LABEL[kindOf(n)]}</span>
        </p>
        {acts.length > 0 && (
          <div className="tu-nt__acts" role="group" aria-label="Desde aquí">
            {acts.map((x) => (
              <button key={x.k} type="button" className={`vd-glass vd-press tu-chip${x.k === "goles" && inbox.topics.length === 1 && inbox.topics[0] === "goals" ? " is-on" : ""}`} aria-label={x.t} onClick={() => a.act(x.k, n)}>
                {x.t}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="tu-nt__more">
        <button ref={menu.btn} type="button" className="tu-more" data-menu-btn="1" aria-haspopup="menu" aria-expanded={menu.open} aria-label={label} onClick={() => menu.setOpen((o) => !o)}>
          <TuIcon name="more" />
        </button>
        <Menu items={items} label={label} menu={menu} />
      </div>
    </li>
  );
}

// ---------- a match's stack (stack.html)

export function MatchStack({ x, inbox, a, exp, onToggle }: { x: StackView; inbox: Inbox; a: AvisoActions; exp: boolean; onToggle: () => void }) {
  const menu = useMenu();
  const muted = inbox.muted.includes(x.matchId);
  const un = x.rows.filter((n) => inbox.reads.unread(n)).length;
  const j = x.j ? `J${x.j}` : "";
  const items: MenuItem[] = [
    { t: muted ? `Volver a avisarme del ${j || "partido"}` : `Silenciar el ${j || "partido"} en este móvil`, icon: "bell", go: () => a.muteMatch(x.matchId, !muted) },
    ...(x.rows.length ? [{ t: x.rows.length === 1 ? "Marcar el aviso como leído" : `Marcar los ${x.rows.length} como leídos`, icon: "check" as const, go: () => a.markRead(x.rows.map((n) => n.id), true) }] : []),
    { t: "Avisos a medida", icon: "gear", go: () => a.goAv("amedida") },
  ];
  const label = `Más opciones del ${j || "partido"}`;
  const cls = ["tu-ms", exp ? "is-open" : "", muted ? "is-muted" : "", un ? "is-new" : "", menu.open ? "has-menu" : ""].filter(Boolean).join(" ");
  const count = pl(x.rows.length, "aviso", "avisos");
  const toggle = () => {
    if (!exp && un) a.markRead(x.rows.map((n) => n.id), true);
    onToggle();
  };
  return (
    <section className={cls} aria-label={`${j} · ${x.title}`}>
      <div className="tu-ms__head">
        <span className="tu-ms__rv" aria-hidden="true">
          {x.ini}
        </span>
        <div className="tu-ms__t">
          <p className="tu-ms__k">
            <b>{j}</b>
            <span>{x.when}</span>
            {muted && <span className="tu-pill">Silenciado aquí</span>}
          </p>
          <h3 className="tu-ms__h">{x.title}</h3>
          <p className="tu-ms__s">
            {x.res && (
              <>
                <span className={`tu-res is-${x.res}`} aria-hidden="true">
                  {x.res}
                </span>
                <b>{RES_WORD[x.res]}</b>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span>{x.sum || (x.res ? "" : "Por jugar")}</span>
          </p>
        </div>
        <div className="tu-nt__more">
          <button ref={menu.btn} type="button" className="tu-more" data-menu-btn="1" aria-haspopup="menu" aria-expanded={menu.open} aria-label={label} onClick={() => menu.setOpen((o) => !o)}>
            <TuIcon name="more" />
          </button>
          <Menu items={items} label={label} menu={menu} />
        </div>
      </div>
      {x.marks.length > 0 && (
        <div className="tu-tl" role="img" aria-label={x.alt}>
          <span className="tu-tl__half" aria-hidden="true" />
          {x.marks.map((m, i) => (
            <i key={i} className={`k-${m.k}`} style={{ left: `${m.left.toFixed(1)}%` }} />
          ))}
          <small className="tu-tl__a">0′</small>
          <small className="tu-tl__b">{x.dur}′</small>
        </div>
      )}
      <div className="tu-ms__foot">
        {x.rows.length > 0 ? (
          <button type="button" className="tu-ms__tog" data-nav="1" aria-expanded={exp} onClick={toggle}>
            {un > 0 && <span className="tu-nt__new">{un === 1 ? "1 nuevo" : `${un} nuevos`}</span>}
            <span>{exp ? `Recoger los ${count}` : `Ver los ${count}`}</span>
            <TuIcon name="chev-r" />
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="vd-link tu-ms__open" onClick={() => a.go(`/partidos/${encodeURIComponent(x.matchId)}`)}>
          {x.res ? "Abrir el partido" : "Ver la previa"}
        </button>
      </div>
      {exp && x.rows.length > 0 && (
        <ol className="tu-nts tu-ms__list">
          {x.rows.map((n) => (
            <NoticeRow key={n.id} n={n} inbox={inbox} a={a} />
          ))}
        </ol>
      )}
    </section>
  );
}

/** Opens or closes a sheet inside its View Transition (React commits before the snapshot). */
export const commit = (fn: () => void) => () => flushSync(fn);
