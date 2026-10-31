// The card on Tú's stage (TuCarta tc-card): a player's front — GLOBAL, position, the crest and the marks his
// evoluciones earned, his printed shirt, his name, the club's line and the six numbers, each a button that opens
// «De qué está hecho» (`onAttr`) — and its back, his carné with a real QR; a socio's card is his carné; a new
// account's the closed sobre (`onPack`: «Ver mi petición») or the ghost to pick a dorsal. The seal counts what
// waits on him. The walkout (`run`) and the flip are off under reduced motion (CSS). The shell owns its state.
import type { CSSProperties } from "react";
import { Qr } from "../../../acceso/Qr";
import { ATTRS, type AttrKey } from "../../../../lib/derived/card";
import { Shirt, Tee, type CardModel } from "../TuCard";
import { Seal } from "./Seal";
import { tierCls } from "./tierCls";

const ORDER: AttrKey[] = ["GOL", "MVP", "ASI", "PJ", "MIN", "FOR"];
const NAME: Record<AttrKey, string> = Object.fromEntries(ATTRS.map((a) => [a.k, a.label])) as Record<AttrKey, string>;
NAME.FOR = "Forma reciente";

export interface CardStageProps {
  card: CardModel;
  /** Its accessible name (cardAria). */
  aria: string;
  flip: boolean;
  onFlip: () => void;
  /** The walkout's run (even/odd restarts the CSS animation). */
  run: number;
  /** What waits on him (the seal; nothing at 0). */
  pending: number;
  /** A number of the front was tapped: open «De qué está hecho» for it. */
  onAttr: (k: AttrKey) => void;
  /** The sobre was tapped: «Ver mi petición». */
  onPack?: () => void;
  /** «Provisional» under the rating. */
  provisional?: boolean;
  /** The marks his evoluciones earned («MVP», «×2»). */
  marks?: string[];
  /** The line under the card. */
  hint?: string;
  /** View Transition name: the card morphs into the masthead's mini card. */
  vt?: string;
}

function Back({ card }: { card: CardModel }) {
  const b = card.back;
  const rows: [string, string][] = [
    ["Socio desde", b.since],
    ["Cómo entraste", b.howIn],
    ["Te abrió", b.whoOpened],
    ["Apodo", b.nick],
  ];
  return (
    <div className="tc-back">
      <div className="tc-back__h">
        <img src="/crest-128.webp" alt="" width="38" height="38" />
        <span>
          <b>Carné de socio</b>Manchester Piti
        </span>
      </div>
      <p className="tc-back__n">{b.name}</p>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="tc-qr">
        <Qr text={b.url} />
        <span>
          <b>{b.path}</b>
          {b.path === "/club" ? "La página del club." : "Tu página pública: lo que ve la afición."}
        </span>
      </div>
    </div>
  );
}

export function CardStage(p: CardStageProps) {
  const { card } = p;
  const style = p.vt ? ({ viewTransitionName: p.vt } as CSSProperties) : undefined;
  if (card.kind === "pack")
    return (
      <div className="tc-cardcol">
        <div className="tc-card is-socio" style={style}>
          <Seal n={p.pending} />
          <button type="button" className="tc-pack" onClick={p.onPack} aria-label={`Sobre cerrado: tu petición de la ficha del ${card.num}. Ver tu petición`}>
            <span className="tc-pack__wax" aria-hidden="true">
              {card.num}
            </span>
            <b>Sobre cerrado</b>
            <span>La ficha del {card.num}</span>
            <span>Toca para ver tu petición</span>
          </button>
        </div>
        <p className="tc-hint">{p.hint ?? "Se abre cuando el capitán diga que sí: entonces sale tu carta."}</p>
      </div>
    );
  if (card.kind === "down")
    return (
      <div className="tc-cardcol">
        <div className="tc-ghost" style={style}>
          <span>
            <b>Sin ficha todavía</b>Elige la tuya en el vestuario y el capitán la confirma.
          </span>
        </div>
      </div>
    );
  const face = card.kind === "face";
  const back = !face || p.flip;
  const cls = ["tc-card", tierCls(card), back ? "is-back" : "", face && card.racha ? "is-racha" : "", p.pending === 0 && face ? "is-clear" : "", `run-${p.run % 2}`].filter(Boolean).join(" ");
  return (
    <div className="tc-cardcol">
      <div className={cls} role="group" aria-label={p.aria} style={style}>
        <Seal n={p.pending} />
        <div className="tc-card__in">
          {face && (
            <div className="tc-face tc-face--front" aria-hidden={back}>
              <button type="button" className="tc-flip" onClick={p.onFlip} disabled={back} aria-label="Dar la vuelta a tu carta: ver tu carné" />
              <div className="tc-front">
                <div className="tc-front__top">
                  <div className="tc-rate">
                    <b>{card.rating}</b>
                    <span>{card.pos}</span>
                    {p.provisional && <small>provisional</small>}
                  </div>
                  <div className="tc-marks">
                    <img className="tc-crest" src="/crest-128.webp" alt="" width="46" height="46" />
                    {(p.marks ?? []).map((m) => (
                      <span key={m} className="tc-mark">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="tc-art">{card.typed !== null ? <Tee name={card.typed} num={card.num} className="tc-shirt" /> : <Shirt num={card.num} className="tc-shirt" />}</div>
                <p className="tc-name">{card.name}</p>
                <p className="tc-club">{card.club}</p>
                <div className="tc-attrs">
                  {ORDER.map((k) => {
                    const a = card.attrs.find((x) => x.k === k);
                    const v = a?.text ?? "—";
                    return (
                      <button key={k} type="button" className="tc-attr" onClick={() => p.onAttr(k)} disabled={back} aria-label={`${NAME[k]}: ${v === "—" ? "sin datos aún" : v}. Ver de qué está hecho`}>
                        <b>{v}</b>
                        <small>{k}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div className="tc-face tc-face--back" aria-hidden={!back}>
            {face && <button type="button" className="tc-flip" style={{ height: "100%", borderRadius: 26 }} onClick={p.onFlip} disabled={!back} aria-label="Volver al frente de tu carta" />}
            <Back card={card} />
          </div>
        </div>
      </div>
      <p className="tc-hint">{p.hint ?? (face ? "Toca la carta para darle la vuelta. Toca un número para ver de qué está hecho." : "Sin ficha, tu carta es tu carné de socio.")}</p>
      {face && (
        <button type="button" className="vd-glass vd-press nx-btn tc-flipbtn" onClick={p.onFlip}>
          {p.flip ? "Ver el frente" : "Ver el dorso: tu carné"}
        </button>
      )}
    </div>
  );
}
