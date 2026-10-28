// La mesa (r12) · final «Repasa y firma»: the result with the site's G·E·P letter, the goals (a goal without its scorer
// asks «¿Quién marcó?» right there, B-MESA-03; the pass, optional), «Antes de publicar» (what blocks it, as the server
// sees it), «Reabrir el partido» behind a second tap and the acta held a second to publish. Then «Acta publicada»:
// the MVP, the notas, a photo and two lines for the crónica (M-38).
import type { KeyboardEvent, PointerEvent } from "react";
import { resultLetter, resultTitle } from "../../../lib/derived/result";
import type { MesaView } from "../types";
import { latestFirst, listOf, onAt, passOpen, plural, shownScore, timeText, upper } from "./derive";
import type { useBoard } from "./useBoard";

type B = ReturnType<typeof useBoard>;

export function Final({ v, b }: { v: MesaView; b: B }) {
  const sc = shownScore(v);
  const letter = resultLetter(sc.us, sc.them);
  const goals = latestFirst(v.events.filter((e) => e.goal && !e.dupOf)).reverse();
  const bl = b.blockers;
  const noScorer = v.events.some((e) => e.pendingScorer && !e.dupOf);
  const noPass = v.events.filter(passOpen).length;
  const checks = [
    { ok: !v.queue.pending, t: v.queue.pending ? plural(v.queue.pending, "jugada sigue en el móvil", "jugadas siguen en el móvil") : `${plural(v.events.length, "jugada subida", "jugadas subidas")} · al día` },
    { ok: !v.match.pendingDuplicates, t: v.match.pendingDuplicates ? `${plural(v.match.pendingDuplicates, "duda entre anotadores", "dudas entre anotadores")}: resuélvela en la crónica` : "Ninguna duda entre anotadores" },
    { ok: !v.queue.review.length, t: v.queue.review.length ? plural(v.queue.review.length, "jugada por revisar", "jugadas por revisar") : "Nada por revisar" },
    { ok: !noScorer, t: noScorer ? "Falta quién marcó algún gol: elígelo arriba" : "Todos los goles con goleador" },
    { ok: true, soft: noPass > 0, t: noPass ? `${plural(noPass, "gol sin pase contestado", "goles sin pase contestado")} · opcional` : "Pases completos" },
  ];
  const holding = !!b.holding;
  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button > 0) return;
    e.preventDefault();
    b.holdStart();
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (!e.repeat) b.holdStart();
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") b.holdEnd();
  };
  const sending = b.busy === "publish";
  return (
    <section className="me-fin me-scroll" aria-labelledby="me-fi-h">
      <header className="me-sh vd-reg-2">
        <p className="me-k">Final · {v.match.duration}′ · {plural(v.events.length, "jugada", "jugadas")}</p>
        <h1 className="me-h1" id="me-fi-h">Repasa y firma</h1>
        <p className="me-fin__res"><span className={`me-res me-res--${letter}`} aria-hidden="true">{letter}</span><b>{resultTitle(letter)}</b><span>Manchester Piti {sc.us}–{sc.them} {v.match.rival}</span></p>
      </header>
      <div className="me-fin__grid">
        <section className="me-fin__goals vd-reg-3" aria-labelledby="me-fg-t">
          <h2 className="me-h3" id="me-fg-t">Los goles</h2>
          {!goals.length && <p className="me-small">Ningún gol en el partido.</p>}
          <ol className="me-rows">
            {goals.map((g) => {
              const us = g.goal === "us";
              const pool = us && g.type !== "opponent_own_goal" ? onAt(v, g) : [];
              const needP = us && g.pendingScorer;
              const needA = us && passOpen(g);
              return (
                <li key={g.id} className={`me-fg${needP ? " is-need" : ""}`}>
                  <p className="me-fg__t">
                    <span className="me-fg__m">{g.minute ?? "–"}′</span>
                    {!us && <span className="me-rc"><i aria-hidden="true">{v.match.rivalShort}</i></span>}
                    <b>{needP ? "¿Quién marcó?" : g.text}</b>
                  </p>
                  {needP && (
                    <div className="me-fg__ask" role="group" aria-label={`¿Quién marcó el gol del ${g.minute}′?`}>
                      <p className="me-small">Estaban en el campo:</p>
                      <div className="me-chips">{pool.map((p) => <button key={p.id} type="button" className="me-chip vd-glass vd-press" onClick={() => b.finScorer(g, p.id)}>{upper(p.name)}</button>)}</div>
                    </div>
                  )}
                  {needA && (
                    <div className="me-fg__ask" role="group" aria-label={`¿Le dio el pase alguien en el gol del ${g.minute}′?`}>
                      <p className="me-small">¿Y el pase? (opcional)</p>
                      <div className="me-chips">
                        {pool.filter((p) => p.id !== g.playerId).map((p) => <button key={p.id} type="button" className="me-chip vd-glass vd-press" onClick={() => b.finPass(g, p.id)}>{upper(p.name)}</button>)}
                        <button type="button" className="me-chip vd-glass vd-press" onClick={() => b.finPass(g, null)}>Sin pase</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
        <section className="me-fin__chk vd-reg-4" aria-labelledby="me-fc-t">
          <div className="me-sec__h"><h2 className="me-h3" id="me-fc-t">Antes de publicar</h2><span className="me-sec__n">{bl.length ? `Faltan ${bl.length}` : "Listo para publicar"}</span></div>
          <ul className="me-rows">
            {checks.map((x) => (
              <li key={x.t} className="me-row"><span className="me-row__t"><b>{x.t}</b></span><span className={`me-tag ${x.ok ? "me-tag--hecho" : "me-tag--toca"}`}>{!x.ok ? "Falta" : x.soft ? "Opcional" : "Listo"}</span></li>
            ))}
          </ul>
          <p className="me-small me-fin__after">Al publicar se actualizan las estadísticas, el ranking y los logros, se abre el MVP (48 h) y salen las notas.</p>
          <div className="me-btnrow">
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={v.nav.cronica}>Ver las {v.events.length} jugadas</button>
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => b.clockAct("reopen")} aria-busy={b.busy === "clock"}>{b.confirmK === "reopen" ? "¿Reabrir? Toca otra vez" : "Reabrir el partido"}</button>
          </div>
        </section>
      </div>
      <div className="me-kick me-primary me-primary--pin vd-reg-5">
        <p className="me-small me-kick__why" id="me-hold-why">{bl.length ? `No se puede publicar: ${listOf(bl)}.` : sending ? "Publicando…" : "Mantén pulsado un segundo; queda a tu nombre."}</p>
        <button type="button" className={`vd-btn vd-glass vd-press vd-btn--pri me-kick__b me-hold${holding ? " is-holding" : ""}`} onPointerDown={onDown} onPointerUp={b.holdEnd} onPointerLeave={b.holdEnd} onPointerCancel={b.holdEnd} onKeyDown={onKey} onKeyUp={onKeyUp} onContextMenu={(e) => e.preventDefault()} aria-disabled={bl.length > 0 || sending} aria-busy={sending} aria-describedby="me-hold-why">
          <span className="me-hold__fill" aria-hidden="true" />
          <span className="me-hold__t">{holding ? "Sigue… suelta para cancelar" : sending ? "Publicando…" : "Mantén para publicar"}</span>
        </button>
      </div>
    </section>
  );
}

export function Publicado({ v, b, now }: { v: MesaView; b: B; now: number }) {
  const sc = shownScore(v);
  const left = v.match.voteClosesAt ? Math.max(0, Math.round((v.match.voteClosesAt - now) / 3_600_000)) : 48;
  const report = b.ui.report;
  return (
    <section className="me-pub me-scroll" aria-labelledby="me-pu-h">
      <header className="me-sh vd-reg-2">
        <p className="me-k">Publicada a las {timeText(now)} por ti</p>
        <h1 className="me-h1" id="me-pu-h">Acta publicada</h1>
        <p className="me-lede">Manchester Piti {sc.us}–{sc.them} {v.match.rival} · ya está en la web y el club lo ha recibido.</p>
      </header>
      <ul className="me-rows me-pub__next vd-reg-3" aria-label="Lo siguiente">
        <li className="me-row"><span className="me-row__t"><b>MVP abierto · cierra en {left} h</b><span>Votan los que jugaron; el ganador sale en la portada.</span></span><button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => v.nav.go(`/partidos/${v.match.id}/vestuario`)}>Ver el MVP</button></li>
        <li className="me-row"><span className="me-row__t"><b>Las notas</b><span>Salen al cerrar el MVP · el club recibe «Ya están las notas»</span></span></li>
        {v.me.admin && <li className="me-row"><span className="me-row__t"><b>Una foto del partido</b><span>Sale en la cabecera del partido en la web.</span></span><button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => v.nav.go(`/admin/partidos/${v.match.id}/acta`)}>Añadir foto</button></li>}
      </ul>
      <section className="me-pub__report vd-reg-4" aria-labelledby="me-rp-t">
        <h2 className="me-h3" id="me-rp-t">Escribe dos líneas para la crónica</h2>
        <div className="me-field">
          <label htmlFor="me-report">La crónica corta</label>
          <textarea id="me-report" className="vd-input me-ta" maxLength={220} value={report} onChange={(e) => b.setUi({ report: e.target.value })} placeholder="Remontada a lo City: dos goles en los últimos diez minutos." aria-describedby="me-report-n" />
          <small id="me-report-n">{220 - report.length} caracteres</small>
        </div>
        <div className="me-btnrow">
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={b.saveReport} aria-busy={b.busy === "report"}>Guardar la crónica</button>
          <button type="button" className="vd-btn vd-glass vd-press" onClick={v.nav.acta}>Ver el partido</button>
        </div>
      </section>
    </section>
  );
}
