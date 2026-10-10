// The LED scoreboard (`.sb` desktop / `.mbd` phones) — the ONLY LED object of the admin: PITI · score ·
// rival, the line under the score (the running clock, «FINAL · SIN PUBLICAR»), the ticker and the
// «GOOOL» flash. As on the canvas (stats-gen/ad-v2-full.mjs `board`, `heroJuego`, `mJuego`).
import type { ReactNode } from "react";
import { AdIcon } from "../ui/icons";

export interface LedFlash {
  /** The scorer line under «GOOOL»: «ERIK · 31′ · pase de ADRIÁN T.C.». */
  text: string;
}
export interface LedBoardProps {
  rival: string;
  /** The rival's crest (HTTPS); a shield when there is none. */
  rivalLogoUrl?: string;
  gf: number;
  ga: number;
  /** The line under the score: the clock + «EN JUEGO», «FINAL · SIN PUBLICAR», «FINAL». */
  sub: ReactNode;
  /** `gd` = the gold LED (final, the flash). */
  subTone?: "" | "gd";
  /** The scrolling line under the panel (desktop): «J8 · LIGA · MAD SKY · DOMINGO 8 NOV 12:00 · …». */
  ticker?: string;
  /** While set, the panel shows «GOOOL» and the scorer instead of the score. */
  flash?: LedFlash | null;
  /** `mob` = the phone's compact board (`.mbd`). */
  size?: "desk" | "mob";
  /** The score digits flip in when they change (`.fl`); off for a board that only reads. */
  flip?: boolean;
}

const httpsLogo = (url?: string) => (url && /^https:\/\//i.test(url) ? url : "");

/** The scoreboard. The score is its own live region only while it flashes (the log says the rest). */
export function LedBoard({ rival, rivalLogoUrl, gf, ga, sub, subTone = "", ticker, flash, size = "desk", flip = true }: LedBoardProps) {
  const score = `${gf}-${ga}`;
  const logo = httpsLogo(rivalLogoUrl);
  if (size === "mob")
    return (
      <div className="mbd">
        <div className="pn" aria-label={`PITI ${gf}, ${rival} ${ga}`}>
          {flash ? (
            <div className="gfx2 gfx" role="status">
              <b>GOOOL</b>
              <span>{flash.text}</span>
            </div>
          ) : (
            <>
              <span className="tm">PITI</span>
              <span key={score} className={flip ? "led big fl" : "led big"}>
                {score}
              </span>
              <span className="tm">{rival}</span>
              <span className={subTone ? `sub ${subTone}` : "sub"}>{sub}</span>
            </>
          )}
        </div>
      </div>
    );
  return (
    <div className="sb">
      <div className="pn">
        <span className="tm">
          <img src="/crest-128.webp" alt="" width={60} height={60} />
          PITI
        </span>
        <div className="mid">
          {flash ? (
            <>
              <span className="led gd big gfx" role="status" style={{ fontSize: 100 }}>
                GOOOL
              </span>
              <span className="sub gd">{flash.text}</span>
            </>
          ) : (
            <>
              <span key={score} className={flip ? "led big fl" : "led big"} aria-label={`PITI ${gf}, ${rival} ${ga}`}>
                {score}
              </span>
              <span className={subTone ? `sub ${subTone}` : "sub"}>{sub}</span>
            </>
          )}
        </div>
        <span className="tm">
          <span className="rc">{logo ? <img src={logo} alt="" width={40} height={40} /> : <AdIcon name="shield" size={26} />}</span>
          {rival}
        </span>
      </div>
      {ticker ? (
        <div className="tick" aria-hidden="true">
          <span>{ticker}</span>
        </div>
      ) : null}
    </div>
  );
}
