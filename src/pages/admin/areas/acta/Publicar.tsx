// ACTA · Publicar (/admin/partidos/<id>/publicar), as its board (part-partido-publicar.html, acta.js § publicar):
// «Antes de publicar» with each warning fixed in place (the goal without scorer, the minute that is missing, the
// assists to confirm), «Así lo verá la afición» (the public head as it is, M-09), the crónica with «Preparar resumen
// con el acta» (with «Deshacer», A-PAR-12), the photo and the gallery, the minutes of the convocatoria and the changes,
// the cartel (Cuadrado · Historia 9:16), and «Publicar el acta», which says its consequences in words before it goes
// (A-PAR-10) and then opens «Después del partido». A published acta: «Guardar cambios».
import { useState, type FormEvent } from "react";
import { downloadMatchPoster, type PosterFormat } from "../../../../lib/matchPoster";
import { isGuestId } from "../../../../lib/derived/guests";
import { useMvpResults } from "../../../vestuario/live";
import { buildResumen } from "../../acta/resumen";
import { goalRows, okHttps, rivalInitialsOf, score, setAssist, setMinute, setScorer } from "../../acta/sheetModel";
import { cronicaHeadline } from "../../partidos/workspaceModel";
import { usePartido } from "../../partido/partidoContext";
import { useRegisterCommands } from "../../palette/registry";
import type { PaletteCommand } from "../../palette/search";
import { SalaSheet } from "../../shell/Sheet";
import { ScreenLoading } from "../../shell/Screen";
import { useSalaGo } from "../../shell/salaHref";
import { useStatus } from "../../shell/statusContext";
import { useAdmin } from "../../shell/context";
import { rivalCode } from "../../../../lib/eventMeta";
import { checkRows, dayName, fanScorers, letterOf, letterWord, minutesBars, mvpView, publishWords } from "./actaModel";
import { AcIcon, ActaEmpty, ActaStills, Shirt } from "./parts";
import { useSheetSession, type SheetSession } from "./sheetSession";
import "./acta.css";

export function PublicarScreen() {
  const s = useSheetSession();
  const { phase } = usePartido();
  const go = useSalaGo();
  const base = `/admin/partidos/${s.match.id}`;
  if (s.loading) return <ScreenLoading label="Cargando el acta" />;
  const notYet = phase === "antes" || phase === "juego" || phase === "descanso" || phase === "aplazado" || phase === "cancelado";
  const pendFirst = phase === "pendiente" && s.value.status === "scheduled" && !s.value.events.length;
  return (
    <ActaStills s={s}>
      <section className="ac ac-pub" aria-label="Publicar el acta">
        {notYet ? (
          <ActaEmpty title="Aún no hay nada que publicar" body="Cuando se juegue y cuadre el acta, aquí verás cómo lo verá la afición, la crónica, la foto, los minutos y el MVP." />
        ) : pendFirst ? (
          <ActaEmpty title="Primero, ¿cómo acabó?" body="Este partido no llegó a la mesa: apunta el resultado y los goleadores en el acta y vuelve aquí.">
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={() => go(`${base}/acta`)}>
              Apuntar el resultado
            </button>
          </ActaEmpty>
        ) : (
          <Publish s={s} />
        )}
      </section>
    </ActaStills>
  );
}

function Publish({ s }: { s: SheetSession }) {
  const go = useSalaGo();
  const status = useStatus();
  const data = useAdmin();
  const mvpResults = useMvpResults();
  const base = `/admin/partidos/${s.match.id}`;
  const { sheet, rival, review, nameOf } = s;
  const [confirm, setConfirm] = useState(false);
  const [gal, setGal] = useState("");
  const [format, setFormat] = useState<PosterFormat>("square");
  const { gf, ga } = score(sheet);
  const rows = goalRows(sheet);
  const missing = rows.filter((g) => g.open);
  const noMin = rows.filter((g) => g.minute === undefined);
  const assist = rows.filter((g) => !g.open && g.kind !== "og" && !g.assist && g.assistReviewed !== true);
  const blockers = checkRows(review).filter((c) => c.k === "mal");
  const called = [...sheet.starters, ...sheet.bench];
  const pool = called.length ? called : s.roster.map((p) => p.id);
  const num = (id: string) => (isGuestId(id) ? "INV" : (s.info(id).number ?? "—").toString());
  const mins = minutesBars(sheet, s.info);
  const played = mins.rows.filter((r) => r.minutes > 0);
  const letter = letterOf(gf, ga);
  const t = sheet.date;
  const day = Number.isFinite(t) ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" }).format(t) : "sin fecha";
  const scorers = fanScorers(sheet, (id) => nameOf(id));
  const mvp = mvpView({ voteClosesAt: s.match.voteClosesAt, publishedAt: s.match.actaPublishedAt ?? null, total: mvpResults.get(s.match.id)?.total ?? 0, eligible: mvpResults.get(s.match.id)?.eligible ?? null, winners: [], now: data.now });
  const words = publishWords({ j: s.j, sheet, firstTime: !s.published, voteClosesAt: s.published && Number.isFinite(Number(s.match.voteClosesAt)) ? Number(s.match.voteClosesAt) : null, now: data.now, played: played.length, devices: null });
  const headline = cronicaHeadline(gf, ga, sheet.home, rival);
  const photo = (sheet.photoUrl ?? "").trim();
  const gallery = sheet.gallery ?? [];
  const galBad = !!gal.trim() && !okHttps(gal.trim());

  const summary = () => {
    const before = s.value.report;
    s.update((v) => ({ ...v, report: buildResumen({ ...sheet, report: v.report }, (id) => nameOf(id)) }));
    status.show({ tag: "Crónica", message: before ? "Resumen preparado con el acta · «Deshacer» recupera tu texto" : "Resumen preparado con el acta · retócalo antes de publicar", undo: before ? () => s.update((v) => ({ ...v, report: before })) : undefined });
  };
  const addGal = (e: FormEvent) => {
    e.preventDefault();
    const u = gal.trim();
    if (!/^https:\/\//i.test(u) || !okHttps(u)) return status.show({ tone: "error", message: "Tiene que empezar por https://" });
    if (gallery.length >= 20) return status.show({ tone: "error", message: "La galería admite hasta 20 fotos" });
    s.update((v) => ({ ...v, gallery: [...(v.gallery ?? []), u] }));
    status.show({ tag: "Galería", message: `Foto añadida · ${gallery.length + 1} de 20` });
    setGal("");
  };
  const dropGal = (i: number) => {
    const before = s.value.gallery ?? [];
    s.update((v) => ({ ...v, gallery: (v.gallery ?? []).filter((_, k) => k !== i) }));
    status.show({ tag: "Galería", message: `Foto ${i + 1} quitada de la galería`, undo: () => s.update((v) => ({ ...v, gallery: before })) });
  };
  const poster = () =>
    void downloadMatchPoster({ ...sheet, id: s.match.id, goalsFor: gf, goalsAgainst: ga, rivalInitials: rivalInitialsOf(sheet) }, format)
      .then(() => status.show({ tag: "El cartel", message: `Cartel ${s.j}${format === "story" ? " para historias" : ""} descargado` }))
      .catch(() => status.show({ tone: "error", message: "No se ha podido generar el cartel." }));

  const doPublish = async () => {
    const first = !s.published;
    setConfirm(false);
    const ok = await s.publish();
    if (ok && first) setTimeout(() => go(`${base}/despues`), 0);
  };
  const pri = () => {
    if (s.blocked) return status.show({ tone: "error", message: s.blocked });
    if (s.published && !s.dirty && !s.serverDraft) return status.show({ tag: s.j, message: "No hay cambios que guardar" });
    setConfirm(true);
  };
  const priOff = !!s.blocked || (s.published && !s.dirty && !s.serverDraft);
  const priWhy = s.blocked ? `No se puede publicar todavía: ${s.blocked.replace(/^Para publicar:? ?/, "").replace(/^falta/, "falta")}` : s.published ? (s.dirty ? "«Guardar cambios» corrige la web al momento" : "Lo que cambies aquí se corrige en la web al guardar") : "Se publica con sus consecuencias: te las decimos antes.";

  const cmds: PaletteCommand[] = [{ id: `publicar:${s.match.id}`, group: "Acciones", icon: "✓", title: s.published ? `Guardar los cambios del acta de la ${s.j}` : `Publicar el acta de la ${s.j}`, description: priWhy, hint: "acción", keywords: "publicar acta", run: pri }];
  useRegisterCommands(cmds);

  return (
    <>
      <div className="ac-pubgrid">
        <div className="ac-pub__col">
          <section className="sc-sec ac-sec ac-pre" aria-labelledby="ac-pre-t">
            <header className="sc-sec__h">
              <h2 className="sc-h2" id="ac-pre-t">
                Antes de publicar
              </h2>
            </header>
            <p className={`ac-pre__s is-${review.cuadra}`}>
              <b>{review.cuadra ? "Lista para publicar" : "Hay datos pendientes"}</b>
              <span>{review.cuadra ? "Marcador, goleadores, convocatoria y secuencia de cambios coherentes." : `${blockers.length === 1 ? "1 cosa por arreglar" : `${blockers.length} cosas por arreglar`}: se arreglan aquí mismo.`}</span>
            </p>
            {missing.length > 0 && (
              <ul className="sc-rows">
                {missing.map((g) => (
                  <li key={g.id} className="ac-fix">
                    <span className="ac-check__i is-mal" aria-hidden="true">
                      !
                    </span>
                    <label className="sc-field">
                      <span>
                        ¿Quién marcó el gol {g.n}
                        {g.minute != null ? ` (${g.minute}′)` : ""}?
                      </span>
                      <select
                        className="vd-input"
                        value=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          s.update((x) => setScorer(x, g.id, v === "own" ? "og" : v));
                          status.show({ tag: `Gol ${g.n}`, message: `Gol ${g.n}: ${v === "own" ? `autogol de ${rival}` : nameOf(v)}` });
                        }}
                      >
                        <option value="">Elige el goleador…</option>
                        {pool.map((id) => (
                          <option key={id} value={id}>
                            {num(id)} · {nameOf(id)}
                          </option>
                        ))}
                        <option value="own">Autogol de {rival}</option>
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {noMin.length > 0 && (
              <ul className="sc-rows">
                {noMin.map((g) => (
                  <li key={g.id} className="ac-fix">
                    <span className="ac-check__i is-mal" aria-hidden="true">
                      !
                    </span>
                    <label className="sc-field">
                      <span>Minuto del gol {g.n}</span>
                      <input className="vd-input ac-min__in" type="text" inputMode="numeric" maxLength={3} placeholder="min" value="" onChange={(e) => s.update((x) => setMinute(x, g.id, e.target.value))} />
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {blockers.length > 0 && (
              <ul className="ac-checks">
                {blockers.map((b, i) => (
                  <li key={`${b.title}-${i}`} className="ac-check is-mal">
                    <span className="ac-check__i" aria-hidden="true">
                      !
                    </span>
                    <span className="ac-check__t">
                      <b>
                        <span className="vd-vh">Falta: </span>
                        {b.title}
                      </b>
                      {b.detail && <span>{b.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {review.ledgerErrors.length > 1 && (
              <details className="ac-more">
                <summary>Ver todos los problemas de los cambios ({review.ledgerErrors.length})</summary>
                <ul>
                  {review.ledgerErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
            {assist.length > 0 && (
              <>
                <h3 className="sc-h3 ac-sub-h">Asistencias por confirmar · {assist.length}</h3>
                <ul className="sc-rows">
                  {assist.map((g) => (
                    <li key={g.id} className="ac-fix">
                      <span className="ac-check__i is-info" aria-hidden="true">
                        i
                      </span>
                      <label className="sc-field">
                        <span>
                          Gol {g.n} de {nameOf(g.scorer ?? "")}
                          {g.minute != null ? ` (${g.minute}′)` : ""}
                        </span>
                        <select
                          className="vd-input"
                          value=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            s.update((x) => setAssist(x, g.id, v === "none" ? null : v));
                            status.show({ tag: `Gol ${g.n}`, message: v === "none" ? `Gol ${g.n}: confirmado sin asistencia` : `Gol ${g.n}: pase de ${nameOf(v)}` });
                          }}
                        >
                          <option value="">Por confirmar…</option>
                          <option value="none">Confirmar sin asistencia</option>
                          {pool
                            .filter((id) => id !== g.scorer)
                            .map((id) => (
                              <option key={id} value={id}>
                                Pase de {nameOf(id)}
                              </option>
                            ))}
                        </select>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!assist.length && gf > 0 && <p className="sc-tag sc-tag--hecho">Asistencias revisadas</p>}
            <div>
              <button type="button" className="vd-link ac-link" onClick={() => go(`${base}/acta`)}>
                Corregir en el acta
              </button>
            </div>
          </section>

          <section className="sc-sec ac-sec" aria-labelledby="ac-cron-t">
            <header className="sc-sec__h">
              <h2 className="sc-h3" id="ac-cron-t">
                La crónica
              </h2>
            </header>
            <p className="sc-k">
              Crónica · {s.j} · {day}
            </p>
            <p className="ac-cron__h">{headline}</p>
            <label className="sc-field">
              <span>Crónica</span>
              <textarea className="vd-input ac-cron__t" maxLength={10000} value={sheet.report} onChange={(e) => s.update((v) => ({ ...v, report: e.target.value.slice(0, 10000) }))} placeholder="Lo que pasó, contado para la afición" />
              <small>{sheet.report.length.toLocaleString("es-ES")} de 10.000 · se puede retocar antes de publicar</small>
            </label>
            <div className="sc-btnrow">
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={summary}>
                Preparar resumen con el acta
              </button>
            </div>
          </section>

          <section className="sc-sec ac-sec" aria-labelledby="ac-foto-t">
            <header className="sc-sec__h">
              <h2 className="sc-h3" id="ac-foto-t">
                Fotos
              </h2>
            </header>
            <label className="sc-field">
              <span>Foto del partido (HTTPS)</span>
              <input className="vd-input" type="url" maxLength={300} placeholder="https://…" value={sheet.photoUrl ?? ""} onChange={(e) => s.update((v) => ({ ...v, photoUrl: e.target.value.slice(0, 300) }))} />
              {photo && (okHttps(photo) ? <small className="is-ok">✓ Se ve bien</small> : <small className="is-bad">No es HTTPS</small>)}
            </label>
            <h3 className="ac-sub-h">Galería · {gallery.length} de 20</h3>
            {!gallery.length && <p className="ac-none">Sin fotos en la galería.</p>}
            {gallery.length > 0 && (
              <ul className="sc-rows">
                {gallery.map((u, i) => (
                  <li key={`${u}-${i}`} className="sc-row ac-gal">
                    <span className="sc-row__t">
                      <b className="ac-url">{u}</b>
                      <span>{okHttps(u) ? "HTTPS" : "No es HTTPS"}</span>
                    </span>
                    <button type="button" className="vd-ibtn vd-glass vd-press" onClick={() => dropGal(i)} aria-label={`Quitar la foto ${i + 1} de la galería`}>
                      <AcIcon name="trash" size={20} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form className="ac-inline" onSubmit={addGal}>
              <label className="sc-field">
                <span>Añadir foto a la galería (HTTPS)</span>
                <input className="vd-input" type="url" maxLength={300} placeholder="https://…" value={gal} onChange={(e) => setGal(e.target.value.slice(0, 300))} />
                {galBad && <small className="is-bad">Tiene que empezar por https://</small>}
              </label>
              <button type="submit" className="vd-btn vd-glass vd-press vd-btn--sm" aria-disabled={gallery.length >= 20 || undefined}>
                Añadir
              </button>
            </form>
          </section>
        </div>

        <div className="ac-pub__col">
          <section className="ac-sec ac-fan" aria-labelledby="ac-fan-t">
            <h2 className="sc-h3" id="ac-fan-t">
              Así lo verá la afición
            </h2>
            <div className="ac-fan__card sc-morph" style={{ viewTransitionName: `ac-pub-${s.match.id.replace(/[^a-zA-Z0-9_-]/g, "_")}` }}>
              <p className="sc-k">
                {s.published ? "Final" : "Final · así saldrá"} · {s.j} · {sheet.competition || "Liga"} · {day}
              </p>
              <p className="ac-fan__score" aria-label={`Manchester Piti ${gf}–${ga} ${rival} · ${letterWord(letter)}`}>
                <img className="ac-fan__crest" src="/crest-128.webp" alt="" width={48} height={48} />
                <span className="ac-fan__us">Manchester Piti</span>
                <b className="sc-score">
                  {gf}–{ga}
                </b>
                <span className="sc-rival">
                  <i aria-hidden="true">{rivalCode(rival, sheet.rivalShort)}</i>
                  {rival}
                </span>
                <span className={`sc-res sc-res--${letter}`} aria-hidden="true">
                  {letter}
                </span>
              </p>
              <p className="sc-small">
                {sheet.home ? "En casa" : "Fuera"}
                {sheet.venue ? ` · ${sheet.venue.split(" · ")[0]}` : ""}
              </p>
              {scorers.length > 0 && (
                <ul className="ac-fan__goals" aria-label="Goles del Piti">
                  {scorers.map((x, i) => (
                    <li key={`${x}-${i}`}>
                      <span className="ac-ball" aria-hidden="true" />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              )}
              {missing.length > 0 && <p className="ac-err">{missing.length === 1 ? "1 gol" : `${missing.length} goles`} sin goleador: no saldrá así</p>}
              <p className="ac-fan__mvp">
                <span className="ac-mvp" aria-hidden="true">
                  MVP
                </span>
                {s.published ? mvp.fan : `Vota al MVP hasta ${dayName(data.now + 48 * 3_600_000)}`}
              </p>
              <p className="sc-small">{s.published && s.match.notas ? "Las notas, ya en la web" : "Las notas, al publicar"}</p>
            </div>
          </section>

          <section className="sc-sec ac-sec" aria-labelledby="ac-pmin-t">
            <header className="sc-sec__h">
              <h2 className="sc-h3" id="ac-pmin-t">
                Minutos de la convocatoria y los cambios
              </h2>
            </header>
            {!played.length && <p className="ac-none">Salen de la convocatoria: hazla primero.</p>}
            {mins.errors[0] && <p className="ac-err">{mins.errors[0]}</p>}
            {played.length > 0 && (
              <ul className="ac-pmins">
                {played.map((x) => (
                  <li key={x.id} title={x.label} aria-label={x.label}>
                    <Shirt kit={sheet.kit} num={x.num} />
                    <span>{x.name}</span>
                    <b className="sc-num">{x.minutes}′</b>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="sc-sec ac-sec" aria-labelledby="ac-cartel-t">
            <header className="sc-sec__h">
              <h2 className="sc-h3" id="ac-cartel-t">
                El cartel
              </h2>
            </header>
            <div className="ac-fieldrow">
              <p className="ac-lbl" id="ac-cartel-l">
                Formato
              </p>
              <div className="vd-seg vd-glass ac-seg ac-seg--2" role="group" aria-labelledby="ac-cartel-l">
                <button type="button" className="vd-seg__b" aria-pressed={format === "square"} onClick={() => setFormat("square")}>
                  Cuadrado
                </button>
                <button type="button" className="vd-seg__b" aria-pressed={format === "story"} onClick={() => setFormat("story")}>
                  Historia 9:16
                </button>
              </div>
            </div>
            <div className="sc-btnrow">
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={poster}>
                <AcIcon name="download" size={17} />
                Descargar el cartel
              </button>
            </div>
          </section>
        </div>
      </div>

      <footer className="ac-foot sc-primary sc-primary--pin" role="status" aria-live="polite">
        <p className="ac-foot__s">
          <b className="ac-foot__line">{s.saveLine}</b>
          <span id="ac-pub-why">{priWhy}</span>
        </p>
        {s.dirty && !s.published && (
          <button type="button" className="vd-btn vd-glass vd-press" onClick={() => void s.saveDraft()} aria-disabled={!!s.busy || undefined}>
            {s.busy === "draft" ? "Guardando…" : "Guardar borrador"}
          </button>
        )}
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={pri} aria-disabled={priOff || !!s.busy || undefined} aria-describedby="ac-pub-why" aria-haspopup="dialog">
          {s.busy === "publish" ? (s.published ? "Guardando…" : "Publicando…") : s.published ? "Guardar cambios" : "Publicar el acta"}
        </button>
      </footer>

      <SalaSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={words.title}
        center
        footer={
          <>
            <button type="button" className="vd-btn vd-glass vd-press" onClick={() => setConfirm(false)}>
              Todavía no
            </button>
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={() => void doPublish()}>
              {s.published ? "Guardar los cambios" : "Publicar el acta"}
            </button>
          </>
        }
      >
        <p className="sc-small">{words.lede}</p>
        <ul className="ac-cons">
          {words.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </SalaSheet>
    </>
  );
}
