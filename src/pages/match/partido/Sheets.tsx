// «El partido»: the sheets that open on top (?hoja=; «atrás» closes them) — el cartel (square or story, the
// hero's printed shirt, the score or the time, the light of that night), compartir el momento (the moviola's
// minute as a card: the play, the score then, the sky then, his shirt; its link opens the page at that minute)
// and the avisos of this match.
import { useContext, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { KitStillContext } from "../../../components/jersey3d/kitStill";
import { siteOrigin } from "../../../lib/derived/venue";
import type { PageCtx, Sheet } from "./ctx";
import type { Avisos } from "./avisos";
import { Icon, Tee } from "./bits";
import { nearestPlay, scoreAt } from "./model";
import { longDay } from "./words";
import { drawCard, type CardSpec } from "./cardImage";

export interface SheetsProps {
  c: PageCtx;
  sheet: Sheet | null;
  onClose: () => void;
  avisos: Avisos;
  kickTime: string;
}

/** Shares a drawn card as an image where the browser can, else saves it. */
async function shareImage(spec: CardSpec, still: string | undefined, file: string, text: string, url: string): Promise<"shared" | "saved"> {
  const blob = await drawCard(spec, still);
  const f = new File([blob], file, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [f] })) {
    await nav.share({ files: [f], text, url });
    return "shared";
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "saved";
}
async function saveImage(spec: CardSpec, still: string | undefined, file: string) {
  const blob = await drawCard(spec, still);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function Sheets({ c, sheet, onClose, avisos, kickTime }: SheetsProps) {
  const [fmt, setFmt] = useState<"sq" | "st">("sq");
  const ref = useRef<HTMLElement | null>(null);
  const momento = sheet === "momento" && c.played;
  const anySheet = !!sheet && (sheet !== "momento" || c.played);
  // focus into the sheet; Escape closes it
  useEffect(() => {
    if (!anySheet) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => prev?.focus?.();
  }, [anySheet, sheet]);
  const stillOf = useContext(KitStillContext);
  if (!anySheet) return null;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key !== "Tab" || !ref.current) return;
    const f = [...ref.current.querySelectorAll<HTMLElement>("button:not([disabled]),a[href]")];
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) {
      e.preventDefault();
      f[f.length - 1].focus();
    } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
      e.preventDefault();
      f[0].focus();
    }
  };
  const j = c.jornada ? `J${c.jornada}` : "El partido";
  const url = `${siteOrigin()}${c.base}`;
  const venue = c.match.venue ?? "";

  // ---- el cartel
  const scEdge = scoreAt(c.plays, c.edge);
  const big = c.pre ? kickTime : c.off ? (c.fase === "aplazado" ? (c.match.status === "cancelled" ? "Suspendido" : "Aplazado") : "¿?–¿?") : `${scEdge.us}–${scEdge.them}`;
  const goals = c.plays.filter((p) => p.k === "gol" && p.m <= c.edge && p.who);
  const lastGoal = goals[goals.length - 1] ?? null;
  const winner = c.fase === "despues" ? mvpWinnerOf(c) : null;
  const heroId = winner ?? (c.played && lastGoal ? (lastGoal.who ?? null) : null);
  const onlyOne = c.result.loss && scEdge.us === 1;
  const hero = heroId ? (winner ? `MVP: ${c.nameOf(heroId)}` : `${onlyOne ? "El gol del Piti: " : `El gol del ${lastGoal?.m}′: `}${c.nameOf(heroId)}${onlyOne ? `, ${lastGoal?.m}′` : ""}`) : `Se juega con la ${c.kit === "away" ? "2ª" : "1ª"}`;
  const day = longDay(c.kickMs);
  const when = c.pre ? day : c.done || c.fase === "final" ? `Final · ${day.charAt(0).toLowerCase()}${day.slice(1)}` : c.live ? `En directo · minuto ${c.edge}` : day;
  const vs = `contra ${c.rival} · ${c.jornada ? `J${c.jornada} de ${(c.match.competition ?? "liga").toLocaleLowerCase("es")}` : (c.match.competition ?? "")}`;
  const cartelFlood = c.played || c.fase === "pendiente";
  const cartelSpec: CardSpec = { kind: "cartel", story: fmt === "st", flood: cartelFlood, j, vs, big, hero, when, where: venue };
  const heroStill = stillOf("home", heroId ? c.numOf(heroId) || undefined : undefined)?.src;

  // ---- el momento
  const m = c.minute;
  const near = nearestPlay(c.plays, m);
  const atPlay = near && near.m === m ? near : null;
  const mp = atPlay ?? near;
  const mSc = scoreAt(c.plays, m);
  const moLink = `${c.base}?min=${m}`;
  const moTitle = mp ? mp.title : "El pitido inicial";
  const moSub = mp ? mp.sub || (mp.side === "them" ? c.rival : "") : "Empieza el partido";
  const moSky = c.floodAt(m) >= 0.5 ? "is-flood" : "is-golden";
  const moTee = !!(mp && mp.who && mp.side === "us");
  const moSpec: CardSpec = { kind: "momento", flood: moSky === "is-flood", j, vs: `${j} · Piti contra ${c.rival}`, big: `${m}′`, hero: moTitle, when: moSub, where: `Piti ${mSc.us}–${mSc.them} ${c.rival}`, link: moLink, rivalCode: mp?.side === "them" ? c.rivalCode : undefined };
  const moStill = moTee && mp?.who ? stillOf("home", c.numOf(mp.who) || undefined)?.src : undefined;

  const done = (r: "shared" | "saved") => c.say(r === "shared" ? "Compartido." : "Imagen guardada.");
  const fail = () => c.say("No se ha podido preparar la imagen.");

  return (
    <>
      <div className="pp-scrim" onClick={onClose} aria-hidden="true" />
      {sheet === "cartel" && (
        <section ref={ref} className="vd-glass vd-glass--deep vd-sheet pp-sheet pp-cartel" role="dialog" aria-modal="true" aria-labelledby="pp-cartel-t" onKeyDown={onKey}>
          <header className="pp-sheet__head">
            <h2 id="pp-cartel-t">El cartel {c.jornada ? `de la J${c.jornada}` : "del partido"}</h2>
            <button type="button" className="vd-glass vd-press vd-ibtn" onClick={onClose} aria-label="Cerrar el cartel">
              <Icon name="close" />
            </button>
          </header>
          <div className="vd-seg pp-cartel__seg" role="radiogroup" aria-label="Formato del cartel" style={{ "--n": 2, "--i": fmt === "st" ? 1 : 0 } as React.CSSProperties}>
            <span className="vd-seg__bead" aria-hidden="true" />
            <button type="button" role="radio" className="vd-seg__b" aria-checked={fmt === "sq"} onClick={() => setFmt("sq")}>
              Cuadrado
            </button>
            <button type="button" role="radio" className="vd-seg__b" aria-checked={fmt === "st"} onClick={() => setFmt("st")}>
              Historia
            </button>
          </div>
          <figure className={`pp-poster${fmt === "st" ? " is-story" : ""}`} role="img" aria-label={`Cartel ${c.jornada ? `de la J${c.jornada}` : "del partido"}: Manchester Piti contra ${c.rival}, ${big}, ${day.toLowerCase()}${venue ? ` en ${venue}` : ""}${heroId ? `, con la camiseta de ${c.nameOf(heroId)}` : ""}`}>
            <div className={`pp-poster__sky${cartelFlood ? " is-flood" : ""}`} aria-hidden="true" />
            <Tee kit="home" num={heroId ? c.numOf(heroId) : null} className="pp-poster__tee" />
            <img className="pp-poster__crest" src="/crest-128.webp" alt="" width={40} height={40} />
            <p className="pp-poster__j" aria-hidden="true">
              {c.jornada ? `J${c.jornada}` : ""}
            </p>
            <div className="pp-poster__txt" aria-hidden="true">
              <p className="pp-poster__us">Manchester Piti</p>
              <p className="pp-poster__vs">{vs}</p>
              <p className="pp-poster__big">{big}</p>
              <p className="pp-poster__hero">{hero}</p>
              <p className="pp-poster__when">{when}</p>
              {venue && <p className="pp-poster__where">{venue}</p>}
            </div>
          </figure>
          <p className="vd-small pp-sheet__note">{c.pre ? "Antes del partido lleva la hora; al acabar, el resultado. El enlace abre esta página." : `Lleva el resultado y la luz de esa noche. El enlace abre ${c.base}.`}</p>
          <div className="pp-sheet__btns">
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={() => void shareImage(cartelSpec, heroStill, `cartel-${j.toLowerCase()}.png`, `Manchester Piti contra ${c.rival}`, url).then(done, fail)}>
              <Icon name="share" />
              Compartir
            </button>
            <button type="button" className="vd-glass vd-press vd-btn" onClick={() => void saveImage(cartelSpec, heroStill, `cartel-${j.toLowerCase()}.png`).then(() => c.say("Imagen guardada."), fail)}>
              <Icon name="arrow" />
              Guardar la imagen
            </button>
            <button type="button" className="vd-link" onClick={() => void copy(url).then((ok) => c.say(ok ? `Enlace copiado: ${c.base}` : "No se ha podido copiar el enlace."))}>
              Copiar el enlace del partido
            </button>
          </div>
        </section>
      )}

      {momento && (
        <section ref={ref} className="vd-glass vd-glass--deep vd-sheet pp-sheet pp-momento" role="dialog" aria-modal="true" aria-labelledby="pp-mo-t" onKeyDown={onKey}>
          <header className="pp-sheet__head">
            <h2 id="pp-mo-t">Compartir el {m}′</h2>
            <button type="button" className="vd-glass vd-press vd-ibtn" onClick={onClose} aria-label="Cerrar">
              <Icon name="close" />
            </button>
          </header>
          <figure className={`pp-mocard ${moSky}`} role="img" aria-label={`El minuto ${m} ${c.jornada ? `de la J${c.jornada}` : "del partido"}: ${moTitle}, ${mSc.us}–${mSc.them} en ese momento`}>
            <div className="pp-mocard__top" aria-hidden="true">
              <img src="/crest-128.webp" alt="" width={28} height={28} />
              <span>
                {j} · Piti contra {c.rival}
              </span>
            </div>
            <div className="pp-mocard__body" aria-hidden="true">
              <div className="pp-mocard__txt">
                <p className="pp-mocard__m vd-clock">{m}′</p>
                <p className="pp-mocard__t">{moTitle}</p>
                <p className="pp-mocard__s">{moSub}</p>
                <p className="pp-mocard__sc">
                  Piti {mSc.us}–{mSc.them} {c.rival}
                </p>
              </div>
              {moTee && mp?.who && <Tee kit="home" num={c.numOf(mp.who)} className="pp-mocard__tee" />}
              {mp?.side === "them" && <span className="pp-mocard__or">{c.rivalCode}</span>}
            </div>
            <p className="pp-mocard__link" aria-hidden="true">
              {moLink}
            </p>
          </figure>
          <p className="vd-small pp-sheet__note">{atPlay ? `Minuto ${m}` : mp ? `Minuto ${m} · lo último fue en el ${mp.m}′` : `Minuto ${m}`}. El enlace abre la página con la moviola en ese minuto.</p>
          <div className="pp-sheet__btns">
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={() => void shareImage(moSpec, moStill, `${j.toLowerCase()}-minuto-${m}.png`, moTitle, `${siteOrigin()}${moLink}`).then(done, fail)}>
              <Icon name="share" />
              Compartir
            </button>
            <button type="button" className="vd-glass vd-press vd-btn" onClick={() => void saveImage(moSpec, moStill, `${j.toLowerCase()}-minuto-${m}.png`).then(() => c.say("Imagen guardada."), fail)}>
              <Icon name="arrow" />
              Guardar la imagen
            </button>
            <button type="button" className="vd-link" onClick={() => void copy(`${siteOrigin()}${moLink}`).then((ok) => c.say(ok ? `Enlace copiado: ${moLink}` : "No se ha podido copiar el enlace."))}>
              Copiar el enlace a este minuto
            </button>
          </div>
        </section>
      )}

      {sheet === "avisos" && (
        <section ref={ref} className="vd-glass vd-glass--deep vd-sheet pp-sheet pp-avisos" role="dialog" aria-modal="true" aria-labelledby="pp-av-t" onKeyDown={onKey}>
          <header className="pp-sheet__head">
            <div>
              <h2 id="pp-av-t">Avisos de este partido</h2>
              <p className="pp-sheet__sub">{avisos.sub}</p>
            </div>
            <button type="button" className="vd-glass vd-press vd-ibtn" onClick={onClose} aria-label="Cerrar los avisos">
              <Icon name="close" />
            </button>
          </header>
          <ul className="pp-avl">
            {avisos.rows.map((a) => (
              <li key={a.id} className="pp-avl__r">
                <button type="button" className="vd-switch pp-avl__sw" role="switch" aria-checked={a.on} disabled={a.off} onClick={a.toggle}>
                  <span className="vd-switch__track" aria-hidden="true">
                    <span className="vd-switch__knob" />
                  </span>
                  <span className="pp-avl__t">
                    <b>{a.t}</b>
                    <span>{a.d}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="vd-small pp-sheet__note">Solo para {c.jornada ? `la J${c.jornada}` : "este partido"}. Para todos los partidos, «Avisos a medida» en tu cuenta.</p>
          <div className="pp-sheet__btns">
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={onClose}>
              Hecho
            </button>
          </div>
        </section>
      )}
    </>
  );
}

/** The closed vote's winner (the most votes; a tie: none on the cartel). */
function mvpWinnerOf(c: PageCtx): string | null {
  const r = c.mvp;
  if (!r || r.open) return null;
  const top = Object.entries(r.counts).sort((a, b) => b[1] - a[1]);
  if (!top.length || (top[1] && top[1][1] === top[0][1])) return null;
  return top[0][0];
}

