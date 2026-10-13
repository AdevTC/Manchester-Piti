// Plantilla's ficha workspace: one player at a time, big. The hero (his kit — the photo of the real 3D shirt —,
// «Ficha 3 de 16», complete or what it lacks, dorsal + name, his Posiciones on the map and Estado one tap each —
// a proposal of his waits there to be approved, adjusted or rejected; «Sancionado» opens
// a small form: matches or «hasta la J…», and a reason; while sanctioned, what is left and «Levantar la
// sanción» —, GOL · ASI · PJ · MVP) and three cards always in view: Camiseta (name on the shirt, dorsal with its live check, name and
// surnames, seasons, a season's own shirt), Datos (photo link, birth, height, weight) and Cuenta y web (his
// account, his story, his page, «Dar de baja»). It saves itself: a field is written when you leave it (or press
// Enter) if it is valid, a season toggle at once — every write behind the lower third's «Deshacer». An
// invalid edit is never written and leaving with it asks first. «Siguiente sin completar», ← → and ↑ ↓ walk
// the list. Phones: the same ficha full screen, with a back row and a sticky «Siguiente sin completar».
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import { SANCTION_LIMITS, type PlayerDoc, type SeasonDoc } from "../../../lib/schemas";
import type { Suspension } from "../../pizarra/chemistry";
import type { AdminMatch } from "../data/adminLogic";
import { ShirtBack } from "../kit";
import { useUnsavedGuard } from "../ui/guard";
import { AdIcon } from "../ui/icons";
import { ConfirmModal } from "../ui/layers";
import { ACCOUNT_LABEL, GAPS, gapsText, type BoardRow } from "./plantillaBoard";
import { MapaPosiciones } from "../../../components/posiciones/MapaPosiciones";
import { summaryText } from "../../../components/posiciones/mapaNav";
import { resolvePositions, sanitizePositions, type PositionSet } from "../../../lib/positions";
import { proposalState } from "../../../lib/positionsEdit";
import { asPosition, checkPlayerForm, dorsalLine, formDirty, formFromPlayer, linkState, shirtNameError, type LiveCheck, type PlayerForm } from "./plantillaLogic";
import { checkSanction, sanctionForm, untilLabel, type SanctionChoice, type SanctionForm } from "./sanctionLogic";

export interface FichaStats {
  goals: number;
  assists: number;
  played: number;
  mvps: number;
}
export interface FichaWorkspaceProps {
  player: PlayerDoc;
  row: BoardRow;
  /** The players as shown (pending changes applied): the dorsal check runs against them. */
  players: readonly PlayerDoc[];
  seasons: readonly SeasonDoc[];
  activeSeason: SeasonDoc | null;
  stats: FichaStats | undefined;
  still: string | undefined;
  /** The kit's `view-transition-name` (it flies here from his row). */
  vt?: string;
  /** 1-based place in the list and the list's length. */
  index: number;
  total: number;
  story: boolean;
  phone: boolean;
  /** His positions from the map; `adjusted` = the captain's adjustment of his pending proposal. */
  onPositions: (set: PositionSet, adjusted: boolean) => void;
  /** His pending proposal: approved as it came, or rejected. */
  onReview: (kind: "aprobada" | "rechazada") => void;
  onInjured: (injured: boolean) => void;
  /** His suspension now (a red card or a sanction set by hand), with what is left; undefined = he can play. */
  suspension?: Suspension;
  /** «Sancionado · quedan 2 partidos (hasta la J8) · Federación». */
  suspensionText?: string;
  /** «Hasta la J…»: the season's matches still to play. */
  upcoming: readonly AdminMatch[];
  /** «Sancionar» with a checked form. */
  onSanction: (choice: SanctionChoice) => void;
  /** «Levantar la sanción» (a manual one and the acta's red card). */
  onLift: () => void;
  /** A valid change to write (it replaces the ficha's starting point). */
  onSave: (form: PlayerForm) => void;
  onBaja: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** null when every ficha is complete. */
  onNextGap: (() => void) | null;
  onBack?: () => void;
  /** false while «Deshacer» resets this ficha: what is typed goes back too, nothing is written on the way out. */
  keepOnLeave?: () => boolean;
}

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
const NO_POSITIONS: PositionSet = { main: null, also: [] };

function Line({ check, id }: { check: LiveCheck | null; id: string }) {
  if (!check || !check.text) return null;
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

/** «Sancionado»'s small form: how long (matches, or until a match of the calendar) and why. */
function SanctionBox({ id, name, upcoming, onCancel, onSave }: { id: string; name: string; upcoming: readonly AdminMatch[]; onCancel: () => void; onSave: (choice: SanctionChoice) => void }) {
  const [f, setF] = useState<SanctionForm>(() => sanctionForm(upcoming));
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  const set = <K extends keyof SanctionForm>(k: K, v: SanctionForm[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setError(null);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = checkSanction(f, upcoming);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onSave(r.choice);
  };
  const errId = `${id}-e`;
  return (
    <form id={id} className="sanf" aria-label={`Sanción de ${name}`} onSubmit={submit} noValidate>
      <div className="tgl" role="group" aria-label="Cuánto dura">
        <button type="button" aria-pressed={f.mode === "games"} onClick={() => set("mode", "games")}>
          Partidos
        </button>
        <button type="button" aria-pressed={f.mode === "until"} onClick={() => set("mode", "until")} disabled={!upcoming.length}>
          Hasta la jornada
        </button>
      </div>
      {f.mode === "games" ? (
        <div className="fld">
          <label htmlFor={`${id}-g`}>Partidos de sanción · de 1 a {SANCTION_LIMITS.games}</label>
          <input
            ref={first}
            className={error ? "inp bad" : "inp"}
            id={`${id}-g`}
            type="number"
            inputMode="numeric"
            min={1}
            max={SANCTION_LIMITS.games}
            step={1}
            value={f.games}
            onChange={(e) => set("games", e.target.value)}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? errId : undefined}
          />
        </div>
      ) : (
        <div className="fld">
          <label htmlFor={`${id}-u`}>Hasta la jornada (incluida)</label>
          <select className="inp" id={`${id}-u`} value={f.untilId} onChange={(e) => set("untilId", e.target.value)}>
            {upcoming.map((m) => (
              <option key={m.id} value={m.id}>
                {untilLabel(m)}
              </option>
            ))}
          </select>
        </div>
      )}
      {upcoming.length ? null : <span className="hint">Sin partidos programados: cuenta por partidos.</span>}
      <div className="fld">
        <label htmlFor={`${id}-r`}>
          Motivo · opcional · {f.reason.length}/{SANCTION_LIMITS.reason}
        </label>
        <input className="inp" id={`${id}-r`} value={f.reason} maxLength={SANCTION_LIMITS.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Federación, Roja en Copa…" autoComplete="off" />
      </div>
      {error ? (
        <span className="er" id={errId} role="alert">
          <AdIcon name="x" size={13} />
          {error}
        </span>
      ) : null}
      <div className="sanb">
        <button type="submit" className="btn sm red">
          Sancionar
        </button>
        <button type="button" className="btn sm line" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function FichaWorkspace(props: FichaWorkspaceProps) {
  const { player, row, players, seasons, activeSeason, stats, still, vt, index, total, story, phone } = props;
  const uid = useId();
  const [start, setStart] = useState<PlayerForm>(() => formFromPlayer(player));
  const [form, setForm] = useState<PlayerForm>(start);
  const [asking, setAsking] = useState(false);
  /** «Sancionado» opens its small form here (a number of matches or «hasta la J…», and a reason). */
  const [sanOpen, setSanOpen] = useState(false);
  const sanctioned = !!props.suspension;
  /** «Ajustar»: his proposal, loaded into the editor; the next tap saves it as adjusted. */
  const [adjusting, setAdjusting] = useState<PositionSet | null>(null);
  /** The map refused a tap (the 6 «también» cap): said under it until the next change. */
  const [refused, setRefused] = useState<string | null>(null);
  // Posiciones and Estado are written on their own (one tap); the form always carries their live value, so a
  // field saved later never puts back an old line or state. That line equals the stored doc's resolved
  // line, so the edit payload (playerPayload with `stored`) writes no naturalPosition: an old exact word
  // («Lateral derecho») is not flattened to «DEF» before the migration reads it.
  const livePos = asPosition(resolvePositions(player).line);
  const liveInj = !!player.injured;
  const live = (f: PlayerForm): PlayerForm => ({ ...f, position: livePos, injured: liveInj });
  const check = checkPlayerForm(live(form), { players, seasons, editingId: player.id, start: live(start) });
  const dirty = formDirty(live(form), live(start));
  const name = row.name;
  // Valid changes save themselves on blur: only an invalid edit can be left behind, and leaving then asks
  // («Dar de baja» leaves on purpose: no question, nothing written on the way out).
  const leaving = useRef(false);
  useUnsavedGuard(dirty && !check.ok, { what: `la ficha de ${name}`, shouldBlock: () => !leaving.current });

  // what is written, kept in step synchronously (a blur-save and an unmount can follow each other at once)
  const saved = useRef(start);
  const commit = (next: PlayerForm) => {
    const f = live(next);
    const base = live(saved.current);
    if (!formDirty(f, base)) return;
    if (!checkPlayerForm(f, { players, seasons, editingId: player.id, start: base }).ok) return;
    props.onSave(f);
    saved.current = next;
    setStart(next);
  };
  // a valid edit still in a field when the ficha goes away (back, another player without a blur) is written
  const flush = useRef(() => {});
  useLayoutEffect(() => {
    flush.current = () => {
      if (!leaving.current && (props.keepOnLeave?.() ?? true)) commit(form);
    };
  });
  useEffect(() => () => flush.current(), []);
  const set = <K extends keyof PlayerForm>(k: K, v: PlayerForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setNow = (next: PlayerForm) => {
    setForm(next);
    commit(next);
  };
  // leaving a field writes it (moving to the next field of the same card too: every field is its own write)
  const onBlur = () => commit(form);
  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit(form);
  };
  const setOverride = (sid: string, k: "shirtName" | "number", v: string) =>
    setForm((f) => ({ ...f, overrides: { ...f.overrides, [sid]: { shirtName: f.overrides[sid]?.shirtName ?? "", number: f.overrides[sid]?.number ?? "", [k]: v } } }));
  const toggleSeason = (sid: string) => setNow({ ...form, seasons: form.seasons.includes(sid) ? form.seasons.filter((x) => x !== sid) : [...form.seasons, sid] });

  const nameErr = shirtNameError(form.shirtName, false);
  const dorsal = dorsalLine(check, live(form), live(start));
  const activeId = activeSeason?.id;
  const own = activeId ? form.overrides[activeId] : undefined;
  const dorsalLabel = activeSeason && !(own && (own.shirtName || own.number)) ? `Dorsal en la ${activeSeason.name}` : "Dorsal por defecto";
  const photo = linkState(form.photoUrl);
  const selectedSeasons = seasons.filter((s) => form.seasons.includes(s.id));
  const kitStyle: CSSProperties | undefined = vt ? { viewTransitionName: vt } : undefined;
  const asSaved = form.shirtName.trim() === start.shirtName.trim() && form.number.trim() === start.number.trim();
  const shownName = form.shirtName.trim() || name;
  const shownNum = form.number.trim() || (row.number ?? "");
  const gaps = row.gaps;
  const at = `${index} de ${total}`;
  const fullT = row.full === "Sin nombre" ? "Nombre y apellidos sin poner" : row.full;

  const kit = (
    <span className="kit" style={kitStyle} aria-hidden="true">
      {still && asSaved ? <img src={still} alt="" width={phone ? 104 : 168} height={phone ? 116 : 187} decoding="async" /> : <ShirtBack num={shownNum} name={shownName} size={phone ? 100 : 160} big />}
    </span>
  );
  const slots = (
    <span className="sl2" role="img" aria-label={gapsText(gaps)}>
      {GAPS.map((g) => (
        <i key={g.key} className={gaps.includes(g.key) ? "no" : ""}>
          {g.short}
        </i>
      ))}
    </span>
  );
  // ── Posiciones: the map (his exact positions, one tap each) or, while he proposes others, his proposal ──
  const resolved = resolvePositions(player);
  const current: PositionSet = { main: resolved.main, also: resolved.also };
  const proposal = proposalState(player) === "pendiente" ? (sanitizePositions(player.positionsProposal) ?? NO_POSITIONS) : null;
  const draft = proposal ? adjusting : null;
  const onMap = (next: PositionSet) => {
    setRefused(null);
    setAdjusting(null);
    props.onPositions(next, !!draft);
  };
  const editor = (
    <>
      <MapaPosiciones value={draft ?? current} compare={draft ? current : undefined} onChange={onMap} onRefuse={setRefused} size={phone ? "m" : "s"} label={`Posiciones de ${name}`} />
      {refused ? (
        <span className="er">
          <AdIcon name="x" size={13} />
          {refused}
        </span>
      ) : null}
    </>
  );
  const posBlock = (
    <div className="fld posx">
      <span className="lb">Posiciones</span>
      {proposal ? (
        <div className={draft ? "ppr adj" : "ppr"} role="group" aria-label={`Propuesta de ${name}`}>
          {draft ? (
            <>
              <p className="ppq">
                <AdIcon name="pencil" size={14} />
                <span>
                  <b>Ajustando la propuesta de {name}</b> · toca en el mapa: se guarda como ajustada
                </span>
              </p>
              <button type="button" className="btn sm line" onClick={() => setAdjusting(null)}>
                Cancelar
              </button>
            </>
          ) : (
            <>
              <p className="ppq">
                <span>
                  <b>{name} propone:</b> {summaryText(proposal)}
                </span>
              </p>
              <MapaPosiciones value={proposal} compare={current} size={phone ? "m" : "s"} label={`Lo que propone ${name}`} />
              <p className="ppn">Ahora: {summaryText(current)}</p>
              <div className="ppb">
                <button type="button" className="btn sm gold" onClick={() => props.onReview("aprobada")}>
                  Aprobar
                </button>
                <button type="button" className="btn sm line" onClick={() => setAdjusting(proposal)}>
                  Ajustar
                </button>
                <button type="button" className="btn sm red" onClick={() => props.onReview("rechazada")}>
                  Rechazar
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
      {proposal && !draft ? null : editor}
    </div>
  );
  // «Activo» puts him back: the injury first, else the sanction (lifted, with «Deshacer» like the rest)
  const activo = () => {
    if (liveInj) props.onInjured(false);
    else if (sanctioned) props.onLift();
  };
  const stateSeg = (
    <span className="pz" role="group" aria-label={`Estado de ${name}`}>
      <button type="button" aria-pressed={!liveInj && !sanctioned} onClick={activo}>
        Activo
      </button>
      <button type="button" aria-pressed={liveInj} onClick={() => !liveInj && props.onInjured(true)}>
        <AdIcon name="alert" size={14} />
        Lesionado
      </button>
      <button type="button" aria-pressed={sanctioned} aria-expanded={sanOpen} aria-controls={sanOpen ? `${uid}-san` : undefined} onClick={() => setSanOpen((o) => !o)}>
        <AdIcon name="flag" size={14} />
        Sancionado
      </button>
    </span>
  );
  const sanBlock =
    sanctioned || sanOpen ? (
      <div className="san">
        {props.suspension ? (
          <p className="sanl">
            <AdIcon name="flag" size={14} />
            <span>{props.suspensionText}</span>
            <button
              type="button"
              className="btn sm line"
              onClick={() => {
                setSanOpen(false);
                props.onLift();
              }}
            >
              Levantar la sanción
            </button>
          </p>
        ) : null}
        {sanOpen ? (
          <SanctionBox
            id={`${uid}-san`}
            name={name}
            upcoming={props.upcoming}
            onCancel={() => setSanOpen(false)}
            onSave={(choice) => {
              setSanOpen(false);
              props.onSanction(choice);
            }}
          />
        ) : null}
      </div>
    ) : null;
  const nav = (
    <>
      <button type="button" className="btn sm sky" onClick={props.onNextGap ?? undefined} disabled={!props.onNextGap}>
        {props.onNextGap ? "Siguiente sin completar" : gaps.length ? "Es la última sin completar" : "Todas completas"}
        <AdIcon name="right" size={16} />
      </button>
      <span className="pn">
        <button type="button" className="ib2" onClick={props.onPrev} aria-label="Jugador anterior">
          <AdIcon name="back" size={16} />
        </button>
        {phone ? null : (
          <button type="button" className="ib2" onClick={props.onNext} aria-label="Jugador siguiente">
            <AdIcon name="right" size={16} />
          </button>
        )}
      </span>
    </>
  );

  const camiseta = (
    <section className="cd" aria-labelledby={`${uid}-c`}>
      <h3 id={`${uid}-c`}>Camiseta</h3>
      <div className="fld">
        <label htmlFor={`${uid}-n`}>Nombre en la camiseta · {form.shirtName.length}/12</label>
        <input
          className={nameErr ? "inp bad" : "inp"}
          id={`${uid}-n`}
          value={form.shirtName}
          onChange={(e) => set("shirtName", e.target.value.toLocaleUpperCase("es").slice(0, 12))}
          onBlur={onBlur}
          onKeyDown={onEnter}
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
        <label htmlFor={`${uid}-d`}>{dorsalLabel}</label>
        <input
          className={dorsal.tone === "bad" ? "inp bad" : "inp"}
          id={`${uid}-d`}
          value={form.number}
          onChange={(e) => set("number", digits(e.target.value, 2))}
          onBlur={onBlur}
          onKeyDown={onEnter}
          inputMode="numeric"
          maxLength={2}
          autoComplete="off"
          aria-invalid={dorsal.tone === "bad" || undefined}
          aria-describedby={`${uid}-dl`}
        />
        <Line check={dorsal} id={`${uid}-dl`} />
      </div>
      <div className="two">
        <div className="fld">
          <label htmlFor={`${uid}-fn`}>Nombre</label>
          <input className="inp" id={`${uid}-fn`} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} onBlur={onBlur} onKeyDown={onEnter} autoComplete="off" placeholder="Opcional" />
        </div>
        <div className="fld">
          <label htmlFor={`${uid}-ln`}>Apellidos</label>
          <input className="inp" id={`${uid}-ln`} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} onBlur={onBlur} onKeyDown={onEnter} autoComplete="off" placeholder="Opcional" />
        </div>
      </div>
      <div className="fld">
        <span className="lb" id={`${uid}-s`}>
          Temporadas
        </span>
        <div className="tgl" role="group" aria-labelledby={`${uid}-s`}>
          {seasons.map((s) => (
            <button key={s.id} type="button" aria-pressed={form.seasons.includes(s.id)} onClick={() => toggleSeason(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
      </div>
      {selectedSeasons.length ? (
        <details className="ovr">
          <summary>Nombre o dorsal distinto en una temporada</summary>
          {selectedSeasons.map((s) => {
            const o = form.overrides[s.id] ?? { shirtName: "", number: "" };
            const p = check.overrides[s.id];
            return (
              <div key={s.id} className="fld" role="group" aria-label={`Solo en la ${s.name}`}>
                <span className="lb">Solo en la {s.name} · vacío = el de arriba</span>
                <div className="two n">
                  <input className={p?.shirtName ? "inp bad" : "inp"} maxLength={12} placeholder={form.shirtName.trim() || "Camiseta"} aria-label={`Nombre en la camiseta solo en la ${s.name}`} value={o.shirtName} onChange={(e) => setOverride(s.id, "shirtName", e.target.value.toLocaleUpperCase("es"))} onBlur={onBlur} autoComplete="off" />
                  <input className={p?.number ? "inp bad" : "inp"} inputMode="numeric" maxLength={2} placeholder={form.number.trim() || "—"} aria-label={`Dorsal solo en la ${s.name}`} value={o.number} onChange={(e) => setOverride(s.id, "number", digits(e.target.value, 2))} onBlur={onBlur} autoComplete="off" />
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
        </details>
      ) : null}
    </section>
  );

  const miss = (k: (typeof GAPS)[number]["key"]) => (gaps.includes(k) ? "inp miss" : "inp");
  const datos = (
    <section className="cd" aria-labelledby={`${uid}-dt`}>
      <h3 id={`${uid}-dt`}>
        Datos<small className={gaps.length ? "" : "okc"}>{gaps.length ? `Faltan ${gaps.length}` : "Completa"}</small>
      </h3>
      <div className="fld">
        <label htmlFor={`${uid}-ph`}>Foto · enlace https://</label>
        <input
          className={photo === "bad" ? "inp bad" : miss("foto")}
          id={`${uid}-ph`}
          inputMode="url"
          placeholder="https://"
          value={form.photoUrl}
          onChange={(e) => set("photoUrl", e.target.value)}
          onBlur={onBlur}
          onKeyDown={onEnter}
          aria-invalid={photo === "bad" || undefined}
          aria-describedby={`${uid}-phl`}
        />
        <Line check={check.photo} id={`${uid}-phl`} />
      </div>
      <div className="fld">
        <label htmlFor={`${uid}-b`}>Nacimiento</label>
        <input className={miss("nac")} id={`${uid}-b`} type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} onBlur={onBlur} />
      </div>
      <div className="two">
        <div className="fld">
          <label htmlFor={`${uid}-h`}>Altura (cm)</label>
          <input className={check.height ? "inp bad" : miss("alt")} id={`${uid}-h`} inputMode="numeric" maxLength={3} placeholder="cm" value={form.height} onChange={(e) => set("height", digits(e.target.value, 3))} onBlur={onBlur} onKeyDown={onEnter} />
        </div>
        <div className="fld">
          <label htmlFor={`${uid}-w`}>Peso (kg)</label>
          <input className={check.weight ? "inp bad" : miss("peso")} id={`${uid}-w`} inputMode="numeric" maxLength={3} placeholder="kg" value={form.weight} onChange={(e) => set("weight", digits(e.target.value, 3))} onBlur={onBlur} onKeyDown={onEnter} />
        </div>
      </div>
      {check.height || check.weight ? (
        <span className="er">
          <AdIcon name="x" size={13} />
          {[check.height, check.weight].filter(Boolean).join(" ")}
        </span>
      ) : null}
    </section>
  );

  const cuenta = (
    <section className="cd" aria-labelledby={`${uid}-cw`}>
      <h3 id={`${uid}-cw`}>Cuenta y web</h3>
      <p className={`acc ${row.account}`}>
        <AdIcon name={row.account === "vinculada" ? "link" : row.account === "pide" ? "inbox" : "lock"} size={16} />
        <span>
          <b>{ACCOUNT_LABEL[row.account]}</b>
          {row.account === "vinculada" ? ` · ${row.who || "un socio"} entra al vestuario con su ficha` : row.account === "pide" ? ` · ${row.who || "un socio"} la ha pedido` : " · nadie entra al vestuario con su ficha"}
        </span>
      </p>
      {row.account === "pide" ? (
        <Link className="lnk" to="/admin/fichas">
          Revisar en Fichas
          <AdIcon name="right" size={14} />
        </Link>
      ) : null}
      <p className="acc">
        <AdIcon name="doc" size={16} />
        <span>
          <b>{story ? "Su historia está escrita" : "Sin historia"}</b> · la que sale en su perfil
        </span>
      </p>
      <Link className="lnk" to="/admin/contenido" search={{ seccion: "historias" }}>
        {story ? "Editar su historia" : "Escribir su historia"}
        <AdIcon name="right" size={14} />
      </Link>
      <a className="lnk" href={`/jugadores/${encodeURIComponent(player.id)}`} target="_blank" rel="noopener noreferrer">
        Ver su página
        <AdIcon name="ext" size={14} />
      </a>
      <span className="sp" />
      <button type="button" className="btn sm red baja" onClick={() => setAsking(true)} aria-haspopup="dialog">
        Dar de baja
      </button>
    </section>
  );

  const modal = (
    <ConfirmModal
      open={asking}
      onClose={() => setAsking(false)}
      title={`¿Dar de baja a ${name}?`}
      consequences={activeSeason ? [`Deja la plantilla de la ${activeSeason.name}`, "Sus actas, goles y su carta se quedan", "Se puede volver a dar de alta"] : ["Se borra su ficha de la plantilla", "Las actas ya publicadas no cambian", "Durante unos segundos se puede deshacer"]}
      confirmLabel="Dar de baja"
      confirmTone="redf"
      onConfirm={() => {
        setAsking(false);
        leaving.current = true;
        props.onBaja();
      }}
    />
  );
  const statLine = (
    <p className="st" aria-label={`${stats?.goals ?? 0} goles, ${stats?.assists ?? 0} asistencias, ${stats?.played ?? 0} partidos, ${stats?.mvps ?? 0} MVP`}>
      <span>
        <b>{stats?.goals ?? 0}</b>GOL
      </span>
      <span>
        <b>{stats?.assists ?? 0}</b>ASI
      </span>
      <span>
        <b>{stats?.played ?? 0}</b>PJ
      </span>
      <span>
        <b>{stats?.mvps ?? 0}</b>MVP
      </span>
    </p>
  );
  const head = (
    <p className="k2">
      <span>Ficha {at}</span>
      {gaps.length ? (
        slots
      ) : (
        <span className="okb">
          <AdIcon name="check" size={13} />
          Ficha completa
        </span>
      )}
      {dirty && !check.ok ? <span className="unsv">Sin guardar: revisa lo marcado</span> : null}
    </p>
  );

  if (phone)
    return (
      <section className="pl3f m" aria-label={`Ficha de ${name}`}>
        <div className="mback">
          <button type="button" className="ib2" onClick={props.onBack} aria-label="Volver a la plantilla">
            <AdIcon name="back" size={18} />
          </button>
          <b>Ficha {at}</b>
        </div>
        <div className="hero">
          {kit}
          <div className="hi">
            <h2 className="who">
              <b>{row.number ?? "—"}</b>
              {name}
            </h2>
            <p className="full">{fullT}</p>
            {gaps.length ? (
              slots
            ) : (
              <span className="okb">
                <AdIcon name="check" size={13} />
                Ficha completa
              </span>
            )}
          </div>
        </div>
        {posBlock}
        <div className="fld">
          <span className="lb">Estado</span>
          {stateSeg}
        </div>
        {sanBlock}
        {camiseta}
        {datos}
        {cuenta}
        <p className="svd">
          <AdIcon name="check" size={14} />
          Se guarda solo al salir de cada campo · «Deshacer» durante 5 s
        </p>
        <div className="mnav">{nav}</div>
        {modal}
      </section>
    );
  return (
    <section className="pl3f" aria-label={`Ficha de ${name}`}>
      <div className="hero posh">
        {kit}
        <div className="hi">
          {head}
          <h2 className="who">
            <b>{row.number ?? "—"}</b>
            {name}
          </h2>
          <p className="full">{fullT}</p>
          <div className="qk">
            <div className="fld">
              <span className="lb">Estado</span>
              {stateSeg}
            </div>
          </div>
          {sanBlock}
          {statLine}
        </div>
        {posBlock}
        <div className="nav2">
          {nav}
          <small className="kb">↑ ↓ para pasar de jugador</small>
        </div>
      </div>
      <div className="cols">
        {camiseta}
        {datos}
        {cuenta}
      </div>
      <p className="svd">
        <AdIcon name="check" size={14} />
        Se guarda solo al salir de cada campo · «Deshacer» durante 5 s
      </p>
      {modal}
    </section>
  );
}
