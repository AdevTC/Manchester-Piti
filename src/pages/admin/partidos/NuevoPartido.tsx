// «Nuevo partido»: lo mínimo para el calendario — rival (obligatorio; avisa si es la vuelta; iniciales
// automáticas), fecha, hora (Madrid), competición, condición y campo (opcional). Creates the match as a
// draft (saveMatchSheet, like the old editor's «Guardar borrador») and opens it.
import { useId, useRef, useState } from "react";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { opponentInitials } from "../../../lib/clubAnalytics";
import { apiError, saveMatchSheet } from "../../../lib/clubApi";
import type { SeasonDoc } from "../../../lib/schemas";
import { clockTime, jLabel, shortDate, type AdminMatch } from "../data/adminLogic";
import { FieldCheck, Segmented } from "../ui/controls";
import { AdIcon } from "../ui/icons";
import { Modal } from "../ui/layers";
import { joinDate, proposeDate, splitDate } from "../acta/dates";
import { defaultSheet, newId, toPayload } from "../acta/sheetModel";
import { returnOf } from "./listModel";

export interface NuevoPartidoProps {
  matches: readonly AdminMatch[];
  seasons: readonly SeasonDoc[];
  /** The season the admin is about. */
  season: SeasonDoc | null;
  now: number;
  onClose: () => void;
  /** The match was created: open it. */
  onCreated: (id: string, message: string) => void;
}

export function NuevoPartido({ matches, seasons, season, now, onClose, onCreated }: NuevoPartidoProps) {
  const id = useId();
  const active = seasons.filter((s) => !s.archived);
  const [seasonId, setSeasonId] = useState(season && !season.archived ? season.id : (active.at(-1)?.id ?? ""));
  const inSeason = matches.filter((m) => m.seasonId === seasonId);
  const last = inSeason.reduce<AdminMatch | undefined>((a, m) => (!a || dateMillis(m.date) > dateMillis(a.date) ? m : a), undefined);
  const [when] = useState(() => splitDate(proposeDate(last ? dateMillis(last.date) : undefined, now)));
  const [rival, setRival] = useState("");
  const [date, setDate] = useState(when.date);
  const [time, setTime] = useState(when.time);
  const [competition, setCompetition] = useState(last?.competition || "Liga");
  const [home, setHome] = useState(true);
  const [venue, setVenue] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rivalRef = useRef<HTMLInputElement>(null);
  const rv = rival.trim();
  const ms = joinDate(date, time);
  const back = returnOf(matches, seasonId, rv, now);
  const check: { tone: "ok" | "bad" | "mut"; text: string } =
    tried && !rv
      ? { tone: "bad", text: "Falta el rival" }
      : back
        ? { tone: "mut", text: back.played ? `Ya jugasteis contra ${back.match.rival} en la ${jLabel(back.match)} · será la vuelta` : `Ya hay un partido contra ${back.match.rival} (${jLabel(back.match)}, ${shortDate(dateMillis(back.match.date))}) · ¿seguro que es otro?` }
        : rv
          ? { tone: "ok", text: `Iniciales: ${opponentInitials(rv)} (editables luego)` }
          : { tone: "mut", text: "Obligatorio" };

  const create = async () => {
    setTried(true);
    setError("");
    if (!rv) return;
    if (!seasonId) return setError("Crea antes una temporada en «Temporadas».");
    if (!Number.isFinite(ms)) return setError("Pon una fecha y una hora válidas.");
    const sheet = defaultSheet(seasonId, { rival: rv, date: ms, competition: competition.trim() || "Liga", home, venue: venue.trim(), duration: last?.duration ?? 50 });
    const p = toPayload(sheet, true, () => "");
    if (!p.ok) return setError(p.error);
    const mid = newId();
    setBusy(true);
    try {
      await saveMatchSheet({ id: mid, sheet: p.sheet, draft: true });
      const n = inSeason.filter((m) => dateMillis(m.date) < ms).length + 1;
      onCreated(mid, `J${n} · ${rv} creado · ${shortDate(ms)}, ${clockTime(ms)}.`);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      initialFocus={rivalRef}
      kicker="Partidos y actas"
      title="Nuevo partido"
      lede="Lo mínimo para el calendario. Convocatoria y acta se rellenan después, desde el propio partido."
      footer={
        <>
          {error && (
            <p className="note ad-ferr" role="alert">
              <AdIcon name="alert" size={15} />
              {error}
            </p>
          )}
          <button type="button" className="btn sm line" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn sm gold" aria-disabled={!rv || busy} onClick={() => !busy && void create()}>
            {busy ? "Creando…" : "Crear partido"}
          </button>
        </>
      }
    >
      <form
        className="fg2 ad-nv"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void create();
        }}
      >
        <div className="fld w2">
          <label className="lbl" htmlFor={`${id}-rv`}>
            Rival
          </label>
          <input
            id={`${id}-rv`}
            ref={rivalRef}
            className={`inp ${tried && !rv ? "bad" : rv && !back ? "good" : ""}`.trim()}
            value={rival}
            maxLength={100}
            onChange={(e) => setRival(e.target.value)}
            placeholder="Nombre del rival"
            aria-describedby={`${id}-r`}
            aria-invalid={(tried && !rv) || undefined}
            autoComplete="off"
          />
          <FieldCheck id={`${id}-r`} tone={check.tone}>
            {check.text}
          </FieldCheck>
        </div>
        {active.length > 1 && (
          <label className="fld w2">
            <span className="lbl">Temporada</span>
            <select className="inp" value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
              {active.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="fld">
          <span className="lbl">Fecha</span>
          <input className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="fld">
          <span className="lbl">Hora (Madrid)</span>
          <input className="inp tn" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="fld">
          <span className="lbl">Competición</span>
          <select className="inp" value={["Liga", "Copa", "Amistoso"].includes(competition) ? competition : "__otra"} onChange={(e) => setCompetition(e.target.value === "__otra" ? competition : e.target.value)}>
            <option value="Liga">Liga</option>
            <option value="Copa">Copa</option>
            <option value="Amistoso">Amistoso</option>
            {!["Liga", "Copa", "Amistoso"].includes(competition) && <option value="__otra">{competition}</option>}
          </select>
        </label>
        <div className="fld">
          <span className="lbl" id={`${id}-c`}>
            Condición
          </span>
          <Segmented labelledBy={`${id}-c`} value={home ? "home" : "away"} options={[{ value: "home", label: "Local" }, { value: "away", label: "Visitante" }]} onChange={(v) => setHome(v === "home")} />
        </div>
        <label className="fld w2">
          <span className="lbl">Campo</span>
          <input className="inp" value={venue} maxLength={200} onChange={(e) => setVenue(e.target.value)} placeholder="Nombre y dirección (se puede dejar para luego)" />
        </label>
        <button type="submit" className="sr" tabIndex={-1} aria-hidden="true">
          Crear
        </button>
      </form>
    </Modal>
  );
}
