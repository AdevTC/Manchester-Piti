// r14 «La pizarra» (/pizarra/*): the page. It makes the store, feeds it the app's real data (the season's squad
// and calendar, the boards, the board session with its autosave, the convocatoria, the reactions, the kit stills),
// follows the address, and mounts the shell. One instance across every /pizarra/* address (the router's layout),
// so the pitch never remounts between places.
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useAuth } from "../../../context/AuthContext";
import { useTeam } from "../../../context/TeamContext";
import { useSeason } from "../../../context/SeasonContext";
import { useClubData } from "../../../lib/clubData";
import { nextFixture } from "../../../lib/clubData";
import { useClock } from "../../../hooks/useClock";
import { useTheme } from "../../../hooks/useTheme";
import { usePageKitStills } from "../../../components/jersey3d/usePageKitStills";
import { setConvocatoria } from "../../../lib/clubApi";
import { useLineups } from "../useLineups";
import { useReactions } from "../useReactions";
import { usePizarraPrefs } from "../data/prefs";
import { copyBoardVoices } from "../data/boards";
import { holdUpdatesWhile } from "../../../lib/updateHold";
import { boardSeason, useBoardData } from "../v2/useBoardData";
import { useSeasonLineupDocs } from "../seasonLineups";
import { useAbsences, useAvailability } from "../../vestuario/live";
import { madridDate } from "../../../lib/derived/absences";
import { isCompleted } from "../../../lib/clubData";
import { useBoardSession } from "../v2/useBoardSession";
import { useConvocatoria } from "../v2/useConvocatoria";
import { matchShort, officialFor, withConvocatoria } from "../v2/boards";
import { createPzStore, type PzStore } from "./store/store";
import { PzProvider } from "./store/PzProvider";
import { parsePizarra } from "./store/routes";
import { buildWorld, pizarraSeason, playedAtOf } from "./store/world";
import { useLayout } from "./shell/useLayout";
import { Shell } from "./shell/Shell";
import "./places";
import "./sheets";

/** Why the boards could not be read, in a sentence (the error state shows it). */
function errorWords(e: unknown): string {
  const code = typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
  if (code === "permission-denied") return "La pizarra no te deja leer los tableros de esta temporada (permiso denegado). Tus tableros siguen guardados.";
  if (code === "unavailable" || code === "deadline-exceeded") return "Sin conexión con el club. No es que no tengas: tus tableros siguen guardados en el servidor.";
  return "No se han podido leer los tableros" + (code ? ` (${code})` : "") + ". Siguen guardados en el servidor.";
}

export function PizarraR14() {
  const { user, profile } = useAuth();
  const { member } = useTeam();
  const { seasons, selectedSeasonId } = useSeason();
  const navigate = useNavigate();
  const location = useLocation();
  const urlSeason = useSearch({ strict: false, select: (s) => (s as { season?: string }).season });
  const { matches } = useClubData();
  const now = useClock(60_000);
  const { theme } = useTheme();

  // ── the season: the one asked for, else the current one (a board belongs to one season: «all» shows none)
  const seasonId = pizarraSeason(selectedSeasonId, seasons, nextFixture(matches, now) ?? undefined, matches);
  useEffect(() => {
    if (!seasonId || urlSeason === seasonId) return;
    void navigate({ to: ".", search: (prev) => ({ ...prev, season: seasonId }), replace: true });
  }, [seasonId, urlSeason, navigate]);

  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const data = useBoardData(seasonId);
  const lineups = useLineups(seasonId);
  const draftName = data.next ? matchShort(data.next) : "Mi tablero";
  const session = useBoardSession({ seasonId, lineups, squadIds: data.squadIds, squadReady: !data.loading && urlSeason === seasonId, uid: user?.uid ?? "preview", isAdmin, draftName, urlSeason });
  const linked = data.calendar.find((c) => c.id === session.matchId) ?? null;
  const m = linked ?? data.next;
  const conv = useConvocatoria(m?.id ?? null);
  // (the same shared listeners the vestuario opens: the answers an absence wrote, the team's absences)
  const answers = useAvailability(m?.id);
  const byAbsence = useMemo(() => new Set(answers.data.filter((a) => a.absenceId !== undefined && a.playerId).map((a) => a.playerId as string)), [answers.data]);
  // the members without a ficha who answered («Marta (socia, sin ficha): va»)
  const memberAnswers = useMemo(() => answers.data.filter((a) => !a.playerId).map((a) => ({ uid: a.uid, name: a.name, response: a.response, byAbsence: a.absenceId !== undefined })), [answers.data]);
  const absences = useAbsences(madridDate(now), !!member);
  // the season's finished matches: minutes per puesto (the actas) and the board's match's guests
  const games = useMemo(() => boardSeason(matches, seasonId).filter((g) => isCompleted(g)), [matches, seasonId]);
  const playedAt = useMemo(() => playedAtOf(data.squadIds, games), [data.squadIds, games]);
  const guests = useMemo(() => matches.find((g) => g.id === m?.id)?.guests ?? [], [matches, m?.id]);
  // the boards could not be read (rules, network): useLineups keeps it to itself, the shared query says it
  const adminUid = isAdmin ? (user?.uid ?? null) : null;
  const docsQ = useSeasonLineupDocs(seasonId, !!seasonId, adminUid);
  const readError = docsQ.error ? errorWords(docsQ.error) : "";
  const squad = useMemo(() => withConvocatoria(data.squad, conv.conv), [data.squad, conv.conv]);
  const official = session.official ? (lineups.official.find((d) => d.id === session.id) ?? null) : officialFor(session.officials, m?.id ?? null);
  const reactions = useReactions(official ? { id: official.id, isOfficial: official.isOfficial, sevenRev: official.sevenRev } : null);
  // the settings that follow you (users/{uid}/private/pizarra; localStorage is the cache)
  const prefs = usePizarraPrefs(user?.uid ?? null);
  const stills = usePageKitStills({ on: true, theme: theme === "light" ? "light" : "dark", kits: ["home", "away"], players: squad.list.map((c) => ({ name: c.name, num: String(c.num) })) });

  // the boards being deleted (the session hides yours during the 12 s to undo): the store never shows them
  const visibleDocs = useMemo(() => {
    const mineShown = new Set(session.mine.map((d) => d.id));
    return lineups.all.filter((d) => !(d.ownerUid === (user?.uid ?? "") && lineups.mine.some((x) => x.id === d.id) && !mineShown.has(d.id)));
  }, [lineups.all, lineups.mine, session.mine, user?.uid]);
  // the board on screen, for a copy made just now (copyBoard opens it and then reports its name, not its id)
  const shownId = useRef<string | null>(session.id);
  useEffect(() => {
    shownId.current = session.id;
  }, [session.id]);
  const [store] = useState<PzStore>(() => createPzStore({ route: parsePizarra(location.pathname, location.search as Record<string, unknown>) }));
  const layout = useLayout();
  useEffect(() => store.setLayout(layout), [store, layout]);

  // ── the address → the store
  useEffect(() => {
    store.setRoute(parsePizarra(location.pathname, location.search as Record<string, unknown>));
  }, [store, location.pathname, location.search]);
  // ?tablero= names the board on screen
  const tablero = (location.search as { tablero?: string }).tablero;
  useEffect(() => {
    if (!session.ready || !tablero || tablero === session.id) return;
    const exists = lineups.all.some((d) => d.id === tablero) || lineups.mine.some((d) => d.id === tablero) || lineups.official.some((d) => d.id === tablero);
    if (exists) session.open(tablero);
    else store.toast("Ese tablero ya no existe o no es de esta temporada", { icon: "warn" });
    // (session.open is a new function each render: the board asked for is what matters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.ready, tablero, session.id]);

  // ── the host: where the store's writes go
  useEffect(() => {
    store.setHost({
      navigate: (href, o) => void navigate({ href, replace: !!o?.replace }),
      commit: (L) => session.commit(L),
      save: (id, L) => void lineups.save(id, L).catch((e: unknown) => console.error("No se pudo guardar el tablero", e)),
      open: (id) => session.open(id),
      duplicate: async (id) => {
        const from = id ?? session.id;
        const before = shownId.current;
        await session.copyBoard(id, true);
        // the copy opens: wait for the session to show it (≤ 3 s), then copy the charla's voices to it
        const t0 = Date.now();
        while (shownId.current === before && Date.now() - t0 < 3000) await new Promise((r) => setTimeout(r, 50));
        const nid = shownId.current !== before ? shownId.current : null;
        if (!nid) return;
        if (from) {
          const n = await copyBoardVoices(from, nid, user?.uid ?? "");
          if (n === null) store.toast("La voz de la charla no se ha copiado", { icon: "warn" });
        }
        return nid;
      },
      remove: (id) => session.remove(id),
      publish: async ({ convocatoria, boardId, matchId }) => {
        // the session publishes the board on screen: never another one (a redo after opening a different board)
        if (session.id !== boardId) throw new Error("ese tablero ya no es el que tienes abierto");
        const id = await session.publish(matchId ?? m?.id ?? null);
        if (convocatoria && isAdmin && m && typeof id === "string") {
          const v = store.sel.ver(store.sel.board(), "titular");
          const starters = (v?.slots ?? []).map((s) => s.playerId).filter((x): x is string => !!x);
          await setConvocatoria({ matchId: m.id, starters, bench: m.conv?.bench ?? [], notify: true, fromBoard: id });
        }
      },
      unpublish: (id) => session.unpublish(id),
      react: (v) => void reactions.react(v).catch(() => store.toast("No se ha podido guardar tu opinión", { icon: "warn" })),
      retry: () => window.location.reload(),
      stills: (kit, num) => stills(kit, num),
      season: () => seasonId || undefined,
      prefs: () => prefs.prefs,
      setPrefs: (p) => prefs.set(p),
    });
  });

  // ── the data → the store's world
  const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
  useEffect(() => {
    const seasonName = seasons.find((s) => s.id === seasonId)?.name ?? "Temporada";
    const W = buildWorld({
      now,
      season: { id: seasonId, name: seasonName },
      squad,
      calendar: data.calendar,
      next: data.next,
      // (a board the session is deleting — its 12 s to undo — is gone already)
      docs: visibleDocs,
      session: { id: session.id, name: session.name, lineup: session.lineup, uid: user?.uid ?? "", nick: profile?.nickname ?? "", matchId: session.matchId, official: session.official },
      official,
      playedAt,
      guests,
      members: memberAnswers,
      absences: absences.data,
      byAbsence,
    });
    const pid = profile?.playerId ?? null;
    const inside = !!member && !!profile;
    store.attach({
      W,
      me: { uid: user?.uid ?? "", name: profile?.nickname ?? "", nick: profile?.nickname ?? "", label: profile?.nickname ?? "", pid, cap: isAdmin, general: profile?.role === "superadmin", socia: inside && !pid, jugador: inside && !!pid && !isAdmin, fuera: !inside, member: inside },
      boardId: session.id ?? "nuevo",
      estado: readError ? "error" : !session.ready || data.loading ? "cargando" : !online ? "offline" : "normal",
      error: readError,
      saveStatus: session.status,
      saved: session.savedAt,
      reactions: official ? { ok: reactions.ok, dudas: reactions.dudas, mine: reactions.mine, ...(reactions.who ? { who: reactions.who } : {}) } : undefined,
    });
  }, [store, now, seasonId, seasons, squad, data.calendar, data.next, data.loading, visibleDocs, memberAnswers, session.id, session.name, session.lineup, session.matchId, session.official, session.ready, session.status, session.savedAt, official, member, profile, user, isAdmin, online, playedAt, guests, absences.data, byAbsence, readError, prefs.prefs, stills, reactions.ok, reactions.dudas, reactions.mine, reactions.who]);

  // a new version waits while the pizarra is busy (unsaved edit, sheet, drawing, charla, undo window), not longer
  useEffect(() => holdUpdatesWhile(() => store.sel.busy()), [store]);

  // what changed under the board (another tab, a new official, a failed save) is said
  useEffect(() => {
    if (session.notice) store.toast(session.notice.msg, { icon: "warn" });
  }, [store, session.notice]);

  return (
    <PzProvider store={store}>
      <Shell />
    </PzProvider>
  );
}
