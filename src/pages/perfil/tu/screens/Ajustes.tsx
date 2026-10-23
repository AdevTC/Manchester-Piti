// /perfil/ajustes (TU boards isAjustes): direct controls, saved at once on this device — the theme (Día · Noche ·
// Sistema), the card's walkout and its glare (players), the sound and the 3D stadium (the pizarra's own prefs),
// the animations (they follow «reducir movimiento») and where this device's notices are chosen.
import { useState } from "react";
import { PRESET_LABELS, usePushPreset } from "../../../../lib/push";
import { useTheme } from "../../../../hooks/useTheme";
import { useReducedMotion } from "../../../../components/vidrio";
import { Seg, Switch, TuIcon } from "../../../../components/vidrio/tu/ui";
import { readProfilePrefs, readSharedPrefs, writeProfilePrefs, writeSharedPrefs, type IntroPref } from "../../prefs";
import { secDesc } from "../model";
import type { ScreenProps } from "../MiPagina";
import { Screen } from "./Head";

export function Ajustes(p: ScreenProps) {
  const { say, who } = p;
  const { pref, setPref, theme } = useTheme();
  const reduced = useReducedMotion();
  const preset = usePushPreset();
  const [prefs, setPrefs] = useState(readProfilePrefs);
  const [shared, setShared] = useState(readSharedPrefs);
  const setIntro = (intro: IntroPref) => {
    const next = { ...prefs, intro };
    writeProfilePrefs(next);
    setPrefs(next);
    say("Cuenta desde tu próxima visita.");
  };
  const tema = pref === "system" ? "sistema" : pref === "light" ? "dia" : "noche";
  return (
    <Screen title="Ajustes" desc={secDesc("ajustes", who.kind, false)}>
      <ul className="tu-opts">
        <li>
          <span className="tu-opts__i">
            <TuIcon name="sun" />
          </span>
          <span className="tu-opts__t">
            <b id="tu-o-tema">Tema</b>
            <small>De día, de noche o como tu móvil.</small>
          </span>
          <Seg
            labelledBy="tu-o-tema"
            value={tema}
            onPick={(v) => {
              setPref(v === "dia" ? "light" : v === "noche" ? "dark" : "system");
              if (v === "sistema") say(`Sigue a tu móvil: ahora mismo, ${theme === "light" ? "de día" : "de noche"}.`);
            }}
            opts={[
              { v: "dia", t: "Día" },
              { v: "noche", t: "Noche" },
              { v: "sistema", t: "Sistema" },
            ]}
          />
        </li>
        {who.kind === "jugador" && (
          <>
            <li>
              <span className="tu-opts__i">
                <TuIcon name="cardi" />
              </span>
              <span className="tu-opts__t">
                <b id="tu-o-sal">Salida de la carta</b>
                <small>Cómo se presenta tu carta al abrir tu página.</small>
              </span>
              <Seg
                labelledBy="tu-o-sal"
                value={prefs.intro}
                onPick={setIntro}
                opts={[
                  { v: "siempre", t: "Cada vez" },
                  { v: "primera", t: "Solo la 1.ª" },
                  { v: "nunca", t: "Nunca" },
                ]}
              />
            </li>
            <li>
              <span className="tu-opts__i">
                <TuIcon name="flip" />
              </span>
              <span className="tu-opts__t">
                <b>Brillo al inclinar</b>
                <small>El brillo de la carta sigue el movimiento del móvil.</small>
              </span>
              <Switch
                label="Brillo al inclinar"
                on={prefs.tilt}
                onToggle={() => {
                  const next = { ...prefs, tilt: !prefs.tilt };
                  writeProfilePrefs(next);
                  setPrefs(next);
                }}
              />
            </li>
          </>
        )}
        <li>
          <span className="tu-opts__i">
            <TuIcon name="whistle" />
          </span>
          <span className="tu-opts__t">
            <b>Sonido</b>
            <small>Silbato y red en la pizarra; los pitidos de tu carta.</small>
          </span>
          <Switch label="Sonido" on={shared.sound} onToggle={() => setShared(writeSharedPrefs({ sound: !shared.sound }))} />
        </li>
        <li>
          <span className="tu-opts__i">
            <TuIcon name="shield" />
          </span>
          <span className="tu-opts__t">
            <b>Estadio en 3D</b>
            <small>La pizarra en 3D. Si tu móvil va justo, quítalo.</small>
          </span>
          <Switch label="Estadio en 3D" on={shared.stadium3d} onToggle={() => setShared(writeSharedPrefs({ stadium3d: !shared.stadium3d }))} />
        </li>
        <li>
          <span className="tu-opts__i">
            <TuIcon name="play" />
          </span>
          <span className="tu-opts__t">
            <b>Animaciones</b>
            <small>{reduced ? "Tu móvil pide menos movimiento: la carta sale quieta y las pantallas cambian con un fundido corto." : "Animaciones completas. Si activas «reducir movimiento» en tu móvil, la web lo sigue sola."}</small>
          </span>
        </li>
        <li>
          <span className="tu-opts__i">
            <TuIcon name="bell" />
          </span>
          <span className="tu-opts__t">
            <b>Avisos</b>
            <small>Este móvil: {PRESET_LABELS[preset.choice]}. Se eligen en Avisos a medida.</small>
          </span>
          <button type="button" className="vd-link" onClick={() => p.go({ page: "avisos", sec: "carta", open: null })}>
            Avisos a medida
          </button>
        </li>
      </ul>
    </Screen>
  );
}
