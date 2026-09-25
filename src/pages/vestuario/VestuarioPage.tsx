import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../../context/AuthContext";
import { useTeam } from "../../context/TeamContext";
import { useSeason } from "../../context/SeasonContext";
import { dateMillis, useClubData, nextFixture, playerForSeason, playerName } from "../../lib/clubData";
import { useClock } from "../../hooks/useClock";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { ThemeToggle } from "../../components/ThemeToggle";
import { bestPartner, currentSeasonId, firstSteps, trainingOver, initials, lastVotedMatch, seasonSummary, suggestFicha, vitrina } from "../../lib/vestuario";
import {
  useAvailability,
  useBoard,
  useHasPosted,
  useMeetingNote,
  useMvpResults,
  useMyClaim,
  useOpenTrainings,
  usePendingClaims,
  usePlayerLinks,
  usePorraStandings,
  type Availability,
} from "./live";
import { Hero, type Ficha, type Me } from "./Hero";
import { CaptainStrip } from "./Captain";
import { BestPartner, FirstSteps, SeasonFeats, SeasonPlaceholder, Vitrina } from "./SeasonBlocks";
import { Access, Board, MvpBlock, Porra, TrainingPoll } from "./TeamBlocks";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";



/** "Primeros pasos" can be hidden; remembered per account on this device. */
function useStepsHidden(uid: string) {
  const key = `vx-steps-hidden:${uid}`;
  const read = () => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  };
  const [state, setState] = useState(() => ({ key, hidden: read() }));
  const hidden = state.key === key ? state.hidden : read();
  const hide = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* private mode: hide for this visit only */
    }
    setState({ key, hidden: true });
  };
  return [hidden, hide] as const;
}

export function VestuarioPage() {
  const { user, profile, logout } = useAuth();
  const { lock, member } = useTeam();
  const { seasons } = useSeason();
  const { matches, players } = useClubData();
  const now = useClock(60_000);
  const theme = useDocumentTheme();
  const uid = user?.uid ?? "";
  const admin = ["admin", "superadmin"].includes(profile?.role ?? "");
  const next = nextFixture(matches, now);
  const seasonId = currentSeasonId(next, matches, seasons);
  const season = seasons.find((s) => s.id === seasonId);
  const seasonName = season?.name ?? "Temporada";
  const matchOpen = !!next && dateMillis(next.date) > now;

  const availability = useAvailability(next?.id);
  const meetingNote = useMeetingNote(next?.id);
  const mvpResults = useMvpResults();
  const porra = usePorraStandings(seasonId || undefined);
  const trainings = useOpenTrainings(now);
  const confirmedTraining = trainings.data.find((t) => t.confirmed && !trainingOver(t, now))?.confirmed;
  const board = useBoard(8);
  const claim = useMyClaim(profile?.playerId ? undefined : uid || undefined);
  const links = usePlayerLinks(!profile?.playerId || admin);
  const pendingClaims = usePendingClaims(admin);
  const posted = useHasPosted(uid || undefined);
  const [stepsHidden, hideSteps] = useStepsHidden(uid);
  const lastMatch = lastVotedMatch(matches);

  const playerId = profile?.playerId;
  const rawPlayer = players.find((p) => p.id === playerId);
  const player = rawPlayer ? playerForSeason(rawPlayer, seasonId, seasons) : undefined;
  const nick = profile?.nickname ?? "";
  const me: Me = {
    uid,
    displayName: (player?.shirtName || nick).toUpperCase(),
    shirtName: (player?.shirtName || nick).toUpperCase(),
    number: player?.number != null ? String(player.number) : "",
    playerId,
  };
  const nameOf = (id: string) => playerName(players.find((p) => p.id === id));
  const faceName = (a: Availability) => (a.playerId ? nameOf(a.playerId) : a.name);
  const firstName = player?.firstName || player?.shirtName || nick;

  const fichas = fichaOptions(players, links.data, seasonId, nick);
  // `now` only matters for MVP votes closing: minute precision keeps these memos cheap.
  const minute = Math.floor(now / 60_000);
  const summary = useMemo(
    () => (playerId ? seasonSummary(playerId, seasonId, matches, mvpResults, minute * 60_000) : null),
    [playerId, seasonId, matches, mvpResults, minute],
  );
  const medals = useMemo(
    () => (playerId ? vitrina(playerId, matches, mvpResults, seasons, minute * 60_000) : []),
    [playerId, matches, mvpResults, seasons, minute],
  );
  const partner = useMemo(() => (playerId ? bestPartner(playerId, matches, players.map((p) => p.id)) : null), [playerId, matches, players]);
  const steps = firstSteps({
    linked: !!playerId,
    claimPending: claim.data?.status === "pending",
    matchOpen,
    answered: availability.data.some((a) => a.uid === uid),
    posted: posted.data,
  });
  const showSteps = !stepsHidden && !posted.loading && steps.some((s) => s.state !== "done");
  const firstStepsBlock = showSteps && (
    <FirstSteps steps={steps} onHide={hideSteps} claimPending={claim.data?.status === "pending"} matchOpen={matchOpen} />
  );
  const fichaName = (c: { playerId: string; playerName: string }) => playerName(players.find((p) => p.id === c.playerId)) || c.playerName;

  const signOut = async () => {
    try {
      await lock();
    } finally {
      await logout();
    }
  };
  return (
    <div className="vx">
      <CelesteBackdrop />
      <CelesteHeader
        active="vestuario"
        sub="Vestuario"
        actions={
          <>
            <ThemeToggle />
            <Link className={`vx-avatar${admin ? " cap" : ""}`} to="/profile" aria-label={`Tu perfil: ${nick}`}>
              {initials(me.displayName)}
            </Link>
          </>
        }
      />

      <Hero
        me={me}
        seasonName={seasonName}
        next={next}
        meetingNote={meetingNote.data}
        availability={availability.data}
        now={now}
        theme={theme}
        faceName={faceName}
        claim={claim.data}
        claimable={fichas.claimable}
        suggestion={fichas.suggestion}
        admin={admin}
        training={confirmedTraining}
        captain={
          admin ? (
            <CaptainStrip hasNext={!!next} claims={pendingClaims.data} linked={fichas.linked} squad={fichas.squad} fichaName={fichaName} />
          ) : undefined
        }
      />

      <main className="vx-main">
        {summary ? (
          <div className="vx-you">
            <SeasonFeats s={summary} firstName={capitalize(firstName)} seasonName={seasonName} playerName={nameOf} />
            <div>
              {firstStepsBlock}
              <Vitrina medals={medals} />
              <BestPartner partner={partner} meName={me.displayName} partnerName={partner ? nameOf(partner.playerId) : ""} />
            </div>
          </div>
        ) : (
          <div className="vx-you">
            <SeasonPlaceholder firstName={capitalize(nick)} seasonName={seasonName} />
            <div>
              {firstStepsBlock}
              <Vitrina medals={NO_MEDALS} />
            </div>
          </div>
        )}

        <div className="vx-team-grid">
          <TrainingPoll trainings={trainings.data} uid={uid} admin={admin} now={now} />
          <Porra next={next} uid={uid} rows={porra.data} now={now} />
          <MvpBlock match={lastMatch} result={lastMatch ? mvpResults.get(lastMatch.id) : undefined} uid={uid} admin={admin} member={member} now={now} playerName={nameOf} />
          <Board messages={board.data} uid={uid} admin={admin} loading={board.loading} now={now} />
          <Access admin={admin} playerId={playerId} onLogout={() => void signOut()} />
        </div>
      </main>

      <CelesteFooter />
      <CelesteDock active="vestuario" />
    </div>
  );
}
/** Fichas a member can still claim (this season's squad, not linked yet) and the one matching their nickname. */
function fichaOptions(players: ReturnType<typeof useClubData>["players"], links: { playerId: string }[], seasonId: string, nick: string) {
  const taken = new Set(links.map((l) => l.playerId));
  const squad = players.filter((p) => p.active !== false || p.seasons?.includes(seasonId));
  const free = squad.filter((p) => !taken.has(p.id));
  const claimable: Ficha[] = free
    .map((p) => ({
      id: p.id,
      label: [playerName(p), p.number != null ? `· ${p.number}` : ""].filter(Boolean).join(" "),
      name: p.shirtName || playerName(p),
      number: p.number != null ? String(p.number) : "",
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  const hit = suggestFicha(nick, free.map((p) => ({ id: p.id, names: [p.shirtName ?? "", p.firstName ?? "", playerName(p)] })));
  return {
    claimable,
    suggestion: claimable.find((c) => c.id === hit?.id) ?? null,
    squad: squad.length,
    linked: squad.length - free.length,
  };
}
/** All six medals still to win, for the vitrina before the ficha is linked. */
const NO_MEDALS = vitrina("", [], new Map(), [], 0);
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);
