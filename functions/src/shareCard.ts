// The player's share image (1200×630) drawn as his cromo, like the one on /jugadores/$id: a gold-edged
// card with the shirt back (name + number), the holo stripes, and his numbers with the club beside it.
// Pure SVG (sharp rasterises it in social.ts); no network, no fonts beyond the system sans.
export const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const POSITIONS: Record<string, string> = { POR: "PORTERO", DEF: "DEFENSA", MED: "CENTROCAMPISTA", DEL: "DELANTERO" };

export interface CardPlayer {
  name: string;
  number?: number | string;
  position?: string;
  historic?: boolean;
  totals?: { played: number; goals: number; assists: number } | null;
}

/** SVG of the share card. `crest` is the club crest as base64 PNG. */
export function playerCardSvg(p: CardPlayer, crest: string) {
  const name = escapeXml(p.name.toUpperCase().slice(0, 24));
  const num = escapeXml(String(p.number ?? "").slice(0, 3));
  const pos = escapeXml(POSITIONS[String(p.position ?? "").toUpperCase()] ?? String(p.position || "UNO DE LOS NUESTROS").toUpperCase().slice(0, 24));
  // Font size from the width each name has (librsvg ignores textLength); bold sans ≈ 0.72em a glyph.
  const plain = p.name.toUpperCase().slice(0, 24);
  const fit = (width: number, max: number) => Math.floor(Math.min(max, width / (Math.max(1, [...plain].length) * 0.72)));
  const big = fit(610, 104);
  const t = p.totals && p.totals.played > 0 ? p.totals : null;
  const stat = (x: number, v: number, label: string) =>
    `<text x="${x}" y="470" fill="#FFC659" font-family="sans-serif" font-weight="900" font-size="64">${v}</text><text x="${x}" y="505" fill="#9fb3d3" font-family="sans-serif" font-size="20" letter-spacing="2">${label}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
<radialGradient id="bg" cx="70%" cy="20%" r="90%"><stop offset="0" stop-color="#1d3f84"/><stop offset=".45" stop-color="#0c1c46"/><stop offset="1" stop-color="#030817"/></radialGradient>
<radialGradient id="card" cx="50%" cy="0%" r="110%"><stop offset="0" stop-color="#2c5aa8"/><stop offset=".5" stop-color="#10245a"/><stop offset="1" stop-color="#071230"/></radialGradient>
<linearGradient id="holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5e5e" stop-opacity=".22"/><stop offset=".25" stop-color="#ffe76b" stop-opacity=".2"/><stop offset=".5" stop-color="#6cffae" stop-opacity=".16"/><stop offset=".75" stop-color="#6cc8ff" stop-opacity=".22"/><stop offset="1" stop-color="#c78cff" stop-opacity=".2"/></linearGradient>
<linearGradient id="shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4ecfc"/><stop offset="1" stop-color="#6CABDD"/></linearGradient>
</defs>
<rect width="1200" height="630" fill="url(#bg)"/>
<g transform="translate(90 45) rotate(-4 170 270)">
<rect width="340" height="540" rx="26" fill="url(#card)"/>
<rect width="340" height="540" rx="26" fill="url(#holo)"/>
<rect x="8" y="8" width="324" height="524" rx="20" fill="none" stroke="#FFC659" stroke-width="3" stroke-opacity=".8"/>
<text x="28" y="66" fill="#FFC659" font-family="sans-serif" font-weight="900" font-size="48">${num || "–"}</text>
<text x="${num.length > 1 ? 96 : 66}" y="60" fill="#eef4ff" font-family="sans-serif" font-size="14" letter-spacing="3">${pos}</text>
<g transform="translate(70 92)">
<path d="M70 14 C84 26 116 26 130 14 L178 34 C186 38 192 46 194 56 L198 98 L166 104 L160 80 L160 214 C160 220 156 224 150 224 L50 224 C44 224 40 220 40 214 L40 80 L34 104 L2 98 L6 56 C8 46 14 38 22 34 Z" fill="url(#shirt)" stroke="rgba(0,0,0,.2)"/>
<path d="M70 14 C84 26 116 26 130 14 M42 206 L158 206" fill="none" stroke="#CFA862" stroke-width="3" stroke-linecap="round"/>
<text x="100" y="74" text-anchor="middle" fill="#051330" font-family="sans-serif" font-weight="bold" font-size="${fit(150, 22)}">${name}</text>
<text x="100" y="178" text-anchor="middle" fill="#051330" stroke="#CFA862" stroke-width="2.5" paint-order="stroke" font-family="sans-serif" font-weight="bold" font-size="96">${num}</text>
</g>
<rect x="18" y="410" width="304" height="112" rx="16" fill="#030817" fill-opacity=".9" stroke="#FFC659" stroke-opacity=".4"/>
<text x="36" y="452" fill="#eef4ff" font-family="sans-serif" font-weight="900" font-size="${fit(268, 28)}">${name}</text>
<text x="36" y="496" fill="#9fb3d3" font-family="sans-serif" font-size="13" letter-spacing="1">${p.historic ? "HISTÓRICO" : "PLANTILLA"} · MANCHESTER PITI</text>
</g>
<image href="data:image/png;base64,${crest}" x="520" y="70" width="84" height="84"/>
<text x="624" y="125" fill="#aaceec" font-family="sans-serif" font-weight="bold" font-size="26" letter-spacing="3">MANCHESTER PITI</text>
<text x="520" y="${t ? 300 : 340}" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="${big}">${name}</text>
<text x="520" y="${t ? 350 : 390}" fill="#aaceec" font-family="sans-serif" font-size="28">Dorsal ${num || "–"} · ${pos.charAt(0) + pos.slice(1).toLowerCase()}</text>
${t ? stat(520, t.played, "PARTIDOS") + stat(740, t.goals, "GOLES") + stat(940, t.assists, "ASISTENCIAS") : ""}
<line x1="520" x2="1130" y1="545" y2="545" stroke="#334a75"/>
<text x="520" y="590" fill="#aaceec" font-family="sans-serif" font-size="20">SU CROMO · MANCHESTER PITI · FÚTBOL 7</text>
</svg>`;
}
