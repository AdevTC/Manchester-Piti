// The match detail as an editor (`.cd.dp`): header (kicker, «PITI 3–1 FUSION 7», state chip, «Guardado
// 12:04 · hora de Madrid» / «● Cambios sin guardar»), the tabs Encuentro · Convocatoria · Acta · Publicar
// (each with ✓ / ! / its number; Datos · Convoc. · Acta · Publicar on phones), the scrolling body and the
// fixed footer (state + reason + «Guardar borrador» + «Publicar acta»; pressing Publicar when it doesn't
// square shakes the reason). Saves through saveMatchSheet (draft / publish) like the old MatchEditor;
// guards unsaved changes; mirrors them to this device (recovery); registers its palette actions.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { apiError, saveMatchSheet } from "../../../lib/clubApi";
import { downloadMatchPoster } from "../../../lib/matchPoster";
import { mvpWinners } from "../../../lib/vestuario";
import { clockTime, jLabel, reviewActa, shortDate, type AdminMatch } from "../data/adminLogic";
import type { AdminData } from "../data/useAdminData";
import { useRegisterCommands } from "../palette/registry";
import type { PaletteCommand } from "../palette/search";
import { MATCH_TABS, type MatchTab } from "../shell/nav";
import { Chip, type ChipTone } from "../ui/controls";
import { AdIcon } from "../ui/icons";
import { ConfirmModal } from "../ui/layers";
import { useUnsavedGuard } from "../ui/guard";
import { useToast } from "../ui/toastContext";
import { previousLineup } from "../acta/convocatoria";
import { instant } from "../acta/dates";
import { publishConsequences, mvpStatus, scorerChips } from "../acta/publish";
import { reviewMatch } from "../acta/review";
import { namesFor, rosterFor } from "../acta/roster";
import { fromMatch, isSheet, restoreSheet, reviewSheet, rivalInitialsOf, score, toPayload, type MatchSheet } from "../acta/sheetModel";
import { DeleteMatchModal } from "./DeleteMatchModal";
import { useMatchMvp } from "./live";
import { TabActa, type PlayerInfo } from "./TabActa";
import { TabConvocatoria } from "./TabConvocatoria";
import { TabEncuentro } from "./TabEncuentro";
import { TabPublicar } from "./TabPublicar";
import { useEditBuffer } from "./useEditBuffer";

export interface MatchEditorProps {
  match: AdminMatch;
  data: AdminData;
  /** The private meeting note (matchPrivate), loaded. */
  note: string;
  tab: MatchTab;
  onTab: (tab: MatchTab) => void;
  onBack: () => void;
  onDeleted: () => void;
}

const where = (home: boolean) => (home ? "en casa" : "fuera");

export function MatchEditor({ match, data, note, tab, onTab, onBack, onDeleted }: MatchEditorProps) {
  const toast = useToast();
  const server = useMemo(() => fromMatch(match, note), [match, note]);
  const buf = useEditBuffer(server, "acta", match.id, isSheet, restoreSheet);
  const sheet = buf.value;
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [shake, setShake] = useState(0);
  const [pubOpen, setPubOpen] = useState(false);
  const [pubError, setPubError] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const roster = useMemo(() => rosterFor(data.players, data.seasons, sheet.seasonId), [data.players, data.seasons, sheet.seasonId]);
  const nameOf = useMemo(() => namesFor(data.players, data.seasons, sheet.seasonId), [data.players, data.seasons, sheet.seasonId]);
  const info = (id: string): PlayerInfo => {
    const r = roster.find((p) => p.id === id);
    return r ? { name: r.name, number: r.number, position: r.position } : { name: nameOf(id), number: null, position: "" };
  };
  const update = (f: (s: MatchSheet) => MatchSheet) => buf.set(f);

  const rival = sheet.rival.trim() || "Rival";
  const j = jLabel(match);
  const label = `${j} · ${rival}`;
  const { gf, ga } = score(sheet);
  const ids = roster.map((p) => p.id);
  const played = reviewActa(reviewSheet(sheet), ids, data.now, false).finished;
  // Published, clean, and the web already has what this match needs (its acta, once played).
  const publishedClean = match.published && !match.draft && !buf.dirty && (!played || match.status === "finished");
  const review = reviewMatch(sheet, ids, data.now, publishedClean, nameOf);
  const finished = review.finished;
  const voteClosesAt = Number.isFinite(dateMillis(match.voteClosesAt)) ? dateMillis(match.voteClosesAt) : null;
  const mvpResult = useMatchMvp(match.id);
  const winners = mvpWinners(match, mvpResult, data.now);
  const mvp = mvpStatus(
    { finished, published: publishedClean, voteClosesAt, winners: winners.map((id) => nameOf(id)), votes: winners.length && mvpResult ? (mvpResult.counts[winners[0]] ?? 0) : 0, total: mvpResult?.total ?? 0 },
    data.now,
  );

  // ── saving ──
  const save = async (draft: boolean, fromGuard = false): Promise<boolean> => {
    const p = toPayload(sheet, draft, nameOf, rival);
    if (!p.ok) {
      if (draft || !pubOpen) toast.show({ tone: "error", message: `${draft ? "No se puede guardar el borrador" : "No se puede publicar"}: ${p.error}` });
      else setPubError(p.error);
      return false;
    }
    setBusy(draft ? "draft" : "publish");
    try {
      await saveMatchSheet({ id: match.id, sheet: p.sheet, draft });
      const saved = draft ? sheet : { ...sheet, revision: (sheet.revision ?? 0) + 1 };
      if (!draft) buf.set((v) => ({ ...v, revision: saved.revision }));
      buf.commit(saved);
      setSavedAt(instant());
      if (draft) toast.show({ message: "Borrador guardado · solo lo ven los capitanes." });
      else if (!finished) toast.show({ message: `${label} publicado · ya sale en el calendario.` });
      else toast.show({ message: voteClosesAt ? `Acta ${j} corregida · web al día.` : `Acta ${j} publicada · web al día · MVP abierto 48 h.` });
      return true;
    } catch (e) {
      const why = apiError(e);
      if (draft) toast.show({ tone: "error", message: `No se ha podido guardar el borrador: ${why}${fromGuard ? " Los cambios siguen en este dispositivo: al volver podrás recuperarlos." : ""}`, retry: fromGuard ? undefined : () => void save(true) });
      else setPubError(why);
      return false;
    } finally {
      setBusy(null);
    }
  };
  const saveDraft = () => {
    if (busy) return;
    if (!buf.dirty) {
      toast.show({ message: "No hay cambios que guardar." });
      return;
    }
    void save(true);
  };
  const askPublish = () => {
    if (busy || publishedClean) return;
    if (!review.cuadra) {
      setShake((n) => n + 1);
      return;
    }
    setPubError("");
    setPubOpen(true);
  };

  useUnsavedGuard(buf.dirty, {
    what: `el acta de la ${j}`,
    alt: {
      label: "Guardar borrador y salir",
      run: async () => {
        const ok = await save(true, true);
        if (!ok) buf.keepMirror();
      },
    },
    // Tabs and the «Nuevo partido» modal stay on this match: only leaving it is guarded.
    shouldBlock: ({ current, next }) => next.pathname !== current.pathname && !next.pathname.replace(/\/+$/, "").endsWith(`/partidos/${match.id}`),
  });

  // ── palette ──
  const handlers = useRef({ saveDraft, askPublish });
  useEffect(() => {
    handlers.current = { saveDraft, askPublish };
  });
  const dirty = buf.dirty;
  const reason = review.cuadra ? "Cuadra · lista para publicar" : (review.reasons[0] ?? "No cuadra todavía");
  // (memoized by the React Compiler)
  const commands: PaletteCommand[] = [
      { id: `acta:guardar:${match.id}`, group: "Acciones", icon: "↓", title: `Guardar borrador de la ${j}`, description: dirty ? "Cambios sin guardar" : "Sin cambios", hint: "acción", keywords: "guardar borrador acta", run: () => handlers.current.saveDraft() },
      { id: `acta:publicar:${match.id}`, group: "Acciones", icon: "✓", title: finished ? `Publicar el acta de la ${j}` : `Publicar la ${j}`, description: reason, hint: "acción", keywords: "publicar acta", run: () => handlers.current.askPublish() },
  ];
  useRegisterCommands(commands);

  // ── header / footer words ──
  const t = sheet.date;
  const kicker = [j, sheet.competition.trim(), Number.isFinite(t) ? shortDate(t) : "sin fecha", where(sheet.home)].filter(Boolean).join(" · ");
  const draftAt = savedAt ?? (match.draft ? (match.draftSavedAt ?? null) : null);
  const sameDay = (a: number, b: number) => shortDate(a) === shortDate(b);
  const sv: { text: string; tone: "ok" | "warn" | "" } = buf.dirty
    ? { text: "● Cambios sin guardar", tone: "warn" }
    : draftAt
      ? { text: `✓ Guardado ${sameDay(draftAt, data.now) ? "" : `${shortDate(draftAt)}, `}${clockTime(draftAt)} · hora de Madrid`, tone: "ok" }
      : match.draft
        ? { text: "✓ Borrador guardado · hora de Madrid", tone: "ok" }
        : match.published
        ? { text: "✓ Publicado · hora de Madrid", tone: "ok" }
        : { text: "○ Sin guardar todavía · hora de Madrid", tone: "" };
  const head: { tone: ChipTone; text: string } = publishedClean
    ? { tone: "ok", text: finished ? "Publicada" : "Publicado" }
    : !finished
      ? review.cuadra
        ? { tone: "ok", text: "Listo para publicar" }
        : { tone: "warn", text: "Borrador · no cuadra" }
      : review.cuadra
        ? { tone: "ok", text: "Cuadra" }
        : review.missingScorers
          ? { tone: "warn", text: `Borrador · falta ${review.missingScorers} goleador${review.missingScorers === 1 ? "" : "es"}` }
          : { tone: "warn", text: "Borrador · no cuadra" };
  const pb = publishedClean
    ? { cls: "pub", mk: "✓", text: finished ? "Acta publicada" : "Publicado en el calendario" }
    : review.cuadra
      ? { cls: "ok", mk: "✓", text: finished ? "Cuadra · lista para publicar" : "Listo para publicar" }
      : { cls: "", mk: "!", text: "No cuadra todavía" };
  const pubLabel = publishedClean ? (finished ? "Publicada" : "Publicado") : finished ? "Publicar acta" : "Publicar encuentro";

  // ── tabs (arrows move between them) ──
  const onTabsKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = MATCH_TABS.indexOf(tab);
    const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? MATCH_TABS.length - 1 : -2;
    if (n === -2) return;
    e.preventDefault();
    const next = MATCH_TABS[(n + MATCH_TABS.length) % MATCH_TABS.length];
    onTab(next);
    requestAnimationFrame(() => tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus({ preventScroll: true }));
  };
  const tabId = (k: MatchTab) => `ad-tab-${match.id}-${k}`;
  const prev = previousLineup(data.matches, { id: match.id, seasonId: sheet.seasonId, date: sheet.date });

  return (
    <>
      <div className="dp-h">
        <button type="button" className="bk" onClick={onBack} aria-label="Volver a la lista de partidos">
          <AdIcon name="back" />
        </button>
        <div className="t">
          <p className="kk">
            <i />
            {kicker}
          </p>
          <h2 className="edt">
            Piti <span className="tn">{finished ? `${gf}–${ga}` : "vs"}</span> {rival}
          </h2>
        </div>
        <div className="meta">
          <Chip tone={head.tone}>{head.text}</Chip>
          <p className={`svd ${sv.tone}`.trim()} role="status">
            {sv.text}
          </p>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="El partido" ref={tabsRef} onKeyDown={onTabsKey}>
        {review.steps.map((st) => {
          const k = st.key as MatchTab;
          const on = tab === k;
          return (
            <button key={k} type="button" role="tab" id={tabId(k)} data-tab={k} aria-selected={on} aria-controls={`${tabId(k)}-p`} tabIndex={on ? 0 : -1} onClick={() => onTab(k)}>
              <i className={st.tone} aria-hidden="true">
                {st.mark}
              </i>
              <span className="l1">{st.label}</span>
              <span className="l2">{st.short}</span>
              <span className="sr">{st.tone === "ok" ? " · listo" : st.tone === "warn" ? " · por revisar" : ""}</span>
            </button>
          );
        })}
      </div>
      <div className="dp-b scr" role="tabpanel" id={`${tabId(tab)}-p`} aria-labelledby={tabId(tab)}>
        <div className="ed">
          {buf.offer && !buf.dirty && (
            <div className="ad-rec" role="status">
              <AdIcon name="undo" size={16} />
              <span>
                <b>Hay cambios sin guardar en este dispositivo</b>
                <small>De las {clockTime(buf.offer.at)}{sameDay(buf.offer.at, data.now) ? "" : ` del ${shortDate(buf.offer.at)}`}.</small>
              </span>
              <span className="row">
                <button type="button" className="btn sm pri" onClick={buf.recover}>
                  Recuperar cambios sin guardar de {clockTime(buf.offer.at)}
                </button>
                <button type="button" className="btn sm line" onClick={buf.dismissOffer}>
                  Descartar
                </button>
              </span>
            </div>
          )}
          {tab === "encuentro" && <TabEncuentro key="enc" sheet={sheet} update={update} seasons={data.seasons} onDelete={() => setDelOpen(true)} />}
          {tab === "convocatoria" && (
            <TabConvocatoria
              key="cv"
              sheet={sheet}
              update={update}
              roster={roster}
              previous={prev ? { label: jLabel(prev), lineup: { starters: prev.starters ?? [], bench: prev.bench ?? [], notCalled: prev.notCalled ?? [] } } : null}
            />
          )}
          {tab === "acta" && <TabActa key="acta" sheet={sheet} update={update} review={review} rival={rival} j={j} rosterOrder={roster.map((p) => p.id)} info={info} onGoTab={onTab} />}
          {tab === "publicar" && (
            <TabPublicar
              key="pub"
              sheet={sheet}
              update={update}
              nameOf={(id) => nameOf(id)}
              status={{ text: pb.text, tone: pb.cls === "" ? "warn" : "ok" }}
              mvp={mvp}
              onPoster={() => void downloadMatchPoster({ ...sheet, id: match.id, goalsFor: gf, goalsAgainst: ga, rivalInitials: rivalInitialsOf(sheet) }, "square")}
            />
          )}
        </div>
      </div>
      <div className="dp-f" aria-live="polite">
        <div className="stt">
          <p className={`pb-st ${pb.cls}`.trim()}>
            <span className="ic" aria-hidden="true">
              {pb.mk}
            </span>
            {pb.text}
          </p>
          <p className={`why${shake ? (shake % 2 ? " hl" : " hl2") : ""}`}>{review.why}</p>
        </div>
        <div className="bt">
          <button type="button" className="btn line sv" onClick={saveDraft} aria-disabled={!buf.dirty || !!busy}>
            <span className="l1">{busy === "draft" ? "Guardando…" : "Guardar borrador"}</span>
            <span className="l2" aria-hidden="true">
              {busy === "draft" ? "…" : "Guardar"}
            </span>
          </button>
          <button type="button" className="btn gold" aria-disabled={!review.cuadra || publishedClean || !!busy} onClick={askPublish} aria-haspopup="dialog">
            <AdIcon name="check" size={16} />
            {busy === "publish" ? "Publicando…" : pubLabel}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={pubOpen}
        onClose={() => !busy && setPubOpen(false)}
        kicker={`Acta · ${label}`}
        title={finished ? "¿Publicar el acta?" : "¿Publicar el encuentro?"}
        lede="Esto es lo que verá todo el mundo en la web:"
        cancelLabel="Revisar otra vez"
        confirmLabel={finished ? "Publicar acta" : "Publicar encuentro"}
        confirmTone="gold"
        busy={busy === "publish"}
        error={pubError || undefined}
        consequences={publishConsequences({ finished, starters: sheet.starters.length, bench: sheet.bench.length, voteClosesAt, firstTime: !match.published, now: data.now })}
        onConfirm={() => {
          setPubError("");
          void save(false).then((ok) => ok && setPubOpen(false));
        }}
      >
        <div className="psum ad-psum">
          <div className="sc">
            <span>Piti</span>
            <b>{finished ? `${gf}–${ga}` : "vs"}</b>
            <span>{rival}</span>
          </div>
          {finished && gf > 0 && (
            <div className="gs">
              {scorerChips(sheet, (id) => nameOf(id)).map((g, i) => (
                <span key={i} className="chip">
                  <AdIcon name="ball" size={12} />
                  {g}
                </span>
              ))}
            </div>
          )}
          {!finished && Number.isFinite(t) && (
            <p className="hint">
              {shortDate(t)} · {clockTime(t)} · {where(sheet.home)}
              {sheet.venue.trim() ? ` · ${sheet.venue.trim()}` : ""}
            </p>
          )}
        </div>
      </ConfirmModal>
      {delOpen && (
        <DeleteMatchModal
          matchId={match.id}
          label={label}
          goals={gf + ga}
          events={sheet.events.length}
          called={sheet.starters.length + sheet.bench.length}
          onClose={() => setDelOpen(false)}
          onDeleted={() => {
            buf.reset();
            setDelOpen(false);
            toast.show({ message: `${label} borrado.` });
            // (after the reset has rendered, so leaving isn't asked as «sin guardar»)
            setTimeout(onDeleted, 0);
          }}
        />
      )}
    </>
  );
}
