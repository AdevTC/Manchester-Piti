// «Este móvil» (TU boards, avisos.ts deviceView): whether this browser can ring (or the DEV maqueta's ?movil=),
// its preset («Solo goles · Todo · Nada · A medida»), «Vibrar con los goles», its pause; and the pieces that set
// them: the preset's segmented control and the pause chips.
import { useState, type CSSProperties } from "react";
import { readTuMaqueta } from "../../../components/vidrio/tu/maqueta";
import { pushSaveError, setPushVibrate, usePushPause, usePushPreset, type PushChoice, type PushPause, type PushPreset } from "../../../lib/push";
import { useClock } from "../../../hooks/useClock";
import { usePushDevice } from "../usePushDevice";
import { deviceName, osOf, unblockSteps } from "../avisos";
import { isStandalone, userAgent } from "../device";
import { blockedText, deviceKindOf, deviceWords, pauseLine, PAUSES, presetLine, PRESET_WORD, type DeviceKind, type DeviceWords } from "./model";
import type { AvisoActions } from "./parts";

export interface ThisDevice {
  kind: DeviceKind;
  words: DeviceWords;
  ready: boolean;
  blocked: string;
  choice: PushChoice;
  vibrate: boolean;
  pause: PushPause | null;
  line: string;
  setPreset: (p: PushPreset) => Promise<void>;
  setVibrate: (v: boolean) => Promise<void>;
  refresh: () => void;
}

export function useThisDevice(): ThisDevice {
  const maq = readTuMaqueta();
  const dev = usePushDevice();
  const preset = usePushPreset();
  const now = useClock(60_000);
  const { pause } = usePushPause(now);
  const ua = userAgent();
  const kind = deviceKindOf(dev.state, maq?.movil ?? null);
  const words = deviceWords(kind, { name: deviceName(ua), receiving: preset.choice !== "nada" && dev.topics.length > 0, unblock: unblockSteps(ua, isStandalone()).map((s) => s.replace(/\*/g, "")), ipad: osOf(ua) === "ipad" });
  return {
    kind,
    words,
    ready: kind === "listo",
    blocked: blockedText(kind),
    choice: preset.choice,
    vibrate: preset.vibrate,
    pause,
    line: presetLine(preset.choice, !!pause),
    setPreset: async (p) => {
      await preset.set(p, p === "nada" ? false : preset.vibrate);
    },
    setVibrate: async (v) => {
      if (preset.choice === "nada") return;
      await setPushVibrate(v);
    },
    refresh: dev.refresh,
  };
}

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

export const pauseText = (p: PushPause | null): string => (p ? pauseLine(p.kind) : "");
