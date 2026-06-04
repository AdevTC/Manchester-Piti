import React, { useEffect, useState } from "react";
import { useSeason } from "../context/SeasonContext";
import { MatchCard } from "../components/MatchCard";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { CalendarDays, AlertCircle } from "lucide-react";

export const MatchCenter: React.FC = () => {
  const { selectedSeasonId, seasons } = useSeason();
  const [matches, setMatches] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Get active season name
  const currentSeasonName = selectedSeasonId === "all" 
    ? "Histórico Total" 
    : seasons.find(s => s.id === selectedSeasonId)?.name || "Temporada";

  // 1. Fetch Players
  useEffect(() => {
    const playersRef = collection(db, "players");
    const unsubscribe = onSnapshot(playersRef, (snapshot) => {
      const loadedPlayers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPlayers(loadedPlayers);
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch Matches filtered by active season
  useEffect(() => {
    setLoading(true);
    const matchesRef = collection(db, "matches");
    
    let q;
    if (selectedSeasonId === "all") {
      q = query(matchesRef, orderBy("date", "desc"));
    } else {
      q = query(
        matchesRef, 
        where("seasonId", "==", selectedSeasonId),
        orderBy("date", "desc")
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMatches = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setMatches(loadedMatches);
      setLoading(false);
    }, (error) => {
      console.error("Error loading matches:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedSeasonId]);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Title section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: "1rem"
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Centro de <span className="text-gradient">Partidos</span>
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Visualizando: <strong>{currentSeasonName}</strong>
          </p>
        </div>
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            padding: "0.5rem 1rem",
            borderRadius: "0.75rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}
        >
          <CalendarDays size={16} style={{ color: "var(--accent-cyan)" }} />
          <span>Partidos Jugados: {matches.length}</span>
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem" }}>
          <div style={{
            width: "2.5rem",
            height: "2.5rem",
            border: "4px solid rgba(6, 182, 212, 0.1)",
            borderTopColor: "var(--accent-cyan)",
            borderRadius: "50%",
            animation: "pulseGlow 1.5s infinite linear",
            margin: "0 auto 1rem"
          }}></div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>Cargando partidos...</p>
        </div>
      ) : matches.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "4rem 2rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem"
          }}
        >
          <AlertCircle size={48} style={{ color: "var(--text-muted)" }} />
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.25rem" }}>
              No hay partidos registrados
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: "400px", margin: "0 auto" }}>
              No encontramos encuentros para <strong>{currentSeasonName}</strong>. Si eres administrador, puedes agregar nuevos partidos en el panel de administración.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {matches.map((match) => {
            // Build season-specific playersMap for this match
            const matchPlayersMap: Record<string, string> = {};
            players.forEach((p) => {
              let resolvedShirtName = p.shirtName || "";
              if (p.seasonDetails?.[match.seasonId]) {
                resolvedShirtName = p.seasonDetails[match.seasonId].shirtName;
              } else if (p.seasons && p.seasons.length > 0 && p.seasonDetails) {
                const activeSeasonsInList = seasons.filter(s => p.seasons.includes(s.id));
                if (activeSeasonsInList.length > 0) {
                  const latestPlayerSeason = activeSeasonsInList[activeSeasonsInList.length - 1];
                  if (p.seasonDetails[latestPlayerSeason.id]) {
                    resolvedShirtName = p.seasonDetails[latestPlayerSeason.id].shirtName;
                  }
                }
              }
              matchPlayersMap[p.id] = resolvedShirtName || `${p.firstName} ${p.lastName}`;
            });

            return (
              <MatchCard key={match.id} match={match} playersMap={matchPlayersMap} />
            );
          })}
        </div>
      )}
    </div>
  );
};
