// The player's cajón (Plantilla): beside the percha on desktop (inline, the wall drops to five per rail), a
// sheet from the bottom on phones. Headed by his cromo (rating, position, shirt, GOL / ASI / PJ / MVP) —
// or, for «Alta de jugador», the empty shirt that is stamped as the name and the dorsal are typed. The form:
// name on the shirt (2–12, counter, upper-case), the dorsal with its live check («Su dorsal · solo lo lleva
// él» / «El 9 ya lo lleva ERIK en la Temporada 1»), position, Activo / Lesionado, the seasons; «Más datos»
// keeps the rest (name, surnames, photo, a season's own shirt name / dorsal, birth, height, weight), then
// «Ver su página ↗». Footer: Dar de baja (modal) · Cerrar · Guardar / Dar de alta (disabled without changes
// or with an error). «● Cambios sin guardar» and the unsaved-changes guard on every way out.
import { useId, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { PlayerDoc, SeasonDoc } from "../../../lib/schemas";
import type { Cromo } from "../../pizarra/v2/model";
import { CromoCard, CromoNew } from "../kit";
import { AdIcon } from "../ui/icons";
import { useUnsavedGuard } from "../ui/guard";
import { ConfirmModal, Drawer } from "../ui/layers";
import {
  POSITIONS,
  checkPlayerForm,
  dorsalLine,
  emptyForm,
  formDirty,
  formFromPlayer,
  nameIn,
  numberIn,
  shirtNameError,
  type LiveCheck,
  type PlayerForm,
} from "./plantillaLogic";
import { ACCOUNT_LABEL, GAPS, gapsText, type Account, type GapKey } from "./plantillaBoard";

export interface PlayerDrawerProps {
  /** The player to edit; null = «Alta de jugador». */
  player: PlayerDoc | null;
  /** The players as shown (pending changes applied): the dorsal check runs against them. */
  players: readonly PlayerDoc[];
  seasons: readonly SeasonDoc[];
  /** The season of the percha (the alta's season, the dorsal's label, the baja's season). */
  activeSeason: SeasonDoc | null;
  /** His cromo in the season (rating and season line) and the matches the team has finished. */
  cromo: Cromo | undefined;
  games: number;
  /** Desktop: beside the wall, not modal. */
  inline: boolean;
  onClose: () => void;
  onSave: (form: PlayerForm) => void;
  onBaja: () => void;
  /** The photo of his real kit (shown while the shirt name and dorsal are the saved ones). */
  still?: string;
  /** The kit's `view-transition-name` (it flies in from his row). */
  vt?: string;
  /** What his ficha lacks (the slots under the cromo). */
  gaps?: readonly GapKey[];
  /** His account in the vestuario and who has it / asks for it. */
  account?: { state: Account; who: string };
  /** His story on the web (bio / quote) is written. */
  story?: boolean;
  /** «Alta» starting on a free dorsal (`?dorsal=`). */
  initialNumber?: number | null;
}

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

function Line({ check, id }: { check: LiveCheck | null; id: string }) {
  if (!check) return null;
  if (check.tone === "mut")
    return (
      <span className="hint" id={id}>
        {check.text}
      </span>
    );
  return (
    <span className={check.tone === "ok" ? "ok" : "er"} id={id}>
      <AdIcon name={check.tone === "ok" ? "check" : "x"} size={13} />
      {check.text}
    </span>
  );
}

export function PlayerDrawer({ player, players, seasons, activeSeason, cromo, games, inline, onClose, onSave, onBaja, still, vt, gaps, account, story, initialNumber }: PlayerDrawerProps) {
  const isNew = !player;
  const activeId = activeSeason?.id;
  const [start] = useState<PlayerForm>(() => (player ? formFromPlayer(player) : { ...emptyForm(activeId && !activeSeason?.archived ? [activeId] : []), number: initialNumber ? String(initialNumber) : "" }));
  const [form, setForm] = useState<PlayerForm>(start);
  const [more, setMore] = useState(false);
  const [asking, setAsking] = useState(false);
  const leaving = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  const dirty = formDirty(form, start);
  const check = useMemo(() => checkPlayerForm(form, { players, seasons, editingId: player?.id ?? null, start: isNew ? null : start }), [form, players, seasons, player, isNew, start]);
  const seasonOf = (p: PlayerDoc) => (activeId && (p.seasons ?? []).includes(activeId) ? activeId : undefined);
  const shownName = player ? nameIn(player, seasonOf(player)) : "";
  const shownNum = player ? numberIn(player, seasonOf(player)) : null;
  const guard = useUnsavedGuard(dirty, { what: isNew ? "el alta del jugador" : `la ficha de ${shownName}`, shouldBlock: () => !leaving.current });

  const set = <K extends keyof PlayerForm>(k: K, v: PlayerForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setOverride = (sid: string, k: "shirtName" | "number", v: string) =>
    setForm((f) => ({ ...f, overrides: { ...f.overrides, [sid]: { shirtName: f.overrides[sid]?.shirtName ?? "", number: f.overrides[sid]?.number ?? "", [k]: v } } }));
  const toggleSeason = (sid: string) => setForm((f) => ({ ...f, seasons: f.seasons.includes(sid) ? f.seasons.filter((x) => x !== sid) : [...f.seasons, sid] }));

  const close = () => guard.run(onClose);
  const saveOff = !check.ok || !dirty;
  const save = () => {
    if (saveOff) return;
    leaving.current = true;
    onSave(form);
  };

  const nameErr = shirtNameError(form.shirtName, isNew);
  const dorsal = dorsalLine(check, form, isNew ? null : start);
  // A problem that lives in «Más datos» while it is folded is said above the buttons.
  const hidden =
    check.photo?.tone === "bad"
      ? "la foto tiene que ser un enlace https://"
      : (check.height ?? check.weight ?? (Object.keys(check.overrides).length ? "el nombre o el dorsal de una temporada" : ""));
  const error = !more && dirty && hidden ? `Revisa «Más datos»: ${hidden}` : undefined;
  const own = activeId ? form.overrides[activeId] : undefined;
  const dorsalLabel = activeSeason && !(own && (own.shirtName || own.number)) ? `Dorsal en la ${activeSeason.name}` : "Dorsal por defecto";
  const selectedSeasons = seasons.filter((s) => form.seasons.includes(s.id));

  // The photo of his kit shows what is saved: while the name or the dorsal are being retyped, the drawn
  // shirt is stamped live instead.
  const asSaved = form.shirtName.trim() === shownName.toLocaleUpperCase("es") && form.number.trim() === String(shownNum ?? "");
  const top = isNew ? (
    <CromoNew name={form.shirtName} num={form.number} />
  ) : (
    <>
      <CromoCard cromo={cromo} name={form.shirtName.trim() || shownName} num={form.number.trim() || shownNum} pos={form.position || "—"} games={games} still={asSaved ? still : undefined} vt={vt} />
      {gaps ? (
        <div className="fslots" role="group" aria-label={gapsText(gaps)}>
          {GAPS.map((g) => (
            <span key={g.key} className={gaps.includes(g.key) ? "sl no" : "sl"} aria-hidden="true">
              <i />
              {g.short}
            </span>
          ))}
          <span className="tx" aria-hidden="true">
            {gaps.length ? `Faltan ${gaps.length}` : "Completa"}
          </span>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <Drawer
        open
        inline={inline}
        onClose={close}
        title={isNew ? "Alta de jugador" : `Ficha de ${shownName}`}
        status={dirty ? { text: "● Cambios sin guardar", tone: "warn" } : undefined}
        top={top}
        error={error}
        initialFocus={isNew ? nameRef : undefined}
        footer={
          <>
            {isNew ? (
              <span className="sp" />
            ) : (
              <button type="button" className="btn sm red sp" onClick={() => setAsking(true)} aria-haspopup="dialog">
                Dar de baja
              </button>
            )}
            <button type="button" className="btn sm line" onClick={close}>
              Cerrar
            </button>
            <button type="button" className="btn sm sky" onClick={save} disabled={saveOff}>
              {isNew ? "Dar de alta" : "Guardar"}
            </button>
          </>
        }
      >
        <div className="fld">
          <label htmlFor={`${uid}-n`}>Nombre en la camiseta · {form.shirtName.length}/12</label>
          <input
            ref={nameRef}
            className={nameErr ? "inp bad" : "inp"}
            id={`${uid}-n`}
            value={form.shirtName}
            onChange={(e) => set("shirtName", e.target.value.toLocaleUpperCase("es").slice(0, 12))}
            placeholder="KEVIN"
            maxLength={12}
            autoComplete="off"
            aria-invalid={!!nameErr || undefined}
            aria-describedby={nameErr ? `${uid}-ne` : undefined}
          />
          {nameErr ? (
            <span className="er" id={`${uid}-ne`}>
              <AdIcon name="x" size={13} />
              {nameErr}
            </span>
          ) : null}
        </div>
        <div className="fld">
          <label htmlFor={`${uid}-d`}>{dorsalLabel}</label>
          <input
            className={dorsal.tone === "bad" ? "inp bad" : "inp"}
            id={`${uid}-d`}
            value={form.number}
            onChange={(e) => set("number", digits(e.target.value, 2))}
            inputMode="numeric"
            maxLength={2}
            placeholder="1–99"
            autoComplete="off"
            aria-invalid={dorsal.tone === "bad" || undefined}
            aria-describedby={`${uid}-dl`}
          />
          <Line check={dorsal} id={`${uid}-dl`} />
        </div>
        <div className="fld">
          <span className="lb" id={`${uid}-p`}>
            Posición
          </span>
          <div className="sgf" role="group" aria-labelledby={`${uid}-p`}>
            {POSITIONS.map((p) => (
              <button key={p} type="button" aria-pressed={form.position === p} onClick={() => set("position", p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="fld">
          <span className="lb" id={`${uid}-e`}>
            Estado
          </span>
          <div className="sgf" role="group" aria-labelledby={`${uid}-e`}>
            <button type="button" aria-pressed={!form.injured} onClick={() => set("injured", false)}>
              Activo
            </button>
            <button type="button" aria-pressed={form.injured} onClick={() => set("injured", true)}>
              Lesionado
            </button>
          </div>
        </div>
        <div className="fld">
          <span className="lb" id={`${uid}-s`}>
            Temporadas
          </span>
          {seasons.length ? (
            <div className="tgl" role="group" aria-labelledby={`${uid}-s`}>
              {seasons.map((s) => (
                <button key={s.id} type="button" aria-pressed={form.seasons.includes(s.id)} onClick={() => toggleSeason(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          ) : (
            <span className="hint">Todavía no hay temporadas: créalas en «Temporadas».</span>
          )}
        </div>
        <p className="hint">Nombre, foto, nacimiento, altura y peso son opcionales: en «Más datos».</p>
        <button type="button" className="dn" onClick={() => setMore((m) => !m)} aria-expanded={more}>
          Más datos
          <span className="ch">
            <AdIcon name="down" size={16} />
          </span>
        </button>
        {more ? (
          <>
            <div className="fld">
              <label htmlFor={`${uid}-fn`}>Nombre</label>
              <input className="inp" id={`${uid}-fn`} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="off" />
            </div>
            <div className="fld">
              <label htmlFor={`${uid}-ln`}>Apellidos</label>
              <input className="inp" id={`${uid}-ln`} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="off" />
            </div>
            <div className="fld">
              <label htmlFor={`${uid}-ph`}>Foto · enlace https://</label>
              <input
                className={check.photo?.tone === "bad" ? "inp bad" : "inp"}
                id={`${uid}-ph`}
                inputMode="url"
                placeholder="https://"
                value={form.photoUrl}
                onChange={(e) => set("photoUrl", e.target.value)}
                aria-invalid={check.photo?.tone === "bad" || undefined}
                aria-describedby={`${uid}-phl`}
              />
              <Line check={check.photo} id={`${uid}-phl`} />
            </div>
            {selectedSeasons.map((s) => {
              const o = form.overrides[s.id] ?? { shirtName: "", number: "" };
              const p = check.overrides[s.id];
              return (
                <div key={s.id} className="fld" role="group" aria-label={`Solo en la ${s.name}`}>
                  <span className="lb">Solo en la {s.name} · vacío = el de arriba</span>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 96px", gap: 8 }}>
                    <input
                      className={p?.shirtName ? "inp bad" : "inp"}
                      maxLength={12}
                      placeholder={form.shirtName.trim() || "Camiseta"}
                      aria-label={`Nombre en la camiseta en la ${s.name}`}
                      value={o.shirtName}
                      onChange={(e) => setOverride(s.id, "shirtName", e.target.value.toLocaleUpperCase("es"))}
                      autoComplete="off"
                    />
                    <input
                      className={p?.number ? "inp bad" : "inp"}
                      inputMode="numeric"
                      maxLength={2}
                      placeholder={form.number.trim() || "—"}
                      aria-label={`Dorsal en la ${s.name}`}
                      value={o.number}
                      onChange={(e) => setOverride(s.id, "number", digits(e.target.value, 2))}
                      autoComplete="off"
                    />
                  </div>
                  {p?.shirtName || p?.number ? (
                    <span className="er">
                      <AdIcon name="x" size={13} />
                      {[p.shirtName, p.number].filter(Boolean).join(" ")}
                    </span>
                  ) : null}
                </div>
              );
            })}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
              <div className="fld">
                <label htmlFor={`${uid}-b`}>Nacimiento</label>
                <input className="inp" id={`${uid}-b`} type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
              </div>
              <div className="fld">
                <label htmlFor={`${uid}-h`}>Altura (cm)</label>
                <input className={check.height ? "inp bad" : "inp"} id={`${uid}-h`} inputMode="numeric" maxLength={3} placeholder="—" value={form.height} onChange={(e) => set("height", digits(e.target.value, 3))} />
              </div>
              <div className="fld">
                <label htmlFor={`${uid}-w`}>Peso (kg)</label>
                <input className={check.weight ? "inp bad" : "inp"} id={`${uid}-w`} inputMode="numeric" maxLength={3} placeholder="—" value={form.weight} onChange={(e) => set("weight", digits(e.target.value, 3))} />
              </div>
            </div>
            {check.height || check.weight ? (
              <span className="er">
                <AdIcon name="x" size={13} />
                {[check.height, check.weight].filter(Boolean).join(" ")}
              </span>
            ) : null}
          </>
        ) : null}
        {player ? (
          <section className="fweb" aria-label="Cuenta y web">
            <span className="lb">Cuenta y web</span>
            {account ? (
              <p className={`acc ${account.state}`}>
                <AdIcon name={account.state === "vinculada" ? "link" : account.state === "pide" ? "inbox" : "lock"} size={16} />
                <span>
                  <b>{ACCOUNT_LABEL[account.state]}</b>
                  {account.state === "vinculada" ? ` · ${account.who || "un socio"} entra al vestuario con su ficha` : account.state === "pide" ? ` · ${account.who || "un socio"} la ha pedido` : " · nadie entra al vestuario con su ficha"}
                </span>
                {account.state === "pide" ? (
                  <Link className="lnk" to="/admin/fichas">
                    Revisar en Fichas
                  </Link>
                ) : null}
              </p>
            ) : null}
            <p className="acc">
              <AdIcon name="doc" size={16} />
              <span>
                <b>{story ? "Su historia está escrita" : "Sin historia"}</b>
                {" · la que sale en su perfil"}
              </span>
              <Link className="lnk" to="/admin/contenido" search={{ seccion: "historias" }}>
                {story ? "Editarla" : "Escribirla"}
              </Link>
            </p>
            <a className="lnk" href={`/jugadores/${encodeURIComponent(player.id)}`} target="_blank" rel="noopener noreferrer">
              Ver su página
              <AdIcon name="ext" size={14} />
            </a>
          </section>
        ) : null}
      </Drawer>
      <ConfirmModal
        open={asking}
        onClose={() => setAsking(false)}
        title={`¿Dar de baja a ${shownName}?`}
        consequences={
          activeSeason
            ? [`Su camiseta deja la percha de la ${activeSeason.name}`, "Sus actas, goles y su carta se quedan", "Se puede volver a dar de alta"]
            : ["Se borra su ficha de la plantilla", "Las actas ya publicadas no cambian", "Durante unos segundos se puede deshacer"]
        }
        confirmLabel="Dar de baja"
        confirmTone="redf"
        onConfirm={() => {
          leaving.current = true;
          setAsking(false);
          onBaja();
        }}
      />
    </>
  );
}
