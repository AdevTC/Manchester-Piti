export async function shareClubPage(
  type: "partido" | "jugador",
  id: string,
  title: string,
) {
  const url = import.meta.env.DEV
    ? location.href
    : `${location.origin}/compartir/${type}/${id}`;
  if (navigator.share) await navigator.share({ title, url });
  else await navigator.clipboard.writeText(url);
}
