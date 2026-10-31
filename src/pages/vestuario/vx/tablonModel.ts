// «El tablón» (/vestuario/tablon, the canvas prototype's SalaTablon.dc.html): the pure pieces of the room — how long
// ago, the day a message falls in («Hoy», «Ayer», «Esta semana», «Antes»), the wall grouped by day and the room's
// title and line in words.
import { madridDate } from "../../../lib/derived/madrid";

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

const dayNo = (ms: number) => {
  const [y, mo, d] = madridDate(ms).split("-").map(Number);
  return Math.round(Date.UTC(y, mo - 1, d) / 86_400_000);
};
/** Madrid calendar days between a message and now (0 = today). */
export const daysAgo = (at: number, now: number) => Math.max(0, dayNo(now) - dayNo(at));

export type TablonDay = "Hoy" | "Ayer" | "Esta semana" | "Antes";
/** The day heading a message falls under: today, yesterday, the last seven days, or before. */
export function dayGroup(at: number, now: number): TablonDay {
  const d = daysAgo(at, now);
  return d === 0 ? "Hoy" : d === 1 ? "Ayer" : d < 7 ? "Esta semana" : "Antes";
}

/** The wall, newest first, each message with its day heading on the first of its day. */
export function tablonWall<M extends { at: number }>(msgs: readonly M[], now: number): (M & { day: TablonDay; first: boolean })[] {
  let last = "";
  return msgs.map((m) => {
    const day = dayGroup(m.at, now);
    const first = day !== last;
    last = day;
    return { ...m, day, first };
  });
}

/** Messages of the last seven days (the room's «N mensajes esta semana»). */
export const weekCount = (msgs: readonly { at: number }[], now: number) => msgs.filter((m) => daysAgo(m.at, now) < 7).length;

export interface TablonHeadIn {
  /** The newest message (null: nobody wrote). */
  lead: { name: string; at: number; mine: boolean } | null;
  week: number;
  admin: boolean;
  /** «Felicita a …» while the draft from El club waits (the player's name). */
  felicitar: string | null;
  loading: boolean;
  now: number;
}
/** The room's title (who wrote last, and when) and the line under it. */
export function tablonHead({ lead, week, admin, felicitar, loading, now }: TablonHeadIn): { title: string; sub: string } {
  if (felicitar) return { title: `Felicita a ${felicitar}`, sub: "Te hemos dejado el mensaje listo: cámbialo si quieres y publícalo. Lo ve todo el equipo." };
  const own = admin ? " Como capitán, puedes borrar cualquier mensaje." : " Lo tuyo lo puedes borrar.";
  if (loading) return { title: "El tablón", sub: `Saluda, avisa o pregunta: lo lee todo el equipo.${own}` };
  if (!lead) return { title: "Nadie ha escrito todavía", sub: "El tablón está en blanco. Rompe el hielo: un toque y se publica." };
  const when = ago(lead.at, now);
  const count = week ? `${week} ${week === 1 ? "mensaje" : "mensajes"} esta semana. ` : "";
  return { title: lead.mine ? `Escribiste ${when}` : `${lead.name} escribió ${when}`, sub: `${count}Saluda, avisa o pregunta: lo lee todo el equipo.${own}` };
}
