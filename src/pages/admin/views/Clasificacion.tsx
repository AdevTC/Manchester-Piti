// Clasificación (/admin/clasificacion) — the league table the web shows («Vamos 3.º de 12 · 18 pts · J8» on
// the home and /partidos, the full table on /partidos?view=tabla). The captain pastes it from the league's web
// («Pegar desde la liga»: a pure parser, lib/standings, and a preview before it reaches the editor) or keeps
// it by hand: one row per team, add / remove / reorder, «Somos nosotros». Consistency hints (G + E + P ≠ PJ,
// Pts ≠ 3·G + E, our row against the web's own results) never block the save; only what the rules refuse
// does (2–24 teams, exactly one «nosotros», names). Each save keeps the previous table for the arrows.
import { useMemo, useState, type ReactNode } from "react";
import { seasonView } from "../../../lib/partidos";
import {
  NUM_KEYS,
  parseLeagueTable,
  standingsErrors,
  standingsHints,
  STANDINGS_LIMITS,
  stripText,
  updatedText,
  type NumKey,
  type ParsedTable,
  type StandingRow,
  type Standings,
  type WebRecord,
} from "../../../lib/standings";
import { LoadError } from "../club/ClubStates";
import { useClasificacionWrites, useStandings } from "../data/useClasificacion";
import { useAdmin } from "../shell/context";
import { useFrame } from "../ui/frame";
import { AdIcon } from "../ui/icons";
import { EmptyState } from "../ui/controls";
import { useToast } from "../ui/toastContext";
import "../clasificacion/clasificacion.css";

const NUM_LABEL: Record<NumKey, string> = { pj: "PJ", g: "G", e: "E", p: "P", gf: "GF", gc: "GC", pts: "Pts" };
const NUM_TITLE: Record<NumKey, string> = { pj: "Partidos jugados", g: "Ganados", e: "Empatados", p: "Perdidos", gf: "Goles a favor", gc: "Goles en contra", pts: "Puntos" };
const blankRow = (): StandingRow => ({ team: "", pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0, isUs: false });
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es").trim();
const toInt = (v: string) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export function Clasificacion() {
  const data = useAdmin();
  const { desktop } = useFrame();
  const [seasonPick, setSeasonPick] = useState<string | null>(null);
  const seasonId = seasonPick ?? data.season?.id ?? data.seasons.find((s) => !s.archived)?.id ?? "";
  const season = data.seasons.find((s) => s.id === seasonId) ?? null;
  const { standings, loading } = useStandings(seasonId || undefined);

  const seasonSelect = (
    <label className="cl-season">
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

  const body = data.error ? (
    <LoadError what="la clasificación" />
  ) : data.loading || loading ? (
    <div className="skel" role="status" aria-label="Cargando la clasificación">
      <i />
      <i />
      <i />
    </div>
  ) : !seasonId ? (
    <div className="void">
      <h3>Aún no hay temporada</h3>
      <p>La clasificación va por temporadas: crea una en Temporadas y vuelve.</p>
    </div>
  ) : (
    // (a new table from the server, or another season: the editor starts again from it)
    <Editor key={`${seasonId}:${standings?.updatedAt ?? "none"}`} seasonId={seasonId} seasonName={season?.name ?? "temporada"} standings={standings} seasonSelect={desktop ? null : seasonSelect} />
  );

  return desktop ? (
    <>
      <div className="vh">
        <div>
          <h1 className="ttl">Clasificación</h1>
          <p className="ld">La tabla de la liga · la web dice «Vamos 3.º de 12» con ella</p>
        </div>
        {seasonId && <div className="r">{seasonSelect}</div>}
      </div>
      <div className="scr cl-scroll">{body}</div>
    </>
  ) : (
    <div className="msc">{body}</div>
  );
}

function Editor({ seasonId, seasonName, standings, seasonSelect }: { seasonId: string; seasonName: string; standings: Standings | null; seasonSelect: ReactNode }) {
  const data = useAdmin();
  const toast = useToast();
  const writes = useClasificacionWrites();
  const [started, setStarted] = useState(!!standings);
  const [competition, setCompetition] = useState(standings?.competition ?? "");
  const [jornada, setJornada] = useState(standings?.jornada != null ? String(standings.jornada) : "");
  const [rows, setRows] = useState<StandingRow[]>(() => standings?.rows.map((r) => ({ ...r })) ?? []);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [preview, setPreview] = useState<ParsedTable | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // The web's own record for the season (in this competition when the matches say which one).
  const web: WebRecord | null = useMemo(() => {
    const inSeason = data.published.filter((m) => m.seasonId === seasonId);
    const comp = norm(competition);
    const inComp = comp ? inSeason.filter((m) => m.competition && norm(m.competition) === comp) : [];
    const v = seasonView(inComp.length ? inComp : inSeason, seasonId, data.now);
    return v.played.length ? { pj: v.played.length, g: v.wins, e: v.draws, p: v.losses, gf: v.gf, gc: v.ga } : null;
  }, [data.published, data.now, seasonId, competition]);

  const errors = standingsErrors(rows);
  const hints = standingsHints(rows, web);
  const jornadaNum = jornada.trim() ? toInt(jornada) : null;
  const usTeam = rows.find((r) => r.isUs)?.team ?? standings?.rows.find((r) => r.isUs)?.team;
  const strip = errors.length ? null : stripText({ rows, jornada: jornadaNum });

  const setRow = (i: number, patch: Partial<StandingRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setUs = (i: number) => setRows((rs) => rs.map((r, j) => ({ ...r, isUs: j === i })));
  const move = (i: number, by: -1 | 1) =>
    setRows((rs) => {
      const j = i + by;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));
  const add = () => setRows((rs) => (rs.length >= STANDINGS_LIMITS.maxRows ? rs : [...rs, blankRow()]));

  const read = () => setPreview(parseLeagueTable(pasteText, usTeam));
  const usePreview = () => {
    if (!preview) return;
    setRows(preview.rows.map((r) => ({ ...r })));
    if (preview.jornada !== null) setJornada(String(preview.jornada));
    setStarted(true);
    setPasteOpen(false);
    setPreview(null);
    setPasteText("");
  };

  const save = async () => {
    if (errors.length || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await writes.save(seasonId, { competition, jornada: jornadaNum, rows }, standings);
      toast.show({ tag: "TABLA", message: strip ? `Guardada: ${strip}` : "Clasificación guardada" });
    } catch (e) {
      setSaveError(`No se ha podido guardar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const pastePanel = pasteOpen && (
    <section className="calm cl-paste" aria-labelledby="cl-paste-h">
      <h3 id="cl-paste-h">Pegar desde la liga</h3>
      <p className="hint">Copia la tabla de la web de la liga o de una hoja de cálculo y pégala aquí. Se leen las filas con nombre y números; los títulos y la cabecera se saltan.</p>
      <label className="fld w2">
        <span className="lbl">La tabla copiada</span>
        <textarea className="inp cl-ta" value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={8} spellCheck={false} placeholder={"1\tRayo Norte\t8\t6\t1\t1\t25\t8\t19\n2\tManchester Piti\t8\t5\t3\t0\t20\t9\t18"} />
      </label>
      <div className="cl-acts">
        <button type="button" className="btn sky" onClick={read} disabled={!pasteText.trim()}>
          <AdIcon name="list" size={17} />
          Leer la tabla
        </button>
        <button type="button" className="btn line" onClick={() => (setPasteOpen(false), setPreview(null))}>
          Cancelar
        </button>
      </div>
      {preview && (
        <div className="cl-prev" aria-live="polite">
          {preview.rows.length ? (
            <>
              <p className="hint">
                {preview.rows.length} {preview.rows.length === 1 ? "equipo leído" : "equipos leídos"}
                {preview.jornada !== null ? ` · jornada ${preview.jornada}` : ""}
                {preview.skipped.length ? ` · ${preview.skipped.length} ${preview.skipped.length === 1 ? "línea saltada" : "líneas saltadas"}` : ""}
                {preview.rows.some((r) => r.isUs) ? "" : " · marca luego cuál somos nosotros"}
              </p>
              <ol className="cl-prev-list">
                {preview.rows.map((r, i) => (
                  <li key={i} className={r.isUs ? "us" : undefined}>
                    <b>{r.team}</b>
                    <span>
                      {r.pj} PJ · {r.g}-{r.e}-{r.p} · {r.gf}:{r.gc} · <strong>{r.pts} pts</strong>
                    </span>
                    {r.isUs && <em>Nosotros</em>}
                  </li>
                ))}
              </ol>
              <div className="cl-acts">
                <button type="button" className="btn gold" onClick={usePreview}>
                  <AdIcon name="check" size={17} />
                  Usar esta tabla
                </button>
              </div>
              <p className="hint">Pasa al editor: revísala y guarda.</p>
            </>
          ) : (
            <p className="hint cl-warn">
              <AdIcon name="alert" size={15} />
              No se ha leído ninguna fila. Prueba a copiar solo la tabla (equipo y números, separados por tabuladores o espacios).
            </p>
          )}
        </div>
      )}
    </section>
  );

  if (!started && !pasteOpen) {
    return (
      <div className="cl-adm">
        {seasonSelect}
        <EmptyState icon="list" title={`Aún no hay clasificación de la ${seasonName}`}>
          La web no muestra nada hasta que guardes la primera tabla.
        </EmptyState>
        <div className="cl-acts">
          <button type="button" className="btn gold" onClick={() => setPasteOpen(true)}>
            <AdIcon name="doc" size={17} />
            Pegar desde la liga
          </button>
          <button type="button" className="btn line" onClick={() => (setStarted(true), setRows([blankRow(), blankRow()]))}>
            <AdIcon name="pencil" size={17} />
            Escribirla a mano
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cl-adm">
      {seasonSelect}
      {standings && (
        <p className="cl-now">
          <AdIcon name="info" size={15} />
          En la web: {stripText(standings) ?? "sin nuestra fila"}
          {updatedText(standings.updatedAt) ? ` · ${updatedText(standings.updatedAt)}` : ""}
        </p>
      )}
      {pastePanel}
      {!pasteOpen && (
        <div className="cl-acts">
          <button type="button" className="btn line" onClick={() => setPasteOpen(true)}>
            <AdIcon name="doc" size={17} />
            Pegar desde la liga
          </button>
        </div>
      )}
      {started && (
        <section className="calm cl-ed" aria-labelledby="cl-ed-h">
          <h3 id="cl-ed-h">
            La tabla <em>{rows.length} {rows.length === 1 ? "equipo" : "equipos"}</em>
          </h3>
          <div className="cl-meta">
            <label className="fld">
              <span className="lbl">Competición</span>
              <input className="inp" value={competition} maxLength={STANDINGS_LIMITS.competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Liga F7 de otoño" />
            </label>
            <label className="fld">
              <span className="lbl">Jornada</span>
              <input className="inp" inputMode="numeric" value={jornada} onChange={(e) => setJornada(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="8" />
            </label>
          </div>
          <ol className="cl-rows">
            {rows.map((r, i) => {
              const name = r.team.trim() || `fila ${i + 1}`;
              return (
                <li key={i} className={`cl-row${r.isUs ? " us" : ""}`}>
                  <span className="pos" aria-hidden="true">
                    {i + 1}
                  </span>
                  <input className="inp team" value={r.team} maxLength={STANDINGS_LIMITS.team} onChange={(e) => setRow(i, { team: e.target.value })} aria-label={`Equipo, puesto ${i + 1}`} placeholder="Equipo" />
                  <div className="nums">
                    {NUM_KEYS.map((k) => (
                      <label key={k} className="num">
                        <span title={NUM_TITLE[k]}>{NUM_LABEL[k]}</span>
                        <input className="inp" inputMode="numeric" value={String(r[k])} onChange={(e) => setRow(i, { [k]: toInt(e.target.value) })} aria-label={`${NUM_TITLE[k]} · ${name}`} />
                      </label>
                    ))}
                  </div>
                  <label className="us-pick">
                    <input type="radio" name={`cl-us-${seasonId}`} checked={r.isUs} onChange={() => setUs(i)} />
                    <span>Somos nosotros</span>
                  </label>
                  <div className="row-acts" role="group" aria-label={`Mover o quitar ${name}`}>
                    <button type="button" className="btn sm line" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Subir ${name}`}>
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button type="button" className="btn sm line" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Bajar ${name}`}>
                      <span aria-hidden="true">↓</span>
                    </button>
                    <button type="button" className="btn sm line" onClick={() => remove(i)} aria-label={`Quitar ${name}`}>
                      <AdIcon name="trash" size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="cl-acts">
            <button type="button" className="btn line" onClick={add} disabled={rows.length >= STANDINGS_LIMITS.maxRows}>
              <AdIcon name="plus" size={17} />
              Añadir equipo
            </button>
          </div>
          {hints.length > 0 && (
            <div className="cl-hints" role="note" aria-label="Avisos de la tabla">
              <b>
                <AdIcon name="info" size={15} />
                Avisos, no impiden guardar
              </b>
              <ul>
                {hints.map((h, i) => (
                  <li key={i}>{h.text}</li>
                ))}
              </ul>
            </div>
          )}
          {errors.length > 0 && (
            <ul className="cl-errs" aria-label="Falta para guardar">
              {errors.map((e) => (
                <li key={e}>
                  <AdIcon name="alert" size={15} />
                  {e}
                </li>
              ))}
            </ul>
          )}
          {saveError && (
            <p className="cl-errs" role="alert">
              {saveError}
            </p>
          )}
          <div className="cl-save">
            {strip && <span className="cl-strip-prev">La web dirá: «{strip}»</span>}
            <button type="button" className="btn gold" onClick={() => void save()} aria-disabled={errors.length > 0 || saving} disabled={saving}>
              <AdIcon name="check" size={17} />
              {saving ? "Guardando…" : "Guardar la clasificación"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
