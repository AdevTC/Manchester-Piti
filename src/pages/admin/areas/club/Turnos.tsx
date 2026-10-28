// CLUB · Turnos (/admin/club/turnos; board part-club.html § turnos): the season's jobs (lavar la equipación, balones y
// petos, el coche a los de fuera…) and who is in each, in order; beside it «A quién le toca» in the next matches and
// «Quién lo hizo» in the played ones. Saved with «Guardar los turnos»; the draft lives outside the screen (B-CLUB-09:
// leaving asks and keeps it), another captain's change while you edit says so (Recargar · Guardar los míos encima).
// A match's own changes (a swap, «Lo hizo otro») live in its convocatoria.
import { useMemo, useState } from "react";
import { RotaIcon } from "../../../../components/celeste/Turnos";
import { VIcon } from "../../../../components/vidrio/VIcon";
import { apiError } from "../../../../lib/clubApi";
import { dateMillis, nameFor } from "../../../../lib/clubData";
import { DEFAULT_JOBS, jobIdFor, ROTA_ICON_LABEL, ROTA_ICONS, ROTA_LIMITS, rotaHistory, rotaMatch, turnsFor, type RotaIconId, type RotaJob, type RotaTurnsDoc } from "../../../../lib/derived/rota";
import { plural } from "../../../../lib/derived/words";
import { useRota } from "../../../../lib/useRotaTurns";
import { useSeasonRotaTurns } from "../../../vestuario/live";
import { useTurnosWrites } from "../../data/useTurnos";
import { ScreenError, ScreenLoading } from "../../shell/Screen";
import { SalaLink } from "../../shell/SalaLink";
import { useAdmin } from "../../shell/context";
import { useStatus } from "../../shell/statusContext";
import { useFrame } from "../../ui/frame";
import { useUnsavedGuard } from "../../ui/guard";
import { useRoomDraft } from "./drafts";
import { la, relWhen, rotaSig, turErrs, type TurDraft } from "./model";
import { RoomScreen } from "./Room";
import { Shirt } from "./shirts";
import { shirtOf, useStills } from "./stills";

const DAY = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Madrid" });

export function TurnosScreen() {
  const data = useAdmin();
  const status = useStatus();
  const writes = useTurnosWrites();
  const { desktop } = useFrame();
  const season = data.season;
  const sid = season?.id ?? "";
  const rota = useRota(sid || undefined);
  const docs = useSeasonRotaTurns(sid || undefined, !!sid);
  const [draft, setDraft] = useRoomDraft<TurDraft>(`tur:${sid}`);
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [live, setLive] = useState("");

  const savedJobs = rota.data?.jobs ?? null;
  const jobs = draft ? draft.jobs : (savedJobs ?? []);
  const errs = turErrs(jobs);
  const conflict = !!draft && !saving && draft.base !== rotaSig(savedJobs);
  const squad = useMemo(() => data.players.filter((p) => (p.seasons ?? []).includes(sid)).sort((a, b) => (shirtOf(a, sid).num ? Number(shirtOf(a, sid).num) : 999) - (shirtOf(b, sid).num ? Number(shirtOf(b, sid).num) : 999)), [data.players, sid]);
  const nameOf = (id: string | null) => (id ? nameFor(data.players.find((p) => p.id === id), sid).toLocaleUpperCase("es") : "");
  const ids = [...new Set(jobs.flatMap((j) => j.order))];
  const shirts = ids.map((id) => shirtOf(data.players.find((p) => p.id === id), sid));
  const src = useStills(shirts);

  const edit = (fn: (js: RotaJob[]) => RotaJob[], liveText = "") => {
    setErr("");
    setDraft((cur) => {
      const base = cur ?? { jobs: (savedJobs ?? []).map((j) => ({ ...j, order: [...j.order] })), base: rotaSig(savedJobs), since: Date.now() };
      return { ...base, jobs: fn(base.jobs.map((j) => ({ ...j, order: [...j.order] }))) };
    });
    if (liveText) setLive(liveText);
  };
  const setJob = (i: number, patch: Partial<RotaJob>, liveText = "") => edit((js) => js.map((j, k) => (k === i ? { ...j, ...patch } : j)), liveText);

  const save = async (force = false): Promise<boolean> => {
    if (!draft || !sid) return false;
    if (errs.length) {
      setErr(`Falta para guardar: ${errs[0]}`);
      return false;
    }
    if (conflict && !force) return false;
    const sending = draft;
    setSaving(true);
    setErr("");
    try {
      await writes.saveRota(sid, sending.jobs);
      setDraft((cur) => (cur === sending ? null : cur));
      status.show({ tag: "Turnos", message: `Turnos guardados · ${plural(sending.jobs.length, "turno", "turnos")}` });
      return true;
    } catch (e) {
      setErr(`No se han podido guardar los turnos: ${apiError(e).replace(/.$/, "")}. Tus cambios siguen aquí.`);
      status.show({ tone: "error", message: "No se han podido guardar los turnos · tus cambios siguen aquí", retry: () => void save(force) });
      return false;
    } finally {
      setSaving(false);
    }
  };
  useUnsavedGuard(!!draft, { what: "los turnos", alt: { label: "Guardar y salir", run: () => save() } });

  const start = () => setDraft({ jobs: DEFAULT_JOBS.map((j) => ({ ...j, order: squad.map((p) => p.id).slice(0, ROTA_LIMITS.order) })), base: rotaSig(savedJobs), since: Date.now() });

  // «A quién le toca» (the next matches) and «Quién lo hizo» (the played ones)
  const byId = useMemo(() => Object.fromEntries(docs.data.map((d) => [d.id, d.doc])) as Record<string, RotaTurnsDoc | undefined>, [docs.data]);
  const seasonMatches = useMemo(() => data.published.filter((m) => m.seasonId === sid && m.status !== "cancelled"), [data.published, sid]);
  const all = useMemo(() => seasonMatches.map(rotaMatch), [seasonMatches]);
  const upcoming = seasonMatches.filter((m) => m.status === "scheduled" && dateMillis(m.date) > data.now).sort((a, b) => dateMillis(a.date) - dateMillis(b.date)).slice(0, desktop ? 6 : 4);
  const played = seasonMatches.filter((m) => m.status === "finished").sort((a, b) => dateMillis(b.date) - dateMillis(a.date)).slice(0, 6);
  const jOf = (id: string) => data.matches.find((m) => m.id === id)?.jornada;
  const rotaNow = jobs.length ? { jobs } : null;
  const uidOf = (pid: string | null) => (pid ? data.people.find((p) => p.playerId === pid)?.uid : undefined);

  const primary = draft
    ? { label: saving ? "Guardando…" : "Guardar los turnos", onClick: () => void save(), disabled: saving || errs.length > 0 || conflict, why: errs[0] ?? (conflict ? "Otro capitán ha cambiado los turnos: elige cuáles se quedan." : undefined) }
    : !jobs.length && sid
      ? { label: "Empezar con los turnos de siempre", onClick: start }
      : null;
  const lede = season ? (jobs.length ? `${season.name} · ${plural(jobs.length, "turno", "turnos")} · uno por partido` : `${season.name} · sin turnos todavía`) : "Sin temporada";

  return (
    <RoomScreen room="turnos" lede={lede} primary={primary}>
      {rota.loading && !draft ? (
        <ScreenLoading label="Cargando los turnos" />
      ) : data.error || rota.error ? (
        <ScreenError what="los turnos" onRetry={() => window.location.reload()} />
      ) : !season ? (
        <div className="cl-emptyb">
          <h2 className="sc-h3">Aún no hay temporada</h2>
          <p className="sc-p">Los turnos van por temporadas: crea una en Temporadas y vuelve.</p>
        </div>
      ) : (
        <div className="cl-grid cl-tur">
          <section className="cl-col sc-scroll" aria-labelledby="cl-tur-t">
            <h2 className="vd-vh" id="cl-tur-t">
              Los turnos de {la(season.name)}
            </h2>
            {conflict && (
              <div className="cl-alert" role="alert">
                <p>
                  <b>Otro capitán ha cambiado los turnos</b> mientras editabas.
                </p>
                <div className="sc-btnrow">
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => { setDraft(null); setLive("Recargados los turnos guardados"); }}>
                    Recargar
                  </button>
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => void save(true)}>
                    Guardar los míos encima
                  </button>
                </div>
              </div>
            )}
            {err && (
              <p className="cl-alert" role="alert">
                {err}
              </p>
            )}
            {draft && (
              <p className="cl-dirty">
                <span className="sc-tag sc-tag--toca">Sin guardar</span>
                <span>Cambios sin guardar desde {relWhen(draft.since, data.now)} · el vestuario sigue viendo la rota de antes.</span>
                <button type="button" className="vd-link" onClick={() => { setDraft(null); setErr(""); setLive("Cambios descartados"); }}>
                  Descartar los cambios
                </button>
              </p>
            )}
            {!jobs.length ? (
              <div className="cl-emptyb">
                <h3 className="sc-h3">Aún no hay turnos en {la(season.name)}</h3>
                <p className="sc-p">Lavar la equipación, balones y petos, coche a los partidos fuera: el turno rota solo, uno por partido.</p>
                <button type="button" className="vd-btn vd-glass vd-press" onClick={start}>
                  Empezar con los turnos de siempre
                </button>
              </div>
            ) : (
              <>
                <p className="sc-small">Le toca a quien más tiempo lleva sin hacerlo, en el orden de la lista; el coche, solo fuera de casa. Los cambios de un partido (un intercambio, «lo hizo otro») se hacen en su convocatoria.</p>
                {jobs.map((jb, ji) => {
                  const miss = squad.filter((p) => !jb.order.includes(p.id));
                  const addV = adding[jb.id] && miss.some((p) => p.id === adding[jb.id]) ? adding[jb.id] : (miss[0]?.id ?? "");
                  const nm = jb.name.trim() || `el turno ${ji + 1}`;
                  return (
                    <section key={jb.id} className="cl-job" aria-label={nm}>
                      <header className="cl-job__h">
                        <span className="cl-door__i vd-glass" aria-hidden="true">
                          <RotaIcon icon={jb.icon} size={19} />
                        </span>
                        <label className="sc-field cl-job__n">
                          <span>Nombre del turno {ji + 1}</span>
                          <input className="vd-input" type="text" maxLength={ROTA_LIMITS.name + 1} value={jb.name} onChange={(e) => setJob(ji, { name: e.target.value.slice(0, ROTA_LIMITS.name + 1) })} aria-invalid={!jb.name.trim() || jb.name.length > ROTA_LIMITS.name || undefined} />
                          <small className={!jb.name.trim() || jb.name.length > ROTA_LIMITS.name ? "is-bad" : ""}>
                            {jb.name.length}/{ROTA_LIMITS.name}
                          </small>
                        </label>
                        <label className="sc-field cl-job__ic">
                          <span>Icono</span>
                          <select className="vd-input" value={jb.icon} onChange={(e) => setJob(ji, { icon: e.target.value as RotaIconId })}>
                            {ROTA_ICONS.map((ic) => (
                              <option key={ic} value={ic}>
                                {ROTA_ICON_LABEL[ic]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button type="button" className="vd-switch" role="switch" aria-checked={jb.awayOnly} onClick={() => setJob(ji, { awayOnly: !jb.awayOnly }, jb.awayOnly ? `«${nm}», en todos los partidos` : `«${nm}», solo fuera de casa`)}>
                          <span className="vd-switch__track" aria-hidden="true">
                            <span className="vd-switch__knob" />
                          </span>
                          Solo partidos fuera
                        </button>
                        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Quitar el turno «${nm}»`} onClick={() => edit((js) => js.filter((_, k) => k !== ji), `«${nm}» quitado · sin guardar`)}>
                          Quitar el turno
                        </button>
                      </header>
                      {!jb.order.length && <p className="sc-small">Nadie en la lista: añade a quien entra en el turno.</p>}
                      <ol className="sc-rows cl-rota">
                        {jb.order.map((pid, i) => {
                          const p = data.players.find((x) => x.id === pid);
                          const sh = shirtOf(p, sid);
                          const who = sh.name || "Ya no está";
                          return (
                            <li key={pid} className="sc-row cl-rota__r">
                              <span className="cl-rota__n">{i + 1}</span>
                              <Shirt shirt={sh} src={src(sh)} size="xs" />
                              <span className="sc-row__t">
                                <b>{who}</b>
                              </span>
                              <span className="cl-trow__a">
                                <button type="button" className="vd-ibtn vd-glass vd-press" aria-label={`Subir a ${who}`} aria-disabled={i === 0 || undefined} onClick={() => i > 0 && setJob(ji, { order: jb.order.map((x, k) => (k === i - 1 ? pid : k === i ? jb.order[i - 1] : x)) }, `${who}, ahora ${i}.º en «${nm}»`)}>
                                  <VIcon name="chevR" size={18} className="cl-up" />
                                </button>
                                <button type="button" className="vd-ibtn vd-glass vd-press" aria-label={`Bajar a ${who}`} aria-disabled={i === jb.order.length - 1 || undefined} onClick={() => i < jb.order.length - 1 && setJob(ji, { order: jb.order.map((x, k) => (k === i + 1 ? pid : k === i ? jb.order[i + 1] : x)) }, `${who}, ahora ${i + 2}.º en «${nm}»`)}>
                                  <VIcon name="chevR" size={18} className="cl-down" />
                                </button>
                                <button type="button" className="vd-ibtn vd-glass vd-press" aria-label={`Quitar a ${who} de «${nm}»`} onClick={() => setJob(ji, { order: jb.order.filter((x) => x !== pid) }, `${who} sale de «${nm}»`)}>
                                  <VIcon name="close" size={16} />
                                </button>
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                      {miss.length > 0 && jb.order.length < ROTA_LIMITS.order && (
                        <div className="cl-add">
                          <label className="sc-field">
                            <span>Añadir a la lista de «{nm}»</span>
                            <select className="vd-input" value={addV} onChange={(e) => setAdding((a) => ({ ...a, [jb.id]: e.target.value }))}>
                              {miss.map((p) => {
                                const sh = shirtOf(p, sid);
                                return (
                                  <option key={p.id} value={p.id}>
                                    {sh.num ? `${sh.num} · ` : ""}
                                    {sh.name}
                                  </option>
                                );
                              })}
                            </select>
                          </label>
                          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => addV && setJob(ji, { order: [...jb.order, addV] }, `${nameOf(addV)} entra en «${nm}»`)}>
                            Añadir
                          </button>
                        </div>
                      )}
                    </section>
                  );
                })}
                <button
                  type="button"
                  className="vd-btn vd-glass vd-press vd-btn--sm cl-addrow"
                  aria-disabled={jobs.length >= ROTA_LIMITS.jobs || undefined}
                  onClick={() => jobs.length < ROTA_LIMITS.jobs && edit((js) => [...js, { id: jobIdFor("turno", js.map((j) => j.id)), name: "Turno nuevo", icon: "bag", awayOnly: false, order: squad.map((p) => p.id).slice(0, ROTA_LIMITS.order) }], "Turno nuevo con toda la plantilla")}
                >
                  <VIcon name="plus" size={16} />
                  Añadir turno
                </button>
                <p className="sc-small">{jobs.length >= ROTA_LIMITS.jobs ? "Seis turnos como mucho." : "Hasta seis turnos."}</p>
              </>
            )}
            <p className="vd-vh" aria-live="polite">
              {live}
            </p>
          </section>
          <aside className="cl-col cl-side sc-scroll" aria-label="A quién le toca">
            {rotaNow && upcoming.length > 0 && (
              <>
                <h3 className="sc-h3">A quién le toca</h3>
                <ul className="sc-rows">
                  {upcoming.map((m) => {
                    const rm = rotaMatch(m);
                    const turns = turnsFor(rm, rotaNow, rotaHistory(rm, all, byId, rotaNow, data.now), [], [], byId[m.id]);
                    const at = dateMillis(m.date);
                    return (
                      <li key={m.id} className="sc-row cl-turn">
                        <span className="sc-row__t">
                          <b>{jOf(m.id) ? `J${jOf(m.id)}` : "Partido"}</b>
                          <span>
                            {Number.isFinite(at) ? DAY.format(at).replace(/\./g, "") : "sin fecha"} · {m.home === false ? "fuera" : "en casa"} · {m.rival || "Rival"}
                          </span>
                        </span>
                        <span className="cl-turn__w">
                          {jobs.map((jb) => {
                            const t = turns.find((x) => x.job.id === jb.id);
                            return (
                              <span key={jb.id}>
                                <small>{jb.name.trim() || "Turno"}</small>
                                <b>{t ? nameOf(t.playerId) || "Nadie" : jb.awayOnly && m.home !== false ? "En casa: no hace falta" : "Nadie"}</b>
                              </span>
                            );
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <h3 className="sc-h3 cl-sub">Quién lo hizo</h3>
            {(() => {
              const rows = played.flatMap((m) => {
                const d = byId[m.id];
                if (!d) return [];
                const entries = Object.entries(d.turns).filter(([, t]) => t?.playerId);
                if (!entries.length) return [];
                return [{ m, d, entries }];
              });
              if (!rows.length) return <p className="sc-small">Todavía no hay turnos de partidos jugados.</p>;
              return (
                <ul className="sc-rows">
                  {rows.map(({ m, d, entries }) => (
                    <li key={m.id} className="sc-row cl-turn">
                      <span className="sc-row__t">
                        <SalaLink className="vd-link" to={`/admin/partidos/${m.id}/convocatoria`}>
                          {jOf(m.id) ? `J${jOf(m.id)}` : "Partido"} · {m.rival || "Rival"}
                        </SalaLink>
                      </span>
                      <span className="cl-turn__w">
                        {entries.map(([jid, t]) => {
                          const uid = uidOf(t?.playerId ?? null);
                          const done = !!uid && typeof d.done?.[uid] === "number";
                          return (
                            <span key={jid}>
                              <small>{jobs.find((j) => j.id === jid)?.name ?? (savedJobs ?? []).find((j) => j.id === jid)?.name ?? jid}</small>
                              <b>{nameOf(t?.playerId ?? null) || "—"}</b>
                              <i className="sc-tag sc-tag--quiet">{done ? "Lo hizo" : "Sin marcar"}</i>
                            </span>
                          );
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              );
            })()}
            <p className="sc-small">Lo marca cada socio con «Hecho» en su vestuario; a la capitanía le llega un aviso.</p>
            {draft && errs.length > 0 && (
              <>
                <h3 className="sc-h3 cl-sub">Falta para guardar</h3>
                <ul className="cl-list cl-list--bad">
                  {errs.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </>
            )}
            {draft && (
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri cl-side__save" aria-disabled={saving || errs.length > 0 || conflict || undefined} onClick={() => !saving && !errs.length && !conflict && void save()}>
                {saving ? "Guardando…" : "Guardar los turnos"}
              </button>
            )}
          </aside>
        </div>
      )}
    </RoomScreen>
  );
}
