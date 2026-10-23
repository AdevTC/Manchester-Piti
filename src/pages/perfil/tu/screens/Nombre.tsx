// /perfil/nombre (TU boards isNombre): «En la espalda» — his printed shirt; as he types, the new name is printed in
// Barlow on the blank shirt like the real one, with its fit (holgado, justo, al límite, no cabe), the first or the
// second kit, «Estampar» and «Deshacer» for 6 s — and «Tu apodo» with its check (free or taken, 400 ms after he
// stops). A new account's back is locked until the captain accepts his ficha; a socio only has his apodo.
import { useEffect, useRef, useState } from "react";
import { normalizeShirtName, nicknameCheck, shirtNameCheck, SHIRT_UNDO_MS, typeNickname, typeShirtName } from "../../rules";
import { Seg } from "../../../../components/vidrio/tu/ui";
import { fitWord, secDesc, secLabel } from "../model";
import type { ScreenProps } from "../MiPagina";
import { wantedNumber } from "../view";
import { Shirt, Tee } from "../TuCard";
import { Screen } from "./Head";

const UNDO_MS = Math.min(SHIRT_UNDO_MS, 6000);

export function Nombre(p: ScreenProps) {
  const { data, who, say } = p;
  const linked = who.kind === "jugador";
  const current = data.shirt.current.toUpperCase();
  const num = data.card.number || data.shirt.number;
  const [draft, setDraft] = useState<string | null>(null);
  const [kit, setKit] = useState<"home" | "away">("home");
  const [undo, setUndo] = useState<{ prev: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const undoTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(undoTimer.current), []);
  const { setTyped } = p;
  useEffect(() => () => setTyped(null), [setTyped]);

  const value = draft ?? current;
  const check = shirtNameCheck(value, current, data.shirt.squad, data.ficha.playerId);
  const len = normalizeShirtName(value).length;
  const showTyped = linked && draft !== null && normalizeShirtName(draft) !== normalizeShirtName(current);
  const printed = normalizeShirtName(value).slice(0, 16);

  const stamp = async () => {
    if (check.tone !== "ok" || busy) return;
    setBusy(true);
    try {
      const r = await p.actions.setShirtName(check.value);
      window.clearTimeout(undoTimer.current);
      setUndo({ prev: r.previous || current, name: r.shirtName });
      undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
      setDraft(null);
      setTyped(null);
      say("Estampado: así sale ya en tu ficha.");
    } catch {
      say("No se ha podido estampar. Inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  };
  const unstamp = async () => {
    if (!undo) return;
    window.clearTimeout(undoTimer.current);
    const prev = undo.prev;
    setUndo(null);
    try {
      await p.actions.setShirtName(prev);
      say(`Deshecho: vuelve «${prev}» a tu espalda.`);
    } catch {
      say("No se ha podido deshacer. Inténtalo otra vez.");
    }
  };

  // ── the apodo
  const [nick, setNick] = useState<string | null>(null);
  const [fixed, setFixed] = useState(false);
  // (the answer for the draft it was asked about: any other draft is still «Comprobando…»)
  const [checked, setChecked] = useState<{ nick: string; taken: boolean | undefined } | null>(null);
  const nv = nick ?? data.nickname;
  const taken: boolean | "checking" | undefined = checked && checked.nick === nick ? checked.taken : "checking";
  useEffect(() => {
    if (nick === null || nick === data.nickname) return;
    let live = true;
    const t = window.setTimeout(() => {
      p.actions
        .nicknameTaken(nick)
        .then((x) => live && setChecked({ nick, taken: x }))
        .catch(() => live && setChecked({ nick, taken: undefined }));
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
    // (only a new draft asks)
  }, [nick]); // eslint-disable-line react-hooks/exhaustive-deps
  const ncheck = nicknameCheck(nv, data.nickname, nick === null ? undefined : taken);
  const saveNick = async () => {
    if (ncheck.tone !== "ok" || busy) return;
    setBusy(true);
    try {
      const saved = await p.actions.setNickname(nv);
      setNick(null);
      setFixed(false);
      say(`Guardado: ahora eres @${saved}.`);
    } catch {
      say("No se ha podido guardar el apodo. Inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  };

  const pack = data.ficha.state === "pendiente";
  const fit = linked ? (len ? fitWord(len) : "Sin nombre") : "Bloqueado";
  return (
    <Screen title={secLabel("nombre", who.kind)} desc={secDesc("nombre", who.kind, pack)}>
      <div className="tu-cols tu-cols--name">
        {who.kind !== "socio" && (
          <section className="tu-blk tu-blk--flat tu-back" aria-labelledby="tu-es-t">
            <h3 className="tu-h3" id="tu-es-t">
              En la espalda
            </h3>
            <div className="tu-back__pv" role="img" aria-label={linked ? `Vista previa de tu espalda: ${printed || "sin nombre"} encima del dorsal ${num}. ${fit}.` : "Espalda sin nombre todavía."}>
              {linked && !showTyped && <Shirt num={num} kit={kit} className="tu-back__img" />}
              {showTyped && <Tee name={printed} num={num} kit={kit} className={`tu-back__img${len > 12 ? " is-over" : ""}`} />}
              {!linked && <Shirt kit="home" className="tu-back__img" ghost />}
              <span className="tu-back__fit">{fit}</span>
            </div>
            {linked && (
              <Seg
                cls="tu-kitseg"
                label="Equipación de la vista previa"
                value={kit}
                onPick={setKit}
                opts={[
                  { v: "home", t: "Primera" },
                  { v: "away", t: "Segunda" },
                ]}
              />
            )}
          </section>
        )}
        <section className="tu-blk tu-blk--flat" aria-labelledby="tu-form-t">
          <h3 className="tu-h3 vd-vh" id="tu-form-t">
            Cambiar tus nombres
          </h3>
          {linked && (
            <>
              <label className="tu-label" htmlFor="tu-shirt">
                Lo que va a tu espalda
              </label>
              <div className="tu-nickrow">
                <div className={`vd-glass tu-field is-${check.tone}`}>
                  <input
                    id="tu-shirt"
                    type="text"
                    value={value}
                    maxLength={16}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    aria-describedby="tu-shirt-v tu-shirt-h"
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
                  <span className="tu-field__ct" aria-hidden="true">
                    {len}/12
                  </span>
                </div>
                <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" aria-disabled={check.tone !== "ok" || busy} onClick={() => void stamp()}>
                  Estampar
                </button>
              </div>
              <p className={`tu-vmsg is-${check.tone}`} id="tu-shirt-v" aria-live="polite">
                {check.message}.
              </p>
              {undo && (
                <p className="tu-undo" role="status">
                  <span>
                    Estampado <b>{undo.name}</b>.
                  </span>
                  <button type="button" className="vd-link" onClick={() => void unstamp()}>
                    Deshacer
                  </button>
                  <span className="tu-undo__bar" aria-hidden="true">
                    <i />
                  </span>
                </p>
              )}
              <p className="tu-small" id="tu-shirt-h">
                De 2 a 12: letras (con tilde o ñ), espacios, punto, guion o apóstrofo. Sin números: el dorsal ya va debajo. Dos camisetas no pueden llevar el mismo nombre.
              </p>
            </>
          )}
          {who.kind === "nuevo" && (
            <>
              <label className="tu-label" htmlFor="tu-shirt-off">
                Lo que va a tu espalda
              </label>
              <div className="tu-field is-off">
                <input id="tu-shirt-off" type="text" value="" placeholder="Bloqueado" disabled aria-describedby="tu-shirt-lk" />
              </div>
              <p className="tu-blk__d" id="tu-shirt-lk">
                {pack ? `En cuanto el capitán acepte tu ficha del ${wantedNumber(data)}, eliges lo que va en tu espalda.` : "Cuando tengas ficha podrás elegir lo que va en tu espalda."}{" "}
                <button type="button" className="vd-link" onClick={() => p.go({ page: "perfil", sec: "carta", open: null })}>
                  {pack ? "Ver mi petición" : "Elegir mi dorsal"}
                </button>
              </p>
            </>
          )}
          {who.kind !== "socio" && <div className="tu-sep" />}
          <label className="tu-label" htmlFor="tu-nick">
            Tu apodo del vestuario
          </label>
          <div className="tu-nickrow">
            <div className={`vd-glass tu-field tu-field--at is-${ncheck.tone}`}>
              <span aria-hidden="true">@</span>
              <input
                id="tu-nick"
                type="text"
                value={nv}
                maxLength={16}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby="tu-nick-v tu-nick-h"
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
              <span className="tu-field__ct" aria-hidden="true">
                {nv.length}/15
              </span>
            </div>
            <button type="button" className="vd-glass vd-press vd-btn" aria-disabled={ncheck.tone !== "ok" || busy} onClick={() => void saveNick()}>
              Guardar
            </button>
          </div>
          <p className={`tu-vmsg is-${ncheck.tone}`} id="tu-nick-v" aria-live="polite">
            {ncheck.message}.
          </p>
          {fixed && <p className="tu-small">Sin mayúsculas, tildes ni espacios: los quitamos al escribir (ñ pasa a n).</p>}
          <p className="tu-small" id="tu-nick-h">
            Así te ven en convocatorias, porra y la pizarra. De 3 a 15: letras sin tilde, números y guion bajo.
          </p>
        </section>
      </div>
    </Screen>
  );
}
