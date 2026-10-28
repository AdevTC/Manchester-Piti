// HOY Y PARTIDOS · the match's Datos (/admin/partidos/<id>/datos), as the board (partidos.js datosVals /
// part-partidos.html § 6): the rival (name, initials, code on the scoreboard, crest), when (date, time, duration,
// competition, season — moving it asks first: the convocatoria and the acta start again), where (the club's «Los
// campos», M-24, or another written by hand; condition; kit), the state (programado · aplazado with its reason and new
// date · cancelado), who keeps la mesa, the video and the weather. «¿Se jugó?» on top of one that never reached la mesa
// (`?estado=aplazado|cancelado` from Hoy opens it already marked). The fields edit the match's one sheet, shared with
// the acta's stations (acta/sheetSession: the unsaved edits survive a change of station, leaving asks first); the foot
// saves it: «Guardar borrador» + «Publicar en el calendario» for a draft, «Guardar» for one in the calendar.
// B-ENC-01: a time typed before the date stays in its field until the date comes.
import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { useRouterState } from "@tanstack/react-router";
import { isYouTubeUrl } from "../../../../../functions/src/matchVideo";
import { opponentInitials } from "../../../../lib/clubAnalytics";
import { apiError, setMatchScorers } from "../../../../lib/clubApi";
import { useClubContent } from "../../../../lib/clubContent";
import { venueInfo, venueKey } from "../../../../lib/derived/venue";
import { rivalCode } from "../../../../lib/eventMeta";
import { useMatchWeather } from "../../../../lib/weather";
import { joinDate, splitDate } from "../../acta/dates";
import { changeSeason, okHttps, POSTPONED_REASON_MAX, type MatchSheet } from "../../acta/sheetModel";
import { clockTime, shortDate } from "../../data/adminLogic";
import { joinVenue, splitVenue } from "../../partidos/workspaceModel";
import { usePartido } from "../../partido/partidoContext";
import { useAdmin } from "../../shell/context";
import { SalaLink } from "../../shell/SalaLink";
import { useSalaGo } from "../../shell/salaHref";
import { useStatus } from "../../shell/statusContext";
import { useMatchScorers } from "../../../vestuario/live";
import { useSheetSession } from "../acta/sheetSession";
import { isoDay, plural } from "./fmt";
import { COMPETITIONS, isDraftOnly, isPlayed } from "./matchWords";
import { Shirt } from "./Shirt";
// (the Vidrio controls these screens use, vd-seg and vd-switch: the sala does not load them by itself)
import "../../../../styles/vidrio/components.css";
import "./partidos.css";

type Estado = "programado" | "aplazado" | "cancelado";
const ESTADOS: [Estado, string][] = [
  ["programado", "Programado"],
  ["aplazado", "Aplazado"],
  ["cancelado", "Cancelado"],
];
const estadoOf = (s: MatchSheet["status"]): Estado => (s === "postponed" ? "aplazado" : s === "cancelled" ? "cancelado" : "programado");

export function DatosScreen() {
  const { match } = usePartido();
  return <Datos key={match.id} />;
}

function Datos() {
  const data = useAdmin();
  const go = useSalaGo();
  const status = useStatus();
  const id = useId();
  const { match: m, phase, j, base } = usePartido();
  const s = useSheetSession();
  const sheet = s.sheet;
  const content = useClubContent();
  const venues = useMemo(() => content.venues ?? [], [content.venues]);
  const draft = isDraftOnly(m);
  const played = isPlayed(phase) || sheet.status === "finished";
  const set = <K extends keyof MatchSheet>(k: K, v: MatchSheet[K]) => s.update((x) => ({ ...x, [k]: v }));

  // ?estado= from Hoy («Aplazado», «No se jugó»): the state already chosen, unsaved; the address drops it
  const search = useRouterState({ select: (r) => r.location.search as Record<string, unknown> });
  const qEstado = search.estado === "aplazado" || search.estado === "cancelado" ? search.estado : null;
  useEffect(() => {
    if (!qEstado) return;
    s.update((x) => ({ ...x, status: qEstado === "aplazado" ? "postponed" : "cancelled" }));
    go(`${base}/datos`, { replace: true });
    // (once per address: the update is the captain's choice, the buffer keeps it)
  }, [qEstado]); // eslint-disable-line react-hooks/exhaustive-deps -- only when the address brings a state; `s` changes every render

  // B-ENC-01: the date and the time as typed; the sheet gets the instant once both are there
  const split = useMemo(() => (Number.isFinite(sheet.date) ? splitDate(sheet.date) : null), [sheet.date]);
  // (only while a time waits for its date: what was typed; otherwise the sheet's)
  const [partial, setPartial] = useState<{ date: string; time: string } | null>(null);
  const when = partial ?? split ?? { date: "", time: "" };
  const setWhenPart = (part: "date" | "time", v: string) => {
    const next = { ...when, [part]: v };
    if (next.date) {
      setPartial(null);
      set("date", joinDate(next.date, next.time || "12:00"));
    } else {
      setPartial(next);
      set("date", NaN);
    }
  };
  const postponed = useMemo(() => (typeof sheet.postponedTo === "number" && Number.isFinite(sheet.postponedTo) ? splitDate(sheet.postponedTo) : { date: "", time: "" }), [sheet.postponedTo]);

  const estado = estadoOf(sheet.status);
  const setEstado = (e: Estado) =>
    s.update((x) => ({
      ...x,
      status: e === "aplazado" ? "postponed" : e === "cancelado" ? "cancelled" : played && x.status === "finished" ? "finished" : "scheduled",
      ...(e !== "aplazado" ? { postponedReason: "", postponedTo: null } : {}),
    }));

  // the ground: one of the club's (M-24) or another by hand
  const v = splitVenue(sheet.venue ?? "");
  const clubVenue = venueInfo(v.name, venues);
  const [other, setOther] = useState(() => !!sheet.venue && !clubVenue);
  const venueSel = other || !clubVenue ? "otro" : String(venues.findIndex((x) => venueKey(x.name) === venueKey(clubVenue.name)));
  const pickVenue = (val: string) => {
    if (val === "otro") {
      setOther(true);
      set("venue", "");
      return;
    }
    setOther(false);
    set("venue", venues[Number(val)]?.name ?? "");
  };

  // validation (said under each field and in the foot)
  const err: Partial<Record<"rival" | "code" | "logo" | "duration" | "reason" | "video" | "date", string>> = {};
  if (!sheet.rival.trim()) err.rival = "Pon el rival";
  const code = sheet.rivalShort ?? "";
  if (code && !/^[\p{L}\p{N}]{2,4}$/u.test(code)) err.code = "De 2 a 4 letras o números";
  const logo = sheet.rivalLogoUrl ?? "";
  if (logo && !okHttps(logo)) err.logo = "No es HTTPS: la web no lo enseña";
  if (!Number.isFinite(sheet.duration) || sheet.duration < 10 || sheet.duration > 150) err.duration = "Entre 10 y 150 minutos";
  if ((sheet.postponedReason ?? "").length > POSTPONED_REASON_MAX) err.reason = `Como mucho ${POSTPONED_REASON_MAX} letras`;
  const video = (sheet.videoUrl ?? "").trim();
  if (video && !isYouTubeUrl(video)) err.video = "No es un enlace de un vídeo de YouTube";
  if (when.time && !when.date) err.date = `Falta la fecha: la hora ${when.time} se queda guardada aquí hasta que la pongas`;
  const errs = Object.values(err);

  // the season: moving it empties the convocatoria and the acta (asked first)
  const seasons = data.seasons.filter((x) => !x.archived || x.id === sheet.seasonId);
  const called = (sheet.starters?.length ?? 0) + (sheet.bench?.length ?? 0);
  const nEv = sheet.events?.length ?? 0;
  const [askSeason, setAskSeason] = useState<string | null>(null);
  const pickSeason = (val: string) => {
    if (val === sheet.seasonId) return;
    if (called || nEv) setAskSeason(val);
    else s.update((x) => changeSeason(x, val));
  };
  const seasonChanged = sheet.seasonId !== (m.seasonId ?? "");

  // who keeps la mesa (setMatchScorers: at once, a published match only)
  const scorersQ = useMatchScorers(m.id);
  const scorers = scorersQ.data;
  const people = data.people.filter((u) => !u.removed && u.role !== "admin" && u.role !== "superadmin");
  const toggleScorer = async (uid: string, name: string) => {
    if (draft) return status.show({ tag: "Todavía no", message: "Es un borrador: los anotadores se eligen cuando esté en el calendario." });
    const on = scorers.includes(uid);
    try {
      await setMatchScorers({ matchId: m.id, uids: on ? scorers.filter((x) => x !== uid) : [...scorers, uid] });
      status.show({ tag: "La mesa", message: on ? `${name} ya no anota la ${j}` : `Lo anota ${name} desde la mesa` });
    } catch (e) {
      status.show({ tone: "error", message: `No se ha podido cambiar: ${apiError(e)}` });
    }
  };
  const scorerNames = people.filter((u) => scorers.includes(u.uid)).map((u) => u.nickname || u.displayName);

  // the weather: the stamp of the day, or the forecast in its last week
  const forecast = useMatchWeather(phase === "antes" ? { venue: sheet.venue, date: sheet.date } : undefined, data.now);
  const stamp = m.weatherAtKickoff;
  const t = sheet.date;
  const weather = stamp
    ? `Hizo ${stamp.temp}°, ${stamp.label.toLowerCase()}`
    : !Number.isFinite(t)
      ? "Sin fecha, sin pronóstico"
      : t < data.now
        ? "No se guardó el tiempo de ese día"
        : forecast
          ? `Pronóstico para las ${clockTime(t)}: ${forecast.temp}°, ${forecast.label.toLowerCase()}${forecast.rain != null ? `, ${Math.round(forecast.rain)} mm` : ""}`
          : t - data.now < 7 * 86_400_000
            ? "El pronóstico llega solo una semana antes"
            : `El pronóstico sale una semana antes (el ${shortDate(t - 7 * 86_400_000)})`;

  const rivals = useMemo(() => {
    const seen = new Set<string>();
    return [...data.matches, ...data.archivedMatches].map((x) => (x.rival ?? "").replace(/\s+/g, " ").trim()).filter((r) => r && !seen.has(r.toLowerCase()) && seen.add(r.toLowerCase()));
  }, [data.matches, data.archivedMatches]);

  const save = async (publish: boolean) => {
    if (errs.length) return status.show({ tone: "error", message: errs[0] });
    if (draft) return publish ? void (await s.saveCalendar(true)) : void (await s.saveDraft());
    if (played) return void (await s.saveDraft());
    await s.saveCalendar(false);
  };
  const footWhy = errs.length
    ? errs[0]
    : draft
      ? "Borrador · el calendario aún no lo tiene"
      : estado === "aplazado"
        ? "Aplazado · pon la nueva fecha cuando la sepas"
        : estado === "cancelado"
          ? "Cancelado · no cuenta para las estadísticas"
          : played
            ? "Jugado · los cambios llegan a la web al publicar el acta"
            : `Por jugar · ${when.date ? `${isoDay(when.date)} ${when.time}` : "sin fecha"}`;
  const pend = phase === "pendiente" && estado === "programado";
  const kitSrc: "home" | "away" = sheet.kit === "away" ? "away" : "home";
  const busy = !!s.busy;

  return (
    <div className="pa-datos">
      <div className="pa-dscroll">
        {s.clash && (
          <p className="pa-pend" role="status">
            <b>{s.clash.kind === "mesa" ? `La mesa ha mandado ${plural(s.clash.count, "jugada", "jugadas")}` : "Otro capitán ha cambiado este partido"}</b>
            <span className="sc-small">{s.clash.lines.slice(0, 2).join(" · ")}</span>
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={s.takeIn}>
              Recargar y conservar mis cambios
            </button>
          </p>
        )}
        {pend && (
          <section className="pa-pend" aria-labelledby="pa-pend-t">
            <h2 className="sc-h2" id="pa-pend-t">
              ¿Qué pasó con la {j}?
            </h2>
            <p className="sc-p">
              Era el {Number.isFinite(t) ? `${shortDate(t)} a las ${clockTime(t)}` : "día del partido"} y no llegó a la mesa: sin reloj y sin acta.
            </p>
            <div className="sc-btnrow">
              <SalaLink className="vd-btn vd-glass vd-press vd-btn--pri" to={`${base}/acta`}>
                Se jugó · al acta
              </SalaLink>
              <button type="button" className="vd-btn vd-glass vd-press" onClick={() => setEstado("aplazado")}>
                Aplazado
              </button>
              <button type="button" className="vd-btn vd-glass vd-press" onClick={() => setEstado("cancelado")}>
                No se jugó
              </button>
            </div>
          </section>
        )}
        <div className="pa-dgrid">
          <section className="pa-dsec" aria-labelledby={`${id}-d1`}>
            <h2 className="sc-h3" id={`${id}-d1`}>
              El rival
            </h2>
            <div className="sc-form">
              <label className="sc-field sc-field--wide">
                <span>Nombre</span>
                <input className="vd-input" type="text" maxLength={100} aria-label="Nombre del rival" list={`${id}-rivals`} placeholder="Nombre completo del rival" value={sheet.rival} onChange={(e) => set("rival", e.target.value)} aria-invalid={!!err.rival || undefined} />
                {err.rival && <small className="is-bad">{err.rival}</small>}
                <datalist id={`${id}-rivals`}>
                  {rivals.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </label>
              <label className="sc-field">
                <span>Iniciales</span>
                <input className="vd-input" type="text" maxLength={3} placeholder={sheet.rival.trim() ? opponentInitials(sheet.rival) : "Auto"} value={sheet.rivalInitials ?? ""} onChange={(e) => set("rivalInitials", e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())} />
                <small>Las del disco del rival</small>
              </label>
              <label className="sc-field">
                <span>Código en el marcador</span>
                <input className="vd-input" type="text" maxLength={4} autoCapitalize="characters" placeholder={rivalCode(sheet.rival || "Rival")} value={code} onChange={(e) => set("rivalShort", e.target.value.replace(/[^\p{L}\p{N}]/gu, "").toLocaleUpperCase("es"))} aria-invalid={!!err.code || undefined} />
                {err.code && <small className="is-bad">{err.code}</small>}
                <small>De 2 a 4 letras, para la mesa y el directo. Vacío: {rivalCode(sheet.rival || "Rival")}.</small>
              </label>
              <div className="sc-field sc-field--wide pa-logo">
                <label className="sc-field">
                  <span>Escudo del rival (HTTPS, opcional)</span>
                  <input className="vd-input" type="url" placeholder="https://…" value={logo} onChange={(e) => set("rivalLogoUrl", e.target.value)} aria-invalid={!!err.logo || undefined} />
                </label>
                {logo && !err.logo && (
                  <p className="pa-logo__p">
                    <img src={logo} alt="El escudo del rival, tal como sale en la web" width={44} height={44} />
                    <small className="is-ok">Se ve bien</small>
                  </p>
                )}
                {err.logo && <small className="is-bad">{err.logo}</small>}
              </div>
            </div>
          </section>

          <section className="pa-dsec" aria-labelledby={`${id}-d2`}>
            <h2 className="sc-h3" id={`${id}-d2`}>
              Cuándo
            </h2>
            <div className="sc-form">
              <label className="sc-field">
                <span>Fecha</span>
                <input className="vd-input" type="date" value={when.date} onChange={(e) => setWhenPart("date", e.target.value)} aria-invalid={!!err.date || undefined} />
                {err.date && <small className="is-bad">{err.date}</small>}
              </label>
              <label className="sc-field">
                <span>Hora (Madrid)</span>
                <input className="vd-input" type="time" value={when.time} onChange={(e) => setWhenPart("time", e.target.value)} />
              </label>
              <label className="sc-field">
                <span>Duración (min)</span>
                <input className="vd-input" type="text" inputMode="numeric" value={Number.isFinite(sheet.duration) ? String(sheet.duration) : ""} onChange={(e) => set("duration", Number(e.target.value.replace(/\D/g, "").slice(0, 3)) || NaN)} aria-invalid={!!err.duration || undefined} />
                {err.duration && <small className="is-bad">{err.duration}</small>}
                <small>La mesa la usa para la barra y el «Fin» sugerido</small>
              </label>
              <div className="sc-field">
                <span id={`${id}-comp`}>Competición</span>
                <div className="pa-two pa-three" role="group" aria-labelledby={`${id}-comp`}>
                  {COMPETITIONS.map((c) => (
                    <button key={c} type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-pressed={sheet.competition === c} onClick={() => set("competition", c)}>
                      {c}
                    </button>
                  ))}
                </div>
                {!(COMPETITIONS as readonly string[]).includes(sheet.competition) && sheet.competition && <small>Ahora: {sheet.competition}</small>}
              </div>
              <label className="sc-field">
                <span>Temporada</span>
                <select className="vd-input" value={sheet.seasonId} onChange={(e) => pickSeason(e.target.value)}>
                  {!sheet.seasonId && <option value="">Elegir temporada</option>}
                  {seasons.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                      {x.archived ? " · archivada" : ""}
                    </option>
                  ))}
                </select>
                {seasonChanged && <small className="is-bad">Cambia de temporada al guardar: la convocatoria y el acta empiezan de cero.</small>}
              </label>
              <p className="sc-small sc-field--wide">Jornada: {m.jornada ? `J${m.jornada} · se numera sola por la fecha entre los partidos del calendario` : "sin jornada: la tendrá al publicarlo en el calendario"}.</p>
            </div>
            {askSeason && (
              <div className="pa-ask vd-glass" role="alertdialog" aria-labelledby={`${id}-ask`}>
                <h3 className="sc-h3" id={`${id}-ask`}>
                  ¿Pasar a la {data.seasons.find((x) => x.id === askSeason)?.name ?? "otra temporada"}?
                </h3>
                <p className="sc-small">Cada temporada tiene su plantilla: la convocatoria y el acta empiezan de cero.</p>
                <ul className="pa-cons">
                  {called > 0 && <li>Se vacía la convocatoria ({plural(called, "jugador asignado", "jugadores asignados")})</li>}
                  {nEv > 0 && <li>Se borran {plural(nEv, "evento", "eventos")} y el marcador vuelve a 0–0</li>}
                  <li>No se guarda hasta que pulses «Guardar»</li>
                </ul>
                <div className="sc-btnrow">
                  <button type="button" className="vd-btn vd-glass vd-press" onClick={() => setAskSeason(null)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="vd-btn vd-glass vd-press pa-danger"
                    onClick={() => {
                      s.update((x) => changeSeason(x, askSeason));
                      setAskSeason(null);
                    }}
                  >
                    Cambiar de temporada
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="pa-dsec" aria-labelledby={`${id}-d3`}>
            <h2 className="sc-h3" id={`${id}-d3`}>
              Dónde
            </h2>
            <div className="sc-form">
              <label className="sc-field sc-field--wide">
                <span>Campo</span>
                <select className="vd-input" value={venueSel} onChange={(e) => pickVenue(e.target.value)}>
                  {venues.map((x, i) => (
                    <option key={x.name} value={String(i)}>
                      {x.name}
                    </option>
                  ))}
                  <option value="otro">Otro campo</option>
                </select>
                {venueSel !== "otro" && clubVenue && <small>{[clubVenue.address, clubVenue.transit].filter(Boolean).join(" · ") || clubVenue.name} · de la lista del club: la web enseña el mapa y cómo llegar</small>}
                {!venues.length && <small>El club no tiene campos en su lista (Club › La web): escribe este a mano.</small>}
              </label>
              {venueSel === "otro" && (
                <>
                  <label className="sc-field">
                    <span>Nombre del campo</span>
                    <input className="vd-input" type="text" maxLength={120} placeholder="Se puede dejar para luego" value={v.name} onChange={(e) => set("venue", joinVenue(e.target.value, v.address))} />
                  </label>
                  <label className="sc-field">
                    <span>Dirección</span>
                    <input className="vd-input" type="text" maxLength={120} placeholder="Calle, número, localidad" value={v.address} onChange={(e) => set("venue", joinVenue(v.name, e.target.value))} />
                    <small>La dirección abre el mapa en la ficha del partido</small>
                  </label>
                </>
              )}
              <div className="sc-field">
                <span id={`${id}-cond`}>Condición</span>
                <div className="pa-two" role="group" aria-labelledby={`${id}-cond`}>
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-pressed={sheet.home !== false} onClick={() => s.update((x) => ({ ...x, home: true, kit: "home" }))}>
                    Local
                  </button>
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-pressed={sheet.home === false} onClick={() => s.update((x) => ({ ...x, home: false, kit: "away" }))}>
                    Visitante
                  </button>
                </div>
              </div>
              <div className="sc-field">
                <span id={`${id}-kit`}>Equipación</span>
                <div className="pa-kit">
                  <Shirt blank={false} kit={kitSrc} size="s" who={{ name: "", number: "" }} />
                  <div className="pa-two" role="group" aria-labelledby={`${id}-kit`}>
                    <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-pressed={kitSrc === "home"} onClick={() => set("kit", "home")}>
                      1ª celeste
                    </button>
                    <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-pressed={kitSrc === "away"} onClick={() => set("kit", "away")}>
                      2ª negra
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="pa-dsec" aria-labelledby={`${id}-d4`}>
            <h2 className="sc-h3" id={`${id}-d4`}>
              Estado
            </h2>
            <div className="vd-seg vd-glass pa-seg pa-seg--3" role="radiogroup" aria-labelledby={`${id}-d4`} style={{ "--n": 3, "--i": ESTADOS.findIndex((x) => x[0] === estado) } as CSSProperties}>
              <span className="vd-shelf__bead" aria-hidden="true" />
              {ESTADOS.map(([k, label]) => (
                <button key={k} type="button" role="radio" className="vd-seg__b" aria-checked={estado === k} onClick={() => setEstado(k)}>
                  {label}
                </button>
              ))}
            </div>
            {estado === "aplazado" && (
              <div className="sc-form pa-apl">
                <label className="sc-field sc-field--wide">
                  <span>Motivo del aplazamiento</span>
                  <input className="vd-input" type="text" maxLength={POSTPONED_REASON_MAX} placeholder="Campo inundado, falta de árbitro…" value={sheet.postponedReason ?? ""} onChange={(e) => set("postponedReason", e.target.value)} aria-invalid={!!err.reason || undefined} />
                  <small>{POSTPONED_REASON_MAX - (sheet.postponedReason ?? "").length} letras libres · lo ve todo el mundo</small>
                </label>
                <label className="sc-field">
                  <span>Nueva fecha</span>
                  <input className="vd-input" type="date" value={postponed.date} onChange={(e) => set("postponedTo", e.target.value ? joinDate(e.target.value, postponed.time || when.time || "12:00") : null)} />
                </label>
                <label className="sc-field">
                  <span>Hora (Madrid)</span>
                  <input className="vd-input" type="time" value={postponed.time} disabled={!postponed.date} onChange={(e) => set("postponedTo", e.target.value ? joinDate(postponed.date, e.target.value) : joinDate(postponed.date, "12:00"))} />
                </label>
                <p className="sc-small sc-field--wide">
                  {postponed.date ? `Al guardar avisamos a quien sigue las fechas y el calendario lo mueve al ${isoDay(postponed.date)}.` : "Sin nueva fecha: en la web sale «por decidir»."}{" "}
                  <button type="button" className="vd-link pa-mini-link" onClick={() => set("postponedTo", null)}>
                    Por decidir
                  </button>
                </p>
              </div>
            )}
            {estado === "cancelado" && <p className="sc-small pa-apl">No cuenta para las estadísticas; en la web sale como cancelado{draft ? " (es un borrador: no sale en ningún sitio)" : ""}.</p>}
          </section>

          <section className="pa-dsec" aria-labelledby={`${id}-d5`}>
            <h2 className="sc-h3" id={`${id}-d5`}>
              Quién anota en la mesa
            </h2>
            <p className="sc-small">{scorerNames.length ? `Lo anota ${scorerNames.join(" y ")} desde la mesa` : "Nadie anota todavía: los capitanes pueden hacerlo siempre"}.</p>
            {draft && <p className="sc-small pa-bad">Es un borrador: los anotadores se eligen cuando el partido esté en el calendario (la mesa solo abre partidos publicados).</p>}
            <div className="sc-chips pa-people">
              {people.map((u) => {
                const on = scorers.includes(u.uid);
                const name = u.nickname || u.displayName || "Socio";
                return (
                  <button key={u.uid} type="button" className="sc-chip vd-glass vd-press" aria-pressed={on} aria-disabled={draft || undefined} aria-label={`${on ? "Quitar a" : "Dar la mesa a"} ${name}`} onClick={() => void toggleScorer(u.uid, name)}>
                    {name}
                    {u.nickname && <small>@{u.nickname}</small>}
                  </button>
                );
              })}
            </div>
            {!people.length && <p className="sc-small">Nadie más en el vestuario: solo los capitanes, que ya pueden anotar siempre.</p>}
          </section>

          <section className="pa-dsec" aria-labelledby={`${id}-d6`}>
            <h2 className="sc-h3" id={`${id}-d6`}>
              Vídeo y el tiempo
            </h2>
            <div className="sc-form">
              <label className="sc-field sc-field--wide">
                <span>Vídeo del partido (YouTube, opcional)</span>
                <input className="vd-input" type="url" placeholder="https://youtu.be/…" value={sheet.videoUrl ?? ""} onChange={(e) => set("videoUrl", e.target.value)} aria-invalid={!!err.video || undefined} />
                {video && !err.video && <small className="is-ok">Sale «Ver el partido en YouTube» en su página</small>}
                {err.video && <small className="is-bad">{err.video}</small>}
                {!video && <small>Pega el enlace del vídeo y su página tendrá el botón para verlo</small>}
              </label>
              <p className="sc-field sc-field--wide pa-weather">
                <span>El tiempo</span>
                <b>{weather}</b>
                <small>Lo pone el servidor al empezar; no se edita</small>
              </p>
              <p className="sc-small sc-field--wide">
                La nota de quedada vive en la{" "}
                <SalaLink className="vd-link pa-mini-link" to={`${base}/convocatoria`}>
                  convocatoria
                </SalaLink>
                : es la única y la ve todo el equipo.
              </p>
            </div>
          </section>
        </div>
      </div>

      <footer className="pa-foot vd-glass" role="group" aria-label="Guardar los datos">
        <p className="pa-foot__s" aria-live="polite">
          <b className="pa-dirty">{s.dirty || s.saveLine !== "Sin guardar todavía" ? s.saveLine : draft ? "Borrador guardado" : "Guardado"}</b>
          <span>{footWhy}</span>
        </p>
        {s.dirty && (
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => (setPartial(null), s.reset())} aria-disabled={busy || undefined}>
            Descartar
          </button>
        )}
        <button type="button" className={`vd-btn vd-glass vd-press${draft || played ? "" : " vd-btn--pri"}`} aria-disabled={(!s.dirty && !draft) || busy || undefined} onClick={() => void save(false)}>
          {s.busy === "draft" ? "Guardando…" : draft || played ? "Guardar borrador" : "Guardar"}
        </button>
        {draft && (
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={() => void save(true)} aria-disabled={busy || undefined}>
            {s.busy === "publish" ? "Publicando…" : "Publicar en el calendario"}
          </button>
        )}
        {played && !draft && (
          <SalaLink className="vd-btn vd-glass vd-press vd-btn--pri" to={`${base}/publicar`}>
            Revisar y publicar
          </SalaLink>
        )}
      </footer>
    </div>
  );
}
