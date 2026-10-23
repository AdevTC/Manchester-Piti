// «El tablón» (/vestuario/tablon): the pure pieces of the block, as the board's vx.msgs draws each message.

/** The board's limit for a message (the rules allow up to 500). */
export const TABLON_MAX = 280;
export const TABLON_QUICK = ["¡Hola, equipo!", "¿Pachanga el sábado?", "Yo llevo balones"] as const;

/** «ahora», «hace 12 min», «hace 3 h», «ayer», «hace 4 días». */
export function ago(at: number, now: number) {
  const m = Math.round((now - at) / 60_000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

/** «Felicitarle en el tablón» (El club, ?felicitar=<playerId>): the draft it leaves ready. */
export const congrats = (name: string) => `¡Felicidades, ${name}!`;
