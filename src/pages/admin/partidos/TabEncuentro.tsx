// The «Encuentro» tab, as on the canvas (stats-gen/ad-v2-full.mjs `encT`, shots-adv2f/partidos-encuentro.png):
// three groups — 1 Rival y fecha (rival, initials, time and date in Madrid, competition, season) · 2 Campo
// (name, address, condition) · 3 Detalles (kit, state, duration, the rival's crest with its HTTPS check,
// the internal note). Match management lives above the tabs so every workspace keeps it available.
import { useId, useState } from "react";
import { opponentInitials } from "../../../lib/clubAnalytics";
import { rivalCode } from "../../../lib/eventMeta";
import type { SeasonDoc } from "../../../lib/schemas";
import { AdIcon } from "../ui/icons";
import { ConfirmModal } from "../ui/layers";
import { joinDate, splitDate } from "../acta/dates";
import { changeSeason, okHttps, POSTPONED_REASON_MAX, score, type MatchSheet } from "../acta/sheetModel";
import { joinVenue, splitVenue } from "./workspaceModel";
import { plural } from "../../../lib/derived/words";

const STATUS: { value: MatchSheet["status"]; label: string }[] = [
  { value: "scheduled", label: "Programado" },
  { value: "finished", label: "Finalizado" },
  { value: "postponed", label: "Aplazado" },
  { value: "cancelled", label: "Cancelado" },
];

function Seg<V extends string>({ label, value, options, onChange }: { label: string; value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  const id = useId();
  return (
    <div className="fld">
      <span className="lb" id={id}>
        {label}
      </span>
      <div className="sgf" role="group" aria-labelledby={id}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Aplazado: «Motivo» (≤ 140, public: «Aplazado: Campo inundado») and «Nueva fecha» (date and time in Madrid,
 * optional: «Por decidir» clears it). Publishing tells the «Fechas» subscribers («Aplazado» / «Nueva fecha»)
 * and moves the match in the calendar feed.
 */
function Aplazado({ sheet, set }: { sheet: MatchSheet; set: <K extends keyof MatchSheet>(k: K, v: MatchSheet[K]) => void }) {
  const id = useId();
  const to = typeof sheet.postponedTo === "number" && Number.isFinite(sheet.postponedTo) ? sheet.postponedTo : null;
  const when = to === null ? { date: "", time: "" } : splitDate(to);
  const reason = sheet.postponedReason ?? "";
  return (
    <>
      <div className="fld">
        <label htmlFor={`${id}-mo`}>Motivo del aplazamiento</label>
        <input id={`${id}-mo`} className="inp" value={reason} maxLength={POSTPONED_REASON_MAX} onChange={(e) => set("postponedReason", e.target.value)} placeholder="Campo inundado, falta de árbitro…" aria-describedby={`${id}-mo-h`} />
        <p id={`${id}-mo-h`} className="hint">
          Lo ve todo el mundo. {POSTPONED_REASON_MAX - reason.length} letras libres.
        </p>
      </div>
      <div className="f2">
        <div className="fld">
          <label htmlFor={`${id}-nf`}>Nueva fecha</label>
          <input id={`${id}-nf`} className="inp" type="date" value={when.date} onChange={(e) => set("postponedTo", e.target.value ? joinDate(e.target.value, when.time || "12:00") : null)} />
        </div>
        <div className="fld">
          <label htmlFor={`${id}-nh`}>Hora (Madrid)</label>
          <input id={`${id}-nh`} className="inp" type="time" value={when.time} disabled={!when.date} onChange={(e) => set("postponedTo", e.target.value && when.date ? joinDate(when.date, e.target.value) : to)} />
        </div>
      </div>
      <p className="hint">
        {to === null ? "Sin nueva fecha: sale «por decidir». Cuando la pongas y publiques, avisamos a quien sigue las fechas." : "Al publicar avisamos a quien sigue las fechas y el calendario lo mueve a la nueva."}
        {to !== null ? (
          <>
            {" "}
            <button type="button" className="lnk" onClick={() => set("postponedTo", null)}>
              Por decidir
            </button>
          </>
        ) : null}
      </p>
    </>
  );
}

export function TabEncuentro({
  sheet,
  update,
  seasons,
}: {
  /** The sheet as reviewed (a played match reads «Finalizado»). */
  sheet: MatchSheet;
  update: (f: (s: MatchSheet) => MatchSheet) => void;
  seasons: readonly SeasonDoc[];
}) {
  const id = useId();
  const [askSeason, setAskSeason] = useState<string | null>(null);
  const set = <K extends keyof MatchSheet>(k: K, v: MatchSheet[K]) => update((s) => ({ ...s, [k]: v }));
  const when = splitDate(sheet.date);
  const venue = splitVenue(sheet.venue);
  const logo = sheet.rivalLogoUrl ?? "";
  const called = sheet.starters.length + sheet.bench.length + sheet.notCalled.length;
  const { gf, ga } = score(sheet);
  const options = seasons.filter((s) => !s.archived || s.id === sheet.seasonId);
  const pickSeason = (v: string) => {
    if (v === sheet.seasonId) return;
    if (called || sheet.events.length) setAskSeason(v);
    else update((s) => changeSeason(s, v));
  };
  const target = seasons.find((s) => s.id === askSeason);
  return (
    <>
      <div className="fgs">
        <section className="fg" aria-labelledby={`${id}-g1`}>
          <h3 id={`${id}-g1`}>
            <span aria-hidden="true">1</span>Rival y fecha
          </h3>
          <div className="fld">
            <label htmlFor={`${id}-rv`}>Rival</label>
            <input id={`${id}-rv`} className="inp" value={sheet.rival} maxLength={100} onChange={(e) => set("rival", e.target.value)} placeholder="Nombre completo del rival" />
          </div>
          <div className="f2">
            <div className="fld">
              <label htmlFor={`${id}-in`}>Iniciales</label>
              <input
                id={`${id}-in`}
                className="inp"
                value={sheet.rivalInitials ?? ""}
                maxLength={3}
                placeholder={sheet.rival.trim() ? opponentInitials(sheet.rival) : "Auto"}
                onChange={(e) => set("rivalInitials", e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())}
              />
            </div>
            <div className="fld">
              <label htmlFor={`${id}-h`}>Hora (Madrid)</label>
              <input id={`${id}-h`} className="inp" type="time" value={when.time} onChange={(e) => set("date", e.target.value ? joinDate(when.date, e.target.value) : NaN)} />
            </div>
          </div>
          <div className="fld">
            <label htmlFor={`${id}-rs`}>Código en el marcador</label>
            <input
              id={`${id}-rs`}
              className="inp"
              value={sheet.rivalShort ?? ""}
              maxLength={4}
              autoCapitalize="characters"
              aria-describedby={`${id}-rs-h`}
              placeholder={rivalCode(sheet.rival || "Rival")}
              onChange={(e) => set("rivalShort", e.target.value.replace(/[^\p{L}\p{N}]/gu, "").toLocaleUpperCase("es"))}
            />
            <p id={`${id}-rs-h`} className="hint">De 2 a 4 letras, para la mesa y el directo. Vacío: {rivalCode(sheet.rival || "Rival")}.</p>
          </div>
          <div className="fld">
            <label htmlFor={`${id}-f`}>Fecha</label>
            <input id={`${id}-f`} className="inp" type="date" value={when.date} onChange={(e) => set("date", e.target.value ? joinDate(e.target.value, when.time || "12:00") : NaN)} />
          </div>
          <div className="fld">
            <label htmlFor={`${id}-c`}>Competición</label>
            <input id={`${id}-c`} className="inp" list={`${id}-cl`} value={sheet.competition} maxLength={80} onChange={(e) => set("competition", e.target.value)} />
            <datalist id={`${id}-cl`}>
              <option value="Liga" />
              <option value="Copa" />
              <option value="Amistoso" />
            </datalist>
          </div>
          <div className="fld">
            <label htmlFor={`${id}-t`}>Temporada</label>
            <select id={`${id}-t`} className="inp" value={sheet.seasonId} onChange={(e) => pickSeason(e.target.value)}>
              <option value="">Elegir temporada</option>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.archived ? " · archivada" : ""}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="fg" aria-labelledby={`${id}-g2`}>
          <h3 id={`${id}-g2`}>
            <span aria-hidden="true">2</span>Campo
          </h3>
          <div className="fld">
            <label htmlFor={`${id}-vn`}>Nombre del campo</label>
            <input id={`${id}-vn`} className="inp" value={venue.name} maxLength={120} onChange={(e) => set("venue", joinVenue(e.target.value, venue.address))} placeholder="Se puede dejar para luego" />
          </div>
          <div className="fld">
            <label htmlFor={`${id}-va`}>Dirección</label>
            <input id={`${id}-va`} className="inp" value={venue.address} maxLength={120} onChange={(e) => set("venue", joinVenue(venue.name, e.target.value))} placeholder="Calle, número, localidad" />
          </div>
          <Seg label="Condición" value={sheet.home ? "home" : "away"} options={[{ value: "home", label: "Local" }, { value: "away", label: "Visitante" }]} onChange={(v) => set("home", v === "home")} />
          <p className="hint">La dirección abre el mapa en la ficha del partido.</p>
        </section>

        <section className="fg" aria-labelledby={`${id}-g3`}>
          <h3 id={`${id}-g3`}>
            <span aria-hidden="true">3</span>Detalles
          </h3>
          <Seg label="Equipación" value={sheet.kit ?? "home"} options={[{ value: "home", label: "1ª celeste" }, { value: "away", label: "2ª negra" }]} onChange={(v) => set("kit", v)} />
          <Seg label="Estado" value={sheet.status} options={STATUS} onChange={(v) => set("status", v)} />
          {sheet.status === "postponed" ? <Aplazado sheet={sheet} set={set} /> : null}
          <div className="f2">
            <div className="fld">
              <label htmlFor={`${id}-du`}>Duración (min)</label>
              <input
                id={`${id}-du`}
                className="inp"
                inputMode="numeric"
                maxLength={3}
                value={Number.isFinite(sheet.duration) ? String(sheet.duration) : ""}
                onChange={(e) => {
                  const d = e.target.value.replace(/[^0-9]/g, "");
                  set("duration", d === "" ? NaN : Number(d));
                }}
              />
            </div>
            <div className="fld">
              <span className="lb">Hora oficial</span>
              <span className="hint" style={{ paddingTop: 12 }}>
                Madrid
              </span>
            </div>
          </div>
          <div className="fld">
            <label htmlFor={`${id}-lg`}>Escudo del rival (HTTPS, opcional)</label>
            <input id={`${id}-lg`} className={`inp${logo && !okHttps(logo) ? " bad" : ""}`} type="url" value={logo} placeholder="https://…" onChange={(e) => set("rivalLogoUrl", e.target.value)} aria-invalid={(!!logo && !okHttps(logo)) || undefined} aria-describedby={logo ? `${id}-lgk` : undefined} />
            {logo ? (
              okHttps(logo) ? (
                <span id={`${id}-lgk`} className="okk" style={{ fontSize: 13 }}>
                  <AdIcon name="check" size={13} />
                  Se ve bien
                </span>
              ) : (
                <span id={`${id}-lgk`} className="bad" style={{ fontSize: 13 }}>
                  <AdIcon name="x" size={13} />
                  No es HTTPS
                </span>
              )
            ) : null}
          </div>
          <div className="fld">
            <label htmlFor={`${id}-nt`}>Nota interna para el equipo</label>
            <textarea id={`${id}-nt`} className="inp" value={sheet.meetingNote ?? ""} maxLength={500} onChange={(e) => set("meetingNote", e.target.value)} placeholder="Quedada, camiseta, material…" />
          </div>
        </section>
      </div>

      <ConfirmModal
        open={!!askSeason}
        onClose={() => setAskSeason(null)}
        title={`¿Pasar a la ${target?.name ?? "otra temporada"}?`}
        lede="Cada temporada tiene su plantilla: la convocatoria y el acta empiezan de cero."
        consequences={[
          `Se vacía la convocatoria (${plural(called, "jugador asignado", "jugadores asignados")})`,
          `Se borran ${plural(sheet.events.length, "evento", "eventos")}${gf + ga ? ` y el marcador vuelve a 0–0 (ahora ${gf}–${ga})` : ""}`,
          "No se guarda hasta que pulses «Guardar»",
        ]}
        confirmLabel="Cambiar de temporada"
        confirmTone="redf"
        onConfirm={() => {
          if (askSeason) update((s) => changeSeason(s, askSeason));
          setAskSeason(null);
        }}
      />
    </>
  );
}
