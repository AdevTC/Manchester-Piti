// /profile › Ajustes: ◀ valor ▶ selectors, saved as you change them — Tema (the app's theme: Día, Noche
// or Sistema, which keeps following the phone), Salida de la carta (next visit), Sonido and Estadio en
// 3D (the pizarra's own prefs), Brillo al inclinar (now; on iOS it asks for the gyro from that tap), and
// Animaciones (read only: the device's «reduce motion», live). As designed (pf-g.mjs pAjustes).
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { useTheme, type ThemePref } from "../../hooks/useTheme";
import { buzz } from "./fxRuntime";
import { Ic } from "./icons";
import { cycle, type Opt } from "./panels";
import { readSharedPrefs, writeSharedPrefs, type IntroPref, type ProfilePrefs } from "./prefs";

function Selector<K extends string>({ label, opts, value, onSet }: { label: string; opts: readonly Opt<K>[]; value: K; onSet: (k: K) => void }) {
  const i = Math.max(0, opts.findIndex((o) => o[0] === value));
  const go = (d: 1 | -1) => {
    onSet(cycle(opts, value, d));
    buzz(8);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  };
  return (
    <div className="ss" role="group" aria-label={`${label}: ${opts[i][1]}`} onKeyDown={onKey}>
      <button type="button" aria-label={`${label}: anterior`} onClick={() => go(-1)}>
        <Ic n="prev" />
      </button>
      <output aria-live="polite">
        <b>{opts[i][1]}</b>
        <span className="dots" aria-hidden="true">
          {opts.map((o, j) => (
            <i key={o[0]} className={j === i ? "on" : undefined} />
          ))}
        </span>
      </output>
      <button type="button" aria-label={`${label}: siguiente`} onClick={() => go(1)}>
        <Ic n="next" />
      </button>
    </div>
  );
}

function Op({ icon, label, help, nv = false, children }: { icon: ReactNode; label: string; help: string; nv?: boolean; children: ReactNode }) {
  return (
    <li className="op">
      <span className="op-ic">{icon}</span>
      <span className="op-t">
        <b>
          {label}
          {nv && (
            <>
              {" "}
              <span className="nv">nuevo</span>
            </>
          )}
        </b>
        <small>{help}</small>
      </span>
      {children}
    </li>
  );
}

const THEMES: readonly Opt<ThemePref>[] = [
  ["light", "Día"],
  ["dark", "Noche"],
  ["system", "Sistema"],
];
const INTROS: readonly Opt<IntroPref>[] = [
  ["siempre", "Cada vez"],
  ["primera", "Solo la 1.ª"],
  ["nunca", "Nunca"],
];
type YesNo = "si" | "no";
const NO_SI: readonly Opt<YesNo>[] = [
  ["no", "No"],
  ["si", "Sí"],
];
const SI_NO: readonly Opt<YesNo>[] = [
  ["si", "Sí"],
  ["no", "No"],
];
const yn = (b: boolean): YesNo => (b ? "si" : "no");

export interface AjustesProps {
  prefs: ProfilePrefs;
  onIntro: (v: IntroPref) => void;
  /** Turning it on asks iOS for the gyro: called inside the tap. */
  onTilt: (on: boolean) => void;
  /** The device's reduce-motion, live. */
  rm: boolean;
}

export function TabAjustes({ prefs, onIntro, onTilt, rm }: AjustesProps) {
  const { pref, setPref } = useTheme();
  const [shared, setShared] = useState(readSharedPrefs);
  return (
    <div className="bk">
      <h3 className="bk-h">En este móvil</h3>
      <p className="bk-d">Cambia un valor con las flechas; se guarda solo.</p>
      <ul className="ops">
        <Op icon={<Ic n="sun" w={20} />} label="Tema" help="Cómo se ve la web: de día, de noche o como tu móvil.">
          <Selector label="Tema" opts={THEMES} value={pref} onSet={setPref} />
        </Op>
        <Op icon={<Ic n="spark" w={20} />} label="Salida de la carta" help="La presentación de tu carta al abrir el perfil." nv>
          <Selector label="Salida de la carta" opts={INTROS} value={prefs.intro} onSet={onIntro} />
        </Op>
        <Op icon={<Ic n="sound" w={20} />} label="Sonido" help="Silbato y red en la pizarra; los pitidos de tu carta.">
          <Selector label="Sonido" opts={NO_SI} value={yn(shared.sound)} onSet={(k) => setShared(writeSharedPrefs({ sound: k === "si" }))} />
        </Op>
        <Op icon={<Ic n="cube" w={20} />} label="Estadio en 3D" help="La pizarra en 3D. Si tu móvil va justo, ponlo en No.">
          <Selector label="Estadio en 3D" opts={SI_NO} value={yn(shared.stadium3d)} onSet={(k) => setShared(writeSharedPrefs({ stadium3d: k === "si" }))} />
        </Op>
        <Op icon={<Ic n="tilt" w={20} />} label="Brillo al inclinar" help="El brillo de la carta sigue el movimiento del móvil." nv>
          <Selector label="Brillo al inclinar" opts={SI_NO} value={yn(prefs.tilt)} onSet={(k) => onTilt(k === "si")} />
        </Op>
        <li className="op">
          <span className="op-ic">
            <Ic n="motion" w={20} />
          </span>
          <span className="op-t">
            <b>Animaciones</b>
            <small>Siguen el ajuste «reducir movimiento» de tu móvil.</small>
          </span>
          <p className="ro">{rm ? "Tu móvil pide menos movimiento: la carta sale ya quieta." : "Animaciones completas en este móvil."}</p>
        </li>
      </ul>
    </div>
  );
}
