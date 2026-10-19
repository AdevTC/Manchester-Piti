// Hoy's words under the lens: the headline (the scorer's name sets with the goal moment), its line, the
// actions of the phase, the viewer's own line and the weather's.
import type { ReactNode } from "react";
import { Ico } from "./icons";

export interface HoyHeadProps {
  h1: string;
  lede: string;
  actions: ReactNode;
  me: { initial: string; line: string } | null;
  weather: string | null;
  /** «Evans, Fer, Illescas…» (the 1920 centre, compact). */
  onPitch: string | null;
  /** The goal moment's class for the headline (the name sets). */
  nameClass?: string;
  className?: string;
}

export function HoyHead({ h1, lede, actions, me, weather, onPitch, nameClass, className }: HoyHeadProps) {
  return (
    <div className={`vi-head${className ? ` ${className}` : ""}`}>
      <h1 className="vd-h1 vi-h1">
        <span className={`vi-scorer${nameClass ? ` ${nameClass}` : ""}`}>{h1}</span>
      </h1>
      {lede && <p className="vd-lede vi-lede">{lede}</p>}
      <div className="vi-acts">{actions}</div>
      {(me || weather) && (
        <div className="vi-lines">
          {me && (
            <p className="vi-me">
              <i aria-hidden="true">{me.initial}</i>
              <span>{me.line}</span>
            </p>
          )}
          {weather && (
            <p className="vi-wx">
              <Ico id="sunset" />
              <span>{weather}</span>
            </p>
          )}
        </div>
      )}
      {onPitch && (
        <p className="vi-onpitch">
          <b>En el campo:</b> {onPitch}
        </p>
      )}
    </div>
  );
}
