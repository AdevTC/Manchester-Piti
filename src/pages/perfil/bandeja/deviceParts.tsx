// «Este móvil»'s controls (TU boards): the preset's segmented control and the pause chips (the state: device.ts).
import { useState, type CSSProperties } from "react";
import { pushSaveError, type PushChoice, type PushPreset } from "../../../lib/push";
import { PAUSES, PRESET_WORD } from "./model";
import type { AvisoActions } from "./actions";
import type { ThisDevice } from "./device";

const SAID: Record<PushPreset, string> = { nada: "Este móvil ya no recibe avisos. La campana sigue guardándolos.", goles: "Solo goles en este móvil.", todo: "Todo: el partido y lo tuyo." };

/** The shortcuts (the bell's three, A medida's four): «A medida» only says where the topics are. */
export function PresetSeg({ d, four, say, label, labelledBy, onCustom }: { d: ThisDevice; four?: boolean; say: (t: string) => void; label?: string; labelledBy?: string; onCustom?: () => void }) {
  const [busy, setBusy] = useState(false);
  const opts: PushChoice[] = four ? ["goles", "todo", "nada", "custom"] : ["goles", "todo", "nada"];
  const i = Math.max(0, opts.indexOf(d.choice));
  const pick = (c: PushChoice) => {
    if (busy) return;
    if (c === "custom") {
      onCustom?.();
      return;
    }
    if (!d.ready) {
      say("Primero, este móvil tiene que estar listo.");
      return;
    }
    setBusy(true);
    d.setPreset(c).then(
      () => say(SAID[c]),
      (e: unknown) => say(pushSaveError(e)),
    ).finally(() => setBusy(false));
  };
  return (
    <div className={`vd-glass vd-seg tu-oseg${four ? " tu-oseg--4" : ""}`} role="group" aria-label={label} aria-labelledby={labelledBy} style={{ "--n": opts.length, "--i": i } as CSSProperties}>
      {opts.includes(d.choice) && <span className="vd-shelf__bead" aria-hidden="true" />}
      {opts.map((c) => (
        <button key={c} type="button" className="vd-seg__b" data-nav="1" aria-pressed={d.choice === c} aria-busy={busy || undefined} onClick={() => pick(c)}>
          {PRESET_WORD[c]}
        </button>
      ))}
    </div>
  );
}

/** «Una hora · Hasta mañana · Hasta después del partido»: the one on is pressed; pressing it again resumes. */
export function PauseChips({ d, a }: { d: ThisDevice; a: AvisoActions }) {
  return (
    <div className="tu-chips">
      {PAUSES.map((x) => {
        const on = d.pause?.kind === x.k;
        return (
          <button key={x.k} type="button" className="vd-glass vd-press tu-chip" aria-pressed={on} onClick={() => (on ? a.resume() : a.pause(x.k))}>
            {x.t}
          </button>
        );
      })}
    </div>
  );
}

