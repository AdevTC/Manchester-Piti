import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSeason } from "../context/SeasonContext";
import { Jersey } from "../components/Jersey";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { X, Calendar, Weight, Ruler } from "lucide-react";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  shirtName: string;
  number: number;
  birthDate: string; // Format YYYY-MM-DD
  seasons: string[];
  height: number;
  weight: number;
  active: boolean;
  seasonDetails?: Record<string, { shirtName: string; number: number }>;
}

export const Plantilla: React.FC = () => {
  const { selectedSeasonId, seasons } = useSeason();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [displayedPlayers, setDisplayedPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Disable body scroll when modal is open to prioritize modal interaction
  useEffect(() => {
    if (selectedPlayer) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedPlayer]);

  // Load Players and Matches
  useEffect(() => {
    setLoading(true);

    const playersRef = collection(db, "players");
    const unsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
      const loadedPlayers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Player[];
      
      // Sort by dorsal
      setAllPlayers(loadedPlayers.sort((a, b) => a.number - b.number));
    });

    const matchesRef = collection(db, "matches");
    let matchesQuery = query(matchesRef);
    if (selectedSeasonId !== "all") {
      matchesQuery = query(matchesRef, where("seasonId", "==", selectedSeasonId));
    }

    const unsubscribeMatches = onSnapshot(matchesQuery, (snapshot) => {
      setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubscribePlayers();
      unsubscribeMatches();
    };
  }, [selectedSeasonId]);

  // Apply season filter and sort in client side
  useEffect(() => {
    let filtered = [...allPlayers];
    if (selectedSeasonId !== "all") {
      filtered = filtered.filter(p => p.seasons && p.seasons.includes(selectedSeasonId));
    }
    
    // Sort based on resolved number
    filtered.sort((a, b) => {
      const getNum = (player: Player) => {
        if (selectedSeasonId !== "all" && player.seasonDetails?.[selectedSeasonId]) {
          return player.seasonDetails[selectedSeasonId].number;
        }
        if (player.seasons && player.seasons.length > 0 && player.seasonDetails) {
          const activeSeasonsInList = seasons.filter(s => player.seasons.includes(s.id));
          if (activeSeasonsInList.length > 0) {
            const latestPlayerSeason = activeSeasonsInList[activeSeasonsInList.length - 1];
            if (player.seasonDetails[latestPlayerSeason.id]) {
              return player.seasonDetails[latestPlayerSeason.id].number;
            }
          }
        }
        return player.number || 0;
      };
      
      return getNum(a) - getNum(b);
    });

    setDisplayedPlayers(filtered);
  }, [allPlayers, selectedSeasonId, seasons]);



  // Helper to calculate age from birthDate
  const calculateAge = (birthDateStr: string) => {
    if (!birthDateStr) return 0;
    const birth = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Helper to compile statistics for a specific player
  const calculatePlayerStats = (playerId: string) => {
    const stats = {
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

    matches.forEach(match => {
      let playedThisMatch = false;
      const events = match.events || [];

      events.forEach((event: any) => {
        const { type, playerId: epId, assistPlayerId } = event;

        if (epId === playerId) {
          playedThisMatch = true;
          if (type === "goal") stats.goals += 1;
          else if (type === "goal_penalty") { stats.goals += 1; stats.goalPenalty += 1; }
          else if (type === "goal_freekick") { stats.goals += 1; stats.goalFreekick += 1; }
          else if (type === "own_goal") stats.ownGoals += 1;
          else if (type === "assist") stats.assists += 1;
          else if (type === "yellow_card") stats.yellowCards += 1;
          else if (type === "red_card") stats.redCards += 1;
          else if (type === "double_yellow") { stats.doubleYellows += 1; stats.yellowCards += 2; stats.redCards += 1; }
          else if (type === "penalty_saved") stats.penaltySaved += 1;
          else if (type === "penalty_missed") stats.penaltyMissed += 1;
          else if (type === "woodwork") stats.woodwork += 1;
        }

        if (type === "goal" && assistPlayerId === playerId) {
          playedThisMatch = true;
          stats.assists += 1;
        }
      });

      if (playedThisMatch) {
        stats.matchesPlayed += 1;
      }
    });

    return stats;
  };

  const activeSeasonName = selectedSeasonId === "all"
    ? "Histórico Total"
    : seasons.find(s => s.id === selectedSeasonId)?.name || "Temporada";

  // Grouping logic for "Historico Total" (All-time)
  // Siguen: played in the latest season. Bajas: did not.
  const latestSeason = seasons.length > 0 ? seasons[seasons.length - 1] : null;

  const activePlayers = selectedSeasonId === "all" && latestSeason
    ? displayedPlayers.filter(p => p.seasons && p.seasons.includes(latestSeason.id))
    : displayedPlayers;

  const inactivePlayers = selectedSeasonId === "all" && latestSeason
    ? displayedPlayers.filter(p => !p.seasons || !p.seasons.includes(latestSeason.id))
    : [];

  const getResolvedPlayerDetails = (player: Player) => {
    let resolvedShirtName = player.shirtName || "";
    let resolvedNumber = player.number || 0;

    if (selectedSeasonId !== "all" && player.seasonDetails?.[selectedSeasonId]) {
      resolvedShirtName = player.seasonDetails[selectedSeasonId].shirtName;
      resolvedNumber = player.seasonDetails[selectedSeasonId].number;
    } else if (player.seasons && player.seasons.length > 0 && player.seasonDetails) {
      const activeSeasonsInList = seasons.filter(s => player.seasons.includes(s.id));
      if (activeSeasonsInList.length > 0) {
        const latestPlayerSeason = activeSeasonsInList[activeSeasonsInList.length - 1];
        if (player.seasonDetails[latestPlayerSeason.id]) {
          resolvedShirtName = player.seasonDetails[latestPlayerSeason.id].shirtName;
          resolvedNumber = player.seasonDetails[latestPlayerSeason.id].number;
        }
      }
    }
    return { shirtName: resolvedShirtName, number: resolvedNumber };
  };

  const renderPlayerCard = (player: Player, isInactive: boolean = false) => {
    const { shirtName, number } = getResolvedPlayerDetails(player);
    return (
      <div
        key={player.id}
        className="card"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "1.5rem 1rem",
          textAlign: "center",
          position: "relative",
          opacity: isInactive ? 0.65 : 1,
          transition: "var(--transition-smooth)",
          border: isInactive ? "1px solid rgba(255, 255, 255, 0.03)" : undefined
        }}
        onClick={() => setSelectedPlayer(player)}
      >
        {/* Jersey Graphic */}
        <Jersey
          name={shirtName}
          number={number}
          size="md"
          style={{ marginBottom: "1rem" }}
        />

        {/* Name Details */}
        <div style={{ marginTop: "1rem" }}>
          <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff" }}>
            {player.firstName}
          </h4>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            {player.lastName}
          </p>
        </div>

        {/* Number Badge */}
        <span
          style={{
            position: "absolute",
            top: "0.75rem",
            right: "0.75rem",
            background: isInactive ? "rgba(0,0,0,0.4)" : "var(--bg-tertiary)",
            color: isInactive ? "var(--text-muted)" : "var(--accent-cyan)",
            fontSize: "0.75rem",
            fontWeight: 800,
            padding: "0.25rem 0.5rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--border-color)"
          }}
        >
          #{number}
        </span>
        
        {isInactive && (
          <span
            style={{
              position: "absolute",
              bottom: "0.75rem",
              background: "rgba(239, 68, 68, 0.15)",
              color: "var(--accent-red)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              fontSize: "0.6rem",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "0.15rem 0.4rem",
              borderRadius: "0.25rem",
              letterSpacing: "0.05em"
            }}
          >
            Baja / Histórico
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Title Block */}
      <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Plantilla de <span className="text-gradient">Jugadores</span>
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Visualizando: <strong>{activeSeasonName}</strong>. Selecciona un jugador para ver su ficha técnica.
        </p>
      </div>

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
          <p style={{ color: "var(--text-secondary)" }}>Cargando plantilla...</p>
        </div>
      ) : displayedPlayers.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
            Aún no se han registrado jugadores en la plantilla para esta temporada.
          </p>
        </div>
      ) : (
        /* Split view if "Historico Total" */
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Group 1: Active Players */}
          {selectedSeasonId === "all" && latestSeason && activePlayers.length > 0 && (
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem", color: "var(--accent-cyan)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                ✓ Activos en el Club (Última Temporada)
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1.5rem" }}>
                {activePlayers.map(p => renderPlayerCard(p, false))}
              </div>
            </div>
          )}

          {/* Group 2: Inactive Players */}
          {selectedSeasonId === "all" && latestSeason && inactivePlayers.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                ✗ Bajas / Historial de Ex-jugadores
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1.5rem" }}>
                {inactivePlayers.map(p => renderPlayerCard(p, true))}
              </div>
            </div>
          )}

          {/* Single Grid if Specific Season */}
          {(selectedSeasonId !== "all" || !latestSeason) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1.5rem" }}>
              {displayedPlayers.map(p => renderPlayerCard(p, false))}
            </div>
          )}
        </div>
      )}
      </div>

      {/* DETAIL MODAL */}
      {selectedPlayer && createPortal(
        (() => {
          const playerStats = calculatePlayerStats(selectedPlayer.id);
          const calculatedAge = selectedPlayer.birthDate ? calculateAge(selectedPlayer.birthDate) : null;
          
          // Format birthDate to nice locale format
          const birthDateObj = selectedPlayer.birthDate ? new Date(selectedPlayer.birthDate) : null;
          const formattedBirthDate = (!birthDateObj || isNaN(birthDateObj.getTime())) 
            ? "N/A" 
            : birthDateObj.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });

          return (
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
                zIndex: 99999, // Absolute priority over everything (sticky header is 50, mobile menu is 100)
                padding: "2rem 1rem"
              }}
              onClick={() => setSelectedPlayer(null)}
            >
              <div
                className="card fade-in"
                style={{
                  maxWidth: "480px",
                  width: "100%",
                  padding: "2rem",
                  background: "var(--bg-secondary)",
                  boxShadow: "0 25px 50px rgba(0,0,0,0.5), var(--shadow-glow)",
                  position: "relative",
                  margin: "auto", // Automatically centers vertically/horizontally, and handles overflow scrolling correctly
                  border: "1px solid rgba(6, 182, 212, 0.2)"
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={() => setSelectedPlayer(null)}
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

                {/* Plantilla Modal Body */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "1rem" }}>
                  
                  {/* Large Jersey rendering */}
                  <Jersey
                    name={getResolvedPlayerDetails(selectedPlayer).shirtName}
                    number={getResolvedPlayerDetails(selectedPlayer).number}
                    size="lg"
                  />

                  <div style={{ marginTop: "0.5rem" }}>
                    <h3 style={{ fontSize: "1.5rem", fontWeight: 800 }}>
                      {selectedPlayer.firstName}{selectedPlayer.lastName ? ` ${selectedPlayer.lastName}` : ""}
                    </h3>
                    <p style={{ color: "var(--accent-cyan)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Dorsal #{getResolvedPlayerDetails(selectedPlayer).number} • {getResolvedPlayerDetails(selectedPlayer).shirtName}
                    </p>
                  </div>

                  {/* Physical Specifications */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      width: "100%",
                      background: "var(--bg-tertiary)",
                      borderRadius: "0.75rem",
                      padding: "0.75rem",
                      marginTop: "0.5rem",
                      border: "1px solid var(--border-color)"
                    }}
                  >
                    <div style={{ borderRight: "1px solid var(--border-color)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.15rem" }}>
                        <Calendar size={12} /> Edad
                      </span>
                      <span style={{ fontSize: "1.05rem", fontWeight: 700 }}>{calculatedAge !== null ? `${calculatedAge} años` : "N/A"}</span>
                    </div>
                    <div style={{ borderRight: "1px solid var(--border-color)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.15rem" }}>
                        <Ruler size={12} /> Altura
                      </span>
                      <span style={{ fontSize: "1.05rem", fontWeight: 700 }}>{selectedPlayer.height ? `${selectedPlayer.height} cm` : "N/A"}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.15rem" }}>
                        <Weight size={12} /> Peso
                      </span>
                      <span style={{ fontSize: "1.05rem", fontWeight: 700 }}>{selectedPlayer.weight ? `${selectedPlayer.weight} kg` : "N/A"}</span>
                    </div>
                  </div>

                  {/* Birthdate Display */}
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                    📅 Nació el: <strong>{formattedBirthDate}</strong>
                  </p>

                  {/* Season Performance Stats Header */}
                  <div style={{ width: "100%", textAlign: "left", marginTop: "0.5rem" }}>
                    <h4 style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "0.5rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.25rem" }}>
                      Estadísticas - {activeSeasonName}
                    </h4>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
                      {/* Partidos Jugados */}
                      <div style={{ background: "rgba(255,255,255,0.01)", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)" }}>
                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>👤 PARTIDOS JUGADOS</p>
                        <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff" }}>{playerStats.matchesPlayed}</p>
                      </div>

                      {/* G+A */}
                      <div style={{ background: "linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(0,0,0,0))", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--accent-cyan)" }}>
                        <p style={{ fontSize: "0.7rem", color: "var(--accent-cyan)" }}>🔥 G+A (Goles + Asis)</p>
                        <p style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--accent-cyan)" }}>{playerStats.goals + playerStats.assists}</p>
                      </div>

                      {/* Goals */}
                      <div style={{ background: "rgba(255,255,255,0.01)", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)" }}>
                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>⚽ GOLES TOTALES</p>
                        <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                          {playerStats.goals}
                          {(playerStats.goalPenalty > 0 || playerStats.goalFreekick > 0) && (
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "0.25rem", fontWeight: 600 }}>
                              ({playerStats.goalPenalty} Pen / {playerStats.goalFreekick} F)
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Assists */}
                      <div style={{ background: "rgba(255,255,255,0.01)", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)" }}>
                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>👟 ASISTENCIAS</p>
                        <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--accent-emerald)" }}>{playerStats.assists}</p>
                      </div>

                      {/* Cards */}
                      <div style={{ background: "rgba(255,255,255,0.01)", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)" }}>
                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>🎴 AMARILLAS / ROJAS</p>
                        <p style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                          <span style={{ color: "var(--accent-gold)" }}>{playerStats.yellowCards}</span>
                          <span style={{ color: "var(--text-muted)" }}> / </span>
                          <span style={{ color: "var(--accent-red)" }}>{playerStats.redCards}</span>
                          {playerStats.doubleYellows > 0 && (
                            <span style={{ fontSize: "0.65rem", color: "var(--accent-gold)", marginLeft: "0.25rem" }}>
                              ({playerStats.doubleYellows} Doble 🎴)
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Woodwork */}
                      <div style={{ background: "rgba(255,255,255,0.01)", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)" }}>
                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>🥅 TIROS AL PALO</p>
                        <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--accent-gold)" }}>{playerStats.woodwork}</p>
                      </div>

                      {/* Penalties Details */}
                      {(playerStats.penaltySaved > 0 || playerStats.penaltyMissed > 0) && (
                        <div style={{ gridColumn: "span 2", background: "rgba(255,255,255,0.01)", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border-color)", display: "flex", gap: "1rem" }}>
                          {playerStats.penaltySaved > 0 && (
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>🧤 PENALTIS PARADOS</p>
                              <p style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--accent-emerald)" }}>{playerStats.penaltySaved}</p>
                            </div>
                          )}
                          {playerStats.penaltyMissed > 0 && (
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>❌ PENALTIS FALLADOS</p>
                              <p style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--accent-red)" }}>{playerStats.penaltyMissed}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Autogoles */}
                      {playerStats.ownGoals > 0 && (
                        <div style={{ gridColumn: "span 2", background: "rgba(239, 68, 68, 0.05)", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                          <p style={{ fontSize: "0.65rem", color: "var(--accent-red)" }}>🔴 AUTOGOLES</p>
                          <p style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--accent-red)" }}>{playerStats.ownGoals}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="btn btn-secondary"
                    style={{ width: "100%", marginTop: "1rem" }}
                  >
                    Cerrar Ficha
                  </button>

                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}
    </>
  );
};
