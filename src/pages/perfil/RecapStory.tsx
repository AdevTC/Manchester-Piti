// /profile › Temporada › «Tu temporada en 10 cromos»: the story viewer. A full-screen dialog on a phone, a
// centred 9:16 frame on a desktop; a progress bar on top, tap zones (or a swipe), ← → and the buttons to
// move, Escape or × to close. Each cromo is real DOM (readable, announced); the PNG for «Compartir» and
// «Descargar todas» comes from recapDraw (loaded on demand, drawn ahead for the cromo on screen so the
// share sheet still has the tap's permission). No auto-advance: the member moves at their own pace, and
// with reduced motion nothing slides.
import { useEffect, useEffectEvent, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import type { RecapCard, SeasonRecap } from "../../lib/derived/seasonRecap";
import { POSITIONS } from "../../lib/positions";
import { buzz, saveBlob } from "./fxRuntime";
import { CREST, Ic } from "./icons";
import { isAbort, type ShareNav } from "./share";
import { cardTitle, recapFileName, type RecapCtx } from "./recapView";
import "./recap.css";

export interface RecapStoryProps {
  recap: SeasonRecap;
  ctx: RecapCtx;
  rm: boolean;
  onClose: () => void;
  /** Where focus goes back when the opener is gone (a deep link opened the story). */
  returnFocusId?: string;
}

const POS_NAME = POSITIONS as Record<string, { name: string } | undefined>;
const posName = (code: string) => POS_NAME[code]?.name ?? code;
const n = (x: number, one: string, many: string) => (x === 1 ? one : many);

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const SWIPE_PX = 40;

/** One cromo as DOM: one number or fact, big. */
function CardBody({ card }: { card: RecapCard }) {
  switch (card.kind) {
    case "portada":
      return (
        <>
          <p className="rc-kk">Tu temporada</p>
          <p className="rc-big rc-name">{card.name}</p>
          {card.number && (
            <p className="rc-num">
              <span className="vx-sr">Dorsal </span>
              {card.number}
            </p>
          )}
          <p className="rc-sub">{card.season}</p>
        </>
      );
    case "partidos":
      return (
        <>
          <p className="rc-kk">Partidos y minutos</p>
          <p className="rc-big">
            {card.played} <span>{n(card.played, "partido", "partidos")}</span>
          </p>
          <p className="rc-pair">
            <b>{card.minutes ?? "—"}</b> <span>{card.minutes === null ? "minutos (sin acta con minutos)" : n(card.minutes, "minuto", "minutos")}</span>
          </p>
        </>
      );
    case "goles":
      return (
        <>
          <p className="rc-kk">Goles y asistencias</p>
          <p className="rc-big">
            {card.goals} <span>{n(card.goals, "gol", "goles")}</span>
          </p>
          <p className="rc-pair">
            <b>{card.assists}</b> <span>{n(card.assists, "asistencia", "asistencias")}</span>
          </p>
          {card.best && (
            <p className="rc-note">
              <span>Tu mejor partido</span>
              <b>{card.best.label}</b>
              <span>
                {card.best.goals} {n(card.best.goals, "gol", "goles")} · {card.best.assists} {n(card.best.assists, "asistencia", "asistencias")}
              </span>
            </p>
          )}
        </>
      );
    case "mvp":
      return (
        <>
          <p className="rc-kk">MVP</p>
          {card.times > 0 ? (
            <p className="rc-big">
              {card.times} <span>{n(card.times, "vez MVP", "veces MVP")}</span>
            </p>
          ) : (
            <p className="rc-big rc-words">El año que viene</p>
          )}
          <p className="rc-pair">
            <b>{card.votes}</b> <span>{n(card.votes, "voto del vestuario", "votos del vestuario")}</span>
          </p>
        </>
      );
    case "socio":
      return (
        <>
          <p className="rc-kk">Tu socio en el campo</p>
          <p className="rc-big rc-name">{card.partnerName}</p>
          <p className="rc-pair">
            <b>{card.combined}</b> <span>{n(card.combined, "gol combinado", "goles combinados")}</span>
          </p>
        </>
      );
    case "posiciones": {
      const max = Math.max(1, ...card.codes.map((c) => c.minutes));
      return (
        <>
          <p className="rc-kk">Dónde jugaste</p>
          {card.main && <p className="rc-big rc-name">{posName(card.main)}</p>}
          <ul className="rc-pos">
            {card.codes.map((c) => (
              <li key={c.code}>
                <span className="rc-pos-t">
                  <b>{c.code}</b> {posName(c.code)}
                </span>
                <span className="rc-pos-m">{c.minutes} min</span>
                <i aria-hidden="true" style={{ inlineSize: `${Math.round((c.minutes / max) * 100)}%` }} />
              </li>
            ))}
          </ul>
        </>
      );
    }
    case "porra":
      return (
        <>
          <p className="rc-kk">La porra</p>
          <p className="rc-big">
            {card.rank}º <span>de {card.of}</span>
          </p>
          <p className="rc-pair">
            <b>{card.points}</b> <span>{n(card.points, "punto", "puntos")}</span>
          </p>
        </>
      );
    case "medallas":
      return (
        <>
          <p className="rc-kk">Tus medallas</p>
          <p className="rc-big">
            {card.medals.length} <span>{n(card.medals.length, "medalla", "medallas")}</span>
          </p>
          <ul className="rc-med">
            {card.medals.map((m) => (
              <li key={m.id}>
                <Ic n="medal" w={16} />
                {m.label}
              </li>
            ))}
          </ul>
        </>
      );
    case "equipo":
      return (
        <>
          <p className="rc-kk">El equipo</p>
          <ul className="rc-gep" aria-label={`${card.g} ganados, ${card.e} empatados, ${card.p} perdidos`}>
            <li aria-hidden="true">
              <b>{card.g}</b>
              <span>G</span>
            </li>
            <li aria-hidden="true">
              <b>{card.e}</b>
              <span>E</span>
            </li>
            <li aria-hidden="true">
              <b>{card.p}</b>
              <span>P</span>
            </li>
          </ul>
          <p className="rc-pair">
            <b>
              {card.gf}–{card.ga}
            </b>{" "}
            <span>goles a favor y en contra</span>
          </p>
          {card.biggest && (
            <p className="rc-note">
              <span>La mayor victoria</span>
              <b>
                {card.biggest.label} · {card.biggest.score}
              </b>
            </p>
          )}
        </>
      );
    case "cierre":
      return (
        <>
          <img className="rc-crest" src={CREST} alt="Escudo del Manchester Piti" width={96} height={96} />
          <p className="rc-big rc-words">Gracias por la temporada</p>
          <p className="rc-sub">{card.season}</p>
        </>
      );
  }
}

interface Toast {
  msg: string;
  bad: boolean;
  n: number;
}

export function RecapStory({ recap, ctx, rm, onClose, returnFocusId }: RecapStoryProps) {
  const cards = recap.cards;
  const total = cards.length;
  const [i, setI] = useState(0);
  const at = Math.min(i, Math.max(0, total - 1));
  const card = cards[at];
  const [busy, setBusy] = useState<"share" | "all" | null>(null);
  const [allAt, setAllAt] = useState(0);
  const [toast, setToast] = useState<Toast>({ msg: "", bad: false, n: 0 });
  const say = (msg: string, bad = false) => setToast((t) => ({ msg, bad, n: t.n + 1 }));
  useEffect(() => {
    if (!toast.n) return;
    const t = window.setTimeout(() => setToast((x) => (x.n === toast.n ? { ...x, msg: "" } : x)), 2600);
    return () => window.clearTimeout(t);
  }, [toast.n]);

  const go = (to: number) => {
    const next = Math.max(0, Math.min(total - 1, to));
    if (next === at) return;
    buzz(8);
    setI(next);
  };
  const prev = () => go(at - 1);
  const next = () => go(at + 1);

  // ── the PNGs: recapDraw loads on demand; one blob per cromo, drawn once
  const ctxKey = JSON.stringify(ctx);
  const cache = useRef(new Map<string, Promise<Blob | null>>());
  const blobFor = (k: number): Promise<Blob | null> => {
    const key = k + "|" + ctxKey;
    let p = cache.current.get(key);
    if (!p) {
      p = import("./recapDraw").then((m) => m.recapCardBlob(cards[k], ctx)).catch(() => null);
      cache.current.set(key, p);
    }
    return p;
  };
  const warm = useEffectEvent(() => void blobFor(at));
  useEffect(() => {
    const t = window.setTimeout(warm, 250);
    return () => window.clearTimeout(t);
  }, [at, ctxKey]);

  // ── a dialog: focus in (and back on closing), Tab stays inside, Escape closes, ← → move, no page scroll
  const dlg = useRef<HTMLElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const onKeys = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowRight" && !e.altKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft" && !e.altKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      prev();
    } else if (e.key === "Tab" && dlg.current) {
      const els = [...dlg.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      const now = document.activeElement;
      if (!(now instanceof Node) || !dlg.current.contains(now)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && now === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && now === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    const html = document.documentElement;
    const body = document.body;
    const before = [html.style.overflow, body.style.overflow];
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => onKeys(e);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      html.style.overflow = before[0];
      body.style.overflow = before[1];
      const back = opener?.isConnected ? opener : returnFocusId ? document.getElementById(returnFocusId) : null;
      back?.focus();
    };
  }, [returnFocusId]);

  // ── a swipe moves like a tap on that side (and swallows the click that follows it)
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const onDown = (e: ReactPointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
    swiped.current = false;
  };
  const onUp = (e: ReactPointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(e.clientY - s.y)) return;
    swiped.current = true;
    if (dx < 0) next();
    else prev();
  };
  const tap = (fn: () => void) => () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    fn();
  };

  // ── «Compartir»: the PNG to the share sheet where the browser takes files, else it downloads
  const running = useRef(false);
  const share = async () => {
    if (running.current || !card) return;
    running.current = true;
    setBusy("share");
    try {
      const blob = await blobFor(at);
      if (!blob) {
        say("No se ha podido preparar la imagen en este navegador. Vuelve a intentarlo.", true);
        return;
      }
      const name = recapFileName(recap.seasonName, at, card);
      const file = typeof File === "function" ? new File([blob], name, { type: "image/png" }) : null;
      const nav: ShareNav = typeof navigator === "undefined" ? {} : navigator;
      let canFiles = false;
      try {
        canFiles = !!file && typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [file] });
      } catch {
        canFiles = false;
      }
      if (canFiles && file && nav.share) {
        try {
          await nav.share.call(nav, { files: [file], title: `${cardTitle(card)} · ${recap.seasonName}`, text: `Mi ${recap.seasonName} en el Manchester Piti.` });
          say("Cromo enviado al menú de compartir");
          return;
        } catch (e) {
          if (isAbort(e)) return;
          /* refused: it downloads instead */
        }
      }
      saveBlob(blob, name);
      say("Cromo descargado · " + name);
    } finally {
      running.current = false;
      setBusy(null);
    }
  };

  // ── «Descargar todas»: one PNG after another (no zip), a beat apart so the browser takes each one
  const downloadAll = async () => {
    if (running.current) return;
    running.current = true;
    setBusy("all");
    let saved = 0;
    try {
      for (let k = 0; k < total; k++) {
        setAllAt(k + 1);
        const blob = await blobFor(k);
        if (!blob) continue;
        saveBlob(blob, recapFileName(recap.seasonName, k, cards[k]));
        saved++;
        if (k < total - 1) await new Promise<void>((r) => window.setTimeout(r, 350));
      }
      if (saved === total) say(`Guardados los ${total} cromos`);
      else say(saved ? `Guardados ${saved} de ${total} cromos: alguno no se ha podido preparar` : "No se ha podido preparar ninguna imagen en este navegador.", saved === 0);
    } finally {
      running.current = false;
      setBusy(null);
      setAllAt(0);
    }
  };

  if (!card) return null;
  const label = `Cromo ${at + 1} de ${total}: ${cardTitle(card)}`;
  return createPortal(
    <div className={"vx pcv rc-m" + (rm ? " rc-rm" : "")}>
      <div className="rc-bg" aria-hidden="true" onClick={onClose} />
      <section className="rc" ref={dlg} role="dialog" aria-modal="true" aria-labelledby="rc-t" aria-describedby="rc-live">
        <h2 id="rc-t" className="vx-sr">
          Tu temporada en cromos · {recap.seasonName}
          {recap.partial ? " (hasta ahora)" : ""}
        </h2>
        <div className="rc-prog" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${total},minmax(0,1fr))` }}>
          {cards.map((_, k) => (
            <i key={k} className={k < at ? "done" : k === at ? "on" : undefined} />
          ))}
        </div>
        <div className="rc-top">
          <img src={CREST} alt="" width={28} height={28} />
          <span className="rc-club">
            MANCHESTER PITI
            <small>
              {recap.seasonName}
              {recap.partial ? " · hasta ahora" : ""}
            </small>
          </span>
          <button type="button" className="rc-x" ref={closeBtn} onClick={onClose} aria-label="Cerrar tus cromos">
            <Ic n="x" w={20} />
          </button>
        </div>
        <div className="rc-stage" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (swipe.current = null)}>
          <article key={at} className={"rc-card rc-k-" + card.kind + (rm ? "" : " rc-anim")} aria-roledescription="cromo" aria-label={label}>
            <CardBody card={card} />
          </article>
          <button type="button" className="rc-tap l" tabIndex={-1} aria-hidden="true" onClick={tap(prev)} />
          <button type="button" className="rc-tap r" tabIndex={-1} aria-hidden="true" onClick={tap(next)} />
        </div>
        <p id="rc-live" className="vx-sr" aria-live="polite" aria-atomic="true">
          {label}
        </p>
        <div className="rc-act">
          <button type="button" className="rc-b rc-nav" onClick={prev} disabled={at === 0} aria-label="Cromo anterior">
            <Ic n="prev" w={20} />
          </button>
          <button type="button" className="rc-b rc-main" onClick={() => void share()} disabled={busy !== null} aria-busy={busy === "share" || undefined}>
            <Ic n="share" w={18} />
            {busy === "share" ? "Preparando…" : "Compartir"}
          </button>
          <button type="button" className="rc-b" onClick={() => void downloadAll()} disabled={busy !== null} aria-busy={busy === "all" || undefined} aria-label={busy === "all" ? undefined : "Descargar todas"}>
            <Ic n="download" w={18} />
            {busy === "all" ? `${allAt} de ${total}…` : <><span className="rc-wide">Descargar todas</span><span className="rc-narrow" aria-hidden="true">Todas</span></>}
          </button>
          <button type="button" className="rc-b rc-nav" onClick={next} disabled={at === total - 1} aria-label="Cromo siguiente">
            <Ic n="next" w={20} />
          </button>
        </div>
        <p className="rc-count" aria-hidden="true">
          {at + 1} de {total}
        </p>
      </section>
      <div className="pf-toast-rail" aria-live="polite">
        <div className={"pf-toast" + (toast.msg ? " on" : "") + (toast.bad ? " bad" : "")} role="status">
          {toast.bad ? <Ic n="alert" w={18} /> : <Ic n="check" w={18} />}
          <span>{toast.msg}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
