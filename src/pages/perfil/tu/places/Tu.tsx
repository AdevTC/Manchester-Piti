// Tú (TuCarta «tu»). Two parts, because the bar hangs between them:
//   · `TuStage`, the stage's right side beside the shell's card: who he is (kicker, name, line, chips, why his card
//     is what it is), a new account's petition («Ver mi petición» → the petition with «Cancelar la petición» behind
//     a confirmation) or the way to a ficha (/vestuario/ficha: one claim flow), and «Lo que te toca» answered in
//     place (TodoCards). It also opens «De qué está hecho» for the card's numbers and says «¡Carta revelada!» when
//     the captain approves his ficha while he watches.
//   · `Tu`, under the bar: El próximo partido · Tu forma · Lo próximo para tu carta (a socio: la porra · el MVP ·
//     tus avisos).
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { tuGo } from "../../../../components/vidrio/tu/kit";
import { TuIcon } from "../../../../components/vidrio/tu/ui";
import { downloadIcs, eventIcs } from "../../../../lib/ics";
import { googleEventUrl, preferredCalendar } from "../../../../lib/calendarLinks";
import { matchEvent } from "../../../../lib/home";
import { Shirt } from "../TuCard";
import { wantedNumber } from "../view";
import type { PlaceProps } from "./types";
import { AttrSheet } from "./tu/AttrSheet";
import { closePetition, openPetition, usePetitionOpen } from "./tu/petition";
import { TodoCards } from "./tu/TodoCards";
import { TuSheet } from "./tu/TuSheet";
import { calmLine, formView, idView, milestoneView, nextView, socioTrio, todoMeta } from "./tuView";

/** Goes to another address of the site with the page's transition. */
function useGoTo() {
  const navigate = useNavigate();
  return (href: string) =>
    tuGo("right", async () => {
      await navigate({ href });
    });
}

export function TuStage(p: PlaceProps & { name: string; line: string }) {
  const { data, me, pending, who, card, say } = p;
  const goTo = useGoTo();
  const kind = card.model.kind;
  const c = data.card;
  const played = me.rows.filter((r) => r.kind === "played");
  const lastDone = [...me.rows].reverse().find((r) => r.kind === "played" || r.kind === "didnt" || r.kind === "absent");
  const id = idView({
    kind: who.kind,
    captain: who.captain,
    seasonName: data.seasonName,
    lastJ: lastDone?.j ? `J${lastDone.j}` : null,
    tier: me.tier,
    figures: me.figures,
    onlyPlayed: played.length === 1 ? played[0] : null,
    showNumbers: c.showNumbers,
    started: c.started,
    first: c.first,
    racha: c.racha,
    pendingClaim: data.ficha.state === "pendiente",
  });

  // ── «¡Carta revelada!»: the captain said yes while he was looking (the sobre turns into his card)
  const h1 = useRef<HTMLHeadingElement | null>(null);
  const was = useRef(kind);
  const [revealed, setRevealed] = useState(false);
  const { replay } = card;
  useEffect(() => {
    const before = was.current;
    was.current = kind;
    if ((before === "pack" || before === "down") && kind === "face") {
      setRevealed(true);
      closePetition();
      replay();
      say("¡Carta revelada! Tu ficha está vinculada.");
      h1.current?.focus({ preventScroll: true });
    }
  }, [kind, replay, say]);

  const jOf = (matchId: string) => me.rows.find((r) => r.matchId === matchId)?.j ?? null;
  const attrText = card.attr ? (c.showNumbers ? (c.attrs.find((a) => a.k === card.attr)?.text ?? "—") : "—") : "—";

  return (
    <div className="tc-id">
      <p className="tc-kick">{id.kick}</p>
      <h1 id="tc-name" ref={h1} tabIndex={-1}>
        {p.name}
      </h1>
      <p className="tc-id__line">{p.line}</p>
      {id.chips.length > 0 && (
        <div className="tc-chips">
          {id.chips.map((x) => (
            <span key={x.t} className={`tk-st${x.cls ? ` ${x.cls}` : ""}`}>
              {x.t}
            </span>
          ))}
        </div>
      )}
      <p className="tc-why">{id.why}</p>

      {revealed && kind === "face" && (
        <p className="vd-glass tc-reveal" role="status">
          <TuIcon name="star" className="nx-ic" />
          <span>
            <b>¡Carta revelada!</b> Tu ficha está vinculada: desde hoy tus partidos, tus notas y tu carta salen aquí.
          </span>
        </p>
      )}

      {who.kind === "nuevo" && kind === "pack" && <Petition {...p} />}
      {who.kind === "nuevo" && kind !== "pack" && (
        <div className="vd-glass tk-card tc-idcard">
          <p className="tk-card__k">Tu ficha</p>
          <h3>{data.ficha.rejectedPlayerId ? `El capitán no aprobó el ${data.shirt.squad.find((s) => s.id === data.ficha.rejectedPlayerId)?.number ?? ""}`.trim() : "Elige tu ficha y sale tu carta"}</h3>
          <p>{data.freeFichas.length ? "Eliges tu nombre y tu dorsal en el vestuario, entre las fichas libres, y el capitán lo confirma." : "No quedan fichas libres: habla con el capitán en el vestuario."}</p>
          <div className="tk-acts">
            <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={() => goTo("/vestuario/ficha")}>
              <TuIcon name="shirt" className="nx-ic" />
              Elegir mi ficha
            </button>
          </div>
        </div>
      )}
      {who.kind === "socio" && (
        <div className="vd-glass tk-card tc-idcard">
          <p className="tk-card__k">¿Juegas en el Piti?</p>
          <h3>Pide tu ficha y sale tu carta</h3>
          <p>Eliges tu nombre y tu dorsal en el vestuario y el capitán lo confirma. Pedirla no cambia nada más de tu cuenta.</p>
          <div className="tk-acts">
            <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={() => goTo("/vestuario/ficha")}>
              <TuIcon name="shirt" className="nx-ic" />
              Elegir mi ficha
            </button>
          </div>
        </div>
      )}

      {who.kind !== "fan" && (
        <>
          <div className="tc-todohead">
            <h2 id="tc-todo-h">Lo que te toca</h2>
            {pending.open > 0 && <p className="nx-meta">{todoMeta(pending.open)}</p>}
          </div>
          <TodoCards items={pending.items} say={say} jornadaOf={jOf} calm={calmLine(me.next)} labelledBy="tc-todo-h" />
        </>
      )}

      {card.attr && kind === "face" && <AttrSheet k={card.attr} rows={me.rows} text={attrText} rewards={me.rewards} onClose={() => card.setAttr(null)} />}
    </div>
  );
}

/** A new account's request: the card beside his name and the petition sheet («Ver mi petición»). */
function Petition(p: PlaceProps) {
  const { data, say } = p;
  const isOpen = usePetitionOpen();
  const goTo = useGoTo();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const num = wantedNumber(data);
  const wanted = data.shirt.squad.find((s) => s.id === (data.ficha.claim?.playerId ?? data.ficha.playerId));
  const who = (wanted?.name || data.ficha.claim?.playerName || "").toLocaleUpperCase("es");
  const title = `La ficha${who ? ` de ${who}` : ""}${num ? `, dorsal ${num}` : ""}`;
  useEffect(() => () => closePetition(), []);
  const close = () => {
    setAsk(false);
    setErr("");
    closePetition();
  };
  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      await p.actions.cancelClaim();
      close();
      say("Petición cancelada. Puedes pedir otra carta cuando quieras.");
    } catch {
      setErr("No se ha podido cancelar la petición. Inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="vd-glass tk-card tc-idcard">
        <p className="tk-card__k">Tu petición</p>
        <h3>{title}</h3>
        <p>
          <span className="tk-st is-warn">Pendiente del capitán</span> Te avisamos en cuanto conteste: en la campana y, si lo tienes activado, en el móvil.
        </p>
        <div className="tk-acts">
          <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={openPetition}>
            Ver mi petición
          </button>
        </div>
      </div>
      {isOpen && (
        <TuSheet id="tc-sh-pet" kick="Tu petición" title={`Sobre cerrado${num ? ` · el ${num}` : ""}`} onClose={close}>
          <div className="tc-big">
            {num ? <Shirt num={num} className="tc-pet__shirt" /> : null}
            <div>
              <p className="tc-pet__t">{title}</p>
              <p className="nx-meta">
                <span className="tk-st is-warn">Pendiente del capitán</span>
              </p>
            </div>
          </div>
          <p className="nx-meta">Te avisamos en cuanto conteste: en la campana y, si lo tienes activado, en el móvil. Si dice que no, eliges otra ficha.</p>
          {!ask ? (
            <div className="nx-sheet__btns">
              <button type="button" className="vd-glass vd-press nx-btn" onClick={() => goTo("/vestuario")}>
                Hablar con el capitán
              </button>
              <button type="button" className="nx-lnk" onClick={() => setAsk(true)}>
                Cancelar la petición
              </button>
            </div>
          ) : (
            <div className="tk-confirm" role="group" aria-labelledby="tc-pet-q">
              <p id="tc-pet-q">¿Cancelar tu petición{num ? ` de la ficha del ${num}` : ""}? Podrás pedir otra cuando quieras.</p>
              <div className="tk-acts">
                <button type="button" className="vd-glass vd-press nx-btn nx-btn--danger" aria-disabled={busy || undefined} onClick={() => void cancel()}>
                  {busy ? "Cancelando…" : "Sí, cancelar"}
                </button>
                <button type="button" className="nx-lnk" aria-disabled={busy || undefined} onClick={() => !busy && setAsk(false)}>
                  No, seguir esperando
                </button>
              </div>
              {err && (
                <p className="tc-do__err" role="alert">
                  {err}
                </p>
              )}
            </div>
          )}
        </TuSheet>
      )}
    </>
  );
}

export function Tu(p: PlaceProps) {
  const { me, who, data, go, now, say } = p;
  const goTo = useGoTo();
  if (who.kind === "fan") return null;
  if (who.kind !== "jugador") {
    const s = socioTrio(data.stuff.porra);
    return (
      <div className="tc-trio">
        <section className="tc-tri" aria-labelledby="tc-porra-h">
          <p className="tc-tri__k" id="tc-porra-h">
            La porra
          </p>
          <p className="tc-tri__big">{s.porraBig}</p>
          <p className="tc-tri__line">{s.porraLine}</p>
        </section>
        <section className="tc-tri" aria-labelledby="tc-mvp-h">
          <p className="tc-tri__k" id="tc-mvp-h">
            El MVP
          </p>
          <p className="tc-tri__line">Votas al MVP cuando acaba cada partido, durante 48 horas.</p>
        </section>
        <section className="tc-tri" aria-labelledby="tc-av-h">
          <p className="tc-tri__k" id="tc-av-h">
            Tus avisos
          </p>
          <p className="tc-tri__line">Los del vestuario, en la campana; los del móvil, en Ajustes › Avisos.</p>
          <div className="nx-links">
            <button type="button" className="nx-lnk" onClick={() => go({ page: "perfil", sec: "ajustes", aj: "avisos", open: null })}>
              Elegir tus avisos
            </button>
          </div>
        </section>
      </div>
    );
  }

  const nextM = me.next ? data.raw.matches.find((m) => m.id === me.next?.matchId) : undefined;
  const nx = nextView(me.next, now, nextM?.venue);
  const form = formView(me.form, me.figures);
  const ms = milestoneView(me.rewards);
  const previa = `/partidos/${me.next?.matchId ?? ""}`;
  const toCal = () => {
    if (!nextM) return;
    const origin = window.location.origin;
    const e = matchEvent(nextM, origin);
    if (preferredCalendar(navigator.userAgent) === "apple") {
      downloadIcs(`${e.uid}.ics`, eventIcs({ uid: e.uid, start: e.start, end: e.end, summary: e.title, location: e.location, url: e.url }));
      say("Descargado: ábrelo y se añade a tu calendario.");
    } else {
      window.open(googleEventUrl(e), "_blank", "noopener");
    }
  };
  return (
    <div className="tc-trio">
      <section className="tc-tri" aria-labelledby="tc-next-h">
        <p className="tc-tri__k" id="tc-next-h">
          El próximo partido{nx ? ` · ${nx.in}` : ""}
        </p>
        {nx ? (
          <>
            <p className="tc-tri__big">{nx.rival}</p>
            <p className="tc-tri__line">{nx.line}</p>
            <div className="nx-links">
              <a
                className="nx-lnk"
                href={previa}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  goTo(previa);
                }}
              >
                Ver la previa
              </a>
              {nextM && Number.isFinite(me.next?.dateMs ?? NaN) && (
                <button type="button" className="nx-lnk" onClick={toCal}>
                  Al calendario
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="tc-tri__big">Sin fecha</p>
            <p className="tc-tri__line">El calendario aún no tiene el siguiente partido. Te avisamos cuando lo tenga.</p>
          </>
        )}
      </section>
      <section className="tc-tri" aria-labelledby="tc-form-h">
        <p className="tc-tri__k" id="tc-form-h">
          Tu forma · tus últimas notas
        </p>
        {form.chips.length > 0 && (
          <ul className="tc-form" aria-label="Tus últimas notas">
            {form.chips.map((f) => (
              <li key={f.key} className={f.cls} aria-label={f.aria}>
                <b aria-hidden="true">{f.n}</b>
                <small aria-hidden="true">{f.j}</small>
              </li>
            ))}
          </ul>
        )}
        <p className="tc-tri__line">{form.line}</p>
        <div className="nx-links">
          <button type="button" className="nx-lnk" onClick={() => go({ page: "perfil", sec: "partidos", aj: null, open: null })}>
            Tus partidos, uno a uno
          </button>
        </div>
      </section>
      <section className="tc-tri" aria-labelledby="tc-ms-h">
        <p className="tc-tri__k" id="tc-ms-h">
          Lo próximo para tu carta
        </p>
        {ms ? (
          <>
            <p className="tc-tri__big tc-tri__big--sm">{ms.t}</p>
            <div className="tc-bar" role="img" aria-label={ms.aria}>
              <i style={{ width: `${ms.pct}%` }} />
            </div>
            <p className="tc-tri__line">{ms.line}</p>
          </>
        ) : (
          <>
            <p className="tc-tri__big tc-tri__big--sm">Todo ganado</p>
            <p className="tc-tri__line">Tienes todas las piezas de la vitrina. Los premios marcan tu carta, nunca tu valoración.</p>
          </>
        )}
        <div className="nx-links">
          <button type="button" className="nx-lnk" onClick={() => go({ page: "perfil", sec: "vitrina", aj: null, open: null })}>
            Tu camino en la vitrina
          </button>
        </div>
      </section>
    </div>
  );
}
