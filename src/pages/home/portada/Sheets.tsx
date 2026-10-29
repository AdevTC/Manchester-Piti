// Inicio's sheets (?hoja=porra · mvp · cartel): over the screen you are on; atrás, Esc, «Cerrar» or a touch
// outside close them. «Tu porra» (a marcador with its steppers), «Vota al MVP» (the printed shirts of those who
// played), «El cartel» (the night's poster to share or save).
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Kit } from "../../../components/jersey3d/kitStill";
import { homeFirst, scoreText } from "../../../lib/derived/words";
import { PI, Tee } from "./ui";
import { RivalMark } from "../../../components/vidrio/RivalMark";

function Sheet({ id, cls, title, sub, closeLabel, onClose, children }: { id: string; cls: string; title: string; sub?: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const close = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      if (back?.isConnected) back.focus();
    };
  }, [onClose]);
  return (
    <>
      <div className="pp-scrim" onClick={onClose} aria-hidden="true" />
      <section className={`vd-glass vd-glass--deep vd-sheet pp-sheet ${cls}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <header className="pp-sheet__head">
          <div>
            <h2 id={id}>{title}</h2>
            {sub && <p className="pp-sheet__sub">{sub}</p>}
          </div>
          <button ref={close} type="button" className="vd-glass vd-press vd-ibtn" onClick={onClose} aria-label={closeLabel}>
            <PI name="close" />
          </button>
        </header>
        {children}
      </section>
    </>
  );
}

export function PorraSheet({ sub, rival, code, logo, home, note, initial, onSave, onClose }: { sub: string; rival: string; code: string; logo?: string; home: boolean; note: string; initial: { us: number; them: number }; onSave: (us: number, them: number) => Promise<void>; onClose: () => void }) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const step = (k: "us" | "them", by: number) => setD((x) => ({ ...x, [k]: Math.max(0, Math.min(15, x[k] + by)) }));
  const save = () => {
    setBusy(true);
    setErr("");
    onSave(d.us, d.them).then(
      () => setBusy(false),
      () => {
        setBusy(false);
        setErr("No se ha guardado tu porra. Inténtalo otra vez.");
      },
    );
  };
  // (the home side on the left: away, the rival's goals first)
  const [left, right] = homeFirst(
    home,
    <div className="in-porra__s">
      <img src="/crest-128.webp" alt="" width={40} height={40} />
      <b>Piti</b>
      <div className="in-step">
        <button type="button" className="vd-glass vd-press vd-ibtn" onClick={() => step("us", -1)} aria-label="Un gol menos del Piti">
          <PI name="chev-l" />
        </button>
        <output className="in-step__v" aria-live="polite">
          {d.us}
        </output>
        <button type="button" className="vd-glass vd-press vd-ibtn" onClick={() => step("us", 1)} aria-label="Un gol más del Piti">
          <PI name="chev-r" />
        </button>
      </div>
    </div>,
    <div className="in-porra__s">
      <span className="vd-team__crest vd-team__crest--rival in-porra__or" aria-hidden="true">
        <RivalMark logo={logo}>{code}</RivalMark>
      </span>
      <b>{rival}</b>
      <div className="in-step">
        <button type="button" className="vd-glass vd-press vd-ibtn" onClick={() => step("them", -1)} aria-label={`Un gol menos de ${rival}`}>
          <PI name="chev-l" />
        </button>
        <output className="in-step__v" aria-live="polite">
          {d.them}
        </output>
        <button type="button" className="vd-glass vd-press vd-ibtn" onClick={() => step("them", 1)} aria-label={`Un gol más de ${rival}`}>
          <PI name="chev-r" />
        </button>
      </div>
    </div>,
  );
  return (
    <Sheet id="in-porra-t" cls="in-porra" title="Tu porra" sub={sub} closeLabel="Cerrar la porra" onClose={onClose}>
      <div className="in-porra__g">
        {left}
        <span className="in-porra__sep" aria-hidden="true">
          –
        </span>
        {right}
      </div>
      <p className="vd-small pp-sheet__note">{note}</p>
      {err && (
        <p className="vd-small pp-sheet__note" role="alert">
          {err}
        </p>
      )}
      <div className="pp-sheet__btns">
        <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={save} aria-busy={busy || undefined} disabled={busy}>
          Guardar la porra
        </button>
      </div>
    </Sheet>
  );
}

export interface MvpCandidate {
  id: string;
  name: string;
  num: string;
  min: string;
}

export function MvpSheet({ sub, note, list, voted, kit, onVote, onClose }: { sub: string; note: string; list: readonly MvpCandidate[]; voted: string | null; kit: Kit; onVote: (id: string) => Promise<void>; onClose: () => void }) {
  const [pick, setPick] = useState<string | null>(voted);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = () => {
    if (!pick) return;
    setBusy(true);
    setErr("");
    onVote(pick).then(
      () => setBusy(false),
      () => {
        setBusy(false);
        setErr("No se ha guardado tu voto. Inténtalo otra vez.");
      },
    );
  };
  return (
    <Sheet id="in-mvp-t" cls="in-mvp" title="Vota al MVP" sub={sub} closeLabel="Cerrar la votación" onClose={onClose}>
      <ul className="in-mvp__g" role="radiogroup" aria-label="Los que jugaron">
        {list.map((p) => (
          <li key={p.id}>
            <button type="button" role="radio" className={`in-mvp__b${pick === p.id ? " is-on" : ""}`} aria-checked={pick === p.id} onClick={() => setPick(p.id)}>
              <Tee num={p.num} kit={kit} className="in-mvp__tee" />
              <span className="in-mvp__n">{p.name}</span>
              <span className="in-mvp__m">{p.min}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="vd-small pp-sheet__note">{note}</p>
      {err && (
        <p className="vd-small pp-sheet__note" role="alert">
          {err}
        </p>
      )}
      <div className="pp-sheet__btns">
        <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={save} disabled={!pick || busy} aria-busy={busy || undefined}>
          {voted ? "Cambiar mi voto" : "Votar"}
        </button>
      </div>
    </Sheet>
  );
}

export interface CartelView {
  h: string;
  j: string;
  big: { us: number; them: number };
  vs: string;
  when: string;
  where: string;
  hero: string;
  /** The hero's dorsal (his printed shirt), or none (the kit's blank one). */
  heroNum: string;
  kit: Kit;
  alt: string;
  file: string;
}

/** The poster drawn on a canvas (1080 × 1080) for sharing: the floodlit sky, the shirt, the crest and the words. */
async function posterBlob(c: CartelView, teeSrc: string | null): Promise<Blob> {
  const S = 1080;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const g = cv.getContext("2d");
  if (!g) throw new Error("sin canvas");
  const sky = g.createLinearGradient(0, 0, 0, S);
  [
    [0, "#060F24"],
    [0.36, "#14275A"],
    [0.58, "#22457F"],
    [0.76, "#10283F"],
    [1, "#071022"],
  ].forEach(([o, col]) => sky.addColorStop(o as number, col as string));
  g.fillStyle = sky;
  g.fillRect(0, 0, S, S);
  const load = (src: string) =>
    new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
  if (teeSrc) {
    const tee = await load(teeSrc);
    // the shirt's crop of the 540 × 600 still (x 63–476, y 46–594), 42 % of the poster wide, at right 6 %, top 15 %
    const w = S * 0.42;
    const h = (w * 548) / 413;
    g.drawImage(tee, 63, 46, 413, 548, S - S * 0.06 - w, S * 0.15, w, h);
  }
  const crest = await load("/crest-256.webp");
  g.drawImage(crest, 48, 48, 120, 120);
  g.fillStyle = "#fff";
  g.textBaseline = "alphabetic";
  g.shadowColor = "rgba(3,8,22,.55)";
  g.shadowBlur = 36;
  g.font = "800 45px 'Mona Sans', system-ui, sans-serif";
  g.textAlign = "right";
  g.fillText(c.j, S - 54, 92);
  g.textAlign = "left";
  const x = 54;
  let y = S - 54;
  const line = (t: string, font: string, alpha = 1) => {
    g.font = font;
    g.globalAlpha = alpha;
    g.fillText(t, x, y);
    g.globalAlpha = 1;
  };
  line(c.where, "500 39px 'Mona Sans', system-ui, sans-serif", 0.85);
  y -= 50;
  line(c.when, "600 42px 'Mona Sans', system-ui, sans-serif");
  y -= 54;
  line(c.hero, "650 42px 'Mona Sans', system-ui, sans-serif");
  y -= 66;
  line(`${c.big.us}–${c.big.them}`, "800 216px 'Mona Sans', system-ui, sans-serif");
  y -= 214;
  line(c.vs, "500 42px 'Mona Sans', system-ui, sans-serif", 0.9);
  y -= 58;
  line("Manchester Piti", "720 66px 'Mona Sans', system-ui, sans-serif");
  try {
    return await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("sin imagen"))), "image/png"));
  } finally {
    cv.width = cv.height = 0; // its pixels go now: iOS caps a page's canvas memory
  }
}

export function CartelSheet({ c, teeSrc, onClose, say }: { c: CartelView; teeSrc: string | null; onClose: () => void; say: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const run = async (share: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await posterBlob(c, teeSrc);
      const f = new File([blob], c.file, { type: "image/png" });
      if (share && typeof navigator.canShare === "function" && navigator.canShare({ files: [f] })) {
        await navigator.share({ files: [f], title: c.h });
        say("Cartel compartido.");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = c.file;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        say("Imagen guardada.");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) say("No se ha podido hacer la imagen. Prueba otra vez.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet id="in-cartel-t" cls="pp-cartel" title={c.h} closeLabel="Cerrar el cartel" onClose={onClose}>
      <figure className="pp-poster" role="img" aria-label={c.alt}>
        <div className="pp-poster__sky is-flood" aria-hidden="true" />
        <Tee num={c.heroNum} kit={c.kit} className="pp-poster__tee" />
        <img className="pp-poster__crest" src="/crest-128.webp" alt="" width={40} height={40} />
        <p className="pp-poster__j" aria-hidden="true">
          {c.j}
        </p>
        <div className="pp-poster__txt" aria-hidden="true">
          <p className="pp-poster__us">Manchester Piti</p>
          <p className="pp-poster__vs">{c.vs}</p>
          <p className="pp-poster__big">{scoreText(c.big.us, c.big.them)}</p>
          <p className="pp-poster__hero">{c.hero}</p>
          <p className="pp-poster__when">{c.when}</p>
          <p className="pp-poster__where">{c.where}</p>
        </div>
      </figure>
      <p className="vd-small pp-sheet__note">Lleva el resultado y la luz de esa noche.</p>
      <div className="pp-sheet__btns">
        <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={() => void run(true)} aria-busy={busy || undefined}>
          <PI name="share" />
          Compartir
        </button>
        <button type="button" className="vd-glass vd-press vd-btn" onClick={() => void run(false)} aria-busy={busy || undefined}>
          <PI name="arrow" />
          Guardar la imagen
        </button>
      </div>
    </Sheet>
  );
}
