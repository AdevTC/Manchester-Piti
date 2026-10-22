// «Avisos a medida» (V-Integracion, the bell's sheet and «Todos los avisos»): what this device is told — «Solo
// goles», «Todo» or «Nada» (a glass segmented control, the board's note under it) and «Vibrar con los goles»
// (off by default). A device that can't get notices says why instead (iPhone without the web on the home
// screen, notices blocked, a browser without them). The choice lives in lib/push (usePushPreset / setPushPreset).
import { useState, type CSSProperties } from "react";
import { PRESET_NOTES, PUSH_PRESETS, PRESET_LABELS, PUSH_WHY, pushSaveError, usePushPreset, type PushPreset } from "../../../lib/push";

export function AvisosPrefs({ className = "" }: { className?: string }) {
  const p = usePushPreset();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const index = PUSH_PRESETS.indexOf(p.choice as PushPreset);
  const pick = (preset: PushPreset, vibrate: boolean) => {
    setBusy(true);
    setError("");
    p.set(preset, vibrate).then(
      () => setBusy(false),
      (e: unknown) => {
        setBusy(false);
        setError(pushSaveError(e));
      },
    );
  };
  return (
    <div className={`vd-prefs ${className}`}>
      <p className="vd-label" id="vd-prefs-t">
        Avisos a medida
      </p>
      {p.state !== "ready" ? (
        <p className="vd-small">{PUSH_WHY[p.state]}</p>
      ) : (
        <>
          <div className="vd-glass vd-seg" style={{ "--n": PUSH_PRESETS.length, "--i": Math.max(0, index) } as CSSProperties} role="group" aria-labelledby="vd-prefs-t">
            {index >= 0 && <span className="vd-shelf__bead" aria-hidden="true" />}
            {PUSH_PRESETS.map((preset) => (
              <button key={preset} type="button" className="vd-seg__b" aria-pressed={p.choice === preset} disabled={busy} onClick={() => pick(preset, p.vibrate)}>
                {PRESET_LABELS[preset]}
              </button>
            ))}
          </div>
          <p className="vd-small" role="status">
            {error || PRESET_NOTES[p.choice]}
          </p>
          <button
            type="button"
            className="vd-switch"
            role="switch"
            aria-checked={p.vibrate}
            disabled={busy || p.choice === "nada" || p.choice === "custom"}
            onClick={() => pick(p.choice as PushPreset, !p.vibrate)}
          >
            <span className="vd-switch__track" aria-hidden="true">
              <span className="vd-switch__knob" />
            </span>
            Vibrar con los goles
          </button>
        </>
      )}
    </div>
  );
}
