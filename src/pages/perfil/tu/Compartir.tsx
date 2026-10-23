// /perfil/compartir (TU boards tu-share): the studio — «Mi carta» or «¡Ya es oficial!», story or post, front or
// back — with the preview, «Compartir» (the image to the phone's share sheet, else the link, else the clipboard),
// «Descargar la imagen» and «Copiar el enlace». A sheet with its own address: Esc, the scrim or × go back to La carta.
import { useContext, useEffect, useRef, useState } from "react";
import { KitStillContext } from "../../../components/jersey3d/kitStill";
import { Seg, TuIcon, TuLayer } from "../../../components/vidrio/tu/ui";
import { copyText, saveBlob } from "../fxRuntime";
import { shareFileName, shareLink, shareOut, sharePlan, shareToast, shareWords, slugOf, type ShareNav } from "../share";
import type { ScreenProps } from "./MiPagina";
import { TuCard, type CardModel } from "./TuCard";
import { wantedNumber } from "./view";
import { shareImage, type Fmt } from "./shareDraw";

const FOCUSABLE = 'button:not([disabled]):not([aria-disabled="true"]), [href], [tabindex]:not([tabindex="-1"])';

export function Compartir(p: ScreenProps & { card: CardModel; onClose: () => void }) {
  const { data, who, say, card, onClose } = p;
  const vinc = who.kind === "jugador";
  const [ds, setDs] = useState<"carta" | "poster">(vinc ? "carta" : "poster");
  const [fmt, setFmt] = useState<Fmt>("historia");
  const [face, setFace] = useState<"frente" | "dorso">("frente");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const still = useContext(KitStillContext);
  const pack = data.ficha.state === "pendiente";
  const num = vinc ? data.card.number : wantedNumber(data);
  const shirtSrc = vinc ? (still("home", num)?.src ?? null) : (still("home")?.src ?? null);
  const tone = vinc ? "ok" : pack ? "warn" : "off";
  const since = data.access.sinceText;
  const host = p.origin.replace(/^https?:\/\//, "");
  const poster = {
    kick: vinc ? "¡Ya es oficial!" : pack ? "Fichaje en trámite" : "Nuevo socio",
    name: vinc ? data.card.name || data.shirt.current : `@${data.nickname}`,
    line: vinc ? `Dorsal ${num} · ${data.card.posLong ?? ""}` : pack ? `Pendiente del capitán · dorsal ${num}` : `Socio desde ${since}`,
    foot: `Presentado en ${since} · ${host}`,
    tone: tone as "ok" | "warn" | "off",
  };
  const isCarta = ds === "carta";
  const lead = isCarta ? "Elige diseño, formato y cara: se descarga tal cual la ves." : vinc ? "El cartel de «¡Ya es oficial!» con tu nombre, dorsal y posición." : pack ? "Hoy dice «Fichaje en trámite»; cuando el capitán acepte, «¡Ya es oficial!»." : "Hoy te presenta como nuevo socio; con tu ficha, «¡Ya es oficial!».";
  const link = shareLink({ origin: p.origin, playerId: data.ficha.playerId, state: data.ficha.state, dev: import.meta.env.DEV });
  const slug = slugOf(vinc ? data.card.name || data.nickname : data.nickname);
  const file = shareFileName(isCarta ? "carta" : "poster", slug);
  const image = () => shareImage({ fmt, face, card: isCarta ? card : null, poster: isCarta ? null : poster, shirt: shirtSrc, crest: "/crest-128.webp" });

  // a dialog: the focus goes in and stays; Esc closes
  useEffect(() => {
    const el = box.current;
    const before = document.activeElement as HTMLElement | null;
    el?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const f = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      before?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    say("Preparando la imagen…");
    const blob = await image().catch(() => null);
    setBusy(false);
    if (!blob) return say("No se ha podido preparar la imagen. Inténtalo otra vez.");
    saveBlob(blob, file);
    say(`Imagen descargada: ${file}`);
  };
  const share = async () => {
    if (busy) return;
    setBusy(true);
    const blob = await image().catch(() => null);
    const f = blob ? new File([blob], file, { type: "image/png" }) : null;
    const nav = navigator as ShareNav;
    const words = shareWords({ state: data.ficha.state, design: isCarta ? "carta" : "poster", shirt: data.card.name || data.nickname, number: num });
    const out = await shareOut({ nav, file: f, link, title: words.title, text: words.text, copy: copyText });
    setBusy(false);
    const t = shareToast(out, sharePlan(nav, f));
    if (t) say(t);
  };
  const copy = async () => say((await copyText(link)) ? `Enlace copiado: ${link.replace(/^https?:\/\//, "")}` : "No se ha podido copiar el enlace.");

  return (
    <TuLayer cls="o-compartir">
      <div className="tu-scrim" aria-hidden="true" onClick={onClose} />
      <div ref={box} className="vd-glass vd-glass--deep tu-sheet tu-share" role="dialog" aria-modal="true" aria-labelledby="tu-sh-t" aria-describedby="tu-sh-d">
        <span className="tu-grab" aria-hidden="true" />
        <header className="tu-share__head">
          <div>
            <p className="tu-kick">Estudio</p>
            <h2 id="tu-sh-t">{vinc ? "Compartir mi carta" : "Compartir mi póster"}</h2>
            <p id="tu-sh-d">{lead}</p>
          </div>
          <button type="button" className="tu-x2" aria-label="Cerrar el estudio" onClick={onClose}>
            <TuIcon name="close" />
          </button>
        </header>
        <div className="tu-share__body">
          <div className="tu-share__pv">
            <div className={`tu-frame f-${fmt} d-${ds} tone-${tone}${face === "dorso" ? " is-dorso" : ""}`} role="img" aria-label={`${isCarta ? `Tu carta, ${face === "dorso" ? "el dorso con el carné y el QR" : "el frente"}` : `Póster «${poster.kick}»`}, formato ${fmt === "post" ? "post 4:5" : "historia 9:16"}.`}>
              {isCarta ? (
                <div className="tu-frame__card">
                  <TuCard card={card} flip={face === "dorso"} run={0} label="" onTap={() => undefined} />
                </div>
              ) : (
                <div className="tu-poster">
                  <img className="tu-poster__crest" src="/crest-128.webp" alt="" />
                  <b className="tu-poster__k">{poster.kick}</b>
                  {shirtSrc ? <img className="tu-poster__img" src={shirtSrc} alt="" /> : <span className="tu-poster__img" />}
                  <b className="tu-poster__n">{poster.name}</b>
                  <span>{poster.line}</span>
                  <small>{poster.foot}</small>
                </div>
              )}
            </div>
          </div>
          <div className="tu-share__ctl">
            <p className="tu-label" id="tu-sh-ds">
              Diseño
            </p>
            <Seg
              cls="tu-oseg--tall"
              labelledBy="tu-sh-ds"
              value={ds}
              onPick={setDs}
              opts={[
                { v: "carta", t: "Mi carta", sub: vinc ? "frente o dorso" : "cuando tengas carta", dis: !vinc },
                { v: "poster", t: "¡Ya es oficial!", sub: vinc ? "tu fichaje" : pack ? "en trámite" : "nuevo socio" },
              ]}
            />
            <p className="tu-label" id="tu-sh-fm">
              Formato
            </p>
            <Seg
              cls="tu-oseg--tall"
              labelledBy="tu-sh-fm"
              value={fmt}
              onPick={setFmt}
              opts={[
                { v: "historia", t: "Historia", sub: "9:16" },
                { v: "post", t: "Post", sub: "4:5" },
              ]}
            />
            {isCarta && (
              <>
                <p className="tu-label" id="tu-sh-fc">
                  Cara
                </p>
                <Seg
                  cls="tu-oseg--tall"
                  labelledBy="tu-sh-fc"
                  value={face}
                  onPick={setFace}
                  opts={[
                    { v: "frente", t: "Frente", sub: "tu carta" },
                    { v: "dorso", t: "Dorso", sub: "carné y QR" },
                  ]}
                />
              </>
            )}
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri tu-wide" aria-disabled={busy || undefined} onClick={() => void share()}>
              <TuIcon name="share" />
              Compartir
            </button>
            <div className="tu-row">
              <button type="button" className="vd-link" onClick={() => void download()}>
                Descargar la imagen
              </button>
              <button type="button" className="vd-link" onClick={() => void copy()}>
                Copiar el enlace
              </button>
            </div>
            <p className="tu-small">
              <TuIcon name="lock" />
              {isCarta ? "La imagen no lleva tu correo ni tu id: solo lo que ves. El dorso lleva el QR a tu página pública." : "El póster no lleva tu correo ni tu id: solo lo que ves."}
            </p>
            {!vinc && <p className="tu-small">{pack ? "Mientras el capitán confirma tu ficha, el póster dice «Fichaje en trámite»." : "Sin ficha, el póster te presenta como nuevo socio."}</p>}
          </div>
        </div>
      </div>
    </TuLayer>
  );
}
