// The «Encuentro» tab: every field of the match (temporada — changing it empties convocatoria and events,
// asked first —, rival, automatic initials, crest URL with a live HTTPS check, date and time in Madrid,
// competition, duration, field, condition, kit, state, the internal note) and «Borrar partido».
import { useId, useState } from "react";
import type { SeasonDoc } from "../../../lib/schemas";
import { opponentInitials } from "../../../lib/clubAnalytics";
import { FieldCheck, Segmented } from "../ui/controls";
import { AdIcon } from "../ui/icons";
import { ConfirmModal } from "../ui/layersV1";
import { dateInput, madridTime } from "../acta/dates";
import { changeSeason, okHttps, score, type MatchSheet } from "../acta/sheetModel";

const STATUS: { value: MatchSheet["status"]; label: string }[] = [
  { value: "scheduled", label: "Programado" },
  { value: "finished", label: "Finalizado" },
  { value: "postponed", label: "Aplazado" },
  { value: "cancelled", label: "Cancelado" },
];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function TabEncuentro({
  sheet,
  update,
  seasons,
  onDelete,
}: {
  sheet: MatchSheet;
  update: (f: (s: MatchSheet) => MatchSheet) => void;
  seasons: readonly SeasonDoc[];
  onDelete: () => void;
}) {
  const id = useId();
  const [askSeason, setAskSeason] = useState<string | null>(null);
  const set = <K extends keyof MatchSheet>(k: K, v: MatchSheet[K]) => update((s) => ({ ...s, [k]: v }));
  const logo = sheet.rivalLogoUrl ?? "";
  const logoOk = okHttps(logo);
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
    <div className="pnl">
      <div className="fg">
        <label className="fld">
          <span className="lbl">Temporada</span>
          <select className="inp" value={sheet.seasonId} onChange={(e) => pickSeason(e.target.value)}>
            <option value="">Seleccionar temporada</option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.archived ? " · archivada" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          <span className="lbl">Rival</span>
          <input className="inp" value={sheet.rival} maxLength={100} onChange={(e) => set("rival", e.target.value)} />
        </label>
        <div className="fld">
          <label className="lbl" htmlFor={`${id}-in`}>
            Iniciales (automáticas)
          </label>
          <input
            id={`${id}-in`}
            className="inp"
            value={sheet.rivalInitials ?? ""}
            maxLength={3}
            placeholder={sheet.rival.trim() ? opponentInitials(sheet.rival) : "Automáticas"}
            onChange={(e) => set("rivalInitials", e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())}
            aria-describedby={`${id}-ini`}
          />
          <span className="hint" id={`${id}-ini`}>
            {sheet.rivalInitials ? "Escritas a mano · bórralas para volver a las automáticas" : "Si lo dejas vacío salen las automáticas"}
          </span>
        </div>
        <label className="fld">
          <span className="lbl">Fecha · hora de Madrid</span>
          <input className="inp" type="datetime-local" value={dateInput(sheet.date)} onChange={(e) => set("date", madridTime(e.target.value))} />
        </label>
        <label className="fld">
          <span className="lbl">Competición</span>
          <input className="inp" list={`${id}-comp`} value={sheet.competition} maxLength={80} onChange={(e) => set("competition", e.target.value)} />
          <datalist id={`${id}-comp`}>
            <option value="Liga" />
            <option value="Copa" />
            <option value="Amistoso" />
          </datalist>
        </label>
        <div className="fld">
          <label className="lbl" htmlFor={`${id}-du`}>
            Duración (min)
          </label>
          <input
            id={`${id}-du`}
            className="inp tn"
            inputMode="numeric"
            maxLength={3}
            value={Number.isFinite(sheet.duration) ? String(sheet.duration) : ""}
            onChange={(e) => {
              const d = e.target.value.replace(/[^0-9]/g, "");
              set("duration", d === "" ? NaN : Number(d));
            }}
            aria-describedby={`${id}-dur`}
          />
          <span className="hint" id={`${id}-dur`}>
            La duración deportiva (2×25′ = 50) da los minutos del acta.
          </span>
        </div>
        <label className="fld w2">
          <span className="lbl">Campo (nombre y dirección)</span>
          <input className="inp" value={sheet.venue} maxLength={200} onChange={(e) => set("venue", e.target.value)} placeholder="Se puede dejar para luego" />
        </label>
        <div className="fld">
          <span className="lbl" id={`${id}-c`}>
            Condición
          </span>
          <Segmented labelledBy={`${id}-c`} value={sheet.home ? "home" : "away"} options={[{ value: "home", label: "Local" }, { value: "away", label: "Visitante" }]} onChange={(v) => set("home", v === "home")} />
        </div>
        <div className="fld">
          <span className="lbl" id={`${id}-k`}>
            Equipación
          </span>
          <Segmented labelledBy={`${id}-k`} value={sheet.kit ?? "home"} options={[{ value: "home", label: "1ª celeste" }, { value: "away", label: "2ª negra" }]} onChange={(v) => set("kit", v)} />
        </div>
        <div className="fld w2">
          <span className="lbl" id={`${id}-e`}>
            Estado
          </span>
          <Segmented labelledBy={`${id}-e`} value={sheet.status} options={STATUS} onChange={(v) => set("status", v)} />
        </div>
        <div className="fld w2">
          <label className="lbl" htmlFor={`${id}-lg`}>
            Escudo del rival (URL HTTPS, opcional)
          </label>
          <input id={`${id}-lg`} className={`inp ${logo ? (logoOk ? "good" : "bad") : ""}`.trim()} type="url" value={logo} placeholder="https://" onChange={(e) => set("rivalLogoUrl", e.target.value)} aria-describedby={`${id}-logo`} aria-invalid={!logoOk || undefined} />
          <FieldCheck id={`${id}-logo`} tone={!logo ? "mut" : logoOk ? "ok" : "bad"}>
            {!logo ? "Opcional · si falta, salen sus iniciales" : logoOk ? "Enlace seguro: el escudo saldrá en la web" : "Tiene que empezar por https:// o no se verá en la web"}
          </FieldCheck>
        </div>
        <label className="fld w2">
          <span className="lbl">Nota interna para el equipo</span>
          <textarea className="inp" value={sheet.meetingNote ?? ""} maxLength={500} onChange={(e) => set("meetingNote", e.target.value)} placeholder="Hora de quedada, camiseta, material… Solo la ve el equipo." />
        </label>
      </div>
      <div className="row">
        <button type="button" className="btn sm red" onClick={onDelete} aria-haspopup="dialog">
          <AdIcon name="trash" size={16} />
          Borrar partido
        </button>
        <span className="hint">Cambiar la temporada vacía convocatoria y eventos.</span>
      </div>
      <ConfirmModal
        open={!!askSeason}
        onClose={() => setAskSeason(null)}
        kicker="Encuentro"
        title={`¿Pasar a la ${target?.name ?? "otra temporada"}?`}
        lede="Cada temporada tiene su plantilla: la convocatoria y el acta empiezan de cero."
        consequences={[
          { tone: "r", text: `Se vacía la convocatoria (${plural(called, "jugador asignado", "jugadores asignados")})` },
          { tone: "r", text: `Se borran ${plural(sheet.events.length, "evento", "eventos")}${gf + ga ? ` y el marcador vuelve a 0–0 (ahora ${gf}–${ga})` : ""}` },
          { tone: "", text: "No se guarda hasta que pulses «Guardar borrador» o «Publicar»" },
        ]}
        confirmLabel="Cambiar de temporada"
        confirmTone="red solid"
        onConfirm={() => {
          if (askSeason) update((s) => changeSeason(s, askSeason));
          setAskSeason(null);
        }}
      />
    </div>
  );
}
