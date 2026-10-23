// The bell (TU boards, shell.html `tu-bell`): a round glass button in the top bar (`tu-cbtn--bell`) with the unread
// count on its dot; it opens a glass sheet that grows out of it (under it on a desktop, over the tab bar on a
// phone): «Avisos» and how many are unread with its «⋯» (mark everything read, pause, A medida), «Te toca» —
// what waits on you, answered right there — and «Todo» — the newest two matches as stacks and the three newest
// loose notices —, then «Abrir el centro de avisos» and this device's line («Este móvil: Todo · A medida»). A fan
// gets the sheet too, with the shortcuts of this device only (the notices are the vestuario's). A dialog: the
// focus moves in (↑ ↓ between what it holds, ← → between the tabs), Esc and a tap outside close it, the focus
// goes back to the bell. The data: bandeja/useInbox; the pieces: bandeja/parts.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { bellLabel } from "../../lib/derived/notices";
import { DotsMenu, rove, TuIcon, TuLayer, tuSurface, useToast } from "../vidrio/tu/ui";
import { useInbox, type Inbox } from "../../pages/perfil/bandeja/useInbox";
import { MatchStack, NoticeRow, PendList, useAvisoActions, type ActionInbox, type AvisoActions } from "../../pages/perfil/bandeja/parts";
import { PresetSeg, useThisDevice, type ThisDevice } from "../../pages/perfil/bandeja/device";
import { askFlyBell } from "../../pages/perfil/bandeja/flyBell";
import { nextLine, pauseLine, unreadText } from "../../pages/perfil/bandeja/model";
import "../../styles/tu-avisos.css";

/** A member's bell: his notices and «Te toca». */
export function NoticesBell() {
  const inbox = useInbox();
  return <Bell inbox={inbox.member ? inbox : null} />;
}

/** A fan's bell: only this device's shortcuts (no listener, no account). */
export function FanBell() {
  return <Bell inbox={null} />;
}

function Bell({ inbox }: { inbox: Inbox | null }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement | null>(null);
  const toast = useToast();
  const unread = inbox?.unread ?? 0;
  const openIt = () => tuSurface(true, btn.current, "tu-bell", () => flushSync(() => setOpen(true)));
  const close = (refocus = true) => {
    tuSurface(false, btn.current, "tu-bell", () => flushSync(() => setOpen(false)));
    if (refocus) window.setTimeout(() => btn.current?.focus({ preventScroll: true }), 60);
  };
  return (
    <>
      <button ref={btn} type="button" className="vd-glass vd-press tu-cbtn tu-cbtn--bell" aria-label={bellLabel(unread)} aria-haspopup="dialog" aria-expanded={open} onClick={() => (open ? close() : openIt())}>
        <TuIcon name="bell" />
        {unread > 0 && (
          <span className="tu-cbtn__dot" aria-hidden="true">
            {unread}
          </span>
        )}
      </button>
      <TuLayer cls={open ? "o-campana" : undefined}>
        {open && (
          <>
            <div className="tu-scrim" aria-hidden="true" onClick={() => close()} />
            {inbox ? <MemberSheet inbox={inbox} say={toast.say} close={close} /> : <FanSheet say={toast.say} close={close} />}
          </>
        )}
        {toast.node}
      </TuLayer>
    </>
  );
}

/** Focus into the sheet on opening; Esc closes it; ↑ ↓ move between what it holds. */
function useSheetKeys(close: (refocus?: boolean) => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => ref.current?.querySelector<HTMLElement>("[data-nav]")?.focus({ preventScroll: true }), 40);
    return () => window.clearTimeout(t);
  }, []);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    rove(e, "[data-nav]");
  };
  return { ref, onKey };
}

function Foot({ d, a, member, onAll }: { d: ThisDevice; a: Pick<AvisoActions, "goAv">; member: boolean; onAll: () => void }) {
  return (
    <footer className="tu-bell__foot">
      {member && (
        <button type="button" className="tu-mi" data-nav="1" onClick={onAll}>
          <TuIcon name="bell" />
          <span className="tu-mi__t">Abrir el centro de avisos</span>
          <TuIcon name="chev-r" className="tu-mi__c" />
        </button>
      )}
      <button type="button" className="tu-mi tu-mi--quiet" data-nav="1" onClick={() => a.goAv("amedida")}>
        <TuIcon name="gear" />
        <span className="tu-mi__t">Este móvil: {d.line}</span>
        <small className="tu-mi__h">A medida</small>
      </button>
    </footer>
  );
}

function MemberSheet({ inbox, say, close }: { inbox: Inbox; say: (t: string) => void; close: (refocus?: boolean) => void }) {
  const leave = () => close(false);
  const a = useAvisoActions(inbox, say, leave);
  const d = useThisDevice();
  const { ref, onKey } = useSheetKeys(close);
  const [tab, setTab] = useState<"toca" | "todo">("toca");
  const tabs = [
    { k: "toca" as const, t: "Te toca", n: inbox.openPend },
    { k: "todo" as const, t: "Todo", n: inbox.unread },
  ];
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && t.getAttribute("role") === "tab") {
      e.preventDefault();
      const nt = tab === "toca" ? "todo" : "toca";
      setTab(nt);
      window.setTimeout(() => document.getElementById(`tu-bt-${nt}`)?.focus(), 0);
      return;
    }
    onKey(e);
  };
  const markAll = () =>
    inbox.reads.markAll().then(
      () => say("Todo leído. Te avisamos de lo nuevo."),
      () => say("No se ha podido guardar. Inténtalo otra vez."),
    );
  const empty = !inbox.loading && !inbox.failed && !inbox.list.length && !inbox.pends.length;
  const list = !inbox.loading && !inbox.failed && !empty;
  const next = nextLine(inbox.next);
  const [exp, setExp] = useState<Record<string, boolean>>({});
  const all = () => {
    askFlyBell();
    a.goAv("bandeja", tab === "toca" ? "toca" : "todos");
  };
  return (
    <div ref={ref} className="vd-glass vd-glass--deep tu-sheet tu-bell" role="dialog" aria-modal="true" aria-labelledby="tu-bell-t" onKeyDown={keys}>
      <span className="tu-grab" aria-hidden="true" />
      <header className="tu-bell__head">
        <h2 id="tu-bell-t">Avisos</h2>
        <span className="tu-bell__n">{unreadText(inbox.unread)}</span>
        <div className="tu-bell__mm">
          <DotsMenu
            right
            label="Más opciones de los avisos"
            items={[
              { t: "Marcar todo como leído", icon: "check", go: () => void markAll() },
              { t: "Pausar una hora", icon: "clock", go: () => a.pause("1h") },
              { t: "Pausar hasta mañana", icon: "moon", go: () => a.pause("manana") },
              { t: "Avisos a medida", icon: "gear", go: () => a.goAv("amedida") },
            ]}
          />
        </div>
        <button type="button" className="tu-x2" aria-label="Cerrar los avisos" onClick={() => close()}>
          <TuIcon name="close" />
        </button>
      </header>
      <div className="vd-glass vd-seg tu-oseg tu-bell__tabs" role="tablist" aria-label="Qué avisos" style={{ "--n": 2, "--i": tab === "todo" ? 1 : 0 } as CSSProperties}>
        <span className="vd-shelf__bead" aria-hidden="true" />
        {tabs.map((t) => (
          <button key={t.k} type="button" role="tab" id={`tu-bt-${t.k}`} className="vd-seg__b" data-nav="1" aria-selected={tab === t.k} tabIndex={tab === t.k ? 0 : -1} onClick={() => setTab(t.k)}>
            {t.t}
            {t.n > 0 && <span className="tu-badge">{t.n}</span>}
          </button>
        ))}
      </div>
      <div className="tu-bell__body" role="tabpanel" aria-labelledby={`tu-bt-${tab}`}>
        {d.pause && (
          <p className="tu-state is-warn">
            <b>{pauseLine(d.pause.kind)}</b>
            <button type="button" className="vd-link" onClick={a.resume}>
              Reanudar
            </button>
          </p>
        )}
        {!d.ready && (
          <p className={`tu-state is-${d.words.tone}`}>
            <b>{d.blocked}</b>
            <button type="button" className="vd-link" onClick={() => a.goAv("amedida")}>
              Cómo arreglarlo
            </button>
          </p>
        )}
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
            <b>No se han podido cargar.</b>
            <span>Comprueba la conexión y vuelve a abrirlos.</span>
          </div>
        )}
        {empty && (
          <div className="tu-empty" role="status">
            <b>Estás al día.</b>
            <span>{next}</span>
          </div>
        )}
        {list && tab === "toca" && (inbox.pends.length ? <PendList pends={inbox.pends} a={a} say={say} sm /> : (
          <div className="tu-empty">
            <b>Nada te toca ahora.</b>
            <span>{next}</span>
          </div>
        ))}
        {list && tab === "todo" && (
          <>
            {inbox.stacks.slice(0, 2).map((x) => (
              <MatchStack key={x.matchId} x={x} inbox={inbox} a={a} exp={!!exp[x.matchId]} onToggle={() => setExp((e) => ({ ...e, [x.matchId]: !e[x.matchId] }))} />
            ))}
            {inbox.loose.length > 0 && (
              <ol className="tu-nts">
                {inbox.loose.slice(0, 3).map((n) => (
                  <NoticeRow key={n.id} n={n} inbox={inbox} a={a} />
                ))}
              </ol>
            )}
          </>
        )}
      </div>
      <Foot d={d} a={a} member onAll={all} />
    </div>
  );
}

function FanSheet({ say, close }: { say: (t: string) => void; close: (refocus?: boolean) => void }) {
  const d = useThisDevice();
  const { ref, onKey } = useSheetKeys(close);
  const a = useFanActions(close);
  return (
    <div ref={ref} className="vd-glass vd-glass--deep tu-sheet tu-bell" role="dialog" aria-modal="true" aria-labelledby="tu-bell-t" onKeyDown={onKey}>
      <span className="tu-grab" aria-hidden="true" />
      <header className="tu-bell__head">
        <h2 id="tu-bell-t">Avisos</h2>
        <button type="button" className="tu-x2" aria-label="Cerrar los avisos" onClick={() => close()}>
          <TuIcon name="close" />
        </button>
      </header>
      <div className="tu-bell__body" role="tabpanel" aria-label="Avisos">
        {d.pause && (
          <p className="tu-state is-warn">
            <b>{pauseLine(d.pause.kind)}</b>
            <button type="button" className="vd-link" onClick={a.resume}>
              Reanudar
            </button>
          </p>
        )}
        {!d.ready && (
          <p className={`tu-state is-${d.words.tone}`}>
            <b>{d.blocked}</b>
            <button type="button" className="vd-link" onClick={() => a.goAv("amedida")}>
              Cómo arreglarlo
            </button>
          </p>
        )}
        <p className="tu-blk__d">Los avisos del vestuario son de los socios. Desde aquí eliges qué te avisamos del partido en este móvil.</p>
        <PresetSeg d={d} say={say} label="Qué te avisamos" />
      </div>
      <Foot d={d} a={a} member={false} onAll={() => undefined} />
    </div>
  );
}

/** A fan's bell has no inbox: only the way to A medida and the pause's resume. */
function useFanActions(close: (refocus?: boolean) => void): Pick<AvisoActions, "goAv" | "resume"> {
  const a = useAvisoActions(FAN_INBOX, () => undefined, () => close(false));
  return { goAv: a.goAv, resume: a.resume };
}
const FAN_INBOX: ActionInbox = { next: null, matchName: () => "", reads: { mark: async () => undefined } };
