// Turnos (/admin/turnos) — the season's jobs (lavar la equipación, balones y petos, coche a los partidos
// fuera…) and the order of the members for each one. The turn of each match is computed from this order
// (lib/derived/rota turnsFor): one member per completed match, skipping a «No puedo» or an absence, the car
// only away. Reorder with «Subir» / «Bajar» (focus follows the moved member, a polite live region says where
// he is now: the same pattern as Clasificación). Overrides for one match live in Convocar's «Turnos» panel.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { nameFor } from "../../../lib/clubData";
import { DEFAULT_JOBS, jobIdFor, ROTA_ICON_LABEL, ROTA_ICONS, ROTA_LIMITS, rotaErrors, type Rota, type RotaIconId, type RotaJob } from "../../../lib/derived/rota";
import { useRota } from "../../../lib/useRotaTurns";
import { RotaIcon } from "../../../components/celeste/Turnos";
import { LoadError } from "../club/ClubStates";
import { useTurnosWrites } from "../data/useTurnos";
import { useAdmin } from "../shell/context";
import { useFrame } from "../ui/frame";
import { AdIcon } from "../ui/icons";
import { EmptyState } from "../ui/controls";
import { useToast } from "../ui/toastContext";
import "../turnos/turnos.css";

export function Turnos() {
  const data = useAdmin();
  const { desktop } = useFrame();
  const [seasonPick, setSeasonPick] = useState<string | null>(null);
  const seasonId = seasonPick ?? data.season?.id ?? data.seasons.find((s) => !s.archived)?.id ?? "";
  const rota = useRota(seasonId || undefined);

  const seasonSelect = (
    <label className="tu-season">
      <span className="sr">Temporada</span>
      <select className="inp" value={seasonId} onChange={(e) => setSeasonPick(e.target.value)} aria-label="Temporada">
        {data.seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.archived ? " · archivada" : ""}
          </option>
        ))}
      </select>
    </label>
  );

  const body =
    data.error || rota.error ? (
      <LoadError what="los turnos" />
    ) : data.loading || rota.loading ? (
      <div className="skel" role="status" aria-label="Cargando los turnos">
        <i />
        <i />
        <i />
      </div>
    ) : !seasonId ? (
      <div className="void">
        <h3>Aún no hay temporada</h3>
        <p>Los turnos van por temporadas: crea una en Temporadas y vuelve.</p>
      </div>
    ) : (
      <Editor key={`${seasonId}:${JSON.stringify(rota.data)}`} seasonId={seasonId} rota={rota.data} seasonSelect={desktop ? null : seasonSelect} />
    );

  return desktop ? (
    <>
      <div className="vh">
        <div>
          <h1 className="ttl">Turnos</h1>
          <p className="ld">Quién lava la equipación, lleva los balones o pone el coche · uno por partido</p>
        </div>
        {seasonId && <div className="r">{seasonSelect}</div>}
      </div>
      <div className="scr tu-scroll">{body}</div>
    </>
  ) : (
    <div className="msc">{body}</div>
  );
}

function Editor({ seasonId, rota, seasonSelect }: { seasonId: string; rota: Rota | null; seasonSelect: ReactNode }) {
  const data = useAdmin();
  const toast = useToast();
  const writes = useTurnosWrites();
  const roster = data.players.filter((p) => p.seasons?.includes(seasonId));
  const nameOf = (id: string) => nameFor(data.players.find((p) => p.id === id), seasonId);
  const [jobs, setJobs] = useState<RotaJob[]>(() => rota?.jobs ?? []);
  const [started, setStarted] = useState(!!rota);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [moved, setMoved] = useState("");
  const moveButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterMove = useRef<{ key: string; dir: "up" | "down" } | null>(null);
  useEffect(() => {
    const f = focusAfterMove.current;
    if (!f) return;
    focusAfterMove.current = null;
    const same = moveButtons.current.get(`${f.key}:${f.dir}`);
    const other = moveButtons.current.get(`${f.key}:${f.dir === "up" ? "down" : "up"}`);
    (same && !same.disabled ? same : other)?.focus();
  }, [jobs]);

  const errors = rotaErrors({ jobs });
  const setJob = (i: number, patch: Partial<RotaJob>) => setJobs((js) => js.map((j, k) => (k === i ? { ...j, ...patch } : j)));
  const addJob = () =>
    setJobs((js) => (js.length >= ROTA_LIMITS.jobs ? js : [...js, { id: jobIdFor("turno", js.map((j) => j.id)), name: "", icon: "bag", awayOnly: false, order: roster.map((p) => p.id).slice(0, ROTA_LIMITS.order) }]));
  const removeJob = (i: number) => setJobs((js) => js.filter((_, k) => k !== i));
  const moveMember = (i: number, at: number, by: -1 | 1) => {
    const order = jobs[i].order;
    const to = at + by;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[at], next[to]] = [next[to], next[at]];
    focusAfterMove.current = { key: `${jobs[i].id}:${order[at]}`, dir: by < 0 ? "up" : "down" };
    setJob(i, { order: next });
    setMoved(`${nameOf(order[at])}, ahora el ${to + 1}.º en «${jobs[i].name.trim() || "el turno"}»`);
  };
  const removeMember = (i: number, at: number) => setJob(i, { order: jobs[i].order.filter((_, k) => k !== at) });
  const addMember = (i: number, id: string) => id && setJob(i, { order: [...jobs[i].order, id].slice(0, ROTA_LIMITS.order) });
  const startDefaults = () => {
    const order = roster.map((p) => p.id).slice(0, ROTA_LIMITS.order);
    setJobs(DEFAULT_JOBS.map((j) => ({ ...j, order: [...order] })));
    setStarted(true);
  };

  const save = async () => {
    if (errors.length || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await writes.saveRota(seasonId, jobs);
      toast.show({ tag: "TURNOS", message: "Turnos guardados" });
    } catch (e) {
      setSaveError(`No se han podido guardar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  if (!started) {
    return (
      <div className="tu-adm">
        {seasonSelect}
        <EmptyState icon="swap" title="Aún no hay turnos esta temporada">
          Lavar la equipación, balones y petos, coche a los partidos fuera: el turno rota solo, uno por partido.
        </EmptyState>
        <div className="tu-acts">
          <button type="button" className="btn gold" onClick={startDefaults}>
            <AdIcon name="plus" size={17} />
            Empezar con los turnos de siempre
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tu-adm">
      {seasonSelect}
      <p className="hint">Cada partido jugado pasa el turno al siguiente de la lista. Se salta a quien dijo «No puedo» o está ausente; el coche, solo fuera de casa.</p>
      {jobs.map((job, i) => {
        const label = job.name.trim() || `Turno ${i + 1}`;
        const free = roster.filter((p) => !job.order.includes(p.id));
        return (
          <section key={job.id} className="calm tu-job" aria-labelledby={`tu-h-${job.id}`}>
            <h3 id={`tu-h-${job.id}`}>
              <RotaIcon icon={job.icon} size={18} />
              {label}
            </h3>
            <div className="tu-meta">
              <label className="fld">
                <span className="lbl">Nombre</span>
                <input className="inp" value={job.name} maxLength={ROTA_LIMITS.name} onChange={(e) => setJob(i, { name: e.target.value })} placeholder="Lavar la equipación" />
              </label>
              <label className="fld">
                <span className="lbl">Icono</span>
                <select className="inp" value={job.icon} onChange={(e) => setJob(i, { icon: e.target.value as RotaIconId })}>
                  {ROTA_ICONS.map((ic) => (
                    <option key={ic} value={ic}>
                      {ROTA_ICON_LABEL[ic]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tu-check">
                <input type="checkbox" checked={job.awayOnly} onChange={(e) => setJob(i, { awayOnly: e.target.checked })} />
                <span>Solo partidos fuera</span>
              </label>
              <button type="button" className="btn sm line" onClick={() => removeJob(i)} aria-label={`Quitar el turno ${label}`}>
                <AdIcon name="trash" size={15} />
                Quitar
              </button>
            </div>
            {job.order.length ? (
              <ol className="tu-order" aria-label={`Orden de ${label}`}>
                {job.order.map((pid, at) => {
                  const key = `${job.id}:${pid}`;
                  const nm = nameOf(pid);
                  return (
                    <li key={pid}>
                      <span className="pos" aria-hidden="true">
                        {at + 1}
                      </span>
                      <span className="nm">{nm}</span>
                      <div className="row-acts" role="group" aria-label={`Mover o quitar a ${nm}`}>
                        <button type="button" className="btn sm line" ref={(el) => void (el ? moveButtons.current.set(`${key}:up`, el) : moveButtons.current.delete(`${key}:up`))} onClick={() => moveMember(i, at, -1)} disabled={at === 0} aria-label={`Subir a ${nm}`}>
                          <span aria-hidden="true">↑</span>
                        </button>
                        <button type="button" className="btn sm line" ref={(el) => void (el ? moveButtons.current.set(`${key}:down`, el) : moveButtons.current.delete(`${key}:down`))} onClick={() => moveMember(i, at, 1)} disabled={at === job.order.length - 1} aria-label={`Bajar a ${nm}`}>
                          <span aria-hidden="true">↓</span>
                        </button>
                        <button type="button" className="btn sm line" onClick={() => removeMember(i, at)} aria-label={`Quitar a ${nm} de ${label}`}>
                          <AdIcon name="x" size={15} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="hint">Nadie en la lista: añade a quien entra en el turno.</p>
            )}
            {free.length > 0 && job.order.length < ROTA_LIMITS.order && (
              <label className="fld tu-add">
                <span className="lbl">Añadir a la lista</span>
                <select className="inp" value="" onChange={(e) => addMember(i, e.target.value)}>
                  <option value="">Elige un jugador…</option>
                  {free.map((p) => (
                    <option key={p.id} value={p.id}>
                      {nameOf(p.id)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </section>
        );
      })}
      <p className="sr" role="status" aria-live="polite">
        {moved}
      </p>
      <div className="tu-acts">
        <button type="button" className="btn line" onClick={addJob} disabled={jobs.length >= ROTA_LIMITS.jobs}>
          <AdIcon name="plus" size={17} />
          Añadir turno
        </button>
      </div>
      {errors.length > 0 && (
        <ul className="tu-errs" aria-label="Falta para guardar">
          {errors.map((e) => (
            <li key={e}>
              <AdIcon name="alert" size={15} />
              {e}
            </li>
          ))}
        </ul>
      )}
      {saveError && (
        <p className="tu-errs" role="alert">
          {saveError}
        </p>
      )}
      <div className="tu-save">
        <button type="button" className="btn gold" onClick={() => void save()} aria-disabled={errors.length > 0 || saving} disabled={saving}>
          <AdIcon name="check" size={17} />
          {saving ? "Guardando…" : "Guardar los turnos"}
        </button>
      </div>
    </div>
  );
}
