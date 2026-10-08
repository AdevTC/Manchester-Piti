// /profile › Tu carta › «Tu nombre» (nuevo): A «En la espalda» (the shirt name: a live close-up printing
// what you type, the size chip, the backend's checks, «Estampar» and «Deshacer») and B «Tu apodo» (the
// vestuario handle: lowercase as you type, the backend's rules, the uniqueness lookup, «Guardar»).
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Tee } from "./CardFaces";
import { errorMessage, isOffline, isTaken, OFFLINE } from "./fxRuntime";
import { Ic } from "./icons";
import { nicknameCheck, shirtFitLabel, typeNickname, type ShirtCheck } from "./rules";

export interface ShirtField {
  state: "vinculada" | "pendiente" | "sin-ficha";
  /** What the field holds (uppercase as typed). */
  draft: string;
  check: ShirtCheck;
  /** A server error after «Estampar» / «Deshacer» (shown instead of the check). */
  error: string | null;
  busy: boolean;
  num: string;
  claimNum: string;
  undoOn: boolean;
  undoBusy: boolean;
  onInput: (e: ChangeEvent<HTMLInputElement>) => void;
  onStamp: () => void;
  onUndo: () => void;
  onGoFicha: () => void;
  onGoPick: () => void;
}

export interface NickField {
  current: string;
  lookup: (nick: string) => Promise<boolean>;
  save: (nick: string) => Promise<string>;
  onSaved: (nick: string) => void;
}

function MsgIcon({ tone }: { tone: "ok" | "bad" | "same" }) {
  return tone === "ok" ? <Ic n="check" w={15} /> : tone === "bad" ? <Ic n="alert" w={15} /> : null;
}

function Espalda({ f }: { f: ShirtField }) {
  const vinc = f.state === "vinculada";
  const len = f.check.length;
  const tone = f.error ? "bad" : f.check.tone;
  const msg = f.error ?? f.check.message;
  const fit = vinc ? shirtFitLabel(len) : "Bloqueado";
  const shown = vinc ? f.check.value.slice(0, 16) : "";
  const num = vinc ? f.num : f.claimNum || "?";
  const cant = f.check.tone !== "ok" || f.busy;
  const aria = vinc ? `Vista previa de tu espalda: ${f.check.value || "sin nombre"} encima del dorsal ${num}. ${fit}.` : `Espalda sin nombre todavía${f.claimNum ? ", dorsal " + f.claimNum : ""}.`;
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !cant) {
      e.preventDefault();
      f.onStamp();
    }
  };
  return (
    <div className="es">
      <div className={"es-prev " + (vinc ? tone : "locked")} role="img" aria-label={aria}>
        <span className="es-glow" aria-hidden="true" />
        <Tee name={shown} num={num} blank={!vinc} over={len > 12} />
        <span className="es-fit" aria-hidden="true">
          <i />
          <small>{fit}</small>
          <i />
        </span>
      </div>
      <div className="es-f">
        {vinc && (
          <>
            <label className="lbl" htmlFor="pe-shirt">
              Lo que va a tu espalda
            </label>
            <div className={"es-in " + tone}>
              <input
                id="pe-shirt"
                type="text"
                value={f.draft}
                onChange={f.onInput}
                onKeyDown={onKey}
                maxLength={16}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby="pe-shirt-v pe-shirt-h"
                aria-invalid={tone === "bad"}
              />
              <span className="es-ct" aria-hidden="true">
                {len}/12
              </span>
            </div>
            <p className={"vmsg " + tone} id="pe-shirt-v" aria-live="polite">
              {tone === "same" ? <Ic n="shirt" w={15} /> : <MsgIcon tone={tone} />}
              <span>{msg}</span>
              <span className="sr"> · {len}/12 caracteres</span>
            </p>
            <p className="rules" id="pe-shirt-h">
              De 2 a 12 caracteres: letras (con tilde o ñ), espacios, punto, guion o apóstrofo. Sin números: el dorsal ya va debajo. Dos camisetas del equipo no pueden llevar el mismo nombre.
            </p>
            <div className="row es-act">
              <button type="button" className="btn gold" disabled={cant} aria-busy={f.busy || undefined} onClick={f.onStamp}>
                <Ic n="press" w={18} />
                {f.busy ? "Estampando…" : "Estampar"}
              </button>
              {f.undoOn && (
                <button type="button" className="btn" disabled={f.undoBusy} onClick={f.onUndo}>
                  <Ic n="undo" w={16} />
                  Deshacer
                </button>
              )}
            </div>
            <p className="help">
              <Ic n="info" w={15} />
              <span>Lo ve todo el club: la plantilla, los cromos de la pizarra y tu página.</span>
            </p>
          </>
        )}
        {!vinc && (
          <>
            <label className="lbl" htmlFor="pe-shirt-off">
              Lo que va a tu espalda
            </label>
            <input className="es-off" id="pe-shirt-off" type="text" value="" placeholder="Bloqueado" disabled aria-describedby="pe-shirt-lk" readOnly />
            {f.state === "pendiente" ? (
              <>
                <p className="note warn" id="pe-shirt-lk">
                  <Ic n="lock" w={18} />
                  <span>
                    <b>En cuanto el capitán acepte</b> tu ficha del {f.claimNum}, eliges lo que va en tu espalda.
                  </span>
                </p>
                <button type="button" className="btn" onClick={f.onGoFicha}>
                  <Ic n="shirt" w={17} />
                  Ver mi petición
                </button>
              </>
            ) : (
              <>
                <p className="note" id="pe-shirt-lk">
                  <Ic n="lock" w={18} />
                  <span>
                    <b>Cuando tengas ficha</b> podrás elegir lo que va en tu espalda.
                  </span>
                </p>
                <button type="button" className="btn gold" onClick={f.onGoPick}>
                  <Ic n="shirt" w={17} />
                  Reclamar mi ficha
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const FIX = "Sin mayúsculas, tildes ni espacios: los quitamos al escribir (ñ pasa a n).";

function Apodo({ f }: { f: NickField }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [fix, setFix] = useState(false);
  const [taken, setTaken] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  const value = draft ?? f.current;
  const base = nicknameCheck(value, f.current);
  // Only a handle that passes the rules is looked up (it is a document id), 400 ms after you stop typing.
  const ask = base.state === "ok" && taken[value] === undefined;
  const { lookup } = f;
  useEffect(() => {
    if (!ask) return;
    let live = true;
    const t = window.setTimeout(() => {
      lookup(value)
        .then((v) => live && setTaken((m) => ({ ...m, [value]: v })))
        // can't tell: let it be tried (the server checks it again)
        .catch(() => live && setTaken((m) => ({ ...m, [value]: false })));
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [ask, value, lookup]);
  const check = nicknameCheck(value, f.current, taken[value] ?? (ask ? "checking" : undefined));
  const tone = error ? "bad" : check.tone;
  const msg = error ?? check.message;
  const cant = check.state !== "ok" || busy;
  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    const t = e.target;
    const typed = typeNickname(t.value, t.selectionStart ?? t.value.length);
    if (t.value !== typed.value) {
      t.value = typed.value;
      try {
        t.setSelectionRange(typed.caret, typed.caret);
      } catch {
        /* not a text input any more */
      }
    }
    setDraft(typed.value);
    setFix(typed.stripped);
    setError(null);
  };
  const save = async () => {
    if (cant || sending.current) return;
    if (isOffline()) {
      setError(OFFLINE);
      return;
    }
    sending.current = true;
    const nick = value;
    setBusy(true);
    setError(null);
    try {
      const saved = await f.save(nick);
      f.onSaved(saved);
      setDraft(null);
      setFix(false);
    } catch (e) {
      if (isTaken(e)) setTaken((m) => ({ ...m, [nick]: true }));
      else setError(errorMessage(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <label className="lbl" htmlFor="pe-nick">
        Apodo del vestuario
      </label>
      <div className="nick-f">
        <span className={"nick-in " + tone}>
          <span className="at-p" aria-hidden="true">
            @
          </span>
          <input
            id="pe-nick"
            type="text"
            value={value}
            onChange={onInput}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !cant) {
                e.preventDefault();
                void save();
              }
            }}
            maxLength={16}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby="pe-nick-v pe-nick-h"
            aria-invalid={tone === "bad"}
          />
          <span className="es-ct" aria-hidden="true">
            {check.length}/15
          </span>
        </span>
        <button type="button" className="btn gold" disabled={cant} aria-busy={busy || undefined} onClick={() => void save()}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>
      <p className={"vmsg " + tone} id="pe-nick-v" aria-live="polite">
        {tone === "same" ? check.state === "checking" ? <Ic n="clock" w={15} /> : <Ic n="at" w={15} /> : <MsgIcon tone={tone} />}
        <span>{msg}</span>
        <span className="sr"> · {check.length}/15 caracteres</span>
      </p>
      {fix && (
        <p className="vfix">
          <Ic n="info" w={14} />
          <span>{FIX}</span>
        </p>
      )}
      <p className="rules" id="pe-nick-h">
        De 3 a 15 caracteres: letras sin tilde (a–z), números y guion bajo. Las mayúsculas, tildes y espacios se quitan solos. Dos socios no pueden tener el mismo apodo.
      </p>
    </>
  );
}

export function Nombre({ shirt, nick }: { shirt: ShirtField; nick: NickField }) {
  return (
    <div className="bk nmb" id="pe-nombre">
      <h3 className="bk-h">
        Tu nombre <span className="nv">nuevo</span>
      </h3>
      <p className="bk-d">Dos nombres distintos: el que llevas a la espalda y el que usas en el vestuario.</p>
      <div className="nr" role="group" aria-labelledby="pe-es-t">
        <div className="nr-h">
          <span className="nr-k" aria-hidden="true">
            A
          </span>
          <span className="nr-tt">
            <b id="pe-es-t">En la espalda</b>
            <small>El nombre impreso en tu camiseta, encima del dorsal.</small>
          </span>
        </div>
        <Espalda f={shirt} />
      </div>
      <div className="nr" role="group" aria-labelledby="pe-ap-t">
        <div className="nr-h">
          <span className="nr-k" aria-hidden="true">
            B
          </span>
          <span className="nr-tt">
            <b id="pe-ap-t">Tu apodo</b>
            <small>Así te ven en convocatorias, porra y la pizarra.</small>
          </span>
        </div>
        <Apodo f={nick} />
      </div>
    </div>
  );
}
