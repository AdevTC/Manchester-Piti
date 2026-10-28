// CLUB · Clasificación (/admin/club/clasificacion; board part-club.html § clasificación): the league table of the
// season of the sala — «Pegar desde la liga» (read line by line, what isn't read is shown), the editor (each team in
// its sheet), «La web dirá…», the checks that block and the ones that only warn, and «Guardar la clasificación».
// The draft lives outside the screen (drafts.ts): a save never remounts it, so a refused save keeps the table and says
// why (B-CLUB-04), another captain's save while you edit says so instead of being thrown away, and leaving asks first
// and keeps the draft for when you come back (B-CLUB-09).
import { useMemo, useState } from "react";
import { VIcon } from "../../../../components/vidrio/VIcon";
import { apiError } from "../../../../lib/clubApi";
import { FORM_LETTERS, FORM_MAX, parseLeagueTable, pasteJornada, STANDINGS_LIMITS, type FormLetter, type ParsedTable } from "../../../../lib/standings";
import { plural } from "../../../../lib/derived/words";
import { useClasificacionWrites, useStandings } from "../../data/useClasificacion";
import { SalaSheet } from "../../shell/Sheet";
import { ScreenError, ScreenLoading } from "../../shell/Screen";
import { useAdmin } from "../../shell/context";
import { useStatus } from "../../shell/statusContext";
import { useUnsavedGuard } from "../../ui/guard";
import { useRoomDraft } from "./drafts";
import { blankRow, claChecks, draftFrom, draftJornada, formLabel, la, lastPublishedJornada, markUs, plainRows, relWhen, saysText, standingsSig, tableBehind, toCount, webRecord, withKeys, type ClaDraft, type ClaRow } from "./model";
import { ClIcon, RoomScreen } from "./Room";

const NUMS = [
  ["pj", "PJ"],
  ["g", "G"],
  ["e", "E"],
  ["p", "P"],
  ["gf", "GF"],
  ["gc", "GC"],
  ["pts", "Pts"],
] as const;
const ord = (n: number) => `${n}.º`;

export function ClasificacionScreen() {
  const data = useAdmin();
  const status = useStatus();
  const writes = useClasificacionWrites();
  const season = data.season;
  const sid = season?.id ?? "";
  const { standings: saved, loading } = useStandings(sid || undefined);
  const [draft, setDraft] = useRoomDraft<ClaDraft>(`cla:${sid}`);
  const [paste, setPaste] = useState<{ text: string; parsed: ParsedTable | null } | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [live, setLive] = useState("");

  const savedRows = useMemo(() => withKeys(saved?.rows ?? []), [saved]);
  const rows: ClaRow[] = draft ? draft.rows : savedRows;
  const web = useMemo(() => (sid ? webRecord(data.matches, sid, data.stateOf) : null), [data.matches, data.stateOf, sid]);
  const { errs, warns } = claChecks(rows, web);
  const conflict = !!draft && !saving && draft.base !== standingsSig(saved) && !!saved;
  const lastJ = sid ? lastPublishedJornada(data.matches, sid, data.stateOf) : null;
  const behind = tableBehind(saved, lastJ);
  const nick = (uid: string) => data.people.find((p) => p.uid === uid)?.nickname || "otro capitán";
  const jornada = draft ? draftJornada(draft) : (saved?.jornada ?? null);

  const edit = (fn: (d: ClaDraft) => ClaDraft, liveText = "") => {
    setErr("");
    setDraft((cur) => fn(cur ?? draftFrom(saved, Date.now())));
    if (liveText) setLive(liveText);
  };
  const editRow = (k: string, patch: Partial<ClaRow>) => edit((d) => ({ ...d, rows: d.rows.map((r) => (r.k === k ? { ...r, ...patch } : r)) }));

  const save = async (force = false): Promise<boolean> => {
    if (!draft || !sid) return false;
    if (errs.length) {
      setErr(`Falta para guardar: ${errs[0]}`);
      return false;
    }
    if (conflict && !force) return false;
    setSaving(true);
    setErr("");
    const sending = draft;
    const rowsOut = plainRows(sending.rows);
    try {
      await writes.save(sid, { competition: sending.competition.trim(), jornada: draftJornada(sending), rows: rowsOut }, saved);
      setDraft((cur) => (cur === sending ? null : cur));
      status.show({ tag: "Tabla", message: `Guardada: ${saysText(rowsOut, draftJornada(sending))} · llega «Ya está la clasificación» al equipo` });
      return true;
    } catch (e) {
      const msg = `No se ha podido guardar la clasificación: ${apiError(e)}. Tu tabla sigue aquí, sin perder nada.`;
      setErr(msg);
      status.show({ tone: "error", message: "No se ha podido guardar la clasificación · tu tabla sigue aquí", retry: () => void save(force) });
      return false;
    } finally {
      setSaving(false);
    }
  };
  useUnsavedGuard(!!draft, { what: "la clasificación", alt: { label: "Guardar y salir", run: () => save() } });

  const move = (i: number, by: -1 | 1) =>
    edit((d) => {
      const j = i + by;
      if (j < 0 || j >= d.rows.length) return d;
      const rs = [...d.rows];
      [rs[i], rs[j]] = [rs[j], rs[i]];
      setLive(`${rs[j].team || "El equipo"}, ahora ${ord(j + 1)}`);
      return { ...d, rows: rs };
    });
  const readPaste = () => setPaste((p) => (p ? { ...p, parsed: parseLeagueTable(p.text, saved?.rows.find((r) => r.isUs)?.team) } : p));
  const usePaste = () => {
    if (!paste?.parsed?.rows.length) return;
    const parsed = paste.parsed;
    edit((d) => ({ ...d, rows: markUs(withKeys(parsed.rows)), jornada: d.jornada || (pasteJornada(parsed) ? String(pasteJornada(parsed)) : ""), competition: d.competition || saved?.competition || "Liga F7" }), "Tabla pegada en el editor · sin guardar todavía");
    setPaste(null);
  };
  const byHand = () => edit((d) => ({ ...d, rows: [blankRow("Manchester Piti", true), blankRow()] }));
  const addRow = () => {
    if (rows.length >= STANDINGS_LIMITS.maxRows) return;
    const r = blankRow();
    edit((d) => ({ ...d, rows: [...d.rows, r] }));
    setEditKey(r.k);
  };
  const discard = () => {
    setDraft(null);
    setErr("");
    setLive("Cambios descartados");
  };

  const primary = draft
    ? { label: saving ? "Guardando…" : "Guardar la clasificación", onClick: () => void save(), disabled: saving || errs.length > 0 || conflict, why: errs[0] ?? (conflict ? "Otro capitán ha guardado antes: elige qué tabla se queda." : undefined) }
    : { label: "Pegar desde la liga", onClick: () => setPaste({ text: "", parsed: null }) };
  const er = editKey ? rows.find((r) => r.k === editKey) : undefined;
  const lede = season ? (saved ? `${la(season.name)} · ${saved.rows.length} equipos · ${saysText(saved.rows, saved.jornada)}` : `${la(season.name)} · sin tabla todavía`) : "Sin temporada";

  return (
    <RoomScreen room="clasificacion" lede={lede} primary={primary}>
      {loading && !draft ? (
        <ScreenLoading label="Cargando la clasificación" />
      ) : data.error ? (
        <ScreenError what="la clasificación" onRetry={() => window.location.reload()} />
      ) : !season ? (
        <div className="cl-emptyb">
          <h2 className="sc-h3">Aún no hay temporada</h2>
          <p className="sc-p">La clasificación va por temporadas: crea una en Temporadas y vuelve.</p>
        </div>
      ) : (
        <div className="cl-grid cl-cla">
          <section className="cl-col sc-scroll" aria-labelledby="cl-cla-t">
            <h2 className="vd-vh" id="cl-cla-t">
              La tabla de {la(season.name)}
            </h2>
            {behind && (
              <p className="cl-pend">
                <span className="sc-tag sc-tag--toca">Te toca</span>La web sigue con la tabla de la J{behind.table} y ya está publicada la J{behind.acta}.
              </p>
            )}
            {rows.length > 0 && (
              <p className="cl-says">
                <span>{draft ? "La web dirá" : "La web dice"}</span>
                <b>{saysText(plainRows(rows), jornada)}</b>
              </p>
            )}
            {saved && draft && <p className="sc-small">Ahora en la web: {saysText(saved.rows, saved.jornada)} · actualizada {relWhen(saved.updatedAt, data.now)} por {nick(saved.updatedBy)}</p>}
            {saved && !draft && <p className="sc-small">Actualizada {relWhen(saved.updatedAt, data.now)} por {nick(saved.updatedBy)}</p>}
            {conflict && saved && (
              <div className="cl-alert" role="alert">
                <p>
                  <b>Otro capitán ha guardado antes.</b> {nick(saved.updatedBy)} ha guardado la clasificación {relWhen(saved.updatedAt, data.now)}, mientras editabas. Guardar la tuya la sustituye.
                </p>
                <div className="sc-btnrow">
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => { setDraft(null); setLive(`Recargada la tabla de ${nick(saved.updatedBy)}`); }}>
                    Recargar la suya
                  </button>
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => void save(true)}>
                    Guardar la mía encima
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
                <span>Cambios sin guardar desde {relWhen(draft.since, data.now)} · la web sigue enseñando la tabla de antes.</span>
                <button type="button" className="vd-link" onClick={discard}>
                  Descartar los cambios
                </button>
              </p>
            )}
            {!saved && !draft && !paste && (
              <div className="cl-emptyb">
                <h3 className="sc-h3">Aún no hay clasificación de {la(season.name)}</h3>
                <p className="sc-p">La web no enseña nada hasta la primera: pégala desde la web de la liga o escríbela a mano.</p>
                <div className="sc-btnrow">
                  <button type="button" className="vd-btn vd-glass vd-press" onClick={() => setPaste({ text: "", parsed: null })}>
                    Pegar desde la liga
                  </button>
                  <button type="button" className="vd-btn vd-glass vd-press" onClick={byHand}>
                    Escribirla a mano
                  </button>
                </div>
              </div>
            )}
            {paste && (
              <div className="cl-paste">
                <h3 className="sc-h3">Pegar desde la liga</h3>
                <p className="sc-small">Copia la tabla entera de la web de la liga (con sus números) y pégala aquí. Se lee línea a línea: lo que no se entienda, se enseña.</p>
                <label className="sc-field">
                  <span>La tabla copiada</span>
                  <textarea className="vd-input" rows={8} placeholder="1  Orduña fc  3  3  0  0  24  6  9" value={paste.text} onChange={(e) => setPaste({ text: e.target.value, parsed: null })} />
                </label>
                <div className="sc-btnrow">
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={readPaste} aria-disabled={!paste.text.trim() || undefined}>
                    Leer la tabla
                  </button>
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => setPaste(null)}>
                    Cancelar
                  </button>
                </div>
                {paste.parsed && (
                  <>
                    <p className="sc-p cl-parsed" role="status">
                      {paste.parsed.rows.length ? `${plural(paste.parsed.rows.length, "equipo leído", "equipos leídos")}${pasteJornada(paste.parsed) ? ` · jornada ${pasteJornada(paste.parsed)}` : ""}${paste.parsed.rows.some((r) => r.isUs) || paste.parsed.rows.some((r) => /piti/i.test(r.team)) ? "" : " · marca luego cuál somos nosotros"}` : "No se ha leído ninguna fila: copia la tabla entera desde la web de la liga, con sus números."}
                    </p>
                    {paste.parsed.rows.length > 0 && (
                      <ol className="sc-rows">
                        {markUs(withKeys(paste.parsed.rows)).map((r, i) => (
                          <li key={r.k} className="sc-row">
                            <span className="sc-row__t">
                              <b>
                                {ord(i + 1)} {r.team}
                              </b>
                              <span>
                                {r.pj} PJ · {r.pts} pts
                              </span>
                            </span>
                            {r.isUs && <span className="sc-tag">Nosotros</span>}
                          </li>
                        ))}
                      </ol>
                    )}
                    {paste.parsed.skipped.length > 0 && (
                      <>
                        <p className="sc-small">
                          <b>Estas líneas no se han leído:</b> si falta un equipo, estaba ahí: añádelo a mano en el editor.
                        </p>
                        <ul className="cl-bad">
                          {paste.parsed.skipped.map((b, i) => (
                            <li key={`${i}-${b}`}>
                              <code>{b}</code>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {paste.parsed.rows.length > 0 && (
                      <button type="button" className="vd-btn vd-glass vd-press" onClick={usePaste}>
                        Usar esta tabla
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {rows.length > 0 && (
              <>
                <div className="sc-form cl-cla__meta">
                  <label className="sc-field">
                    <span>Competición</span>
                    <input className="vd-input" type="text" maxLength={STANDINGS_LIMITS.competition} placeholder="Liga F7 de otoño" value={draft ? draft.competition : (saved?.competition ?? "")} onChange={(e) => edit((d) => ({ ...d, competition: e.target.value.slice(0, STANDINGS_LIMITS.competition) }))} />
                  </label>
                  <label className="sc-field">
                    <span>Jornada</span>
                    <input className="vd-input" type="text" inputMode="numeric" maxLength={2} placeholder="3" value={draft ? draft.jornada : saved?.jornada ? String(saved.jornada) : ""} onChange={(e) => edit((d) => ({ ...d, jornada: e.target.value.replace(/\D/g, "").slice(0, 2) }))} />
                    <small>Si la escribes, manda sobre la pegada.</small>
                  </label>
                </div>
                <header className="sc-sec__h">
                  <h3 className="sc-h3">La tabla</h3>
                  <span className="sc-sec__n">{plural(rows.length, "equipo", "equipos")}</span>
                </header>
                <p className="cl-thead" aria-hidden="true">
                  <span>Pos · equipo</span>
                  <span>PJ · G · E · P · GF · GC</span>
                  <span>Pts</span>
                  <span>Últimos 5</span>
                </p>
                <ol className="sc-rows cl-table" aria-label="La tabla de la liga">
                  {rows.map((r, i) => {
                    const name = r.team.trim() || "este equipo";
                    return (
                      <li key={r.k} className={`sc-row cl-trow${r.isUs ? " is-us" : ""}`}>
                        <span className="cl-trow__t">
                          <b>
                            {ord(i + 1)} {r.team.trim() || "Sin nombre"}
                          </b>
                          {r.isUs && <span className="sc-tag">Somos nosotros</span>}
                        </span>
                        <span className="cl-trow__n">{[r.pj, r.g, r.e, r.p, r.gf, r.gc].join(" · ")}</span>
                        <b className="cl-trow__p sc-num">{r.pts}</b>
                        <span className="cl-form" role="img" aria-label={formLabel(r.form)}>
                          {(r.form ?? []).map((l, j) => (
                            <i key={j} className={`sc-res sc-res--${l}`}>
                              {l}
                            </i>
                          ))}
                        </span>
                        <span className="cl-trow__a">
                          <button type="button" className="vd-ibtn vd-glass vd-press" aria-label={`Subir a ${name}`} aria-disabled={i === 0 || undefined} onClick={() => i > 0 && move(i, -1)}>
                            <VIcon name="chevR" size={18} className="cl-up" />
                          </button>
                          <button type="button" className="vd-ibtn vd-glass vd-press" aria-label={`Bajar a ${name}`} aria-disabled={i === rows.length - 1 || undefined} onClick={() => i < rows.length - 1 && move(i, 1)}>
                            <VIcon name="chevR" size={18} className="cl-down" />
                          </button>
                          <button type="button" className="vd-ibtn vd-glass vd-press" aria-label={`Editar la fila de ${name}`} aria-haspopup="dialog" onClick={() => setEditKey(r.k)}>
                            <ClIcon name="edit" />
                          </button>
                          <button type="button" className="vd-ibtn vd-glass vd-press" aria-label={`Quitar a ${name} de la tabla`} onClick={() => edit((d) => ({ ...d, rows: d.rows.filter((x) => x.k !== r.k) }), `${r.team.trim() || "El equipo"} quitado de la tabla`)}>
                            <ClIcon name="trash" />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm cl-addrow" aria-disabled={rows.length >= STANDINGS_LIMITS.maxRows || undefined} onClick={addRow}>
                  <VIcon name="plus" size={16} />
                  Añadir equipo
                </button>
              </>
            )}
            <p className="vd-vh" aria-live="polite">
              {live}
            </p>
          </section>
          <aside className="cl-col cl-side sc-scroll" aria-label="Antes de guardar">
            {draft && errs.length > 0 && (
              <>
                <h3 className="sc-h3">Falta para guardar</h3>
                <ul className="cl-list cl-list--bad">
                  {errs.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </>
            )}
            {rows.length > 0 && warns.length > 0 && (
              <>
                <h3 className="sc-h3">Avisos, no impiden guardar</h3>
                <ul className="cl-list">
                  {warns.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </>
            )}
            {draft && (
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri cl-side__save" aria-disabled={saving || errs.length > 0 || conflict || undefined} onClick={() => !saving && !errs.length && !conflict && void save()}>
                {saving ? "Guardando…" : "Guardar la clasificación"}
              </button>
            )}
            <p className="sc-small">Al guardar, la web enseña la tabla nueva y llega el aviso «Ya está la clasificación» a todo el equipo.</p>
          </aside>
        </div>
      )}
      <SalaSheet
        open={!!editKey}
        onClose={() => setEditKey(null)}
        title={er ? er.team.trim() || "Equipo nuevo" : "Ese equipo ya no está"}
        className="cl-sheet"
        footer={
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={() => setEditKey(null)}>
            Listo
          </button>
        }
      >
        {er && <TeamFields row={er} onChange={(p) => editRow(er.k, p)} onUs={() => edit((d) => ({ ...d, rows: d.rows.map((x) => ({ ...x, isUs: x.k === er.k })) }))} />}
      </SalaSheet>
    </RoomScreen>
  );
}

function TeamFields({ row, onChange, onUs }: { row: ClaRow; onChange: (p: Partial<ClaRow>) => void; onUs: () => void }) {
  const t = row.team;
  const bad = !t.trim() || t.length > STANDINGS_LIMITS.team;
  const form: (FormLetter | "")[] = Array.from({ length: FORM_MAX }, (_, i) => row.form?.[i] ?? "");
  const hint = [row.g + row.e + row.p !== row.pj ? "G + E + P no suman los PJ" : "", row.pts !== 3 * row.g + row.e ? `los puntos no casan con 3·G + E (${3 * row.g + row.e})` : ""].filter(Boolean).join(" · ") || "Cuadra";
  return (
    <>
      <p className="sc-p cl-sh-lede">Lo que pone la web de la liga. Vacío cuenta como 0.</p>
      <div className="sc-form sc-form--1">
        <label className="sc-field">
          <span>Equipo</span>
          <input className="vd-input" type="text" maxLength={STANDINGS_LIMITS.team + 1} value={t} onChange={(e) => onChange({ team: e.target.value.slice(0, STANDINGS_LIMITS.team + 1) })} aria-invalid={bad || undefined} />
          <small className={bad ? "is-bad" : ""}>
            {t.trim() ? `${t.length}/${STANDINGS_LIMITS.team}` : "Ponle nombre"}
          </small>
        </label>
        <button type="button" className="vd-switch" role="switch" aria-checked={row.isUs} onClick={onUs}>
          <span className="vd-switch__track" aria-hidden="true">
            <span className="vd-switch__knob" />
          </span>
          Somos nosotros
        </button>
      </div>
      <div className="cl-nums">
        {NUMS.map(([k, label]) => (
          <label key={k} className="sc-field">
            <span>{label}</span>
            <input className="vd-input" type="text" inputMode="numeric" value={row[k] ? String(row[k]) : ""} placeholder="0" onChange={(e) => onChange({ [k]: toCount(e.target.value) })} />
          </label>
        ))}
      </div>
      <p className="sc-small" role="status">
        {hint}
      </p>
      <div className="cl-nums cl-nums--form">
        {form.map((l, i) => (
          <label key={i} className="sc-field">
            <span>
              Partido {i + 1}
              {i === FORM_MAX - 1 ? " (el más reciente)" : i === 0 ? " (el más antiguo)" : ""}
            </span>
            <select
              className="vd-input"
              value={l}
              onChange={(e) => {
                const next = [...form];
                next[i] = e.target.value as FormLetter | "";
                onChange({ form: next.filter((x): x is FormLetter => (FORM_LETTERS as readonly string[]).includes(x)) });
              }}
            >
              <option value="">— sin jugar</option>
              <option value="G">G · victoria</option>
              <option value="E">E · empate</option>
              <option value="P">P · derrota</option>
            </select>
          </label>
        ))}
      </div>
    </>
  );
}
