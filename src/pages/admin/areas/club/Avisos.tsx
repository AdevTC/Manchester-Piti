// CLUB · Avisos (/admin/club/avisos; board part-club.html § avisos, M-18): la bandeja de la capitanía (the door, the
// payments to confirm, the turns done, the positions to review: «Abrir» takes you there and marks it read), «Lo que se
// ha mandado» (every notice the club sent, to how many socios and phones) and «Mandar un aviso a mano» (to the whole
// team, the captaincy or the next match's convocados; one a minute).
import { useState } from "react";
import { VIcon, type VIconName } from "../../../../components/vidrio/VIcon";
import { apiError, sendCaptainNotice, type CaptainNoticeAudience } from "../../../../lib/clubApi";
import type { PushSentDoc } from "../../../../lib/clubData";
import { plural } from "../../../../lib/derived/words";
import { ScreenError, ScreenLoading } from "../../shell/Screen";
import { SalaLink } from "../../shell/SalaLink";
import { useAdmin } from "../../shell/context";
import { useStatus } from "../../shell/statusContext";
import { useOnline } from "../../shell/season";
import { noticeTarget, useCaptainInbox } from "./inbox";
import { usePushSent } from "./live";
import { relWhen } from "./model";
import { RoomScreen } from "./Room";

const AUD: { id: CaptainNoticeAudience; label: string }[] = [
  { id: "todos", label: "Todo el equipo" },
  { id: "capitanes", label: "La capitanía" },
  { id: "convocados", label: "Los convocados" },
];
const AUDIENCE_WORD: Record<PushSentDoc["audience"], string> = { publico: "a quien sigue al club", equipo: "al equipo", capitanes: "a la capitanía", convocados: "a los convocados" };
const KIND_WORD: Record<PushSentDoc["kind"], string> = { auto: "", manual: "a mano", recordatorio: "recordatorio" };
const MAX = 140;

const iconOf = (url: string, topic: string): VIconName => (url.startsWith("/admin/caja") ? "euro" : url.includes("turno") ? "wash" : url.startsWith("/admin/plantilla") ? "shirt" : topic === "door" ? "lock" : "bell");

export function AvisosScreen() {
  const data = useAdmin();
  const status = useStatus();
  const online = useOnline();
  const inbox = useCaptainInbox();
  const sent = usePushSent(true);
  const [text, setText] = useState("");
  const [aud, setAud] = useState<CaptainNoticeAudience>("todos");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const next = data.next?.match;
  const unread = inbox.list.filter((n) => inbox.reads.unread(n));

  const mark = (ids: string[], value: boolean, msg: string) =>
    void inbox.reads.mark(ids, value).then(
      () => status.show({ tag: "Avisos", message: msg }),
      (e: unknown) => status.show({ tone: "error", message: `No se ha podido marcar: ${apiError(e)}` }),
    );
  const send = async () => {
    const t = text.trim();
    if (!t) {
      setErr("Escribe el aviso antes de mandarlo.");
      return;
    }
    if (aud === "convocados" && !next) {
      setErr("No hay un próximo partido con convocatoria.");
      return;
    }
    setSending(true);
    setErr("");
    try {
      const r = await sendCaptainNotice({ text: t, audience: aud, ...(aud === "convocados" && next ? { matchId: next.id } : {}) });
      setText("");
      status.show({ tag: "Aviso", message: `«${t.slice(0, 60)}${t.length > 60 ? "…" : ""}» mandado a ${plural(r.data.members, "socio", "socios")} · ${plural(r.data.devices, "móvil", "móviles")}` });
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setSending(false);
    }
  };

  const lede = inbox.unread ? `${inbox.unread} sin leer` : inbox.list.length ? `Todo leído · ${plural(sent.data.length, "enviado", "enviados")}` : "Sin avisos todavía";
  return (
    <RoomScreen room="avisos" lede={lede} primary={unread.length ? { label: "Marcar todo como leído", onClick: () => mark(unread.map((n) => n.id), true, "Todo leído") } : null}>
      {inbox.loading && !inbox.list.length ? (
        <ScreenLoading label="Cargando los avisos" />
      ) : inbox.error && !inbox.list.length ? (
        <ScreenError what="los avisos" onRetry={() => window.location.reload()} />
      ) : (
        <div className="cl-grid cl-av">
          <section className="cl-col sc-scroll" aria-labelledby="cl-in-t">
            <header className="sc-sec__h">
              <h2 className="sc-h2" id="cl-in-t">
                La bandeja de la capitanía
              </h2>
              <span className="sc-sec__n">{inbox.unread} sin leer</span>
            </header>
            {!inbox.list.length ? (
              <p className="sc-p cl-empty">Sin avisos. Aquí llegan los pagos avisados, quien llama a la puerta, los turnos hechos y las propuestas de posiciones.</p>
            ) : (
              <ul className="sc-rows">
                {inbox.list.map((n) => {
                  const isNew = inbox.reads.unread(n);
                  return (
                    <li key={n.id} className={`sc-row cl-notice${isNew ? "" : " is-read"}`}>
                      <span className="cl-door__i vd-glass" aria-hidden="true">
                        <VIcon name={iconOf(n.url, n.topic)} size={18} />
                      </span>
                      <span className="sc-row__t">
                        <b>{n.title}</b>
                        <span>
                          {n.body} · {relWhen(n.at, data.now)}
                        </span>
                      </span>
                      {isNew ? <span className="sc-tag sc-tag--toca">Sin leer</span> : <span aria-hidden="true" />}
                      <span className="cl-acts">
                        <SalaLink className="vd-btn vd-glass vd-press vd-btn--sm" to={noticeTarget(n)} aria-label={`Abrir: ${n.title}`} onClick={() => isNew && void inbox.reads.mark([n.id], true).catch(() => undefined)}>
                          Abrir
                        </SalaLink>
                        <button type="button" className="vd-link" onClick={() => mark([n.id], isNew, isNew ? "Marcado leído" : "Marcado sin leer")}>
                          {isNew ? "Marcar leído" : "Marcar sin leer"}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="cl-col sc-scroll" aria-labelledby="cl-sent-t">
            <header className="sc-sec__h">
              <h2 className="sc-h2" id="cl-sent-t">
                Lo que se ha mandado
              </h2>
            </header>
            {sent.loading ? (
              <p className="sc-small">Cargando lo enviado…</p>
            ) : !sent.data.length ? (
              <p className="sc-p cl-empty">Todavía no se ha mandado nada al equipo.</p>
            ) : (
              <ul className="sc-rows">
                {sent.data.map((s) => {
                  const j = s.matchId ? data.matches.find((m) => m.id === s.matchId)?.jornada : null;
                  return (
                    <li key={s.id} className="sc-row">
                      <span className="sc-row__t">
                        <b>{s.title}</b>
                        <span>
                          {[j ? `J${j}` : "", KIND_WORD[s.kind], `${AUDIENCE_WORD[s.audience]}: ${plural(s.members, "socio", "socios")} · ${plural(s.devices, "móvil", "móviles")}`, relWhen(s.at, data.now)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="cl-compose">
              <h3 className="sc-h3">Mandar un aviso a mano</h3>
              <label className="sc-field">
                <span>El aviso</span>
                <textarea className="vd-input" maxLength={MAX} placeholder="Mañana cambiamos de campo: CDM Entrevías" value={text} onChange={(e) => setText(e.target.value)} />
                <small className={text.length > MAX ? "is-bad" : ""}>
                  {text.length}/{MAX}
                </small>
              </label>
              <div className="sc-chips" role="group" aria-label="A quién">
                {AUD.map((a) => (
                  <button key={a.id} type="button" className="sc-chip vd-glass vd-press" aria-pressed={aud === a.id} aria-disabled={(a.id === "convocados" && !next) || undefined} onClick={() => !(a.id === "convocados" && !next) && setAud(a.id)}>
                    {a.label}
                    {a.id === "convocados" && next?.jornada ? ` · J${next.jornada}` : ""}
                  </button>
                ))}
              </div>
              <p className="sc-small">Sale como «Aviso de la capitanía» en sus móviles y queda en su centro de avisos. Uno por minuto.</p>
              {err && (
                <p className="cl-alert" role="alert">
                  {err}
                </p>
              )}
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-disabled={sending || !online || undefined} onClick={() => !sending && online && void send()}>
                {sending ? "Mandando…" : online ? "Mandar el aviso" : "Sin conexión: el aviso necesita red"}
              </button>
            </div>
          </section>
        </div>
      )}
    </RoomScreen>
  );
}
