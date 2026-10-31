// /vestuario/tablon · «El tablón» (the canvas prototype's SalaTablon.dc.html): the title says who wrote last and when;
// the wall, newest first and grouped by day («Hoy», «Ayer», «Esta semana», «Antes»), each message with the writer's
// printed shirt, «Borrar» on your own (a captain's on anyone's) behind an inline confirmation; the composer (280 at
// most with its counter, Enter publishes, the text comes back if it did not go out) with the quick greetings that
// publish in one tap. «Felicitarle en el tablón» (El club, ?felicitar=<playerId>) leaves the draft ready.
import { useMemo, useState, type KeyboardEvent } from "react";
import "../../../styles/vestuario/tablon.css";
import { useBoard } from "../live";
import { useWrite } from "../shared/useWrite";
import { deleteBoardMessage, postBoardMessage } from "../writes";
import type { VxCtx } from "./ctx";
import { Ic, PShirt, RoomHead } from "./kit";
import { ago, congrats, TABLON_MAX, TABLON_QUICK, tablonHead, tablonWall, weekCount } from "./tablonModel";

export function TablonBlock({ c }: { c: VxCtx }) {
  const board = useBoard(30);
  const act = useWrite();
  const draftFor = (id: string | null) => (id ? congrats(c.nameOf(id)) : "");
  const [text, setText] = useState(() => draftFor(c.felicitar));
  // the «Desde El club» note stays until that draft goes out
  const [felic, setFelic] = useState<string | null>(c.felicitar);
  // a later «Felicitarle en el tablón» (another player) leaves its own draft
  const [felicitar, setFelicitar] = useState(c.felicitar);
  if (felicitar !== c.felicitar) {
    setFelicitar(c.felicitar);
    setFelic(c.felicitar);
    if (c.felicitar) setText(draftFor(c.felicitar));
  }
  const [asking, setAsking] = useState<string | null>(null);
  const [errHidden, setErrHidden] = useState(false);
  const [mountedAt] = useState(() => Date.now());

  const send = (raw: string, fromInput: boolean) => {
    const me = c.me;
    const sent = raw.trim();
    if (!sent) {
      c.say("Escribe algo antes de publicar.");
      return;
    }
    if (!me) return;
    setErrHidden(false);
    if (fromInput) setText("");
    act.write(
      () =>
        postBoardMessage(me, sent).catch((error: unknown) => {
          if (fromInput) setText((t) => t || raw); // the text comes back if it did not go out
          throw error;
        }),
      () => {
        if (fromInput) setFelic(null);
        c.say("Publicado en el tablón.");
      },
    );
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(text, true);
    }
  };
  const remove = (id: string) => {
    setAsking(null);
    act.write(() => deleteBoardMessage(id), () => c.say("Mensaje borrado."));
  };

  const msgs = board.data;
  const wall = useMemo(() => tablonWall(msgs, c.now), [msgs, c.now]);
  const num = useMemo(() => new Map(c.squad.map((p) => [p.id, p.num])), [c.squad]);
  const lead = msgs[0];
  const head = tablonHead({
    lead: lead ? { name: lead.name, at: lead.at, mine: lead.uid === c.uid } : null,
    week: weekCount(msgs, c.now),
    admin: c.admin,
    felicitar: felic ? c.nameOf(felic) : null,
    loading: board.loading,
    now: c.now,
  });
  const empty = !board.loading && !msgs.length;
  const near = text.length > TABLON_MAX - 20;
  const quick = (
    <div className="ve-quick">
      {TABLON_QUICK.map((t) => (
        <button key={t} type="button" className="vd-glass vd-press ve-chip" onClick={() => send(t, false)}>
          {t}
        </button>
      ))}
    </div>
  );

  return (
    <section className="vtb" aria-labelledby="ve-room-h">
      <RoomHead room="tablon" icon="board" kick="El tablón · el vestuario habla" title={head.title} sub={head.sub} />
      <div className="ve-cols">
        <section className="nx-sec nx-sec--first" aria-labelledby="vtb-wall-h">
          <div className="nx-sec__head">
            <h2 className="nx-h3" id="vtb-wall-h">
              Mensajes
            </h2>
            {msgs.length > 0 && <p className="nx-meta">Los 30 últimos · el más nuevo arriba</p>}
          </div>
          <ol className="vtb-wall" aria-live="polite" aria-label="Mensajes del tablón">
            {wall.map((m) => {
              const mine = m.uid === c.uid;
              const name = mine ? "Tú" : m.name;
              const delAria = mine ? "Borrar tu mensaje" : `Borrar el mensaje de ${m.name}`;
              const fresh = mine && m.at > mountedAt;
              return (
                <li key={m.id}>
                  {m.first && <p className="vtb-day">{m.day}</p>}
                  <div className={`vtb-msg${mine ? " is-me" : ""}${fresh ? " is-new" : ""}`}>
                    <PShirt n={(m.playerId && num.get(m.playerId)) || ""} />
                    <div className="vtb-msg__b">
                      <p className="vtb-msg__h">
                        <b>{name}</b>
                        <span>{ago(m.at, c.now)}</span>
                        {(mine || c.admin) && (
                          <button type="button" className="nx-lnk" aria-label={delAria} aria-expanded={asking === m.id} onClick={() => setAsking(m.id)}>
                            <Ic name="trash" />
                            Borrar
                          </button>
                        )}
                      </p>
                      <p className="vtb-msg__x">{m.text}</p>
                      {asking === m.id && (
                        <div
                          className="ve-confirm"
                          role="group"
                          aria-label={delAria}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setAsking(null);
                          }}
                        >
                          <p>{mine ? "¿Borrar tu mensaje? Se borra para todo el equipo." : `¿Borrar el mensaje de ${m.name}? Se borra para todo el equipo.`}</p>
                          <div className="ve-acts">
                            <button type="button" className="vd-glass vd-press nx-btn nx-btn--danger" onClick={() => remove(m.id)}>
                              Sí, borrarlo
                            </button>
                            <button type="button" className="vd-glass vd-press nx-btn" onClick={() => setAsking(null)}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {empty && (
            <div className="ve-empty vtb-empty">
              <span className="ve-tile" aria-hidden="true">
                <Ic name="chat" />
              </span>
              <h2>El tablón está en blanco</h2>
              <p>Nadie ha escrito todavía. Preséntate con un toque:</p>
              {quick}
            </div>
          )}
        </section>

        <div className="ve-side">
          <section className="vd-glass vd-glass--deep ve-card vtb-comp" aria-labelledby="vtb-in-l">
            <label className="vtb-comp__t" id="vtb-in-l" htmlFor="vtb-in">
              Escribe al vestuario
            </label>
            {felic && (
              <p className="vtb-ctx">
                <PShirt n={num.get(felic) ?? ""} />
                <span>Desde El club: felicita a {c.nameOf(felic)}. Te dejamos el mensaje listo; cámbialo si quieres.</span>
              </p>
            )}
            <textarea
              className="ve-in"
              id="vtb-in"
              rows={3}
              maxLength={TABLON_MAX}
              placeholder="Escribe al vestuario…"
              aria-describedby="vtb-in-c"
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, TABLON_MAX));
                setErrHidden(true);
              }}
              onKeyDown={onKey}
              autoComplete="off"
            />
            {act.error && !errHidden && (
              <p className="vtb-err" role="alert">
                <Ic name="warn" />
                {act.error}
              </p>
            )}
            <div className="vtb-comp__row">
              <p className={`vtb-hint${near ? " is-near" : ""}`} id="vtb-in-c">
                <b>
                  {text.length}/{TABLON_MAX}
                </b>{" "}
                · Enter publica · lo ve todo el equipo
              </p>
              <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={() => send(text, true)}>
                <Ic name="send" />
                Publicar
              </button>
            </div>
            {msgs.length > 0 && (
              <div className="vtb-quick">
                <p>Un toque y se publica</p>
                {quick}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
