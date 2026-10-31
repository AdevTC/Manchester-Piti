// Tu vitrina (TuCarta B «vitrina»), pure: the head («Bronce, camino de Plata»), «El camino» (the Bronce · Plata ·
// Oro scale with him on it and the stations — the last pieces he earned, today, the next ones with their progress
// and the tier gates where they fall), «Por qué eres Bronce» / «Qué te hace Plata» in words, the tier chips, and
// ONE reward wall (me.rewards: evoluciones + logros + MVPs + records, each earned piece naming its match, the next
// ones in silhouette with their progress). Thresholds from tu/me tierInfo (lib/rating/constants: Plata 65, Oro 75).
import type { Me, Reward, RewardKind, TierInfo } from "../me";
import type { Kind } from "../model";
import { pl } from "../model";

export type Metal = "Bronce" | "Plata" | "Oro";
export const metalOf = (rating: number, t: Pick<TierInfo, "plata" | "oro">): Metal => (rating >= t.oro ? "Oro" : rating >= t.plata ? "Plata" : "Bronce");

const dec = (n: number) => n.toFixed(1).replace(".", ",");

export interface VitrinaHead {
  title: string;
  sub: string;
  share: string;
}

export function headOf(kind: Kind, tier: TierInfo, pack: boolean): VitrinaHead {
  if (kind === "jugador") {
    if (tier.rating === null) return { title: "Tu carta, por estrenar", sub: "Con tu primer partido con nota sale tu valoración, y con ella el camino de Bronce a Oro y todo lo que vayas ganando.", share: "Compartir mi carta" };
    const metal = metalOf(tier.rating, tier);
    return { title: `${metal}, camino de ${tier.next ? tier.next.name : "la cima"}`, sub: `Por qué tu carta es ${metal}, qué la sube y todo lo que has ganado, cada cosa con el partido que te la dio.`, share: "Compartir mi carta" };
  }
  if (kind === "nuevo") return { title: pack ? "Tu sobre, aún cerrado" : "Tu carta, por elegir", sub: "Lo que guardará tu vitrina en cuanto el capitán acepte tu ficha.", share: "Compartir mi póster" };
  return { title: "Tu carné y lo tuyo", sub: "Lo que el club sabe de ti y tu porra.", share: "Compartir mi póster" };
}

/** The scale (40 … Oro + 15): where he stands, in percent of its width (kept off the very ends). */
export function scaleOf(tier: TierInfo): { left: number; aria: string } | null {
  if (tier.rating === null) return null;
  const lo = 40;
  const hi = tier.oro + 15;
  const left = Math.max(2, Math.min(98, ((tier.rating - lo) / (hi - lo)) * 100));
  return { left, aria: `Tu valoración, ${tier.rating}, en la franja ${metalOf(tier.rating, tier)}. Plata empieza en ${tier.plata} y Oro en ${tier.oro}.` };
}

export type PieceIcon = "card" | "medal" | "record" | "now" | "shield";
const iconOf = (k: RewardKind): PieceIcon => (k === "evolucion" ? "card" : k === "logro" ? "medal" : "record");
const KIND: Record<RewardKind, string> = { evolucion: "Evolución", logro: "Logro", mvp: "MVP", record: "Récord" };

export interface Station {
  key: string;
  cls: string;
  icon: PieceIcon;
  t: string;
  s: string;
  bar: { pct: number; aria: string } | null;
}

const barOf = (r: Reward) => (r.progress ? { pct: r.progress.pct, aria: `${r.t}: ${r.progress.cur} de ${r.progress.goal}` } : null);

/** «El camino»: his last two pieces, today, the next four (the next tier's gate after the second), Oro last. */
export function roadOf(me: Pick<Me, "rewards" | "tier" | "figures" | "rows">): Station[] {
  const { tier } = me;
  const out: Station[] = me.rewards.earned.slice(-2).map((r) => ({ key: r.id, cls: "is-done", icon: iconOf(r.kind), t: r.t, s: r.match?.label ?? "", bar: null }));
  const lastJ = [...me.rows].reverse().find((r) => r.kind === "played" || r.kind === "didnt" || r.kind === "absent")?.j ?? null;
  if (tier.rating === null) out.push({ key: "now", cls: "is-now", icon: "now", t: "Hoy · sin valoración", s: "Sale con tu primer partido con nota", bar: null });
  else
    out.push({
      key: "now",
      cls: "is-now",
      icon: "now",
      t: `Hoy · ${tier.rating} ${metalOf(tier.rating, tier)}`,
      s: tier.provisional ? `Provisional: sale de ${pl(me.figures.played, "partido", "partidos")}` : lastJ ? `Tras la J${lastJ}` : "",
      bar: null,
    });
  const gate = tier.next ? { key: `gate-${tier.next.name}`, cls: `is-gate${tier.next.name === "Oro" ? " is-oro" : ""}`, icon: "shield" as const, t: `${tier.next.name} · ${tier.next.at}`, s: `Te faltan ${tier.next.missing} de valoración`, bar: null } : null;
  const next = me.rewards.next.slice(0, 4);
  next.forEach((r, i) => {
    if (i === 2 && gate) out.push(gate);
    out.push({ key: r.id, cls: "", icon: iconOf(r.kind), t: r.t, s: r.need, bar: barOf(r) });
  });
  if (gate && next.length <= 2) out.push(gate);
  if (tier.rating !== null && tier.next?.name === "Plata") out.push({ key: "gate-Oro", cls: "is-gate is-oro", icon: "shield", t: `Oro · ${tier.oro}`, s: `Te faltan ${tier.oro - tier.rating}`, bar: null });
  return out;
}

export interface Whys {
  whyH: string;
  whyT: string;
  upH: string;
  upT: string;
}

/** «Por qué eres Bronce» and «Qué te hace Plata», in words. `tierWhy`: the card's own line before it has a rating. */
export function whysOf(me: Pick<Me, "tier" | "figures" | "rows">, tierWhy: string): Whys {
  const t = me.tier;
  if (t.rating === null)
    return {
      whyH: "Por qué tu carta aún no tiene metal",
      whyT: tierWhy || "Se revela con tu primer partido de la temporada.",
      upH: "Qué le da su metal",
      upT: `Tu primer partido con nota: con él sale tu valoración. Bronce es menos de ${t.plata}, Plata de ${t.plata} a ${t.oro - 1} y Oro ${t.oro} o más.`,
    };
  const r = t.rating;
  const metal = metalOf(r, t);
  const band = metal === "Bronce" ? `Tu valoración es ${r} y Bronce es todo lo que está por debajo de ${t.plata}.` : metal === "Plata" ? `Tu valoración es ${r}: está entre ${t.plata} y ${t.oro - 1}, la franja Plata.` : `Tu valoración es ${r}: ${t.oro} o más, la franja Oro.`;
  const played = me.rows.filter((x) => x.kind === "played");
  const noted = played.filter((x) => x.nota !== null);
  const one = noted.length === 1 ? noted[0] : null;
  const from = one
    ? ` Sale de tu nota en la ${one.jLabel} (${one.notaText}, «${one.bandWord.toLocaleLowerCase("es")}»)`
    : noted.length
      ? ` Sale de tus notas por partido (${pl(me.figures.played, "jugado", "jugados")}, ${dec(me.figures.average ?? 0)} de media)`
      : " Sale de tus partidos";
  const tail = t.provisional ? (one ? ": con un solo partido aún es provisional y se mueve mucho." : ": aún es provisional y se mueve mucho.") : " y es la misma que ve el capitán en la pizarra.";
  const racha = t.tiers.some((x) => x.k === "racha" && x.mine) ? " Además vas En racha: gol o asistencia en las 3 últimas." : "";
  const up = t.next
    ? { upH: `Qué te hace ${t.next.name}`, upT: `Llegar a ${t.next.at}: te faltan ${t.next.missing}. Sube con cada partido en el que tu nota supere tu media; los goles y las asistencias entran en esa nota. Las evoluciones y los logros no suman puntos: se ven en la carta como marcas.` }
    : { upH: "Qué te mantiene Oro", upT: "Ya estás en lo más alto: mantén la nota. Las evoluciones y los logros no suman puntos: se ven en la carta como marcas." };
  return { whyH: `Por qué eres ${metal}`, whyT: `${band}${from}${tail}${racha}`, ...up };
}

export interface Piece {
  key: string;
  cls: string;
  icon: PieceIcon;
  kind: string;
  t: string;
  s: string;
  bar: { pct: number; aria: string } | null;
}
export interface Shelf {
  key: "ganadas" | "siguientes";
  t: string;
  meta: string;
  items: Piece[];
  empty: string;
}

/** The wall: «Ganadas» (lit, with the match) and «Las siguientes» (in silhouette, with what they ask). */
export function wallOf(rw: Me["rewards"]): Shelf[] {
  const lit = rw.earned.map((r): Piece => {
    const s = [r.match?.label ?? "", r.kind !== "logro" && r.reward ? r.reward : ""].filter(Boolean).join(" · ");
    return { key: r.id, cls: `is-lit${r.gold ? " is-gold" : ""}${r.kind === "logro" ? " is-medal" : ""}`, icon: iconOf(r.kind), kind: KIND[r.kind], t: r.t, s, bar: null };
  });
  const off = rw.next.map((r): Piece => {
    const prog = r.progress ? `${r.progress.cur} de ${r.progress.goal}` : "";
    const s = [r.need, prog].filter(Boolean).join(" · ");
    return { key: r.id, cls: `is-off${r.kind === "logro" ? " is-medal" : ""}`, icon: iconOf(r.kind), kind: KIND[r.kind], t: r.t, s, bar: barOf(r) };
  });
  return [
    { key: "ganadas", t: "Ganadas", meta: `${pl(lit.length, "pieza", "piezas")} · cada una con el partido que te la dio`, items: lit, empty: "La primera llega jugando: tu debut te la da." },
    { key: "siguientes", t: "Las siguientes", meta: "En silueta: lo que piden, y cuánto llevas", items: off, empty: "Lo tienes todo: no queda nada por ganar." },
  ];
}

/** «1 de 13 ganadas · las paradas, de la más cercana a la más lejana». */
export function roadMeta(rw: Me["rewards"]): string {
  return `${rw.earned.length} de ${rw.earned.length + rw.next.length} ganadas · las paradas, de la más cercana a la más lejana`;
}

/** The socio's porra in words («5 pronósticos · 1 exacto · vas 3.º de 12 · 7 puntos»); null without one. */
export function porraWords(p: { predictions: number; exact: number; points: number; rank: number; of: number } | null): string | null {
  if (!p) return null;
  return `${pl(p.predictions, "pronóstico", "pronósticos")} · ${pl(p.exact, "exacto", "exactos")} · vas ${p.rank}.º de ${p.of} · ${pl(p.points, "punto", "puntos")}.`;
}

/** «Tu álbum: 9 de 15». */
export const albumWords = (owned: number, total: number): string => `${owned} de ${total}`;
