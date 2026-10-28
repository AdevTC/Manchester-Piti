// HOY Y PARTIDOS · Nuevo partido (/admin/partidos/nuevo), as the board (partidos.js nuevoVals / part-partidos.html § 2):
// over the season's list, the sheet (the centred dialog on the desktop) with the rival (required; it says when it is
// the return match, with the first leg's result, or when there is already a match against it), the season when the
// club has several, the date and the time (Madrid, a week after the last one), the condition, the competition and
// the ground from «Los campos» of the club (M-24, or another one written by hand). «Crear» opens its Datos, «Crear y
// convocar» its Convocatoria. It is created as a draft (saveMatchSheet: nobody is told), with «Deshacer» on the
// status strip. While it is being created nothing closes it (B-PAR-02).
import { useId, useRef, useState } from "react";
import { dateMillis } from "../../../../../functions/src/matchEngine";
import { opponentInitials } from "../../../../lib/clubAnalytics";
import { apiError, deleteMatch, saveMatchSheet } from "../../../../lib/clubApi";
import { useClubContent } from "../../../../lib/clubContent";
import { scoreOf } from "../../../../lib/partidos";
import { joinDate, proposeDate, splitDate } from "../../acta/dates";
import { defaultSheet, newId, toPayload } from "../../acta/sheetModel";
import { jLabel, shortDate, type AdminMatch } from "../../data/adminLogic";
import { returnOf } from "../../partidos/listModel";
import { useAdmin } from "../../shell/context";
import { SalaSheet } from "../../shell/Sheet";
import { useSalaGo } from "../../shell/salaHref";
import { useStatus } from "../../shell/statusContext";
import { COMPETITIONS } from "./matchWords";
import { TemporadaList } from "./Temporada";

export function NuevoScreen() {
  return <TemporadaList sheet={<NuevoSheet />} />;
}

export function NuevoSheet() {
  const data = useAdmin();
  const go = useSalaGo();
  const status = useStatus();
  const content = useClubContent();
  const venues = content.venues ?? [];
  const id = useId();
  const active = data.seasons.filter((s) => !s.archived);
  const [seasonId, setSeasonId] = useState(data.season && !data.season.archived ? data.season.id : (active.at(-1)?.id ?? ""));
  const inSeason = data.matches.filter((m) => m.seasonId === seasonId);
  const last = inSeason.reduce<AdminMatch | undefined>((a, m) => (!a || dateMillis(m.date) > dateMillis(a.date) ? m : a), undefined);
  const [when] = useState(() => splitDate(proposeDate(last ? dateMillis(last.date) : undefined, data.now)));
  const [rival, setRival] = useState("");
  const [date, setDate] = useState(when.date);
  const [time, setTime] = useState(when.time);
  const [home, setHome] = useState(true);
  const [comp, setComp] = useState<string>(last?.competition && (COMPETITIONS as readonly string[]).includes(last.competition) ? last.competition : "Liga");
  const [venue, setVenue] = useState<string>(venues.length ? "0" : "otro");
  const [venueOther, setVenueOther] = useState("");
  const [tried, setTried] = useState<"" | "rival" | "fecha">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rivalRef = useRef<HTMLInputElement>(null);
  const rv = rival.trim();
  const ms = joinDate(date, time);
  const back = returnOf(data.matches, seasonId, rv, data.now);
  const hint = back
    ? back.played
      ? (() => {
          const s = scoreOf(back.match);
          const has = typeof back.match.goalsFor === "number" || (back.match.events ?? []).length > 0;
          return `Es la vuelta: la ida fue la ${jLabel(back.match)}${has ? ` (${s.gf}–${s.ga})` : ""}`;
        })()
      : `Ya hay un partido contra ${back.match.rival} (${jLabel(back.match)}, ${shortDate(dateMillis(back.match.date))}) · ¿seguro que es otro?`
    : "";
  const close = () => {
    if (!busy) go("/admin/partidos");
  };

  const create = async (then: "datos" | "convocatoria") => {
    if (busy) return;
    setError("");
    if (!rv) {
      setTried("rival");
      rivalRef.current?.focus();
      return;
    }
    if (!Number.isFinite(ms)) return setTried("fecha");
    setTried("");
    if (!seasonId) return setError("Crea antes una temporada en Club › Temporadas.");
    const ground = venue === "otro" ? venueOther.trim() : (venues[Number(venue)]?.name ?? "");
    const sheet = defaultSheet(seasonId, { rival: rv, date: ms, competition: comp, home, kit: home ? "home" : "away", duration: last?.duration ?? 50, venue: ground });
    const p = toPayload(sheet, true, () => "");
    if (!p.ok) return setError(p.error);
    const mid = newId();
    setBusy(true);
    try {
      await saveMatchSheet({ id: mid, sheet: p.sheet, draft: true });
      setBusy(false);
      status.show({
        tag: "Borrador",
        message: `${rv} creado · ${ground ? "solo lo ven los capitanes" : "completa el campo cuando lo sepas"}`,
        undo: () => {
          void deleteMatch({ id: mid }).then(
            () => go("/admin/partidos"),
            (e: unknown) => status.show({ tone: "error", message: `No se ha podido deshacer: ${apiError(e)}` }),
          );
        },
      });
      go(`/admin/partidos/${mid}/${then}`);
    } catch (e) {
      setBusy(false);
      setError(apiError(e));
    }
  };

  return (
    <SalaSheet
      open
      center
      onClose={close}
      title="Nuevo partido"
      initialFocus={rivalRef}
      className="spa-new"
      footer={
        <>
          <button type="button" className="vd-btn vd-glass vd-press" onClick={close} aria-disabled={busy || undefined}>
            Cancelar
          </button>
          <button type="button" className="vd-btn vd-glass vd-press" onClick={() => void create("datos")} aria-disabled={busy || undefined}>
            {busy ? "Creando…" : "Crear"}
          </button>
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={() => void create("convocatoria")} aria-disabled={busy || undefined}>
            Crear y convocar
          </button>
        </>
      }
    >
      <form
        className="sc-form sc-form--1 spa-form"
        aria-busy={busy}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void create("datos");
        }}
      >
        <label className="sc-field">
          <span>Rival</span>
          <input
            ref={rivalRef}
            className="vd-input"
            type="text"
            maxLength={100}
            placeholder="Nombre completo del rival"
            value={rival}
            onChange={(e) => {
              setRival(e.target.value);
              if (tried === "rival") setTried("");
            }}
            aria-invalid={tried === "rival" || undefined}
            aria-describedby={`${id}-rh`}
            autoComplete="off"
          />
          <span id={`${id}-rh`}>
            {tried === "rival" ? (
              <small className="is-bad" role="alert">
                Pon el rival
              </small>
            ) : hint ? (
              <small className={back?.played ? "is-ok" : "is-bad"}>{hint}</small>
            ) : null}
          </span>
        </label>
        {active.length > 1 && (
          <label className="sc-field">
            <span>Temporada</span>
            <select className="vd-input" value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
              {active.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="spa-pair">
          <label className="sc-field">
            <span>Fecha</span>
            <input className="vd-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={tried === "fecha" || undefined} />
          </label>
          <label className="sc-field">
            <span>Hora (Madrid)</span>
            <input className="vd-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-invalid={tried === "fecha" || undefined} />
          </label>
        </div>
        {!date && time && <p className="sc-small spa-note">Falta la fecha · la hora se queda puesta.</p>}
        {tried === "fecha" && (
          <p className="sc-small spa-bad" role="alert">
            Pon una fecha y una hora válidas.
          </p>
        )}
        <div className="sc-field">
          <span id={`${id}-c`}>Condición</span>
          <div className="spa-two" role="group" aria-labelledby={`${id}-c`}>
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-pressed={home} onClick={() => setHome(true)}>
              Local
            </button>
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-pressed={!home} onClick={() => setHome(false)}>
              Visitante
            </button>
          </div>
          <small>{home ? "Local · 1ª equipación (celeste)" : "Visitante · 2ª equipación (negra)"}</small>
        </div>
        <div className="sc-field">
          <span id={`${id}-k`}>Competición</span>
          <div className="spa-two spa-three" role="group" aria-labelledby={`${id}-k`}>
            {COMPETITIONS.map((c) => (
              <button key={c} type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-pressed={comp === c} onClick={() => setComp(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <label className="sc-field">
          <span>Campo</span>
          <select className="vd-input" value={venue} onChange={(e) => setVenue(e.target.value)}>
            {venues.map((v, i) => (
              <option key={v.name} value={String(i)}>
                {v.name}
              </option>
            ))}
            <option value="otro">Otro campo</option>
          </select>
          {!venues.length && <small>El club no tiene campos en su lista (Club › La web): escribe este.</small>}
        </label>
        {venue === "otro" && (
          <label className="sc-field">
            <span>Nombre del campo</span>
            <input className="vd-input" type="text" maxLength={120} placeholder="Se puede dejar para luego" value={venueOther} onChange={(e) => setVenueOther(e.target.value)} />
          </label>
        )}
        <p className="sc-small spa-note">
          Iniciales: <b>{rv ? opponentInitials(rv) : "—"}</b> · el campo, los anotadores y el resto, en Datos.
        </p>
        {error && (
          <p className="sc-small spa-bad" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="vd-vh" tabIndex={-1} aria-hidden="true">
          Crear
        </button>
      </form>
    </SalaSheet>
  );
}
