// /profile «La carta» (Celeste · elegida): the whole screen from the profile's data — the tunnel and the
// LED videoboard, the card on its pedestal with the walkout intro, the living card (foil, tilt, flip),
// the CTAs of each state, the heat press + 6 s undo after «Estampar», and the menu with its panels.
// The data and the callables come in as props (ProfilePage wires the real ones; the tests, fakes).
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Arena, Stage, Videoboard } from "./Hero";
import { heroView } from "./heroView";
import { INTRO_MS, PRESS_TOAST_MS, SHARE_READY, UNDO_MS } from "./fx";
import { askGyro, buzz, copyText, errorMessage, gyroNeedsPermission, isOffline, OFFLINE, playBeeps } from "./fxRuntime";
import { Ic } from "./icons";
import { stuffLines } from "./lines";
import { Menu } from "./Menu";
import { introSeen, markIntroSeen, readProfilePrefs, readSharedPrefs, shouldPlayIntro, writeProfilePrefs, type ProfilePrefs } from "./prefs";
import { normalizeShirtName, shirtNameCheck, typeShirtName } from "./rules";
import { TabCarta } from "./TabCarta";
import { TabAjustes } from "./TabAjustes";
import { TabAvisos } from "./TabAvisos";
import { TabCapitania } from "./TabCapitania";
import { TabCuenta } from "./TabCuenta";
import { TabTemporada } from "./TabTemporada";
import { deepHash, forgetDeepHash, hashOf, slideDir, tabFromHash, tabsFor, type TabId } from "./tabs";
import { prefersReducedMotion, usePauseHidden, usePauseOffscreen, useReducedMotion, useTilt } from "./useMotion";
import type { SetShirtNameResult } from "./api";
import type { ProfileData } from "./useProfileData";

export interface ProfileActions {
  setShirtName: (name: string) => Promise<SetShirtNameResult>;
  /** Resolves with the handle as saved. */
  setNickname: (nick: string) => Promise<string>;
  nicknameTaken: (nick: string) => Promise<boolean>;
  cancelClaim: () => Promise<void>;
  requestClaim: (playerId: string) => Promise<{ linked: boolean }>;
  /** «Salir en este dispositivo»: this device only. */
  signOut: () => Promise<void>;
  /** «Darme de baja del vestuario»: leaveVestuario({ confirm: true }) and then out of this device. */
  leaveVestuario: () => Promise<void>;
}

export interface ProfileViewProps {
  data: ProfileData;
  actions: ProfileActions;
  now: number;
  /** For the public links (QR, «Copiar enlace»). */
  origin: string;
  header?: ReactNode;
  footer?: ReactNode;
}

type Phase = "wait" | "run" | "done";
interface Toast {
  msg: string;
  bad: boolean;
  n: number;
}
interface Undo {
  prev: string;
  name: string;
  n: number;
}

const upper = (s: string) => s.toLocaleUpperCase("es-ES");
/** The avatar's letters: the shirt name's initials (ADRIÁN T.C. → AT), else the apodo's first two. */
function initialsOf(shirt: string, nick: string): string {
  const fromShirt = upper(shirt)
    .replace(/[^A-ZÁÉÍÓÚÜÑÇ ]/g, "")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  return fromShirt || upper(nick.slice(0, 2)) || "?";
}
const wait = (ms: number) => new Promise<void>((r) => (ms > 0 ? window.setTimeout(r, ms) : r()));

export function ProfileView({ data, actions, now, origin, header, footer }: ProfileViewProps) {
  const [rm] = useState(prefersReducedMotion);
  const [prefs, setPrefs] = useState(readProfilePrefs);
  // Ajustes › Animaciones shows the device's setting live (the page itself decided at load).
  const rmLive = useReducedMotion();
  const ready = !data.loading && !data.error;
  const root = useRef<HTMLDivElement>(null);
  const pz = usePauseOffscreen();
  usePauseHidden(root);

  // ── timers that outlive a handler (toasts after the press, the undo window); all cleared on leaving
  const timers = useRef(new Set<number>());
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  };
  useEffect(() => {
    const set = timers.current;
    return () => set.forEach((t) => window.clearTimeout(t));
  }, []);
  const scrollToId = (id: string) =>
    later(() => document.getElementById(id)?.scrollIntoView?.({ behavior: rm ? "auto" : "smooth", block: "start" }), 80);

  // ── the walkout intro: decided once (the «Salida de la carta» pref, once per session by default),
  // started when the card's data is there; 3.4 s, «Saltar» or a tap ends it; reduced motion never plays it.
  const [intro, setIntro] = useState<{ phase: Phase; n: number }>(() => ({ phase: shouldPlayIntro(prefs.intro, rm, introSeen()) ? "wait" : "done", n: 0 }));
  if (intro.phase === "wait" && ready) setIntro({ phase: "run", n: intro.n + 1 });
  const playing = intro.phase === "run";
  useEffect(() => {
    if (intro.phase !== "run") return;
    markIntroSeen();
    const t = window.setTimeout(() => setIntro((i) => (i.phase === "run" ? { ...i, phase: "done" } : i)), INTRO_MS);
    return () => window.clearTimeout(t);
  }, [intro.phase, intro.n]);
  const skip = () => {
    if (intro.phase === "run") setIntro((i) => ({ ...i, phase: "done" }));
  };
  const replay = () => {
    buzz(20);
    if (rm) return;
    if (readSharedPrefs().sound) playBeeps();
    // back to the final frame, then again from the first beat (the CSS animations restart)
    setIntro((i) => ({ ...i, phase: "done" }));
    requestAnimationFrame(() => requestAnimationFrame(() => setIntro((i) => ({ phase: "run", n: i.n + 1 }))));
  };

  // ── toasts (role=status rail)
  const [toast, setToast] = useState<Toast>({ msg: "", bad: false, n: 0 });
  const say = (msg: string, bad = false) => setToast((t) => ({ msg, bad, n: t.n + 1 }));
  useEffect(() => {
    if (!toast.n) return;
    const t = window.setTimeout(() => setToast((x) => (x.n === toast.n ? { ...x, msg: "" } : x)), 2600);
    return () => window.clearTimeout(t);
  }, [toast.n]);

  // ── the living card: flip, tilt (the gyro on iOS only after asking, from a tap)
  const [flip, setFlip] = useState(false);
  const [gyroAllowed, setGyroAllowed] = useState(() => !gyroNeedsPermission());
  const asked = useRef(false);
  const cardRef = useTilt({ gyro: prefs.tilt, rm, gyroAllowed });
  const askGyroOnce = () => {
    if (!prefs.tilt || gyroAllowed || asked.current || rm) return;
    asked.current = true;
    void askGyro().then((ok) => ok && setGyroAllowed(true));
  };
  // ── Ajustes: «Salida de la carta» counts from the next visit; «Brillo al inclinar» right now (turning it
  // on asks iOS for the gyro from that same tap).
  const savePrefs = (p: Partial<ProfilePrefs>) => {
    const next = { ...prefs, ...p };
    writeProfilePrefs(next);
    setPrefs(next);
  };
  const setTiltPref = (on: boolean) => {
    savePrefs({ tilt: on });
    if (!on || gyroAllowed || rm) return;
    asked.current = true;
    void askGyro().then((ok) => ok && setGyroAllowed(true));
  };

  // ── the menu: tabs (+ #hash deep links)
  const isCaptain = data.isCaptain;
  const tabs = tabsFor(isCaptain);
  const ids = tabs.map((t) => t.id);
  const [tabWanted, setTab] = useState<TabId>(() => tabFromHash(deepHash(), true) ?? "carta");
  const [dir, setDir] = useState<"l" | "r" | null>(null);
  const tab: TabId = ids.includes(tabWanted) ? tabWanted : "carta";
  const deep = useRef(!!tabFromHash(deepHash(), true));
  useEffect(() => forgetDeepHash(), []);
  useEffect(() => {
    const onHash = () => {
      const t = tabFromHash(window.location.hash, isCaptain);
      if (t) setTab(t);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [isCaptain]);
  // A link to a tab (#temporada…) opens the page on the menu once the data is there.
  useEffect(() => {
    if (!ready || !deep.current) return;
    deep.current = false;
    const t = window.setTimeout(() => document.getElementById("pe-menu")?.scrollIntoView?.({ behavior: "auto", block: "start" }), 120);
    return () => window.clearTimeout(t);
  }, [ready]);
  const goTab = (id: TabId, then?: string, focus?: string) => {
    setDir(slideDir(tab, id, ids));
    setTab(id);
    try {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search + hashOf(id));
    } catch {
      /* sandboxed: the tab still changes */
    }
    later(() => {
      if (focus) {
        const el = document.getElementById(focus);
        el?.focus();
        el?.scrollIntoView?.({ behavior: rm ? "auto" : "smooth", block: "center" });
        return;
      }
      if (then) {
        scrollToId(then);
        return;
      }
      const m = document.getElementById("pe-menu");
      if (m && m.getBoundingClientRect().top < 0) m.scrollIntoView?.({ behavior: rm ? "auto" : "smooth", block: "start" });
    }, 40);
  };

  // ── who you are now (a just-saved name shows before the data echoes it)
  const dataShirt = upper(data.shirt.current || data.card.name);
  const [shirtPin, setShirtPin] = useState<string | null>(null);
  const [nickPin, setNickPin] = useState<string | null>(null);
  const [esDraft, setEsDraft] = useState<string | null>(null);
  const [esErr, setEsErr] = useState<string | null>(null);
  const [esBusy, setEsBusy] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [stampN, setStampN] = useState(0);
  if (shirtPin !== null && !esBusy && !undoBusy && normalizeShirtName(dataShirt) === normalizeShirtName(shirtPin)) setShirtPin(null);
  if (nickPin !== null && data.nickname === nickPin) setNickPin(null);
  const shirt = shirtPin ?? dataShirt;
  const nick = nickPin ?? data.nickname;
  const state = data.ficha.state;
  const vinc = state === "vinculada";

  // ── the reveal: the captain says yes while you are here → the walkout plays again + toast
  const [seenState, setSeenState] = useState(ready ? state : null);
  const [reveal, setReveal] = useState(0);
  if (ready && seenState !== state) {
    setSeenState(state);
    if (seenState !== null && seenState !== "vinculada" && state === "vinculada") {
      setReveal((n) => n + 1);
      setFlip(false);
      if (!rm) setIntro((i) => ({ phase: "run", n: i.n + 1 }));
      setToast((t) => ({ msg: "¡Carta revelada! Tu ficha está vinculada", bad: false, n: t.n + 1 }));
    }
  }
  useEffect(() => {
    if (!reveal) return;
    buzz([30, 60, 30, 60, 120]);
    const t = window.setTimeout(() => document.getElementById("pe-top")?.scrollIntoView?.({ behavior: "auto", block: "start" }), 80);
    return () => window.clearTimeout(t);
  }, [reveal]);

  const hv = heroView({ card: data.card, shirt, nick, flip, stampN, access: data.access, origin });

  // ── «En la espalda»
  const draft = esDraft ?? shirt;
  const check = shirtNameCheck(draft, shirt, data.shirt.squad, data.ficha.playerId);
  const onShirtInput = (e: ChangeEvent<HTMLInputElement>) => {
    const t = e.target;
    const typed = typeShirtName(t.value, t.selectionStart ?? t.value.length);
    if (t.value !== typed.value) {
      t.value = typed.value;
      try {
        t.setSelectionRange(typed.caret, typed.caret);
      } catch {
        /* not a text input any more */
      }
    }
    setEsDraft(typed.value);
    setEsErr(null);
  };
  /** The press lands on the card: the new name pops in letter by letter, the toast once it lifts. */
  const press = (name: string, toastMsg: string) => {
    setShirtPin(name);
    setEsDraft(null);
    if (!rm) setStampN((n) => n + 1);
    buzz([20, 60, 40]);
    later(() => say(toastMsg), rm ? 0 : PRESS_TOAST_MS);
  };
  const undoTimer = useRef(0);
  // A second tap before the first one re-renders must never send twice.
  const inFlight = useRef(new Set<string>());
  const lock = (k: string) => {
    if (inFlight.current.has(k)) return false;
    inFlight.current.add(k);
    return true;
  };
  const unlock = (k: string) => inFlight.current.delete(k);
  const stamp = async () => {
    if (!vinc || check.state !== "ok" || esBusy) return;
    if (isOffline()) {
      setEsErr(OFFLINE);
      return;
    }
    if (!lock("shirt")) return;
    const name = check.value;
    const narrow = (document.documentElement.clientWidth || window.innerWidth || 390) < 1100;
    const flipped = flip;
    setFlip(false);
    setEsBusy(true);
    setEsErr(null);
    // the card keeps the old name until the press lands on it
    setShirtPin(shirt);
    if (narrow) scrollToId("pe-top");
    const delay = rm ? 0 : (narrow ? 700 : 120) + (flipped ? 800 : 0);
    try {
      const [res] = await Promise.all([actions.setShirtName(name), wait(delay)]);
      const saved = upper(res.shirtName || name);
      press(saved, "Estampado: así sale ya en tu ficha");
      if (res.changed !== false && res.previous && normalizeShirtName(res.previous) !== normalizeShirtName(saved)) {
        window.clearTimeout(undoTimer.current);
        setUndo((u) => ({ prev: upper(res.previous), name: saved, n: (u?.n ?? 0) + 1 }));
        undoTimer.current = later(() => setUndo(null), UNDO_MS);
      }
    } catch (e) {
      setShirtPin(null);
      setEsErr(errorMessage(e));
    } finally {
      unlock("shirt");
      setEsBusy(false);
    }
  };
  const undoShirt = async () => {
    const u = undo;
    if (!u || undoBusy) return;
    if (isOffline()) {
      setEsErr(OFFLINE);
      return;
    }
    if (!lock("shirt")) return;
    setUndoBusy(true);
    setEsErr(null);
    setShirtPin(shirt);
    try {
      const res = await actions.setShirtName(u.prev);
      window.clearTimeout(undoTimer.current);
      setUndo(null);
      buzz(15);
      press(upper(res.shirtName || u.prev), `Deshecho: vuelve «${upper(res.shirtName || u.prev)}» a tu espalda`);
    } catch (e) {
      setShirtPin(null);
      setEsErr(errorMessage(e));
    } finally {
      unlock("shirt");
      setUndoBusy(false);
    }
  };

  // ── Tu ficha: copy the link, cancel the request, ask for a ficha
  const [copied, setCopied] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimErr, setClaimErr] = useState<string | null>(null);
  const copyPlayer = async () => {
    if (!data.card.playerId) return;
    const ok = await copyText(origin + "/jugadores/" + data.card.playerId);
    if (ok) {
      setCopied(true);
      say("Enlace a tu página copiado");
    } else say("No se ha podido copiar: mantén pulsado el enlace para copiarlo", true);
  };
  const cancelClaim = async () => {
    if (cancelBusy) return;
    if (isOffline()) {
      say(OFFLINE, true);
      return;
    }
    if (!lock("cancel")) return;
    setCancelBusy(true);
    try {
      await actions.cancelClaim();
      buzz(15);
      say("Petición cancelada");
    } catch (e) {
      say(errorMessage(e), true);
    } finally {
      unlock("cancel");
      setCancelBusy(false);
    }
  };
  const claim = async () => {
    if (!picked || claimBusy) return;
    if (isOffline()) {
      setClaimErr(OFFLINE);
      return;
    }
    if (!lock("claim")) return;
    setClaimBusy(true);
    setClaimErr(null);
    try {
      const r = await actions.requestClaim(picked);
      buzz([15, 30, 15]);
      setPicked(null);
      if (!r.linked) say("Petición enviada al capitán");
      scrollToId("pe-top");
    } catch (e) {
      setClaimErr(errorMessage(e));
    } finally {
      unlock("claim");
      setClaimBusy(false);
    }
  };
  const goFicha = () => goTab("carta", "pe-ficha");
  const goPick = () => goTab("carta", "pe-pick");
  const onCard = () => {
    askGyroOnce();
    if (state === "pendiente") return goFicha();
    if (state === "sin-ficha") return goPick();
    setFlip((f) => !f);
    buzz(12);
  };

  const rejected = data.ficha.rejectedPlayerId ? data.shirt.squad.find((s) => s.id === data.ficha.rejectedPlayerId) : undefined;
  const panel =
    tab === "carta" ? (
      <TabCarta
        card={data.card}
        shirt={{
          state,
          draft,
          check,
          error: esErr,
          busy: esBusy,
          num: data.card.number,
          claimNum: hv.num,
          undoOn: vinc && !!undo,
          undoBusy,
          onInput: onShirtInput,
          onStamp: () => void stamp(),
          onUndo: () => void undoShirt(),
          onGoFicha: goFicha,
          onGoPick: goPick,
        }}
        nick={{
          current: nick,
          lookup: actions.nicknameTaken,
          save: actions.setNickname,
          onSaved: (n) => {
            setNickPin(n);
            buzz(12);
            say("Guardado: ahora eres @" + n);
          },
        }}
        ficha={{
          card: data.card,
          shirt,
          fullName: data.shirt.fullName,
          copied,
          onCopy: () => void copyPlayer(),
          onCancel: () => void cancelClaim(),
          cancelBusy,
          free: data.freeFichas,
          picked,
          onPick: (id) => {
            setPicked(id);
            setClaimErr(null);
            buzz(12);
          },
          onClaim: () => void claim(),
          claimBusy,
          claimError: claimErr,
          rejectedNum: rejected ? String(rejected.number ?? rejected.name) : null,
        }}
      />
    ) : tab === "temp" ? (
      <TabTemporada card={data.card} seasonName={data.seasonName} stuff={stuffLines({ next: data.next, boards: data.stuff.boards, porra: data.stuff.porra, conv: data.stuff.convocatorias, now })} stuffLoading={data.stuff.loading} onGoPick={goPick} />
    ) : tab === "avisos" ? (
      <TabAvisos isCaptain={isCaptain} testName={vinc ? shirt : upper(nick)} next={data.next ? { rival: data.next.rival, j: data.next.j } : null} upcoming={data.upcoming} feed={origin + "/calendario.ics"} say={say} rm={rm} />
    ) : tab === "ajustes" ? (
      <TabAjustes prefs={prefs} onIntro={(intro) => savePrefs({ intro })} onTilt={setTiltPref} rm={rmLive} />
    ) : tab === "cuenta" ? (
      <TabCuenta
        nick={nick}
        shirtLine={vinc ? `${shirt}${data.card.number ? " · dorsal " + data.card.number : ""}` : state === "pendiente" ? "Cuando el capitán acepte tu ficha" : "Cuando tengas ficha"}
        onChange={() => goTab("carta", "pe-nombre")}
        google={data.google}
        initials={initialsOf(vinc ? shirt : "", nick)}
        roleLong={isCaptain ? "Capitán" : "Jugador"}
        access={data.access}
        uid={data.uid}
        isSuperadmin={data.isSuperadmin}
        onSignOut={actions.signOut}
        onLeave={actions.leaveVestuario}
        say={say}
      />
    ) : (
      <TabCapitania requests={data.captain?.doorRequests ?? []} squad={data.shirt.squad} now={now} onGoAvisos={() => goTab("avisos", undefined, "pe-tp-door")} />
    );

  const season = upper(data.seasonName);
  return (
    <div ref={root} className={"vx pcv " + (playing ? "intro" : "done")} aria-busy={!ready}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="peShirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e2f2fd" />
            <stop offset="1" stopColor="#6CABDD" />
          </linearGradient>
          <linearGradient id="peBlank" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#d3deeb" />
          </linearGradient>
        </defs>
      </svg>
      <div className="vx-grain" aria-hidden="true" />
      {ready && <Arena led1="MANCHESTER PITI ·" led2={`${season} · EL VESTUARIO ·`} pz={pz} />}
      {header}
      {!ready ? (
        <div className="pe-main pc-wait">
          {data.error ? (
            <p className="note bad" role="alert">
              <Ic n="alert" />
              <span>
                <b>No hemos podido abrir tu perfil.</b> Comprueba la conexión y vuelve a intentarlo.
              </span>
            </p>
          ) : (
            <p className="pc-load" role="status">
              Cargando tu carta…
            </p>
          )}
        </div>
      ) : (
        <div className="pe-main">
          <Videoboard hv={hv} pz={pz} />
          <Stage
            hv={hv}
            nick={nick}
            captainRole={isCaptain}
            since={data.access.sinceText}
            intro={playing}
            pz={pz}
            cardRef={cardRef}
            onSkip={skip}
            onCard={onCard}
            onFlip={() => {
              askGyroOnce();
              setFlip((f) => !f);
              buzz(12);
            }}
            onReplay={replay}
            onGoFicha={goFicha}
            onGoPick={goPick}
            onCancel={() => void cancelClaim()}
            cancelBusy={cancelBusy}
            share={{ ready: SHARE_READY, open: () => undefined }}
            undo={vinc && undo ? { name: undo.name, n: undo.n, busy: undoBusy, onUndo: () => void undoShirt() } : null}
            example={data.card.started ? null : `Datos de ejemplo: la ${data.seasonName} aún no ha empezado`}
            srStatus={playing ? "" : hv.srStatus}
          />
          <div className="pe-side">
            <Menu tabs={tabs} tab={tab} dir={dir} badge={data.captain?.doorRequests.length ?? 0} onTab={(id) => goTab(id)}>
              {panel}
            </Menu>
          </div>
        </div>
      )}
      {footer}
      <div className="pf-toast-rail" aria-live="polite">
        <div className={"pf-toast" + (toast.msg ? " on" : "") + (toast.bad ? " bad" : "")} role="status">
          {toast.bad ? <Ic n="alert" w={18} /> : <Ic n="check" w={18} />}
          <span>{toast.msg}</span>
        </div>
      </div>
    </div>
  );
}
