// «Nuevo partido», as on the canvas (stats-gen/ad-v2-full.mjs `nuevoM`): the rival (required, its full name;
// it says when it is the return match, with the first leg's result), the date and the time (Madrid), the
// condition, and the initials worked out as you type — the field and the rest go in Encuentro. It creates
// the match as a draft (saveMatchSheet, nothing is announced yet) and opens it; the caption offers
// «Deshacer» (deleteMatch).
import { useId, useRef, useState } from "react";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { opponentInitials } from "../../../lib/clubAnalytics";
import { apiError, saveMatchSheet } from "../../../lib/clubApi";
import { scoreOf } from "../../../lib/partidos";
import type { SeasonDoc } from "../../../lib/schemas";
import { jLabel, shortDate, type AdminMatch } from "../data/adminLogic";
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
  /** Created (a draft): open it. `j` = «J9», `rival` as written. */
  onCreated: (o: { id: string; j: string; rival: string }) => void;
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
  const [home, setHome] = useState(true);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rivalRef = useRef<HTMLInputElement>(null);
  const rv = rival.trim();
  const ms = joinDate(date, time);
  const back = returnOf(matches, seasonId, rv, now);
  const backText = back
    ? back.played
      ? (() => {
          const s = scoreOf(back.match);
          const hasScore = typeof back.match.goalsFor === "number" || (back.match.events ?? []).length > 0;
          return `Es la vuelta: la ida fue la ${jLabel(back.match)}${hasScore ? ` (${s.gf}–${s.ga})` : ""}`;
        })()
      : `Ya hay un partido contra ${back.match.rival} (${jLabel(back.match)}, ${shortDate(dateMillis(back.match.date))}) · ¿seguro que es otro?`
    : "";

  const create = async () => {
    if (busy) return;
    setTried(true);
    setError("");
    if (!rv) {
      rivalRef.current?.focus();
      return;
    }
    if (!seasonId) return setError("Crea antes una temporada en «Temporadas».");
    if (!Number.isFinite(ms)) return setError("Pon una fecha y una hora válidas.");
    const sheet = defaultSheet(seasonId, { rival: rv, date: ms, competition: last?.competition || "Liga", home, kit: home ? "home" : "away", duration: last?.duration ?? 50 });
    const p = toPayload(sheet, true, () => "");
    if (!p.ok) return setError(p.error);
    const mid = newId();
    setBusy(true);
    try {
      await saveMatchSheet({ id: mid, sheet: p.sheet, draft: true });
      const n = inSeason.filter((m) => dateMillis(m.date) < ms).length + 1;
      onCreated({ id: mid, j: `J${n}`, rival: rv });
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
      title="Nuevo partido"
      footer={
        <>
          <button type="button" className="btn line" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn sky" aria-disabled={busy} onClick={() => void create()}>
            {busy ? "Creando…" : "Crear y abrir"}
          </button>
        </>
      }
    >
      <form
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="fld">
          <label htmlFor={`${id}-rv`}>Rival</label>
          <input
            id={`${id}-rv`}
            ref={rivalRef}
            className={`inp${tried && !rv ? " bad" : ""}`}
            value={rival}
            maxLength={100}
            onChange={(e) => setRival(e.target.value)}
            placeholder="Nombre completo del rival"
            aria-invalid={(tried && !rv) || undefined}
            aria-describedby={`${id}-rk`}
            autoComplete="off"
          />
          <span id={`${id}-rk`}>
            {tried && !rv ? (
              <span className="bad" style={{ fontSize: 13 }}>
                <AdIcon name="x" size={13} />
                Pon el rival
              </span>
            ) : back ? (
              <span className={back.played ? "okk" : "warn"} style={{ fontSize: 13 }}>
                {backText}
              </span>
            ) : null}
          </span>
        </div>
        {active.length > 1 && (
          <div className="fld">
            <label htmlFor={`${id}-t`}>Temporada</label>
            <select id={`${id}-t`} className="inp" value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
              {active.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="f2">
          <div className="fld">
            <label htmlFor={`${id}-f`}>Fecha</label>
            <input id={`${id}-f`} className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="fld">
            <label htmlFor={`${id}-h`}>Hora (Madrid)</label>
            <input id={`${id}-h`} className="inp" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div className="fld">
          <span className="lb" id={`${id}-c`}>
            Condición
          </span>
          <div className="sgf" role="group" aria-labelledby={`${id}-c`}>
            <button type="button" aria-pressed={home} onClick={() => setHome(true)}>
              Local
            </button>
            <button type="button" aria-pressed={!home} onClick={() => setHome(false)}>
              Visitante
            </button>
          </div>
        </div>
        <p className="hint">Iniciales: {rv ? opponentInitials(rv) : "—"} · el campo y el resto, en Encuentro.</p>
        {error && (
          <p className="ferr" role="alert">
            <AdIcon name="alert" size={15} />
            {error}
          </p>
        )}
        <button type="submit" className="sr" tabIndex={-1} aria-hidden="true">
          Crear
        </button>
      </form>
    </Modal>
  );
}
