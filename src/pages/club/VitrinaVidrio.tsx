// «La vitrina · Temporada 1» (V-Integracion «El club y la cuenta», V-Vivo phone «Club»): a glass case with two
// shelves of pieces — what the club has won, tonight's match in its live slot, and dashed slots for what is
// still to win («Aquí irá», «Se juega ahora»). The pieces come from lib/derived/vidrio/vitrinaLive.
import type { VitrinaPiece } from "../../lib/derived/vidrio/vitrinaLive";

function Medal({ n }: { n: string }) {
  return (
    <svg viewBox="0 0 74 84" aria-hidden="true">
      <defs>
        <linearGradient id="cl-silver" x1="0" x2="1">
          <stop offset="0" stopColor="#9fb3cc" />
          <stop offset=".45" stopColor="#f4f8fd" />
          <stop offset="1" stopColor="#7d91ad" />
        </linearGradient>
      </defs>
      <path d="M22 4h12l5 26H27zM40 4h12l-5 26H35z" fill="#6CABDD" />
      <circle cx="37" cy="52" r="22" fill="url(#cl-silver)" />
      <circle cx="37" cy="52" r="15" fill="none" stroke="#7d91ad" strokeWidth="2" />
      <text x="37" y="58" textAnchor="middle" fontSize="16" fontWeight="800" fill="#0C1733">
        {n}
      </text>
    </svg>
  );
}
const Trophy = () => (
  <svg viewBox="0 0 74 84" aria-hidden="true">
    <path d="M20 8h34v16c0 11-7 20-17 20S20 35 20 24z" fill="url(#cl-silver)" />
    <path d="M20 13H10v5c0 7 5 11 11 11M54 13h10v5c0 7-5 11-11 11" fill="none" stroke="#c9d6e6" strokeWidth="3" />
    <rect x="33" y="44" width="8" height="16" fill="#b7c6d9" />
    <rect x="22" y="60" width="30" height="8" rx="2" fill="#0C1733" stroke="#c9d6e6" />
    <rect x="18" y="68" width="38" height="10" rx="2" fill="#0C1733" stroke="#c9d6e6" />
  </svg>
);
const Ball = () => (
  <svg viewBox="0 0 74 84" aria-hidden="true">
    <ellipse cx="37" cy="78" rx="20" ry="4" fill="rgba(0,8,30,.5)" />
    <circle cx="37" cy="46" r="27" fill="#f4f8fd" />
    <path d="M37 33l9 6.5-3.5 10.5h-11L28 39.5z" fill="#0C1733" />
    <path d="M37 19v14M46 39.5l12-4M42.5 50l8 10M31.5 50l-8 10M28 39.5l-12-4" stroke="#0C1733" strokeWidth="2.4" fill="none" />
  </svg>
);

function Piece({ p, year }: { p: VitrinaPiece; year: string }) {
  return (
    <li className={`cl-piece${p.empty ? " cl-piece--empty" : ""}${p.live ? " cl-piece--live" : ""}`}>
      {p.art === "medal" && <Medal n={year} />}
      {p.art === "trophy" && <Trophy />}
      {p.art === "ball" && <Ball />}
      {p.art === "score" && <span className="vd-score cl-piece__score">{p.score}</span>}
      <b>{p.title}</b>
      <span>{p.sub}</span>
    </li>
  );
}

export function VitrinaVidrio({ season, top, bottom, year }: { season: string; top: readonly VitrinaPiece[]; bottom: readonly VitrinaPiece[]; year: string }) {
  return (
    <section className="vd-glass cl-vit" aria-labelledby="cl-vit-t">
      <div className="cl-vit__head">
        <h2 id="cl-vit-t">La vitrina</h2>
        <span>{season}</span>
      </div>
      <ul className="cl-vit__shelf" aria-label="Primera balda">
        {top.map((p) => (
          <Piece key={p.id} p={p} year={year} />
        ))}
      </ul>
      <ul className="cl-vit__shelf" aria-label="Segunda balda">
        {bottom.map((p) => (
          <Piece key={p.id} p={p} year={year} />
        ))}
      </ul>
    </section>
  );
}
