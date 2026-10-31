// A member's page (TuCarta, concept B): the stage on Tú (the big card beside who he is and «Lo que te toca») or
// the masthead elsewhere (the mini card, his name, his line), the bar with his places + the gear, and the place.
// It owns the card's state (flip, walkout, the name being typed, the attribute sheet), derives his season once
// (tu/me buildMe) and «Lo que te toca» (tu/usePending), and mounts every place with the same PlaceProps. The
// studio and the cromos open over Vitrina (their own addresses).
import { lazy, Suspense, useEffect, useState } from "react";
import { prefersReducedMotion } from "../../../../components/vidrio/env";
import type { TuMaqueta } from "../../../../components/vidrio/tu/maqueta";
import type { AttrKey, CardRewards } from "../../../../lib/derived/card";
import { introSeen, markIntroSeen, readProfilePrefs, shouldPlayIntro } from "../../prefs";
import type { ProfileData } from "../../useProfileData";
import { buildMe } from "../me";
import { placesOf, pl, type Screen, type Sec, type Who } from "../model";
import { usePending } from "../usePending";
import { cardAria, cardOf, identityOf } from "../view";
import type { Go, PlaceProps, PlaceQuery, Say, TuActions } from "../places/types";
import { legacyProps } from "../screens/legacy";
import { Tu, TuStage } from "../places/Tu";
import { openPetition } from "../places/tu/petition";
import { Partidos } from "../places/Partidos";
import { Juego } from "../places/Juego";
import { Vitrina } from "../places/Vitrina";
import { Ajustes } from "../places/Ajustes";
import { CardStage } from "./CardStage";
import { Masthead } from "./Masthead";
import { PlaceNav, type PlaceTab } from "./PlaceNav";

const Compartir = lazy(() => import("../Compartir").then((m) => ({ default: m.Compartir })));
const Cromos = lazy(() => import("../Cromos").then((m) => ({ default: m.Cromos })));

/** The card's View Transition name (the stage's card ↔ the masthead's mini card). */
const CARD_VT = "tu-card";
const dec = (n: number) => n.toFixed(1).replace(".", ",");
/** The marks the card wears for his evoluciones (they mark it, never move its rating). */
const marksOf = (r: CardRewards): string[] =>
  [r.mvp && "MVP", r.double && "×2", r.goleador && "G", r.hat && "Hat-trick", r.fijo && "Fijo", r.duo !== null && `Dúo ${r.duo}`].filter((m): m is string => !!m);

export interface ShellProps {
  data: ProfileData;
  who: Who;
  /** The screen, its place already allowed for him (allowedSec / allowedAj). */
  screen: Screen;
  go: Go;
  actions: TuActions;
  say: Say;
  now: number;
  maq: TuMaqueta | null;
  query: PlaceQuery;
}

export function Shell(s: ShellProps) {
  const { data, who, screen, go } = s;
  // ── the card: flip, walkout («Salida de la carta»: every time, once a visit, never), the name typed, the sheet
  const [flip, setFlip] = useState(false);
  const [walkout] = useState(() => typeof window !== "undefined" && shouldPlayIntro(readProfilePrefs().intro, prefersReducedMotion(), introSeen()));
  const [run, setRun] = useState(walkout ? 1 : 0);
  useEffect(() => {
    if (walkout) markIntroSeen();
  }, [walkout]);
  const [typed, setTyped] = useState<string | null>(null);
  const [attr, setAttr] = useState<AttrKey | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const model = cardOf(data, who.kind, origin, typed);
  const flipped = flip && model.kind === "face";

  // ── his season and what waits on him
  const playerId = data.ficha.state === "vinculada" ? data.ficha.playerId : null;
  const me = buildMe({ playerId, seasonId: data.seasonId, ...data.raw, now: s.now, answers: data.answers, card: data.card });
  const pending = usePending({ enabled: who.kind !== "fan", seasonId: data.seasonId, playerId, next: data.next ? { id: data.next.id, rival: data.next.rival, status: "scheduled", date: data.next.dateMs } : null, now: s.now });

  const p: PlaceProps = {
    data,
    me,
    pending,
    who,
    screen,
    go,
    actions: s.actions,
    say: s.say,
    now: s.now,
    maq: s.maq,
    card: { model, aria: cardAria(model, data, flipped), flip, setFlip, replay: () => (setFlip(false), setRun((r) => r + 1)), run, typed, setTyped, origin, attr, setAttr },
    query: s.query,
  };

  // ── who he is (the stage's and the masthead's words)
  const idn = identityOf(data, who.kind, who.captain);
  const c = data.card;
  const rated = c.showNumbers && c.rating !== null;
  const mastLine =
    who.kind === "jugador"
      ? [c.number, c.posLong, rated ? `${c.rating} ${c.tierName}${c.global?.status === "provisional" ? ", provisional" : ""}` : c.tierName].filter(Boolean).join(" · ")
      : who.kind === "socio"
        ? `Socio del club · @${data.nickname}`
        : idn.line;

  // ── the bar: his places with their live hints, the gear
  const f = me.figures;
  const hint: Record<Exclude<Sec, "ajustes">, string> = {
    tu: pending.open ? pl(pending.open, "cosa te toca", "cosas te tocan") : "Al día",
    partidos: f.played ? `${pl(f.played, "jugado", "jugados")}${f.average !== null ? ` · media ${dec(f.average)}` : ""}` : "Sin partidos aún",
    juego: c.posLong ?? "Sin posición",
    vitrina: who.kind === "jugador" ? `${me.tier.name} · ${me.rewards.earned.length} de ${me.rewards.earned.length + me.rewards.next.length}` : "Tu carné",
  };
  const tabs: PlaceTab[] = placesOf(who).map((id) => ({ id: id as PlaceTab["id"], hint: hint[id as PlaceTab["id"]], badge: id === "tu" && screen.sec !== "tu" ? pending.open : 0 }));
  const doorN = data.captain?.doorRequests.length ?? 0;
  const toPlace = (sec: Sec) => {
    if (sec === screen.sec && !screen.open && (sec !== "ajustes" || !screen.aj)) return;
    setFlip(false);
    go({ page: "perfil", sec, aj: null, open: null });
  };
  const nav = <PlaceNav tabs={tabs} current={screen.sec} onGo={toPlace} gearBadge={who.captain ? doorN : 0} />;
  const close = () => go({ page: "perfil", sec: screen.sec, aj: screen.aj, open: null });

  const sec = screen.sec;
  return (
    <main className={`tup nx tc-l-${sec}`} id="tu-main">
      {sec === "tu" ? (
        <section className="tc-stage" aria-labelledby="tc-name">
          <CardStage
            card={model}
            aria={p.card.aria}
            flip={flipped}
            onFlip={() => setFlip(!flip)}
            run={run}
            pending={pending.open}
            onAttr={setAttr}
            onPack={openPetition}
            marks={marksOf(c.rewards)}
            provisional={c.global?.status === "provisional"}
            vt={CARD_VT}
          />
          <TuStage {...p} name={idn.name} line={idn.line} />
        </section>
      ) : (
        <Masthead card={model} name={idn.name} line={mastLine} pending={pending.open} onTu={() => toPlace("tu")} vt={CARD_VT} />
      )}
      {nav}
      {sec === "tu" && <Tu {...p} />}
      {sec === "partidos" && <Partidos {...p} />}
      {sec === "juego" && <Juego {...p} />}
      {sec === "vitrina" && <Vitrina {...p} />}
      {sec === "ajustes" && <Ajustes {...p} />}
      <Suspense fallback={null}>
        {screen.open === "compartir" && <Compartir {...legacyProps(p)} card={model} onClose={close} />}
        {screen.open === "cromos" && <Cromos {...legacyProps(p)} onClose={close} />}
      </Suspense>
    </main>
  );
}
