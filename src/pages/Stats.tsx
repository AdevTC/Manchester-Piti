import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSeason, type Season } from "../context/SeasonContext";
import { Leaderboard } from "../components/Leaderboard";
import { Jersey } from "../components/Jersey";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { Shield, Sparkles, TrendingUp, X, Award, Trophy, Zap, Flame, Users, Target, Crown, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

// Editorial section heading: Anton title + short sky rule bar (project cadence).
const SectionHead: React.FC<{ title: string; sub?: string; rule?: string }> = ({ title, sub, rule = "var(--accent-cyan)" }) => (
  <div style={{ marginBottom: "1.25rem" }}>
    <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 400, textTransform: "uppercase", fontSize: "clamp(1.5rem, 4vw, 2.1rem)", lineHeight: 0.95, letterSpacing: "0.01em", color: "var(--text-primary)" }}>
      {title}
    </h3>
    <span style={{ display: "block", width: "60px", height: "5px", background: rule, margin: "0.6rem 0 0" }} />
    {sub && <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginTop: "0.65rem", maxWidth: "65ch" }}>{sub}</p>}
  </div>
);

// Smaller sub-section label inside a section (uppercase grotesque, not a display face).
const SubHead: React.FC<{ title: string; rule?: string }> = ({ title, rule = "var(--accent-cyan)" }) => (
  <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
    <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: rule, flexShrink: 0 }} />
    <h4 style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: "0.82rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-primary)", margin: 0 }}>
      {title}
    </h4>
  </div>
);

const formatPlayerName = (firstName: string, lastName: string) => {
  if (!lastName || !lastName.trim()) return firstName;
  const words = lastName.trim().split(/\s+/);
  const initials = words
    .map(w => w.charAt(0).toUpperCase() + ".")
    .join(" ");
  return `${firstName} ${initials}`;
};

interface TeamStats {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

interface RivalRecord {
  rival: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

interface PlayerAccumulatedStats {
  playerId: string;
  name: string;
  shirtName: string;
  number: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  doubleYellows: number;
  woodwork: number;
  penaltySaved: number;
  goalPenalty: number;
  goalFreekick: number;
  penaltyMissed: number;
  ownGoals: number;
  matchesPlayed: number;
}

// A single timestamped event inside a match document.
interface MatchEvent {
  type: string;
  playerId?: string;
  assistPlayerId?: string;
}

// Firestore timestamp values may arrive as a Date, a string, or a serialized
// `{ seconds }` object depending on the source — narrow before use.
type DateLike = Date | string | number | { seconds: number } | null | undefined;

// A match document as loaded from Firestore.
interface MatchDoc {
  id: string;
  goalsFor?: number;
  goalsAgainst?: number;
  rival?: string;
  competition?: string;
  date?: DateLike;
  events?: MatchEvent[];
  seasonId?: string;
}

// A player document as loaded from Firestore.
interface PlayerDoc {
  id: string;
  firstName: string;
  lastName: string;
  shirtName?: string;
  number?: number;
  seasons: string[];
  seasonDetails?: Record<string, { shirtName: string; number: number }>;
}

// One days-as-leader streak, as rendered in the record details modal.
interface DaysStreak {
  startStr: string;
  endStr: string;
  days: number;
  isActive: boolean;
}

// A match-record streak entry (consecutive team results).
interface MatchStreak {
  length: number;
  start: string;
  startRival: string;
  end: string;
  endRival: string;
}

// The subset of the computed `records` object that the details modal reads.
interface RecordDetailsData {
  scoringStreakRankings: { name: string; value: number; streaks: { rival: string; dateStr: string }[][] }[];
  assistingStreakRankings: { name: string; value: number; streaks: { rival: string; dateStr: string }[][] }[];
  gPlusAStreakRankings: { name: string; value: number; streaks: { rival: string; dateStr: string }[][] }[];
  daysLeaderPichichi: { name: string; value: number; isActive: boolean; streaks: DaysStreak[] }[];
  daysLeaderAssists: { name: string; value: number; isActive: boolean; streaks: DaysStreak[] }[];
  daysLeaderGPlusA: { name: string; value: number; isActive: boolean; streaks: DaysStreak[] }[];
}

// Heterogeneous row rendered by the record details list; the active record kind
// determines which optional fields are populated.
interface RecordListItem {
  name?: string;
  value?: number;
  rival?: string;
  dateStr?: string;
  score?: string;
  length?: number;
  start?: string;
  startRival?: string;
  end?: string;
  endRival?: string;
  goals?: number;
  assists?: number;
  isActive?: boolean;
  streaks?: { rival: string; dateStr: string }[][] | DaysStreak[];
}

export const Stats: React.FC = () => {
  const { selectedSeasonId, seasons } = useSeason();
  const [activeChartMetric, setActiveChartMetric] = useState<string | null>(null);
  const [activeChartTitle, setActiveChartTitle] = useState<string>("");
  const [activeRecordInfo, setActiveRecordInfo] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "compare">("general");
  const [activeRivalInfo, setActiveRivalInfo] = useState<string | null>(null);
  const [playerAId, setPlayerAId] = useState<string>("");
  const [playerBId, setPlayerBId] = useState<string>("");

  const [players, setPlayers] = useState<PlayerDoc[]>([]);
  const [matches, setMatches] = useState<MatchDoc[]>([]);
  // Loading is derived from whether matches for the active season have arrived,
  // so we never call setState synchronously in the effect (set-state-in-effect).
  const [loadedKey, setLoadedKey] = useState<string>("");

  // Initialize default players for comparison when players list is loaded.
  // Intentional: seeds the default A/B selection once the roster loads.
  // playerAId/playerBId are also user-mutable via the compare dropdowns, so this
  // cannot be a pure derive.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (players.length > 0) {
      if (!playerAId || !players.some(p => p.id === playerAId)) {
        setPlayerAId(players[0].id);
      }
      if (players.length > 1) {
        if (!playerBId || !players.some(p => p.id === playerBId) || playerBId === players[0].id) {
          // Choose the second player, or the first one if we only have one
          const secondPlayer = players.find(p => p.id !== (playerAId || players[0].id));
          if (secondPlayer) setPlayerBId(secondPlayer.id);
        }
      } else {
        setPlayerBId("");
      }
    }
  }, [players, playerAId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 1. Fetch Roster and Matches in parallel
  useEffect(() => {
    // Fetch players
    const playersRef = collection(db, "players");
    const unsubscribePlayers = onSnapshot(playersRef, (playerSnapshot) => {
      const loadedPlayers = playerSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlayerDoc[];
      setPlayers(loadedPlayers);
    });

    // Fetch matches based on filter
    const matchesRef = collection(db, "matches");
    let matchesQuery = query(matchesRef);
    if (selectedSeasonId !== "all") {
      matchesQuery = query(matchesRef, where("seasonId", "==", selectedSeasonId));
    }

    const unsubscribeMatches = onSnapshot(matchesQuery, (matchSnapshot) => {
      const loadedMatches = matchSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MatchDoc[];
      setMatches(loadedMatches);
      setLoadedKey(selectedSeasonId);
    }, (err) => {
      console.error(err);
      setLoadedKey(selectedSeasonId);
    });

    return () => {
      unsubscribePlayers();
      unsubscribeMatches();
    };
  }, [selectedSeasonId]);

  // Matches for the active season have arrived once loadedKey matches it.
  const loading = loadedKey !== selectedSeasonId;

  // 2. Perform Dynamic Calculations
  const teamStats: TeamStats = {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0
  };

  const rivalRecords: Record<string, RivalRecord> = {};
  
  // Initialize player accumulation map
  const playerStatsMap: Record<string, PlayerAccumulatedStats> = {};
  players.forEach(p => {
    let resolvedShirtName = p.shirtName || "";
    let resolvedNumber = p.number || 0;

    if (selectedSeasonId !== "all" && p.seasonDetails?.[selectedSeasonId]) {
      resolvedShirtName = p.seasonDetails[selectedSeasonId].shirtName;
      resolvedNumber = p.seasonDetails[selectedSeasonId].number;
    } else if (p.seasons && p.seasons.length > 0 && p.seasonDetails) {
      const activeSeasonsInList = seasons.filter(s => p.seasons.includes(s.id));
      if (activeSeasonsInList.length > 0) {
        const latestPlayerSeason = activeSeasonsInList[activeSeasonsInList.length - 1];
        if (p.seasonDetails[latestPlayerSeason.id]) {
          resolvedShirtName = p.seasonDetails[latestPlayerSeason.id].shirtName;
          resolvedNumber = p.seasonDetails[latestPlayerSeason.id].number;
        }
      }
    }

    playerStatsMap[p.id] = {
      playerId: p.id,
      name: formatPlayerName(p.firstName, p.lastName),
      shirtName: resolvedShirtName,
      number: resolvedNumber,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      doubleYellows: 0,
      woodwork: 0,
      penaltySaved: 0,
      goalPenalty: 0,
      goalFreekick: 0,
      penaltyMissed: 0,
      ownGoals: 0,
      matchesPlayed: 0
    };
  });

  // Initialize partnerships map
  const partnershipsMap: Record<string, {
    playerAId: string;
    playerAName: string;
    playerAShirtName: string;
    playerANumber: number;
    
    playerBId: string;
    playerBName: string;
    playerBShirtName: string;
    playerBNumber: number;
    
    aAssistsB: number;
    bAssistsA: number;
    totalConnections: number;
  }> = {};

  // Loop matches to compile team & player stats
  matches.forEach(match => {
    const goalsFor = match.goalsFor || 0;
    const goalsAgainst = match.goalsAgainst || 0;
    const rival = match.rival || "Rival";

    // Increment team stats
    teamStats.played += 1;
    teamStats.goalsFor += goalsFor;
    teamStats.goalsAgainst += goalsAgainst;

    let matchOutcome: "win" | "draw" | "loss";
    if (goalsFor > goalsAgainst) {
      teamStats.wins += 1;
      teamStats.points += 3;
      matchOutcome = "win";
    } else if (goalsFor === goalsAgainst) {
      teamStats.draws += 1;
      teamStats.points += 1;
      matchOutcome = "draw";
    } else {
      teamStats.losses += 1;
      matchOutcome = "loss";
    }

    // Increment Head-to-Head rival balance (normalized and case-insensitive grouping)
    const formattedRivalName = rival.trim().replace(/\s+/g, " ");
    const rivalKey = formattedRivalName.toUpperCase();
    if (!rivalRecords[rivalKey]) {
      rivalRecords[rivalKey] = {
        rival: formattedRivalName, // Keep the first casing variation for display
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0
      };
    }
    const rr = rivalRecords[rivalKey];
    rr.played += 1;
    rr.goalsFor += goalsFor;
    rr.goalsAgainst += goalsAgainst;
    if (matchOutcome === "win") rr.wins += 1;
    else if (matchOutcome === "draw") rr.draws += 1;
    else rr.losses += 1;

    // Process Match Events
    const events = match.events || [];
    const participantsInMatch = new Set<string>();

    events.forEach((event: MatchEvent) => {
      const { type, playerId, assistPlayerId } = event;

      if (playerId) {
        participantsInMatch.add(playerId);
      }
      if (type === "goal" && assistPlayerId) {
        participantsInMatch.add(assistPlayerId);
      }

      // Safety check: if player was deleted, stats can be skipped or shown as fallback
      if (playerId && playerStatsMap[playerId]) {
        if (type === "goal") {
          playerStatsMap[playerId].goals += 1;
        } else if (type === "goal_penalty") {
          playerStatsMap[playerId].goals += 1;
          playerStatsMap[playerId].goalPenalty += 1;
        } else if (type === "goal_freekick") {
          playerStatsMap[playerId].goals += 1;
          playerStatsMap[playerId].goalFreekick += 1;
        } else if (type === "own_goal") {
          playerStatsMap[playerId].ownGoals += 1;
        } else if (type === "assist") {
          playerStatsMap[playerId].assists += 1;
        } else if (type === "yellow_card") {
          playerStatsMap[playerId].yellowCards += 1;
        } else if (type === "red_card") {
          playerStatsMap[playerId].redCards += 1;
        } else if (type === "double_yellow") {
          playerStatsMap[playerId].doubleYellows += 1;
          playerStatsMap[playerId].yellowCards += 2;
          playerStatsMap[playerId].redCards += 1;
        } else if (type === "penalty_saved") {
          playerStatsMap[playerId].penaltySaved += 1;
        } else if (type === "penalty_missed") {
          playerStatsMap[playerId].penaltyMissed += 1;
        } else if (type === "woodwork") {
          playerStatsMap[playerId].woodwork += 1;
        }
      }

      if (type === "goal" && assistPlayerId && playerStatsMap[assistPlayerId]) {
        playerStatsMap[assistPlayerId].assists += 1;
      }

      // Chemistry/Partnership accumulation
      const isGoal = type === "goal" || type === "goal_penalty" || type === "goal_freekick";
      if (isGoal && playerId && assistPlayerId && playerId !== assistPlayerId) {
        const scorer = playerStatsMap[playerId];
        const assister = playerStatsMap[assistPlayerId];

        if (scorer && assister) {
          const pairKey = [playerId, assistPlayerId].sort().join("-");
          
          if (!partnershipsMap[pairKey]) {
            const isAssisterA = assistPlayerId < playerId;
            const playerA = isAssisterA ? assister : scorer;
            const playerB = isAssisterA ? scorer : assister;

            partnershipsMap[pairKey] = {
              playerAId: playerA.playerId,
              playerAName: playerA.name,
              playerAShirtName: playerA.shirtName,
              playerANumber: playerA.number,
              
              playerBId: playerB.playerId,
              playerBName: playerB.name,
              playerBShirtName: playerB.shirtName,
              playerBNumber: playerB.number,
              
              aAssistsB: 0,
              bAssistsA: 0,
              totalConnections: 0
            };
          }

          const p = partnershipsMap[pairKey];
          if (assistPlayerId === p.playerAId) {
            p.aAssistsB += 1;
          } else {
            p.bAssistsA += 1;
          }
          p.totalConnections += 1;
        }
      }
    });

    // Increment matchesPlayed for all participants in this match
    participantsInMatch.forEach(pId => {
      if (playerStatsMap[pId]) {
        playerStatsMap[pId].matchesPlayed += 1;
      }
    });
  });

  // Convert partnerships map to sorted list
  const partnershipsList = Object.values(partnershipsMap)
    .filter(p => p.totalConnections > 0)
    .sort((a, b) => b.totalConnections - a.totalConnections);

  // Compute Records & Milestones
  const records = useMemo(() => {
    if (matches.length === 0 || players.length === 0) {
      return {
        maxGoalsInMatch: { value: 0, holders: [] as { name: string; rival: string; dateStr: string }[] },
        maxAssistsInMatch: { value: 0, holders: [] as { name: string; rival: string; dateStr: string }[] },
        scoringStreakRankings: [] as { name: string; value: number; streaks: { rival: string; dateStr: string }[][] }[],
        assistingStreakRankings: [] as { name: string; value: number; streaks: { rival: string; dateStr: string }[][] }[],
        gPlusAStreakRankings: [] as { name: string; value: number; streaks: { rival: string; dateStr: string }[][] }[],
        daysLeaderPichichi: [] as { name: string; value: number; isActive: boolean; streaks: DaysStreak[] }[],
        daysLeaderAssists: [] as { name: string; value: number; isActive: boolean; streaks: DaysStreak[] }[],
        daysLeaderGPlusA: [] as { name: string; value: number; isActive: boolean; streaks: DaysStreak[] }[],
        hatTricks: [] as { name: string; goals: number; rival: string; dateStr: string }[],
        minTwoGoalsPerformances: [] as { name: string; goals: number; rival: string; dateStr: string }[],

        maxMargin: { value: 0, matches: [] as { rival: string; score: string; dateStr: string }[] },
        maxTotalGoals: { value: 0, matches: [] as { rival: string; score: string; dateStr: string }[] },
        maxUnbeaten: { value: 0, matches: [] as { rival: string; score: string; dateStr: string }[] },
        maxWinning: { value: 0, matches: [] as { rival: string; score: string; dateStr: string }[] },
        maxCleanSheets: { value: 0, matches: [] as { rival: string; score: string; dateStr: string }[] },

        maxPenaltyGoals: { value: 0, holders: [] as { name: string; value: number }[] },
        maxFreekickGoals: { value: 0, holders: [] as { name: string; value: number }[] },
        maxPenaltySaves: { value: 0, holders: [] as { name: string; value: number }[] },
        maxWoodworkHits: { value: 0, holders: [] as { name: string; value: number }[] },
        maxGPlusAInMatch: { value: 0, holders: [] as { name: string; rival: string; value: number; goals: number; assists: number; dateStr: string }[] },
        maxAppearances: { value: 0, holders: [] as { name: string; value: number }[] }
      };
    }

    const formatDate = (dateVal: DateLike) => {
      if (!dateVal) return "";
      const d = typeof dateVal === "object" && "seconds" in dateVal ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
      return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
    };

    const getMatchDate = (m: MatchDoc) => {
      if (m.date && typeof m.date === "object" && "seconds" in m.date) return new Date(m.date.seconds * 1000);
      return new Date(m.date as string | number | Date);
    };
    const chronoMatches = [...matches].sort((a, b) => getMatchDate(a).getTime() - getMatchDate(b).getTime());

    const playerLookup: Record<string, { name: string; shirtName: string; number: number }> = {};
    players.forEach(p => {
      playerLookup[p.id] = {
        name: formatPlayerName(p.firstName, p.lastName),
        shirtName: p.shirtName || "",
        number: p.number || 0
      };
    });

    let globalMaxGoals = 0;
    let globalMaxGoalsHolders: { name: string; rival: string; dateStr: string }[] = [];

    let globalMaxAssists = 0;
    let globalMaxAssistsHolders: { name: string; rival: string; dateStr: string }[] = [];

    const hatTricksList: { name: string; goals: number; rival: string; dateStr: string }[] = [];
    const minTwoGoalsPerformances: { name: string; goals: number; rival: string; dateStr: string }[] = [];

    // Team records
    let maxMargin = -1;
    let maxMarginMatches: { rival: string; score: string; dateStr: string }[] = [];

    let maxTotalGoals = -1;
    let maxTotalGoalsMatches: { rival: string; score: string; dateStr: string }[] = [];

    // Team streaks
    let currentUnbeaten = 0;
    let currentUnbeatenMatches: { rival: string; score: string; dateStr: string }[] = [];
    let maxUnbeaten = 0;
    let maxUnbeatenMatches: { rival: string; score: string; dateStr: string }[] = [];

    let currentWinning = 0;
    let currentWinningMatches: { rival: string; score: string; dateStr: string }[] = [];
    let maxWinning = 0;
    let maxWinningMatches: { rival: string; score: string; dateStr: string }[] = [];

    let currentCleanSheets = 0;
    let currentCleanSheetsMatches: { rival: string; score: string; dateStr: string }[] = [];
    let maxCleanSheets = 0;
    let maxCleanSheetsMatches: { rival: string; score: string; dateStr: string }[] = [];

    // Player stats trackers for specials
    const playerSpecials: Record<string, { penaltyGoals: number; freekickGoals: number; penaltySaves: number; woodworkHits: number }> = {};
    players.forEach(p => {
      playerSpecials[p.id] = { penaltyGoals: 0, freekickGoals: 0, penaltySaves: 0, woodworkHits: 0 };
    });

    let maxGPlusAInMatch = 0;
    let maxGPlusAInMatchHolders: { name: string; rival: string; value: number; goals: number; assists: number; dateStr: string }[] = [];

    const playerAppearances: Record<string, number> = {};
    players.forEach(p => {
      playerAppearances[p.id] = 0;
    });

    const playerStreakMap: Record<string, {
      currentScoring: number;
      currentScoringMatches: { rival: string; dateStr: string }[];
      maxScoring: number;
      maxScoringStreaks: { rival: string; dateStr: string }[][];
      
      currentAssisting: number;
      currentAssistingMatches: { rival: string; dateStr: string }[];
      maxAssisting: number;
      maxAssistingStreaks: { rival: string; dateStr: string }[][];

      currentGPlusA: number;
      currentGPlusAMatches: { rival: string; dateStr: string }[];
      maxGPlusA: number;
      maxGPlusAStreaks: { rival: string; dateStr: string }[][];
    }> = {};

    players.forEach(p => {
      playerStreakMap[p.id] = {
        currentScoring: 0,
        currentScoringMatches: [],
        maxScoring: 0,
        maxScoringStreaks: [],
        
        currentAssisting: 0,
        currentAssistingMatches: [],
        maxAssisting: 0,
        maxAssistingStreaks: [],

        currentGPlusA: 0,
        currentGPlusAMatches: [],
        maxGPlusA: 0,
        maxGPlusAStreaks: []
      };
    });

    // To track cumulative stats during the chronological simulation
    const playerCumGoals: Record<string, number> = {};
    const playerCumAssists: Record<string, number> = {};
    const playerCumGPlusA: Record<string, number> = {};

    players.forEach(p => {
      playerCumGoals[p.id] = 0;
      playerCumAssists[p.id] = 0;
      playerCumGPlusA[p.id] = 0;
    });

    // To track active leadership streaks
    // A streak is: { start: Date, end: Date | null, days: number, isActive: boolean }
    interface LeadershipStreak {
      start: Date;
      end: Date | null;
      days: number;
      isActive: boolean;
    }
    const goalStreaks: Record<string, LeadershipStreak[]> = {};
    const assistStreaks: Record<string, LeadershipStreak[]> = {};
    const gPlusAStreaks: Record<string, LeadershipStreak[]> = {};

    players.forEach(p => {
      goalStreaks[p.id] = [];
      assistStreaks[p.id] = [];
      gPlusAStreaks[p.id] = [];
    });

    let currentGoalLeaders = new Set<string>();
    let currentAssistLeaders = new Set<string>();
    let currentGPlusALeaders = new Set<string>();

    let prevMatchDate: Date | null = null;

    const reconcileLeaders = (
      currentL: Set<string>,
      newL: Set<string>,
      streaksMap: Record<string, LeadershipStreak[]>,
      matchDate: Date
    ) => {
      // For any player who lost leadership: close their streak
      currentL.forEach(pId => {
        if (!newL.has(pId)) {
          const list = streaksMap[pId];
          if (list && list.length > 0) {
            const active = list[list.length - 1];
            if (active && active.end === null) {
              active.end = matchDate;
              active.isActive = false;
            }
          }
        }
      });

      // For any player who gained leadership: start a new streak
      newL.forEach(pId => {
        if (!currentL.has(pId)) {
          if (!streaksMap[pId]) {
            streaksMap[pId] = [];
          }
          streaksMap[pId].push({
            start: matchDate,
            end: null,
            days: 0,
            isActive: true
          });
        }
      });
    };

    chronoMatches.forEach((match, mIdx) => {
      const matchDate = getMatchDate(match);

      // Calculate days elapsed since the previous match for the active leaders
      if (mIdx > 0 && prevMatchDate) {
        const daysElapsed = Math.round((matchDate.getTime() - prevMatchDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysElapsed > 0) {
          currentGoalLeaders.forEach(pId => {
            const activeList = goalStreaks[pId];
            if (activeList && activeList.length > 0) {
              const active = activeList[activeList.length - 1];
              if (active && active.end === null) {
                active.days += daysElapsed;
              }
            }
          });
          currentAssistLeaders.forEach(pId => {
            const activeList = assistStreaks[pId];
            if (activeList && activeList.length > 0) {
              const active = activeList[activeList.length - 1];
              if (active && active.end === null) {
                active.days += daysElapsed;
              }
            }
          });
          currentGPlusALeaders.forEach(pId => {
            const activeList = gPlusAStreaks[pId];
            if (activeList && activeList.length > 0) {
              const active = activeList[activeList.length - 1];
              if (active && active.end === null) {
                active.days += daysElapsed;
              }
            }
          });
        }
      }

      const events = match.events || [];
      const rivalName = match.rival || "Rival";
      const dateStr = formatDate(match.date);
      const gf = match.goalsFor || 0;
      const gc = match.goalsAgainst || 0;
      const scoreStr = `${gf} - ${gc}`;

      // 1. Mayor Goleada A Favor (GF > GC and max margin)
      if (gf > gc) {
        const margin = gf - gc;
        if (margin > maxMargin) {
          maxMargin = margin;
          maxMarginMatches = [{ rival: rivalName, score: scoreStr, dateStr }];
        } else if (margin === maxMargin) {
          maxMarginMatches.push({ rival: rivalName, score: scoreStr, dateStr });
        }
      }

      // 2. Festival del Gol (GF + GC)
      const totalGoals = gf + gc;
      if (totalGoals > maxTotalGoals) {
        maxTotalGoals = totalGoals;
        maxTotalGoalsMatches = [{ rival: rivalName, score: scoreStr, dateStr }];
      } else if (totalGoals === maxTotalGoals && totalGoals > 0) {
        maxTotalGoalsMatches.push({ rival: rivalName, score: scoreStr, dateStr });
      }

      // 3. Team streaks (Unbeaten, Winning, Clean Sheets)
      const outcome = gf > gc ? "win" : gf === gc ? "draw" : "loss";

      // Unbeaten (win or draw)
      if (outcome === "win" || outcome === "draw") {
        currentUnbeaten += 1;
        currentUnbeatenMatches.push({ rival: rivalName, score: scoreStr, dateStr });
        if (currentUnbeaten > maxUnbeaten) {
          maxUnbeaten = currentUnbeaten;
          maxUnbeatenMatches = [...currentUnbeatenMatches];
        }
      } else {
        currentUnbeaten = 0;
        currentUnbeatenMatches = [];
      }

      // Winning (win)
      if (outcome === "win") {
        currentWinning += 1;
        currentWinningMatches.push({ rival: rivalName, score: scoreStr, dateStr });
        if (currentWinning > maxWinning) {
          maxWinning = currentWinning;
          maxWinningMatches = [...currentWinningMatches];
        }
      } else {
        currentWinning = 0;
        currentWinningMatches = [];
      }

      // Clean Sheets (gc === 0)
      if (gc === 0) {
        currentCleanSheets += 1;
        currentCleanSheetsMatches.push({ rival: rivalName, score: scoreStr, dateStr });
        if (currentCleanSheets > maxCleanSheets) {
          maxCleanSheets = currentCleanSheets;
          maxCleanSheetsMatches = [...currentCleanSheetsMatches];
        }
      } else {
        currentCleanSheets = 0;
        currentCleanSheetsMatches = [];
      }

      const goalsInThisMatch: Record<string, number> = {};
      const assistsInThisMatch: Record<string, number> = {};
      const woodworkInThisMatch: Record<string, number> = {};

      events.forEach((ev: MatchEvent) => {
        const { type, playerId, assistPlayerId } = ev;
        const isGoal = type === "goal" || type === "goal_penalty" || type === "goal_freekick";

        if (isGoal && playerId) {
          goalsInThisMatch[playerId] = (goalsInThisMatch[playerId] || 0) + 1;
          if (playerCumGoals[playerId] !== undefined) playerCumGoals[playerId] += 1;
          if (playerCumGPlusA[playerId] !== undefined) playerCumGPlusA[playerId] += 1;
          
          if (type === "goal_penalty" && playerSpecials[playerId]) {
            playerSpecials[playerId].penaltyGoals += 1;
          }
          if (type === "goal_freekick" && playerSpecials[playerId]) {
            playerSpecials[playerId].freekickGoals += 1;
          }
        }
        if (type === "assist" && playerId) {
          assistsInThisMatch[playerId] = (assistsInThisMatch[playerId] || 0) + 1;
          if (playerCumAssists[playerId] !== undefined) playerCumAssists[playerId] += 1;
          if (playerCumGPlusA[playerId] !== undefined) playerCumGPlusA[playerId] += 1;
        }
        if (isGoal && assistPlayerId) {
          assistsInThisMatch[assistPlayerId] = (assistsInThisMatch[assistPlayerId] || 0) + 1;
          if (playerCumAssists[assistPlayerId] !== undefined) playerCumAssists[assistPlayerId] += 1;
          if (playerCumGPlusA[assistPlayerId] !== undefined) playerCumGPlusA[assistPlayerId] += 1;
        }
        if (type === "penalty_saved" && playerId && playerSpecials[playerId]) {
          playerSpecials[playerId].penaltySaves += 1;
        }
        if (type === "woodwork" && playerId) {
          woodworkInThisMatch[playerId] = (woodworkInThisMatch[playerId] || 0) + 1;
          if (playerSpecials[playerId]) {
            playerSpecials[playerId].woodworkHits += 1;
          }
        }
      });

      // Calculate max G+A in a single match
      const allPlayersInMatch = new Set([...Object.keys(goalsInThisMatch), ...Object.keys(assistsInThisMatch)]);
      allPlayersInMatch.forEach(pId => {
        const player = playerLookup[pId];
        if (!player) return;
        const g = goalsInThisMatch[pId] || 0;
        const a = assistsInThisMatch[pId] || 0;
        const gPlusA = g + a;
        if (gPlusA > maxGPlusAInMatch) {
          maxGPlusAInMatch = gPlusA;
          maxGPlusAInMatchHolders = [{ name: player.name, rival: rivalName, value: gPlusA, goals: g, assists: a, dateStr }];
        } else if (gPlusA === maxGPlusAInMatch && gPlusA > 0) {
          maxGPlusAInMatchHolders.push({ name: player.name, rival: rivalName, value: gPlusA, goals: g, assists: a, dateStr });
        }
      });

      // Increment appearances for all participants in this match inside records
      const participantsInMatch = new Set<string>();
      events.forEach((ev: MatchEvent) => {
        const { playerId, assistPlayerId, type } = ev;
        if (playerId) {
          participantsInMatch.add(playerId);
        }
        if (type === "goal" && assistPlayerId) {
          participantsInMatch.add(assistPlayerId);
        }
      });
      participantsInMatch.forEach(pId => {
        if (playerAppearances[pId] !== undefined) {
          playerAppearances[pId] += 1;
        }
      });

      // Update max goals in match & collect multi-goal performances
      Object.entries(goalsInThisMatch).forEach(([pId, goals]) => {
        const player = playerLookup[pId];
        if (!player) return;

        if (goals >= 3) {
          hatTricksList.push({
            name: player.name,
            goals,
            rival: rivalName,
            dateStr
          });
        }

        if (goals >= 2) {
          minTwoGoalsPerformances.push({
            name: player.name,
            goals,
            rival: rivalName,
            dateStr
          });
        }

        if (goals > globalMaxGoals) {
          globalMaxGoals = goals;
          globalMaxGoalsHolders = [{ name: player.name, rival: rivalName, dateStr }];
        } else if (goals === globalMaxGoals && goals > 0) {
          if (!globalMaxGoalsHolders.some(h => h.name === player.name && h.rival === rivalName && h.dateStr === dateStr)) {
            globalMaxGoalsHolders.push({ name: player.name, rival: rivalName, dateStr });
          }
        }
      });

      // Update max assists in match
      Object.entries(assistsInThisMatch).forEach(([pId, assists]) => {
        const player = playerLookup[pId];
        if (!player) return;

        if (assists > globalMaxAssists) {
          globalMaxAssists = assists;
          globalMaxAssistsHolders = [{ name: player.name, rival: rivalName, dateStr }];
        } else if (assists === globalMaxAssists && assists > 0) {
          if (!globalMaxAssistsHolders.some(h => h.name === player.name && h.rival === rivalName && h.dateStr === dateStr)) {
            globalMaxAssistsHolders.push({ name: player.name, rival: rivalName, dateStr });
          }
        }
      });

      // Update streaks for all active players based on team matches
      players.forEach(p => {
        const streakData = playerStreakMap[p.id];
        if (!streakData) return;

        // 1. Scoring Streak
        const goals = goalsInThisMatch[p.id] || 0;
        if (goals > 0) {
          streakData.currentScoring += 1;
          streakData.currentScoringMatches.push({ rival: rivalName, dateStr });
          if (streakData.currentScoring > streakData.maxScoring) {
            streakData.maxScoring = streakData.currentScoring;
            streakData.maxScoringStreaks = [[...streakData.currentScoringMatches]];
          } else if (streakData.currentScoring === streakData.maxScoring && streakData.maxScoring > 0) {
            streakData.maxScoringStreaks.push([...streakData.currentScoringMatches]);
          }
        } else {
          streakData.currentScoring = 0;
          streakData.currentScoringMatches = [];
        }

        // 2. Assisting Streak
        const assists = assistsInThisMatch[p.id] || 0;
        if (assists > 0) {
          streakData.currentAssisting += 1;
          streakData.currentAssistingMatches.push({ rival: rivalName, dateStr });
          if (streakData.currentAssisting > streakData.maxAssisting) {
            streakData.maxAssisting = streakData.currentAssisting;
            streakData.maxAssistingStreaks = [[...streakData.currentAssistingMatches]];
          } else if (streakData.currentAssisting === streakData.maxAssisting && streakData.maxAssisting > 0) {
            streakData.maxAssistingStreaks.push([...streakData.currentAssistingMatches]);
          }
        } else {
          streakData.currentAssisting = 0;
          streakData.currentAssistingMatches = [];
        }

        // 3. G+A Streak (Goal or Assist)
        if (goals > 0 || assists > 0) {
          streakData.currentGPlusA += 1;
          streakData.currentGPlusAMatches.push({ rival: rivalName, dateStr });
          if (streakData.currentGPlusA > streakData.maxGPlusA) {
            streakData.maxGPlusA = streakData.currentGPlusA;
            streakData.maxGPlusAStreaks = [[...streakData.currentGPlusAMatches]];
          } else if (streakData.currentGPlusA === streakData.maxGPlusA && streakData.maxGPlusA > 0) {
            streakData.maxGPlusAStreaks.push([...streakData.currentGPlusAMatches]);
          }
        } else {
          streakData.currentGPlusA = 0;
          streakData.currentGPlusAMatches = [];
        }
      });

      // Calculate new leaders and reconcile leadership transitions
      // 1. Goals
      let maxGoals = 0;
      players.forEach(p => {
        const val = playerCumGoals[p.id] || 0;
        if (val > maxGoals) maxGoals = val;
      });
      const newGoalLeaders = new Set<string>();
      if (maxGoals > 0) {
        players.forEach(p => {
          if ((playerCumGoals[p.id] || 0) === maxGoals) newGoalLeaders.add(p.id);
        });
      }

      // 2. Assists
      let maxAssists = 0;
      players.forEach(p => {
        const val = playerCumAssists[p.id] || 0;
        if (val > maxAssists) maxAssists = val;
      });
      const newAssistLeaders = new Set<string>();
      if (maxAssists > 0) {
        players.forEach(p => {
          if ((playerCumAssists[p.id] || 0) === maxAssists) newAssistLeaders.add(p.id);
        });
      }

      // 3. G+A
      let maxGPlusA = 0;
      players.forEach(p => {
        const val = playerCumGPlusA[p.id] || 0;
        if (val > maxGPlusA) maxGPlusA = val;
      });
      const newGPlusALeaders = new Set<string>();
      if (maxGPlusA > 0) {
        players.forEach(p => {
          if ((playerCumGPlusA[p.id] || 0) === maxGPlusA) newGPlusALeaders.add(p.id);
        });
      }

      reconcileLeaders(currentGoalLeaders, newGoalLeaders, goalStreaks, matchDate);
      reconcileLeaders(currentAssistLeaders, newAssistLeaders, assistStreaks, matchDate);
      reconcileLeaders(currentGPlusALeaders, newGPlusALeaders, gPlusAStreaks, matchDate);

      currentGoalLeaders = newGoalLeaders;
      currentAssistLeaders = newAssistLeaders;
      currentGPlusALeaders = newGPlusALeaders;
      prevMatchDate = matchDate;
    });

    // Compile player specials (totals)
    let maxPenaltyGoals = 0;
    let maxPenaltyGoalsHolders: { name: string; value: number }[] = [];

    let maxFreekickGoals = 0;
    let maxFreekickGoalsHolders: { name: string; value: number }[] = [];

    let maxPenaltySaves = 0;
    let maxPenaltySavesHolders: { name: string; value: number }[] = [];

    let maxWoodworkHits = 0;
    let maxWoodworkHitsHolders: { name: string; value: number }[] = [];

    let maxAppearances = 0;
    let maxAppearancesHolders: { name: string; value: number }[] = [];

    Object.entries(playerSpecials).forEach(([pId, data]) => {
      const player = playerLookup[pId];
      if (!player) return;

      const appCount = playerAppearances[pId] || 0;
      if (appCount > maxAppearances) {
        maxAppearances = appCount;
        maxAppearancesHolders = [{ name: player.name, value: appCount }];
      } else if (appCount === maxAppearances && appCount > 0) {
        maxAppearancesHolders.push({ name: player.name, value: appCount });
      }

      if (data.penaltyGoals > maxPenaltyGoals) {
        maxPenaltyGoals = data.penaltyGoals;
        maxPenaltyGoalsHolders = [{ name: player.name, value: data.penaltyGoals }];
      } else if (data.penaltyGoals === maxPenaltyGoals && data.penaltyGoals > 0) {
        maxPenaltyGoalsHolders.push({ name: player.name, value: data.penaltyGoals });
      }

      if (data.freekickGoals > maxFreekickGoals) {
        maxFreekickGoals = data.freekickGoals;
        maxFreekickGoalsHolders = [{ name: player.name, value: data.freekickGoals }];
      } else if (data.freekickGoals === maxFreekickGoals && data.freekickGoals > 0) {
        maxFreekickGoalsHolders.push({ name: player.name, value: data.freekickGoals });
      }

      if (data.penaltySaves > maxPenaltySaves) {
        maxPenaltySaves = data.penaltySaves;
        maxPenaltySavesHolders = [{ name: player.name, value: data.penaltySaves }];
      } else if (data.penaltySaves === maxPenaltySaves && data.penaltySaves > 0) {
        maxPenaltySavesHolders.push({ name: player.name, value: data.penaltySaves });
      }

      if (data.woodworkHits > maxWoodworkHits) {
        maxWoodworkHits = data.woodworkHits;
        maxWoodworkHitsHolders = [{ name: player.name, value: data.woodworkHits }];
      } else if (data.woodworkHits === maxWoodworkHits && data.woodworkHits > 0) {
        maxWoodworkHitsHolders.push({ name: player.name, value: data.woodworkHits });
      }
    });

    // Compile rankings (players with streaks >= 2)
    const scoringStreakRankings: { name: string; value: number; streaks: { rival: string; dateStr: string }[][] }[] = [];
    const assistingStreakRankings: { name: string; value: number; streaks: { rival: string; dateStr: string }[][] }[] = [];
    const gPlusAStreakRankings: { name: string; value: number; streaks: { rival: string; dateStr: string }[][] }[] = [];

    Object.entries(playerStreakMap).forEach(([pId, data]) => {
      const player = playerLookup[pId];
      if (!player) return;

      if (data.maxScoring >= 2) {
        scoringStreakRankings.push({ name: player.name, value: data.maxScoring, streaks: data.maxScoringStreaks });
      }
      if (data.maxAssisting >= 2) {
        assistingStreakRankings.push({ name: player.name, value: data.maxAssisting, streaks: data.maxAssistingStreaks });
      }
      if (data.maxGPlusA >= 2) {
        gPlusAStreakRankings.push({ name: player.name, value: data.maxGPlusA, streaks: data.maxGPlusAStreaks });
      }
    });

     // Sort by value descending, and secondary tie-breaker by streaks count descending
    scoringStreakRankings.sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return b.streaks.length - a.streaks.length;
    });
    assistingStreakRankings.sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return b.streaks.length - a.streaks.length;
    });
    gPlusAStreakRankings.sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return b.streaks.length - a.streaks.length;
    });


    // Project active leadership streaks to the end of the timeline
    const lastMatchDate = prevMatchDate as Date | null;
    if (lastMatchDate) {
      const seasonsList = seasons || [];
      const isLatestSeason = seasonsList.length > 0 && selectedSeasonId === seasonsList[seasonsList.length - 1].id;
      const isCurrentTimeline = selectedSeasonId === "all" || isLatestSeason;

      let endDate = lastMatchDate;
      if (isCurrentTimeline) {
        const today = new Date();
        if (today > lastMatchDate) {
          endDate = today;
        }
      }

      const daysElapsed = Math.round((endDate.getTime() - lastMatchDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysElapsed > 0) {
        currentGoalLeaders.forEach(pId => {
          const activeList = goalStreaks[pId];
          if (activeList && activeList.length > 0) {
            const active = activeList[activeList.length - 1];
            if (active && active.end === null) {
              active.days += daysElapsed;
            }
          }
        });
        currentAssistLeaders.forEach(pId => {
          const activeList = assistStreaks[pId];
          if (activeList && activeList.length > 0) {
            const active = activeList[activeList.length - 1];
            if (active && active.end === null) {
              active.days += daysElapsed;
            }
          }
        });
        currentGPlusALeaders.forEach(pId => {
          const activeList = gPlusAStreaks[pId];
          if (activeList && activeList.length > 0) {
            const active = activeList[activeList.length - 1];
            if (active && active.end === null) {
              active.days += daysElapsed;
            }
          }
        });
      }
    }

    // Function to compile leadership days rankings
    const compileDaysRankings = (
      streaksMap: Record<string, LeadershipStreak[]>
    ) => {
      const rankings: {
        name: string;
        value: number; // max days
        isActive: boolean;
        streaks: { startStr: string; endStr: string; days: number; isActive: boolean }[];
      }[] = [];

      Object.entries(streaksMap).forEach(([pId, list]) => {
        const player = playerLookup[pId];
        if (!player || list.length === 0) return;

        let maxDays = 0;
        list.forEach(s => {
          if (s.days > maxDays) maxDays = s.days;
        });

        if (maxDays > 0) {
          // Sort all streaks of this player by days descending
          const sortedPlayerStreaks = [...list].sort((a, b) => b.days - a.days);
          const hasActiveMax = list.some(s => s.days === maxDays && s.isActive);

          const formattedStreaks = sortedPlayerStreaks.map(s => ({
            startStr: formatDate(s.start),
            endStr: s.end ? formatDate(s.end) : "Presente",
            days: s.days,
            isActive: s.isActive
          }));

          rankings.push({
            name: player.name,
            value: maxDays,
            isActive: hasActiveMax,
            streaks: formattedStreaks
          });
        }
      });

      // Sort by value (max days) descending, and then streaks count descending
      rankings.sort((a, b) => {
        if (b.value !== a.value) return b.value - a.value;
        return b.streaks.length - a.streaks.length;
      });

      return rankings;
    };

    const daysLeaderPichichi = compileDaysRankings(goalStreaks);
    const daysLeaderAssists = compileDaysRankings(assistStreaks);
    const daysLeaderGPlusA = compileDaysRankings(gPlusAStreaks);

    return {
      maxGoalsInMatch: { value: globalMaxGoals, holders: globalMaxGoalsHolders },
      maxAssistsInMatch: { value: globalMaxAssists, holders: globalMaxAssistsHolders },
      scoringStreakRankings,
      assistingStreakRankings,
      gPlusAStreakRankings,
      hatTricks: hatTricksList,
      minTwoGoalsPerformances,
      
      // Colectivos
      maxMargin: { value: maxMargin, matches: maxMarginMatches },
      maxTotalGoals: { value: maxTotalGoals, matches: maxTotalGoalsMatches },
      maxUnbeaten: { value: maxUnbeaten, matches: maxUnbeatenMatches },
      maxWinning: { value: maxWinning, matches: maxWinningMatches },
      maxCleanSheets: { value: maxCleanSheets, matches: maxCleanSheetsMatches },

      // Individuales
      maxPenaltyGoals: { value: maxPenaltyGoals, holders: maxPenaltyGoalsHolders },
      maxFreekickGoals: { value: maxFreekickGoals, holders: maxFreekickGoalsHolders },
      maxPenaltySaves: { value: maxPenaltySaves, holders: maxPenaltySavesHolders },
      maxWoodworkHits: { value: maxWoodworkHits, holders: maxWoodworkHitsHolders },
      maxGPlusAInMatch: { value: maxGPlusAInMatch, holders: maxGPlusAInMatchHolders },
      maxAppearances: { value: maxAppearances, holders: maxAppearancesHolders },

      // Días líder
      daysLeaderPichichi,
      daysLeaderAssists,
      daysLeaderGPlusA
    };
  }, [matches, players, seasons, selectedSeasonId]);

  // Convert player stats map to array lists for leaderboards
  const playerStatsList = Object.values(playerStatsMap);

  const scorers = playerStatsList.map(p => ({
    playerId: p.playerId, name: p.name, shirtName: p.shirtName, number: p.number, value: p.goals
  }));

  const assistants = playerStatsList.map(p => ({
    playerId: p.playerId, name: p.name, shirtName: p.shirtName, number: p.number, value: p.assists
  }));

  const yellowCards = playerStatsList.map(p => ({
    playerId: p.playerId, name: p.name, shirtName: p.shirtName, number: p.number, value: p.yellowCards
  }));

  const woodwork = playerStatsList.map(p => ({
    playerId: p.playerId, name: p.name, shirtName: p.shirtName, number: p.number, value: p.woodwork
  }));

  const gPlusA = playerStatsList.map(p => ({
    playerId: p.playerId, name: p.name, shirtName: p.shirtName, number: p.number, value: p.goals + p.assists
  }));

  const currentSeasonName = selectedSeasonId === "all"
    ? "Histórico Total"
    : seasons.find(s => s.id === selectedSeasonId)?.name || "Temporada";

  const goalDiff = teamStats.goalsFor - teamStats.goalsAgainst;

  const getLeaders = <T extends { value: number; streaks: unknown[] }>(rankings: T[]): T[] => {
    if (rankings.length === 0) return [];
    const topVal = rankings[0].value;
    const topCount = rankings[0].streaks.length;
    return rankings.filter(r => r.value === topVal && r.streaks.length === topCount);
  };

  const renderCompareView = () => {
    if (players.length === 0) {
      return (
        <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: "3rem" }}>
          No hay jugadores registrados en la temporada actual.
        </div>
      );
    }

    const playerA = playerStatsMap[playerAId];
    const playerB = playerStatsMap[playerBId];

    let maxGoals = 1;
    let maxAssists = 1;
    let maxGPlusA = 1;
    Object.values(playerStatsMap).forEach(p => {
      if (p.goals > maxGoals) maxGoals = p.goals;
      if (p.assists > maxAssists) maxAssists = p.assists;
      const ga = p.goals + p.assists;
      if (ga > maxGPlusA) maxGPlusA = ga;
    });

    const totalMatches = teamStats.played || 1;

    const getRadarScores = (p: PlayerAccumulatedStats | undefined) => {
      if (!p) return [0, 0, 0, 0, 0, 0];
      
      const goalsScore = Math.min(100, (p.goals / maxGoals) * 100);
      const assistsScore = Math.min(100, (p.assists / maxAssists) * 100);
      const gaScore = Math.min(100, ((p.goals + p.assists) / maxGPlusA) * 100);
      const presenceScore = Math.min(100, (p.matchesPlayed / totalMatches) * 100);
      
      const cardPenalty = p.yellowCards * 15 + p.doubleYellows * 35 + p.redCards * 55;
      const disciplineScore = Math.max(10, 100 - cardPenalty);
      
      const specPoints = p.goalFreekick * 25 + p.goalPenalty * 15 + p.penaltySaved * 35 + p.woodwork * 15;
      const specialistScore = Math.min(100, 15 + specPoints);

      return [goalsScore, assistsScore, gaScore, presenceScore, disciplineScore, specialistScore];
    };

    const scoresA = getRadarScores(playerA);
    const scoresB = getRadarScores(playerB);

    const svgCenter = { x: 200, y: 180 };
    const maxRadius = 110;
    const vertexCount = 6;
    const vertexLabels = [
      "Goleador",
      "Asistente",
      "Participación (G+A)",
      "Presencia (PJ)",
      "Disciplina",
      "Especialista"
    ];

    const getVertexCoords = (index: number, val: number) => {
      const angle = (index * 2 * Math.PI) / vertexCount - Math.PI / 2;
      const r = (val / 100) * maxRadius;
      return {
        x: svgCenter.x + r * Math.cos(angle),
        y: svgCenter.y + r * Math.sin(angle)
      };
    };

    const pointsA = scoresA.map((score, i) => {
      const coords = getVertexCoords(i, score);
      return `${coords.x},${coords.y}`;
    }).join(" ");

    const pointsB = scoresB.map((score, i) => {
      const coords = getVertexCoords(i, score);
      return `${coords.x},${coords.y}`;
    }).join(" ");

    const getLabelCoords = (index: number) => {
      const angle = (index * 2 * Math.PI) / vertexCount - Math.PI / 2;
      const r = maxRadius + 22;
      return {
        x: svgCenter.x + r * Math.cos(angle),
        y: svgCenter.y + r * Math.sin(angle)
      };
    };

    const renderCompareRow = (
      label: string,
      valA: number,
      valB: number,
      formatType?: "integer" | "decimal" | "percentage",
      lowerIsBetter: boolean = false
    ) => {
      const isWinnerA = lowerIsBetter ? valA < valB : valA > valB;
      const isWinnerB = lowerIsBetter ? valB < valA : valB > valA;
      const isDraw = valA === valB;

      const displayA = formatType === "percentage" ? `${valA.toFixed(0)}%` : formatType === "decimal" ? valA.toFixed(2) : valA;
      const displayB = formatType === "percentage" ? `${valB.toFixed(0)}%` : formatType === "decimal" ? valB.toFixed(2) : valB;

      const winnerStyle = {
        fontWeight: 800,
        color: "var(--accent-emerald)",
        textShadow: "0 0 10px rgba(16, 185, 129, 0.3)"
      };

      const regularStyle = {
        fontWeight: 500,
        color: "var(--text-primary)"
      };

      const loserStyle = {
        fontWeight: 400,
        color: "var(--text-secondary)"
      };

      return (
        <tr key={label} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
          <td style={{
            fontSize: "0.95rem",
            padding: "0.75rem 0.5rem",
            textAlign: "center",
            width: "35%",
            ...(isWinnerA ? winnerStyle : isDraw ? regularStyle : loserStyle)
          }}>
            {displayA}
            {isWinnerA && <span style={{ marginLeft: "0.25rem", color: "var(--accent-gold)", fontSize: "0.8rem" }}>★</span>}
          </td>
          <td style={{
            textAlign: "center",
            fontSize: "0.85rem",
            color: "var(--text-muted)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "0.75rem 0.25rem",
            width: "30%"
          }}>
            {label}
          </td>
          <td style={{
            fontSize: "0.95rem",
            padding: "0.75rem 0.5rem",
            textAlign: "center",
            width: "35%",
            ...(isWinnerB ? winnerStyle : isDraw ? regularStyle : loserStyle)
          }}>
            {isWinnerB && <span style={{ marginRight: "0.25rem", color: "var(--accent-gold)", fontSize: "0.8rem" }}>★</span>}
            {displayB}
          </td>
        </tr>
      );
    };

    return (
      <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <div className="card" style={{ padding: "1.5rem", background: "rgba(15, 23, 42, 0.45)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1.5rem", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent-gold)", textTransform: "uppercase" }}>
                Jugador A
              </label>
              <Select value={playerAId} onValueChange={setPlayerAId}>
                <SelectTrigger className="w-full font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {players.map(p => (
                    <SelectItem key={p.id} value={p.id} disabled={p.id === playerBId}>
                      {formatPlayerName(p.firstName, p.lastName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div style={{ textAlign: "center", display: "flex", justifyContent: "center", alignSelf: "flex-end", marginBottom: "3px" }}>
              <div style={{
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent-gold), var(--accent-cyan))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: "0.85rem",
                color: "#0f172a",
                boxShadow: "0 0 15px rgba(6, 182, 212, 0.4)"
              }}>
                VS
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent-cyan)", textTransform: "uppercase" }}>
                Jugador B
              </label>
              <Select value={playerBId} onValueChange={setPlayerBId}>
                <SelectTrigger className="w-full font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {players.map(p => (
                    <SelectItem key={p.id} value={p.id} disabled={p.id === playerAId}>
                      {formatPlayerName(p.firstName, p.lastName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem" }}>
          <div className="card" style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            background: "rgba(15, 23, 42, 0.3)"
          }}>
            <div style={{ display: "flex", width: "100%", justifyContent: "space-around", alignItems: "center", gap: "1rem" }}>
              {playerA && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", textAlign: "center" }}>
                  <Jersey name={playerA.shirtName} number={playerA.number} size="lg" />
                  <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--accent-gold)" }}>
                    {playerA.name}
                  </span>
                </div>
              )}

              {playerB && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", textAlign: "center" }}>
                  <Jersey name={playerB.shirtName} number={playerB.number} size="lg" />
                  <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                    {playerB.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            background: "rgba(15, 23, 42, 0.35)",
            borderColor: "rgba(255,255,255,0.06)"
          }}>
            <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "1rem", textTransform: "uppercase" }}>
              Mapa de Habilidades
            </h4>
            
            <div style={{ width: "100%", maxWidth: "360px", aspectRatio: "1" }}>
              <svg viewBox="0 0 400 360" width="100%" height="100%">
                <defs>
                  <filter id="radarGlowA" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.4" />
                  </filter>
                  <filter id="radarGlowB" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#06b6d4" floodOpacity="0.4" />
                  </filter>
                </defs>

                {[25, 50, 75, 100].map((level, lIdx) => {
                  const pointsStr = Array.from({ length: vertexCount }).map((_, i) => {
                    const coords = getVertexCoords(i, level);
                    return `${coords.x},${coords.y}`;
                  }).join(" ");

                  return (
                    <polygon
                      key={lIdx}
                      points={pointsStr}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.07)"
                      strokeWidth="1"
                      strokeDasharray={level === 100 ? "0" : "3,3"}
                    />
                  );
                })}

                {Array.from({ length: vertexCount }).map((_, i) => {
                  const outerCoords = getVertexCoords(i, 100);
                  return (
                    <line
                      key={i}
                      x1={svgCenter.x}
                      y1={svgCenter.y}
                      x2={outerCoords.x}
                      y2={outerCoords.y}
                      stroke="rgba(255, 255, 255, 0.08)"
                      strokeWidth="1"
                    />
                  );
                })}

                {pointsA && (
                  <polygon
                    points={pointsA}
                    fill="rgba(245, 158, 11, 0.18)"
                    stroke="var(--accent-gold)"
                    strokeWidth="2.5"
                    filter="url(#radarGlowA)"
                  />
                )}

                {pointsB && (
                  <polygon
                    points={pointsB}
                    fill="rgba(6, 182, 212, 0.18)"
                    stroke="var(--accent-cyan)"
                    strokeWidth="2.5"
                    filter="url(#radarGlowB)"
                  />
                )}

                {vertexLabels.map((lbl, i) => {
                  const coords = getVertexCoords(i, 100);
                  const labelCoords = getLabelCoords(i);
                  
                  let textAnchor: "inherit" | "end" | "start" | "middle" | undefined = "middle";
                  let dy = "0.35em";
                  if (i === 0) { textAnchor = "middle"; dy = "-0.5em"; }
                  else if (i === 3) { textAnchor = "middle"; dy = "1.2em"; }
                  else if (i === 1 || i === 2) { textAnchor = "start"; }
                  else if (i === 4 || i === 5) { textAnchor = "end"; }

                  return (
                    <g key={i}>
                      <circle cx={coords.x} cy={coords.y} r="2.5" fill="rgba(255,255,255,0.2)" />
                      <text
                        x={labelCoords.x}
                        y={labelCoords.y}
                        fill="var(--text-secondary)"
                        fontSize="10"
                        fontWeight="700"
                        textAnchor={textAnchor}
                        dy={dy}
                        style={{ fontFamily: "'Outfit', sans-serif" }}
                      >
                        {lbl}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-gold)" }}>
                <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "3px", background: "var(--accent-gold)" }}></span>
                {playerA?.name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-cyan)" }}>
                <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "3px", background: "var(--accent-cyan)" }}></span>
                {playerB?.name}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: "1.5rem", background: "rgba(15, 23, 42, 0.45)" }}>
          <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff", marginBottom: "1rem", textAlign: "center" }}>
            Estadísticas Comparativas ({currentSeasonName})
          </h4>

          {playerA && playerB ? (
            <div className="table-container" style={{ overflowX: "visible" }}>
              <table className="custom-table" style={{ width: "100%", tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid rgba(255,255,255,0.1)" }}>
                    <th style={{ textAlign: "center", color: "var(--accent-gold)", width: "35%", fontSize: "0.95rem" }}>{playerA.name}</th>
                    <th style={{ textAlign: "center", color: "var(--text-muted)", width: "30%", fontSize: "0.8rem" }}>Métrica</th>
                    <th style={{ textAlign: "center", color: "var(--accent-cyan)", width: "35%", fontSize: "0.95rem" }}>{playerB.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {renderCompareRow("Partidos Jugados", playerA.matchesPlayed, playerB.matchesPlayed)}
                  {renderCompareRow("Goles Totales", playerA.goals, playerB.goals)}
                  {renderCompareRow("Asistencias", playerA.assists, playerB.assists)}
                  {renderCompareRow("G+A Sumado", playerA.goals + playerA.assists, playerB.goals + playerB.assists)}
                  {renderCompareRow("Goles/Partido", playerA.matchesPlayed > 0 ? playerA.goals / playerA.matchesPlayed : 0, playerB.matchesPlayed > 0 ? playerB.goals / playerB.matchesPlayed : 0, "decimal")}
                  {renderCompareRow("Asistencias/Partido", playerA.matchesPlayed > 0 ? playerA.assists / playerA.matchesPlayed : 0, playerB.matchesPlayed > 0 ? playerB.assists / playerB.matchesPlayed : 0, "decimal")}
                  {renderCompareRow("G+A/Partido", playerA.matchesPlayed > 0 ? (playerA.goals + playerA.assists) / playerA.matchesPlayed : 0, playerB.matchesPlayed > 0 ? (playerB.goals + playerB.assists) / playerB.matchesPlayed : 0, "decimal")}
                  {renderCompareRow("Goles de Falta", playerA.goalFreekick, playerB.goalFreekick)}
                  {renderCompareRow("Goles de Penalti", playerA.goalPenalty, playerB.goalPenalty)}
                  {renderCompareRow("Penaltis Parados", playerA.penaltySaved, playerB.penaltySaved)}
                  {renderCompareRow("Penaltis Fallados", playerA.penaltyMissed, playerB.penaltyMissed, "integer", true)}
                  {renderCompareRow("Remates al Palo", playerA.woodwork, playerB.woodwork)}
                  {renderCompareRow("Tarjetas Amarillas", playerA.yellowCards, playerB.yellowCards, "integer", true)}
                  {renderCompareRow("Dobles Amarillas", playerA.doubleYellows, playerB.doubleYellows, "integer", true)}
                  {renderCompareRow("Tarjetas Rojas", playerA.redCards, playerB.redCards, "integer", true)}
                  {renderCompareRow("Autogoles", playerA.ownGoals, playerB.ownGoals, "integer", true)}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", padding: "1rem" }}>
              Por favor, selecciona dos jugadores válidos.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Title block */}
      <div style={{ paddingBottom: "0.5rem" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, textTransform: "uppercase", fontSize: "clamp(2.2rem, 6vw, 3.4rem)", lineHeight: 0.9, letterSpacing: "0.01em", color: "var(--text-primary)" }}>
          Estadísticas
        </h2>
        <span style={{ display: "block", width: "84px", height: "6px", background: "var(--accent-cyan)", margin: "0.9rem 0 0.75rem" }} />
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          Histórico y récords de <strong>{currentSeasonName}</strong>
        </p>
      </div>

      {/* Tabs Selector */}
      <div style={{ display: "flex", gap: "1rem", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "0.5rem", marginTop: "-1rem" }}>
        <button
          onClick={() => setActiveTab("general")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "general" ? "2px solid var(--accent-cyan)" : "2px solid transparent",
            color: activeTab === "general" ? "var(--text-primary)" : "var(--text-secondary)",
            padding: "0.5rem 1.25rem",
            fontWeight: 700,
            fontSize: "0.95rem",
            cursor: "pointer",
            transition: "var(--transition-smooth)"
          }}
        >
          Resumen y Récords
        </button>
        <button
          onClick={() => setActiveTab("compare")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "compare" ? "2px solid var(--accent-cyan)" : "2px solid transparent",
            color: activeTab === "compare" ? "var(--text-primary)" : "var(--text-secondary)",
            padding: "0.5rem 1.25rem",
            fontWeight: 700,
            fontSize: "0.95rem",
            cursor: "pointer",
            transition: "var(--transition-smooth)"
          }}
        >
          Comparador Cara a Cara
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem" }}>
          <div style={{
            width: "2.5rem",
            height: "2.5rem",
            border: "4px solid rgba(108, 171, 221, 0.1)",
            borderTopColor: "var(--accent-cyan)",
            borderRadius: "50%",
            animation: "spin 1.5s infinite linear",
            margin: "0 auto 1rem"
          }}></div>
          <p style={{ color: "var(--text-secondary)" }}>Calculando estadísticas...</p>
        </div>
      ) : activeTab === "general" ? (
        <>
          {/* TEAM STATS WIDGETS */}
          <div>
            <section style={{ position: "relative", overflow: "hidden", background: "#0c1733", border: "1px solid rgba(108,171,221,0.18)", borderRadius: "8px", padding: "clamp(1.75rem, 5vw, 3rem)", marginBottom: "1.5rem" }}>
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(rgba(108,171,221,0.16) 1px, transparent 1.5px)", backgroundSize: "22px 22px", opacity: 0.5, WebkitMaskImage: "linear-gradient(120deg, #000, transparent 60%)", maskImage: "linear-gradient(120deg, #000, transparent 60%)" }} />
              <div style={{ position: "relative", zIndex: 1, display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "2rem" }}>
                <div>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--accent-cyan)" }}>
                    <Shield size={16} /> Rendimiento &middot; {currentSeasonName}
                  </span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginTop: "0.85rem" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "clamp(4rem, 13vw, 7rem)", lineHeight: 0.76, color: "var(--accent-cyan)" }}>{teamStats.points}</span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", color: "#9fb6d6" }}>PTS</span>
                  </div>
                  <span style={{ display: "block", marginTop: "0.5rem", fontSize: "0.85rem", color: "#9fb6d6" }}>
                    {teamStats.played} partidos &middot; {teamStats.played > 0 ? Math.round(((teamStats.wins * 3 + teamStats.draws) / (teamStats.played * 3)) * 100) : 0}% efectividad
                  </span>
                </div>
                <div style={{ display: "flex", gap: "clamp(1rem, 3vw, 2.25rem)", flexWrap: "wrap" }}>
                  {[
                    { k: "Ganados", v: `${teamStats.wins}`, c: "var(--accent-cyan)" },
                    { k: "Empat.", v: `${teamStats.draws}`, c: "var(--accent-gold)" },
                    { k: "Perd.", v: `${teamStats.losses}`, c: "var(--accent-red)" },
                    { k: "GF", v: `${teamStats.goalsFor}`, c: "#ffffff" },
                    { k: "GC", v: `${teamStats.goalsAgainst}`, c: "#ffffff" },
                    { k: "Dif.", v: goalDiff > 0 ? `+${goalDiff}` : `${goalDiff}`, c: goalDiff > 0 ? "var(--accent-cyan)" : goalDiff < 0 ? "var(--accent-red)" : "#9fb6d6" },
                  ].map((s) => (
                    <div key={s.k} style={{ minWidth: "3rem" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 4vw, 2.6rem)", lineHeight: 0.9, color: s.c }}>{s.v}</div>
                      <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9fb6d6", marginTop: "0.35rem" }}>{s.k}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* HEAD-TO-HEAD BALANCES */}
          {Object.keys(rivalRecords).length > 0 && (
            <div className="card">
              <SectionHead title="Balance vs Rivales" sub="El cara a cara contra cada equipo al que nos hemos enfrentado." />
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rival</TableHead>
                      <TableHead className="text-center">PJ</TableHead>
                      <TableHead className="text-center">V</TableHead>
                      <TableHead className="text-center">E</TableHead>
                      <TableHead className="text-center">D</TableHead>
                      <TableHead className="text-center">GF</TableHead>
                      <TableHead className="text-center">GC</TableHead>
                      <TableHead className="text-center">DIF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(rivalRecords).sort((a, b) => {
                      if (b.wins !== a.wins) return b.wins - a.wins;
                      if (b.draws !== a.draws) return b.draws - a.draws;
                      if (a.losses !== b.losses) return a.losses - b.losses;
                      const diffA = a.goalsFor - a.goalsAgainst;
                      const diffB = b.goalsFor - b.goalsAgainst;
                      if (diffB !== diffA) return diffB - diffA;
                      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
                      return a.goalsAgainst - b.goalsAgainst;
                    }).map((record) => {
                      const diff = record.goalsFor - record.goalsAgainst;
                      return (
                        <TableRow
                          key={record.rival}
                          onClick={() => setActiveRivalInfo(record.rival)}
                          className="cursor-pointer"
                        >
                          <TableCell className="font-bold">{record.rival}</TableCell>
                          <TableCell className="text-center">{record.played}</TableCell>
                          <TableCell className="text-center" style={{ color: "var(--accent-emerald)" }}>{record.wins}</TableCell>
                          <TableCell className="text-center" style={{ color: "var(--accent-gold)" }}>{record.draws}</TableCell>
                          <TableCell className="text-center" style={{ color: "var(--accent-red)" }}>{record.losses}</TableCell>
                          <TableCell className="text-center">{record.goalsFor}</TableCell>
                          <TableCell className="text-center">{record.goalsAgainst}</TableCell>
                          <TableCell
                            className="text-center font-bold"
                            style={{ color: diff > 0 ? "var(--accent-emerald)" : diff < 0 ? "var(--accent-red)" : "var(--text-primary)" }}
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* HITOS Y RÉCORDS DE LA TEMPORADA */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
            <SectionHead title="Hitos y Récords" sub="Logros colectivos e individuales y las rachas que han marcado la historia del club." rule="var(--accent-gold)" />

            {/* SECCIÓN COLECTIVA (RÉCORDS DEL EQUIPO) */}
            <div>
              <SubHead title="Récords del equipo" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
                
                {/* Mayor Goleada */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(108, 171, 221, 0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Trophy size={16} style={{ color: "var(--accent-emerald)" }} />
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Mayor Goleada A Favor
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("maxMargin")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.maxMargin.value > 0 ? (
                    <div>
                      <h5 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2rem", letterSpacing: "0.01em", color: "var(--accent-emerald)", margin: "0.2rem 0" }}>
                        +{records.maxMargin.value} gol{records.maxMargin.value > 1 ? "es" : ""} de dif.
                      </h5>
                      {records.maxMargin.matches.length > 0 && (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: 600 }}>
                          {records.maxMargin.matches[0].score} vs {records.maxMargin.matches[0].rival}
                          {records.maxMargin.matches.length > 1 && (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "0.25rem" }}>
                              (+ {records.maxMargin.matches.length - 1} más)
                            </span>
                          )}
                          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: 400 }}>
                            Fecha: {records.maxMargin.matches[0].dateStr}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin victorias registradas</span>
                  )}
                </div>

                {/* Festival del Gol */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(28, 44, 91, 0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Sparkles size={16} style={{ color: "var(--accent-gold)" }} />
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Festival del Gol (Más Goles)
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("maxTotalGoals")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.maxTotalGoals.value > 0 ? (
                    <div>
                      <h5 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2rem", letterSpacing: "0.01em", color: "var(--accent-gold)", margin: "0.2rem 0" }}>
                        {records.maxTotalGoals.value} goles en total
                      </h5>
                      {records.maxTotalGoals.matches.length > 0 && (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: 600 }}>
                          {records.maxTotalGoals.matches[0].score} vs {records.maxTotalGoals.matches[0].rival}
                          {records.maxTotalGoals.matches.length > 1 && (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "0.25rem" }}>
                              (+ {records.maxTotalGoals.matches.length - 1} más)
                            </span>
                          )}
                          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: 400 }}>
                            Fecha: {records.maxTotalGoals.matches[0].dateStr}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin partidos con goles</span>
                  )}
                </div>

                {/* Racha Invicta */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(108, 171, 221, 0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Shield size={16} style={{ color: "var(--accent-cyan)" }} />
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Racha Invicta
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("maxUnbeaten")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.maxUnbeaten.value > 0 ? (
                    <div>
                      <h5 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2rem", letterSpacing: "0.01em", color: "var(--accent-cyan)", margin: "0.2rem 0" }}>
                        {records.maxUnbeaten.value} partido{records.maxUnbeaten.value > 1 ? "s" : ""}
                      </h5>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        del {records.maxUnbeaten.matches[0].dateStr} (vs {records.maxUnbeaten.matches[0].rival}) al {records.maxUnbeaten.matches[records.maxUnbeaten.matches.length - 1].dateStr} (vs {records.maxUnbeaten.matches[records.maxUnbeaten.matches.length - 1].rival})
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin racha invicta</span>
                  )}
                </div>

                {/* Racha de Victorias */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(255, 198, 89, 0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Flame size={16} style={{ color: "var(--accent-gold)" }} />
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Racha de Victorias
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("maxWinning")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.maxWinning.value > 0 ? (
                    <div>
                      <h5 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2rem", letterSpacing: "0.01em", color: "var(--accent-gold)", margin: "0.2rem 0" }}>
                        {records.maxWinning.value} victoria{records.maxWinning.value > 1 ? "s" : ""}
                      </h5>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        del {records.maxWinning.matches[0].dateStr} (vs {records.maxWinning.matches[0].rival}) al {records.maxWinning.matches[records.maxWinning.matches.length - 1].dateStr} (vs {records.maxWinning.matches[records.maxWinning.matches.length - 1].rival})
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin victorias consecutivas</span>
                  )}
                </div>

                {/* Porterías a Cero Consecutivas */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(108, 171, 221, 0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Zap size={16} style={{ color: "var(--accent-cyan-light)" }} />
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Porterías a Cero Seguidas
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("maxCleanSheets")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.maxCleanSheets.value > 0 ? (
                    <div>
                      <h5 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2rem", letterSpacing: "0.01em", color: "var(--accent-cyan-light)", margin: "0.2rem 0" }}>
                        {records.maxCleanSheets.value} partido{records.maxCleanSheets.value > 1 ? "s" : ""}
                      </h5>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        del {records.maxCleanSheets.matches[0].dateStr} (vs {records.maxCleanSheets.matches[0].rival}) al {records.maxCleanSheets.matches[records.maxCleanSheets.matches.length - 1].dateStr} (vs {records.maxCleanSheets.matches[records.maxCleanSheets.matches.length - 1].rival})
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin porterías a cero</span>
                  )}
                </div>

              </div>
            </div>

            {/* SECCIÓN INDIVIDUAL (RÉCORDS INDIVIDUALES) */}
            <div>
              <SubHead title="Récords individuales" rule="var(--accent-gold)" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>

                {/* Más Goles en un Partido */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(255, 198, 89, 0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Award size={16} style={{ color: "var(--accent-gold)" }} />
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Más Goles en un Partido
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("maxGoalsInMatch")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.maxGoalsInMatch.value > 0 ? (
                    <div>
                      <h5 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2rem", letterSpacing: "0.01em", color: "var(--accent-gold)", margin: "0.2rem 0" }}>
                        {records.maxGoalsInMatch.value} gol{records.maxGoalsInMatch.value > 1 ? "es" : ""}
                      </h5>
                      {records.maxGoalsInMatch.holders.length > 0 && (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: 600 }}>
                          {records.maxGoalsInMatch.holders[0].name}
                          {records.maxGoalsInMatch.holders.length > 1 && (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "0.25rem" }}>
                              (+ {records.maxGoalsInMatch.holders.length - 1} más)
                            </span>
                          )}
                          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: 400 }}>
                            vs {records.maxGoalsInMatch.holders[0].rival} ({records.maxGoalsInMatch.holders[0].dateStr})
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin goles</span>
                  )}
                </div>

                {/* Más Asistencias en un Partido */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(108, 171, 221, 0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Award size={16} style={{ color: "var(--accent-cyan)" }} />
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Más Asistencias en un Partido
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("maxAssistsInMatch")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.maxAssistsInMatch.value > 0 ? (
                    <div>
                      <h5 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2rem", letterSpacing: "0.01em", color: "var(--accent-cyan)", margin: "0.2rem 0" }}>
                        {records.maxAssistsInMatch.value} asistencia{records.maxAssistsInMatch.value > 1 ? "s" : ""}
                      </h5>
                      {records.maxAssistsInMatch.holders.length > 0 && (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: 600 }}>
                          {records.maxAssistsInMatch.holders[0].name}
                          {records.maxAssistsInMatch.holders.length > 1 && (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "0.25rem" }}>
                              (+ {records.maxAssistsInMatch.holders.length - 1} más)
                            </span>
                          )}
                          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: 400 }}>
                            vs {records.maxAssistsInMatch.holders[0].rival} ({records.maxAssistsInMatch.holders[0].dateStr})
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin asistencias</span>
                  )}
                </div>

                {/* Máxima Participación en un Partido (G+A) */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(28, 44, 91, 0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Sparkles size={16} style={{ color: "var(--accent-gold)" }} />
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Máxima Participación de Gol (G+A) EN UN PARTIDO
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("maxGPlusAInMatch")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.maxGPlusAInMatch.value > 0 ? (
                    <div>
                      <h5 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2rem", letterSpacing: "0.01em", color: "var(--accent-gold)", margin: "0.2rem 0" }}>
                        {records.maxGPlusAInMatch.value} G+A
                      </h5>
                      {records.maxGPlusAInMatch.holders.length > 0 && (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: 600 }}>
                          {records.maxGPlusAInMatch.holders[0].name}
                          <span style={{ fontSize: "0.75rem", color: "var(--accent-gold)", fontWeight: 700, marginLeft: "0.25rem" }}>
                            ({records.maxGPlusAInMatch.holders[0].goals} G + {records.maxGPlusAInMatch.holders[0].assists} A)
                          </span>
                          {records.maxGPlusAInMatch.holders.length > 1 && (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "0.25rem" }}>
                              (+ {records.maxGPlusAInMatch.holders.length - 1} más)
                            </span>
                          )}
                          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: 400, marginTop: "0.1rem" }}>
                            vs {records.maxGPlusAInMatch.holders[0].rival} ({records.maxGPlusAInMatch.holders[0].dateStr})
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin participaciones</span>
                  )}
                </div>

                {/* Especialista desde los 11 Metros */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(196, 47, 35, 0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Target size={16} style={{ color: "var(--accent-red)" }} />
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Especialista desde los 11 Metros
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("maxPenaltyGoals")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.maxPenaltyGoals.value > 0 ? (
                    <div>
                      <h5 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2rem", letterSpacing: "0.01em", color: "var(--accent-red)", margin: "0.2rem 0" }}>
                        {records.maxPenaltyGoals.value} gol{records.maxPenaltyGoals.value > 1 ? "es" : ""}
                      </h5>
                      {records.maxPenaltyGoals.holders.length > 0 && (
                        <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 600 }}>
                          {records.maxPenaltyGoals.holders[0].name}
                          {records.maxPenaltyGoals.holders.length > 1 && (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "0.25rem" }}>
                              (+ {records.maxPenaltyGoals.holders.length - 1} más)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin goles de penalti</span>
                  )}
                </div>

                {/* Especialista de Falta Directa */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(108, 171, 221, 0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Target size={16} style={{ color: "var(--accent-emerald)" }} />
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Especialista de Falta Directa
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("maxFreekickGoals")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.maxFreekickGoals.value > 0 ? (
                    <div>
                      <h5 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2rem", letterSpacing: "0.01em", color: "var(--accent-emerald)", margin: "0.2rem 0" }}>
                        {records.maxFreekickGoals.value} gol{records.maxFreekickGoals.value > 1 ? "es" : ""}
                      </h5>
                      {records.maxFreekickGoals.holders.length > 0 && (
                        <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 600 }}>
                          {records.maxFreekickGoals.holders[0].name}
                          {records.maxFreekickGoals.holders.length > 1 && (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "0.25rem" }}>
                              (+ {records.maxFreekickGoals.holders.length - 1} más)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin goles de falta</span>
                  )}
                </div>

                {/* El Parapenaltis */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(108, 171, 221, 0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Shield size={16} style={{ color: "var(--accent-cyan)" }} />
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        El Parapenaltis
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("maxPenaltySaves")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.maxPenaltySaves.value > 0 ? (
                    <div>
                      <h5 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2rem", letterSpacing: "0.01em", color: "var(--accent-cyan)", margin: "0.2rem 0" }}>
                        {records.maxPenaltySaves.value} penalti{records.maxPenaltySaves.value > 1 ? "s" : ""} parado{records.maxPenaltySaves.value > 1 ? "s" : ""}
                      </h5>
                      {records.maxPenaltySaves.holders.length > 0 && (
                        <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 600 }}>
                          {records.maxPenaltySaves.holders[0].name}
                          {records.maxPenaltySaves.holders.length > 1 && (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "0.25rem" }}>
                              (+ {records.maxPenaltySaves.holders.length - 1} más)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin penaltis parados</span>
                  )}
                </div>

                {/* El Imán de los Postes (Temporada) */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(255, 198, 89, 0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Target size={16} style={{ color: "var(--accent-gold)" }} />
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        El Imán de los Postes
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("maxWoodworkHits")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.maxWoodworkHits.value > 0 ? (
                    <div>
                      <h5 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2rem", letterSpacing: "0.01em", color: "var(--accent-gold)", margin: "0.2rem 0" }}>
                        {records.maxWoodworkHits.value} tiro{records.maxWoodworkHits.value > 1 ? "s" : ""} al palo
                      </h5>
                      {records.maxWoodworkHits.holders.length > 0 && (
                        <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 600 }}>
                          {records.maxWoodworkHits.holders[0].name}
                          {records.maxWoodworkHits.holders.length > 1 && (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "0.25rem" }}>
                              (+ {records.maxWoodworkHits.holders.length - 1} más)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin tiros al palo</span>
                  )}
                </div>

                {/* Más Presencias */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(108, 171, 221, 0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Users size={16} style={{ color: "var(--accent-emerald)" }} />
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Más Presencias
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("maxAppearances")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.maxAppearances.value > 0 ? (
                    <div>
                      <h5 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2rem", letterSpacing: "0.01em", color: "var(--accent-emerald)", margin: "0.2rem 0" }}>
                        {records.maxAppearances.value} partido{records.maxAppearances.value > 1 ? "s" : ""}
                      </h5>
                      {records.maxAppearances.holders.length > 0 && (
                        <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 600 }}>
                          {records.maxAppearances.holders[0].name}
                          {records.maxAppearances.holders.length > 1 && (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "0.25rem" }}>
                              (+ {records.maxAppearances.holders.length - 1} más)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin partidos jugados</span>
                  )}
                </div>

              </div>
            </div>

            {/* SECCIÓN RACHAS Y HITOS (RANKINGS Y LISTAS) */}
            <div>
              <SubHead title="Rankings de rachas e hitos" />
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
                {/* Scoring Streak */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(196, 47, 35, 0.15)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Flame size={18} style={{ color: "var(--accent-red)" }} />
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Partidos Consecutivos Marcando
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("scoringStreak")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.scoringStreakRankings.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {(() => {
                        const leaders = getLeaders(records.scoringStreakRankings);
                        return (
                          <>
                            {leaders.map((holder, idx) => (
                              <div key={idx} style={{ fontSize: "0.85rem", color: "var(--text-primary)", borderBottom: idx < leaders.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", paddingBottom: idx < leaders.length - 1 ? "0.5rem" : "0" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700 }}>
                                  <span>{holder.name}</span>
                                  <span style={{ color: "var(--accent-red)", fontSize: "0.9rem" }}>
                                    {holder.value} part. <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--text-muted)" }}>({holder.streaks.length} {holder.streaks.length > 1 ? "veces" : "vez"})</span>
                                  </span>
                                </div>
                                {holder.streaks.map((streak: { rival: string; dateStr: string }[], sIdx: number) => (
                                  <div key={sIdx} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 400, marginTop: "0.25rem", paddingLeft: "0.5rem", borderLeft: "1px solid var(--border-color)" }}>
                                    Racha {holder.streaks.length > 1 ? `#${sIdx + 1}` : ""}: del <strong>{streak[0].dateStr}</strong> (vs {streak[0].rival}) al <strong>{streak[streak.length - 1].dateStr}</strong> (vs {streak[streak.length - 1].rival})
                                  </div>
                                ))}
                              </div>
                            ))}
                            {records.scoringStreakRankings.length > leaders.length && (
                              <div
                                onClick={() => setActiveRecordInfo("scoringStreak")}
                                style={{ fontSize: "0.75rem", color: "var(--text-muted)", cursor: "pointer", transition: "var(--transition-smooth)", marginTop: "0.25rem" }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                              >
                                + {records.scoringStreakRankings.length - leaders.length} jugador{records.scoringStreakRankings.length - leaders.length > 1 ? "es" : ""} más
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin registros (mínimo 2 part.)</span>
                  )}
                </div>

                {/* Assisting Streak */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(108, 171, 221, 0.15)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Zap size={18} style={{ color: "var(--accent-emerald)" }} />
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Partidos Consecutivos Asistiendo
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("assistingStreak")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.assistingStreakRankings.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {(() => {
                        const leaders = getLeaders(records.assistingStreakRankings);
                        return (
                          <>
                            {leaders.map((holder, idx) => (
                              <div key={idx} style={{ fontSize: "0.85rem", color: "var(--text-primary)", borderBottom: idx < leaders.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", paddingBottom: idx < leaders.length - 1 ? "0.5rem" : "0" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700 }}>
                                  <span>{holder.name}</span>
                                  <span style={{ color: "var(--accent-emerald)", fontSize: "0.9rem" }}>
                                    {holder.value} part. <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--text-muted)" }}>({holder.streaks.length} {holder.streaks.length > 1 ? "veces" : "vez"})</span>
                                  </span>
                                </div>
                                {holder.streaks.map((streak: { rival: string; dateStr: string }[], sIdx: number) => (
                                  <div key={sIdx} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 400, marginTop: "0.25rem", paddingLeft: "0.5rem", borderLeft: "1px solid var(--border-color)" }}>
                                    Racha {holder.streaks.length > 1 ? `#${sIdx + 1}` : ""}: del <strong>{streak[0].dateStr}</strong> (vs {streak[0].rival}) al <strong>{streak[streak.length - 1].dateStr}</strong> (vs {streak[streak.length - 1].rival})
                                  </div>
                                ))}
                              </div>
                            ))}
                            {records.assistingStreakRankings.length > leaders.length && (
                              <div
                                onClick={() => setActiveRecordInfo("assistingStreak")}
                                style={{ fontSize: "0.75rem", color: "var(--text-muted)", cursor: "pointer", transition: "var(--transition-smooth)", marginTop: "0.25rem" }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                              >
                                + {records.assistingStreakRankings.length - leaders.length} jugador{records.assistingStreakRankings.length - leaders.length > 1 ? "es" : ""} más
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin registros (mínimo 2 part.)</span>
                  )}
                </div>

                {/* G+A Streak */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(28, 44, 91, 0.15)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Sparkles size={18} style={{ color: "var(--accent-gold)" }} />
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Partidos Consecutivos G+A (Gol o Asistencia)
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("gPlusAStreak")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.gPlusAStreakRankings.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {(() => {
                        const leaders = getLeaders(records.gPlusAStreakRankings);
                        return (
                          <>
                            {leaders.map((holder, idx) => (
                              <div key={idx} style={{ fontSize: "0.85rem", color: "var(--text-primary)", borderBottom: idx < leaders.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", paddingBottom: idx < leaders.length - 1 ? "0.5rem" : "0" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700 }}>
                                  <span>{holder.name}</span>
                                  <span style={{ color: "var(--accent-gold)", fontSize: "0.9rem" }}>
                                    {holder.value} part. <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--text-muted)" }}>({holder.streaks.length} {holder.streaks.length > 1 ? "veces" : "vez"})</span>
                                  </span>
                                </div>
                                {holder.streaks.map((streak: { rival: string; dateStr: string }[], sIdx: number) => (
                                  <div key={sIdx} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 400, marginTop: "0.25rem", paddingLeft: "0.5rem", borderLeft: "2px solid rgba(28, 44, 91, 0.3)" }}>
                                    Racha {holder.streaks.length > 1 ? `#${sIdx + 1}` : ""}: del <strong>{streak[0].dateStr}</strong> (vs {streak[0].rival}) al <strong>{streak[streak.length - 1].dateStr}</strong> (vs {streak[streak.length - 1].rival})
                                  </div>
                                ))}
                              </div>
                            ))}
                            {records.gPlusAStreakRankings.length > leaders.length && (
                              <div
                                onClick={() => setActiveRecordInfo("gPlusAStreak")}
                                style={{ fontSize: "0.75rem", color: "var(--text-muted)", cursor: "pointer", transition: "var(--transition-smooth)", marginTop: "0.25rem" }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                              >
                                + {records.gPlusAStreakRankings.length - leaders.length} jugador{records.gPlusAStreakRankings.length - leaders.length > 1 ? "es" : ""} más
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin registros (mínimo 2 part.)</span>
                  )}
                </div>

                {/* Days Leader Pichichi */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(255, 198, 89, 0.15)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Crown size={18} style={{ color: "var(--accent-gold)" }} />
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Días Consecutivos como Pichichi
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("daysLeaderPichichi")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.daysLeaderPichichi.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {(() => {
                        const leaders = getLeaders(records.daysLeaderPichichi);
                        return (
                          <>
                            {leaders.map((holder, idx) => (
                              <div key={idx} style={{ fontSize: "0.85rem", color: "var(--text-primary)", borderBottom: idx < leaders.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", paddingBottom: idx < leaders.length - 1 ? "0.5rem" : "0" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700 }}>
                                  <span>{holder.name}</span>
                                  <span style={{ color: "var(--accent-gold)", fontSize: "0.9rem" }}>
                                    {holder.value} {holder.value === 1 ? "día" : "días"} <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--text-muted)" }}>({holder.streaks.length} {holder.streaks.length > 1 ? "veces" : "vez"})</span>
                                  </span>
                                </div>
                                {(() => {
                                  const mainStreak = holder.streaks[0];
                                  if (!mainStreak) return null;
                                  return (
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 400, marginTop: "0.25rem", paddingLeft: "0.5rem", borderLeft: "1px solid var(--border-color)" }}>
                                      del <strong>{mainStreak.startStr}</strong> al <strong>{mainStreak.endStr}</strong>
                                      {mainStreak.isActive && (
                                        <span style={{ color: "var(--accent-emerald)", fontWeight: 700, marginLeft: "0.35rem" }}>
                                          (Activa)
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                            {records.daysLeaderPichichi.length > leaders.length && (
                              <div
                                onClick={() => setActiveRecordInfo("daysLeaderPichichi")}
                                style={{ fontSize: "0.75rem", color: "var(--text-muted)", cursor: "pointer", transition: "var(--transition-smooth)", marginTop: "0.25rem" }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                              >
                                + {records.daysLeaderPichichi.length - leaders.length} jugador{records.daysLeaderPichichi.length - leaders.length > 1 ? "es" : ""} más
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin registros</span>
                  )}
                </div>

                {/* Days Leader Assists */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(108, 171, 221, 0.15)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Award size={18} style={{ color: "var(--accent-cyan)" }} />
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Días Consecutivos como Máximo Asistente
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("daysLeaderAssists")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.daysLeaderAssists.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {(() => {
                        const leaders = getLeaders(records.daysLeaderAssists);
                        return (
                          <>
                            {leaders.map((holder, idx) => (
                              <div key={idx} style={{ fontSize: "0.85rem", color: "var(--text-primary)", borderBottom: idx < leaders.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", paddingBottom: idx < leaders.length - 1 ? "0.5rem" : "0" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700 }}>
                                  <span>{holder.name}</span>
                                  <span style={{ color: "var(--accent-cyan)", fontSize: "0.9rem" }}>
                                    {holder.value} {holder.value === 1 ? "día" : "días"} <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--text-muted)" }}>({holder.streaks.length} {holder.streaks.length > 1 ? "veces" : "vez"})</span>
                                  </span>
                                </div>
                                {(() => {
                                  const mainStreak = holder.streaks[0];
                                  if (!mainStreak) return null;
                                  return (
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 400, marginTop: "0.25rem", paddingLeft: "0.5rem", borderLeft: "1px solid var(--border-color)" }}>
                                      del <strong>{mainStreak.startStr}</strong> al <strong>{mainStreak.endStr}</strong>
                                      {mainStreak.isActive && (
                                        <span style={{ color: "var(--accent-emerald)", fontWeight: 700, marginLeft: "0.35rem" }}>
                                          (Activa)
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                            {records.daysLeaderAssists.length > leaders.length && (
                              <div
                                onClick={() => setActiveRecordInfo("daysLeaderAssists")}
                                style={{ fontSize: "0.75rem", color: "var(--text-muted)", cursor: "pointer", transition: "var(--transition-smooth)", marginTop: "0.25rem" }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                              >
                                + {records.daysLeaderAssists.length - leaders.length} jugador{records.daysLeaderAssists.length - leaders.length > 1 ? "es" : ""} más
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin registros</span>
                  )}
                </div>

                {/* Days Leader G+A */}
                <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.25rem", background: "var(--bg-secondary)", borderColor: "rgba(28, 44, 91, 0.15)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Trophy size={18} style={{ color: "var(--accent-gold)" }} />
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Días Consecutivos como Líder de G+A
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveRecordInfo("daysLeaderGPlusA")}
                      style={{ background: "transparent", border: "none", padding: "0", color: "var(--text-secondary)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-smooth)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
                      title="Ver clasificación completa"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  {records.daysLeaderGPlusA.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {(() => {
                        const leaders = getLeaders(records.daysLeaderGPlusA);
                        return (
                          <>
                            {leaders.map((holder, idx) => (
                              <div key={idx} style={{ fontSize: "0.85rem", color: "var(--text-primary)", borderBottom: idx < leaders.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", paddingBottom: idx < leaders.length - 1 ? "0.5rem" : "0" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700 }}>
                                  <span>{holder.name}</span>
                                  <span style={{ color: "var(--accent-gold)", fontSize: "0.9rem" }}>
                                    {holder.value} {holder.value === 1 ? "día" : "días"} <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--text-muted)" }}>({holder.streaks.length} {holder.streaks.length > 1 ? "veces" : "vez"})</span>
                                  </span>
                                </div>
                                {(() => {
                                  const mainStreak = holder.streaks[0];
                                  if (!mainStreak) return null;
                                  return (
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 400, marginTop: "0.25rem", paddingLeft: "0.5rem", borderLeft: "2px solid rgba(28, 44, 91, 0.3)" }}>
                                      del <strong>{mainStreak.startStr}</strong> al <strong>{mainStreak.endStr}</strong>
                                      {mainStreak.isActive && (
                                        <span style={{ color: "var(--accent-emerald)", fontWeight: 700, marginLeft: "0.35rem" }}>
                                          (Activa)
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                            {records.daysLeaderGPlusA.length > leaders.length && (
                              <div
                                onClick={() => setActiveRecordInfo("daysLeaderGPlusA")}
                                style={{ fontSize: "0.75rem", color: "var(--text-muted)", cursor: "pointer", transition: "var(--transition-smooth)", marginTop: "0.25rem" }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                              >
                                + {records.daysLeaderGPlusA.length - leaders.length} jugador{records.daysLeaderGPlusA.length - leaders.length > 1 ? "es" : ""} más
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin registros</span>
                  )}
                </div>
              </div>


              {/* Hat-tricks and Unique Goal Milestones sub-grid */}
              {(records.hatTricks.length > 0 || records.minTwoGoalsPerformances.length > 0) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.5rem", marginTop: "1rem", marginBottom: "2rem" }}>
                  {/* Unique 2+ goals in a match achievements */}
                  {records.minTwoGoalsPerformances.length > 0 && (
                    <div className="card" style={{ padding: "1.25rem", background: "var(--bg-secondary)" }}>
                      <h4 style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Sparkles size={16} style={{ color: "var(--accent-gold)" }} />
                        Únicos en marcar 2+ goles en un partido
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "250px", overflowY: "auto", paddingRight: "0.25rem" }}>
                        {records.minTwoGoalsPerformances.map((m, idx) => (
                          <div key={idx} style={{ fontSize: "0.85rem", padding: "0.5rem", background: "rgba(0,0,0,0.2)", borderRadius: "6px" }}>
                            <strong style={{ color: "var(--accent-gold)" }}>{m.name}</strong> marcó <strong style={{ color: "var(--accent-gold)" }}>{m.goals} goles</strong>:
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                              vs {m.rival} ({m.dateStr})
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hat-tricks register */}
                  {records.hatTricks.length > 0 && (
                    <div className="card" style={{ padding: "1.25rem", background: "var(--bg-secondary)" }}>
                      <h4 style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Trophy size={16} style={{ color: "var(--accent-gold)" }} />
                        Registro de hat-tricks (3+ goles)
                      </h4>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignContent: "flex-start" }}>
                        {records.hatTricks.map((ht, idx) => (
                          <div key={idx} style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem", background: "rgba(255,198,89,0.12)", border: "1px solid rgba(255,198,89,0.35)", borderRadius: "9999px", color: "var(--accent-gold)", fontWeight: 600 }}>
                            {ht.name} ({ht.goals} G) <span style={{ fontWeight: 400, color: "var(--text-secondary)", fontSize: "0.75rem" }}>vs {ht.rival}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* INDIVIDUAL LEADERBOARDS */}
          <div>
            <SectionHead title="Leaderboards" sub="Los rankings individuales de la temporada. Toca un ranking para ver su evolución." />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "2rem" }}>
              {/* Top Scorers */}
              <Leaderboard
                title="Máximos Goleadores"
                items={scorers}
                accentColor="var(--accent-cyan-light)"
                onViewChart={() => {
                  setActiveChartMetric("goals");
                  setActiveChartTitle("Máximos Goleadores");
                }}
              />

              {/* Top Assistants */}
              <Leaderboard
                title="Máximos Asistentes"
                items={assistants}
                accentColor="var(--accent-emerald)"
                onViewChart={() => {
                  setActiveChartMetric("assists");
                  setActiveChartTitle("Máximos Asistentes");
                }}
              />

              {/* G+A (Goals + Assists) */}
              <Leaderboard
                title="Goles + Asistencias (G+A)"
                items={gPlusA}
                accentColor="var(--accent-cyan)"
                onViewChart={() => {
                  setActiveChartMetric("gPlusA");
                  setActiveChartTitle("Goles + Asistencias (G+A)");
                }}
              />

              {/* Top Woodwork Hits */}
              <Leaderboard
                title="Tiros al Palo"
                items={woodwork}
                accentColor="var(--accent-gold)"
                onViewChart={() => {
                  setActiveChartMetric("woodwork");
                  setActiveChartTitle("Tiros al Palo");
                }}
              />

              {/* Cards Board */}
              <Leaderboard
                title="Tarjetas Amarillas"
                items={yellowCards}
                accentColor="var(--accent-gold)"
                onViewChart={() => {
                  setActiveChartMetric("yellowCards");
                  setActiveChartTitle("Tarjetas Amarillas");
                }}
              />
            </div>
          </div>

          {/* TEAM CHEMISTRY / PARTNERSHIPS */}
          <div style={{ marginTop: "2.5rem" }}>
            <SectionHead title="Química del equipo" sub="Las sociedades más letales de la temporada: quién asiste a quién y su impacto conjunto en el marcador." rule="var(--accent-gold)" />

            {partnershipsList.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
                <p style={{ fontStyle: "italic" }}>
                  Aún no se han registrado asociaciones de gol (asistente + goleador) en esta temporada.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
                {partnershipsList.map((p) => {
                  let chemistryTier = "Conexión prometedora";
                  let tierColor = "var(--accent-ink)";
                  let borderStyle = "1px solid var(--border-color)";
                  const bgStyle = "var(--bg-secondary)";
                  const glowStyle = "none";
                  let glowClass = "";

                  if (p.totalConnections >= 5) {
                    chemistryTier = "Dúo galáctico";
                    tierColor = "var(--accent-gold)";
                    borderStyle = "1px solid rgba(255, 198, 89, 0.5)";
                    glowClass = "gold-glow";
                  } else if (p.totalConnections >= 3) {
                    chemistryTier = "Sociedad letal";
                    tierColor = "var(--accent-ink)";
                    borderStyle = "1px solid var(--border-color-hover)";
                  }

                  return (
                    <div
                      key={`${p.playerAId}-${p.playerBId}`}
                      className={`card chemistry-card ${glowClass}`}
                      style={{
                        background: bgStyle,
                        border: borderStyle,
                        boxShadow: glowStyle,
                        borderRadius: "8px",
                        padding: "1.5rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                        transition: "var(--transition-smooth)"
                      }}
                    >
                      {/* Tier Tag */}
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <span
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            color: tierColor,
                            fontSize: "0.7rem",
                            fontWeight: 800,
                            padding: "0.2rem 0.6rem",
                            borderRadius: "9999px",
                            border: `1px solid ${tierColor}33`,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em"
                          }}
                        >
                          {chemistryTier}
                        </span>
                      </div>

                      {/* Card Content (Duos & Link) */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                        {/* Player A */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, textAlign: "center" }}>
                          <Jersey name={p.playerAShirtName} number={p.playerANumber} size="sm" />
                          <h4 style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.5rem" }}>
                            {p.playerAName}
                          </h4>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                            Goles: <strong>{p.bAssistsA}</strong>
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.1rem", display: "block" }}>
                            Asistencias de gol: <strong>{p.aAssistsB}</strong>
                          </span>
                        </div>

                        {/* Chemistry Link Line & Score */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", minWidth: "60px" }}>
                          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                            Química
                          </span>
                          <div
                            style={{
                              width: "2.25rem",
                              height: "2.25rem",
                              borderRadius: "50%",
                              background: "var(--accent-gold)",
                              color: "#0c1733",
                              fontWeight: 900,
                              fontSize: "1.05rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              zIndex: 1
                            }}
                          >
                            {p.totalConnections}
                          </div>
                          {/* Faint connector line behind badge */}
                          <div
                            style={{
                              width: "100%",
                              height: "2px",
                              background: "rgba(255,255,255,0.06)",
                              position: "relative",
                              top: "-1.5rem",
                              zIndex: 0
                            }}
                          ></div>
                        </div>

                        {/* Player B */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, textAlign: "center" }}>
                          <Jersey name={p.playerBShirtName} number={p.playerBNumber} size="sm" />
                          <h4 style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.5rem" }}>
                            {p.playerBName}
                          </h4>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                            Goles: <strong>{p.aAssistsB}</strong>
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.1rem", display: "block" }}>
                            Asistencias de gol: <strong>{p.bAssistsA}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        renderCompareView()
      )}

      {/* CHART MODAL */}
      {activeChartMetric && (
        <LeaderboardChartModal
          metric={activeChartMetric}
          title={activeChartTitle}
          matches={matches}
          players={players}
          selectedSeasonId={selectedSeasonId}
          seasons={seasons}
          onClose={() => setActiveChartMetric(null)}
        />
      )}

      {/* RECORD DETAILS MODAL */}
      {activeRecordInfo && (
        <RecordDetailsModal
          recordKey={activeRecordInfo}
          matches={matches}
          players={players}
          playerStatsMap={playerStatsMap}
          records={records}
          onClose={() => setActiveRecordInfo(null)}
        />
      )}

      {/* RIVAL DETAILS MODAL */}
      {activeRivalInfo && (
        <RivalDetailsModal
          rivalName={activeRivalInfo}
          matches={matches}
          players={players}
          onClose={() => setActiveRivalInfo(null)}
        />
      )}
    </div>
  );
};

interface ChartModalProps {
  metric: string;
  title: string;
  matches: MatchDoc[];
  players: PlayerDoc[];
  selectedSeasonId: string;
  seasons: Season[];
  onClose: () => void;
}

const LeaderboardChartModal: React.FC<ChartModalProps> = ({
  metric,
  title,
  matches,
  players,
  selectedSeasonId,
  seasons,
  onClose
}) => {
  const [viewType, setViewType] = useState<"value" | "rank">("value");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [hoveredMatchIdx, setHoveredMatchIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Disable body scroll when modal is open to prioritize modal interaction
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // 1. Get matches sorted chronologically
  const sortedMatches = useMemo(() => {
    const getMatchDate = (m: MatchDoc) => {
      if (m.date && typeof m.date === "object" && "seconds" in m.date) return new Date(m.date.seconds * 1000);
      return new Date(m.date as string | number | Date);
    };
    return [...matches].sort((a, b) => getMatchDate(a).getTime() - getMatchDate(b).getTime());
  }, [matches]);

  // 2. Build history points
  const historyData = useMemo(() => {
    if (sortedMatches.length === 0) return [];

    // Initialize cumulative map
    const cumulativeMap: Record<string, number> = {};
    players.forEach(p => {
      cumulativeMap[p.id] = 0;
    });

    // History points map
    const historyPointsMap: Record<string, { matchIndex: number; rival: string; score: string; value: number; rank: number }[]> = {};
    players.forEach(p => {
      historyPointsMap[p.id] = [];
    });

    // Loop matches chronologically
    sortedMatches.forEach((match, matchIndex) => {
      const events = match.events || [];
      const scoreStr = `${match.goalsFor || 0} - ${match.goalsAgainst || 0}`;

      // Update values
      events.forEach((event: MatchEvent) => {
        const { type, playerId, assistPlayerId } = event;

        if (metric === "goals") {
          if (playerId && (type === "goal" || type === "goal_penalty" || type === "goal_freekick")) {
            cumulativeMap[playerId] = (cumulativeMap[playerId] || 0) + 1;
          }
        } else if (metric === "assists") {
          if (playerId && type === "assist") {
            cumulativeMap[playerId] = (cumulativeMap[playerId] || 0) + 1;
          }
          if (assistPlayerId && type === "goal") {
            cumulativeMap[assistPlayerId] = (cumulativeMap[assistPlayerId] || 0) + 1;
          }
        } else if (metric === "gPlusA") {
          if (playerId && (type === "goal" || type === "goal_penalty" || type === "goal_freekick" || type === "assist")) {
            cumulativeMap[playerId] = (cumulativeMap[playerId] || 0) + 1;
          }
          if (assistPlayerId && type === "goal") {
            cumulativeMap[assistPlayerId] = (cumulativeMap[assistPlayerId] || 0) + 1;
          }
        } else if (metric === "woodwork") {
          if (playerId && type === "woodwork") {
            cumulativeMap[playerId] = (cumulativeMap[playerId] || 0) + 1;
          }
        } else if (metric === "yellowCards") {
          if (playerId && type === "yellow_card") {
            cumulativeMap[playerId] = (cumulativeMap[playerId] || 0) + 1;
          } else if (playerId && type === "double_yellow") {
            cumulativeMap[playerId] = (cumulativeMap[playerId] || 0) + 2;
          }
        }
      });

      // Calculate ranks at this point (dense ranking)
      const list = players.map(p => ({
        id: p.id,
        value: cumulativeMap[p.id] || 0
      })).sort((a, b) => b.value - a.value);

      const ranks: Record<string, number> = {};
      let currentRank = 1;
      for (let k = 0; k < list.length; k++) {
        if (k > 0 && list[k].value < list[k - 1].value) {
          currentRank = k + 1;
        }
        ranks[list[k].id] = currentRank;
      }

      // Record points
      players.forEach(p => {
        historyPointsMap[p.id].push({
          matchIndex,
          rival: match.rival || "Rival",
          score: scoreStr,
          value: cumulativeMap[p.id] || 0,
          rank: ranks[p.id] || 1
        });
      });
    });

    const colors = [
      "#6CABDD", // Sky
      "#1C2C5B", // Navy
      "#FFC659", // Gold
      "#C42F23", // Red
      "#a855f7", // Purple
      "#ec4899", // Pink
      "#3b82f6", // Blue
      "#eab308", // Yellow
      "#14b8a6", // Teal
      "#f97316"  // Orange
    ];

    const getResolvedPlayerDetails = (p: PlayerDoc) => {
      let resolvedShirtName = p.shirtName || "";
      let resolvedNumber = p.number || 0;

      if (selectedSeasonId !== "all" && p.seasonDetails?.[selectedSeasonId]) {
        resolvedShirtName = p.seasonDetails[selectedSeasonId].shirtName;
        resolvedNumber = p.seasonDetails[selectedSeasonId].number;
      } else if (p.seasons && p.seasons.length > 0 && p.seasonDetails) {
        const activeSeasonsInList = seasons.filter(s => p.seasons.includes(s.id));
        if (activeSeasonsInList.length > 0) {
          const latestPlayerSeason = activeSeasonsInList[activeSeasonsInList.length - 1];
          if (p.seasonDetails[latestPlayerSeason.id]) {
            resolvedShirtName = p.seasonDetails[latestPlayerSeason.id].shirtName;
            resolvedNumber = p.seasonDetails[latestPlayerSeason.id].number;
          }
        }
      }
      return { shirtName: resolvedShirtName, number: resolvedNumber };
    };

    return players.map((p, idx) => {
      const { shirtName, number } = getResolvedPlayerDetails(p);
      return {
        player: {
          id: p.id,
          name: formatPlayerName(p.firstName, p.lastName),
          shirtName,
          number
        },
        color: colors[idx % colors.length],
        points: historyPointsMap[p.id] || []
      };
    });
  }, [metric, players, selectedSeasonId, seasons, sortedMatches]);

  // Initialize selectedPlayerIds to top 5 players by final value (who have value > 0)
  useEffect(() => {
    if (historyData.length === 0) return;
    
    // Sort players by final cumulative value descending
    const sortedByFinal = [...historyData]
      .filter(h => {
        const last = h.points[h.points.length - 1];
        return last && last.value > 0;
      })
      .sort((a, b) => {
        const valA = a.points[a.points.length - 1]?.value || 0;
        const valB = b.points[b.points.length - 1]?.value || 0;
        return valB - valA;
      });

    const topIds = sortedByFinal.slice(0, 5).map(h => h.player.id);
    // Intentional: seed the default selection (top 5) once history data loads.
    // selectedPlayerIds is also user-mutable via toggles, so this cannot be a pure derive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedPlayerIds(topIds);
  }, [historyData]);

  if (sortedMatches.length === 0) {
    return createPortal(
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(7, 11, 19, 0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99999,
          padding: "2rem 1rem"
        }}
        onClick={onClose}
      >
        <div
          className="card fade-in"
          style={{
            maxWidth: "500px",
            width: "100%",
            padding: "2.5rem",
            background: "var(--bg-secondary)",
            boxShadow: "0 25px 50px rgba(0,0,0,0.5), var(--shadow-glow)",
            position: "relative",
            margin: "auto",
            border: "1px solid rgba(108, 171, 221, 0.2)",
            textAlign: "center"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "1.25rem",
              right: "1.25rem",
              background: "var(--bg-tertiary)",
              border: "none",
              borderRadius: "50%",
              width: "2.25rem",
              height: "2.25rem",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }}
          >
            <X size={20} />
          </button>
          <TrendingUp size={48} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#ffffff", marginBottom: "0.5rem" }}>
            Sin datos suficientes
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            No hay partidos registrados en esta temporada para generar una gráfica de evolución. Registra encuentros en el panel de administrador.
          </p>
        </div>
      </div>,
      document.body
    );
  }

  // Dimension helpers for the SVG Chart
  const svgWidth = 650;
  const svgHeight = 300;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const N = sortedMatches.length;

  const getX = (index: number) => {
    if (N === 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (N - 1)) * chartWidth;
  };

  // Filter histories to only checked players
  const activeHistories = historyData.filter(h => selectedPlayerIds.includes(h.player.id));

  // Determine Y bounds based on active view type
  let maxValue = 5;
  let maxRank = 5;

  if (viewType === "value") {
    let maxVal = 0;
    activeHistories.forEach(h => {
      h.points.forEach(pt => {
        if (pt.value > maxVal) maxVal = pt.value;
      });
    });
    maxValue = Math.max(5, maxVal);
  } else {
    let maxRk = 1;
    activeHistories.forEach(h => {
      h.points.forEach(pt => {
        if (pt.rank > maxRk) maxRk = pt.rank;
      });
    });
    maxRank = Math.max(5, maxRk);
  }

  const getY = (val: number) => {
    if (viewType === "value") {
      return paddingTop + chartHeight - (val / maxValue) * chartHeight;
    } else {
      if (maxRank === 1) return paddingTop + chartHeight / 2;
      return paddingTop + ((val - 1) / (maxRank - 1)) * chartHeight;
    }
  };

  // Generate grid values for Y-axis
  const yTicks: number[] = [];
  if (viewType === "value") {
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      yTicks.push(Math.round((maxValue / steps) * i));
    }
  } else {
    // Generate rank levels
    if (maxRank <= 8) {
      for (let r = 1; r <= maxRank; r++) yTicks.push(r);
    } else {
      const step = (maxRank - 1) / 4;
      for (let i = 0; i < 5; i++) {
        yTicks.push(Math.round(1 + step * i));
      }
    }
  }
  const uniqueYTicks = Array.from(new Set(yTicks));

  const handleTogglePlayer = (id: string) => {
    setSelectedPlayerIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(pId => pId !== id);
      } else {
        // Limit to 10 players to avoid cluttering chart
        if (prev.length >= 10) return prev;
        return [...prev, id];
      }
    });
  };

  // For hovering details
  const activeHoveredPoints = hoveredMatchIdx !== null ? activeHistories.map(h => {
    const pt = h.points[hoveredMatchIdx];
    return {
      name: h.player.name,
      color: h.color,
      value: pt ? pt.value : 0,
      rank: pt ? pt.rank : 1
    };
  }).sort((a, b) => viewType === "value" ? b.value - a.value : a.rank - b.rank) : [];

  const hoveredMatch = hoveredMatchIdx !== null ? sortedMatches[hoveredMatchIdx] : null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(7, 11, 19, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflowY: "auto",
        zIndex: 99999,
        padding: "2rem 1rem"
      }}
      onClick={onClose}
    >
      <div
        className="card fade-in"
        style={{
          maxWidth: "760px",
          width: "100%",
          padding: "2rem",
          background: "var(--bg-secondary)",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5), var(--shadow-glow)",
          position: "relative",
          margin: "auto",
          border: "1px solid rgba(108, 171, 221, 0.2)",
          borderRadius: "1rem"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="text-gradient">Gráfica de Evolución</span>
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
              Visualizando cronológicamente: <strong>{title}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--bg-tertiary)",
              border: "none",
              borderRadius: "50%",
              width: "2.25rem",
              height: "2.25rem",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "var(--transition-smooth)"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            <X size={20} />
          </button>
        </div>

        {/* View Toggles (Segmented Control) */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
          <div
            style={{
              background: "var(--bg-tertiary)",
              borderRadius: "0.5rem",
              padding: "0.25rem",
              display: "flex",
              gap: "0.25rem",
              border: "1px solid var(--border-color)"
            }}
          >
            <button
              onClick={() => setViewType("value")}
              style={{
                border: "none",
                borderRadius: "0.375rem",
                padding: "0.4rem 1.25rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "var(--transition-smooth)",
                background: viewType === "value" ? "var(--accent-cyan)" : "transparent",
                color: viewType === "value" ? "#070b13" : "var(--text-secondary)"
              }}
            >
              📈 Puntos / Cantidad
            </button>
            <button
              onClick={() => setViewType("rank")}
              style={{
                border: "none",
                borderRadius: "0.375rem",
                padding: "0.4rem 1.25rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "var(--transition-smooth)",
                background: viewType === "rank" ? "var(--accent-cyan)" : "transparent",
                color: viewType === "rank" ? "#070b13" : "var(--text-secondary)"
              }}
            >
              🏆 Ranking / Posición
            </button>
          </div>
        </div>

        {/* SVG Graphic Area */}
        <div style={{ position: "relative", width: "100%", background: "rgba(7, 11, 19, 0.4)", borderRadius: "0.75rem", border: "1px solid var(--border-color)", padding: "1rem 0.5rem", overflow: "hidden" }}>
          
          {activeHistories.length === 0 ? (
            <div style={{ height: "300px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.9rem", fontStyle: "italic" }}>
              Selecciona al menos un jugador abajo para ver la evolución gráfica.
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              width="100%"
              height="auto"
              style={{ display: "block" }}
            >
              <defs>
                {/* Neon Glow Filter */}
                <filter id="glow-effect" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Horizontal Grid lines */}
              {uniqueYTicks.map((tickVal) => {
                const yCoord = getY(tickVal);
                return (
                  <g key={`y-grid-${tickVal}`}>
                    <line
                      x1={paddingLeft}
                      y1={yCoord}
                      x2={svgWidth - paddingRight}
                      y2={yCoord}
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={paddingLeft - 10}
                      y={yCoord + 3}
                      textAnchor="end"
                      fill="var(--text-muted)"
                      fontSize="9"
                      fontWeight="700"
                    >
                      {viewType === "value" ? tickVal : `#${tickVal}`}
                    </text>
                  </g>
                );
              })}

              {/* X-Axis ticks & Match grids */}
              {sortedMatches.map((_, idx) => {
                const xCoord = getX(idx);
                return (
                  <g key={`x-grid-${idx}`}>
                    <line
                      x1={xCoord}
                      y1={paddingTop}
                      x2={xCoord}
                      y2={paddingTop + chartHeight}
                      stroke="rgba(255, 255, 255, 0.02)"
                      strokeWidth="1"
                    />
                    <text
                      x={xCoord}
                      y={paddingTop + chartHeight + 18}
                      textAnchor="middle"
                      fill="var(--text-muted)"
                      fontSize="9"
                      fontWeight="700"
                    >
                      P{idx + 1}
                    </text>
                  </g>
                );
              })}

              {/* Bottom solid line */}
              <line
                x1={paddingLeft}
                y1={paddingTop + chartHeight}
                x2={svgWidth - paddingRight}
                y2={paddingTop + chartHeight}
                stroke="var(--border-color)"
                strokeWidth="1"
              />

              {/* Draw Lines */}
              {activeHistories.map((h) => {
                let pathD = "";
                h.points.forEach((pt, idx) => {
                  const x = getX(idx);
                  const y = getY(viewType === "value" ? pt.value : pt.rank);
                  if (idx === 0) {
                    pathD = `M ${x} ${y}`;
                  } else {
                    pathD += ` L ${x} ${y}`;
                  }
                });

                return (
                  <path
                    key={`line-${h.player.id}`}
                    d={pathD}
                    fill="none"
                    stroke={h.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow-effect)"
                    style={{ transition: "all 0.3s ease" }}
                  />
                );
              })}

              {/* Draw Data Node Dots */}
              {activeHistories.map((h) => (
                <g key={`dots-${h.player.id}`}>
                  {h.points.map((pt, idx) => (
                    <circle
                      key={`dot-${h.player.id}-${idx}`}
                      cx={getX(idx)}
                      cy={getY(viewType === "value" ? pt.value : pt.rank)}
                      r="4"
                      fill={h.color}
                      stroke="var(--bg-secondary)"
                      strokeWidth="1.5"
                      style={{ transition: "all 0.3s ease" }}
                    />
                  ))}
                </g>
              ))}

              {/* Hover Indicator Vertical Line */}
              {hoveredMatchIdx !== null && (
                <line
                  x1={getX(hoveredMatchIdx)}
                  y1={paddingTop}
                  x2={getX(hoveredMatchIdx)}
                  y2={paddingTop + chartHeight}
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}

              {/* Hover Highlight Dots */}
              {hoveredMatchIdx !== null && activeHistories.map((h) => {
                const pt = h.points[hoveredMatchIdx];
                if (!pt) return null;
                return (
                  <circle
                    key={`hover-highlight-${h.player.id}`}
                    cx={getX(hoveredMatchIdx)}
                    cy={getY(viewType === "value" ? pt.value : pt.rank)}
                    r="6.5"
                    fill={h.color}
                    stroke="#ffffff"
                    strokeWidth="2"
                    filter="url(#glow-effect)"
                  />
                );
              })}

              {/* Transparent Hover Areas */}
              {sortedMatches.map((_, i) => {
                const xCenter = getX(i);
                let left = paddingLeft;
                if (i > 0) {
                  left = xCenter - (getX(i) - getX(i - 1)) / 2;
                }
                let right = svgWidth - paddingRight;
                if (i < N - 1) {
                  right = xCenter + (getX(i + 1) - getX(i)) / 2;
                }

                return (
                  <rect
                    key={`hover-rect-${i}`}
                    x={left}
                    y={paddingTop}
                    width={right - left}
                    height={chartHeight}
                    fill="transparent"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      setHoveredMatchIdx(i);
                      const rect = e.currentTarget.getBoundingClientRect();
                      const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
                      if (parentRect) {
                        setTooltipPos({
                          x: rect.left - parentRect.left + rect.width / 2 + 10,
                          y: rect.top - parentRect.top + 30
                        });
                      }
                    }}
                    onMouseMove={(e) => {
                      const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
                      if (parentRect) {
                        setTooltipPos({
                          x: e.clientX - parentRect.left + 15,
                          y: e.clientY - parentRect.top - 10
                        });
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredMatchIdx(null);
                      setTooltipPos(null);
                    }}
                  />
                );
              })}
            </svg>
          )}

          {/* Floating Tooltip */}
          {hoveredMatchIdx !== null && tooltipPos !== null && hoveredMatch && (
            <div
              style={{
                position: "absolute",
                left: tooltipPos.x > 450 ? tooltipPos.x - 225 : tooltipPos.x, // Prevent overflow right
                top: Math.max(10, Math.min(180, tooltipPos.y)), // Contain vertically
                background: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(108, 171, 221, 0.3)",
                borderRadius: "0.5rem",
                padding: "0.75rem",
                pointerEvents: "none",
                zIndex: 1000,
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                fontSize: "0.75rem",
                minWidth: "200px",
                backdropFilter: "blur(8px)"
              }}
            >
              <div style={{ fontWeight: 800, color: "#ffffff", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.25rem", marginBottom: "0.5rem" }}>
                🎯 Partido {hoveredMatchIdx + 1} vs {hoveredMatch.rival}
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 500, marginTop: "0.15rem" }}>
                  Marcador: {hoveredMatch.goalsFor} - {hoveredMatch.goalsAgainst} ({hoveredMatch.competition})
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {activeHoveredPoints.map((item, pidx) => (
                  <div key={pidx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--text-primary)" }}>
                      <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: item.color }}></span>
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                    </div>
                    <span style={{ fontWeight: 800, color: "var(--accent-cyan)" }}>
                      {viewType === "value" ? `${item.value} pt` : `Puesto #${item.rank}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Checklist Player Selector Legend */}
        <div style={{ marginTop: "1.5rem" }}>
          <h4 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "0.75rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.25rem" }}>
            Selecciona Jugadores a Comparar (Máx 10):
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", maxHeight: "150px", overflowY: "auto", paddingRight: "0.25rem" }}>
            {historyData.map((h) => {
              const isChecked = selectedPlayerIds.includes(h.player.id);
              const lastPoint = h.points[h.points.length - 1];
              const finalValue = lastPoint ? lastPoint.value : 0;

              return (
                <div
                  key={h.player.id}
                  onClick={() => handleTogglePlayer(h.player.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.3rem 0.6rem",
                    borderRadius: "0.375rem",
                    background: isChecked ? "rgba(108, 171, 221, 0.08)" : "var(--bg-tertiary)",
                    border: isChecked ? "1px solid var(--accent-cyan)" : "1px solid var(--border-color)",
                    color: isChecked ? "#ffffff" : "var(--text-secondary)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: h.color }}></span>
                  <span>{h.player.name}</span>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>({finalValue})</span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={onClose}
          className="btn btn-secondary"
          style={{ width: "100%", marginTop: "1.5rem" }}
        >
          Cerrar Gráfica
        </button>
      </div>
    </div>,
    document.body
  );
};

interface RecordDetailsModalProps {
  recordKey: string;
  matches: MatchDoc[];
  players: PlayerDoc[];
  playerStatsMap: Record<string, PlayerAccumulatedStats>;
  records: RecordDetailsData;
  onClose: () => void;
}

const RecordDetailsModal: React.FC<RecordDetailsModalProps> = ({
  recordKey,
  matches,
  players,
  playerStatsMap,
  records,
  onClose
}) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const formatDate = (dateVal: DateLike) => {
    if (!dateVal) return "";
    const d = typeof dateVal === "object" && "seconds" in dateVal ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  };

  const getMatchDate = (m: MatchDoc) => {
    if (m.date && typeof m.date === "object" && "seconds" in m.date) return new Date(m.date.seconds * 1000);
    return new Date(m.date as string | number | Date);
  };
  const chronoMatches = useMemo(() => {
    return [...matches].sort((a, b) => getMatchDate(a).getTime() - getMatchDate(b).getTime());
  }, [matches]);

  const playerLookup = useMemo(() => {
    const lookup: Record<string, { name: string }> = {};
    players.forEach(p => {
      lookup[p.id] = {
        name: formatPlayerName(p.firstName, p.lastName)
      };
    });
    return lookup;
  }, [players]);

  const recordData = useMemo(() => {
    let title = "";
    let description = "";
    let icon: React.ReactNode = null;
    let list: RecordListItem[] = [];
    let isStreak = false;
    let isAccumulated = false;
    let isPlayerStreak = false;
    let isDaysStreak = false;

    switch (recordKey) {
      case "maxMargin":
        title = "Mayor Goleada A Favor";
        description = "Partidos oficiales ganados con mayor margen de goles a favor.";
        icon = <Trophy size={20} style={{ color: "var(--accent-emerald)" }} />;
        list = [...matches]
          .filter(m => (m.goalsFor || 0) > (m.goalsAgainst || 0))
          .map(m => ({
            score: `${m.goalsFor} - ${m.goalsAgainst}`,
            rival: m.rival || "Rival",
            dateStr: formatDate(m.date),
            value: (m.goalsFor || 0) - (m.goalsAgainst || 0)
          }))
          .sort((a, b) => b.value - a.value);
        break;
      case "maxTotalGoals":
        title = "Festival del Gol";
        description = "Partidos oficiales con mayor número total de goles anotados por ambos equipos.";
        icon = <Sparkles size={20} style={{ color: "rgb(168, 85, 247)" }} />;
        list = [...matches]
          .map(m => ({
            score: `${m.goalsFor || 0} - ${m.goalsAgainst || 0}`,
            rival: m.rival || "Rival",
            dateStr: formatDate(m.date),
            value: (m.goalsFor || 0) + (m.goalsAgainst || 0)
          }))
          .sort((a, b) => b.value - a.value);
        break;
      case "maxUnbeaten":
        title = "Rachas Invictas";
        description = "Partidos oficiales consecutivos sin conocer la derrota (Victorias o Empates).";
        icon = <Shield size={20} style={{ color: "var(--accent-cyan)" }} />;
        isStreak = true;
        {
          const streaks: MatchStreak[] = [];
          let current: MatchDoc[] = [];
          chronoMatches.forEach(m => {
            const gf = m.goalsFor || 0;
            const gc = m.goalsAgainst || 0;
            if (gf >= gc) {
              current.push(m);
            } else {
              if (current.length > 0) {
                streaks.push({
                  length: current.length,
                  start: formatDate(current[0].date),
                  startRival: current[0].rival || "Rival",
                  end: formatDate(current[current.length - 1].date),
                  endRival: current[current.length - 1].rival || "Rival"
                });
                current = [];
              }
            }
          });
          if (current.length > 0) {
            streaks.push({
              length: current.length,
              start: formatDate(current[0].date),
              startRival: current[0].rival || "Rival",
              end: formatDate(current[current.length - 1].date),
              endRival: current[current.length - 1].rival || "Rival"
            });
          }
          list = streaks.sort((a, b) => b.length - a.length);
        }
        break;
      case "maxWinning":
        title = "Rachas de Victorias";
        description = "Partidos oficiales ganados de forma consecutiva por el equipo.";
        icon = <Flame size={20} style={{ color: "var(--accent-gold)" }} />;
        isStreak = true;
        {
          const streaks: MatchStreak[] = [];
          let current: MatchDoc[] = [];
          chronoMatches.forEach(m => {
            const gf = m.goalsFor || 0;
            const gc = m.goalsAgainst || 0;
            if (gf > gc) {
              current.push(m);
            } else {
              if (current.length > 0) {
                streaks.push({
                  length: current.length,
                  start: formatDate(current[0].date),
                  startRival: current[0].rival || "Rival",
                  end: formatDate(current[current.length - 1].date),
                  endRival: current[current.length - 1].rival || "Rival"
                });
                current = [];
              }
            }
          });
          if (current.length > 0) {
            streaks.push({
              length: current.length,
              start: formatDate(current[0].date),
              startRival: current[0].rival || "Rival",
              end: formatDate(current[current.length - 1].date),
              endRival: current[current.length - 1].rival || "Rival"
            });
          }
          list = streaks.sort((a, b) => b.length - a.length);
        }
        break;
      case "maxCleanSheets":
        title = "Porterías a Cero Consecutivas";
        description = "Partidos oficiales consecutivos sin encajar ningún gol en contra.";
        icon = <Zap size={20} style={{ color: "var(--accent-cyan-light)" }} />;
        isStreak = true;
        {
          const streaks: MatchStreak[] = [];
          let current: MatchDoc[] = [];
          chronoMatches.forEach(m => {
            const gc = m.goalsAgainst || 0;
            if (gc === 0) {
              current.push(m);
            } else {
              if (current.length > 0) {
                streaks.push({
                  length: current.length,
                  start: formatDate(current[0].date),
                  startRival: current[0].rival || "Rival",
                  end: formatDate(current[current.length - 1].date),
                  endRival: current[current.length - 1].rival || "Rival"
                });
                current = [];
              }
            }
          });
          if (current.length > 0) {
            streaks.push({
              length: current.length,
              start: formatDate(current[0].date),
              startRival: current[0].rival || "Rival",
              end: formatDate(current[current.length - 1].date),
              endRival: current[current.length - 1].rival || "Rival"
            });
          }
          list = streaks.sort((a, b) => b.length - a.length);
        }
        break;
      case "maxGoalsInMatch":
        title = "Más Goles en un Partido";
        description = "Récord de goles individuales en un único encuentro.";
        icon = <Award size={20} style={{ color: "var(--accent-gold)" }} />;
        {
          const playerGoalsPerMatch: { name: string; value: number; rival: string; dateStr: string }[] = [];
          matches.forEach(m => {
            const events = m.events || [];
            const goalsMap: Record<string, number> = {};
            events.forEach((e: MatchEvent) => {
              if ((e.type === "goal" || e.type === "goal_penalty" || e.type === "goal_freekick") && e.playerId) {
                goalsMap[e.playerId] = (goalsMap[e.playerId] || 0) + 1;
              }
            });
            Object.entries(goalsMap).forEach(([pId, goals]) => {
              const player = playerLookup[pId];
              if (player) {
                playerGoalsPerMatch.push({
                  name: player.name,
                  value: goals,
                  rival: m.rival || "Rival",
                  dateStr: formatDate(m.date)
                });
              }
            });
          });
          list = playerGoalsPerMatch.sort((a, b) => b.value - a.value);
        }
        break;
      case "maxAssistsInMatch":
        title = "Más Asistencias en un Partido";
        description = "Récord de asistencias individuales en un único encuentro.";
        icon = <Award size={20} style={{ color: "var(--accent-cyan)" }} />;
        {
          const playerAssistsPerMatch: { name: string; value: number; rival: string; dateStr: string }[] = [];
          matches.forEach(m => {
            const events = m.events || [];
            const assistsMap: Record<string, number> = {};
            events.forEach((e: MatchEvent) => {
              if (e.type === "assist" && e.playerId) {
                assistsMap[e.playerId] = (assistsMap[e.playerId] || 0) + 1;
              }
              if ((e.type === "goal" || e.type === "goal_penalty" || e.type === "goal_freekick") && e.assistPlayerId) {
                assistsMap[e.assistPlayerId] = (assistsMap[e.assistPlayerId] || 0) + 1;
              }
            });
            Object.entries(assistsMap).forEach(([pId, assists]) => {
              const player = playerLookup[pId];
              if (player) {
                playerAssistsPerMatch.push({
                  name: player.name,
                  value: assists,
                  rival: m.rival || "Rival",
                  dateStr: formatDate(m.date)
                });
              }
            });
          });
          list = playerAssistsPerMatch.sort((a, b) => b.value - a.value);
        }
        break;
      case "maxGPlusAInMatch":
        title = "Máxima Participación de Gol en un Partido";
        description = "Récord de participaciones directas de gol (Goles + Asistencias) en un partido.";
        icon = <Sparkles size={20} style={{ color: "rgb(168, 85, 247)" }} />;
        {
          const playerGPlusAPerMatch: { name: string; value: number; goals: number; assists: number; rival: string; dateStr: string }[] = [];
          matches.forEach(m => {
            const events = m.events || [];
            const goalsMap: Record<string, number> = {};
            const assistsMap: Record<string, number> = {};
            events.forEach((e: MatchEvent) => {
              const isGoal = e.type === "goal" || e.type === "goal_penalty" || e.type === "goal_freekick";
              if (isGoal && e.playerId) {
                goalsMap[e.playerId] = (goalsMap[e.playerId] || 0) + 1;
              }
              if (e.type === "assist" && e.playerId) {
                assistsMap[e.playerId] = (assistsMap[e.playerId] || 0) + 1;
              }
              if (isGoal && e.assistPlayerId) {
                assistsMap[e.assistPlayerId] = (assistsMap[e.assistPlayerId] || 0) + 1;
              }
            });
            const playersInMatch = new Set([...Object.keys(goalsMap), ...Object.keys(assistsMap)]);
            playersInMatch.forEach(pId => {
              const player = playerLookup[pId];
              if (player) {
                const g = goalsMap[pId] || 0;
                const a = assistsMap[pId] || 0;
                playerGPlusAPerMatch.push({
                  name: player.name,
                  value: g + a,
                  goals: g,
                  assists: a,
                  rival: m.rival || "Rival",
                  dateStr: formatDate(m.date)
                });
              }
            });
          });
          list = playerGPlusAPerMatch.sort((a, b) => b.value - a.value);
        }
        break;
      case "maxPenaltyGoals":
        title = "Especialistas desde los 11 Metros";
        description = "Goles totales anotados de penalti por jugador en la temporada.";
        icon = <Target size={20} style={{ color: "var(--accent-red)" }} />;
        isAccumulated = true;
        list = Object.values(playerStatsMap)
          .map(p => ({
            name: p.name,
            value: p.goalPenalty
          }))
          .filter(x => x.value > 0)
          .sort((a, b) => b.value - a.value);
        break;
      case "maxFreekickGoals":
        title = "Especialistas de Falta Directa";
        description = "Goles totales anotados de libre directo por jugador en la temporada.";
        icon = <Target size={20} style={{ color: "var(--accent-emerald)" }} />;
        isAccumulated = true;
        list = Object.values(playerStatsMap)
          .map(p => ({
            name: p.name,
            value: p.goalFreekick
          }))
          .filter(x => x.value > 0)
          .sort((a, b) => b.value - a.value);
        break;
      case "maxPenaltySaves":
        title = "El Parapenaltis";
        description = "Líderes en penaltis atajados en la temporada.";
        icon = <Shield size={20} style={{ color: "var(--accent-cyan)" }} />;
        isAccumulated = true;
        list = Object.values(playerStatsMap)
          .map(p => ({
            name: p.name,
            value: p.penaltySaved
          }))
          .filter(x => x.value > 0)
          .sort((a, b) => b.value - a.value);
        break;
      case "maxWoodworkHits":
        title = "El Imán de los Postes";
        description = "Líderes en remates estrellados en los postes en la temporada.";
        icon = <Target size={20} style={{ color: "var(--accent-gold)" }} />;
        isAccumulated = true;
        list = Object.values(playerStatsMap)
          .map(p => ({
            name: p.name,
            value: p.woodwork
          }))
          .filter(x => x.value > 0)
          .sort((a, b) => b.value - a.value);
        break;
      case "scoringStreak":
        title = "Partidos Consecutivos Marcando";
        description = "Clasificación de jugadores por su racha de partidos consecutivos anotando al menos un gol (mínimo 2 part.).";
        icon = <Flame size={20} style={{ color: "var(--accent-red)" }} />;
        isPlayerStreak = true;
        list = records.scoringStreakRankings;
        break;
      case "assistingStreak":
        title = "Partidos Consecutivos Asistiendo";
        description = "Clasificación de jugadores por su racha de partidos consecutivos dando al menos una asistencia (mínimo 2 part.).";
        icon = <Zap size={20} style={{ color: "var(--accent-emerald)" }} />;
        isPlayerStreak = true;
        list = records.assistingStreakRankings;
        break;
      case "gPlusAStreak":
        title = "Partidos Consecutivos G+A";
        description = "Clasificación de jugadores por su racha de partidos consecutivos sumando gol o asistencia (mínimo 2 part.).";
        icon = <Sparkles size={20} style={{ color: "rgb(168, 85, 247)" }} />;
        isPlayerStreak = true;
        list = records.gPlusAStreakRankings;
        break;
      case "maxAppearances":
        title = "Más Presencias";
        description = "Clasificación de jugadores con más partidos disputados.";
        icon = <Users size={20} style={{ color: "var(--accent-emerald)" }} />;
        isAccumulated = true;
        list = Object.values(playerStatsMap)
          .map(p => ({
            name: p.name,
            value: p.matchesPlayed
          }))
          .filter(x => x.value > 0)
          .sort((a, b) => b.value - a.value);
        break;
      case "daysLeaderPichichi":
        title = "Días Consecutivos como Pichichi";
        description = "Clasificación de jugadores por la mayor racha de días consecutivos liderando la tabla de goleadores (TOP1).";
        icon = <Crown size={20} style={{ color: "var(--accent-gold)" }} />;
        isDaysStreak = true;
        list = records.daysLeaderPichichi;
        break;
      case "daysLeaderAssists":
        title = "Días Consecutivos como Máximo Asistente";
        description = "Clasificación de jugadores por la mayor racha de días consecutivos liderando la tabla de asistentes (TOP1).";
        icon = <Award size={20} style={{ color: "var(--accent-cyan)" }} />;
        isDaysStreak = true;
        list = records.daysLeaderAssists;
        break;
      case "daysLeaderGPlusA":
        title = "Días Consecutivos como Líder de G+A";
        description = "Clasificación de jugadores por la mayor racha de días consecutivos liderando la tabla de G+A (TOP1).";
        icon = <Trophy size={20} style={{ color: "rgb(168, 85, 247)" }} />;
        isDaysStreak = true;
        list = records.daysLeaderGPlusA;
        break;
      default:
        break;
    }

    return { title, description, icon, list, isStreak, isAccumulated, isPlayerStreak, isDaysStreak };
  }, [recordKey, matches, playerStatsMap, chronoMatches, playerLookup, records]);

  const { title, description, icon, list, isStreak, isAccumulated, isPlayerStreak, isDaysStreak } = recordData;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(7, 11, 19, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: "2rem 1rem"
      }}
      onClick={onClose}
    >
      <div
        className="card fade-in"
        style={{
          maxWidth: "540px",
          width: "100%",
          padding: "2rem",
          background: "var(--bg-secondary)",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5), var(--shadow-glow)",
          position: "relative",
          border: "1px solid rgba(108, 171, 221, 0.2)",
          borderRadius: "1rem",
          display: "flex",
          flexDirection: "column",
          maxHeight: "85vh"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1.25rem",
            right: "1.25rem",
            background: "var(--bg-tertiary)",
            border: "none",
            borderRadius: "50%",
            width: "2.25rem",
            height: "2.25rem",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "var(--transition-smooth)"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem", paddingRight: "2.5rem" }}>
          {icon}
          <h3 style={{ fontSize: "1.3rem", fontWeight: 800 }}>{title}</h3>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
          {description}
        </p>

        {/* List Content */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "0.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {list.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", padding: "2rem" }}>
              Sin registros en este periodo.
            </div>
          ) : (
            list.map((item: RecordListItem, index: number) => {
              const isTop = index === 0;
              let badgeColor = "rgba(255, 255, 255, 0.05)";
              let textColor = "var(--text-primary)";
              let rankColor = "var(--text-muted)";
              
              if (isTop) {
                badgeColor = "rgba(255, 198, 89, 0.15)";
                textColor = "var(--accent-gold)";
                rankColor = "var(--accent-gold)";
              }

              return (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    padding: "0.85rem 1rem",
                    background: badgeColor,
                    borderRadius: "0.75rem",
                    border: isTop ? "1px solid rgba(255, 198, 89, 0.3)" : "1px solid var(--border-color)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: 800, color: rankColor, minWidth: "1.5rem" }}>
                        #{index + 1}
                      </span>
                      <span style={{ fontWeight: 700, color: textColor }}>
                        {isPlayerStreak || isDaysStreak ? item.name : isStreak ? `Racha de ${item.length} partidos` : isAccumulated ? item.name : item.name || item.score}
                      </span>
                    </div>

                    <div style={{ fontWeight: 800, fontSize: "1.05rem", color: textColor }}>
                      {isPlayerStreak ? (
                        <>
                          {item.value} part. <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary)" }}>({item.streaks?.length} {(item.streaks?.length ?? 0) > 1 ? "veces" : "vez"})</span>
                        </>
                      ) : isDaysStreak ? (
                        <>
                          {item.value} {item.value === 1 ? "día" : "días"} <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary)" }}>({item.streaks?.length} {(item.streaks?.length ?? 0) > 1 ? "veces" : "vez"})</span>
                        </>
                      ) : isStreak ? (
                        `${item.length} PJ`
                      ) : (
                        item.value
                      )}
                      {recordKey === "maxMargin" && <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)", marginLeft: "0.25rem" }}>dif.</span>}
                      {recordKey === "maxTotalGoals" && <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)", marginLeft: "0.25rem" }}>goles</span>}
                      {recordKey === "maxGPlusAInMatch" && (
                        <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", textAlign: "right" }}>
                          ({item.goals}G + {item.assists}A)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Extra info (Date, Rival) / Streaks list */}
                  {!isAccumulated && !isPlayerStreak && !isDaysStreak && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginLeft: "2.25rem" }}>
                      {isStreak ? (
                        <>del <strong>{item.start}</strong> (vs {item.startRival}) al <strong>{item.end}</strong> (vs {item.endRival})</>
                      ) : (
                        <>vs {item.rival} ({item.dateStr})</>
                      )}
                    </div>
                  )}

                  {isPlayerStreak && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginLeft: "2.25rem", borderLeft: "2px solid rgba(255,255,255,0.08)", paddingLeft: "0.75rem" }}>
                      {(item.streaks as { rival: string; dateStr: string }[][] | undefined)?.map((streak: { rival: string; dateStr: string }[], sIdx: number) => (
                        <div key={sIdx} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 400 }}>
                          <span style={{ color: "var(--text-muted)", marginRight: "0.25rem" }}>•</span>
                          Racha {(item.streaks?.length ?? 0) > 1 ? `#${sIdx + 1}` : ""}: del <strong>{streak[0].dateStr}</strong> (vs {streak[0].rival}) al <strong>{streak[streak.length - 1].dateStr}</strong> (vs {streak[streak.length - 1].rival})
                        </div>
                      ))}
                    </div>
                  )}

                  {isDaysStreak && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginLeft: "2.25rem", borderLeft: "2px solid rgba(255,255,255,0.08)", paddingLeft: "0.75rem" }}>
                      {(item.streaks as DaysStreak[] | undefined)?.map((streak: DaysStreak, sIdx: number) => (
                        <div key={sIdx} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 400 }}>
                          <span style={{ color: "var(--text-muted)", marginRight: "0.25rem" }}>•</span>
                          Racha {(item.streaks?.length ?? 0) > 1 ? `#${sIdx + 1}` : ""}: del <strong>{streak.startStr}</strong> al <strong>{streak.endStr}</strong> ({streak.days} {streak.days === 1 ? "día" : "días"})
                          {streak.isActive && (
                            <span style={{ color: "var(--accent-emerald)", fontWeight: 700, marginLeft: "0.35rem" }}>
                              (Activa)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <button
          onClick={onClose}
          className="btn btn-secondary"
          style={{ width: "100%", marginTop: "1.5rem" }}
        >
          Cerrar Clasificación
        </button>
      </div>
    </div>,
    document.body
  );
};

interface RivalDetailsModalProps {
  rivalName: string;
  matches: MatchDoc[];
  players: PlayerDoc[];
  onClose: () => void;
}

const RivalDetailsModal: React.FC<RivalDetailsModalProps> = ({
  rivalName,
  matches,
  players,
  onClose
}) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const formatDate = (dateVal: DateLike) => {
    if (!dateVal) return "";
    const d = typeof dateVal === "object" && "seconds" in dateVal ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  };

  const getMatchDate = (m: MatchDoc) => {
    if (m.date && typeof m.date === "object" && "seconds" in m.date) return new Date(m.date.seconds * 1000);
    return new Date(m.date as string | number | Date);
  };

  const playerLookup = useMemo(() => {
    const lookup: Record<string, { name: string; shirtName: string; number: number; seasonDetails?: Record<string, { shirtName: string; number: number }>; seasons?: string[] }> = {};
    players.forEach(p => {
      lookup[p.id] = {
        name: formatPlayerName(p.firstName, p.lastName),
        shirtName: p.shirtName || "",
        number: p.number || 0,
        seasonDetails: p.seasonDetails,
        seasons: p.seasons
      };
    });
    return lookup;
  }, [players]);

  const matchesAgainstRival = useMemo(() => {
    return matches
      .filter(m => m.rival?.trim().toUpperCase() === rivalName.trim().toUpperCase())
      .sort((a, b) => getMatchDate(a).getTime() - getMatchDate(b).getTime());
  }, [matches, rivalName]);

  const stats = useMemo(() => {
    let played = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    matchesAgainstRival.forEach(m => {
      played += 1;
      const gf = m.goalsFor || 0;
      const gc = m.goalsAgainst || 0;
      goalsFor += gf;
      goalsAgainst += gc;

      if (gf > gc) wins += 1;
      else if (gf === gc) draws += 1;
      else losses += 1;
    });

    const points = wins * 3 + draws * 1;
    const diff = goalsFor - goalsAgainst;

    return { played, wins, draws, losses, goalsFor, goalsAgainst, points, diff };
  }, [matchesAgainstRival]);

  const leaders = useMemo(() => {
    const goalCounts: Record<string, number> = {};
    const assistCounts: Record<string, number> = {};

    matchesAgainstRival.forEach(m => {
      const events = m.events || [];
      events.forEach((ev: MatchEvent) => {
        const { type, playerId, assistPlayerId } = ev;
        const isGoal = type === "goal" || type === "goal_penalty" || type === "goal_freekick";
        if (isGoal && playerId) {
          goalCounts[playerId] = (goalCounts[playerId] || 0) + 1;
        }
        if (type === "assist" && playerId) {
          assistCounts[playerId] = (assistCounts[playerId] || 0) + 1;
        }
        if (isGoal && assistPlayerId) {
          assistCounts[assistPlayerId] = (assistCounts[assistPlayerId] || 0) + 1;
        }
      });
    });

    let topScorerId = "";
    let topScorerGoals = 0;
    Object.entries(goalCounts).forEach(([pId, goals]) => {
      if (goals > topScorerGoals) {
        topScorerGoals = goals;
        topScorerId = pId;
      }
    });

    let topAssistantId = "";
    let topAssistantAssists = 0;
    Object.entries(assistCounts).forEach(([pId, assists]) => {
      if (assists > topAssistantAssists) {
        topAssistantAssists = assists;
        topAssistantId = pId;
      }
    });

    const getPlayerJerseyInfo = (playerId: string) => {
      const p = playerLookup[playerId];
      if (!p) return { name: "Desconocido", shirtName: "", number: 0 };
      
      let resolvedShirtName = p.shirtName;
      let resolvedNumber = p.number;
      
      if (p.seasons && p.seasons.length > 0 && p.seasonDetails) {
        const lastSeasonId = p.seasons[p.seasons.length - 1];
        if (p.seasonDetails[lastSeasonId]) {
          resolvedShirtName = p.seasonDetails[lastSeasonId].shirtName || resolvedShirtName;
          resolvedNumber = p.seasonDetails[lastSeasonId].number || resolvedNumber;
        }
      }

      return {
        name: p.name,
        shirtName: resolvedShirtName,
        number: resolvedNumber
      };
    };

    return {
      topScorer: topScorerId ? { ...getPlayerJerseyInfo(topScorerId), value: topScorerGoals } : null,
      topAssistant: topAssistantId ? { ...getPlayerJerseyInfo(topAssistantId), value: topAssistantAssists } : null
    };
  }, [matchesAgainstRival, playerLookup]);

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(7, 11, 19, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: "2rem 1rem"
      }}
      onClick={onClose}
    >
      <div
        className="card fade-in"
        style={{
          maxWidth: "580px",
          width: "100%",
          padding: "2rem",
          background: "var(--bg-secondary)",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5), var(--shadow-glow)",
          position: "relative",
          border: "1px solid rgba(6, 182, 212, 0.2)",
          borderRadius: "1rem",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1.25rem",
            right: "1.25rem",
            background: "var(--bg-tertiary)",
            border: "none",
            borderRadius: "50%",
            width: "2.25rem",
            height: "2.25rem",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "var(--transition-smooth)"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
        >
          <X size={20} />
        </button>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.25rem", paddingRight: "2.5rem" }}>
          <Shield size={22} style={{ color: "var(--accent-cyan)" }} />
          <h3 style={{ fontSize: "1.35rem", fontWeight: 800 }}>Historial contra {rivalName}</h3>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginBottom: "1.5rem" }}>
          Desglose completo de todos los enfrentamientos y estadísticas contra este oponente.
        </p>

        <div style={{ flex: 1, overflowY: "auto", paddingRight: "0.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <h4 style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
              Balance Global
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", textAlign: "center" }}>
              <div style={{ padding: "0.75rem", background: "rgba(255,255,255,0.02)", borderRadius: "0.5rem", border: "1px solid var(--border-color)" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#ffffff" }}>{stats.played}</div>
                <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginTop: "0.1rem" }}>PJ</div>
              </div>
              <div style={{ padding: "0.75rem", background: "rgba(16, 185, 129, 0.05)", borderRadius: "0.5rem", border: "1px solid rgba(16, 185, 129, 0.15)" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--accent-emerald)" }}>{stats.wins}</div>
                <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginTop: "0.1rem" }}>Victorias</div>
              </div>
              <div style={{ padding: "0.75rem", background: "rgba(245, 158, 11, 0.05)", borderRadius: "0.5rem", border: "1px solid rgba(245, 158, 11, 0.15)" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--accent-gold)" }}>{stats.draws}</div>
                <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginTop: "0.1rem" }}>Empates</div>
              </div>
              <div style={{ padding: "0.75rem", background: "rgba(239, 68, 68, 0.05)", borderRadius: "0.5rem", border: "1px solid rgba(239, 68, 68, 0.15)" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--accent-red)" }}>{stats.losses}</div>
                <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginTop: "0.1rem" }}>Derrotas</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", textAlign: "center", marginTop: "0.5rem" }}>
              <div style={{ padding: "0.5rem", background: "rgba(255,255,255,0.02)", borderRadius: "0.5rem" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Goles a Favor: </span>
                <strong style={{ fontSize: "0.85rem", color: "#ffffff" }}>{stats.goalsFor}</strong>
              </div>
              <div style={{ padding: "0.5rem", background: "rgba(255,255,255,0.02)", borderRadius: "0.5rem" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Goles en Contra: </span>
                <strong style={{ fontSize: "0.85rem", color: "#ffffff" }}>{stats.goalsAgainst}</strong>
              </div>
              <div style={{ padding: "0.5rem", background: "rgba(255,255,255,0.02)", borderRadius: "0.5rem" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Diferencia: </span>
                <strong style={{ fontSize: "0.85rem", color: stats.diff > 0 ? "var(--accent-emerald)" : stats.diff < 0 ? "var(--accent-red)" : "#ffffff" }}>
                  {stats.diff > 0 ? `+${stats.diff}` : stats.diff}
                </strong>
              </div>
            </div>
          </div>

          {(leaders.topScorer || leaders.topAssistant) && (
            <div>
              <h4 style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                Jugadores Destacados contra {rivalName}
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                {leaders.topScorer ? (
                  <div className="card" style={{
                    padding: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    background: "linear-gradient(135deg, rgba(245, 158, 11, 0.05), rgba(15, 23, 42, 0.4))",
                    borderColor: "rgba(245, 158, 11, 0.15)"
                  }}>
                    <Jersey name={leaders.topScorer.shirtName} number={leaders.topScorer.number} size="sm" />
                    <div>
                      <span style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", color: "var(--accent-gold)", display: "block" }}>
                        El Azote 🎯
                      </span>
                      <strong style={{ fontSize: "0.85rem", color: "#ffffff", display: "block" }}>
                        {leaders.topScorer.name}
                      </strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {leaders.topScorer.value} {leaders.topScorer.value === 1 ? "gol" : "goles"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="card" style={{ padding: "1rem", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.1)", borderStyle: "dashed" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin goleadores</span>
                  </div>
                )}

                {leaders.topAssistant ? (
                  <div className="card" style={{
                    padding: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    background: "linear-gradient(135deg, rgba(6, 182, 212, 0.05), rgba(15, 23, 42, 0.4))",
                    borderColor: "rgba(6, 182, 212, 0.15)"
                  }}>
                    <Jersey name={leaders.topAssistant.shirtName} number={leaders.topAssistant.number} size="sm" />
                    <div>
                      <span style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", color: "var(--accent-cyan)", display: "block" }}>
                        Socio de Asistencias 🤝
                      </span>
                      <strong style={{ fontSize: "0.85rem", color: "#ffffff", display: "block" }}>
                        {leaders.topAssistant.name}
                      </strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {leaders.topAssistant.value} {leaders.topAssistant.value === 1 ? "asistencia" : "asistencias"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="card" style={{ padding: "1rem", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.1)", borderStyle: "dashed" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin asistentes</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <h4 style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
              Historial de Partidos ({matchesAgainstRival.length})
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {matchesAgainstRival.map((m) => {
                const isWin = (m.goalsFor || 0) > (m.goalsAgainst || 0);
                const isLoss = (m.goalsFor || 0) < (m.goalsAgainst || 0);
                const borderLeftColor = isWin ? "var(--accent-emerald)" : isLoss ? "var(--accent-red)" : "var(--accent-gold)";

                return (
                  <div
                    key={m.id}
                    className="card"
                    style={{
                      padding: "0.85rem 1rem",
                      background: "rgba(15, 23, 42, 0.4)",
                      borderLeft: `4px solid ${borderLeftColor}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#ffffff" }}>
                        Manchester Piti vs {m.rival}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                        {formatDate(m.date)} • {m.competition || "Partido Oficial"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{
                        fontSize: "1.1rem",
                        fontWeight: 900,
                        color: isWin ? "var(--accent-emerald)" : isLoss ? "var(--accent-red)" : "var(--accent-gold)",
                        letterSpacing: "0.05em"
                      }}>
                        {m.goalsFor || 0} - {m.goalsAgainst || 0}
                      </span>
                      <span style={{
                        fontSize: "0.6rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        display: "block",
                        color: "var(--text-muted)",
                        marginTop: "0.1rem"
                      }}>
                        {isWin ? "Victoria" : isLoss ? "Derrota" : "Empate"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="btn btn-secondary"
          style={{ width: "100%", marginTop: "1.5rem" }}
        >
          Cerrar Historial
        </button>
      </div>
    </div>,
    document.body
  );
};

