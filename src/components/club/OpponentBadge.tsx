import { useState, type CSSProperties } from "react";
import { opponentInitials } from "../../lib/clubAnalytics";
export function OpponentBadge({
  name,
  logo,
  initials,
  size = 48,
}: {
  name?: string;
  logo?: string;
  initials?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const text = initials?.trim().toUpperCase() || opponentInitials(name);
  return (
    <span
      className="club-opponent-badge"
      style={{ "--badge-size": size + "px" } as CSSProperties}
      role="img"
      aria-label={"Escudo de " + (name || "rival por confirmar")}
    >
      {logo && failed !== logo ? (
        <img src={logo} alt="" onError={() => setFailed(logo)} loading="lazy" />
      ) : (
        <b>{text}</b>
      )}
    </span>
  );
}
