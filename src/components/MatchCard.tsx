import React, { useState } from "react";
import { ChevronDown, ChevronUp, Calendar } from "lucide-react";

interface MatchEvent {
  type: "goal" | "yellow_card" | "red_card" | "woodwork" | "assist" | "double_yellow" | "penalty_saved" | "goal_penalty" | "goal_freekick" | "penalty_missed" | "own_goal" | "match_played";
  playerId: string;
  assistPlayerId?: string;
}

interface Match {
  id: string;
  rival: string;
  competition: string;
  date: any; // Timestamp
  goalsFor: number;
  goalsAgainst: number;
  events: MatchEvent[];
}

interface MatchCardProps {
  match: Match;
  playersMap: Record<string, string>; // Map of playerId -> shirtName
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, playersMap }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse date
  const matchDate = match.date?.seconds 
    ? new Date(match.date.seconds * 1000) 
    : new Date(match.date);
  
  const formattedDate = matchDate.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const isWin = match.goalsFor > match.goalsAgainst;
  const isLoss = match.goalsFor < match.goalsAgainst;

  let outcomeBadge = <span className="badge badge-warning">Empate</span>;
  let borderColor = "rgba(245, 158, 11, 0.4)"; // yellow
  let shadowGlow = "rgba(245, 158, 11, 0.05)";

  if (isWin) {
    outcomeBadge = <span className="badge badge-success">Victoria</span>;
    borderColor = "rgba(16, 185, 129, 0.4)"; // green
    shadowGlow = "rgba(16, 185, 129, 0.08)";
  } else if (isLoss) {
    outcomeBadge = <span className="badge badge-danger">Derrota</span>;
    borderColor = "rgba(239, 68, 68, 0.4)"; // red
    shadowGlow = "rgba(239, 68, 68, 0.08)";
  }

  // Filter events
  const goals = match.events.filter(e => ["goal", "goal_penalty", "goal_freekick"].includes(e.type));
  const ownGoals = match.events.filter(e => e.type === "own_goal");
  const yellowCards = match.events.filter(e => e.type === "yellow_card");
  const redCards = match.events.filter(e => e.type === "red_card");
  const doubleYellows = match.events.filter(e => e.type === "double_yellow");
  const woodworkHits = match.events.filter(e => e.type === "woodwork");
  const penaltySaves = match.events.filter(e => e.type === "penalty_saved");
  const penaltyMisses = match.events.filter(e => e.type === "penalty_missed");
  const standaloneAssists = match.events.filter(e => e.type === "assist");

  // Compile participants (any player involved in any event or listed as match_played)
  const participantIds = Array.from(new Set(
    match.events.flatMap(e => [e.playerId, e.assistPlayerId].filter(Boolean) as string[])
  ));
  const participantNames = participantIds
    .map(id => playersMap[id])
    .filter(Boolean);

  return (
    <div
      className="card fade-in"
      style={{
        borderColor: borderColor,
        boxShadow: `0 10px 30px rgba(0, 0, 0, 0.2), 0 0 20px ${shadowGlow}`,
        cursor: "pointer",
        padding: "0",
        overflow: "hidden",
        marginBottom: "1rem"
      }}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Main card header summary */}
      <div
        style={{
          padding: "1.25rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem"
        }}
      >
        {/* Match Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent-cyan)", textTransform: "uppercase" }}>
              {match.competition}
            </span>
            {outcomeBadge}
          </div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700 }}>
            vs <span style={{ color: "#ffffff" }}>{match.rival}</span>
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--text-muted)", fontSize: "0.75rem" }}>
            <Calendar size={12} />
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Score Display */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              background: "rgba(0, 0, 0, 0.2)",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.75rem",
              border: "1px solid var(--border-color)",
              fontFamily: "monospace",
              fontSize: "1.5rem",
              fontWeight: 800
            }}
          >
            <span style={{ color: isWin ? "var(--accent-emerald)" : isLoss ? "var(--accent-red)" : "white" }}>
              {match.goalsFor}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "1rem" }}>-</span>
            <span style={{ color: "var(--text-muted)" }}>{match.goalsAgainst}</span>
          </div>

          <div>
            {isExpanded ? (
              <ChevronUp size={20} style={{ color: "var(--text-muted)" }} />
            ) : (
              <ChevronDown size={20} style={{ color: "var(--text-muted)" }} />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Match Events Details */}
      {isExpanded && (
        <div
          style={{
            borderTop: "1px solid var(--border-color)",
            background: "rgba(0, 0, 0, 0.15)",
            padding: "1.25rem 1.5rem"
          }}
          onClick={(e) => e.stopPropagation() /* Prevent close when clicking events */}
        >
          {match.events.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", fontStyle: "italic", textAlign: "center" }}>
              No hay eventos registrados para este partido.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Goals list */}
              {(goals.length > 0 || ownGoals.length > 0) && (
                <div>
                  <h4 style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    ⚽ Goles ({goals.length + ownGoals.length})
                  </h4>
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.35rem", paddingLeft: "0.5rem" }}>
                    {goals.map((event, idx) => {
                      const scorer = playersMap[event.playerId] || "Jugador Desconocido";
                      const assistant = event.assistPlayerId ? playersMap[event.assistPlayerId] : null;
                      const suffix = event.type === "goal_penalty" ? " (Penalti)" : event.type === "goal_freekick" ? " (Falta)" : "";
                      return (
                        <li key={idx} style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>
                          ⚽ <strong>{scorer}</strong>{suffix}
                          {assistant && (
                            <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                              {" "}(Asistencia de: <em>{assistant}</em>)
                            </span>
                          )}
                        </li>
                      );
                    })}
                    {ownGoals.map((event, idx) => {
                      const scorer = playersMap[event.playerId] || "Jugador Desconocido";
                      return (
                        <li key={`og-${idx}`} style={{ fontSize: "0.9rem", color: "var(--accent-red)" }}>
                          🔴 <strong>{scorer}</strong> (Autogol)
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Cards and Woodwork in a side-by-side or stacked layout */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                {/* Yellow, Red, and Double Yellow Cards */}
                {(yellowCards.length > 0 || redCards.length > 0 || doubleYellows.length > 0) && (
                  <div>
                    <h4 style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                      🎴 Tarjetas
                    </h4>
                    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.35rem", paddingLeft: "0.5rem" }}>
                      {yellowCards.map((event, idx) => (
                        <li key={`y-${idx}`} style={{ fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ display: "inline-block", width: "10px", height: "14px", backgroundColor: "var(--accent-gold)", borderRadius: "2px" }}></span>
                          <span>{playersMap[event.playerId] || "Jugador Desconocido"}</span>
                        </li>
                      ))}
                      {doubleYellows.map((event, idx) => (
                        <li key={`dy-${idx}`} style={{ fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ display: "flex", gap: "2px" }}>
                            <span style={{ display: "inline-block", width: "10px", height: "14px", backgroundColor: "var(--accent-gold)", borderRadius: "2px" }}></span>
                            <span style={{ display: "inline-block", width: "10px", height: "14px", backgroundColor: "var(--accent-red)", borderRadius: "2px" }}></span>
                          </span>
                          <span>{playersMap[event.playerId] || "Jugador Desconocido"} (Doble Amarilla)</span>
                        </li>
                      ))}
                      {redCards.map((event, idx) => (
                        <li key={`r-${idx}`} style={{ fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ display: "inline-block", width: "10px", height: "14px", backgroundColor: "var(--accent-red)", borderRadius: "2px" }}></span>
                          <span>{playersMap[event.playerId] || "Jugador Desconocido"} (Roja)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Other Actions (Woodwork, Penalty Saved/Missed, Standalone Assists) */}
                {(woodworkHits.length > 0 || penaltySaves.length > 0 || penaltyMisses.length > 0 || standaloneAssists.length > 0) && (
                  <div>
                    <h4 style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                      ⚡ Otras Acciones
                    </h4>
                    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.35rem", paddingLeft: "0.5rem" }}>
                      {standaloneAssists.map((event, idx) => (
                        <li key={`a-${idx}`} style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>
                          👟 {playersMap[event.playerId] || "Jugador Desconocido"} (Asistencia)
                        </li>
                      ))}
                      {woodworkHits.map((event, idx) => (
                        <li key={`w-${idx}`} style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>
                          🥅 {playersMap[event.playerId] || "Jugador Desconocido"} (Tiro al Palo)
                        </li>
                      ))}
                      {penaltySaves.map((event, idx) => (
                        <li key={`ps-${idx}`} style={{ fontSize: "0.9rem", color: "var(--accent-emerald)" }}>
                          🧤 {playersMap[event.playerId] || "Jugador Desconocido"} (Penalti Parado)
                        </li>
                      ))}
                      {penaltyMisses.map((event, idx) => (
                        <li key={`pm-${idx}`} style={{ fontSize: "0.9rem", color: "var(--accent-red)" }}>
                          ❌ {playersMap[event.playerId] || "Jugador Desconocido"} (Penalti Fallado)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Lineup / Participants */}
              {participantNames.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem", marginTop: "0.5rem" }}>
                  <h4 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "0.25rem" }}>
                    👥 Jugaron en este partido ({participantNames.length})
                  </h4>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                    {participantNames.join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
