// /profile › Avisos: «Este móvil» (the real device state: listo / iPhone sin instalar / bloqueados /
// no disponibles, each with its banner and its way out), «Qué te avisamos» (one switch per topic, the
// door only for captains; the first one asks the browser from the tap), «Probar en este móvil» (a real
// local notice + the in-page preview) and the calendar (subscribe, copy, the next three matches).
// As designed (pf-g.mjs pAvisos).
import { useState, type ReactNode } from "react";
import { googleSubscribeUrl, webcalUrl } from "../../lib/calendarLinks";
import type { Topic } from "../../lib/push";
import { boldParts, deviceView, testNotice, TOPIC_COPY, topicsLead, unblockSteps, type UpcomingRow } from "./avisos";
import { isStandalone, notificationPermission, showTestNotice, userAgent } from "./device";
import { buzz, copyText, errorMessage, isOffline } from "./fxRuntime";
import { CREST, GLogo, Ic, type PIcon } from "./icons";
import { topicIds } from "./panels";
import { usePushDevice } from "./usePushDevice";

const TP_ICON: Record<Topic, PIcon> = { start: "flag", goals: "ball", final: "trophy", mvp: "star", dates: "cal", lineup: "shirt", door: "door", access: "door" };
const TP_W: Partial<Record<Topic, number>> = { start: 18 };

const Bold = ({ s }: { s: string }) => (
  <span>
    {boldParts(s).map(([t, b], i) => (b ? <b key={i}>{t}</b> : <span key={i}>{t}</span>))}
  </span>
);

function avisoError(e: unknown): string {
  const code = e && typeof e === "object" && typeof (e as { code?: unknown }).code === "string" ? String((e as { code: string }).code) : "";
  if (isOffline()) return "Sin conexión: no se ha cambiado. Vuelve a intentarlo cuando tengas cobertura.";
  if (code.startsWith("functions/")) return errorMessage(e);
  if (notificationPermission() === "denied" || (e instanceof Error && /permiso/i.test(e.message))) return "Sin permiso no te podemos avisar: este navegador ha dicho que no.";
  return "No se ha podido cambiar en este móvil. Vuelve a intentarlo.";
}

export interface AvisosProps {
  isCaptain: boolean;
  /** The name the test goal notice carries (your shirt, or @apodo without one). */
  testName: string;
  next: { rival: string; j: number | null } | null;
  upcoming: UpcomingRow[];
  /** https://…/calendario.ics */
  feed: string;
  say: (msg: string, bad?: boolean) => void;
  rm: boolean;
}

export function TabAvisos({ isCaptain, testName, next, upcoming, feed, say, rm }: AvisosProps) {
  const dev = usePushDevice();
  const ua = userAgent();
  const ready = dev.state === "ready";
  const ids = topicIds(isCaptain);
  const [busy, setBusy] = useState<Topic | null>(null);
  const [want, setWant] = useState<{ t: Topic; on: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [testN, setTestN] = useState(0);
  const [testBusy, setTestBusy] = useState(false);
  const [testErr, setTestErr] = useState<string | null>(null);
  const [calCp, setCalCp] = useState(false);

  const isOn = (t: Topic) => ready && (want?.t === t ? want.on : dev.topics.includes(t));
  const nOn = ids.filter(isOn).length;
  const view = deviceView(dev.state, ua, { permission: dev.permission, activeTopics: dev.topics.length });

  const flip = async (t: Topic) => {
    if (!ready || busy) return;
    const on = !dev.topics.includes(t);
    if (isOffline()) {
      setErr("Sin conexión: no se ha cambiado. Vuelve a intentarlo cuando tengas cobertura.");
      return;
    }
    const first = on && dev.topics.length === 0;
    setBusy(t);
    setWant({ t, on });
    setErr(null);
    buzz(10);
    try {
      // From the tap: the first one asks the browser for permission.
      await dev.toggle(t, on);
      if (first) say("Avisos activados en este móvil");
    } catch (e) {
      setErr(avisoError(e));
    } finally {
      setWant(null);
      setBusy(null);
    }
  };

  const granted = dev.permission === "granted";
  const cantTest = !ready || !granted;
  const why = !ready ? "Se activa cuando este móvil esté listo." : !granted ? "Activa antes algún aviso: así este móvil te da permiso." : "";
  const nt = testNotice(Math.max(1, testN), { name: testName, rival: next?.rival ?? null, j: next?.j ?? null });
  const probar = async () => {
    if (cantTest || testBusy) return;
    const n = testN + 1;
    const notice = testNotice(n, { name: testName, rival: next?.rival ?? null, j: next?.j ?? null });
    setTestN(n);
    setTestBusy(true);
    setTestErr(null);
    buzz([30, 50, 30]);
    try {
      await showTestNotice(notice.title, notice.body);
    } catch {
      setTestErr("No se ha podido mostrar el aviso en este móvil. Recarga la página y vuelve a probar.");
    } finally {
      setTestBusy(false);
    }
  };

  const fixIphone = () => {
    dev.refresh();
    buzz(10);
    if (view.kind === "iphone") say("Aquí sigues en Safari: abre Manchester Piti desde el icono de tu pantalla de inicio");
  };
  const fixDenied = () => {
    dev.refresh();
    buzz(10);
    if (notificationPermission() === "denied") say("Siguen bloqueados: sigue los tres pasos y recarga la página", true);
    else say("Avisos permitidos: elige abajo cuáles quieres");
  };
  const goCal = () => {
    const el = document.getElementById("pe-cal");
    el?.scrollIntoView?.({ behavior: rm ? "auto" : "smooth", block: "start" });
  };
  const copyCal = async () => {
    const ok = await copyText(webcalUrl(feed));
    if (ok) {
      setCalCp(true);
      say("Enlace del calendario copiado");
    } else say("No se ha podido copiar: mantén pulsado el enlace de abajo para copiarlo", true);
  };

  const icon: ReactNode = view.kind === "listo" ? <Ic n="check" w={20} /> : view.kind === "iphone" ? <Ic n="phone" w={20} /> : view.kind === "denegado" ? <Ic n="ban" w={20} /> : <Ic n="alert" w={20} />;
  const iDev = view.title.includes("iPad") ? "iPad" : "iPhone";
  return (
    <>
      <div className="bk">
        <h3 className="bk-h">Este móvil</h3>
        <p className="bk-d">Los avisos van por dispositivo: actívalos en cada móvil donde quieras enterarte.</p>
        <div className={"dv " + view.tone} id="pe-dv">
          <span className="dv-ic">{icon}</span>
          <div className="dv-t">
            <span className={"chip " + view.tone}>
              <i />
              {view.chip}
            </span>
            <b>{view.title}</b>
            <small>{view.dev}</small>
            {view.kind === "iphone" && (
              <>
                <ol className="steps">
                  <li>
                    <Bold s="En Safari, pulsa *Compartir*" />
                  </li>
                  <li>
                    <Bold s="Elige *Añadir a pantalla de inicio*" />
                  </li>
                  <li>
                    <span>Abre Manchester Piti desde el icono y vuelve aquí</span>
                  </li>
                </ol>
                <button type="button" className="btn sm" onClick={fixIphone} aria-label={`Ya la he añadido a la pantalla de inicio del ${iDev}`}>
                  <Ic n="check" w={16} />
                  Ya la he añadido
                </button>
              </>
            )}
            {view.kind === "denegado" && (
              <>
                <ol className="steps">
                  {unblockSteps(ua, isStandalone()).map((s) => (
                    <li key={s}>
                      <Bold s={s} />
                    </li>
                  ))}
                </ol>
                <button type="button" className="btn sm" onClick={fixDenied}>
                  <Ic n="check" w={16} />
                  Ya los he permitido
                </button>
              </>
            )}
            {view.kind === "no-soportado" && (
              <>
                <small>Prueba con Chrome o instala la web en tu pantalla de inicio. Mientras, el calendario te recuerda cada partido.</small>
                <button type="button" className="btn sm" onClick={goCal}>
                  <Ic n="cal" w={17} />
                  Ir al calendario
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bk">
        <h3 className="bk-h">Qué te avisamos</h3>
        <p className="bk-d" id="pe-tp-lead">
          {topicsLead(ready, nOn, ids.length)}
        </p>
        <ul className="tp">
          {ids.map((t) => {
            const c = TOPIC_COPY[t];
            const on = isOn(t);
            const off = !ready;
            return (
              <li key={t}>
                <button
                  type="button"
                  className="sw-row"
                  id={"pe-tp-" + t}
                  aria-pressed={on}
                  aria-disabled={off || undefined}
                  aria-describedby={off ? "pe-tp-lead" : undefined}
                  aria-busy={busy === t || undefined}
                  onClick={() => void flip(t)}
                >
                  <span className="ti">
                    <Ic n={TP_ICON[t]} w={TP_W[t] ?? 18} />
                  </span>
                  <span>
                    <b>
                      {c.label}
                      {c.capOnly && <span className="cap-only">CAPITANES</span>}
                    </b>
                    <small>{c.sub}</small>
                  </span>
                  <span className="sw-w">
                    <span className="sw" aria-hidden="true" />
                    <em>{busy === t ? "···" : on ? "SÍ" : "NO"}</em>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {err && (
          <p className="note bad" role="alert">
            <Ic n="alert" />
            <span>{err}</span>
          </p>
        )}
        <div className="row">
          <button type="button" className="btn" disabled={cantTest} aria-busy={testBusy || undefined} aria-describedby={cantTest ? "pe-test-why" : undefined} onClick={() => void probar()}>
            <Ic n="bell" w={17} />
            Probar en este móvil
          </button>
          <span className="nv">nuevo</span>
        </div>
        {cantTest && (
          <p className="tp-why" id="pe-test-why">
            <Ic n="info" w={15} />
            <span>{why}</span>
          </p>
        )}
        {testErr && (
          <p className="note bad" role="alert">
            <Ic n="alert" />
            <span>{testErr}</span>
          </p>
        )}
        {testN > 0 && ready && (
          <div className="nt" role="status" key={testN}>
            <p className="nt-h">
              <img src={CREST} alt="" />
              <span>MANCHESTER PITI</span>
              <span>ahora</span>
            </p>
            <b>{nt.title}</b>
            <p>{nt.body}</p>
          </div>
        )}
      </div>

      <div className="bk" id="pe-cal">
        <h3 className="bk-h">Calendario</h3>
        <p className="bk-d">Los partidos del club en tu calendario de siempre. Se actualiza solo.</p>
        {upcoming.length > 0 ? (
          <ul className="cal-l" aria-label="Próximos partidos">
            {upcoming.map((m) => (
              <li key={m.id}>
                <span className="cal-d">
                  <small>{m.mon}</small>
                  <b>{m.day}</b>
                </span>
                <span className="cal-t">
                  <b>{m.rival}</b>
                  <small>{m.meta}</small>
                </span>
                <span className="mono">{m.j}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="note">
            <Ic n="cal" />
            <span>No hay partidos por jugar todavía. En cuanto el capitán programe uno, sale aquí y en tu calendario.</span>
          </p>
        )}
        <div className="cal-b">
          <a className="btn" href={googleSubscribeUrl(feed)} target="_blank" rel="noopener noreferrer" title="Suscribirte en Google Calendar" onClick={() => say("Se abre Google Calendar para suscribirte")}>
            <GLogo />
            Google
          </a>
          <a className="btn" href={webcalUrl(feed)} title="Suscribirte en el Calendario de Apple" onClick={() => say("Se abre Calendario de Apple para suscribirte")}>
            <Ic n="apple" />
            Apple
          </a>
          <button type="button" className="btn" title="Copiar el enlace del calendario" onClick={() => void copyCal()}>
            <Ic n="copy" w={16} />
            {calCp ? "Copiado" : "Copiar"}
          </button>
        </div>
        <p className="url">{webcalUrl(feed)}</p>
      </div>
    </>
  );
}
