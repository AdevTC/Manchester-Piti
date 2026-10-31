// Ajustes › Tu nombre (TuCarta ajNombre; today's screens/Nombre): «En la espalda» — his printed shirt, and as he
// types the new name printed on the blank shirt (the card's too, through card.setTyped) with its fit, Primera or
// Segunda, «Estampar» and «Deshacer» for 6 s in the toast — and «Tu apodo del vestuario», checked 400 ms after he
// stops. A new account's back is locked until the captain accepts his ficha; a socio only has his apodo.
// Each form has its own busy flag (bug 9), the inputs stop at the rule (12 / 15: bug 11), the check's words end
// with one stop (bug 8) and a server refusal says why (bug 10).
import { useEffect, useRef, useState } from "react";
import { apiError } from "../../../../../lib/clubApi";
import { NICK_MAX, normalizeShirtName, nicknameCheck, SHIRT_COPY, SHIRT_MAX, shirtNameCheck, typeNickname, typeShirtName } from "../../../rules";
import { Seg } from "../../../../../components/vidrio/tu/ui";
import { Shirt, Tee } from "../../TuCard";
import { wantedNumber } from "../../view";
import { endSentence, fitOf } from "../ajustesView";
import type { PlaceProps } from "../types";

/** A refusal's reason (the server's words: «Ya la lleva el 9 (ERIK): elige otro»), else the fallback. */
const why = (e: unknown, fallback: string): string => {
  const x = e as { code?: unknown; message?: unknown } | null;
  return x && (typeof x.code === "string" || typeof x.message === "string") ? endSentence(apiError(e)) : fallback;
};

export function Nombre(p: PlaceProps) {
  const { data, who, say } = p;
  const linked = who.kind === "jugador";
  const current = data.shirt.current.toUpperCase();
  const num = data.card.number || data.shirt.number;
  const { setTyped } = p.card;
  useEffect(() => () => setTyped(null), [setTyped]);

  // ── the back
  const [draft, setDraft] = useState<string | null>(null);
  const [kit, setKit] = useState<"home" | "away">("home");
  const [stamping, setStamping] = useState(false);
  const undoing = useRef(false);
  const value = draft ?? current;
  const check = shirtNameCheck(value, current, data.shirt.squad, data.ficha.playerId);
  const len = normalizeShirtName(value).length;
  const showTyped = linked && draft !== null && normalizeShirtName(draft) !== normalizeShirtName(current);
  const printed = normalizeShirtName(value).slice(0, SHIRT_MAX + 4);
  const fit = fitOf(len, linked);
  const cantStamp = check.tone !== "ok" || stamping;

  const stamp = async () => {
    if (cantStamp) return;
    setStamping(true);
    try {
      const r = await p.actions.setShirtName(check.value);
      const prev = r.previous || current;
      setDraft(null);
      setTyped(null);
      say("Estampado: así sale ya en tu ficha.", () => {
        if (undoing.current) return;
        undoing.current = true;
        p.actions
          .setShirtName(prev)
          .then(
            () => say(`Deshecho: vuelve «${normalizeShirtName(prev)}» a tu espalda.`),
            (e: unknown) => say(why(e, "No se ha podido deshacer. Inténtalo otra vez.")),
          )
          .finally(() => (undoing.current = false));
      });
    } catch (e) {
      say(why(e, "No se ha podido estampar. Inténtalo otra vez."));
    } finally {
      setStamping(false);
    }
  };

  // ── the apodo
  const [nick, setNick] = useState<string | null>(null);
  const [fixed, setFixed] = useState(false);
  const [saving, setSaving] = useState(false);
  // (the answer for the draft it was asked about: any other draft is still «Comprobando…»)
  const [checked, setChecked] = useState<{ nick: string; taken: boolean | undefined } | null>(null);
  const nv = nick ?? data.nickname;
  const taken: boolean | "checking" | undefined = checked && checked.nick === nick ? checked.taken : "checking";
  const { nicknameTaken } = p.actions;
  useEffect(() => {
    if (nick === null || nick === data.nickname) return;
    let live = true;
    const t = window.setTimeout(() => {
      nicknameTaken(nick)
        .then((x) => live && setChecked({ nick, taken: x }))
        .catch(() => live && setChecked({ nick, taken: undefined }));
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [nick, data.nickname, nicknameTaken]);
  const ncheck = nicknameCheck(nv, data.nickname, nick === null ? undefined : taken);
  const cantNick = ncheck.tone !== "ok" || saving;
  const saveNick = async () => {
    if (cantNick) return;
    setSaving(true);
    try {
      const saved = await p.actions.setNickname(nv);
      setNick(null);
      setFixed(false);
      say(`Guardado: ahora eres @${saved}.`);
    } catch (e) {
      say(why(e, "No se ha podido guardar el apodo. Inténtalo otra vez."));
    } finally {
      setSaving(false);
    }
  };

  const pack = data.ficha.state === "pendiente";
  const wanted = wantedNumber(data);
  const toTu = () => p.go({ page: "perfil", sec: "tu", aj: null, open: null });
  return (
    <>
      {who.kind !== "socio" && (
        <section className="tc-ajrow" aria-labelledby="tc-aj-shirt">
          <h3 id="tc-aj-shirt">En la espalda</h3>
          <div className="tc-shirtform">
            <div className="tc-back3">
              <div className="tc-back3__pv" role="img" aria-label={linked ? `Vista previa de tu espalda: ${printed || "sin nombre"} encima del dorsal ${num}. ${fit.t}.` : "Espalda sin nombre todavía."}>
                {linked && !showTyped && <Shirt num={num} kit={kit} className="tc-back3__img" />}
                {showTyped && <Tee name={printed} num={num} kit={kit} className={`tc-back3__img${len > SHIRT_MAX ? " is-over" : ""}`} />}
                {!linked && <Shirt kit="home" className="tc-back3__img" ghost />}
              </div>
              {linked && (
                <Seg
                  cls="nx-seg tc-kitseg"
                  label="Equipación de la vista previa"
                  value={kit}
                  onPick={setKit}
                  opts={[
                    { v: "home", t: "Primera" },
                    { v: "away", t: "Segunda" },
                  ]}
                />
              )}
            </div>
            <div className="tk-form">
              {linked ? (
                <>
                  <label className="tk-lab" htmlFor="tc-shirt">
                    Lo que va a tu espalda <small aria-hidden="true">{`${len}/${SHIRT_MAX}`}</small>
                  </label>
                  <div className="tc-inrow">
                    <input
                      className={`tk-in is-${check.tone}`}
                      id="tc-shirt"
                      type="text"
                      value={value}
                      maxLength={SHIRT_MAX}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      aria-invalid={check.tone === "bad" || undefined}
                      aria-describedby="tc-shirt-v tc-shirt-h"
                      onChange={(e) => {
                        const t = typeShirtName(e.target.value, e.target.selectionStart ?? e.target.value.length);
                        setDraft(t.value);
                        setTyped(normalizeShirtName(t.value) !== normalizeShirtName(current) ? normalizeShirtName(t.value) : null);
                        const el = e.target;
                        requestAnimationFrame(() => el.setSelectionRange(t.caret, t.caret));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void stamp();
                        }
                      }}
                    />
                    <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" aria-disabled={cantStamp || undefined} onClick={() => void stamp()}>
                      {stamping ? "Estampando…" : "Estampar"}
                    </button>
                  </div>
                  <p className="nx-meta tc-vmsg" id="tc-shirt-v" aria-live="polite">
                    <span className={`tk-st is-${fit.tone}`}>{fit.t}</span> <span className={`tc-vmsg__t is-${check.tone}`}>{endSentence(check.message)}</span>
                  </p>
                  <p className="nx-meta" id="tc-shirt-h">
                    De 2 a 12: letras (con tilde o ñ), espacios, punto, guion o apóstrofo. Sin números: el dorsal ya va debajo. Dos camisetas no pueden llevar el mismo nombre.
                  </p>
                </>
              ) : (
                <>
                  <label className="tk-lab" htmlFor="tc-shirt-off">
                    Lo que va a tu espalda
                  </label>
                  <input className="tk-in" id="tc-shirt-off" type="text" value="" placeholder="Bloqueado" disabled aria-describedby="tc-shirt-lk" />
                  <p className="nx-meta" id="tc-shirt-lk">
                    <span className="tk-st is-off">{fit.t}</span> {pack && wanted ? `En cuanto el capitán acepte tu ficha del ${wanted}, eliges lo que va en tu espalda.` : SHIRT_COPY.notLinked}
                  </p>
                  <button type="button" className="nx-lnk tc-self" onClick={toTu}>
                    {pack ? "Ver mi petición" : "Elegir mi dorsal"}
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}
      <section className="tc-ajrow" aria-labelledby="tc-aj-nick">
        <h3 id="tc-aj-nick">Tu apodo del vestuario</h3>
        <label className="tk-lab" htmlFor="tc-nick">
          Apodo <small aria-hidden="true">{`${nv.length}/${NICK_MAX}`}</small>
        </label>
        <div className="tc-inrow">
          <span className="tc-at">
            <span aria-hidden="true">@</span>
            <input
              className={`tk-in is-${ncheck.tone}`}
              id="tc-nick"
              type="text"
              value={nv}
              maxLength={NICK_MAX}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={ncheck.tone === "bad" || undefined}
              aria-describedby="tc-nick-v tc-nick-h"
              onChange={(e) => {
                const t = typeNickname(e.target.value, e.target.selectionStart ?? e.target.value.length);
                setNick(t.value);
                setFixed(t.stripped);
                const el = e.target;
                requestAnimationFrame(() => el.setSelectionRange(t.caret, t.caret));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveNick();
                }
              }}
            />
          </span>
          <button type="button" className="vd-glass vd-press nx-btn" aria-disabled={cantNick || undefined} onClick={() => void saveNick()}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
        <p className={`nx-meta tc-vmsg__t is-${ncheck.tone}`} id="tc-nick-v" aria-live="polite">
          {endSentence(ncheck.message)}
        </p>
        {fixed && <p>Sin mayúsculas, tildes ni espacios: los quitamos al escribir (ñ pasa a n).</p>}
        <p id="tc-nick-h">Así te ven en convocatorias, porra y la pizarra. De 3 a 15: letras sin tilde, números y guion bajo.</p>
      </section>
    </>
  );
}
