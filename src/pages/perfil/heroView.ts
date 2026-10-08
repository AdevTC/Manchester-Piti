// /profile «La carta»: what the hero shows for each state (vinculada / pendiente / sin ficha, the season
// started or not) — the card's faces, label and classes, the LED videoboard, the walkout pieces, the
// tier chip, the hint. Pure: the page passes the data plus what is on screen right now (the shirt name
// just stamped, the flip).
import { tickerFor, type CardView, type FichaState, type Ticker } from "./card";
import type { BackFace, FrontFace } from "./CardFaces";

export interface HeroInput {
  card: CardView;
  /** The shirt name on the card now (just stamped names show before the data echoes them). */
  shirt: string;
  nick: string;
  flip: boolean;
  stampN: number;
  access: { sinceText: string; howIn: string; whoOpened: string };
  origin: string;
}

export interface HeroView {
  state: FichaState;
  vinc: boolean;
  pend: boolean;
  sin: boolean;
  started: boolean;
  showN: boolean;
  kind: "face" | "down" | "pack";
  front: FrontFace;
  back: BackFace;
  cardCls: string;
  /** The card's colours (the t-… class): bronce · plata · oro · racha · nuevo. */
  tierCls: string;
  cardAria: string;
  ticker: Ticker;
  tierKey: string;
  tierName: string;
  tierWhy: string;
  bigTxt: string;
  seq: { pos: string; posLongUp: string; num: string; odoT: number; odoU: number };
  srStatus: string;
  hint: string;
  heroName: string;
  /** The ficha asked for (pendiente) or yours: its dorsal and name. */
  num: string;
  claimName: string;
}

const REWARD_WORDS: [keyof Omit<FrontFace["rewards"], "duo">, string][] = [
  ["trail", "estela dorada en el nombre"],
  ["fijo", "marco «Fijo»"],
  ["mvp", "estrella de MVP"],
  ["double", "sello «×2»"],
  ["hat", "balón de oro"],
  ["goleador", "sello de goleador"],
];

/** cf-nm: '' up to 9 characters, l up to 12, s longer. */
export const nameClass = (name: string): string => (name.length <= 9 ? "" : name.length <= 12 ? "l" : "s");

export function heroView(i: HeroInput): HeroView {
  const c = i.card;
  const state = c.state;
  const vinc = state === "vinculada";
  const pend = state === "pendiente";
  const sin = state === "sin-ficha";
  const showN = c.showNumbers;
  const shirt = vinc ? i.shirt : c.name;
  const num = c.number;
  const posLong = c.posLong ?? "Jugador";
  const flip = vinc && i.flip;
  const tierCls = c.tierKey === "down" || c.tierKey === "pack" ? "nuevo" : c.tierKey;
  const r = c.rewards;
  const cardCls = [
    "t-" + tierCls,
    flip ? "flipped" : "",
    vinc ? "" : pend ? "pack" : "down",
    i.stampN ? (i.stampN % 2 ? "st-a" : "st-b") : "",
    r.trail ? "ev-trail" : "",
    r.fijo ? "ev-fijo" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const attrs = c.attrs.map((a) => ({ k: a.k, text: a.text }));
  const won = [...REWARD_WORDS.filter(([k]) => r[k]).map(([, w]) => w), ...(r.duo !== null ? [`placa dúo con el ${r.duo}`] : [])];
  const cardAria = vinc
    ? "Tu carta" +
      (showN ? ": valoración " + c.ratingText : ", aún sin valoración") +
      ", " +
      posLong +
      (num ? ", dorsal " + num : "") +
      " con «" +
      shirt +
      "» a la espalda, carta " +
      c.tierName +
      ". " +
      (showN ? attrs.map((a) => a.k + " " + a.text).join(", ") + ". " : "Se revela en la J1. ") +
      (won.length ? "En la carta: " + won.join(", ") + ". " : "") +
      (flip ? "Mostrando el dorso: tu carné de socio. Toca para ver el frente." : "Toca para ver el dorso.")
    : pend
      ? "Sobre cerrado con la carta del " + num + ", esperando al capitán. Toca para ver tu petición."
      : "Carta por revelar. Toca para elegir tu dorsal.";
  const ticker = tickerFor({ state, name: shirt, number: num, posLong: c.posLong, captain: c.captain, nickname: i.nick });
  const rt = showN ? c.ratingText : "";
  const odoT = rt.length > 1 ? Number(rt[0]) : 0;
  const odoU = rt ? Number(rt[rt.length - 1]) : 0;
  const path = c.playerId ? `/jugadores/${c.playerId}` : "/jugadores";
  return {
    state,
    vinc,
    pend,
    sin,
    started: c.started,
    showN,
    kind: vinc ? "face" : pend ? "pack" : "down",
    front: {
      rating: c.ratingText,
      pos: vinc ? (c.pos ?? "?") : "?",
      name: shirt,
      nmCls: nameClass(shirt),
      number: num,
      club: c.clubLine,
      attrs,
      racha: vinc && c.racha,
      captain: vinc && c.captain,
      rewards: r,
    },
    back: { name: shirt, since: i.access.sinceText, howIn: i.access.howIn, whoOpened: i.access.whoOpened, path, url: i.origin + path },
    cardCls,
    tierCls,
    cardAria,
    ticker,
    tierKey: c.tierKey,
    tierName: c.tierName,
    tierWhy: c.tierWhy,
    bigTxt: vinc ? (showN ? c.ratingText : num || "?") : "?",
    seq: { pos: c.pos ?? "?", posLongUp: posLong.toLocaleUpperCase("es-ES"), num, odoT, odoU: 20 + odoU },
    srStatus: vinc ? "Tu carta: " + (showN ? c.ratingText + ", " : "") + posLong + (num ? ", dorsal " + num : "") : pend ? "Sobre cerrado: esperando al capitán" : "Carta por revelar",
    hint: vinc ? "Toca la carta para girarla · muévela para ver el brillo" : pend ? "Te avisamos en cuanto el capitán conteste" : "Toca la carta para elegir tu dorsal",
    heroName: vinc ? shirt : "@" + i.nick,
    num,
    claimName: c.name,
  };
}
