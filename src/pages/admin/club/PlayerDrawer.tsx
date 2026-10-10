// The player drawer (Plantilla): a 480 px panel from the right (a bottom sheet on phones) to edit a
// player or to sign one up («Alta de jugador», the same drawer empty). Photo (or the big dorsal), name,
// surnames, shirt name (2–12, counter), dorsal with its live uniqueness check per season, position,
// Activo / Lesionado, the seasons they play (with a per-season shirt name / dorsal, as the old form kept
// them), birth date, height, weight. Footer: Dar de baja (confirm) · Cancelar · Guardar / Dar de alta
// (aria-disabled while there are errors or no changes; pressing it says why). «● Cambios sin guardar»
// and the unsaved-changes guard on every way out (X, Esc, scrim, Cancelar, navigation).
import { useId, useMemo, useRef, useState } from "react";
import type { PlayerDoc, SeasonDoc } from "../../../lib/schemas";
import { ConfirmModal, Drawer, type Consequence } from "../ui/layersV1";
import { FieldCheck, Segmented, TextField, Toggles } from "../ui/controls";
import { AdIcon } from "../ui/icons";
import { useUnsavedGuard } from "../ui/guard";
import {
  POS_LABEL,
  POSITIONS,
  checkPlayerForm,
  emptyForm,
  formDirty,
  formFromPlayer,
  linkState,
  nameIn,
  numberIn,
  seasonCode,
  seasonLabel,
  type PlayerForm,
  type Position,
} from "./plantillaLogic";

export interface PlayerDrawerProps {
  /** The player to edit; null = «Alta de jugador». */
  player: PlayerDoc | null;
  /** The players as shown (pending changes applied): the dorsal check runs against them. */
  players: readonly PlayerDoc[];
  seasons: readonly SeasonDoc[];
  /** The season the admin is about (the alta's default season; the kicker's dorsal). */
  activeSeason: SeasonDoc | null;
  /** The account linked to this player, for the baja's consequences («@kevin11»). */
  linkedTo?: string;
  onClose: () => void;
  onSave: (form: PlayerForm) => void;
  onBaja: () => void;
}

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

export function PlayerDrawer({ player, players, seasons, activeSeason, linkedTo, onClose, onSave, onBaja }: PlayerDrawerProps) {
  const isNew = !player;
  const activeId = activeSeason?.id;
  const [start] = useState<PlayerForm>(() => (player ? formFromPlayer(player) : emptyForm(activeId && !activeSeason?.archived ? [activeId] : [])));
  const [form, setForm] = useState<PlayerForm>(start);
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(false);
  const leaving = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const posId = useId();
  const estId = useId();
  const ssId = useId();
  const camId = useId();
  const numId = useId();
  const photoId = useId();
  const lblId = useId();

  const dirty = formDirty(form, start);
  const check = useMemo(() => checkPlayerForm(form, { players, seasons, editingId: player?.id ?? null, start: isNew ? null : start }), [form, players, seasons, player, isNew, start]);
  const shownName = player ? nameIn(player, player.seasons?.includes(activeId ?? "") ? activeId : undefined) : "";
  const shownNum = player ? numberIn(player, player.seasons?.includes(activeId ?? "") ? activeId : undefined) : null;
  const guard = useUnsavedGuard(dirty, { what: isNew ? "el alta del jugador" : `la ficha de ${shownName}`, shouldBlock: () => !leaving.current });

  const set = <K extends keyof PlayerForm>(k: K, v: PlayerForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  };
  const setOverride = (sid: string, k: "shirtName" | "number", v: string) => {
    setForm((f) => ({ ...f, overrides: { ...f.overrides, [sid]: { shirtName: f.overrides[sid]?.shirtName ?? "", number: f.overrides[sid]?.number ?? "", [k]: v } } }));
    setError("");
  };
  const toggleSeason = (sid: string) => setForm((f) => ({ ...f, seasons: f.seasons.includes(sid) ? f.seasons.filter((x) => x !== sid) : [...f.seasons, sid] }));

  const close = () => guard.run(onClose);
  const saveDisabled = !check.ok || (!dirty && !isNew);
  const save = () => {
    if (!check.ok) {
      setError(check.errors[0]);
      return;
    }
    if (!dirty && !isNew) return;
    leaving.current = true;
    onSave(form);
  };

  const status = dirty ? { text: "● Cambios sin guardar", tone: "warn" as const } : isNew ? { text: "Rellena nombre en camiseta y dorsal", tone: "" as const } : { text: "✓ Sin cambios", tone: "ok" as const };
  const kicker = isNew ? "Plantilla · alta" : `Plantilla · ${form.position ? POS_LABEL[form.position] : "Jugador"}${shownNum != null ? ` · dorsal ${shownNum}` : ""}`;
  const title = isNew ? form.shirtName.trim() || "Jugador nuevo" : shownName;
  const photo = linkState(form.photoUrl) === "ok" ? form.photoUrl.trim() : "";
  const bigNum = form.number.trim() || "—";
  const selectedSeasons = seasons.filter((s) => form.seasons.includes(s.id));

  const consequences: Consequence[] = [
    { tone: "r", text: "Deja de salir en la plantilla, en las convocatorias y en su página" },
    ...(linkedTo ? [{ tone: "r" as const, text: `${linkedTo} se queda sin ficha (su cuenta sigue en el vestuario)` }] : []),
    { tone: "o", text: "Las actas ya publicadas no cambian" },
    { tone: "", text: `${shownNum != null ? `El dorsal ${shownNum} queda libre` : "Su dorsal queda libre"} · se puede deshacer unos segundos` },
  ];

  return (
    <>
      <Drawer
        open
        onClose={close}
        kicker={kicker}
        title={title}
        status={status}
        error={error || undefined}
        initialFocus={isNew ? nameRef : undefined}
        footer={
          <>
            {!isNew && (
              <button type="button" className="btn sm red" onClick={() => setAsking(true)} aria-haspopup="dialog">
                Dar de baja
              </button>
            )}
            <span className="sp" />
            <button type="button" className="btn sm line" onClick={close}>
              Cancelar
            </button>
            <button type="button" className="btn sm pri" aria-disabled={saveDisabled} onClick={save}>
              <AdIcon name="check" size={16} />
              {isNew ? "Dar de alta" : "Guardar"}
            </button>
          </>
        }
      >
        <div className="fg2">
          <div className="ups w2">
            {photo ? (
              <img className="pho ad-pho" src={photo} alt="" width={84} height={84} />
            ) : (
              <span className={`pho ${form.position === "POR" ? "por" : ""}`.trim()} aria-hidden="true">
                {bigNum}
              </span>
            )}
            <span className="w">
              <b id={photoId}>Foto</b>
              <small>Enlace HTTPS · se recorta cuadrada. Sin foto, sale el dorsal.</small>
              <input
                className={`inp ${linkState(form.photoUrl) === "bad" ? "bad" : linkState(form.photoUrl) === "ok" ? "good" : ""}`.trim()}
                aria-labelledby={photoId}
                aria-describedby={`${photoId}-c`}
                inputMode="url"
                placeholder="https://"
                value={form.photoUrl}
                onChange={(e) => set("photoUrl", e.target.value)}
              />
              {check.photo && (
                <FieldCheck id={`${photoId}-c`} tone={check.photo.tone}>
                  {check.photo.text}
                </FieldCheck>
              )}
              {player && (
                <span className="row">
                  <a className="btn sm line" href={`/jugadores/${encodeURIComponent(player.id)}`} target="_blank" rel="noopener noreferrer">
                    Ver su página
                    <AdIcon name="ext" size={14} />
                  </a>
                </span>
              )}
            </span>
          </div>

          <label className="fld">
            <span className="lbl" id={`${lblId}-n`}>
              Nombre
            </span>
            <input
              ref={nameRef}
              aria-labelledby={`${lblId}-n`}
              className={`inp ${error && check.firstName ? "bad" : ""}`.trim()}
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              aria-invalid={(!!error && !!check.firstName) || undefined}
              autoComplete="off"
            />
          </label>
          <TextField label="Apellidos" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="off" />

          <label className="fld">
            <span className="lbl" id={`${lblId}-c`}>
              Nombre en camiseta
            </span>
            <input
              aria-labelledby={`${lblId}-c`}
              className={`inp ${check.shirtName ? "bad" : ""}`.trim()}
              maxLength={12}
              value={form.shirtName}
              onChange={(e) => set("shirtName", e.target.value.toUpperCase())}
              aria-describedby={camId}
              aria-invalid={!!check.shirtName || undefined}
              autoComplete="off"
            />
            <span className="fhint" id={camId}>
              <span>{check.shirtName ?? "De 2 a 12 letras"}</span>
              <span className="tn">{form.shirtName.length}/12</span>
            </span>
          </label>
          <label className="fld">
            <span className="lbl" id={`${lblId}-d`}>
              Dorsal
            </span>
            <input
              aria-labelledby={`${lblId}-d`}
              className={`inp tn ${!form.number.trim() ? "" : check.number.tone === "bad" ? "bad" : "good"}`.trim()}
              inputMode="numeric"
              maxLength={2}
              value={form.number}
              onChange={(e) => set("number", digits(e.target.value, 2))}
              aria-describedby={numId}
              aria-invalid={check.number.tone === "bad" || undefined}
              autoComplete="off"
            />
            <FieldCheck id={numId} tone={check.number.tone}>
              {check.number.text}
            </FieldCheck>
          </label>

          <div className="fld w2">
            <span className="lbl" id={posId}>
              Posición
            </span>
            <Segmented<Position | "">
              labelledBy={posId}
              value={form.position}
              options={POSITIONS.map((p) => ({ value: p, label: POS_LABEL[p] }))}
              onChange={(v) => set("position", v)}
            />
          </div>
          <div className="fld w2">
            <span className="lbl" id={estId}>
              Estado
            </span>
            <Segmented<"act" | "les">
              labelledBy={estId}
              value={form.injured ? "les" : "act"}
              options={[
                { value: "act", label: "Activo" },
                { value: "les", label: "Lesionado" },
              ]}
              onChange={(v) => set("injured", v === "les")}
            />
          </div>

          <div className="fld w2">
            <span className="lbl" id={ssId}>
              Temporadas en que juega
            </span>
            {seasons.length ? (
              <Toggles labelledBy={ssId} options={seasons.map((s) => ({ value: s.id, label: seasonLabel(s, activeId) }))} selected={form.seasons} onToggle={toggleSeason} />
            ) : (
              <span className="hint">Todavía no hay temporadas: créalas en «Temporadas».</span>
            )}
            <span className="hint">Nombre en camiseta y dorsal se guardan por temporada; vacío = el de arriba.</span>
          </div>
          {selectedSeasons.map((s) => {
            const o = form.overrides[s.id] ?? { shirtName: "", number: "" };
            const p = check.overrides[s.id];
            return (
              <div key={s.id} className="ad-ovr w2" role="group" aria-label={`Solo en la ${s.name}`}>
                <span className="ad-ovr-t">
                  <b>{seasonCode(s.name)}</b>
                  <small>Solo en la {s.name}</small>
                </span>
                <input
                  className={`inp ${p?.shirtName ? "bad" : ""}`.trim()}
                  maxLength={12}
                  placeholder={form.shirtName.trim() || "Camiseta"}
                  aria-label={`Nombre en camiseta en la ${s.name}`}
                  value={o.shirtName}
                  onChange={(e) => setOverride(s.id, "shirtName", e.target.value.toUpperCase())}
                  autoComplete="off"
                />
                <input
                  className={`inp tn ${p?.number ? "bad" : ""}`.trim()}
                  inputMode="numeric"
                  maxLength={2}
                  placeholder={form.number.trim() || "—"}
                  aria-label={`Dorsal en la ${s.name}`}
                  value={o.number}
                  onChange={(e) => setOverride(s.id, "number", digits(e.target.value, 2))}
                  autoComplete="off"
                />
                {(p?.shirtName || p?.number) && (
                  <FieldCheck tone="bad">
                    {[p.shirtName, p.number].filter(Boolean).join(" ")}
                  </FieldCheck>
                )}
              </div>
            );
          })}

          <div className="w3">
            <TextField label="Nacimiento" type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
            <TextField label="Altura (cm)" className="tn" inputMode="numeric" maxLength={3} placeholder="—" value={form.height} onChange={(e) => set("height", digits(e.target.value, 3))} state={check.height ? "bad" : undefined} />
            <TextField label="Peso (kg)" className="tn" inputMode="numeric" maxLength={3} placeholder="—" value={form.weight} onChange={(e) => set("weight", digits(e.target.value, 3))} state={check.weight ? "bad" : undefined} />
          </div>
        </div>
      </Drawer>
      <ConfirmModal
        open={asking}
        onClose={() => setAsking(false)}
        tone="red"
        kicker="Plantilla"
        title={`¿Dar de baja a ${shownName}?`}
        lede={`Se borra su ficha${activeSeason ? ` de la plantilla de la ${activeSeason.name}` : " de la plantilla"}. Esto pasa:`}
        consequences={consequences}
        confirmLabel="Dar de baja"
        confirmTone="red solid"
        onConfirm={() => {
          leaving.current = true;
          setAsking(false);
          onBaja();
        }}
      />
    </>
  );
}
