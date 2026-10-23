// «Mi página» (/perfil/*, TU boards shell.html tu-pf): the identity (the small card — on La carta it is the big
// one in the screen —, the name, his line and chips), the sticky tabs (each says what is inside: «Temporada · 1
// partido · 40′»; «Avisos» leaves for /avisos/a-medida) and the screen. The screens draw their own head (title,
// line, the one primary action and «Más») and body (tu/screens).
import { lazy, Suspense, useEffect, useState } from "react";
import { prefersReducedMotion } from "../../../components/vidrio/env";
import { introSeen, markIntroSeen, readProfilePrefs, shouldPlayIntro } from "../prefs";
import { usePushPreset, PRESET_LABELS } from "../../../lib/push";
import type { PositionSet } from "../../../lib/positions";
import type { TuMaqueta } from "../../../components/vidrio/tu/maqueta";
import { TuIcon } from "../../../components/vidrio/tu/ui";
import { useTheme } from "../../../hooks/useTheme";
import type { ProfileData } from "../useProfileData";
import { secLabel, secsOf, type Kind, type Open, type Screen, type Sec } from "./model";
import { TuCard } from "./TuCard";
import { cardAria, cardOf, hintOf, identityOf } from "./view";
import { Carta } from "./screens/Carta";
import { Temporada } from "./screens/Temporada";
import { Posiciones } from "./screens/Posiciones";
import { Nombre } from "./screens/Nombre";
import { Ajustes } from "./screens/Ajustes";
import { Cuenta } from "./screens/Cuenta";
import { Capitania } from "./screens/Capitania";

const Compartir = lazy(() => import("./Compartir").then((m) => ({ default: m.Compartir })));
const Cromos = lazy(() => import("./Cromos").then((m) => ({ default: m.Cromos })));

export interface TuActions {
  setShirtName: (name: string) => Promise<{ shirtName: string; previous: string }>;
  setNickname: (nickname: string) => Promise<string>;
  nicknameTaken: (nick: string) => Promise<boolean>;
  cancelClaim: () => Promise<void>;
  requestClaim: (playerId: string) => Promise<{ linked: boolean }>;
  proposePositions: (set: PositionSet | null) => Promise<void>;
  signOut: () => Promise<void>;
  leaveVestuario: () => Promise<void>;
}

/** What every screen gets. */
export interface ScreenProps {
  data: ProfileData;
  who: { kind: Kind; captain: boolean };
  go: (to: Screen, opts?: { replace?: boolean; search?: Record<string, string> }) => void;
  actions: TuActions;
  say: (t: string) => void;
  now: number;
  maq: TuMaqueta | null;
  /** The card (the hero on La carta; its flip and walkout live here so «Más» can turn it). */
  flip: boolean;
  setFlip: (f: boolean) => void;
  replay: () => void;
  run: number;
  /** «Tu nombre» prints what you type on the card too, until it is stamped. */
  typed: string | null;
  setTyped: (t: string | null) => void;
  origin: string;
}

export function MiPagina(p: { data: ProfileData; who: { kind: Kind; captain: boolean }; sec: Sec; open: Open; go: ScreenProps["go"]; actions: TuActions; say: (t: string) => void; now: number; maq: TuMaqueta | null }) {
  const { data, who, sec, open, go } = p;
  const [flip, setFlip] = useState(false);
  // «Salida de la carta»: the card comes up with a lift and a glint (Ajustes: every time, once a visit, never)
  const [walkout] = useState(() => typeof window !== "undefined" && shouldPlayIntro(readProfilePrefs().intro, prefersReducedMotion(), introSeen()));
  const [run, setRun] = useState(walkout ? 1 : 0);
  useEffect(() => {
    if (walkout) markIntroSeen();
  }, [walkout]);
  const [typed, setTyped] = useState<string | null>(null);
  const preset = usePushPreset();
  const { pref } = useTheme();
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const back = sec === "ajustes" || sec === "cuenta" || sec === "capitania";
  const card = cardOf(data, who.kind, origin, typed);
  const flipped = (flip || back) && card.kind === "face";
  const doorN = data.captain?.doorRequests.length ?? 0;
  const posPending = data.positions?.state === "pendiente";
  const idn = identityOf(data, who.kind, who.captain);
  const nav = secsOf(who).map((x) => {
    const on = x.id === sec;
    const badge = x.id === "capitania" ? doorN : 0;
    return { ...x, on, label: secLabel(x.id, who.kind), hint: hintOf(x.id, data, who.kind, { avisos: PRESET_LABELS[preset.choice], themePref: pref, doorN, posPending }), badge };
  });
  const pick = (id: Sec | "avisos") => {
    if (id === "avisos") return go({ page: "avisos", sec: "carta", open: null });
    if (id === sec && !open) return;
    setFlip(false);
    go({ page: "perfil", sec: id, open: null });
  };
  const tap = () => {
    if (sec !== "carta") return pick("carta");
    if (card.kind === "face") setFlip(!flip);
    else if (card.kind === "down") document.getElementById("tu-pick-t")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const cardNode = (w?: number) => <TuCard card={card} flip={flipped} run={run} label={cardAria(card, data, flipped)} onTap={tap} width={w} />;
  const sp: ScreenProps = {
    data,
    who,
    go,
    actions: p.actions,
    say: p.say,
    now: p.now,
    maq: p.maq,
    flip,
    setFlip,
    replay: () => {
      setFlip(false);
      setRun((r) => r + 1);
    },
    run,
    typed,
    setTyped,
    origin,
  };
  const group = (g: "campo" | "fuera") => (
    <ul className="tu-nav__l">
      {nav
        .filter((x) => x.g === g)
        .map((x) => (
          <li key={x.id}>
            <button type="button" className={`tu-nav__b${x.on ? " is-on" : ""}${x.id === "avisos" ? " is-out" : ""}`} aria-current={x.on ? "page" : "false"} onClick={() => pick(x.id)}>
              {x.on && <span className="tu-nav__bead" aria-hidden="true" />}
              <b>
                {x.label}
                {x.badge > 0 && <span className="tu-badge">{x.badge}</span>}
                {x.id === "avisos" && <TuIcon name="arrow" className="tu-nav__out" />}
              </b>
              <small>{x.hint}</small>
            </button>
          </li>
        ))}
    </ul>
  );
  return (
    <main className="tu-main tu-pf" id="tu-main">
      <aside className="tu-id" aria-label="De quién es esta página">
        <div className="tu-id__card">{sec !== "carta" && cardNode()}</div>
        <div className="tu-id__who">
          <p className="tu-kick">Mi página</p>
          <h1 className="tu-id__name">{idn.name}</h1>
          <p className="tu-id__line">{idn.line}</p>
          <p className="tu-id__chips">
            {idn.chips.map((c) => (
              <span key={c.t} className={`tu-pill ${c.cls}`.trim()}>
                {c.t}
              </span>
            ))}
          </p>
        </div>
        <nav className="tu-nav" data-scroll-x="1" aria-label="Secciones de tu página">
          <p className="tu-nav__g">{who.kind === "socio" ? "Tu carné" : "En el campo"}</p>
          {group("campo")}
          <p className="tu-nav__g">Fuera del campo</p>
          {group("fuera")}
        </nav>
      </aside>
      <section className="tu-scr" aria-labelledby="tu-scr-t">
        {sec === "carta" && <Carta {...sp} cardNode={cardNode()} card={card} />}
        {sec === "temporada" && <Temporada {...sp} />}
        {sec === "posiciones" && <Posiciones {...sp} />}
        {sec === "nombre" && <Nombre {...sp} />}
        {sec === "ajustes" && <Ajustes {...sp} />}
        {sec === "cuenta" && <Cuenta {...sp} />}
        {sec === "capitania" && <Capitania {...sp} />}
      </section>
      <Suspense fallback={null}>
        {open === "compartir" && <Compartir {...sp} card={card} onClose={() => go({ page: "perfil", sec, open: null })} />}
        {open === "cromos" && <Cromos {...sp} onClose={() => go({ page: "perfil", sec, open: null })} />}
      </Suspense>
    </main>
  );
}
