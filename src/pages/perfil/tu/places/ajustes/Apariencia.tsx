// Ajustes › Apariencia (TuCarta ajApariencia; today's screens/Ajustes): saved at once on this device — the theme
// (Día · Noche · Sistema, live through useTheme), the card's walkout (players), the animations (they follow
// «reducir movimiento»: words only), the pizarra's 3D stadium and its sound (the pizarra's own prefs, shared).
// «Brillo al inclinar» and the card's «pitidos» are gone: the card has neither (bug 3).
import { useState } from "react";
import { useTheme } from "../../../../../hooks/useTheme";
import { useReducedMotion } from "../../../../../components/vidrio";
import { Seg } from "../../../../../components/vidrio/tu/ui";
import { readProfilePrefs, readSharedPrefs, writeProfilePrefs, writeSharedPrefs, type IntroPref } from "../../../prefs";
import { motionNote, themeNote } from "../ajustesView";
import type { PlaceProps } from "../types";
import { Tog } from "./Tog";

type Tema = "dia" | "noche" | "sistema";

export function Apariencia(p: PlaceProps) {
  const { say, who } = p;
  const { pref, setPref, theme } = useTheme();
  const reduced = useReducedMotion();
  const [prefs, setPrefs] = useState(readProfilePrefs);
  const [shared, setShared] = useState(readSharedPrefs);
  const tema: Tema = pref === "system" ? "sistema" : pref === "light" ? "dia" : "noche";
  const setIntro = (intro: IntroPref) => {
    const next = { ...prefs, intro };
    writeProfilePrefs(next);
    setPrefs(next);
    say("Cuenta desde tu próxima visita.");
  };
  return (
    <>
      <section className="tc-ajrow" aria-labelledby="tc-ap-tema">
        <h3 id="tc-ap-tema">Tema</h3>
        <Seg
          cls="nx-seg tc-seg3"
          labelledBy="tc-ap-tema"
          value={tema}
          onPick={(v) => setPref(v === "dia" ? "light" : v === "noche" ? "dark" : "system")}
          opts={[
            { v: "dia", t: "Día" },
            { v: "noche", t: "Noche" },
            { v: "sistema", t: "Sistema" },
          ]}
        />
        <p role="status">{themeNote(pref, theme)}</p>
      </section>
      {who.kind === "jugador" && (
        <section className="tc-ajrow" aria-labelledby="tc-ap-sal">
          <h3 id="tc-ap-sal">Salida de la carta</h3>
          <Seg
            cls="nx-seg tc-seg3"
            labelledBy="tc-ap-sal"
            value={prefs.intro}
            onPick={setIntro}
            opts={[
              { v: "siempre", t: "Cada vez" },
              { v: "primera", t: "Solo la 1.ª" },
              { v: "nunca", t: "Nunca" },
            ]}
          />
          <p>Cuando entras en Tú, la carta sube con su brillo. Cuenta desde tu próxima visita; con «reducir movimiento» del móvil, nunca.</p>
        </section>
      )}
      <section className="tc-ajrow" aria-labelledby="tc-ap-mov">
        <h3 id="tc-ap-mov">Animaciones</h3>
        <p>{motionNote(reduced)}</p>
      </section>
      <section className="tc-ajrow" aria-labelledby="tc-ap-3d">
        <h3 id="tc-ap-3d">Estadio en 3D</h3>
        <Tog on={shared.stadium3d} onFlip={() => setShared(writeSharedPrefs({ stadium3d: !shared.stadium3d }))}>
          El estadio de la pizarra en 3D
        </Tog>
        <p>Apágalo si tu móvil va justo: la pizarra sale en plano.</p>
      </section>
      <section className="tc-ajrow" aria-labelledby="tc-ap-snd">
        <h3 id="tc-ap-snd">Sonido en la pizarra</h3>
        <Tog on={shared.sound} onFlip={() => setShared(writeSharedPrefs({ sound: !shared.sound }))}>
          El silbato y la red en la pizarra
        </Tog>
        <p>Lo mismo que el altavoz de la pizarra: cambiarlo aquí lo cambia allí.</p>
      </section>
    </>
  );
}
