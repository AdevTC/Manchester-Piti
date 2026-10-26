// La mesa · En juego (the canvas's MainV2, and its offline state SinCoberturaV2): the LED housing with the
// score and the clock, the keys (Pausa, añadido, Fin de parte), the floodlit pitch with the seven, the
// dugout, the rival bar and the dock (last play, lower third with «Deshacer», «Gol del Piti»). Tapping a
// shirt opens the action ring; «Gol del Piti» asks «¿Quién marcó?», then the pitch asks for the pass.
// A change is written at once; its lower third offers «Recolocar» (./recolocar): the scorer taps pairs who
// swap places and «Hecho» sends just the swaps, at the change's own time. The ring's «Cambiar de sitio»
// does the same without a change.
// Without signal it is the same screen: amber housing, «Sin red», ↓N per player, a queue line in the dock.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { allowedAtBreak } from "../../../functions/src/liveRules";
import { Shirt, ShirtDefs } from "./Shirt";
import { pitchLeft, pitchTop, spreadTops } from "./model";
import { DRAFT_MAX, draftItems, placeName, previewPitch, type Draft } from "./recolocar";
import { hhmm, matchLine } from "./screens/model";

/** How long after kick-off (seconds of play) the «INICIO» lower third offers to take the whistle back. */
const KICK_STRAP_SECONDS = 15;
import type { MesaEvent, MesaPlayer, MesaScreenProps, MesaType, MesaView } from "./types";

// ---------- icons (the canvas's symbols)
const ICON: Record<string, string> = {
  ocasion: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18",
  palo: "M5 21V5h14v16M16 10a2 2 0 100-.01",
  faltaR: "M5 19l14-14M9 5h10v10",
  faltaH: "M10 11H3l2-4h8M15 18a5 5 0 100-10 5 5 0 000 10z",
  cambio: "M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4",
  sitio: "M4 8h13l-3-3M20 16H7l3 3",
  tarjeta: "M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1z",
  lesion: "M12 21s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.6-7 10-7 10z",
  parada: "M7 11V6a1.5 1.5 0 013 0v4M10 10V4.5a1.5 1.5 0 013 0V10M13 10V5.5a1.5 1.5 0 013 0V11M16 9.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1a6 6 0 01-5-2.7L4 14",
  gol: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7l4 3-1.5 5h-5L8 10z",
  back: "M15 18l-6-6 6-6",
};
const Ico = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const BackIcon = () => <Ico d={ICON.back} size={20} />;
const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const DownIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v13M6 12l6 6 6-6" />
  </svg>
);
const NoSignal = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M2 8.5a15 15 0 0120 0M5 12a10 10 0 0114 0M8.5 15.5a5 5 0 017 0M12 19h.01M3 3l18 18" />
  </svg>
);
const BallMini = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0c1733" strokeWidth="2.4" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7l4 3-1.5 5h-5L8 10z" />
  </svg>
);

type Mode =
  | { k: "" }
  | { k: "ring"; id: string; fx: number; fy: number; cards: boolean }
  | { k: "gol" }
  | { k: "mas" }
  | { k: "assist"; goalId: string; scorer: string }
  | { k: "out"; inId: string }
  | { k: "outFrom"; outId: string }
  | { k: "review" };

const NONE: Mode = { k: "" };
/** A button of the lower third (a draft's «Recolocar», «Deshacer», «Hecho»): what it does, by name (the
 *  handlers read the draft's ref, so they are looked up on the tap, not carried through render). */
interface StrapButton {
  label: string;
  /** The way forward (a filled pill). */
  go?: boolean;
  act: "recolocar" | "undoPlace" | "done" | "cancelPlaces";
}
const ASSIST_MS = 14_000;
const STRAP_MS = 6_000;
/** How long the pair just swapped keeps its ping. */
const MOVED_MS = 1_200;

const liveWord = (v: MesaView) => (v.match.clock.held ? "En pausa" : "En juego");

function Presence({ view }: { view: MesaView }) {
  const fresh = view.presence.filter((p) => p.fresh);
  const others = fresh.filter((p) => !p.me);
  if (!view.queue.online)
    return (
      <button type="button" className="sig" onClick={view.actions.retryNow} aria-label={`Sin red. ${view.queue.pending ? `${view.queue.pending} en el móvil. ` : ""}Toca para reintentar`}>
        <NoSignal />
        Sin red
      </button>
    );
  const who = [view.me.name, ...others.map((p) => p.name)];
  const label = others.length ? `${["Tú", ...others.map((p) => p.name)].join(" y ")} anotando, al día` : "Solo tú anotando, al día";
  const COLORS = ["#a9d6f5", "#FFC659", "#7ee0a6", "#ffb3aa"];
  return (
    <span className="who" role="img" aria-label={label}>
      <span style={{ display: "inline-flex" }}>
        {who.slice(0, 3).map((n, i) => (
          <span key={`${n}-${i}`} className="av" style={{ background: COLORS[i % COLORS.length] }}>
            {(n.trim()[0] ?? "?").toUpperCase()}
          </span>
        ))}
      </span>
      <i className="ok" />
      {others.length ? null : <span>Solo tú</span>}
    </span>
  );
}

function Stickers({ p }: { p: MesaPlayer }) {
  const s = p.stickers;
  return (
    <span className="stk">
      {s.goals > 0 && (
        <span className="ball">
          <BallMini />
          {s.goals > 1 ? s.goals : ""}
        </span>
      )}
      {s.yellow && !s.red && <span className="ck y">A</span>}
      {s.red && <span className="ck r">R</span>}
      {s.injured && <span className="ck t">+</span>}
    </span>
  );
}

const playerAria = (p: MesaPlayer) =>
  [
    `${p.name}${p.number ? `, dorsal ${p.number}` : ""}`,
    `${p.minutes}′`,
    p.stickers.goals ? `${p.stickers.goals} ${p.stickers.goals === 1 ? "gol" : "goles"}` : "",
    p.stickers.red ? "expulsado" : p.stickers.yellow ? "amonestado" : "",
    p.stickers.injured ? "tocado" : "",
    p.pending ? `${p.pending} sin subir` : "",
  ]
    .filter(Boolean)
    .join(", ");

/** The ring around a player: Gol on top, then the canvas's order. The keeper gets Parada instead of Tocado;
 *  «Cambiar de sitio» hangs under «Cambio». */
function ringItems(p: MesaPlayer, cards: boolean): { label: string; type: MesaType | "_cards" | "_back" | "_sub" | "_place"; icon?: string; gold?: boolean; sw?: { color: string; letter: string } }[] {
  if (cards)
    return [
      { label: "Amarilla", type: p.stickers.yellow ? "double_yellow" : "yellow_card", sw: { color: "#FFC659", letter: "A" } },
      { label: "Roja", type: "red_card", sw: { color: "#ff6b61", letter: "R" } },
      { label: "Volver", type: "_back", icon: ICON.back },
    ];
  return [
    { label: `Gol de ${p.name}`, type: "goal", icon: ICON.gol, gold: true },
    { label: "Ocasión", type: "chance", icon: ICON.ocasion },
    { label: "Al palo", type: "woodwork", icon: ICON.palo },
    { label: "Le hacen falta", type: "foul_received", icon: ICON.faltaR },
    { label: "Cambio", type: "_sub", icon: ICON.cambio },
    { label: "Hace falta", type: "foul", icon: ICON.faltaH },
    { label: "Tarjeta", type: "_cards", icon: ICON.tarjeta },
    p.keeper ? { label: "Parada", type: "save", icon: ICON.parada } : { label: "Tocado", type: "injury", icon: ICON.lesion },
    { label: "Cambiar de sitio", type: "_place", icon: ICON.sitio },
  ];
}
const RING_POS = [[0, -158], [108, -94], [124, 0], [102, 94], [0, 158], [-104, 94], [-124, 0], [-108, -94], [0, 214]];
const CARD_POS = [[0, -156], [106, 80], [-106, 80]];

/** The plays of the rival's «···» sheet. */
const RIVAL_MORE: { label: string; type: MesaType }[] = [
  { label: "Ocasión suya", type: "opponent_chance" },
  { label: "Amarilla suya", type: "opponent_yellow" },
  { label: "Roja suya", type: "opponent_red" },
  { label: "Penalti en contra", type: "penalty_committed" },
  { label: "Penalti a favor", type: "penalty_received" },
  { label: "Fuera de juego", type: "opponent_offside" },
  { label: "Fallan su penalti", type: "opponent_penalty_missed" },
];

function Sheet({ label, kicker, kickerColor, title, onClose, children }: { label: string; kicker: string; kickerColor?: string; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button:not(.back)")?.focus();
  }, []);
  return (
    <>
      <button type="button" className="scrim" aria-label="Cerrar" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} ref={ref}>
        <div className="grab" />
        <div className="sh">
          <div>
            <div className="kk" style={kickerColor ? { color: kickerColor } : undefined}>
              {kicker}
            </div>
            <h2>{title}</h2>
          </div>
          <button type="button" className="back" aria-label="Cerrar" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

function ReviewSheet({ view, onClose }: { view: MesaView; onClose: () => void }) {
  const [fix, setFix] = useState<Record<string, { playerId?: string; minute?: number }>>({});
  const players = [...view.field, ...view.bench];
  return (
    <Sheet label="Por revisar" kicker={`${view.queue.review.length} sin subir`} kickerColor="#ffc677" title="Por revisar" onClose={onClose}>
      <ul className="rv">
        {view.queue.review.map((r) => {
          const f = fix[r.requestId] ?? {};
          const minute = f.minute ?? r.minute;
          return (
            <li key={r.requestId}>
              <b>
                {r.minute}′ · {r.text}
              </b>
              <small role="note">{r.reason}</small>
              <div className="rv-fix">
                {r.playerId !== null && (
                  <label>
                    <span className="sr">Jugador</span>
                    <select value={f.playerId ?? r.playerId ?? ""} onChange={(e) => setFix({ ...fix, [r.requestId]: { ...f, playerId: e.target.value } })}>
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <span className="stp" role="group" aria-label="Minuto">
                  <button type="button" aria-label="Un minuto menos" disabled={minute <= 1} onClick={() => setFix({ ...fix, [r.requestId]: { ...f, minute: Math.max(1, minute - 1) } })}>
                    −
                  </button>
                  <span className="g">{minute}′</span>
                  <button type="button" aria-label="Un minuto más" onClick={() => setFix({ ...fix, [r.requestId]: { ...f, minute: minute + 1 } })}>
                    +
                  </button>
                </span>
              </div>
              <div className="gh">
                <button type="button" onClick={() => view.actions.discard(r.requestId)}>
                  Descartar
                </button>
                <button type="button" className="rv-go" onClick={() => view.actions.resend(r.requestId, f)}>
                  Reenviar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

export function EnJuego({ view }: MesaScreenProps) {
  const { match, field, bench, queue, actions } = view;
  const clock = match.clock;
  const [mode, setMode] = useState<Mode>(NONE);
  const [strapId, setStrapId] = useState<string | null>(null);
  const [flash, setFlash] = useState<"" | "home" | "away">("");
  const [pop, setPop] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  /** The kick-off's «Deshacer» was used (or the strap dismissed): it doesn't come back. */
  const [kickGone, setKickGone] = useState(false);
  /** The swaps being made, not sent yet: «Recolocar» / «Cambiar de sitio» (./recolocar; no change in it,
   *  the change is already written). */
  const [draft, setDraftState] = useState<Draft | null>(null);
  /** The pair just swapped (their halos ping). */
  const [moved, setMoved] = useState<readonly string[]>([]);
  const close = () => setMode(NONE);
  // (the draft also lives in a ref: two quick taps must see the latest one at once)
  const draftRef = useRef<Draft | null>(null);
  const setDraft = (d: Draft | null) => {
    draftRef.current = d;
    setDraftState(d);
  };
  /** Sends the swaps made: one play when there is one (it gets the lower third and its «Deshacer»), else one
   *  wave, all or none. After a change they carry the change's own time (they sort right after it in the
   *  acta); from the ring, the time now. Returns the single play's id. */
  const commit = (): string | null => {
    const d = draftRef.current;
    if (!d) return null;
    setDraft(null);
    const items = draftItems(d);
    const at = d.alone ? undefined : d.at;
    if (!items.length) return null;
    if (items.length === 1) return actions.add("position_swap", { playerId: items[0].playerId, inPlayerId: items[0].inPlayerId }, at);
    actions.addMany(items, at);
    return null;
  };
  useEffect(() => {
    if (!moved.length) return;
    const t = window.setTimeout(() => setMoved([]), MOVED_MS);
    return () => window.clearTimeout(t);
  }, [moved]);

  // the goal: digit flip with the gold ribbon (red on theirs), floodlight flare
  const total = { us: match.score.us + match.queuedGoals.us, them: match.score.them + match.queuedGoals.them };
  const prev = useRef(total);
  useEffect(() => {
    const p = prev.current;
    prev.current = total;
    const f = total.us > p.us ? "home" : total.them > p.them ? "away" : "";
    if (!f) return;
    setFlash(f);
    const t = window.setTimeout(() => setFlash(""), 2700);
    return () => window.clearTimeout(t);
  }, [total.us, total.them]); // eslint-disable-line react-hooks/exhaustive-deps -- (the two counts are the change)

  // the lower third of my last play, a few seconds
  useEffect(() => {
    if (!strapId || mode.k === "assist") return;
    const t = window.setTimeout(() => setStrapId(null), STRAP_MS);
    return () => window.clearTimeout(t);
  }, [strapId, mode.k]);
  // the pass is asked for a while, then the pitch goes back to normal
  useEffect(() => {
    if (mode.k !== "assist") return;
    const t = window.setTimeout(() => setMode(NONE), ASSIST_MS);
    return () => window.clearTimeout(t);
  }, [mode]);
  useEffect(() => {
    if (!pop) return;
    const t = window.setTimeout(() => setPop(null), 700);
    return () => window.clearTimeout(t);
  }, [pop]);
  useEffect(() => {
    if (!confirmEnd) return;
    const t = window.setTimeout(() => setConfirmEnd(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirmEnd]);
  useEffect(() => {
    if (mode.k === "") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMode(NONE);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode.k]);

  // the dock is fixed: a spacer of its height keeps the bench above it
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockH, setDockH] = useState(150);
  useLayoutEffect(() => {
    const el = dockRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setDockH(el.offsetHeight));
    ro.observe(el);
    setDockH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  const held = clock.held;
  const can = (type: MesaType) => clock.playing || (held && allowedAtBreak(type));
  const add = (type: MesaType, opts?: { playerId?: string; inPlayerId?: string }) => {
    if (!can(type)) return;
    // (pairs already made go first: the queue keeps the order)
    commit();
    const id = actions.add(type, opts);
    setStrapId(id);
    if (opts?.playerId) setPop(opts.playerId);
    if (type === "goal" && opts?.playerId) setMode({ k: "assist", goalId: id, scorer: opts.playerId });
    else setMode(NONE);
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      /* view.notice says why */
    } finally {
      setBusy(false);
    }
  };
  const nowAt = () => ({ elapsed: clock.elapsedSeconds, period: clock.period });
  /** A change: held as a draft (another one joins it) until «Hecho», the timer or the next play. */
  const swap = (outId: string, inId: string) => add("substitution", { playerId: outId, inPlayerId: inId });
  /** «Recolocar» (after the change `after`, at its time) / «Cambiar de sitio» (alone): the pitch asks for
   *  pairs, `first` already picked. */
  const startPlaces = (first: string | null, after: MesaEvent | null) => {
    setDraft({ subs: [], swaps: [], at: after ? { elapsed: after.elapsedSeconds ?? clock.elapsedSeconds, period: after.period } : nowAt(), step: "swap", pick: first, alone: !after });
    setStrapId(null);
    setMode(NONE);
  };
  const pickPlace = (id: string) => {
    const d = draftRef.current;
    if (!d) return;
    if (!d.pick) return setDraft({ ...d, pick: id });
    if (d.pick === id) return setDraft({ ...d, pick: null });
    if (draftItems(d).length >= DRAFT_MAX) return;
    const pair = [d.pick, id] as const;
    setDraft({ ...d, swaps: [...d.swaps, pair], pick: null });
    setMoved(pair);
  };
  const undoPlace = () => {
    const d = draftRef.current;
    if (!d) return;
    const last = d.swaps[d.swaps.length - 1];
    if (last) setMoved(last);
    const rest = d.swaps.slice(0, -1);
    setDraft({ ...d, swaps: rest, pick: null });
  };
  const done = () => {
    const id = commit();
    if (id) setStrapId(id);
  };
  const onStrap = (act: StrapButton["act"]) => {
    if (act === "recolocar") {
      const change = strapId ? view.events.find((e) => e.id === strapId) ?? null : null;
      return startPlaces(change?.inPlayerId ?? null, change);
    }
    if (act === "undoPlace") return undoPlace();
    if (act === "done") return done();
    setDraft(null);
  };
  const swapping = draft?.step === "swap" ? draft : null;
  const shown = previewPitch(field, bench, draft, clock.minute);

  const openRing = (p: MesaPlayer, e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = Math.round(r.left + r.width / 2 - window.innerWidth / 2);
    const fy = Math.round(r.top + 22 - window.innerHeight * 0.52);
    setStrapId(null);
    setMode({ k: "ring", id: p.id, fx, fy, cards: false });
  };
  const tapField = (p: MesaPlayer, e: MouseEvent<HTMLButtonElement>) => {
    if (swapping) return pickPlace(p.id);
    if (mode.k === "assist") {
      // the scorer again: another play of his (a second goal…); the pass stays unasked (the acta asks)
      if (p.id === mode.scorer) return openRing(p, e);
      void actions.edit(mode.goalId, { assistPlayerId: p.id }).catch(() => undefined);
      setPop(p.id);
      setStrapId(mode.goalId);
      setMode(NONE);
      return;
    }
    if (mode.k === "out") return swap(p.id, mode.inId);
    if (mode.k === "outFrom") return close();
    openRing(p, e);
  };
  // the slot a red left empty: someone from the bench comes on «por» the player sent off
  const tapVacancy = (v: MesaPlayer) => {
    if (swapping) return;
    if (mode.k === "out") return swap(v.id, mode.inId);
    setStrapId(null);
    setMode(mode.k === "outFrom" && mode.outId === v.id ? NONE : { k: "outFrom", outId: v.id });
  };
  const tapBench = (p: MesaPlayer) => {
    // (while recolocating, only the pitch answers)
    if (p.sentOff || swapping) return;
    if (mode.k === "outFrom") return swap(mode.outId, p.id);
    setStrapId(null);
    setMode(mode.k === "out" && mode.inId === p.id ? NONE : { k: "out", inId: p.id });
  };

  const sel = mode.k === "ring" ? shown.field.find((p) => p.id === mode.id) : undefined;
  const lastStrap: MesaEvent | null = strapId ? view.events.find((e) => e.id === strapId) ?? null : null;
  const goalEv = mode.k === "assist" ? view.events.find((e) => e.id === mode.goalId) ?? null : null;
  const scorerName = mode.k === "assist" ? view.nameOf(mode.scorer) : "";
  const inName = mode.k === "out" ? view.nameOf(mode.inId) : "";
  const outName = mode.k === "outFrom" ? view.nameOf(mode.outId) : "";
  const outGone = mode.k === "outFrom" && shown.bench.some((p) => p.id === mode.outId && p.vacancy);
  const vacant = shown.bench.filter((p) => p.vacancy);
  // every token's top, spread so two in one column never sit on each other (the keeper behind his centre-back)
  const tops = spreadTops([...shown.field.map((p) => p.spot ?? { x: 50, y: 50 }), ...vacant.map((v) => v.vacancy?.spot ?? null)].map((s) => (s ? { left: pitchLeft(s.x), top: pitchTop(s.y) } : { left: -999, top: 0 })));

  // the lower third
  let strap: { tag: string; msg: string; sub: string; tone: "" | "g" | "r" | "w"; undo: boolean; cancel: boolean; reset?: boolean; btns?: StrapButton[] } | null = null;
  const nameOf = (id: string) => shown.field.find((p) => p.id === id)?.name ?? view.nameOf(id);
  const placeOf = (id: string) => placeName(shown.field.find((p) => p.id === id)?.pos);
  // (right after kick-off, while nothing has been written, «Deshacer» takes the whistle back: Antes hands
  //  over to this screen at once)
  const justKicked = clock.phase === "first" && clock.elapsedSeconds < KICK_STRAP_SECONDS && view.events.length === 0 && !kickGone;
  if (mode.k === "assist") strap = { tag: "GOL", msg: `Gol de ${scorerName}${goalEv?.minute ? `, minuto ${goalEv.minute}` : ""}`, sub: "¿Quién dio el pase? Toca su camiseta", tone: "g", undo: false, cancel: false };
  else if (mode.k === "out") strap = { tag: "CAMBIO", msg: `Entra ${inName}`, sub: "¿Por quién? Toca quién sale", tone: "", undo: false, cancel: true };
  else if (mode.k === "outFrom") strap = { tag: "CAMBIO", msg: outGone ? `Por ${outName}, expulsado` : `Sale ${outName}`, sub: "¿Quién entra? Toca en el banquillo", tone: "", undo: false, cancel: true };
  else if (swapping) {
    const last = swapping.swaps[swapping.swaps.length - 1];
    let msg = "Toca a dos jugadores";
    let sub = "Se cambian el sitio";
    if (swapping.pick) {
      msg = `¿Con quién cambia el sitio ${nameOf(swapping.pick)}?`;
      sub = "Toca a un compañero";
    } else if (last) {
      const [a, b] = last;
      msg = placeOf(a) && placeOf(b) ? `${nameOf(a)}, a ${placeOf(a)} · ${nameOf(b)}, a ${placeOf(b)}` : `${nameOf(a)} y ${nameOf(b)} se cambian el sitio`;
      sub = "¿Alguien más? Toca a dos jugadores";
    }
    const btns: StrapButton[] = [];
    if (swapping.swaps.length) btns.push({ label: "Deshacer", act: "undoPlace" });
    if (swapping.swaps.length || !swapping.alone) btns.push({ label: "Hecho", go: true, act: "done" });
    else btns.push({ label: "Cancelar", act: "cancelPlaces" });
    strap = { tag: swapping.swaps.length && !swapping.pick ? "RECOLOCACIÓN" : "RECOLOCAR", msg, sub, tone: "w", undo: false, cancel: false, btns };
  } else if (lastStrap) {
    const goal = lastStrap.goal;
    const where = lastStrap.local ? (queue.online ? "subiendo" : "en el móvil, se sube sola") : goal ? "ya en la web" : "";
    strap = { tag: lastStrap.tag, msg: lastStrap.text, sub: [`Minuto ${lastStrap.minute ?? clock.minute}, apuntado por ti`, where].filter(Boolean).join(" · "), tone: goal === "us" ? "g" : goal === "them" ? "r" : "", undo: true, cancel: false };
    // a change, written: where the one coming on plays, and «Recolocar» (the swaps go up apart, at its time)
    const comer = lastStrap.type === "substitution" && lastStrap.inPlayerId ? field.find((p) => p.id === lastStrap.inPlayerId) : undefined;
    if (comer && can("position_swap") && field.length > 1) {
      const place = placeName(comer.pos);
      strap = { ...strap, sub: place ? `Ocupa su sitio: ${place}` : strap.sub, btns: [{ label: "Recolocar", go: true, act: "recolocar" }] };
    }
  } else if (justKicked) {
    strap = { tag: "INICIO", msg: clock.kickoffAt != null ? `Pitido inicial a las ${hhmm(clock.kickoffAt)}` : "Pitido inicial", sub: "El reloj ya corre", tone: "", undo: false, cancel: false, reset: true };
  }
  const last = view.events[view.events.length - 1];
  const unplayed = shown.bench.filter((p) => !p.played && !p.sentOff).length;
  // (the strap slides in again on every step of a draft)
  const strapKey = draft ? (draft.swaps.length + (draft.pick ? 1 : 0)) % 2 : strapId ? strapId.length % 2 : 0;
  const half = clock.period === 1 ? "1ª PARTE" : "2ª PARTE";
  const endLabel = clock.phase === "first" ? "Fin de la 1ª" : "Fin del partido";
  const endAction = clock.phase === "first" ? "halftime" : "finish";
  const suggestEnd = clock.periodSeconds >= clock.halfSeconds;
  const prog = Math.min(100, Math.round((clock.periodSeconds / Math.max(1, clock.halfSeconds)) * 1000) / 10);
  const lastGoal = view.events.filter((e) => e.goal === "us").at(-1);
  const ribText =
    flash === "home"
      ? `¡GOOOL!${lastGoal?.playerName ? `   ${lastGoal.playerName.toUpperCase()}` : ""}   MINUTO ${lastGoal?.minute ?? clock.minute}   ¡GOOOL!`
      : `GOL DE ${match.rival.toUpperCase()}`;
  const title = match.home ? `Manchester Piti – ${match.rival}` : `${match.rival} – Manchester Piti`;
  const offline = !queue.online;
  const pendingGoal = match.queuedGoals.us > 0;

  return (
    <div className="enj">
      <ShirtDefs />
      <header className="top">
        <button type="button" className="back" aria-label="Salir de la mesa" onClick={view.nav.exit}>
          <BackIcon />
        </button>
        <div className="ttl">
          <b>{title}</b>
          <span>
            <span className="live">
              <i />
              {liveWord(view)}
            </span>
            {matchLine(match)}
          </span>
        </div>
        <Presence view={view} />
      </header>

      <section className={`box${offline ? " off" : ""}`} aria-label="Marcador">
        <span className="screw" style={{ left: 10, top: 10 }} />
        <span className="screw" style={{ right: 10, top: 10 }} />
        <div className="glass">
          <div className="sc">
            <div className="side">
              <span className="crest">MP</span>
              <span className="code">PITI</span>
            </div>
            <div className="dg" role="img" aria-label={`Manchester Piti ${match.score.us}, ${match.rival} ${match.score.them}${pendingGoal ? `. ${match.queuedGoals.us} gol sin subir` : ""}`}>
              <span key={`h${total.us}`} className={flash === "home" ? "d flip" : "d"}>
                {match.score.us}
                {pendingGoal && (
                  <span className="qcl" title="Gol guardado en el móvil">
                    <DownIcon size={12} />
                  </span>
                )}
              </span>
              <s>:</s>
              <span key={`a${total.them}`} className={flash === "away" ? "d flipr" : "d"}>
                {match.score.them}
                {match.queuedGoals.them > 0 && (
                  <span className="qcl" title="Gol guardado en el móvil">
                    <DownIcon size={12} />
                  </span>
                )}
              </span>
            </div>
            <div className="side">
              <span className="crest r">{match.rivalInitials}</span>
              <span className="code r">{match.rivalShort}</span>
            </div>
          </div>
          <div className="ln">
            <span className="half">{half}</span>
            <span className={held ? "clk p" : "clk"} aria-label={`${held ? "En pausa, " : ""}${clock.text}`}>
              {clock.text}
            </span>
            {clock.added > 0 && <span className="add">+{clock.added}′</span>}
            {flash && (
              <span className={flash === "away" ? "rib r" : "rib"} role="status">
                <span>{ribText}</span>
              </span>
            )}
          </div>
          <div className="prog" aria-hidden="true">
            <i style={{ width: `${prog}%` }} />
          </div>
          {flash === "home" && <span className="shine" />}
        </div>
        <div className="keys">
          <button type="button" className={held ? "key on" : "key"} disabled={busy} aria-pressed={held} onClick={() => void run(() => actions.clock(held ? "resume" : "pause"))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              {held ? <path d="M7 5l12 7-12 7z" /> : <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>}
            </svg>
            {held ? "Seguir" : "Pausa"}
          </button>
          <div className="stp" role="group" aria-label="Tiempo añadido">
            <button type="button" disabled={busy || clock.added === 0} aria-label="Quitar un minuto de añadido" onClick={() => void run(() => actions.clock("added", Math.max(0, clock.added - 1)))}>
              −
            </button>
            <span className={clock.added > 0 ? "g" : ""} aria-live="polite">
              {clock.added > 0 ? `+${clock.added}′` : "Añadido"}
            </span>
            <button type="button" disabled={busy || clock.added >= 15} aria-label="Sumar un minuto de añadido" onClick={() => void run(() => actions.clock("added", Math.min(15, clock.added + 1)))}>
              +
            </button>
          </div>
          <button
            type="button"
            className={`key end${suggestEnd || confirmEnd ? " due" : ""}`}
            disabled={busy}
            onClick={() => {
              if (!confirmEnd) return setConfirmEnd(true);
              setConfirmEnd(false);
              void run(() => actions.clock(endAction));
            }}
          >
            {confirmEnd ? "¿Seguro?" : endLabel}
          </button>
        </div>
      </section>

      <div className={flash === "home" ? "pitch flare" : "pitch"} role="group" aria-label="En el campo">
        <div className="cl" style={{ left: 12, right: 12, top: 12, bottom: -2, borderBottom: 0, borderRadius: "4px 4px 0 0" }} />
        <div className="cl" style={{ left: "50%", top: -48, width: 96, height: 96, marginLeft: -48, borderRadius: "50%" }} />
        <div className="cl" style={{ left: "50%", bottom: -2, width: 178, height: 62, marginLeft: -89, borderBottom: 0 }} />
        <span className="spot" style={{ left: "50%", bottom: 44, marginLeft: -2.5 }} />
        <div className="net" />
        {shown.field.map((p, i) => {
          let cls = "tok";
          let aria = playerAria(p);
          if (swapping) {
            cls += p.id === swapping.pick ? " in" : " ask";
            const where = placeName(p.pos) || p.pos || "";
            aria = swapping.pick && swapping.pick !== p.id ? `${nameOf(swapping.pick)} y ${p.name} se cambian el sitio` : `${p.name}${where ? `, ${where}` : ""}. Elegir para cambiar de sitio`;
          }
          if (moved.includes(p.id)) cls += " moved";
          if (mode.k === "assist") {
            if (p.id !== mode.scorer) cls += " ask";
            aria = p.id === mode.scorer ? `${p.name}, ha marcado. Toca para apuntarle otra jugada` : `Asistencia de ${p.name}`;
          }
          if (mode.k === "out") {
            cls += " ask";
            aria = `Sale ${p.name}`;
          }
          if (mode.k === "outFrom") cls += p.id === mode.outId ? " in" : " dim";
          if (pop === p.id) cls += " pop";
          const spot = p.spot ?? { x: 50, y: 50 };
          return (
            <button key={p.id} type="button" className={cls} style={{ left: `${pitchLeft(spot.x)}%`, top: `${tops[i]}%` }} aria-label={aria} aria-pressed={swapping ? p.id === swapping.pick : undefined} onClick={(e) => tapField(p, e)}>
              <span className="halo" />
              <span className="shirtw">
                <Shirt kind={p.keeper ? "keeper" : "field"} number={p.number} shadow />
                <Stickers p={p} />
                {p.pending > 0 && (
                  <span className="qb" aria-hidden="true">
                    <DownIcon />
                    {p.pending}
                  </span>
                )}
              </span>
              <span className="tag">
                <span className="nm">{p.name}</span>
                <span className="mn">{swapping && p.pos ? p.pos : `${p.minutes}′`}</span>
              </span>
            </button>
          );
        })}
        {vacant.map((v, k) => {
          if (!v.vacancy?.spot) return null;
          const spot = v.vacancy.spot;
          const cls = "tok hueco" + (mode.k === "out" ? " ask" : mode.k === "outFrom" ? (mode.outId === v.id ? " in" : " dim") : "");
          const aria = mode.k === "out" ? `Entra ${inName} por ${v.name}, expulsado` : `Hueco de ${v.name}, expulsado${v.vacancy.code ? `, ${v.vacancy.code}` : ""}. Toca para que entre alguien`;
          return (
            <button key={"hueco-" + v.id} type="button" className={cls} style={{ left: `${pitchLeft(spot.x)}%`, top: `${tops[shown.field.length + k]}%` }} aria-label={aria} disabled={!can("substitution") || !!swapping} onClick={() => tapVacancy(v)}>
              <span className="halo" />
              <span className="shirtw"><span className="hole" aria-hidden="true">+</span></span>
              <span className="tag">
                <span className="nm">Hueco</span>
                <span className="mn">{v.vacancy.code ?? "roja"}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="dug">
        <div className="roof" />
        <div className="dhead">
          <b>Banquillo</b>
          <span>{mode.k === "outFrom" ? "¿quién entra?" : swapping ? "recolocando en el campo" : "toca para que entre"}</span>
          {unplayed > 0 && <em>{unplayed} sin jugar</em>}
        </div>
        {view.nextSub && mode.k === "" && !draft && (
          <button type="button" className="toca" onClick={() => swap(view.nextSub!.outId, view.nextSub!.inId)} disabled={!can("substitution")}>
            <Ico d={ICON.cambio} size={16} />
            Toca: entra {view.nextSub.inName} por {view.nextSub.outName}
          </button>
        )}
        {mode.k !== "outFrom" && vacant.filter((v) => !v.vacancy?.spot).map((v) => (
          <button key={"hueco-" + v.id} type="button" className="toca" onClick={() => tapVacancy(v)} disabled={!can("substitution") || !!swapping}>
            <Ico d={ICON.cambio} size={16} />
            {mode.k === "out" ? `Entra ${inName} por ${v.name} (expulsado)` : `Hueco de ${v.name} (expulsado): toca para que entre alguien`}
          </button>
        ))}
        <div className="row" role="group" aria-label="Banquillo">
          {shown.bench.map((p) => {
            let cls = "bt";
            if (mode.k === "out" && mode.inId === p.id) cls += " in";
            if (mode.k === "outFrom" && !p.sentOff) cls += " ask";
            const rest = p.sentOff ? "expulsado" : p.offAt !== null ? `fuera ${p.offAt}′` : "sin jugar";
            return (
              <button key={p.id} type="button" className={cls} disabled={p.sentOff} aria-pressed={mode.k === "out" && mode.inId === p.id} aria-label={mode.k === "outFrom" ? `Entra ${p.name}` : `${p.name}, ${rest}${p.pending ? `, ${p.pending} sin subir` : ""}. Que entre`} onClick={() => tapBench(p)}>
                <span className="shirtw">
                  <Shirt kind="bench" number={p.number} size={34} />
                  {p.pending > 0 && (
                    <span className="qb" aria-hidden="true">
                      <DownIcon />
                      {p.pending}
                    </span>
                  )}
                </span>
                <span className="nm">{p.name}</span>
                <span className={p.played ? "mn" : "mn z"}>{rest}</span>
              </button>
            );
          })}
          {shown.bench.length === 0 && <span className="none">Nadie en el banquillo</span>}
        </div>
      </div>

      <div className="riv" role="group" aria-label={`Jugadas de ${match.rival}`}>
        <span className="k">
          <i>{match.rivalInitials}</i>
          {match.rivalShort}
        </span>
        <button type="button" className="rb bad" disabled={!can("opponent_goal")} onClick={() => add("opponent_goal")}>
          Gol
        </button>
        <button type="button" className="rb" disabled={!can("opponent_foul")} onClick={() => add("opponent_foul")}>
          Falta
        </button>
        <button type="button" className="rb" disabled={!can("opponent_woodwork")} onClick={() => add("opponent_woodwork")}>
          Palo
        </button>
        <button type="button" className="rb" disabled={!can("opponent_corner")} onClick={() => add("opponent_corner")}>
          Córner
        </button>
        <button type="button" className="rb more" aria-label="Más jugadas del rival" onClick={() => setMode({ k: "mas" })}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>

      <div style={{ height: dockH + 8 }} aria-hidden="true" />

      <div className="dock" ref={dockRef}>
        {view.notice && (
          <p className="note" role="alert">
            {view.notice}
          </p>
        )}
        {queue.review.length > 0 && (
          <button type="button" className="qs" onClick={() => setMode({ k: "review" })}>
            <span className="qi" aria-hidden="true">!</span>
            <span className="qt">
              <b>{queue.review.length === 1 ? "1 jugada por revisar" : `${queue.review.length} jugadas por revisar`}</b>
              <small>El servidor no la aceptó. Corrígela o descártala</small>
            </span>
          </button>
        )}
        {queue.pending > 0 && (
          <button type="button" className={offline ? "qs" : "qs ok"} onClick={actions.retryNow} aria-label={`${queue.pending} jugadas en el móvil. Toca para subirlas ahora`}>
            <span className="qi" aria-hidden="true">
              <DownIcon size={16} />
            </span>
            <span className="qt">
              <b>{queue.pending === 1 ? "1 jugada guardada en el móvil" : `${queue.pending} jugadas guardadas en el móvil`}</b>
              <small>{offline ? "Se suben solas al volver la señal" : "Subiendo, una a una"}</small>
            </span>
          </button>
        )}
        {strap ? (
          <div className={`l3 ${strapKey ? "a" : "b"}${strap.btns ? " w2" : ""}`} role="status">
            <span className={strap.tone ? `kk ${strap.tone}` : "kk"}>{strap.tag}</span>
            <div className={strap.tone ? `bar ${strap.tone}` : "bar"}>
              <span className="msg">
                <b>{strap.msg}</b>
                <small>{strap.sub}</small>
              </span>
              {strap.btns?.map((b) => (
                <button key={b.label} type="button" className={b.go ? "ud go" : "ud"} onClick={() => onStrap(b.act)}>
                  {b.label}
                </button>
              ))}
              {strap.undo && (
                <button
                  type="button"
                  className="ud"
                  onClick={() => {
                    setStrapId(null);
                    void actions.undo().catch(() => undefined);
                  }}
                >
                  Deshacer
                </button>
              )}
              {strap.reset && (
                <button
                  type="button"
                  className="ud"
                  disabled={busy}
                  onClick={() => {
                    setKickGone(true);
                    void run(() => actions.clock("reset").catch((e: unknown) => {
                      setKickGone(false);
                      throw e;
                    }));
                  }}
                >
                  Deshacer
                </button>
              )}
              {strap.cancel && (
                <button type="button" className="ud" onClick={close}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        ) : queue.pending > 0 || queue.review.length > 0 ? null : (
          // (the queue line takes the last play's place, as in the canvas's «Sin cobertura»)
          <div className="peek">
            <span className="m">{last?.minute ? `${last.minute}′` : ""}</span>
            <span className="t">
              {last ? last.text : "Aún no ha pasado nada"}
              {last?.local ? <span className="loc"> · en el móvil</span> : null}
            </span>
            <button type="button" className="go" onClick={view.nav.cronica}>
              {view.events.length === 1 ? "1 jugada" : `${view.events.length} jugadas`}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        )}
        {mode.k === "assist" ? (
          <div className="pair">
            <button
              type="button"
              onClick={() => {
                setStrapId(mode.goalId);
                setMode(NONE);
                // answered: nobody gave the pass (the acta won't ask again)
                void actions.edit(mode.goalId, { assistPlayerId: "" }).catch(() => undefined);
              }}
            >
              Sin asistencia
            </button>
            <button
              type="button"
              className="warn"
              onClick={() => {
                const id = mode.goalId;
                setMode(NONE);
                setStrapId(null);
                void actions.remove(id).catch(() => undefined);
              }}
            >
              Deshacer el gol
            </button>
          </div>
        ) : (
          <button type="button" className="cta" disabled={!can("goal")} onClick={() => setMode({ k: "gol" })}>
            <span>Gol del Piti</span>
            <i aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFC659" strokeWidth="1.7">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7l4 3-1.5 5h-5L8 10z" fill="rgba(255,198,89,.25)" />
                <path d="M12 3v4M16 10l4.5-1.5M14.5 15l2.5 4M9.5 15L7 19M8 10L3.5 8.5" />
              </svg>
            </i>
          </button>
        )}
      </div>

      {mode.k === "ring" && sel && (
        <>
          <button type="button" className="scrim" aria-label="Cerrar" onClick={close} />
          <div className="ringc" role="dialog" aria-modal="true" aria-label={`Acciones de ${sel.name}`}>
            <button type="button" className="hub" style={{ "--fx": `${mode.fx}px`, "--fy": `${mode.fy}px` } as CSSProperties} onClick={close} aria-label={`Cerrar las acciones de ${sel.name}`}>
              <Shirt kind={sel.keeper ? "keeper" : "field"} number={sel.number} size={56} />
              <b>{sel.name}</b>
              <small>minuto {clock.minute}</small>
            </button>
            {ringItems(sel, mode.cards).map((it, i) => {
              const pos = (mode.cards ? CARD_POS : RING_POS)[i];
              const isAction = it.type !== "_cards" && it.type !== "_back" && it.type !== "_sub" && it.type !== "_place";
              const disabled = isAction ? !can(it.type as MesaType) : it.type === "_sub" ? !can("substitution") : it.type === "_place" ? !can("position_swap") || shown.field.length < 2 : false;
              return (
                <button
                  key={it.label}
                  type="button"
                  className={it.gold ? "act gold" : "act"}
                  style={{ "--dx": `${pos[0]}px`, "--dy": `${pos[1]}px`, "--d": `${i * 28}ms` } as CSSProperties}
                  disabled={disabled}
                  onClick={() => {
                    if (it.type === "_cards") return setMode({ ...mode, cards: true });
                    if (it.type === "_back") return setMode({ ...mode, cards: false });
                    if (it.type === "_sub") return setMode({ k: "outFrom", outId: sel.id });
                    if (it.type === "_place") return startPlaces(sel.id, null);
                    add(it.type, { playerId: sel.id });
                  }}
                >
                  {it.sw ? (
                    <span className="sw" style={{ background: it.sw.color }} aria-hidden="true">
                      {it.sw.letter}
                    </span>
                  ) : it.icon ? (
                    <Ico d={it.icon} />
                  ) : null}
                  {it.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {mode.k === "gol" && (
        <Sheet label="¿Quién marcó?" kicker={`Gol del Piti, minuto ${clock.minute}`} title="¿Quién marcó?" onClose={close}>
          <div className="pg">
            {/* (from the front to the back: who scores most comes first, the keeper last) */}
            {[...shown.field].reverse().map((p, i) => (
              <button key={p.id} type="button" className="pk" style={{ "--d": `${i * 30}ms` } as CSSProperties} onClick={() => add("goal", { playerId: p.id })}>
                <Shirt kind={p.keeper ? "keeper" : "field"} number={p.number} size={40} />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          <div className="gh">
            <button type="button" onClick={() => add("opponent_own_goal")}>
              Autogol suyo
            </button>
            <button type="button" onClick={() => add("goal")}>
              Lo apunto luego
            </button>
          </div>
        </Sheet>
      )}

      {mode.k === "mas" && (
        <Sheet label="Más jugadas del rival" kicker={`${match.rival}, minuto ${clock.minute}`} kickerColor="#ffb3aa" title="Otra jugada suya" onClose={close}>
          <div className="ag">
            {RIVAL_MORE.map((r) => (
              <button key={r.type} type="button" className="ac" disabled={!can(r.type)} onClick={() => add(r.type)}>
                {r.label}
              </button>
            ))}
            {shown.field.some((p) => p.keeper) && (
              <button type="button" className="ac" disabled={!can("penalty_saved")} onClick={() => add("penalty_saved", { playerId: shown.field.find((p) => p.keeper)!.id })}>
                Penalti parado
              </button>
            )}
          </div>
        </Sheet>
      )}

      {mode.k === "review" && <ReviewSheet view={view} onClose={close} />}
    </div>
  );
}
