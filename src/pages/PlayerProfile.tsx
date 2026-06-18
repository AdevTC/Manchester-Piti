import React from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { playerDetailQuery } from "../lib/detailQueries";
import { Jersey } from "../components/Jersey";
import "./PlayerProfile.css";

const route = getRouteApi("/jugadores/$playerId");

export const PlayerProfile: React.FC = () => {
  const { playerId } = route.useParams();
  // Hits the cache warmed by the route loader's ensureQueryData (no double fetch).
  const { data: player } = useQuery(playerDetailQuery(playerId));

  if (!player) {
    return (
      <div className="pp-page fade-in">
        <Link to="/plantilla" className="pp-back">
          <ArrowLeft size={16} aria-hidden="true" /> Volver a la plantilla
        </Link>
        <div className="pp-empty">
          <span className="pp-empty-mark">Jugador no encontrado</span>
          <p className="pp-empty-text">
            No hay ningún expediente con esta referencia. Puede que se haya dado de baja.
          </p>
        </div>
      </div>
    );
  }

  const firstName = player.firstName || "";
  const lastName = player.lastName || "";
  const shirtName = player.shirtName || "";
  const number = player.number ?? 0;
  const seasonsCount = player.seasons?.length ?? 0;

  const bio: { k: string; v: string }[] = [];
  if (player.naturalPosition) bio.push({ k: "Posición", v: player.naturalPosition });
  if (player.height) bio.push({ k: "Altura", v: `${player.height} cm` });
  if (player.weight) bio.push({ k: "Peso", v: `${player.weight} kg` });
  bio.push({ k: "Temporadas", v: String(seasonsCount) });

  return (
    <div className="pp-page fade-in">
      <Link to="/plantilla" className="pp-back">
        <ArrowLeft size={16} aria-hidden="true" /> Volver a la plantilla
      </Link>

      <article className="pp-card">
        <div className="pp-card-top">
          <div className="pp-well">
            <Jersey name={shirtName} number={number} size="md" style={{ filter: "none" }} />
          </div>
          <div className="pp-id">
            <h2 className="pp-name">
              {firstName} {lastName}
            </h2>
            {shirtName && (
              <p className="pp-alias">
                <b>Alias</b> · {shirtName}
              </p>
            )}
            <div className="pp-flags">
              <span className={`pp-flag pp-flag--${player.active === false ? "baja" : "active"}`}>
                {player.active === false ? "Baja" : "Activo"}
              </span>
              {player.injured && <span className="pp-flag pp-flag--injured">Lesionado</span>}
              <span className="pp-flag pp-flag--num">Nº {number}</span>
            </div>
          </div>
        </div>

        <dl className="pp-bio">
          {bio.map((row) => (
            <div className="pp-bio-row" key={row.k}>
              <dt className="pp-bio-k">{row.k}</dt>
              <dd className="pp-bio-v">{row.v}</dd>
            </div>
          ))}
        </dl>
      </article>
    </div>
  );
};

export default PlayerProfile;
