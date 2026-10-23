// «Este móvil» (TU boards, avisos.ts deviceView): whether this browser can ring (or the DEV maqueta's ?movil=),
// its preset («Solo goles · Todo · Nada · A medida»), «Vibrar con los goles», its pause; and the pieces that set
// them (deviceParts.tsx).
import { readTuMaqueta } from "../../../components/vidrio/tu/maqueta";
import { setPushVibrate, usePushPause, usePushPreset, type PushChoice, type PushPause, type PushPreset } from "../../../lib/push";
import { useClock } from "../../../hooks/useClock";
import { usePushDevice } from "../usePushDevice";
import { deviceName, osOf, unblockSteps } from "../avisos";
import { isStandalone, userAgent } from "../device";
import { blockedText, deviceKindOf, deviceWords, presetLine, type DeviceKind, type DeviceWords } from "./model";

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

