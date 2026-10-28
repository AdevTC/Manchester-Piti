// useSheetSession(): the match's acta as the stations Datos, Acta (and its Narración, Historial) and Publicar edit it —
// one buffer per match (sheetStore.ts) that survives moving between them, the sheet the review and the save see,
// the review («¿Cuadra?»), the save line, the saves (Guardar borrador · Publicar el acta · Guardar cambios · Publicar
// en el calendario) through saveMatchSheet, «Descartar borrador» (discardMatchDraft, M-44), the jugadas of the mesa
// that arrive meanwhile (M4), the change of another captain and the draft the published acta overtook (B-ACTA-01),
// this device's mirror, and the guard: leaving those stations with unsaved edits asks «¿Salir sin guardar?».
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useRouter } from "@tanstack/react-router";
import { apiError, discardMatchDraft, saveMatchSheet } from "../../../../lib/clubApi";
import { guestLabel, isGuestId } from "../../../../lib/derived/guests";
import { clockTime, jLabel, shortDate, type ActaReview, type AdminMatch } from "../../data/adminLogic";
import { useWhistled } from "../../data/whistleStore";
import { instant } from "../../acta/dates";
import { lineupWithGuests } from "../../acta/guests";
import { liveConflicts, mergeLive, pendingLiveChanges } from "../../acta/liveMerge";
import { reviewMatch } from "../../acta/review";
import { namesFor, rosterFor } from "../../acta/roster";
import { fromMatch, restoreSheet, score, sig, toPayload, type MatchSheet } from "../../acta/sheetModel";
import { useMatchNote } from "../../partidos/live";
import { blockedWhy, effectiveSheet, footerOf, phaseOf, tidyVenue, type FooterView, type Phase } from "../../partidos/workspaceModel";
import { usePartido } from "../../partido/partidoContext";
import { useAdmin } from "../../shell/context";
import { useOnline } from "../../shell/season";
import { useStatus } from "../../shell/statusContext";
import { useUnsavedGuard } from "../../ui/guard";
import type { RosterPlayer } from "../../data/useAdminData";
import { staleDraft, whatChanged } from "./actaModel";
import { dropSheetStore, isDirty, sessionPath, sheetStore, type Busy } from "./sheetStore";

export interface PlayerInfo {
  name: string;
  number: number | null;
  position: string;
}
/** The bar over the acta when the match moved under the edits. */
export interface Clash {
  /** `draft`: the published acta overtook the saved draft (B-ACTA-01); `edit`: another captain saved while editing;
   *  `mesa`: only new jugadas of the mesa (they merge without loss). */
  kind: "draft" | "edit" | "mesa";
  /** What changed, in words («Ver qué cambió»). */
  lines: string[];
  /** The jugadas of the mesa not yet in the edits (kind `mesa`). */
  count: number;
}

export interface SheetSession {
  match: AdminMatch;
  j: string;
  rival: string;
  /** The workspace's phase (antes · juego · jugado · off). */
  phase: Phase;
  /** The sheet the stations show, the review and the saves see (the convocatoria's lineup, a played match finished). */
  sheet: MatchSheet;
  /** The buffer's own value and base (for the narrated analysis' fingerprints). */
  value: MatchSheet;
  dirty: boolean;
  loading: boolean;
  roster: RosterPlayer[];
  info: (id: string) => PlayerInfo;
  nameOf: (id: string | undefined) => string;
  review: ActaReview;
  foot: FooterView;
  /** Published and finished on the web (with or without a draft over it). */
  published: boolean;
  /** Published, finished and nothing over it. */
  publishedClean: boolean;
  /** A draft is saved on the server (over the published acta, or the match only exists as a draft). */
  serverDraft: boolean;
  draftAt: number | null;
  savedAt: number | null;
  /** «● Cambios sin guardar» · «Guardado 12:04 · hora de Madrid» · «Sin conexión…». */
  saveLine: string;
  busy: Busy;
  online: boolean;
  offer: { at: number; line: string } | null;
  recover: () => void;
  dismissOffer: () => void;
  clash: Clash | null;
  /** «Recargar y conservar mis cambios» / «Incorporar»: the server's version in, the edits kept. */
  takeIn: () => void;
  update: (f: (s: MatchSheet) => MatchSheet) => void;
  reset: () => void;
  saveDraft: () => Promise<boolean>;
  /** Publish (first time or a correction): resolves true when it went through. */
  publish: () => Promise<boolean>;
  /** «Guardar» / «Publicar en el calendario» of a match still to be played. */
  saveCalendar: (first: boolean) => Promise<boolean>;
  /** «Descartar borrador»: the server's draft (discardMatchDraft) and the edits here; back to what is published. */
  discardDraft: () => Promise<void>;
  /** Why «Publicar» is off right now (null = it can go). */
  blocked: string | null;
}

/** The match's acta, shared by its stations. Call it in each station screen (inside the match's layout). */
export function useSheetSession(): SheetSession {
  const { match } = usePartido();
  const data = useAdmin();
  const note = useMatchNote(match.id);
  const whistled = useWhistled();
  const status = useStatus();
  const online = useOnline();
  const router = useRouter();

  const server = useMemo(() => fromMatch(match, note.data), [match, note.data]);
  const serverSig = useMemo(() => sig(server), [server]);
  const store = sheetStore(match.id, server);
  const st = useSyncExternalStore(store.subscribe, store.get, store.get);
  const dirty = isDirty(st);
  // A new server version while clean: shown at once, adopted after the render (an external store is not written
  // while rendering).
  const follow = st.src !== serverSig && !dirty;
  const value = follow ? server : st.value;
  useLayoutEffect(() => {
    if (follow) store.adopt(server, serverSig);
  }, [follow, store, server, serverSig]);

  // Leaving the stations of this match drops its store (the guard asked first; a kept mirror stays).
  const matchId = match.id;
  useEffect(
    () => () => {
      setTimeout(() => {
        if (store.watched) return;
        if (!sessionPath(matchId, router.state.location.pathname)) dropSheetStore(matchId);
      }, 0);
    },
    [store, matchId, router],
  );

  const phase = phaseOf(match, data.now, whistled.has(match.id));
  const { starters, bench, notCalled } = match;
  const sheet: MatchSheet = useMemo(() => {
    const lineup = value.seasonId === (match.seasonId ?? "") ? { starters: starters ?? [], bench: bench ?? [], notCalled: notCalled ?? [] } : { starters: value.starters, bench: value.bench, notCalled: value.notCalled };
    return effectiveSheet({ ...value, ...lineupWithGuests(lineup, value) }, phase);
  }, [value, match.seasonId, starters, bench, notCalled, phase]);

  const roster = useMemo(() => rosterFor(data.players, data.seasons, sheet.seasonId), [data.players, data.seasons, sheet.seasonId]);
  const names = useMemo(() => namesFor(data.players, data.seasons, sheet.seasonId), [data.players, data.seasons, sheet.seasonId]);
  const nameOf = useCallback((id: string | undefined) => (id && isGuestId(id) ? guestLabel(sheet, id) : names(id)), [sheet, names]);
  const info = useCallback(
    (id: string): PlayerInfo => {
      if (isGuestId(id)) return { name: guestLabel(sheet, id), number: null, position: "" };
      const r = roster.find((p) => p.id === id);
      return r ? { name: r.name, number: r.number, position: r.position } : { name: names(id), number: null, position: "" };
    },
    [sheet, roster, names],
  );

  const j = jLabel(match);
  const rival = sheet.rival.trim() || "Rival";
  const published = match.published && match.status === "finished";
  const publishedClean = published && !match.draft && !dirty;
  const review = useMemo(() => reviewMatch(sheet, roster.map((p) => p.id), data.now, publishedClean, nameOf), [sheet, roster, data.now, publishedClean, nameOf]);
  const foot = footerOf({ phase, inCalendar: match.published, draft: match.draft, status: match.status ?? "scheduled", date: sheet.date, review });
  const serverDraft = match.draft;
  const draftAt = st.savedAt ?? (match.draft ? (match.draftSavedAt ?? null) : null);

  // ── the match moved under the edits ──
  const pub = data.published.find((p) => p.id === match.id);
  const overtaken = staleDraft(match, pub);
  // (taken in: the edits carry the published revision now, the next save resolves it)
  const stale = overtaken && (value.revision ?? 0) !== overtaken.revision ? overtaken : null;
  const clash = useMemo<Clash | null>(() => {
    if (stale) {
      // (what the published acta has that the draft doesn't: the convocatoria, la mesa…)
      const lines = pub ? whatChanged(server, fromMatch(pub, note.data), nameOf).filter((l) => !/^Guardó/.test(l)) : [];
      return { kind: "draft", lines: lines.length ? lines : ["Lo publicado ha cambiado desde que se guardó este borrador (la convocatoria o la mesa)."], count: 0 };
    }
    if (!dirty || sig(server) === sig(st.base)) return st.refused ? { kind: "edit", lines: [st.refused], count: 0 } : null;
    const count = pendingLiveChanges(st.value, st.base, server, st.removed);
    const onlyEvents = Object.keys({ ...server, ...st.base }).every((k) => k === "events" || k === "revision" || k === "analysis" || sig((server as unknown as Record<string, unknown>)[k]) === sig((st.base as unknown as Record<string, unknown>)[k]));
    if (onlyEvents && count && !liveConflicts(st.value, st.base, server)) return { kind: "mesa", lines: [], count };
    return { kind: "edit", lines: whatChanged(st.base, server, nameOf), count };
  }, [stale, pub, note.data, nameOf, dirty, server, st.base, st.value, st.removed, st.refused]);
  const takeIn = useCallback(() => {
    if (stale) {
      // (the draft saves over the published revision from now on; the edits — and the draft's — stay, unsaved)
      store.set((v) => ({ ...v, revision: stale.revision }));
      status.show({ tag: "Al día", message: "Recargado con lo publicado · tus cambios siguen aquí, sin guardar" });
      return;
    }
    store.rebase(server, serverSig, (v, b, s, removed) => {
      const merged = mergeLive(v, b, s, removed);
      // (a real clash keeps the edits where both changed: the captain chose to keep his)
      return { ...merged, revision: s.revision ?? 0, ...(merged.analysis && s.analysis ? { analysis: { ...merged.analysis, revision: s.analysis.revision } } : {}) };
    });
    status.show({ tag: clash?.kind === "mesa" ? "La mesa" : "Al día", message: clash?.kind === "mesa" ? `${clash.count === 1 ? "1 jugada incorporada" : `${clash.count} jugadas incorporadas`} de la mesa · tus cambios siguen` : "Recargado · tus cambios siguen aquí, sin guardar" });
  }, [stale, store, server, serverSig, status, clash]);

  // ── saving ──
  const busyRef = useRef(false);
  // (the retries of the status strip call the latest version)
  const again = useRef<{ write: (draft: boolean) => Promise<boolean>; discard: () => Promise<void> } | null>(null);
  const write = useCallback(
    async (draft: boolean, o: { fromGuard?: boolean } = {}): Promise<boolean> => {
      if (busyRef.current) return false;
      const p = toPayload({ ...sheet, venue: tidyVenue(sheet.venue) }, draft, nameOf, rival);
      if (!p.ok) {
        status.show({ tone: "error", message: `${draft ? "No se puede guardar el borrador" : "No se puede publicar"}: ${p.error}` });
        return false;
      }
      busyRef.current = true;
      store.patch({ busy: draft ? "draft" : "publish" });
      try {
        await saveMatchSheet({ id: match.id, sheet: p.sheet, draft, ...(sheet.narrationSources?.length ? { sources: sheet.narrationSources } : {}) });
        const now = store.get().value;
        const saved = draft ? now : { ...now, revision: (now.revision ?? 0) + 1, ...(now.analysis ? { analysis: { ...now.analysis, revision: now.analysis.revision + 1 } } : {}) };
        if (!draft) store.set(() => saved);
        store.commit(saved, store.get().src, instant());
        return true;
      } catch (e) {
        const why = apiError(e);
        const code = (e as { code?: string }).code ?? "";
        if (/aborted/.test(code) || /Otro administrador|ha cambiado/.test(why)) store.patch({ refused: `No se ha guardado: ${why}` });
        status.show({
          tone: "error",
          message: `${draft ? "No se ha podido guardar el borrador" : "No se ha podido publicar"}: ${why}${o.fromGuard ? " Los cambios siguen en este dispositivo: al volver podrás recuperarlos." : ""}`,
          retry: o.fromGuard ? undefined : () => void again.current?.write(draft),
        });
        return false;
      } finally {
        busyRef.current = false;
        store.patch({ busy: null });
      }
    },
    [sheet, nameOf, rival, status, store, match.id],
  );

  const saveDraft = useCallback(async () => {
    if (!online) {
      store.patch({ pendingSync: true });
      status.show({ tag: "Sin conexión", message: "Guardado en este dispositivo: se sube solo al volver la red" });
      return false;
    }
    if (!isDirty(store.get()) && !store.get().pendingSync) {
      status.show({ tag: j, message: "No hay cambios que guardar" });
      return false;
    }
    const ok = await write(true);
    if (ok) status.show({ tag: j, message: "Borrador guardado · solo lo ven los capitanes" });
    return ok;
  }, [online, store, status, j, write]);
  // (back online: the draft that waited goes up by itself)
  const pendingSync = st.pendingSync;
  useEffect(() => {
    if (online && pendingSync && store.watched) void write(true).then((ok) => ok && status.show({ tag: j, message: "Borrador subido · ya lo ven los capitanes" }));
  }, [online, pendingSync, store, write, status, j]);

  const blocked = !online ? "Publicar necesita red: vuelve a intentarlo cuando vuelva" : stale ? "Otro capitán ha cambiado este partido: recarga conservando tus cambios" : !review.cuadra ? blockedWhy(review) : null;
  const publish = useCallback(async () => {
    if (blocked) {
      status.show({ tone: "error", message: blocked });
      return false;
    }
    const first = !published;
    const ok = await write(false);
    if (ok && !first) status.show({ tag: j, message: `Acta ${j} corregida · web al día` });
    if (ok && first) status.show({ tag: "Publicada", message: `Acta ${j} publicada · la web ya lo cuenta` });
    return ok;
  }, [blocked, status, published, write, j]);
  const saveCalendar = useCallback(
    async (first: boolean) => {
      if (!first && !isDirty(store.get())) {
        status.show({ tag: j, message: "No hay cambios que guardar" });
        return false;
      }
      if (!review.cuadra) {
        status.show({ tone: "error", message: blockedWhy(review) });
        return false;
      }
      const ok = await write(false);
      if (ok) status.show({ tag: j, message: first ? `${j} · ${rival} publicado · ya sale en el calendario` : `${j} guardado · el calendario ya lo tiene` });
      return ok;
    },
    [store, status, j, review, write, rival],
  );

  const discardDraft = useCallback(async () => {
    const before = store.get().value;
    const hadEdits = isDirty(store.get());
    if (match.draft && match.published) {
      store.patch({ busy: "discard" });
      try {
        await discardMatchDraft({ matchId: match.id });
        store.reset();
        status.show({ tag: "Borrador", message: "Borrador descartado · vuelve a lo publicado" });
      } catch (e) {
        status.show({ tone: "error", message: `No se ha podido descartar el borrador: ${apiError(e)}`, retry: () => void again.current?.discard() });
      } finally {
        store.patch({ busy: null });
      }
      return;
    }
    if (!hadEdits) return;
    store.reset();
    status.show({ tag: "Descartado", message: "Cambios descartados · vuelve a lo guardado", undo: () => store.set(() => before) });
  }, [store, match.draft, match.published, match.id, status]);

  useEffect(() => {
    again.current = { write, discard: discardDraft };
  });

  // ── the guard: only leaving these stations of this match asks ──
  useUnsavedGuard(dirty, {
    what: phase === "jugado" ? `el acta de la ${j}` : `la ${j}`,
    alt: {
      label: "Guardar borrador y salir",
      run: async () => {
        const ok = await write(true, { fromGuard: true });
        if (!ok) store.patch({ keep: true });
      },
    },
    shouldBlock: ({ current, next }) => next.pathname !== current.pathname && !sessionPath(match.id, next.pathname),
  });

  const saveLine = !online
    ? "Sin conexión · tus cambios están a salvo en este dispositivo"
    : dirty
      ? "● Cambios sin guardar"
      : draftAt
        ? `Guardado ${shortDate(draftAt) === shortDate(data.now) ? "" : `${shortDate(draftAt)}, `}${clockTime(draftAt)} · hora de Madrid`
        : published
          ? "Publicada · la web ya lo cuenta"
          : "Sin guardar todavía";
  const offer = st.offer && !dirty ? { at: st.offer.at, line: `De las ${clockTime(st.offer.at)}${shortDate(st.offer.at) === shortDate(data.now) ? "" : ` (del ${shortDate(st.offer.at)})`}.` } : null;

  return {
    match,
    j,
    rival,
    phase,
    sheet,
    value,
    dirty,
    loading: note.loading,
    roster,
    info,
    nameOf,
    review,
    foot,
    published,
    publishedClean,
    serverDraft,
    draftAt,
    savedAt: st.savedAt,
    saveLine,
    busy: st.busy,
    online,
    offer,
    recover: () => store.recover(restoreSheet),
    dismissOffer: () => store.dismissOffer(),
    clash,
    takeIn,
    update: (f) => store.set(f),
    reset: () => store.reset(),
    saveDraft,
    publish,
    saveCalendar,
    discardDraft,
    blocked,
  };
}

/** The score of the sheet being edited (the count of the goals written down). */
export const scoreOf = (s: MatchSheet) => score(s);
