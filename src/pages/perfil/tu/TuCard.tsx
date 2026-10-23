// Tú's card (TU boards card.html): the identity. A player's front is his carta (rating, position, the crest, his
// printed shirt, his name, the club's line and the six numbers), its back his carné with a real QR to his page; a
// new account's is the closed sobre (his request) or the card face down (pick a dorsal); a socio's is his carné.
// The shirt is always the printed still; only the name being typed in «Tu nombre» is printed in CSS (Barlow, on
// the blank still), as the board allows.
import { useContext, useLayoutEffect, useRef, type CSSProperties } from "react";
import { KitStillContext } from "../../../components/jersey3d/kitStill";
import { Qr } from "../../acceso/Qr";
import { TuIcon } from "../../../components/vidrio/tu/ui";
import type { TierKey } from "../card";

export interface CardBack {
  /** The name on the carné (a player's shirt name, a socio's full name). */
  name: string;
  since: string;
  howIn: string;
  whoOpened: string;
  /** /jugadores/<id> (players) or /club. */
  path: string;
  url: string;
  nick: string;
}

export type CardModel =
  | {
      kind: "face";
      tier: TierKey;
      rating: string;
      pos: string;
      name: string;
      num: string;
      club: string;
      attrs: { k: string; text: string }[];
      /** The name typed in «Tu nombre» that is not on the still yet (printed in CSS). */
      typed: string | null;
      racha: boolean;
      back: CardBack;
    }
  | { kind: "pack"; num: string; back: CardBack }
  | { kind: "down"; back: CardBack }
  | { kind: "carne"; back: CardBack };

/** The shirt with a name printed in CSS on the blank still (the board's tu-tee; the name fits the back). */
export function Tee({ name, num, kit = "home", className = "" }: { name: string; num: string; kit?: "home" | "away"; className?: string }) {
  const still = useContext(KitStillContext);
  const blank = still(kit);
  const ref = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement?.parentElement;
    if (!el || !box) return;
    el.style.transform = "";
    const w = box.clientWidth * (220 / 540);
    const nat = el.scrollWidth;
    el.style.transform = w && nat > w ? `translateX(-50%) scaleX(${(w / nat).toFixed(3)})` : "translateX(-50%)";
  }, [name]);
  return (
    <span className={`tu-tee k-${kit}${className ? ` ${className}` : ""}`}>
      {blank ? <img src={blank.src} alt="" /> : null}
      <span className="tu-tee__print">
        <b ref={ref} className="tu-tee__name">
          {name}
        </b>
        <b className="tu-tee__num">{num}</b>
      </span>
    </span>
  );
}

/** A player's printed shirt still (nothing until it is drawn: never a CSS-printed number). */
export function Shirt({ num, kit = "home", className, ghost }: { num?: string; kit?: "home" | "away"; className: string; ghost?: boolean }) {
  const still = useContext(KitStillContext)(kit, num);
  if (!still) return <span className={className} aria-hidden="true" />;
  return <img className={`${className}${ghost ? " is-ghost" : ""}`} src={still.src} alt="" />;
}

function Back({ back, carne }: { back: CardBack; carne: boolean }) {
  return (
    <span className={`tu-card__face tu-card__back${carne ? " tu-card__carne" : ""}`} aria-hidden="true">
      <span className="tu-card__bh">
        <img src="/crest-128.webp" alt="" />
        <span>
          <small>Carné de socio</small>
          <b>{back.name}</b>
        </span>
      </span>
      {carne && <span className="tu-card__nick">{back.nick}</span>}
      <span className="tu-card__dl">
        <span>
          <i>Socio desde</i>
          <b>{back.since}</b>
        </span>
        <span>
          <i>Cómo entraste</i>
          <b>{back.howIn}</b>
        </span>
        <span>
          <i>Te abrió</i>
          <b>{back.whoOpened}</b>
        </span>
        <span>
          <i>Caducidad</i>
          <b>No caduca</b>
        </span>
      </span>
      <span className="tu-card__qr">
        <span className="tu-qr tu-qr--real">
          <Qr text={back.url} />
        </span>
        <small>{back.path}</small>
      </span>
    </span>
  );
}

export function TuCard({ card, flip, run, label, onTap, width }: { card: CardModel; flip: boolean; run: number; label: string; onTap: () => void; width?: number }) {
  const tier = card.kind === "face" && card.tier !== "down" && card.tier !== "pack" ? card.tier : "nuevo";
  const cls = ["tu-card", `k-${card.kind}`, `t-${tier}`, flip && card.kind === "face" ? "is-flip" : "", card.kind === "face" && card.racha ? "is-racha" : "", `run-${run % 2}`].filter(Boolean).join(" ");
  return (
    <div className={cls} style={width ? ({ "--cw": `${width}px` } as CSSProperties) : undefined}>
      <button type="button" className="tu-card__btn" onClick={onTap} aria-label={label}>
        <span className="tu-card__flip">
          {card.kind === "face" && (
            <>
              <span className="tu-card__face tu-card__front" aria-hidden="true">
                <span className="tu-card__top">
                  <b className="tu-card__rt">{card.rating}</b>
                  <span className="tu-card__pos">{card.pos}</span>
                </span>
                <img className="tu-card__crest" src="/crest-128.webp" alt="" />
                <span className="tu-card__art">{card.typed !== null ? <Tee name={card.typed} num={card.num} className="tu-card__shirt" /> : <Shirt num={card.num} className="tu-card__shirt" />}</span>
                <span className="tu-card__plate">
                  <b className="tu-card__name">{card.name}</b>
                  <span className="tu-card__club">{card.club}</span>
                </span>
                <span className="tu-card__attrs">
                  {card.attrs.map((a) => (
                    <span key={a.k}>
                      <b>{a.text}</b>
                      <i>{a.k}</i>
                    </span>
                  ))}
                </span>
              </span>
              <Back back={card.back} carne={false} />
            </>
          )}
          {card.kind === "pack" && (
            <span className="tu-card__face tu-card__pack" aria-hidden="true">
              <span className="tu-card__band" />
              <img className="tu-card__seal" src="/crest-128.webp" alt="" />
              <span className="tu-card__pk">
                <small>Sobre del vestuario</small>
                <b>Tu carta</b>
              </span>
              <span className="tu-card__wait">
                <TuIcon name="clock" />
                <b>Esperando al capitán</b>
                <small>Dorsal {card.num}</small>
              </span>
            </span>
          )}
          {card.kind === "down" && (
            <span className="tu-card__face tu-card__down" aria-hidden="true">
              <img className="tu-card__crest" src="/crest-128.webp" alt="" />
              <span className="tu-card__art">
                <Shirt className="tu-card__shirt" ghost />
              </span>
              <span className="tu-card__q">?</span>
              <span className="tu-card__plate">
                <b className="tu-card__name">Carta por revelar</b>
                <span className="tu-card__club">{card.back.nick}</span>
              </span>
            </span>
          )}
          {card.kind === "carne" && <Back back={card.back} carne />}
        </span>
      </button>
    </div>
  );
}
