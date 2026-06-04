import React from "react";
import { TrendingUp } from "lucide-react";

interface LeaderboardItem {
  playerId: string;
  name: string;
  shirtName: string;
  number: number;
  value: number;
}

interface LeaderboardProps {
  title: string;
  items: LeaderboardItem[];
  icon: string;
  accentColor?: string;
  onViewChart?: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  title,
  items,
  icon,
  accentColor = "var(--accent-cyan)",
  onViewChart
}) => {
  // Sort items in descending order (highest value first)
  const sortedItems = [...items]
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div
      className="card fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        height: "100%"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: "0.75rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.25rem" }}>{icon}</span>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "-0.01em" }}>
            {title}
          </h3>
        </div>

        {onViewChart && sortedItems.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewChart();
            }}
            title="Ver Gráfica de Evolución"
            style={{
              background: "rgba(6, 182, 212, 0.1)",
              border: "1px solid rgba(6, 182, 212, 0.25)",
              color: "var(--accent-cyan)",
              fontSize: "0.75rem",
              fontWeight: 700,
              padding: "0.25rem 0.5rem",
              borderRadius: "0.375rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              transition: "var(--transition-smooth)"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent-cyan)";
              e.currentTarget.style.color = "#070b13";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(6, 182, 212, 0.1)";
              e.currentTarget.style.color = "var(--accent-cyan)";
            }}
          >
            <TrendingUp size={12} />
            Ver Gráfica
          </button>
        )}
      </div>

      {sortedItems.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            color: "var(--text-muted)",
            fontSize: "0.9rem",
            fontStyle: "italic"
          }}
        >
          Sin datos registrados.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {sortedItems.map((item, index) => {
            const isPodium = index < 3;
            const rankEmoji = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;

            return (
              <div
                key={item.playerId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.6rem 0.8rem",
                  borderRadius: "0.5rem",
                  background: isPodium ? "rgba(255, 255, 255, 0.02)" : "transparent",
                  border: isPodium ? "1px solid rgba(255, 255, 255, 0.04)" : "1px solid transparent",
                  transition: "var(--transition-smooth)"
                }}
              >
                {/* Position & Player Info */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {/* Rank Indicator */}
                  <div
                    style={{
                      width: "1.75rem",
                      height: "1.75rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: rankEmoji ? "1.1rem" : "0.85rem",
                      fontWeight: 700,
                      color: rankEmoji ? "inherit" : "var(--text-muted)"
                    }}
                  >
                    {rankEmoji || index + 1}
                  </div>

                  {/* Jersey Icon Mini circle */}
                  <div
                    style={{
                      width: "1.75rem",
                      height: "1.75rem",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--accent-cyan), #ffffff)",
                      color: "#0f172a",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)"
                    }}
                  >
                    {item.number}
                  </div>

                  {/* Player Name */}
                  <div>
                    <div style={{ fontSize: "0.9rem", fontWeight: isPodium ? 700 : 500 }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                      {item.shirtName}
                    </div>
                  </div>
                </div>

                {/* Score Value */}
                <div
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 800,
                    color: isPodium ? accentColor : "var(--text-primary)",
                    padding: "0.25rem 0.6rem",
                    borderRadius: "0.375rem",
                    background: isPodium ? "rgba(6, 182, 212, 0.05)" : "rgba(255, 255, 255, 0.01)"
                  }}
                >
                  {item.value}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
