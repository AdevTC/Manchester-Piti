// r14 «La pizarra» · La charla (PiCharla, region "full": it takes the whole page). Two moments: «Así va la charla»
// (the steps as a strip to switch on/off, reorder and preview on the pitch) and the presentation (Grada, progress
// segments by duration, huge captions, each player's walkout with Foco and his card, the rival, the plan, the chosen
// jugada stepped on the clock, the quedada, «¡Vamos, Piti!»). ‹ ›, taps on the phone, pause, the captain's real voice
// per step (MediaRecorder), the presenter view on desktop (P). Esc / × leave to the Siete.
import { useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import "../../../../../styles/pz/charla.css";
import { VidrioSky } from "../../../../../components/vidrio";
import { useTheme } from "../../../../../hooks/useTheme";
import { useQuedada } from "../../../data/quedada";
import { vozOrphans } from "../../../data/voz";
import { PiCampo } from "../../campo/PiCampo";
import { PzIcon } from "../../campo/Shirt";
import { usePz } from "../../store/context";
import { fmt } from "../../store/fmt";
import type { PzApi } from "../../store/api";
import type { Layout, RegionProps, StageSpec } from "../../store/types";
import { BLOCKS, buildCharla, CHARLA0, mmss, SPEEDS, type BlockId, type CharlaChoices, type CharlaModel, type Step } from "./charlaView";
import { useCharlaVoz } from "./useCharlaVoz";
import { changePrefs, lessMotion, sonar } from "../../sheets/ajustes/prefsLive";
import { Camiseta, CharlaCard } from "./CharlaCard";

const WAVE = [7, 12, 18, 10, 22, 15, 26, 13, 19, 9, 16, 24, 11, 20, 14, 8, 17, 12];
const LS = "mp_pizarra_r14_charla:";

function readSaved(boardId: string): Partial<CharlaChoices> & { notes?: Record<string, string> } {
  try {
    const raw = localStorage.getItem(LS + boardId);
    const o: unknown = raw ? JSON.parse(raw) : null;
    return o && typeof o === "object" ? (o as Partial<CharlaChoices>) : {};
  } catch {
    return {};
  }
}
function writeSaved(boardId: string, v: CharlaChoices & { notes: Record<string, string> }) {
  try {
    localStorage.setItem(LS + boardId, JSON.stringify(v));
  } catch {
    /* storage can be off: the charla still works */
  }
}

type Slice = CharlaChoices & { notes: Record<string, string>; board: string };
const sliceOf = (P: PzApi) => P.slice<Slice>("charla", { ...CHARLA0, notes: {}, board: "" });

export function Charla({ region, layout }: RegionProps) {
  if (region !== "full") return null;
  return <CharlaFull layout={layout} />;
}


function CharlaFull({ layout }: { layout: Layout }) {
  const P = usePz();
  const { theme } = useTheme();
  const q = P.state.route.q;
  const me = P.sel.me();
  const b0 = P.sel.board();
  const sl = sliceOf(P);
  const cs = sl.get();
  const prefs = P.sel.prefs();
  const muted = !!prefs.vozMute;
  const [reduced] = useState(() => lessMotion(P));
  const say = (t: string) => P.say(t);
  const vz = useCharlaVoz({ boardId: b0 && !b0.draft ? b0.id : null, on: true, uid: me.uid, say });
  const quedada = useQuedada(b0?.matchId ?? null, !!b0?.matchId).quedada;
  const X: CharlaModel = buildCharla(P, cs, vz.lens, { muted, quedada });
  const L = X.steps;
  const b = X.b;
  const ed = !!b && P.sel.canEdit(b);
  const desk = layout === "desktop";
  const phone = layout === "phone";

  const [mode, setMode] = useState<"inicio" | "play">(q.paso ? "play" : "inicio");
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elMs, setElMs] = useState(0);
  const [pv, setPv] = useState(q.presentador === "1");
  const [ask, setAsk] = useState<null | "missing">(q.preguntar === "1" ? "missing" : null);
  const [preview, setPreview] = useState<BlockId>("siete");
  const [prevStep, setPrevStep] = useState(0);
  const [stepIn, setStepIn] = useState(true);
  const [pop, setPop] = useState<null | "voz" | "mas">(null);
  const [drag, setDrag] = useState<BlockId | null>(null);
  const [over, setOver] = useState<BlockId | null>(null);
  const acc = useRef(0);
  const t0 = useRef(0);
  const noClick = useRef(0);
  const goEl = useRef<HTMLButtonElement | null>(null);
  const playEl = useRef<HTMLButtonElement | null>(null);
  const rootEl = useRef<HTMLDivElement | null>(null);
  const live = useRef({ L, i, playing, mode });
  useEffect(() => {
    live.current = { L, i, playing, mode };
  });

  // the board's remembered choices (order, switched off, jugada, speed, notes) — per board, on this device
  const boardId = b?.id ?? "";
  useEffect(() => {
    if (!boardId || sl.get().board === boardId) return;
    const s = readSaved(boardId);
    sl.set({ ...CHARLA0, notes: {}, ...s, board: boardId, ...(q.jugada ? { jugada: q.jugada } : {}) }, { undoable: false });
    // (only when the board changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);
  const saveKey = JSON.stringify([cs.order, cs.off, cs.jugada, cs.speed, cs.notes]);
  useEffect(() => {
    if (cs.board && cs.board === boardId) writeSaved(boardId, { order: cs.order, off: cs.off, jugada: cs.jugada, speed: cs.speed, notes: cs.notes });
    // (saveKey names everything that is written)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveKey, boardId]);

  const delVoz = async (key: string, who: string) => {
    const gone = await vz.remove(key);
    if (gone) P.toast("Voz borrada" + (who ? " de «" + who + "»" : ""), { long: true, undo: () => void vz.restore(gone) });
  };

  // ── the clock ────────────────────────────────────────────────────────────────────────────────────────────
  const elapsed = () => acc.current + (t0.current ? Date.now() - t0.current : 0);
  const recBusy = vz.phase !== "idle";
  const start = (fromBlock?: BlockId | null, force = false) => {
    const st = X.st;
    if (!force && st && !st.full) {
      setAsk("missing");
      say(X.empty ? "El siete está vacío" : 7 - st.n === 1 ? "Falta 1 en el siete" : "Faltan " + (7 - st.n) + " en el siete");
      return;
    }
    let k = 0;
    if (fromBlock) k = Math.max(0, L.findIndex((s) => s.block === fromBlock));
    acc.current = 0;
    t0.current = reduced ? 0 : Date.now();
    setI(k);
    setElMs(0);
    setAsk(null);
    setMode("play");
    setPlaying(!reduced);
    setStepIn(false);
    window.setTimeout(() => setStepIn(true), 40);
    window.setTimeout(() => playEl.current?.focus(), 60);
    say("La charla empieza. " + (L[k] ? L[k].t : ""));
  };
  const go = (to: number, keep = false) => {
    const S = live.current.L;
    if (!S.length) return;
    const k = Math.max(0, Math.min(S.length - 1, to));
    const run = live.current.playing || keep;
    acc.current = 0;
    t0.current = run ? Date.now() : 0;
    setI(k);
    setElMs(0);
    if (keep) setPlaying(true);
    setPop((p) => (p === "mas" ? null : p));
    setStepIn(false);
    window.setTimeout(() => setStepIn(true), 40);
    const s = S[k];
    if (s.block === "vamos") sonar(P, "grada");
    say("Paso " + (k + 1) + " de " + S.length + ". " + s.t + (s.line ? ". " + s.line : ""));
  };
  const pause = () => {
    acc.current = elapsed();
    t0.current = 0;
    setElMs(acc.current);
    setPlaying(false);
  };
  const play = () => {
    if (ask || recBusy) return;
    t0.current = Date.now();
    setPlaying(true);
  };
  const cur = L[Math.min(i, Math.max(0, L.length - 1))] as Step | undefined;
  const togglePlay = () => {
    if (reduced) {
      go(i + 1);
      return;
    }
    if (playing) {
      pause();
      say("Charla en pausa");
      return;
    }
    if (i >= L.length - 1 && cur && elapsed() >= cur.dur * 1000) {
      acc.current = 0;
      setI(0);
      setElMs(0);
    }
    play();
  };
  // one tick every 200 ms while it plays: the progress, and the next step when this one is done
  useEffect(() => {
    if (!playing || mode !== "play") return;
    const id = window.setInterval(() => {
      const { L: S, i: k } = live.current;
      const s = S[k];
      if (!s) return;
      const e = acc.current + (t0.current ? Date.now() - t0.current : 0);
      if (e >= s.dur * 1000) {
        if (k >= S.length - 1) {
          acc.current = s.dur * 1000;
          t0.current = 0;
          setElMs(acc.current);
          setPlaying(false);
          P.say("Fin de la charla. ¡Vamos, Piti!");
          return;
        }
        go(k + 1, true);
        return;
      }
      setElMs(e);
    }, 200);
    return () => window.clearInterval(id);
    // (live.current carries the steps; go/P are stable enough for a timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, mode]);
  // the voice of the step on screen sounds while the charla plays (and stops with it)
  const curKey = mode === "play" && cur ? cur.vkey : null;
  const clipId = curKey ? (vz.byKey.get(curKey)?.at ?? 0) : 0;
  useEffect(() => {
    vz.sync(curKey, playing && !muted && !recBusy, elapsed() / 1000);
    // (vz.sync reads the latest clips through a ref)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curKey, playing, muted, recBusy, clipId, i]);
  // a deep link (?paso=…): open on that step
  useEffect(() => {
    if (!q.paso || !L.length) return;
    let k = L.findIndex((s) => s.id === q.paso);
    if (k < 0) k = L.findIndex((s) => s.id.startsWith(q.paso) || s.block === q.paso);
    setI(Math.max(0, k));
    if (q.pausa !== "1" && !reduced) {
      t0.current = Date.now();
      setPlaying(true);
    }
    // (once, when the steps first exist)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L.length > 0]);
  // the focus goes in
  useEffect(() => {
    const t = window.setTimeout(() => (mode === "play" ? playEl.current : goEl.current)?.focus() ?? rootEl.current?.focus(), 80);
    return () => window.clearTimeout(t);
    // (on mount only)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // a step that disables the focused control (› on the last step) would drop the focus to the page, out of reach of
  // the charla's keys (Esc, the arrows): it stays in the charla
  useEffect(() => {
    if (mode !== "play") return;
    const a = document.activeElement as HTMLButtonElement | null;
    if (!a || a === document.body || a.disabled) rootEl.current?.focus({ preventScroll: true });
  }, [i, mode]);
  // the preview of a jugada replays on its own
  useEffect(() => {
    if (mode !== "inicio" || preview !== "jugada" || reduced) return;
    const n = X.pz?.steps.length ?? 1;
    const t = window.setInterval(() => setPrevStep((s) => (s + 1) % n), 1700);
    return () => window.clearInterval(t);
  }, [mode, preview, reduced, X.pz?.steps.length]);

  const exit = () => {
    t0.current = 0;
    setPlaying(false);
    if (vz.phase !== "idle") vz.cancel();
    vz.sync(null, false, 0);
    P.nav("/pizarra/siete");
  };
  const skipBlock = () => {
    if (!cur) return;
    let j = i + 1;
    while (j < L.length && L[j].block === cur.block) j++;
    go(Math.min(j, L.length - 1));
  };
  const toInicio = () => {
    pause();
    setPop(null);
    setMode("inicio");
  };
  const fullscreen = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) void document.documentElement.requestFullscreen();
      else P.toast("Este navegador no deja usar la pantalla completa");
    } catch {
      P.toast("Este navegador no deja usar la pantalla completa");
    }
  };
  const onKey = (e: RKeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    const t = e.target as HTMLElement;
    const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
    if (k === "Escape") {
      e.preventDefault();
      if (vz.phase === "rec" || vz.phase === "asking") {
        vz.cancel();
        say("Grabación cancelada");
        return;
      }
      if (pop) {
        setPop(null);
        return;
      }
      if (ask) {
        setAsk(null);
        return;
      }
      exit();
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (mode === "inicio" || ask) return;
    if (k === "ArrowRight" || k === "PageDown") {
      e.preventDefault();
      go(i + 1);
    } else if (k === "ArrowLeft" || k === "PageUp") {
      e.preventDefault();
      go(i - 1);
    } else if (k === " " && t.tagName !== "BUTTON") {
      e.preventDefault();
      togglePlay();
    } else if (k === "Home") {
      e.preventDefault();
      go(0);
    } else if (k === "End") {
      e.preventDefault();
      go(L.length - 1);
    } else if ((k === "p" || k === "P") && desk) {
      e.preventDefault();
      setPv(!pv);
      say(pv ? "Vista del presentador cerrada" : "Vista del presentador: ahora, después, notas y el reloj");
    } else if (k === "s" || k === "S") {
      e.preventDefault();
      skipBlock();
    }
  };

  const speed = cs.speed || 1;
  const speeds = SPEEDS.map(([v, t, a]) => (
    <button key={t} type="button" aria-pressed={speed === v} aria-label={a + " (" + t + ")"} onClick={() => sl.set({ speed: v }, { undoable: false })}>
      {t}
    </button>
  ));
  const M = X.M;
  const J = M ? (M.j != null ? "J" + M.j + " · " : "") + M.rival + " · " + fmt.day(M.at) : b ? b.name : "La pizarra";
  const exitT = phone ? "Salir" : "Salir de la charla";
  const flow = !desk;
  const rootCls = ["pc", "is-" + layout, flow ? "is-flow" : "is-desk"].join(" ");
  const total = L.reduce((a, s) => a + s.dur, 0);
  const sky = <VidrioSky light={theme === "light" ? "noon" : "noche"} floodlit={theme !== "light"} className="pc-sky" />;
  const exitBtn = (
    <button type="button" className="vd-glass vd-press pc-exit" onClick={exit} aria-keyshortcuts="Escape">
      <PzIcon name="close" />
      {exitT}
    </button>
  );

  // ───────────────────────────── Así va la charla ─────────────────────────────
  if (mode === "inicio" || !L.length || !cur) {
    const nOn = X.blocks.filter((x) => x.on).length;
    const nOff = X.blocks.length - nOn;
    const firstOf = new Map<BlockId, Step>();
    const durOf = new Map<BlockId, number>();
    const vozOf = new Map<BlockId, Step[]>();
    L.forEach((s) => {
      if (!firstOf.has(s.block)) firstOf.set(s.block, s);
      durOf.set(s.block, (durOf.get(s.block) ?? 0) + s.dur);
      if (vz.byKey.has(s.vkey)) vozOf.set(s.block, [...(vozOf.get(s.block) ?? []), s]);
    });
    const nVoz = L.filter((s) => vz.byKey.has(s.vkey)).length;
    const st = X.st;
    const missN = st ? 7 - st.n : 7;
    let inH1 = "Así va la charla";
    let inLine = "";
    let noStart = false;
    if (X.none) {
      inH1 = me.socia || !ed ? "Aún no hay siete oficial" : "Sin tablero";
      inLine = "La charla presenta el oficial del partido cuando el capitán lo publique.";
      noStart = true;
    } else if (X.empty) inLine = "El siete está vacío: la charla empieza por el plan y la quedada.";
    else inLine = "Enciende, apaga y ordena los pasos. La charla presenta el titular" + (b?.isOfficial ? ", el oficial." : ".");
    if (!L.length && !X.none) {
      noStart = true;
      inLine = "Todos los pasos están apagados: enciende alguno abajo.";
    }
    const keysNow = new Set(L.map((s) => s.vkey));
    const orph = vozOrphans(vz.clips, keysNow).filter((c) => c.key.startsWith("siete:") && !c.key.includes("hueco"));
    const orphWho = orph.length ? P.sel.name(orph[0].key.slice(6)) : "";
    const moveBlock = (id: BlockId, d: number) => {
      const o = X.blocks.map((x) => x.id);
      const k = o.indexOf(id);
      const j = k + d;
      if (k < 0 || j < 0 || j >= o.length) return;
      o.splice(k, 1);
      o.splice(j, 0, id);
      const t = BLOCKS.find((x) => x.id === id)?.t ?? id;
      sl.set({ order: o }, { label: "«" + t + "» " + (d < 0 ? "antes" : "después") });
    };
    const dropBlock = (id: BlockId, onto: BlockId) => {
      const o = X.blocks.map((x) => x.id);
      const k = o.indexOf(id);
      const j = o.indexOf(onto);
      if (k < 0 || j < 0 || k === j) return;
      o.splice(k, 1);
      o.splice(j, 0, id);
      const t = BLOCKS.find((x) => x.id === id)?.t ?? id;
      sl.set({ order: o }, { label: "«" + t + "» movido" });
    };
    const tileDown = (e: RPointerEvent<HTMLButtonElement>, id: BlockId) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (e.pointerType !== "mouse") return; // (touch: the strip scrolls; ‹ › reorder)
      const x0 = e.clientX;
      const y0 = e.clientY;
      let on = false;
      let ov: BlockId | null = null;
      const move = (ev: PointerEvent) => {
        if (!on && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 9) return;
        if (!on) {
          on = true;
          setDrag(id);
        }
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const tEl = el?.closest?.("[data-pc-tile]");
        const n = (tEl?.getAttribute("data-pc-tile") as BlockId | null) ?? null;
        if (n !== ov) {
          ov = n;
          setOver(n);
        }
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (on) {
          noClick.current = Date.now() + 300;
          setDrag(null);
          setOver(null);
          if (ov && ov !== id) dropBlock(id, ov);
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
    const pv0 = firstOf.get(preview) ?? L[0];
    let prevSpec: StageSpec = { source: "siete", boardId: b?.id, version: "titular", camera: "grada", chrome: false, layer: "nada" };
    if (pv0) {
      prevSpec = { ...pv0.spec, camera: "grada", focus: null };
      if (pv0.block === "jugada") prevSpec.step = prevStep % (X.pz?.steps.length ?? 1);
    }
    const prevName = BLOCKS.find((x) => x.id === preview)?.t ?? "Los siete";
    let askH = "";
    let askP = "";
    let askActs: { t: string; pri?: boolean; run: () => void }[] = [];
    if (ask && !X.none && st) {
      if (X.empty) {
        askH = "El siete está vacío";
        askP = "No hay nadie a quien presentar: empieza por el plan o coloca el siete.";
        askActs = [
          { t: "Empezar por el plan", pri: true, run: () => start("plan", true) },
          { t: "Colocar el siete", run: () => P.nav("/pizarra/siete") },
          { t: "Ahora no", run: () => setAsk(null) },
        ];
      } else {
        askH = missN === 1 ? "Falta un " + (st.missing[0] ?? "jugador") + " en el siete" : "Faltan " + missN + " en el siete";
        askP = (missN === 1 ? "Su hueco sale" : "Sus huecos (" + st.missing.join(", ") + ") salen") + " en la charla como «hueco libre». ¿La presentas igualmente?";
        askActs = [
          { t: "Presentar igualmente", pri: true, run: () => start(null, true) },
          { t: "Completar el siete", run: () => P.nav("/pizarra/siete") },
          { t: "Empezar por el plan", run: () => start("plan", true) },
        ];
      }
    }
    const startBtn = (ref: boolean) => (
      <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" ref={ref ? goEl : undefined} onClick={() => start()} disabled={noStart}>
        <PzIcon name="play" />
        Empezar la charla
      </button>
    );
    const jOpts = X.plays.map((pl) => (
      <option key={pl.id} value={pl.id}>
        {(pl.kind === "propia" ? "Tuya · " : "") + pl.name}
      </option>
    ));
    return (
      <div className={rootCls} ref={rootEl} tabIndex={-1} onKeyDown={onKey} lang="es" role="region" aria-roledescription="presentación" aria-label="La charla: así va, antes de empezar" aria-keyshortcuts="Escape">
        {sky}
        <div className="pc-in">
          <header className="pc-head">
            {exitBtn}
            <p className="pc-head__k">{J}</p>
          </header>
          <section className="pc-in__lead" aria-labelledby="pc-in-h">
            <p className="pz-kick">{"La charla · " + (b ? b.name : "")}</p>
            <h1 className="pz-h1" id="pc-in-h">
              {inH1}
            </h1>
            <p className="pz-line">{inLine}</p>
            {L.length > 0 && (
              <div className="pz-stats pc-in__stats">
                <div className="pz-stat">
                  <span className="pz-stat__v pc-clock">{mmss(total)}</span>
                  <span className="pz-stat__k">Dura</span>
                  <span className="pz-stat__w">{"a " + (SPEEDS.find((s) => s[0] === speed)?.[1] ?? "1×")}</span>
                </div>
                <div className="pz-stat">
                  <span className="pz-stat__v">{nOn}</span>
                  <span className="pz-stat__k">Pasos</span>
                  <span className="pz-stat__w">{nOff ? nOff + " fuera" : "todos dentro"}</span>
                </div>
                <div className="pz-stat">
                  <span className="pz-stat__v">{nVoz}</span>
                  <span className="pz-stat__k">Con voz</span>
                  <span className="pz-stat__w">{nVoz ? "del capitán" : "sin voces aún"}</span>
                </div>
              </div>
            )}
            {orph.length > 0 && (
              <p className="pc-orph">
                <PzIcon name="mic" />
                <span>
                  <b>Una voz sin paso:</b> {"hablaba de " + orphWho + ", que ya no está en el siete."}
                </span>
                {ed && (
                  <button type="button" className="nx-lnk" onClick={() => void delVoz(orph[0].key, orphWho)}>
                    Borrar esa voz
                  </button>
                )}
              </p>
            )}
            {!ask && desk && (
              <div className="pc-go">
                {startBtn(true)}
                <div className="vd-glass pc-seg" role="group" aria-label="Velocidad de la charla">
                  {speeds}
                </div>
                <button type="button" className="vx-tog" aria-pressed={pv} onClick={() => setPv(!pv)} aria-keyshortcuts="P">
                  <span className="vx-tog__t" aria-hidden="true" />
                  Vista del presentador
                </button>
                <p className="pc-go__hint">Esc sale · ← → pasan los pasos · P, la vista del presentador</p>
              </div>
            )}
            {!ask && layout === "tablet" && (
              <div className="pc-go">
                <p className="pc-go__hint">Toca a los lados del campo para pasar de paso.</p>
              </div>
            )}
            {ask && !X.none && (
              <div className="vd-glass vd-glass--deep pc-ask" role="alertdialog" aria-labelledby="pc-ask-h" aria-describedby="pc-ask-p">
                <h2 id="pc-ask-h">{askH}</h2>
                <p id="pc-ask-p">{askP}</p>
                <div className="pz-acts">
                  {askActs.map((a, k) => (
                    <button key={a.t} type="button" className={"vd-glass vd-press pz-btn" + (a.pri ? " pz-btn--pri" : "")} onClick={a.run} autoFocus={k === 0}>
                      {a.t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
          <div className="pc-in__stage" aria-label={"Vista previa en el campo: " + prevName}>
            {!X.none && (
              <>
                <PiCampo layout={layout} show={prevSpec} camera="grada" inert />
                <p className="pc-in__cap">
                  <PzIcon name="eye" />
                  <span>
                    Vista previa · <b>{prevName}</b>
                  </span>
                </p>
              </>
            )}
          </div>
          {X.blocks.length > 0 && (
            <section className="pc-strip" aria-labelledby="pc-strip-h">
              <div className="pc-strip__h">
                <h2 id="pc-strip-h">Los pasos</h2>
                <p>{flow ? "Toca uno para verlo en el campo · ‹ › para ordenarlo" : "Toca uno para verlo en el campo · arrástralo o usa ‹ › para ordenarlo"}</p>
              </div>
              <ol className="pc-strip__l">
                {X.blocks.map((bk, k) => {
                  const def = BLOCKS.find((x) => x.id === bk.id) ?? { t: bk.id, icon: "dots" };
                  const d = durOf.get(bk.id) ?? 0;
                  let sub = bk.na ? bk.why : !bk.on ? "Fuera de la charla" : mmss(d);
                  let em = "";
                  let shirts: (string | null)[] = [];
                  let discs = 0;
                  if (bk.id === "siete" && X.v) {
                    shirts = X.v.slots.map((s) => s.playerId);
                    if (bk.on && st) sub = st.n + " de 7 · " + mmss(d);
                  }
                  if (bk.id === "suplentes") {
                    shirts = X.benchIds.slice(0, 6);
                    if (bk.on) sub = X.benchIds.length + " · " + mmss(d);
                  }
                  if (bk.id === "rival") discs = b?.lineup.rival?.players.length ?? 0;
                  if (bk.id === "sistema" && X.v) em = X.v.freeMode ? "Libre" : X.v.formation;
                  if (bk.id === "galones" && b) em = b.lineup.roles?.captainId ? "C · " + P.sel.name(b.lineup.roles.captainId) : "Sin brazalete";
                  if (bk.id === "plan" && b) {
                    const n = b.lineup.plan?.claves.length ?? 0;
                    em = (n ? n + (n === 1 ? " clave" : " claves") : "Sin claves") + ((b.lineup.condPlan ?? []).length ? " · Si pasa…" : "");
                  }
                  if (bk.id === "quedada" && M) em = (quedada ? fmt.hm(quedada.at) + " · " + quedada.where : fmt.hm(M.at) + (M.venue ? " · " + M.venue : ""));
                  if (bk.id === "vamos") em = "Juntos";
                  if (bk.id === "jugada" && X.pz && bk.on) sub = X.pz.steps.length + (X.pz.steps.length === 1 ? " paso" : " pasos") + " · " + mmss(d);
                  const vs = vozOf.get(bk.id) ?? [];
                  const vozT = vs.length === 0 ? "—" : vs.length === 1 ? mmss(vz.byKey.get(vs[0].vkey)!.ms / 1000) : vs.length + " voces";
                  if (bk.on && !bk.na) sub += vs.length ? " · con voz" : " · sin voz";
                  const sel = preview === bk.id;
                  const cls = ["vd-glass", "pc-tile", bk.on ? "is-on" : "is-off", bk.na ? "is-na" : "", sel ? "is-sel" : "", drag === bk.id ? "is-drag" : "", over === bk.id && drag && drag !== bk.id ? "is-over" : ""].filter(Boolean).join(" ");
                  return (
                    <li
                      key={bk.id}
                      className={cls}
                      style={{ flexGrow: bk.on ? Math.max(1, Math.round(d)) : 1 }}
                      data-pc-tile={bk.id}
                      onKeyDown={(e) => {
                        if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
                          e.preventDefault();
                          moveBlock(bk.id, e.key === "ArrowLeft" ? -1 : 1);
                        }
                      }}
                    >
                      <button
                        type="button"
                        className="pc-tile__b"
                        aria-pressed={sel}
                        aria-label={def.t + ": " + sub + ". Vista previa en el campo. Alt y flechas para moverlo."}
                        aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                        onClick={() => {
                          if (Date.now() < noClick.current) return;
                          setPreview(bk.id);
                          setPrevStep(0);
                        }}
                        onPointerDown={(e) => tileDown(e, bk.id)}
                      >
                        <PzIcon name={def.icon} />
                        <b>{def.t}</b>
                        <small>{sub}</small>
                      </button>
                      <div className="pc-tile__mid">
                        {shirts.map((pid, n) => (pid ? <Camiseta key={pid} pid={pid} /> : <span key={"h" + n} className="pc-hole" aria-hidden="true" />))}
                        {Array.from({ length: discs }, (_, n) => (
                          <i key={n} aria-hidden="true" />
                        ))}
                        {bk.id === "jugada" && (
                          <>
                            <label className="pz-vh" htmlFor="pc-jsel">
                              La jugada de la charla
                            </label>
                            <select
                              id="pc-jsel"
                              className="pc-tile__sel"
                              value={X.chosen?.id ?? ""}
                              disabled={bk.na}
                              onChange={(e) => {
                                const pl = X.plays.find((x) => x.id === e.target.value);
                                if (!pl) return;
                                sl.set({ jugada: pl.id }, { label: "La charla presenta «" + pl.name + "»" });
                                setPreview("jugada");
                                setPrevStep(0);
                              }}
                            >
                              {jOpts}
                            </select>
                          </>
                        )}
                        {em && bk.id !== "jugada" && <em>{em}</em>}
                      </div>
                      <div className="pc-tile__foot">
                        <button
                          type="button"
                          className="vx-tog"
                          aria-pressed={bk.on}
                          disabled={bk.na}
                          aria-label={(bk.on ? "Quitar de la charla: " : "Poner en la charla: ") + def.t + (bk.na ? " (" + bk.why + ")" : "")}
                          onClick={() => {
                            const off = { ...cs.off };
                            if (off[bk.id]) delete off[bk.id];
                            else off[bk.id] = true;
                            sl.set({ off }, { label: bk.on ? "«" + def.t + "» fuera de la charla" : "«" + def.t + "» vuelve a la charla" });
                          }}
                        >
                          <span className="vx-tog__t" aria-hidden="true" />
                        </button>
                        <span className={"pc-tile__voz" + (vs.length ? " is-voz" : "")} aria-hidden="true">
                          <PzIcon name="mic" />
                          <time>{vozT}</time>
                        </span>
                        <span className="pc-tile__mv">
                          <button type="button" className="pc-mv" onClick={() => moveBlock(bk.id, -1)} disabled={k === 0} aria-label={"Mover «" + def.t + "» antes"}>
                            <PzIcon name="chevL" />
                          </button>
                          <button type="button" className="pc-mv" onClick={() => moveBlock(bk.id, 1)} disabled={k === X.blocks.length - 1} aria-label={"Mover «" + def.t + "» después"}>
                            <PzIcon name="chevR" />
                          </button>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>
        {flow && !ask && (
          <div className="vd-glass vd-glass--deep pc-gobar">
            {startBtn(true)}
            <div className="pc-seg" role="group" aria-label="Velocidad de la charla">
              {speeds}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ───────────────────────────── Jugando ─────────────────────────────
  const s = cur;
  const k = Math.min(i, L.length - 1);
  const nx = L[k + 1];
  const frac = Math.min(1, elMs / (s.dur * 1000));
  const blockDef = BLOCKS.find((x) => x.id === s.block) ?? { t: "" };
  const ended = k === L.length - 1 && !playing && frac >= 1;
  const acts: { t: string; icon: string; pri?: boolean; run: () => void }[] = [];
  if (s.block === "jugada" && s.play) {
    const first = L.findIndex((x) => x.block === "jugada");
    acts.push({ t: "Otra vez", icon: "undoA", run: () => go(first, playing) });
    if (!s.play.startsWith("lib-")) acts.push({ t: "Abrir en Jugadas", icon: "arrowR", run: () => P.nav("/pizarra/jugadas/" + s.play) });
  }
  if (ended) {
    acts.push({
      t: "Otra vez desde el principio",
      icon: "undoA",
      run: () => {
        go(0, !reduced);
      },
    });
    acts.push({ t: "Salir", icon: "close", pri: true, run: exit });
  }
  const clip = vz.byKey.get(s.vkey) ?? null;
  const vozLen = clip ? clip.ms / 1000 : 0;
  const vozEl = clip ? Math.min(vozLen, elMs / 1000) : 0;
  const vozLive = !!clip && !muted && playing && vozEl < vozLen;
  const rec = vz.phase === "rec" || vz.phase === "asking" || vz.phase === "saving";
  const canRec = ed && !!b && !b.draft;
  const who = s.pid ? s.head : s.t.split(" · ")[0];
  const recStart = () => {
    if (!ed) return P.toast("Solo el capitán graba la voz de la charla");
    if (!b || b.draft) return P.toast("Guarda el tablero para poder grabar la voz (con tu primer cambio)");
    if (!vz.byKey.has(s.vkey) && vz.byKey.size >= 6) return P.toast("Ya hay voz en 6 pasos: borra una para grabar otra");
    if (playing) pause();
    setPop("voz");
    vz.record(s.vkey, who);
  };
  let why = "";
  if (vz.error) why = vz.error;
  else if (!canRec && !rec) why = !ed ? "La voz la graba el capitán; tú la oyes aquí." : "Guarda el tablero para poder grabar la voz (con tu primer cambio).";
  else if (vz.phase === "asking") why = "Dale permiso al micrófono para grabar.";
  else if (vz.phase === "saving") why = "Guardando la voz…";
  else if (rec) why = "Se para sola a los 30 s. La charla espera.";
  else if (canRec && vz.unsupported) why = vz.unsupported;
  else why = clip ? "Va con " + (s.pid ? s.head : "«" + who + "»") + ", no con el número del paso: si cambia de sitio, la voz se va con él." : "Grábala aquí: suena al llegar a este paso y la charla espera a que acabe.";
  const elTot = L.slice(0, k).reduce((a, x) => a + x.dur, 0) + elMs / 1000;
  const firstIdx = new Map<BlockId, number>();
  L.forEach((x, n) => {
    if (!firstIdx.has(x.block)) firstIdx.set(x.block, n);
  });
  const notes = cs.notes?.[s.vkey] ?? (s.block === "plan" ? (b?.lineup.plan?.notes ?? "") : "");
  const playIc = reduced ? "chevR" : playing ? "pause" : "play";
  const playAria = reduced ? "Avanzar la charla un paso" : playing ? "Pausar la charla" : ended ? "Volver a empezar la charla" : "Reproducir la charla";
  const rich = phone && (s.rows.length > 0 || s.bench.length > 0 || s.claves.length > 0);
  const plCls = ["pc-pl", pv && desk ? "is-pv" : "", s.spec.camera === "foco" ? "is-foco" : "", rich ? "is-rich" : "", s.pid ? "has-card" : ""].filter(Boolean).join(" ");
  const rows = phone ? s.rows.slice(0, 3) : s.rows;
  const bench = phone ? s.bench.slice(0, 5) : s.bench;
  const waveBars = (big: boolean) => (
    <span className={"pc-wave" + (vozLive || vz.phase === "rec" ? " is-live" : "")} aria-hidden="true">
      {WAVE.map((h, n) => (
        <i key={n} className={clip && n / WAVE.length < vozEl / (vozLen || 1) ? "is-p" : ""} style={{ ["--h" as string]: (big ? h + 6 : Math.round(h * 0.8)) + "px", ["--k" as string]: n }} />
      ))}
    </span>
  );
  return (
    <div className={rootCls} ref={rootEl} tabIndex={-1} onKeyDown={onKey} lang="es" role="region" aria-roledescription="presentación" aria-label={"La charla · paso " + (k + 1) + " de " + L.length} aria-keyshortcuts="Escape ArrowLeft ArrowRight Space Home End P S">
      {sky}
      <div className={plCls}>
        <div className="pc-pl__stage">
          <PiCampo layout={layout} show={s.spec} camera={s.spec.camera} inert />
          <div className={"pc-sweep" + (s.block === "vamos" && stepIn ? " is-on" : "")} aria-hidden="true" />
          <button type="button" className="pc-tap pc-tap--prev" tabIndex={-1} onClick={() => go(k - 1)} aria-label="Paso anterior" />
          <button type="button" className="pc-tap pc-tap--next" tabIndex={-1} onClick={() => go(k + 1)} aria-label="Paso siguiente" />
        </div>
        <div className="pc-scrim" aria-hidden="true" />
        <header className="pc-top">
          <div className="pc-prog" role="progressbar" aria-label="Momento de la charla" aria-valuemin={0} aria-valuemax={L.length} aria-valuenow={k + 1} aria-valuetext={"Paso " + (k + 1) + " de " + L.length + ": " + s.t}>
            {L.map((x, n) => (
              <span key={x.id} className={[n < k ? "is-done" : "", n > 0 && L[n - 1].block !== x.block ? "is-blk" : ""].filter(Boolean).join(" ")} style={{ flexGrow: Math.max(1, Math.round(x.dur)) }}>
                <i style={{ width: (n < k ? 100 : n === k ? Math.round(frac * 1000) / 10 : 0) + "%" }} />
              </span>
            ))}
          </div>
          <div className="pc-head">
            <p className="pc-head__k">
              <b>{blockDef.t}</b>
              {desk && " · " + J}
            </p>
            <div className="pc-head__r">
              {desk && (
                <button type="button" className="vd-glass vd-press nx-ib pc-ib" onClick={fullscreen} aria-label="Pantalla completa">
                  <svg className="nx-ic" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                  </svg>
                </button>
              )}
              {exitBtn}
            </div>
          </div>
        </header>
        {s.pid && <CharlaCard pid={s.pid} phone={phone} shown={stepIn} />}
        <section className={"pc-cap" + (stepIn ? "" : " is-out")} aria-labelledby="pc-cap-h" aria-live="off">
          <p className="pc-cap__k">{s.kick}</p>
          <h1 className={"pc-cap__h " + s.hCls} id="pc-cap-h">
            {s.head}
          </h1>
          {s.line && <p className="pc-cap__l">{s.line}</p>}
          {s.chips.length > 0 && (
            <div className="pc-chips">
              {s.chips.map((c) => (
                <span key={c.t} className={"pz-chip " + c.cls}>
                  <PzIcon name={c.icon} />
                  {c.t}
                </span>
              ))}
            </div>
          )}
          {s.claves.length > 0 && (
            <ul className="pc-claves">
              {s.claves.map((c) => (
                <li key={c.t}>
                  <span className="vx-tile">
                    <PzIcon name={c.icon} />
                  </span>
                  <span>{c.t}</span>
                </li>
              ))}
            </ul>
          )}
          {bench.length > 0 && (
            <ul className="pc-bench">
              {bench.map((p) => (
                <li key={p.pid}>
                  <Camiseta pid={p.pid} />
                  <b>{p.name}</b>
                  <small>{p.w}</small>
                </li>
              ))}
            </ul>
          )}
          {rows.length > 0 && (
            <ul className="pc-rows">
              {rows.map((r) => (
                <li key={r.mark + r.t + r.s}>
                  {r.kind === "disc" && (
                    <span className="pc-disc" aria-hidden="true">
                      {r.mark}
                    </span>
                  )}
                  {r.kind === "gal" && (
                    <span className={"pc-gal k-" + r.mark} aria-hidden="true">
                      {r.mark}
                    </span>
                  )}
                  {r.kind === "ic" && (
                    <span className="vx-tile" aria-hidden="true">
                      <PzIcon name={r.mark} />
                    </span>
                  )}
                  <span>
                    <b>{r.t}</b>
                    {r.s && <small>{r.s}</small>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {s.foot && (
            <p className="pc-cap__f">
              <PzIcon name="swap" />
              <span>{s.foot}</span>
            </p>
          )}
          {acts.length > 0 && (
            <div className="pz-acts">
              {acts.map((a) => (
                <button key={a.t} type="button" className={"vd-glass vd-press pz-btn" + (a.pri ? " pz-btn--pri" : "")} onClick={a.run}>
                  <PzIcon name={a.icon} />
                  {a.t}
                </button>
              ))}
            </div>
          )}
        </section>

        {(clip || rec) && pop !== "voz" && (
          <p className={"pc-voz" + (phone && s.pid ? " is-card" : "")} role="status">
            {waveBars(false)}
            <span>{rec ? "Grabando la voz · " + vz.recWho : (muted ? "Silenciada · " : vozLive ? "Suena · " : "Voz · ") + who}</span>
            <time>{rec ? mmss(vz.elapsed) : mmss(vozEl) + " / " + mmss(vozLen)}</time>
          </p>
        )}

        {pop === "voz" && (
          <div className="vd-glass vd-glass--deep pc-pop" role="dialog" aria-labelledby="pc-pop-h">
            <h2 id="pc-pop-h">
              {vz.phase === "rec" ? "Grabando" : "La voz · " + who}
              <button
                type="button"
                className="vd-glass vd-press nx-ib"
                style={{ width: 40, height: 40 }}
                onClick={() => {
                  if (vz.phase === "rec" || vz.phase === "asking") vz.cancel();
                  vz.clearError();
                  setPop(null);
                }}
                aria-label="Cerrar la voz"
              >
                <PzIcon name="close" />
              </button>
            </h2>
            {vz.phase === "rec" && (
              <p className="pc-recbig" role="status">
                <span className="pc-rec" aria-hidden="true" />
                {mmss(vz.elapsed) + " / 0:30"}
              </p>
            )}
            {(clip || vz.phase === "rec") && waveBars(true)}
            <p className="pc-pop__q">{vz.phase === "rec" ? "Habla ahora: «" + s.head + "»" : clip ? "Voz de " + mmss(vozLen) + (clip.by ? " · grabada por " + (clip.by === me.uid ? "ti" : "el capitán") : "") : "Sin voz en este paso."}</p>
            <p role={vz.error ? "alert" : undefined}>{why}</p>
            <div className="pz-acts">
              {vz.phase === "rec" ? (
                <>
                  <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={vz.stop}>
                    Parar y guardar
                  </button>
                  <button type="button" className="vd-glass vd-press pz-btn" onClick={vz.cancel}>
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  {clip && (
                    <button
                      type="button"
                      className={"vd-glass vd-press pz-btn" + (canRec ? "" : " pz-btn--pri")}
                      disabled={vz.phase !== "idle"}
                      onClick={() => {
                        if (vozLive) pause();
                        else {
                          acc.current = 0;
                          setElMs(0);
                          play();
                        }
                      }}
                    >
                      {vozLive ? "Pausar" : "Oír la voz"}
                    </button>
                  )}
                  {canRec && (
                    <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={recStart} disabled={vz.phase !== "idle" || !!vz.unsupported}>
                      {clip ? "Volver a grabar" : "Grabar la voz"}
                    </button>
                  )}
                  {clip && canRec && (
                    <button type="button" className="vd-glass vd-press pz-btn" disabled={vz.phase !== "idle"} onClick={() => void delVoz(s.vkey, who)}>
                      Borrar
                    </button>
                  )}
                </>
              )}
            </div>
            <button type="button" className="vx-tog" aria-pressed={muted} onClick={() => {
                changePrefs(P, { vozMute: !muted });
                P.say(muted ? "Las voces vuelven a sonar" : "Voces silenciadas");
              }}>
              <span className="vx-tog__t" aria-hidden="true" />
              Silenciar las voces
            </button>
          </div>
        )}

        {pop === "mas" && (
          <div className="vd-glass vd-glass--deep pc-pop" role="dialog" aria-labelledby="pc-mas-h">
            <h2 id="pc-mas-h">
              La charla
              <button type="button" className="vd-glass vd-press nx-ib" style={{ width: 40, height: 40 }} onClick={() => setPop(null)} aria-label="Cerrar">
                <PzIcon name="close" />
              </button>
            </h2>
            <div className="pc-lbl">
              Velocidad
              <div className="vd-glass pc-seg" role="group" aria-label="Velocidad de la charla">
                {speeds}
              </div>
            </div>
            <div className="pz-acts">
              <button
                type="button"
                className="vd-glass vd-press pz-btn"
                onClick={() => {
                  setPop(null);
                  go(0);
                }}
              >
                Desde el principio
              </button>
              <button type="button" className="vd-glass vd-press pz-btn" onClick={toInicio}>
                Cambiar los pasos
              </button>
            </div>
          </div>
        )}

        <div className="vd-glass pc-tr" role="toolbar" aria-label="Controles de la charla">
          <button type="button" className="pc-tr__b is-ic" onClick={() => go(k - 1)} disabled={k === 0} aria-label="Paso anterior" aria-keyshortcuts="ArrowLeft PageUp">
            <PzIcon name="chevL" />
          </button>
          <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri pc-tr__play" ref={playEl} onClick={togglePlay} aria-label={playAria} aria-keyshortcuts="Space" disabled={rec}>
            <PzIcon name={playIc} />
          </button>
          <button type="button" className="pc-tr__b is-ic" onClick={() => go(k + 1)} disabled={k >= L.length - 1} aria-label="Paso siguiente" aria-keyshortcuts="ArrowRight PageDown">
            <PzIcon name="chevR" />
          </button>
          <span className="pc-tr__sep" aria-hidden="true" />
          <button type="button" className="pc-tr__b" onClick={skipBlock} disabled={k >= L.length - 1} aria-label={"Saltar este paso: " + blockDef.t} aria-keyshortcuts="S">
            {phone ? "Saltar" : "Saltar este paso"}
          </button>
          {desk && !pv && (
            <div className="vd-glass pc-seg" role="group" aria-label="Velocidad de la charla">
              {speeds}
            </div>
          )}
          <button type="button" className={"pc-tr__b" + (clip ? " is-voz" : "") + (phone ? " is-ic" : "")} onClick={() => setPop(pop === "voz" ? null : "voz")} aria-pressed={pop === "voz"} aria-label={"La voz de este paso" + (clip ? ": " + mmss(vozLen) : ": sin voz")}>
            {rec && <span className="pc-rec" aria-hidden="true" />}
            <PzIcon name="mic" />
            {!phone && "Voz"}
          </button>
          {desk && (
            <button type="button" className="pc-tr__b" aria-pressed={pv} onClick={() => setPv(!pv)} aria-keyshortcuts="P">
              <PzIcon name="eye" />
              Presentador
            </button>
          )}
          {!desk && (
            <button type="button" className="pc-tr__b is-ic" onClick={() => setPop(pop === "mas" ? null : "mas")} aria-pressed={pop === "mas"} aria-label="Más: velocidad y pasos">
              <PzIcon name="dots" />
            </button>
          )}
        </div>

        {pv && desk && (
          <aside className="vd-glass vd-glass--deep pc-pv" aria-label="Vista del presentador">
            <div className="pc-pv__h">
              <h2>Vista del presentador</h2>
              <button type="button" className="vd-glass vd-press nx-ib" style={{ width: 40, height: 40 }} onClick={() => setPv(false)} aria-label="Cerrar la vista del presentador" aria-keyshortcuts="P">
                <PzIcon name="close" />
              </button>
            </div>
            <div className="pc-pv__sc">
              <div className="pc-pv__clock" role="timer" aria-label={"Llevamos " + mmss(elTot) + " de " + mmss(total)}>
                <b>{mmss(elTot)}</b>
                <span>
                  de <time>{mmss(total)}</time> · paso {k + 1 + " de " + L.length}
                </span>
              </div>
              <section className="pc-pv__sec">
                <h3>Ahora</h3>
                <p className="pc-pv__now">{s.t}</p>
                {s.line && <p>{s.line}</p>}
              </section>
              <section className="pc-pv__sec">
                <h3>Después</h3>
                <p className="pc-pv__nx">{nx ? nx.t : "Fin: ¡Vamos, Piti!"}</p>
              </section>
              <section className="pc-pv__sec">
                <h3>
                  <label htmlFor="pc-notes">{"Notas · " + who}</label>
                </h3>
                <textarea
                  id="pc-notes"
                  value={notes}
                  placeholder="Lo que quieres decir aquí (se queda en este dispositivo)"
                  maxLength={400}
                  onChange={(e) => sl.set({ notes: { ...(cs.notes ?? {}), [s.vkey]: e.target.value } }, { undoable: false })}
                />
              </section>
              <section className="pc-pv__sec">
                <h3>El guion</h3>
                <ol className="pc-guion">
                  {X.blocks.map((bk) => {
                    const def = BLOCKS.find((x) => x.id === bk.id) ?? { t: bk.id };
                    const k0 = firstIdx.get(bk.id);
                    const curB = s.block === bk.id;
                    const done = k0 != null && !curB && k0 < k;
                    const w = !bk.on ? "Fuera" : curB ? "Ahora" : done ? "Hecho" : "Luego";
                    return (
                      <li key={bk.id} className={bk.on ? "" : "is-off"}>
                        <button type="button" onClick={() => k0 != null && go(k0)} aria-current={curB ? "step" : undefined} disabled={!bk.on}>
                          <b>{def.t}</b>
                          <small className={curB ? "is-now" : ""}>
                            <PzIcon name={!bk.on ? "cross" : curB ? "play" : done ? "check" : "clock"} />
                            {w}
                          </small>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>
            <div className="pc-pv__tools">
              <div className="vd-glass pc-seg" role="group" aria-label="Velocidad de la charla">
                {speeds}
              </div>
              <button type="button" className="vd-glass vd-press pz-btn" onClick={toInicio}>
                Cambiar los pasos
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
