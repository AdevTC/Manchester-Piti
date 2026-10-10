// A confirmation as a broadcast caption (`.lt`, the «lower third»): a short tag (J8, FICHA, ALTA, WEB, C…),
// the message and, when the action can be taken back, «Deshacer» (errors: «Reintentar»). Bottom-left of
// the frame; on phones above the bar, the workspace footer or the pads (`--ltb`, set by the shell).
// The toasts (ui/toasts.tsx) render it; it is exported for anything that needs the same caption.
import type { ReactNode } from "react";
import { AdIcon } from "../ui/icons";

export interface LowerThirdProps {
  /** The short tag on the sky block (≤ 6 characters reads best). */
  tag: string;
  message: ReactNode;
  action?: { label: string; onClick: () => void; icon?: "undo" | "back" };
  /** `error` = red tag and rule. */
  tone?: "ok" | "error";
}
export function LowerThird({ tag, message, action, tone = "ok" }: LowerThirdProps) {
  return (
    <div className={tone === "error" ? "lt err" : "lt"}>
      <span className="k">{tag}</span>
      <span className="t">
        <span>{message}</span>
        {action ? (
          <button type="button" onClick={action.onClick}>
            <AdIcon name={action.icon ?? "undo"} size={16} />
            {action.label}
          </button>
        ) : null}
      </span>
    </div>
  );
}
