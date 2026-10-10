// The match workspace, as on the canvas (stats-gen/ad-v2-full.mjs `detail`, shots-adv2f/partidos-acta.png,
// partidos-encuentro.png, m-acta.png): the header merged with the tabs (kicker + «PITI 3–1 FUSION 7 [V]» |
// Encuentro · Convocatoria · Acta · Publicar with ✓ / !; on phones ← back and the tabs under the title),
// the scrolling body and the fixed footer — the state with its concrete reason («No cuadra: falta el
// goleador de 1 gol»), «Guardado 12:04 · hora de Madrid» / «● Cambios sin guardar» and the buttons of the
// moment: Guardar (a match to play, in the calendar) · Guardar borrador + Publicar en el calendario (only a
// draft) · Abrir En juego · Guardar borrador + Publicar acta (pressing it when it doesn't square shakes the
// reason and says why) · Guardar cambios (published). Saves through saveMatchSheet; the first publication
// of an acta opens the publish peak (onPublished). Guards unsaved changes, mirrors them on this device
// (recovery) and registers its palette actions.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { apiError, saveMatchSheet } from "../../../lib/clubApi";
import { downloadMatchPoster } from "../../../lib/matchPoster";
import { mvpWinners } from "../../../lib/vestuario";
import { clockTime, jLabel, shortDate, type AdminMatch } from "../data/adminLogic";
import type { AdminData } from "../data/useAdminData";
import { useWhistled } from "../data/whistleStore";
import { ResultMark, resultLetter } from "../kit";
import { useRegisterCommands } from "../palette/registry";
import type { PaletteCommand } from "../palette/search";
import { useAdminGo } from "../shell/context";
import { MATCH_TABS, type MatchTab } from "../shell/nav";
import { useFrame } from "../ui/frame";
import { useUnsavedGuard } from "../ui/guard";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";
import { instant } from "../acta/dates";
import { mvpStatus } from "../acta/publish";
import { reviewMatch } from "../acta/review";
import { namesFor, rosterFor } from "../acta/roster";
import { fromMatch, isSheet, restoreSheet, rivalInitialsOf, score, toPayload, type MatchSheet } from "../acta/sheetModel";
import { useMatchMvp } from "./live";
import { TabActa, type PlayerInfo } from "./TabActa";
import { TabConvocatoria } from "./TabConvocatoria";
import { TabEncuentro } from "./TabEncuentro";
import { TabPublicar } from "./TabPublicar";
import { useEditBuffer } from "./useEditBuffer";
import { blockedWhy, closesWords, effectiveSheet, footerOf, kickerOf, phaseOf, savedLine, tabMarks, tidyVenue, voteCloses } from "./workspaceModel";

export interface MatchEditorProps {
  match: AdminMatch;
  data: AdminData;
  /** The private meeting note (matchPrivate), loaded. */
  note: string;
  tab: MatchTab;
  onTab: (tab: MatchTab) => void;
  onBack: () => void;
  /** «Borrar partido» confirmed (the view hides it and deletes it behind «Deshacer»). */
  onDelete: (match: AdminMatch) => void;
  /** The acta was published for the first time: the publish peak. */
  onPublished: () => void;
}

const TAB_LABEL: Record<MatchTab, [string, string]> = { encuentro: ["Encuentro", "Encuentro"], convocatoria: ["Convocatoria", "Convoc."], acta: ["Acta", "Acta"], publicar: ["Publicar", "Publicar"] };

export function MatchEditor({ match, data, note, tab, onTab, onBack, onDelete, onPublished }: MatchEditorProps) {
  const toast = useToast();
  const go = useAdminGo();
  const { desktop } = useFrame();
  const whistled = useWhistled();
  const server = useMemo(() => fromMatch(match, note), [match, note]);
  const buf = useEditBuffer(server, "acta", match.id, isSheet, restoreSheet);
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [shake, setShake] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  const phase = phaseOf(match, data.now, whistled.has(match.id));
  // One convocatoria (Convocar writes it): the match's own — unless the season was changed here, which empties it.
  const { starters, bench, notCalled } = match;
  const sheet: MatchSheet = useMemo(() => {
    const v = buf.value;
    const lineup = v.seasonId === (match.seasonId ?? "") ? { starters: starters ?? [], bench: bench ?? [], notCalled: notCalled ?? [] } : { starters: v.starters, bench: v.bench, notCalled: v.notCalled };
    return effectiveSheet({ ...v, ...lineup }, phase);
  }, [buf.value, match.seasonId, starters, bench, notCalled, phase]);

  const roster = useMemo(() => rosterFor(data.players, data.seasons, sheet.seasonId), [data.players, data.seasons, sheet.seasonId]);
  const names = useMemo(() => namesFor(data.players, data.seasons, sheet.seasonId), [data.players, data.seasons, sheet.seasonId]);
  const nameOf = (id: string) => names(id);
  const info = (id: string): PlayerInfo & { position: string } => {
    const r = roster.find((p) => p.id === id);
    return r ? { name: r.name, number: r.number, position: r.position } : { name: names(id), number: null, position: "" };
  };
  const update = (f: (s: MatchSheet) => MatchSheet) => buf.set(f);

  const j = jLabel(match);
  const rival = sheet.rival.trim() || "Rival";
  const { gf, ga } = score(sheet);
  const publishedFinal = match.published && !match.draft && match.status === "finished";
  const publishedClean = match.published && !match.draft && !buf.dirty;
  const review = reviewMatch(
    sheet,
    roster.map((p) => p.id),
    data.now,
    publishedClean,
    names,
  );
  const foot = footerOf({ phase, inCalendar: match.published, draft: match.draft, status: match.status ?? "scheduled", date: sheet.date, review });
  const marks = tabMarks({ phase, review, starters: sheet.starters.length, published: publishedFinal && !buf.dirty });

  // ── the MVP (status only) ──
  const mvpResult = useMatchMvp(match.id);
  const closes = voteCloses(match.voteClosesAt, data.now);
  const hasVote = Number.isFinite(dateMillis(match.voteClosesAt));
  const winIds = mvpWinners(match, mvpResult, data.now);
  const closedText = mvpStatus({ finished: true, published: true, voteClosesAt: hasVote ? closes : null, winners: winIds.map(nameOf), votes: winIds.length && mvpResult ? (mvpResult.counts[winIds[0]] ?? 0) : 0, total: mvpResult?.total ?? 0 }, data.now);
  const mvp = !publishedFinal
    ? { title: "MVP: se abre solo al publicar", detail: "Votan los socios 48 h · no se toca a mano" }
    : closes > data.now
      ? { title: "MVP abierto · cierra en 48 h", detail: `Votan los socios hasta ${closesWords(closes)}` }
      : { title: "MVP cerrado", detail: closedText.charAt(0).toUpperCase() + closedText.slice(1) };

  // ── saving ──
  const write = async (draft: boolean, fromGuard = false): Promise<boolean> => {
    const p = toPayload({ ...sheet, venue: tidyVenue(sheet.venue) }, draft, names, rival);
    if (!p.ok) {
      toast.show({ tone: "error", message: `${draft ? "No se puede guardar el borrador" : "No se puede publicar"}: ${p.error}` });
      return false;
    }
    setBusy(draft ? "draft" : "publish");
    try {
      await saveMatchSheet({ id: match.id, sheet: p.sheet, draft });
      const saved = draft ? buf.value : { ...buf.value, revision: (buf.value.revision ?? 0) + 1 };
      if (!draft) buf.set((v) => ({ ...v, revision: saved.revision }));
      buf.commit(saved);
      setSavedAt(instant());
      return true;
    } catch (e) {
      const why = apiError(e);
      toast.show({
        tone: "error",
        message: `${draft ? "No se ha podido guardar el borrador" : "No se ha podido publicar"}: ${why}${fromGuard ? " Los cambios siguen en este dispositivo: al volver podrás recuperarlos." : ""}`,
        retry: fromGuard ? undefined : () => void write(draft),
      });
      return false;
    } finally {
      setBusy(null);
    }
  };
  const noChanges = () => toast.show({ tag: j, message: "No hay cambios que guardar" });
  const blocked = () => {
    setShake((n) => n + 1);
    toast.show({ tag: "!", message: blockedWhy(review) });
  };
  const saveDraft = () => {
    if (busy) return;
    if (!buf.dirty) return noChanges();
    void write(true).then((ok) => ok && toast.show({ tag: j, message: "Borrador guardado · solo lo ven los capitanes" }));
  };
  const publishActa = () => {
    if (busy) return;
    if (!review.cuadra) return blocked();
    void write(false).then((ok) => {
      if (!ok) return;
      if (hasVote) toast.show({ tag: j, message: `Acta ${j} corregida · web al día` });
      else onPublished();
    });
  };
  const saveChanges = () => {
    if (busy) return;
    if (!buf.dirty) return noChanges();
    if (!review.cuadra) return blocked();
    void write(false).then((ok) => ok && toast.show({ tag: j, message: `Acta ${j} corregida · web al día` }));
  };
  const saveCalendar = (first: boolean) => {
    if (busy) return;
    if (!first && !buf.dirty) return noChanges();
    if (!review.cuadra) return blocked();
    void write(false).then((ok) => ok && toast.show({ tag: j, message: first ? `${j} · ${rival} publicado · ya sale en el calendario` : `${j} guardado · el calendario ya lo tiene` }));
  };
  const openLive = () => go({ section: "enjuego", matchId: match.id });

  useUnsavedGuard(buf.dirty, {
    what: phase === "jugado" ? `el acta de la ${j}` : `la ${j}`,
    alt: {
      label: "Guardar borrador y salir",
      run: async () => {
        const ok = await write(true, true);
        if (!ok) buf.keepMirror();
      },
    },
    // Tabs, the vitrina and «Nuevo partido» stay on this match: only leaving it is guarded.
    shouldBlock: ({ current, next }) => next.pathname !== current.pathname && !next.pathname.replace(/\/+$/, "").endsWith(`/partidos/${match.id}`),
  });

  // ── palette ──
  const handlers = useRef({ saveDraft, publishActa });
  useEffect(() => {
    handlers.current = { saveDraft, publishActa };
  });
  const commands: PaletteCommand[] =
    foot.mode === "acta"
      ? [
          { id: `acta:guardar:${match.id}`, group: "Acciones", icon: "↓", title: `Guardar borrador de la ${j}`, description: buf.dirty ? "Cambios sin guardar" : "Sin cambios", hint: "acción", keywords: "guardar borrador acta", run: () => handlers.current.saveDraft() },
          { id: `acta:publicar:${match.id}`, group: "Acciones", icon: "✓", title: `Publicar el acta de la ${j}`, description: foot.why, hint: "acción", keywords: "publicar acta", run: () => handlers.current.publishActa() },
        ]
      : [];
  useRegisterCommands(commands);

  // ── tabs (arrows move between them) ──
  const tabId = (k: MatchTab) => `ad-tab-${match.id}-${k}`;
  const onTabsKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = MATCH_TABS.indexOf(tab);
    const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? MATCH_TABS.length - 1 : -2;
    if (n === -2) return;
    e.preventDefault();
    const next = MATCH_TABS[(n + MATCH_TABS.length) % MATCH_TABS.length];
    onTab(next);
    requestAnimationFrame(() => tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus({ preventScroll: true }));
  };

  const scored = phase === "jugado" || phase === "juego";
  const cvMode = match.status === "cancelled" ? "cancelado" : phase === "antes" || phase === "off" ? "cambiar" : phase === "jugado" && !publishedFinal && sheet.starters.length < 7 ? "completar" : "cerrada";
  const draftAt = savedAt ?? (match.draft ? (match.draftSavedAt ?? null) : null);
  const sameDay = (a: number) => shortDate(a) === shortDate(data.now);

  return (
    <section className="det" aria-label={`Partido ${j}`}>
      <div className="dh">
        {!desktop && (
          <button type="button" className="ib2" onClick={onBack} aria-label="Volver a la lista">
            <AdIcon name="back" size={20} />
          </button>
        )}
        <div className="tt">
          <small>{kickerOf(j, sheet)}</small>
          <b role="heading" aria-level={2}>
            {scored ? (
              <>
                PITI <span className="sc">{`${gf}–${ga}`}</span> {rival} <ResultMark r={resultLetter(gf, ga)} />
              </>
            ) : (
              <>PITI – {rival}</>
            )}
          </b>
        </div>
        <div className="tabs4" role="tablist" aria-label="Partido" ref={tabsRef} onKeyDown={onTabsKey}>
          {MATCH_TABS.map((k) => {
            const on = tab === k;
            return (
              <button key={k} type="button" role="tab" id={tabId(k)} data-tab={k} aria-selected={on} aria-controls={`${tabId(k)}-p`} tabIndex={on ? 0 : -1} onClick={() => onTab(k)}>
                {TAB_LABEL[k][desktop ? 0 : 1]}
                {marks[k] === "ok" ? (
                  <>
                    <span className="tk ok" aria-hidden="true">
                      ✓
                    </span>
                    <span className="sr"> · hecho</span>
                  </>
                ) : marks[k] === "wn" ? (
                  <>
                    <span className="tk wn" aria-hidden="true">
                      !
                    </span>
                    <span className="sr"> · pendiente</span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="db" role="tabpanel" id={`${tabId(tab)}-p`} aria-labelledby={tabId(tab)}>
        {buf.offer && !buf.dirty && (
          <div className="rec2" role="status">
            <AdIcon name="undo" size={18} />
            <span>
              <b>Hay cambios sin guardar en este dispositivo</b>
              <small>
                De las {clockTime(buf.offer.at)}
                {sameDay(buf.offer.at) ? "" : ` del ${shortDate(buf.offer.at)}`}.
              </small>
            </span>
            <button type="button" className="btn sm sky" onClick={buf.recover}>
              Recuperar cambios sin guardar de {clockTime(buf.offer.at)}
            </button>
            <button type="button" className="btn sm line" onClick={buf.dismissOffer}>
              Descartar
            </button>
          </div>
        )}
        {tab === "encuentro" && (
          <TabEncuentro
            sheet={sheet}
            update={update}
            seasons={data.seasons}
            phase={phase}
            label={`${j} · ${rival}`}
            onDelete={() => {
              buf.reset();
              // (after the reset has rendered, so leaving isn't asked as «sin guardar»)
              setTimeout(() => onDelete(match), 0);
            }}
          />
        )}
        {tab === "convocatoria" && <TabConvocatoria starters={sheet.starters} bench={sheet.bench} info={info} mode={cvMode} onConvocar={() => go({ section: "convocar", matchId: match.id })} />}
        {tab === "acta" && <TabActa phase={phase} sheet={sheet} update={update} review={review} rival={rival} j={j} info={info} onOpenLive={openLive} onGoConvocar={() => go({ section: "convocar", matchId: match.id })} />}
        {tab === "publicar" && (
          <TabPublicar
            phase={phase}
            sheet={sheet}
            update={update}
            j={j}
            rival={rival}
            gf={gf}
            ga={ga}
            nameOf={nameOf}
            mvp={mvp}
            onPoster={() =>
              void downloadMatchPoster({ ...sheet, id: match.id, goalsFor: gf, goalsAgainst: ga, rivalInitials: rivalInitialsOf(sheet) }, "square").catch(() => toast.show({ tone: "error", message: "No se ha podido generar el cartel." }))
            }
          />
        )}
      </div>
      <div className="df">
        <div key={shake} className={`st${shake ? " shake" : ""}`} aria-live="polite">
          <span className={foot.tone === "ok" ? "okk" : foot.tone === "warn" ? "warn" : "neu"}>
            <AdIcon name={foot.tone === "ok" ? "check" : foot.tone === "warn" ? "alert" : "cal"} size={16} />
            {foot.why}
          </span>
          <small>{savedLine({ dirty: buf.dirty, savedAt: draftAt, published: match.published, now: data.now })}</small>
        </div>
        {foot.mode === "acta" && (
          <>
            <button type="button" className="btn line" onClick={saveDraft} aria-disabled={!!busy}>
              {busy === "draft" ? "Guardando…" : "Guardar borrador"}
            </button>
            <button type="button" className={`btn gold${review.cuadra ? "" : " off"}`} onClick={publishActa} aria-disabled={!review.cuadra || !!busy}>
              {busy === "publish" ? "Publicando…" : "Publicar acta"}
            </button>
          </>
        )}
        {foot.mode === "publicada" && (
          <button type="button" className="btn line" onClick={saveChanges} aria-disabled={!buf.dirty || !!busy}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        )}
        {foot.mode === "calendario" && (
          <button type="button" className="btn line" onClick={() => saveCalendar(false)} aria-disabled={!buf.dirty || !!busy}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        )}
        {foot.mode === "borrador" && (
          <>
            <button type="button" className="btn line" onClick={saveDraft} aria-disabled={!!busy}>
              {busy === "draft" ? "Guardando…" : "Guardar borrador"}
            </button>
            <button type="button" className="btn gold" onClick={() => saveCalendar(true)} aria-disabled={!!busy}>
              {busy === "publish" ? "Publicando…" : "Publicar en el calendario"}
            </button>
          </>
        )}
        {foot.mode === "juego" && (
          <button type="button" className="btn gold" onClick={openLive}>
            <AdIcon name="ball" size={18} />
            Abrir En juego
          </button>
        )}
      </div>
    </section>
  );
}
