// Tú: from the profile's data (useProfileData) to what the TU boards draw — who looks, his card (front, carné,
// sobre or face down), the identity above the tabs, each tab's line and the six numbers. Pure.
import type { TuMaqueta } from "../../../components/vidrio/tu/maqueta";
import type { ProfileData } from "../useProfileData";
import type { CardModel, CardBack } from "./TuCard";
import { pl, type Kind, type Sec } from "./model";

/** Who looks, as the boards tell them apart: a linked ficha is a player; a pending or turned-down request a new
 *  account (the sobre, or the card face down to pick a dorsal); anybody else in the vestuario a socio (his carné,
 *  with «¿Juegas en el Piti?» a tap away). */
export function kindOf(d: Pick<ProfileData, "ficha">, maq: TuMaqueta | null): Kind {
  if (maq?.quien === "nuevo" || maq?.quien === "pendiente") return "nuevo";
  if (d.ficha.state === "vinculada") return "jugador";
  if (d.ficha.state === "pendiente" || d.ficha.rejectedPlayerId) return "nuevo";
  return "socio";
}

/** The card's club line in the board's case: «Manchester Piti · T1 · J1» / «Se revela en la J1». */
export function clubLineOf(upper: string): string {
  if (upper.startsWith("MANCHESTER PITI")) return "Manchester Piti" + upper.slice("MANCHESTER PITI".length);
  if (upper === "SE REVELA EN LA J1") return "Se revela en la J1";
  return upper;
}

/** The first word of a name («Jordi Sumba» → «Jordi»), or the apodo. */
export function firstName(full: string, nick: string): string {
  return full.trim().split(/\s+/)[0] || nick || "Tú";
}

export function cardBack(d: ProfileData, kind: Kind, origin: string): CardBack {
  const pid = kind === "jugador" ? d.ficha.playerId : null;
  const path = pid ? `/jugadores/${pid}` : "/club";
  return {
    name: (kind === "jugador" ? d.card.name || d.shirt.current : d.google.name || d.nickname).toUpperCase(),
    since: d.access.sinceText,
    howIn: d.access.howIn,
    whoOpened: d.access.whoOpened,
    path,
    url: `${origin}${path}`,
    nick: `@${d.nickname}`,
  };
}

/** The card the page shows. `typed`: the name being typed in «Tu nombre» (printed in CSS until it is stamped). */
export function cardOf(d: ProfileData, kind: Kind, origin: string, typed: string | null = null): CardModel {
  const back = cardBack(d, kind, origin);
  if (kind === "socio" || kind === "fan") return { kind: "carne", back };
  if (kind === "nuevo") return d.ficha.state === "pendiente" ? { kind: "pack", num: wantedNumber(d), back } : { kind: "down", back };
  const c = d.card;
  return {
    kind: "face",
    tier: c.tierKey,
    rating: c.showNumbers && c.rating !== null ? String(c.rating) : "",
    pos: c.pos ?? "",
    name: c.name || d.shirt.current.toUpperCase(),
    num: c.number,
    club: clubLineOf(c.clubLine),
    attrs: c.attrs.map((a) => ({ k: a.k, text: a.text })),
    typed,
    racha: c.racha,
    back,
  };
}

/** The dorsal a pending request asks for. */
export function wantedNumber(d: Pick<ProfileData, "ficha" | "shirt" | "freeFichas">): string {
  const id = d.ficha.claim?.playerId ?? d.ficha.playerId;
  return String(d.freeFichas.find((f) => f.id === id)?.number || d.shirt.squad.find((s) => s.id === id)?.number || "");
}

/** The card for a screen reader (component.js cardAria). */
export function cardAria(card: CardModel, d: ProfileData, flipped: boolean): string {
  if (card.kind === "carne") return `Tu carné de socio: desde ${card.back.since}, ${card.back.howIn.toLowerCase()}. No caduca.`;
  if (card.kind === "pack") return `Sobre cerrado con la carta del ${card.num}, esperando al capitán.`;
  if (card.kind === "down") return "Carta por revelar. Toca para elegir tu dorsal.";
  const c = d.card;
  const head = c.showNumbers && c.rating !== null ? `: ${c.tierName.toLowerCase()}, valoración ${c.rating}` : ", aún sin valoración";
  return `Tu carta${head}, ${c.posLong ?? "sin posición"}, dorsal ${card.num} con «${card.name}» a la espalda. ${flipped ? "Mostrando el dorso: tu carné de socio. Toca para ver el frente." : "Toca para ver el dorso."}`;
}

export interface Identity {
  name: string;
  line: string;
  chips: { t: string; cls: string }[];
}
/** The identity above the tabs (component.js idn). */
export function identityOf(d: ProfileData, kind: Kind, captain: boolean): Identity {
  const name = firstName(d.google.name, d.nickname);
  const nick = `@${d.nickname}`;
  if (kind === "jugador") {
    const c = d.card;
    const chip = c.showNumbers && c.rating !== null && c.tier ? { t: `Carta ${c.tierName.toLowerCase()}, ${c.rating}`, cls: `t-${c.tier}` } : { t: "Carta nueva", cls: "t-nuevo" };
    return { name, line: [c.number, c.posLong, nick].filter(Boolean).join(" · "), chips: [chip, ...(captain ? [{ t: "Capitán del vestuario", cls: "is-cap" }] : [])] };
  }
  const since = `${nick} · socio desde ${d.access.sinceText}`;
  if (kind === "nuevo") return { name, line: since, chips: [d.ficha.state === "pendiente" ? { t: "Ficha pendiente", cls: "is-warn" } : { t: "Sin ficha todavía", cls: "" }] };
  return { name, line: since, chips: [{ t: "Socio del club", cls: "" }, ...(captain ? [{ t: "Capitán del vestuario", cls: "is-cap" }] : [])] };
}

/** What each tab says it holds (component.js HINT). `avisos`: «Todo · 6 sin leer». */
export function hintOf(id: Sec | "avisos", d: ProfileData, kind: Kind, o: { avisos: string; themePref: "light" | "dark" | "system"; doorN: number; posPending: boolean }): string {
  const c = d.card;
  switch (id) {
    case "carta":
      if (kind === "socio") return `Socio desde ${d.access.sinceText}`;
      if (kind === "nuevo") return d.ficha.state === "pendiente" ? `Sobre cerrado · el ${wantedNumber(d)}` : "Por revelar";
      return c.showNumbers && c.rating !== null ? `${c.tierName} · ${c.rating}` : "Nueva · se revela al jugar";
    case "temporada": {
      if (!c.started) return "Sin partidos aún";
      const t = c.totals;
      if (!t.played) return "Sin partidos aún";
      return `${pl(t.played, "partido", "partidos")} · ${t.minutes !== null && t.minutes > 0 ? `${t.minutes}′` : pl(t.goals, "gol", "goles")}`;
    }
    case "posiciones":
      return (c.posLong ?? "Sin posición") + (o.posPending ? " · enviada" : "");
    case "nombre":
      return kind === "socio" ? `@${d.nickname}` : `${kind === "jugador" && d.shirt.current ? `${d.shirt.current.toUpperCase()} · ` : ""}@${d.nickname}`;
    case "avisos":
      return o.avisos;
    case "ajustes":
      return o.themePref === "system" ? "Como tu móvil" : o.themePref === "light" ? "Día" : "Noche";
    case "cuenta":
      return "Google, acceso y baja";
    case "capitania":
      return `${o.doorN} ${o.doorN === 1 ? "llama" : "llaman"} a la puerta`;
  }
}
