// ACTA · Después (/admin/partidos/<id>/despues), as its board (part-partido-despues.html, acta.js § después): what
// publishing the acta set going, in one place (H-MESA-05): the MVP with its turnout and its real close (B-PUB-01),
// «Cerrar ya» / «Reabrir 24 h» (M-11, setMvpVote); the frozen notas with each one's shirt and the system's traffic
// light, «Las notas no se pudieron calcular» and «Recalcular las notas» (M-42); the porra; the match's cost (→ la
// caja); the table of the jornada (→ el club); the notices that went out (pushSent); the turns; the logros (M-10);
// the video with a mark per goal (M-43, setVideoMarks) and the photos. Its foot: «Publicada · la web ya lo cuenta»,
// «Corregir el acta», «Ver en la web» and «Compartir el cartel». It replaces today's publish peak (the vitrina).
import { useCallback, useMemo, useState } from "react";
import type { DocumentData } from "firebase/firestore";
import { storedNotasOf } from "../../../../../functions/src/rating/frozen";
import { apiError, recalcMatchNotas, setMvpVote, setVideoMarks } from "../../../../lib/clubApi";
import type { ClubMatch } from "../../../../lib/clubData";
import { turnDone } from "../../../../lib/derived/rota";
import { matchLogros } from "../../../../lib/derived/vidrio/matchLogros";
import { plural } from "../../../../lib/derived/words";
import { pushSentSchema } from "../../../../lib/schemas";
import { shareClubPage } from "../../../../lib/share";
import { useStandings } from "../../../../lib/useStandings";
import { useMatchTurns } from "../../../../lib/useRotaTurns";
import { mvpWinners, type MvpResult } from "../../../../lib/vestuario";
import { useCaja, useMatchPredictions, useMatchPrivate, useMatchPushSent, useMvpResults } from "../../../vestuario/live";
import { VIcon } from "../../../../components/vidrio/VIcon";
import { clockTime, shortDate } from "../../data/adminLogic";
import { fromMatch, goalRows } from "../../acta/sheetModel";
import { namesFor } from "../../acta/roster";
import { usePartido } from "../../partido/partidoContext";
import { useAdmin } from "../../shell/context";
import { SalaLink } from "../../shell/SalaLink";
import { useSalaGo } from "../../shell/salaHref";
import { useStatus } from "../../shell/statusContext";
import { clockOf as clock, fanScorers, mvpView, notaRows, secondsOf } from "./actaModel";
import { ActaEmpty, ActaStillsFor, Shirt } from "./parts";
import "./acta.css";

const euros = (cents: number) => (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

export function DespuesScreen() {
  const { match, phase, base } = usePartido();
  const data = useAdmin();
  const go = useSalaGo();
  // (what the web says: the published acta, not a draft over it)
  const pub = data.published.find((p) => p.id === match.id && p.status === "finished");
  if (!pub)
    return (
      <section className="ac ac-desp" aria-label="Después del partido">
        <ActaEmpty
          title={phase === "final" || phase === "pendiente" ? "El acta aún no está publicada" : "Todavía no se ha jugado"}
          body="Cuando publiques el acta, aquí estarán el MVP con su votación, las notas congeladas, la porra, el coste del partido, la clasificación y los avisos que salieron."
        >
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={() => go(`${base}/${phase === "final" ? "publicar" : "acta"}`)}>
            {phase === "final" ? "Revisar y publicar" : "Ir al acta"}
          </button>
        </ActaEmpty>
      </section>
    );
  return <After pub={pub} />;
}

function After({ pub }: { pub: ClubMatch }) {
  const { match, base, j } = usePartido();
  const data = useAdmin();
  const status = useStatus();
  const go = useSalaGo();
  const mvpResults = useMvpResults();
  const priv = useMatchPrivate(match.id).data;
  const sheet = useMemo(() => fromMatch(pub), [pub]);
  const names = useMemo(() => namesFor(data.players, data.seasons, pub.seasonId), [data.players, data.seasons, pub.seasonId]);
  const nameOf = useCallback((id: string) => (id.startsWith("guest:") ? (pub.guests?.find((g) => `guest:${g.id}` === id)?.name ?? "Invitado") : names(id)), [pub.guests, names]);
  const numOf = (id: string) => {
    const p = data.roster.find((r) => r.id === id) ?? null;
    return p?.number != null ? String(p.number) : undefined;
  };
  const rival = pub.rival || "Rival";
  const scorers = fanScorers(sheet, nameOf);
  const [busy, setBusy] = useState<"close" | "reopen" | "notas" | "marks" | null>(null);

  // ── the MVP ──
  const result: MvpResult | undefined = mvpResults.get(match.id);
  const winners = mvpWinners(pub, result, data.now).map(nameOf);
  const mvp = mvpView({ voteClosesAt: pub.voteClosesAt, publishedAt: pub.actaPublishedAt ?? null, total: result?.total ?? 0, eligible: result?.eligible ?? null, winners, now: data.now });
  const moveMvp = async (action: "close" | "reopen") => {
    setBusy(action);
    try {
      const r = (await setMvpVote({ matchId: match.id, action })).data;
      status.show({ tag: "MVP", message: action === "close" ? "Votación cerrada ya · el MVP sale en unos minutos y avisamos al equipo" : `Votación reabierta · cierra el ${shortDate(r.voteClosesAt)} a las ${clockTime(r.voteClosesAt)}` });
    } catch (e) {
      status.show({ tone: "error", message: `No se ha podido ${action === "close" ? "cerrar" : "reabrir"} la votación: ${apiError(e)}`, retry: () => void moveMvp(action) });
    } finally {
      setBusy(null);
    }
  };

  // ── the notas ──
  const notas = notaRows(storedNotasOf(pub), nameOf);
  const notasFailed = !!priv.notasError || !notas.length;
  const recalc = async () => {
    setBusy("notas");
    try {
      const r = (await recalcMatchNotas({ matchId: match.id })).data;
      status.show({ tag: "Notas", message: `Notas recalculadas y congeladas de nuevo · ${plural(r.players, "jugador", "jugadores")}` });
    } catch (e) {
      status.show({ tone: "error", message: apiError(e), retry: () => void recalc() });
    } finally {
      setBusy(null);
    }
  };

  // ── the porra ──
  const preds = useMatchPredictions(match.id, true).data;
  const gf = pub.goalsFor ?? 0;
  const ga = pub.goalsAgainst ?? 0;
  const exact = preds.filter((p) => p.goalsFor === gf && p.goalsAgainst === ga);
  const sign = preds.filter((p) => Math.sign(p.goalsFor - p.goalsAgainst) === Math.sign(gf - ga));
  const word = gf > ga ? "la victoria" : gf === ga ? "el empate" : "la derrota";
  const porraLine = preds.length ? `${plural(preds.length, "porra", "porras")} · ${exact.length ? `${exact.length === 1 ? "1 clavó" : `${exact.length} clavaron`} el ${gf}–${ga} (${exact.map((p) => p.name).join(", ")})` : `nadie clavó el ${gf}–${ga}`} · ${sign.length} ${sign.length === 1 ? "acertó" : "acertaron"} ${word}` : "";

  // ── the cost, the table ──
  const caja = useCaja(pub.seasonId);
  const charges = caja.movs.filter((m) => !m.void && m.matchId === match.id && m.kind === "cargo");
  const cost = charges.reduce((a, m) => a + m.amount, 0);
  const { standings } = useStandings(pub.seasonId);
  const jn = data.matches.find((m) => m.id === match.id)?.jornada ?? null;
  const tableOk = !!standings && standings.jornada != null && jn != null && standings.jornada >= jn;
  const usPos = standings ? standings.rows.findIndex((r) => r.isUs) + 1 : 0;
  const usRow = standings?.rows.find((r) => r.isUs);

  // ── the notices that went out ──
  const sent = useMatchPushSent(match.id, true, (id: string, d: DocumentData) => pushSentSchema.safeParse({ ...d, id }).data ?? null).data.filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.at - a.at);

  // ── the turns, the logros ──
  const turns = useMatchTurns(pub, data.published, true);
  const uidOf = (playerId: string | null) => data.people.find((p) => p.playerId === playerId)?.uid;
  const logros = useMemo(() => matchLogros(pub, data.published, nameOf, { mvpResults, now: data.now }, 6), [pub, data.published, nameOf, mvpResults, data.now]);

  // ── the video and its marks (M-43) ──
  const goals = goalRows(sheet).filter((g) => g.kind === "og" || g.scorer);
  const [marks, setMarks] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(pub.videoMarks ?? {}).map(([k, v]) => [k, clock(v)])));
  const saveMarks = async () => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(marks)) {
      if (!v.trim()) continue;
      const sec = secondsOf(v);
      if (sec == null) return status.show({ tone: "error", message: `«${v}» no es un tiempo: escríbelo como 12:34` });
      out[k] = sec;
    }
    setBusy("marks");
    try {
      const r = (await setVideoMarks({ matchId: match.id, marks: out })).data;
      status.show({ tag: "Vídeo", message: `${plural(Object.keys(r.marks).length, "gol", "goles")} con su marca · la moviola salta a cada uno` });
    } catch (e) {
      status.show({ tone: "error", message: `No se han podido guardar las marcas: ${apiError(e)}` });
    } finally {
      setBusy(null);
    }
  };
  const photos = (pub.photoUrl ? 1 : 0) + (pub.gallery ?? []).length;

  const share = () =>
    shareClubPage("partido", match.id, `Manchester Piti ${gf}–${ga} ${rival}`)
      .then(() => status.show({ tag: "El cartel", message: typeof navigator !== "undefined" && "share" in navigator ? `Cartel ${j} listo · compártelo en el grupo` : `Enlace del cartel ${j} copiado · pégalo en el grupo` }))
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === "AbortError") return;
        status.show({ tone: "error", message: "No se ha podido compartir el cartel. Vuelve a intentarlo." });
      });

  return (
    <ActaStillsFor kit={pub.kit} players={data.roster}>
      <section className="ac ac-desp" aria-label="Después del partido">
        <header className="ac-dh sc-morph" style={{ viewTransitionName: `ac-pub-${match.id.replace(/[^a-zA-Z0-9_-]/g, "_")}` }}>
          <div className="ac-dh__r">
            {scorers.length ? (
              <ul className="ac-fan__goals" aria-label="Goles del Piti">
                {scorers.map((x, i) => (
                  <li key={`${x}-${i}`}>
                    <span className="ac-ball" aria-hidden="true" />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sc-small">Sin goles del Piti</p>
            )}
            <span className="sc-tag sc-tag--hecho">Publicada</span>
          </div>
        </header>

        <div className="ac-despgrid">
          <div className="ac-desp__col">
            <section className="sc-sec ac-sec ac-mvpsec" aria-labelledby="ac-mvp-t">
              <header className="sc-sec__h">
                <h2 className="sc-h2" id="ac-mvp-t">
                  El MVP
                </h2>
                <span className="sc-tag sc-tag--quiet">{mvp.tag}</span>
              </header>
              {!mvp.has ? (
                <p className="ac-none">Este partido no tiene votación del MVP.</p>
              ) : (
                <>
                  <p className="ac-mvp__part">
                    <b className="sc-num">{mvp.part}</b>
                  </p>
                  <div className="ac-meter" role="img" aria-label={`Participación: ${mvp.part} (${mvp.pct} %)`}>
                    <i style={{ width: `${mvp.pct}%` }} />
                  </div>
                  <p className="sc-p">{mvp.close}</p>
                  {mvp.winner && (
                    <p className="ac-mvp__win">
                      <span className="ac-mvp" aria-hidden="true">
                        MVP
                      </span>
                      {mvp.winner}
                    </p>
                  )}
                  <div className="sc-btnrow ac-prop">
                    {mvp.open && (
                      <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => void moveMvp("close")} aria-disabled={!!busy || undefined}>
                        {busy === "close" ? "Cerrando…" : "Cerrar ya"}
                      </button>
                    )}
                    {mvp.canReopen && (
                      <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => void moveMvp("reopen")} aria-disabled={!!busy || undefined}>
                        {busy === "reopen" ? "Reabriendo…" : "Reabrir 24 h"}
                      </button>
                    )}
                    <p className="sc-small">{mvp.open ? "Cierra sola a su hora; «Cerrar ya» la cierra ahora y sale el MVP." : mvp.canReopen ? "«Reabrir 24 h» da un día más a quien no votó." : "Pasaron los 7 días del partido: ya no se reabre."}</p>
                  </div>
                </>
              )}
            </section>

            <section className="sc-sec ac-sec" aria-labelledby="ac-notas-t">
              <header className="sc-sec__h">
                <h2 className="sc-h2" id="ac-notas-t">
                  Las notas
                </h2>
              </header>
              {notas.length > 0 && (
                <>
                  <p className="sc-small">
                    Calculadas al publicar (valoración Piti) · {plural(notas.length, "jugador", "jugadores")} · mejor {notas[0].name} {notas[0].text}
                  </p>
                  <ol className="sc-rows ac-notas">
                    {notas.map((n) => (
                      <li key={n.id} className="sc-row ac-nota" aria-label={n.label}>
                        <Shirt kit={pub.kit} num={numOf(n.id)} />
                        <span className="sc-row__t">
                          <b>{n.name}</b>
                          <span>{n.word}</span>
                        </span>
                        <b className={`nb nb--lg nb--${n.band}`}>{n.text}</b>
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {notasFailed && (
                <p className="ac-check is-mal">
                  <span className="ac-check__i" aria-hidden="true">
                    !
                  </span>
                  <span className="ac-check__t">
                    <b>{priv.notasError ? "Las notas no se pudieron calcular al publicar" : "Sin notas guardadas para este partido"}</b>
                    <span>{priv.notasError ? `${priv.notasError.message} · ` : ""}La web enseña el partido sin notas y no sale «Ya están las notas».</span>
                  </span>
                </p>
              )}
              <div className="sc-btnrow ac-prop">
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => void recalc()} aria-disabled={!!busy || undefined}>
                  {busy === "notas" ? "Recalculando…" : "Recalcular las notas"}
                </button>
                {!notasFailed && <p className="sc-small">Con la temporada hasta ese día y el mismo rival: no cambian si nada cambió.</p>}
              </div>
            </section>
          </div>

          <div className="ac-desp__col">
            <section className="sc-sec ac-sec" aria-labelledby="ac-rest-t">
              <h2 className="vd-vh" id="ac-rest-t">
                Lo que queda después del partido
              </h2>
              <ul className="sc-rows ac-after">
                <li className="sc-row">
                  <span className="sc-row__t">
                    <b>La porra</b>
                    <span>{preds.length ? porraLine : "Nadie hizo porra de este partido."}</span>
                  </span>
                  {preds.length > 0 && <span className="sc-tag sc-tag--quiet">Recalculada</span>}
                </li>
                <li className="sc-row">
                  <span className="sc-row__t">
                    <b>El coste del partido · {charges.length ? `Repartido · ${euros(cost)}` : "Sin coste apuntado"}</b>
                    <span>{charges.length ? `${plural(charges.length, "cargo", "cargos")} en la caja` : "Campo y árbitro, a partes iguales entre los que jugaron"}</span>
                  </span>
                  <SalaLink className="vd-btn vd-glass vd-press vd-btn--sm" to={`/admin/caja/coste/${match.id}`}>
                    {charges.length ? "Ver en la caja" : "Repartir el coste"}
                  </SalaLink>
                </li>
                <li className="sc-row">
                  <span className="sc-row__t">
                    <b>La clasificación · {standings ? (tableOk ? `Al día · el Piti va ${usPos}º con ${usRow?.pts ?? 0} puntos` : `Falta la tabla de la ${j}`) : "Sin clasificación"}</b>
                    <span>{standings ? (tableOk ? `${standings.competition} · tras la J${standings.jornada}` : `La web dice «sin tabla de la ${j}» hasta que la pegues`) : "La liga no tiene tabla pegada todavía"}</span>
                  </span>
                  <SalaLink className="vd-btn vd-glass vd-press vd-btn--sm" to="/admin/club/clasificacion">
                    {tableOk ? "Ver la tabla" : "Pegar la tabla"}
                  </SalaLink>
                </li>
              </ul>
            </section>

            <section className="sc-sec ac-sec" aria-labelledby="ac-push-t">
              <header className="sc-sec__h">
                <h2 className="sc-h3" id="ac-push-t">
                  Los avisos que salieron
                </h2>
              </header>
              {!sent.length && <p className="ac-none">No salió ningún aviso de este partido.</p>}
              {sent.length > 0 && (
                <ul className="sc-rows">
                  {sent.map((p) => (
                    <li key={p.id} className="sc-row">
                      <span className="sc-row__t">
                        <b>«{p.title}»</b>
                        <span>
                          A {plural(p.devices, "móvil", "móviles")} · {shortDate(p.at)} · {clockTime(p.at)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="sc-sec ac-sec" aria-labelledby="ac-turn-t">
              <header className="sc-sec__h">
                <h2 className="sc-h3" id="ac-turn-t">
                  Los turnos
                </h2>
              </header>
              {!turns.turns.length && <p className="ac-none">Ningún turno en este partido.</p>}
              {turns.turns.length > 0 && (
                <ul className="sc-rows">
                  {turns.turns.map((t) => {
                    const who = t.playerId ? nameOf(t.playerId) : "nadie";
                    const done = turnDone(turns.pins, uidOf(t.playerId));
                    return (
                      <li key={t.job.id} className="sc-row">
                        <span className="sc-row__t">
                          <b>{t.job.name}</b>
                          <span>
                            {done ? "Hecho" : "Le tocaba"}: {who}
                          </span>
                        </span>
                        {done ? <span className="sc-tag sc-tag--hecho">Hecho</span> : <span className="sc-tag sc-tag--quiet">Sin marcar</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
              <SalaLink className="vd-link ac-link" to="/admin/club/turnos">
                Cambiar los turnos
              </SalaLink>
            </section>

            <section className="sc-sec ac-sec" aria-labelledby="ac-logro-t">
              <header className="sc-sec__h">
                <h2 className="sc-h3" id="ac-logro-t">
                  Los logros del partido
                </h2>
              </header>
              {!logros.length && <p className="ac-none">Sin logros nuevos en este partido.</p>}
              {logros.length > 0 && (
                <ul className="sc-rows">
                  {logros.map((l) => (
                    <li key={l.id} className="sc-row">
                      <span className="sc-row__t">
                        <b>{l.text}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="sc-sec ac-sec" aria-labelledby="ac-vid-t">
              <header className="sc-sec__h">
                <h2 className="sc-h3" id="ac-vid-t">
                  Vídeo y fotos
                </h2>
              </header>
              <ul className="sc-rows">
                <li className="sc-row">
                  <span className="sc-row__t">
                    <b>El vídeo</b>
                    {pub.videoUrl ? <span className="ac-url">{pub.videoUrl}</span> : <span>Sin vídeo: pega el enlace de YouTube en los datos del partido.</span>}
                  </span>
                  {pub.videoUrl ? (
                    <a className="vd-btn vd-glass vd-press vd-btn--sm" href={pub.videoUrl} target="_blank" rel="noopener noreferrer">
                      Verlo<span className="vd-vh"> (se abre en otra pestaña)</span>
                    </a>
                  ) : (
                    <SalaLink className="vd-btn vd-glass vd-press vd-btn--sm" to={`${base}/datos`}>
                      Poner el vídeo
                    </SalaLink>
                  )}
                </li>
                <li className="sc-row">
                  <span className="sc-row__t">
                    <b>Las fotos</b>
                    <span>{plural(photos, "foto", "fotos")} en la web</span>
                  </span>
                  <SalaLink className="vd-btn vd-glass vd-press vd-btn--sm" to={`${base}/publicar`}>
                    Cambiar las fotos
                  </SalaLink>
                </li>
              </ul>
              {pub.videoUrl && goals.length > 0 && (
                <div className="ac-marks">
                  <h3 className="ac-sub-h">Dónde empieza cada gol en el vídeo</h3>
                  <p className="sc-small">La moviola de la web salta a cada uno. Escribe el tiempo del vídeo, como 12:34.</p>
                  <ul className="sc-rows">
                    {goals.map((g) => (
                      <li key={g.id} className="sc-row ac-mark">
                        <span className="sc-row__t">
                          <b>
                            Gol {g.n} · {g.kind === "og" ? `autogol de ${rival}` : nameOf(g.scorer ?? "")}
                          </b>
                          <span>{g.minute != null ? `Minuto ${g.minute}′ del partido` : "Sin minuto"}</span>
                        </span>
                        <label className="ac-mark__in">
                          <span className="vd-vh">Tiempo del vídeo del gol {g.n}</span>
                          <input className="vd-input" type="text" inputMode="numeric" maxLength={8} placeholder="mm:ss" value={marks[g.id] ?? ""} onChange={(e) => setMarks((m) => ({ ...m, [g.id]: e.target.value.replace(/[^0-9:]/g, "") }))} />
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div className="sc-btnrow">
                    <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => void saveMarks()} aria-disabled={!!busy || undefined}>
                      {busy === "marks" ? "Guardando…" : "Guardar las marcas"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        <footer className="ac-foot sc-primary sc-primary--pin">
          <p className="ac-foot__s">
            <b className="ac-foot__line">Publicada · la web ya lo cuenta</b>
            <button type="button" className="vd-link ac-link" onClick={() => go(`${base}/acta`)}>
              Corregir el acta
            </button>
          </p>
          <a className="vd-btn vd-glass vd-press" href={`/partidos/${match.id}`} target="_blank" rel="noopener">
            Ver en la web
            <VIcon name="expand" size={17} />
            <span className="vd-vh"> (se abre en otra pestaña)</span>
          </a>
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={() => void share()}>
            <VIcon name="share" size={17} />
            Compartir el cartel
          </button>
        </footer>
      </section>
    </ActaStillsFor>
  );
}
