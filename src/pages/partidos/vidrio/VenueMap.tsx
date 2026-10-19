// The Previa's map: where the match is played. The venue is free text, so it is looked up once (Open-Meteo's
// geocoder, no key, cached for the session; the name without its «CDM» / «Campo de» when the full one is not
// found) for its spot and its district («En casa, en Puente de Vallecas»). With a spot the map shows the
// real streets (OpenStreetMap tiles, credited) under the glass pin; without one — on the server, while it
// loads, or when the geocoder doesn't know the place — the drawn map stands in. No script, just images.
import { Glyph } from "./bits";
import { tilesAround, type VenuePlace } from "./venuePlace";

const Z = 15;
const TILE = 256;

export function VenueMap({ venue, geo }: { venue: string; geo: VenuePlace | null }) {
  const grid = geo ? tilesAround(geo.lat, geo.lng) : null;
  return (
    <div className={`vp-map${grid ? " vp-map--real" : ""}`}>
      {grid ? (
        <span className="vp-map__tiles" style={{ left: `calc(50% - ${grid.px}px)`, top: `calc(50% - ${grid.py}px)` }} aria-hidden="true">
          {grid.tiles.map((t) => (
            <img key={`${t.x}-${t.y}`} src={`https://tile.openstreetmap.org/${Z}/${t.x}/${t.y}.png`} alt="" width={TILE} height={TILE} loading="lazy" decoding="async" style={{ left: t.left, top: t.top }} />
          ))}
        </span>
      ) : (
        <svg className="vp-map__svg" viewBox="0 0 400 86" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect className="vp-map__bg" width="400" height="86" />
          <circle className="vp-map__park" cx="330" cy="10" r="58" />
          <path className="vp-map__road vp-map__road--big" d="M-10 70 C80 60 140 66 200 72 S330 86 410 64" />
          <path className="vp-map__road" d="M60 -5 L80 90 M250 -5 L240 90 M120 30 L400 22" />
          <rect className="vp-map__pitch" x="170" y="10" width="46" height="28" rx="2" transform="rotate(-8 193 24)" />
        </svg>
      )}
      <span className={`vp-map__pin${grid ? " vp-map__pin--c" : ""}`} aria-hidden="true">
        <Glyph name="pin" />
      </span>
      <span className="vp-map__lab" aria-hidden="true">
        {venue}
      </span>
      {grid && (
        <a className="vp-map__osm" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap
        </a>
      )}
    </div>
  );
}
