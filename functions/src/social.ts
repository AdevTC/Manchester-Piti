import { onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import sharp from "sharp";
export const siteUrl = defineString("PUBLIC_SITE_URL", {
  default: "https://futbolmanagement-dc6cb.web.app",
});
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const clubShare = onRequest(
  { region: "europe-west1", maxInstances: 3, memory: "256MiB" },
  async (req, res) => {
    const found = req.path.match(
      /^\/(compartir|social)\/(partido|jugador)\/([a-zA-Z0-9_-]+)(?:\.png)?$/,
    );
    if (!found) {
      res.status(404).send("Página no encontrada");
      return;
    }
    const [, kind, type, id] = found;
    const snap = await getFirestore()
      .doc(`${type === "partido" ? "matches" : "players"}/${id}`)
      .get();
    // Archived seasons never resurface through old share links.
    if (!snap.exists || snap.get("archived") === true) {
      res.status(404).send("No encontrado");
      return;
    }
    const data = snap.data()!;
    const base = siteUrl.value().replace(/\/$/, "");
    const name =
      type === "partido"
        ? `Manchester Piti · ${data.rival ?? "Partido"}`
        : data.shirtName || data.firstName || "Manchester Piti";
    const score =
      type === "partido" && typeof data.goalsFor === "number"
        ? `${data.goalsFor} — ${data.goalsAgainst}`
        : type === "partido"
          ? "PRÓXIMO PARTIDO"
          : `#${data.number ?? 0}`;
    const subtitle =
      type === "partido"
        ? data.competition || "Fútbol 7"
        : data.naturalPosition || "Uno de los nuestros";
    const canonical = `${base}/${type === "partido" ? "matches" : "jugadores"}/${id}`;
    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    if (kind === "social") {
      const crest = readFileSync(
        new URL("../assets/crest.png", import.meta.url),
      ).toString("base64");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0c1733"/><rect width="18" height="630" fill="#6cabdd"/><image href="data:image/png;base64,${crest}" x="70" y="55" width="115" height="115"/><text x="220" y="120" fill="#aaceec" font-family="sans-serif" font-weight="bold" font-size="30">MANCHESTER PITI</text><text x="70" y="300" fill="white" font-family="sans-serif" font-weight="bold" font-size="${score.length > 12 ? 60 : 115}">${escape(score)}</text><text x="70" y="405" fill="white" font-family="sans-serif" font-weight="bold" font-size="${name.length > 35 ? 32 : 43}">${escape(String(name).slice(0, 60))}</text><text x="70" y="475" fill="#aaceec" font-family="sans-serif" font-size="28">${escape(String(subtitle).slice(0, 65))}</text><line x1="70" x2="1130" y1="535" y2="535" stroke="#334a75"/><text x="70" y="590" fill="#aaceec" font-family="sans-serif" font-size="20">MANCHESTER PITI · FÚTBOL 7</text></svg>`;
      const image = await sharp(Buffer.from(svg)).png().toBuffer();
      res.type("png").send(image);
      return;
    }
    const title = `${name} · ${score}`;
    res
      .type("html")
      .send(
        `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="description" content="${escape(subtitle)}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(subtitle)}"><meta property="og:url" content="${base}/compartir/${type}/${id}"><meta property="og:image" content="${base}/social/${type}/${id}.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="${canonical}"></head><body><h1>${escape(title)}</h1><p>${escape(subtitle)}</p><a href="${canonical}">Ver en la web del Manchester Piti</a><script>location.replace(${JSON.stringify(canonical)});</script></body></html>`,
      );
  },
);
