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
  icon?: string;
  accentColor?: string;
  onViewChart?: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  title,
  items,
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: accentColor, flexShrink: 0 }} />
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 400, textTransform: "uppercase", fontSize: "1.1rem", letterSpacing: "0.02em", color: "var(--text-primary)" }}>
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
              background: "rgba(108, 171, 221, 0.1)",
              border: "1px solid rgba(108, 171, 221, 0.25)",
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
              e.currentTarget.style.background = "rgba(108, 171, 221, 0.1)";
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

            return (
              <div
                key={item.playerId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.6rem 0.8rem",
                  borderRadius: "0.5rem",
                  background: isPodium ? "rgba(108, 171, 221, 0.08)" : "transparent",
                  border: isPodium ? "1px solid var(--border-color)" : "1px solid transparent",
                  transition: "var(--transition-smooth)"
                }}
              >
                {/* Position & Player Info */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {/* Rank Indicator */}
                  <div
                    style={{
                      width: "1.75rem",
                      textAlign: "center",
                      fontFamily: "var(--font-display)",
                      fontWeight: 400,
                      fontSize: index === 0 ? "1.5rem" : "1.1rem",
                      lineHeight: 1,
                      color: index === 0 ? "var(--accent-gold)" : "var(--text-muted)"
                    }}
                  >
                    {index + 1}
                  </div>

                  {/* Jersey number disc */}
                  <div
                    style={{
                      width: "1.75rem",
                      height: "1.75rem",
                      borderRadius: "4px",
                      background: "var(--accent-cyan)",
                      color: "#0c1733",
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
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
                    fontFamily: "var(--font-display)",
                    fontWeight: 400,
                    fontSize: "1.6rem",
                    lineHeight: 1,
                    color: isPodium ? "var(--accent-ink)" : "var(--text-secondary)",
                    padding: "0 0.4rem"
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
