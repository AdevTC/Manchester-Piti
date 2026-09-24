import {
  dateMillis,
  formatDate,
  isCompleted,
  type ClubMatch,
} from "./clubData";
export async function downloadMatchPoster(
  match: ClubMatch,
  format: "square" | "story",
) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = format === "story" ? 1920 : 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no puede crear imágenes.");
  const h = canvas.height;
  ctx.fillStyle = "#0c1733";
  ctx.fillRect(0, 0, 1080, h);
  ctx.fillStyle = "#6cabdd";
  ctx.fillRect(0, 0, 22, h);
  ctx.strokeStyle = "rgba(108,171,221,.15)";
  ctx.lineWidth = 2;
  for (let x = 80; x < 1080; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 400, h);
    ctx.stroke();
  }
  const text = (
    s: string,
    y: number,
    size: number,
    color = "#ffffff",
    font = "Anton",
  ) => {
    ctx.font = `${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    while (ctx.measureText(s).width > 940 && size > 20) {
      size--;
      ctx.font = `${size}px ${font}`;
    }
    ctx.fillText(s, 540, y);
  };
  const crest = new Image();
  crest.src = "/crest.png";
  await crest.decode().catch(() => {});
  if (crest.naturalWidth) ctx.drawImage(crest, 450, 90, 180, 180);
  text(
    isCompleted(match) ? "FINAL DEL PARTIDO" : "DÍA DE PARTIDO",
    h * 0.35,
    70,
    "#6cabdd",
  );
  text("MANCHESTER PITI", h * 0.46, 74);
  text(
    isCompleted(match) ? `${match.goalsFor} – ${match.goalsAgainst}` : "VS",
    h * 0.6,
    format === "story" ? 160 : 140,
  );
  text((match.rival || "RIVAL").toUpperCase(), h * 0.7, 64);
  text(match.competition || "Fútbol 7", h * 0.8, 29, "#6cabdd", "Archivo");
  if (Number.isFinite(dateMillis(match.date)))
    text(formatDate(match.date, true), h * 0.85, 27, "#ffffff", "Archivo");
  text("MANCHESTER PITI · FÚTBOL 7", h - 55, 24, "#6cabdd", "Archivo");
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("No se pudo generar el cartel.");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `piti-${match.id}-${format}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
