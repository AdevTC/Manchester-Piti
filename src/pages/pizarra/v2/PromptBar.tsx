// The prompt bar (desktop, mouse + keyboard; the CSS hides it on touch screens): the FC-style line along
// the bottom with the shortcuts of the moment and, with a player in the hand, his actions (prompt.ts).
// The items that act are real buttons (the same thing the key does); the rest only teach the key. The
// autosave line closes it on the right.
import { promptItems, promptKey, type PromptActs, type PromptCtx } from "./prompt";

export interface PromptBarProps {
  ctx: PromptCtx;
  acts: PromptActs;
  saveTxt: string;
  saveCls: string;
}

export function PromptBar({ ctx, acts, saveTxt, saveCls }: PromptBarProps) {
  const items = promptItems(ctx, acts);
  // a new context plays the items in again
  const k = promptKey(ctx);
  return (
    <div className="pmb in" role="toolbar" aria-label="Atajos y acciones" data-k={k}>
      {items.map((m, i) => {
        const cls = "pm" + (m.cls ? " " + m.cls : "");
        const style = { animationDelay: (i * 0.04).toFixed(2) + "s" };
        return m.go ? (
          <button key={k + i} type="button" className={cls} onClick={m.go} style={style} aria-label={m.t + " (" + m.k + ")"}>
            <kbd aria-hidden="true">{m.k}</kbd>
            {m.t}
          </button>
        ) : (
          <span key={k + i} className={cls} style={style}>
            <kbd>{m.k}</kbd>
            {m.t}
          </span>
        );
      })}
      <span className="pm-sv">
        <i className={saveCls} aria-hidden="true" />
        {saveTxt}
      </span>
    </div>
  );
}
