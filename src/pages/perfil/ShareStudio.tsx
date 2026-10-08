// /profile «La carta» › the share studio (pf-g.mjs share()): a sheet over the page with Diseño («Mi carta»
// | «¡Ya es oficial!»), Formato (Historia 9:16 | Post 4:5), Cara (Frente | Dorso, only for Mi carta), the
// live preview (the design's DOM), «Descargar imagen» (the PNG painted on a canvas, the scan flash and the
// toast), «Compartir» (the image to the phone's share sheet, else the link, else the clipboard) and
// «Copiar enlace», with the privacy line. Closes with ×, Escape or the backdrop; focus stays inside and
// goes back to the button that opened it; the page behind doesn't scroll.
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Faces, Tee } from "./CardFaces";
import { buzz, copyText, saveBlob } from "./fxRuntime";
import { CREST, Ic } from "./icons";
import type { HeroView } from "./heroView";
import {
  cartaAria,
  cartaKicker,
  designFor,
  posterModel,
  shareFileName,
  shareOut,
  sharePlan,
  shareToast,
  shareWords,
  slugOf,
  studioCopy,
  type SegOption,
  type ShareDesign,
  type ShareFace,
  type ShareFormat,
  type ShareNav,
} from "./share";
import { shareBlob, type ShareSpec } from "./shareDraw";

export interface ShareStudioProps {
  hv: HeroView;
  nick: string;
  /** «Delantero» (null: no position yet). */
  posLong: string | null;
  /** «T1». */
  season: string;
  /** The link that goes with the image (your public page, or the club's home). */
  link: string;
  /** What «Mi carta» prints at its foot: «host/jugadores/:id». */
  foot: string;
  /** «sep 2026»: «PRESENTADO EL …». */
  presented: string;
  rm: boolean;
  onClose: () => void;
}

interface Toast {
  msg: string;
  bad: boolean;
  n: number;
}

/** One PNG per look on screen, drawn once (a few kept: switching back and forth costs nothing). */
function cachedBlob(c: Map<string, Promise<Blob | null>>, spec: ShareSpec, key: string): Promise<Blob | null> {
  let p = c.get(key);
  if (!p) {
    p = shareBlob(spec).catch(() => null);
    c.set(key, p);
    if (c.size > 6) c.delete(c.keys().next().value ?? "");
  }
  return p;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Seg<K extends string>({ id, label, opts, value, onSet }: { id: string; label: string; opts: SegOption<K>[]; value: K; onSet: (k: K) => void }) {
  return (
    <div className="fld">
      <span className="lbl" id={id}>
        {label}
      </span>
      <div className="seg two" role="group" aria-labelledby={id}>
        {opts.map((o) => (
          <button key={o.id} type="button" aria-pressed={value === o.id} disabled={o.disabled} onClick={() => onSet(o.id)}>
            {o.label}
            <small>{o.sub}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ShareStudio({ hv, nick, posLong, season, link, foot, presented, rm, onClose }: ShareStudioProps) {
  const [wanted, setDesign] = useState<ShareDesign>("carta");
  const [format, setFormat] = useState<ShareFormat>("historia");
  const [face, setFace] = useState<ShareFace>("frente");
  const [scan, setScan] = useState(0);
  const [dl, setDl] = useState(false);
  const [cc, setCc] = useState(false);
  const [busy, setBusy] = useState<"dl" | "share" | "copy" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [toast, setToast] = useState<Toast>({ msg: "", bad: false, n: 0 });
  const say = (msg: string, bad = false) => setToast((t) => ({ msg, bad, n: t.n + 1 }));

  const state = hv.state;
  const vinc = hv.vinc;
  const ds = designFor(state, wanted);
  const copy = studioCopy(state, ds);
  const shirt = hv.front.name;
  const number = hv.num;
  const slug = slugOf(vinc ? shirt : nick);
  const file = shareFileName(ds, slug);
  const poster = posterModel({ state, shirt, nick, number, posLong, presented, format });
  const kicker = cartaKicker(face, hv.front.racha, season);
  const cardCls = hv.cardCls
    .split(" ")
    .filter((c) => c && c !== "flipped" && c !== "st-a" && c !== "st-b")
    .join(" ");
  const spec: ShareSpec = { design: ds, format, face, season, carta: { tier: hv.tierCls, front: hv.front, back: hv.back, kicker, foot }, poster };
  const specKey = JSON.stringify(spec);

  // ── the PNG, drawn ahead for what is on screen (so «Compartir» still has the tap's permission)
  const cache = useRef(new Map<string, Promise<Blob | null>>());
  const warm = useEffectEvent(() => void cachedBlob(cache.current, spec, specKey));
  useEffect(() => {
    const t = window.setTimeout(warm, 250);
    return () => window.clearTimeout(t);
  }, [specKey]);

  // ── timers (the toast after the scan), cleared on closing
  const timers = useRef(new Set<number>());
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  };
  useEffect(() => {
    const set = timers.current;
    return () => set.forEach((t) => window.clearTimeout(t));
  }, []);
  useEffect(() => {
    if (!toast.n) return;
    const t = window.setTimeout(() => setToast((x) => (x.n === toast.n ? { ...x, msg: "" } : x)), 2600);
    return () => window.clearTimeout(t);
  }, [toast.n]);

  // ── a sheet: focus in (and back to the opener on closing), Tab stays inside, Escape closes, no page scroll
  const dlg = useRef<HTMLElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onEsc, true);
    return () => document.removeEventListener("keydown", onEsc, true);
  }, [onClose]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const html = document.documentElement;
    const body = document.body;
    const prev = [html.style.overflow, body.style.overflow];
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dlg.current) return;
      const els = [...dlg.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      const at = document.activeElement;
      if (!(at instanceof Node) || !dlg.current.contains(at)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && at === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      html.style.overflow = prev[0];
      body.style.overflow = prev[1];
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  // ── the link by hand, where the clipboard said no
  const linkIn = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!manual) return;
    linkIn.current?.focus();
    linkIn.current?.select();
  }, [manual]);

  const running = useRef(false);
  const start = (k: "dl" | "share" | "copy") => {
    if (running.current) return false;
    running.current = true;
    setBusy(k);
    setErr(null);
    return true;
  };
  const end = () => {
    running.current = false;
    setBusy(null);
  };
  const NO_IMAGE = "No se ha podido preparar la imagen en este navegador. Vuelve a intentarlo o usa «Copiar enlace».";

  const download = async () => {
    if (!start("dl")) return;
    const t0 = Date.now();
    setScan((n) => n + 1);
    buzz([20, 40, 60]);
    try {
      const blob = await cachedBlob(cache.current, spec, specKey);
      if (!blob) {
        setErr(NO_IMAGE);
        return;
      }
      saveBlob(blob, file);
      setDl(true);
      later(() => say("Imagen guardada · " + file), rm ? 0 : Math.max(0, 1100 - (Date.now() - t0)));
    } finally {
      end();
    }
  };

  const share = async () => {
    if (!start("share")) return;
    setManual(false);
    try {
      const blob = await cachedBlob(cache.current, spec, specKey);
      const img = blob && typeof File === "function" ? new File([blob], file, { type: "image/png" }) : null;
      const nav: ShareNav = typeof navigator === "undefined" ? {} : navigator;
      const plan = sharePlan(nav, img);
      const words = shareWords({ state, design: ds, shirt, number });
      const out = await shareOut({ nav, file: img, link, title: words.title, text: words.text, copy: copyText });
      if (out === "copied") setCc(true);
      if (out === "failed") {
        setManual(true);
        setErr("No se ha podido compartir ni copiar el enlace: cópialo a mano.");
        return;
      }
      const msg = shareToast(out, plan);
      if (msg) say(msg);
    } finally {
      end();
    }
  };

  const copyLink = async () => {
    if (!start("copy")) return;
    try {
      if (await copyText(link)) {
        setCc(true);
        setManual(false);
        buzz(12);
        say(vinc ? "Enlace a tu página copiado" : "Enlace al club copiado");
      } else {
        setManual(true);
        setErr("No se ha podido copiar: el enlace está seleccionado, cópialo a mano.");
      }
    } finally {
      end();
    }
  };

  const scanCls = scan ? (scan % 2 ? " sa" : " sb") : "";
  const post = format === "post";
  const preview =
    ds === "carta" ? (
      <div
        className={"pv" + (post ? " post" : "") + (face === "dorso" ? " bk" : "") + scanCls}
        role="img"
        aria-label={cartaAria({ face, format, rating: hv.front.rating, pos: hv.front.pos, shirt, number, showNumbers: hv.showN })}
      >
        <span className="pv-w l" />
        <span className="pv-w r" />
        <span className="pv-beam" />
        <span className="pv-top">
          <img src={CREST} alt="" />
          <span>MANCHESTER PITI</span>
          <span>{season}</span>
        </span>
        <span className="pv-k">{kicker}</span>
        <span className="pv-ped" />
        <span className="pv-card">
          <span className={"cd " + cardCls + (face === "dorso" ? " flipped" : "")} aria-hidden="true">
            <span className="cd-burst">
              <span className="cd-float">
                <span className="cd-tilt">
                  <span className="cd-flip">
                    <Faces kind="face" front={hv.front} back={hv.back} nick={nick} packNum={number || "?"} />
                  </span>
                </span>
              </span>
            </span>
          </span>
        </span>
        <span className="pv-ft">
          <span>{foot}</span>
        </span>
        <span className="pv-scan" />
      </div>
    ) : (
      <div className={"po" + (post ? " post" : "") + " " + poster.tone + scanCls} role="img" aria-label={poster.aria}>
        <span className="po-bg" />
        <span className="po-beam">
          <i />
          <i />
        </span>
        <span className="po-top">
          <img src={CREST} alt="" />
          <span>MANCHESTER PITI</span>
          <span>{season}</span>
        </span>
        <span className={"po-vb " + poster.tone + (poster.long ? " long" : "")}>
          <span className="po-led">
            <span>{poster.l1}</span>
            <span>{poster.l2}</span>
          </span>
        </span>
        <span className="po-fig">
          <img className="po-cr" src={CREST} alt="" />
          <Tee name={poster.print} num={poster.num} blank={poster.blank} />
        </span>
        <span className="po-nm">
          <b className={poster.nmCls || undefined}>{poster.name}</b>
          <span>{poster.line}</span>
        </span>
        <span className="po-ft">
          <b>{poster.num}</b>
          <span>
            PRESENTADO EL
            <br />
            {poster.presented}
          </span>
        </span>
        <span className="pv-scan" />
      </div>
    );

  return createPortal(
    <div className="vx pcv pc-shm">
      <div className="pc-shm-bg" aria-hidden="true" onClick={onClose} />
      <section className="sh" id="pe-share" ref={dlg} role="dialog" aria-modal="true" aria-labelledby="pe-sh-t" aria-describedby="pe-sh-d">
        <div className="sh-grab" aria-hidden="true" />
        <div className="sh-h">
          <div>
            <p className="kk">
              <i />
              Estudio
            </p>
            <h2 id="pe-sh-t">
              {copy.title} <span className="nv">nuevo</span>
            </h2>
            <p id="pe-sh-d">{copy.lead}</p>
          </div>
          <button type="button" className="ib" ref={closeBtn} onClick={onClose} aria-label="Cerrar el estudio">
            <Ic n="x" w={18} />
          </button>
        </div>
        <div className="sh-b">
          <div className="sh-pv-w">{preview}</div>
          <div className="sh-ctl">
            <Seg id="pe-ds" label="Diseño" opts={copy.designs} value={ds} onSet={setDesign} />
            <Seg id="pe-fmt" label="Formato" opts={copy.formats} value={format} onSet={setFormat} />
            {ds === "carta" && <Seg id="pe-face" label="Cara" opts={copy.faces} value={face} onSet={setFace} />}
            <button type="button" className="btn gold wide" disabled={busy === "dl"} aria-busy={busy === "dl" || undefined} onClick={() => void download()}>
              <Ic n="download" w={17} />
              {busy === "dl" ? "Preparando la imagen…" : dl ? "Descargada · otra vez" : "Descargar imagen"}
            </button>
            <div className="row2">
              <button type="button" className="btn" disabled={busy === "share"} aria-busy={busy === "share" || undefined} onClick={() => void share()}>
                <Ic n="share" w={17} />
                {busy === "share" ? "Preparando…" : "Compartir"}
              </button>
              <button type="button" className="btn" disabled={busy === "copy"} aria-busy={busy === "copy" || undefined} onClick={() => void copyLink()}>
                <Ic n="copy" w={17} />
                {cc ? "Copiado" : "Copiar enlace"}
              </button>
            </div>
            {err && (
              <p className="note bad" role="alert">
                <Ic n="alert" />
                <span>{err}</span>
              </p>
            )}
            {manual && (
              <div className="pc-sh-link">
                <label className="lbl" htmlFor="pe-sh-link">
                  Enlace para compartir
                </label>
                <input id="pe-sh-link" ref={linkIn} type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
              </div>
            )}
            <p className="tiny">
              <Ic n="lock" w={13} />
              <span>{copy.tiny}</span>
            </p>
            {copy.note && (
              <p className="note warn">
                <Ic n="alert" />
                <span>{copy.note}</span>
              </p>
            )}
          </div>
        </div>
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
