// «El tablón» grown in place (/vestuario/tablon, CL- boards part-vestuario vx.g.tablon): the vestuario's messages,
// newest first («Who · hace N min · text»), your own «Borrar» (a captain's on anyone's), the three quick greetings
// while nobody has written, and the compose line («Publicar»). «Felicitarle en el tablón» leaves the draft ready.
import { useState, type KeyboardEvent } from "react";
import { useBoard } from "../live";
import { useWrite } from "../shared/useWrite";
import { deleteBoardMessage, postBoardMessage } from "../writes";
import type { VxCtx } from "./ctx";
import { ago, congrats, TABLON_MAX, TABLON_QUICK } from "./tablonModel";

export function TablonBlock({ c }: { c: VxCtx }) {
  const board = useBoard(30);
  const act = useWrite();
  const draftFor = (id: string | null) => (id ? congrats(c.nameOf(id)) : "");
  const [text, setText] = useState(() => draftFor(c.felicitar));
  // a later «Felicitarle en el tablón» (another player) leaves its own draft
  const [felicitar, setFelicitar] = useState(c.felicitar);
  if (felicitar !== c.felicitar) {
    setFelicitar(c.felicitar);
    if (c.felicitar) setText(draftFor(c.felicitar));
  }

  const send = (raw: string, giveBack: boolean) => {
    const me = c.me;
    const sent = raw.trim();
    if (!sent) {
      c.say("Escribe algo antes de publicar.");
      return;
    }
    if (!me) return;
    if (giveBack) setText("");
    act.write(
      () =>
        postBoardMessage(me, sent).catch((error: unknown) => {
          if (giveBack) setText((t) => t || raw); // the text comes back if it did not go out
          throw error;
        }),
      () => c.say("Publicado en el tablón."),
    );
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(text, true);
    }
  };
  const remove = (id: string) => act.write(() => deleteBoardMessage(id), () => c.say("Mensaje borrado."));
  const msgs = board.data;

  return (
    <>
      {!board.loading && !msgs.length ? (
        <>
          <p className="cb-empty">Nadie ha escrito todavía. Preséntate con un toque:</p>
          <div className="cb-row-acts">
            {TABLON_QUICK.map((t) => (
              <button key={t} type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={() => send(t, false)}>
                {t}
              </button>
            ))}
          </div>
        </>
      ) : (
        <ul className="cb-board-l" aria-label="Mensajes del tablón" aria-live="polite">
          {msgs.map((m) => {
            const mine = m.uid === c.uid;
            return (
              <li key={m.id}>
                <b>{mine ? "Tú" : m.name}</b>
                <span>{ago(m.at, c.now)}</span>
                <p>{m.text}</p>
                {(mine || c.admin) && (
                  <button type="button" className="vd-link" aria-label={mine ? "Borrar tu mensaje" : `Borrar el mensaje de ${m.name}`} onClick={() => remove(m.id)}>
                    Borrar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <label className="cb-compose">
        <span className="vd-vh">Escribe al vestuario</span>
        <input className="vd-input" type="text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} placeholder="Escribe al vestuario…" maxLength={TABLON_MAX} autoComplete="off" />
      </label>
      <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri vd-btn--sm" onClick={() => send(text, true)}>
        Publicar
      </button>
      {act.error && (
        <p className="cb-small" role="alert">
          {act.error}
        </p>
      )}
    </>
  );
}
