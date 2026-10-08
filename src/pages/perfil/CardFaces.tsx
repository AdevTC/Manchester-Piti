// /profile «La carta»: the shirt seen from the back (the shirt name as arched vinyl over the dorsal,
// auto-shrunk n1–n4), the card's faces (front, back = carné de socio with the QR, the face-down card and
// the sealed pack) and the pizarra-style mini cromo. Markup and classes as designed (pf-g.mjs).
import type { ReactNode } from "react";
import { Qr } from "../acceso/Qr";
import { archLetters } from "./rules";
import type { CardRewards } from "./card";
import { printClass, vars } from "./fx";
import { CREST, Ic } from "./icons";

const SHIRT = (
  <svg viewBox="0 0 200 210" aria-hidden="true">
    <path className="sh" d="M62 8 C78 15 122 15 138 8 L190 34 L176 84 L156 76 L156 202 L44 202 L44 76 L24 84 L10 34 Z" />
    <path className="cl" d="M62 8 C78 15 122 15 138 8" fill="none" strokeWidth="5" />
  </svg>
);

/** The shirt's back with `name` printed on an arch above the dorsal (blank = no name yet). */
export function Tee({ name, num, blank = false, over = false }: { name: string; num: string; blank?: boolean; over?: boolean }) {
  const letters = archLetters(name);
  return (
    <span className={"tee" + (blank ? " blank" : "") + (over ? " over" : "")} aria-hidden="true">
      {SHIRT}
      <span className="tee-pr">
        <span className={"tee-n " + printClass(letters.length)}>
          {letters.map((l) => (
            <i key={l.i} style={vars({ "--i": l.i, "--y": l.y.toFixed(2), "--r": l.r.toFixed(1) + "deg" })}>
              {l.c}
            </i>
          ))}
        </span>
        <b className="tee-num">{num}</b>
        <span className="tee-sh" />
      </span>
    </span>
  );
}

const FOIL = (
  <>
    <span className="foil-w">
      <span className="foil" />
    </span>
    <span className="glare" />
  </>
);

export interface FrontFace {
  rating: string;
  pos: string;
  name: string;
  /** cf-nm size: '' ≤9 · l ≤12 · s longer. */
  nmCls: string;
  number: string;
  club: string;
  attrs: { k: string; text: string }[];
  racha: boolean;
  captain: boolean;
  rewards: CardRewards;
}
export interface BackFace {
  name: string;
  since: string;
  howIn: string;
  whoOpened: string;
  /** /jugadores/:id and the absolute link the QR encodes. */
  path: string;
  url: string;
}

/** The marks the earned evoluciones leave on the front (all decorative; the card's label says them). */
function Rewards({ r }: { r: CardRewards }) {
  const items: ReactNode[] = [];
  if (r.mvp)
    items.push(
      <i key="mvp" className="mvp">
        <Ic n="star" w={14} />
      </i>,
    );
  if (r.double) items.push(<i key="x2">×2</i>);
  if (r.hat)
    items.push(
      <i key="hat" className="hat">
        <Ic n="ball" w={14} />
      </i>,
    );
  if (r.goleador) items.push(<i key="g">G</i>);
  if (r.duo !== null)
    items.push(
      <i key="duo" className="duo">
        <Ic n="team" w={12} />
        {r.duo}
      </i>,
    );
  return items.length ? <span className="cf-ev">{items}</span> : null;
}

/** The hero card's faces (also what the share studio will show). */
export function Faces({ kind, front, back, nick, packNum }: { kind: "face" | "down" | "pack"; front: FrontFace; back: BackFace; nick: string; packNum: string }) {
  if (kind === "down")
    return (
      <span className="fc ft">
        <span className="fc-in dn">
          <span className="dn-pulse" />
          <img src={CREST} alt="" />
          <span className="dn-q">?</span>
          <span className="dn-t">
            <b>Carta por revelar</b>
            <span>@{nick}</span>
          </span>
          {FOIL}
        </span>
      </span>
    );
  if (kind === "pack")
    return (
      <span className="fc ft">
        <span className="fc-in">
          <span className="pk-band" />
          <span className="pk-band b" />
          <span className="pk-shine" />
          <span className="pk-c">
            <img src={CREST} alt="" />
            <span>SOBRE DEL VESTUARIO</span>
            <b>Tu carta</b>
          </span>
          <span className="pk-n">{packNum}</span>
          <span className="seal">
            <Ic n="clock" w={18} />
            <b>
              Esperando
              <br />
              al capitán
            </b>
            <small>DORSAL {packNum}</small>
          </span>
        </span>
      </span>
    );
  return (
    <>
      <span className="fc ft">
        <span className="fc-in">
          <span className="cf-rays" />
          {front.racha && <span className="cf-streak" />}
          <span className="cf-l">
            <span className="cf-rt">{front.rating}</span>
            <span className="cf-pos">{front.pos}</span>
            <span className="hr" />
            <img src={CREST} alt="" />
            <Rewards r={front.rewards} />
          </span>
          <span className="cf-art">
            <Tee name={front.name} num={front.number} />
            {front.captain && (
              <span className="cf-cap">
                <i>C</i>
              </span>
            )}
          </span>
          {front.racha && (
            <span className="cf-tag">
              <Ic n="flame" w={12} />
              EN RACHA
            </span>
          )}
          <span className={"cf-nm" + (front.nmCls ? " " + front.nmCls : "")}>{front.name}</span>
          <span className="cf-club">{front.club}</span>
          <span className="cf-at">
            {front.attrs.map((a) => (
              <span key={a.k}>
                <b>{a.text}</b>
                <i>{a.k}</i>
              </span>
            ))}
          </span>
          <img className="cf-tip" src={CREST} alt="" />
          {front.racha && (
            <span className="tw-st">
              <i />
              <i />
              <i />
              <i />
            </span>
          )}
          {FOIL}
        </span>
      </span>
      <span className="fc bk">
        <span className="fc-in cbk">
          <img className="cbk-wm" src={CREST} alt="" />
          <span className="cbk-h">
            <img src={CREST} alt="" />
            <span>
              CARNÉ DE SOCIO<b>{back.name}</b>
            </span>
          </span>
          <span className="dl">
            <span className="dr">
              <span className="dt">Socio desde</span>
              <span className="dd">{back.since}</span>
            </span>
            <span className="dr">
              <span className="dt">Cómo entraste</span>
              <span className="dd">{back.howIn}</span>
            </span>
            <span className="dr">
              <span className="dt">Te abrió</span>
              <span className="dd">{back.whoOpened}</span>
            </span>
            <span className="dr">
              <span className="dt">Caducidad</span>
              <span className="dd inf">
                <Ic n="inf" w={14} />
                No caduca
              </span>
            </span>
          </span>
          <span className="cbk-qr">
            <Qr text={back.url} />
            <small>{back.path}</small>
          </span>
          {FOIL}
        </span>
      </span>
    </>
  );
}

const CSHIRT = (
  <svg viewBox="0 0 200 210" aria-hidden="true">
    <path d="M62 8 C75 22 125 22 138 8 L190 34 L176 84 L156 76 L156 202 L44 202 L44 76 L24 84 L10 34 Z" />
  </svg>
);
/** The pizarra cromo, small (Tu ficha, the ficha picker). */
export function Cromo({ rt, pos, num, name }: { rt: string; pos: string; num: string; name: string }) {
  return (
    <span className="ac-f" aria-hidden="true">
      <span className="ac-top">
        <b>{rt}</b>
        <i>{pos}</i>
      </span>
      <span className="ac-art">
        {CSHIRT}
        <b>{num}</b>
      </span>
      <span className="ac-nm">{name}</span>
      <span className="foil-w">
        <span className="foil" />
      </span>
    </span>
  );
}
