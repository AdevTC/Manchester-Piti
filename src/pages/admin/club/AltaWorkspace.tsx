// «Alta de jugador» in the ficha's place: the empty shirt is stamped as the name and the dorsal are typed, the
// season's free dorsales are one tap away, the line is chosen up front (Medio by default) and the seasons come
// set to the active one. «Dar de alta» (gold: the one action here) is off until the shirt name (2–12 letters)
// and a free dorsal are there; photo, birth, height and weight come later in his ficha. Leaving with something
// typed asks first.
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { PlayerDoc, SeasonDoc } from "../../../lib/schemas";
import { ShirtBack } from "../kit";
import { useUnsavedGuard } from "../ui/guard";
import { AdIcon } from "../ui/icons";
import { POSITIONS, checkPlayerForm, dorsalLine, emptyForm, formDirty, shirtNameError, type PlayerForm } from "./plantillaLogic";

export interface AltaWorkspaceProps {
  players: readonly PlayerDoc[];
  seasons: readonly SeasonDoc[];
  activeSeason: SeasonDoc | null;
  /** The season's free dorsales (the first few are offered as chips). */
  free: readonly number[];
  initialNumber: number | null;
  phone: boolean;
  onCancel: () => void;
  onAlta: (form: PlayerForm) => void;
}

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
const FREE_CHIPS = 10;

export function AltaWorkspace({ players, seasons, activeSeason, free, initialNumber, phone, onCancel, onAlta }: AltaWorkspaceProps) {
  const uid = useId();
  const activeId = activeSeason?.id;
  const [start] = useState<PlayerForm>(() => ({ ...emptyForm(activeId && !activeSeason?.archived ? [activeId] : []), number: initialNumber ? String(initialNumber) : "" }));
  const [form, setForm] = useState<PlayerForm>(start);
  const leaving = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  // desktop: straight to the name (on phones the keyboard would cover the shirt)
  useEffect(() => {
    if (!phone) nameRef.current?.focus();
  }, [phone]);
  const dirty = formDirty(form, start);
  const guard = useUnsavedGuard(dirty, { what: "el alta del jugador", shouldBlock: () => !leaving.current });
  const check = checkPlayerForm(form, { players, seasons, editingId: null, start: null });
  const set = <K extends keyof PlayerForm>(k: K, v: PlayerForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const nameErr = shirtNameError(form.shirtName, true);
  const dorsal = dorsalLine(check, form, null);
  const shirt = form.shirtName.trim() ? form.shirtName.toLocaleUpperCase("es") : "NOMBRE";
  const num = form.number.trim();
  const empty = !form.shirtName.trim() && !num;
  const off = !check.ok;
  const go = () => {
    if (off) return;
    leaving.current = true;
    onAlta(form);
  };
  const kitStyle: CSSProperties = { viewTransitionName: "pl-alta" };

  return (
    <section className={phone ? "pl3f alta m" : "pl3f alta"} aria-label="Alta de jugador">
      {phone ? (
        <div className="mback">
          <button type="button" className="ib2" onClick={() => guard.run(onCancel)} aria-label="Volver a la plantilla">
            <AdIcon name="back" size={18} />
          </button>
          <b>Alta de jugador</b>
        </div>
      ) : null}
      <div className="hero">
        <span className="kit" style={kitStyle} aria-hidden="true">
          <ShirtBack num={num || "?"} name={shirt} size={phone ? 100 : 160} big state={empty ? "empty" : ""} />
        </span>
        <div className="hi">
          <p className="k2">
            <span>Camiseta nueva</span>
          </p>
          <h2 className="who">
            <b>{num || "?"}</b>
            {shirt}
          </h2>
          <p className="full">La camiseta se estampa mientras escribes</p>
          <div className="altf">
            <div className="fld">
              <label htmlFor={`${uid}-n`}>Nombre en la camiseta · {form.shirtName.length}/12</label>
              <input
                ref={nameRef}
                className={nameErr ? "inp bad" : "inp"}
                id={`${uid}-n`}
                value={form.shirtName}
                onChange={(e) => set("shirtName", e.target.value.toLocaleUpperCase("es").slice(0, 12))}
                onKeyDown={(e) => e.key === "Enter" && go()}
                placeholder="PABLO"
                maxLength={12}
                autoComplete="off"
                aria-invalid={!!nameErr || undefined}
              />
              {nameErr ? (
                <span className="er">
                  <AdIcon name="x" size={13} />
                  {nameErr}
                </span>
              ) : null}
            </div>
            <div className="fld">
              <label htmlFor={`${uid}-d`}>{activeSeason ? `Dorsal en la ${activeSeason.name}` : "Dorsal"}</label>
              <input
                className={dorsal.tone === "bad" ? "inp bad" : "inp"}
                id={`${uid}-d`}
                value={form.number}
                onChange={(e) => set("number", digits(e.target.value, 2))}
                onKeyDown={(e) => e.key === "Enter" && go()}
                inputMode="numeric"
                maxLength={2}
                placeholder="1–99"
                autoComplete="off"
                aria-invalid={dorsal.tone === "bad" || undefined}
                aria-describedby={`${uid}-dl`}
              />
              {dorsal.tone === "mut" ? null : (
                <span className={dorsal.tone === "ok" ? "ok" : "er"} id={`${uid}-dl`}>
                  <AdIcon name={dorsal.tone === "ok" ? "check" : "x"} size={13} />
                  {dorsal.text}
                </span>
              )}
              <span className="fr2" role="group" aria-label="Dorsales libres">
                Libres:
                {free.slice(0, FREE_CHIPS).map((n) => (
                  <button key={n} type="button" className="frd" aria-pressed={form.number === String(n)} onClick={() => set("number", String(n))} aria-label={`Dorsal ${n}`}>
                    {n}
                  </button>
                ))}
              </span>
            </div>
            <div className="fld wide">
              <span className="lb" id={`${uid}-p`}>
                Línea
              </span>
              <span className="pz" role="group" aria-labelledby={`${uid}-p`}>
                {POSITIONS.map((p) => (
                  <button key={p} type="button" aria-pressed={form.position === p} onClick={() => set("position", p)}>
                    {p}
                  </button>
                ))}
              </span>
            </div>
            <div className="fld wide">
              <span className="lb" id={`${uid}-s`}>
                Temporadas
              </span>
              <div className="tgl" role="group" aria-labelledby={`${uid}-s`}>
                {seasons.map((s) => (
                  <button key={s.id} type="button" aria-pressed={form.seasons.includes(s.id)} onClick={() => set("seasons", form.seasons.includes(s.id) ? form.seasons.filter((x) => x !== s.id) : [...form.seasons, s.id])}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="altb">
        <button type="button" className="btn line" onClick={() => guard.run(onCancel)}>
          Cancelar
        </button>
        <button type="button" className="btn gold" onClick={go} disabled={off}>
          <AdIcon name="plus" size={16} />
          Dar de alta
        </button>
        <span className="hint">Foto, nacimiento, altura y peso, después en su ficha</span>
      </div>
    </section>
  );
}
