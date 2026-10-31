// /perfil/compartir (TuCarta B, the studio sheet over Tu vitrina): «Mi carta» or «¡Ya es oficial!», Historia 9:16
// or Post 4:5, Frente or Dorso — the preview, «Descargar» (the PNG of tu/shareDraw), «Compartir» (the image to the
// phone's share sheet, else the link, else the clipboard) and «Copiar el enlace de tu página», with the privacy
// line. A dialog (VSheet): the focus goes in and stays, Esc / × / the scrim go back.
import { useContext, useState } from "react";
import { Seg } from "../../stats/palco/kit";
import { copyText, saveBlob } from "../fxRuntime";
import { shareFileName, shareLink, shareOut, sharePlan, shareToast, shareWords, slugOf, type ShareNav } from "../share";
import { niceName } from "../../../lib/derived/words";
import type { ScreenProps } from "./screens/legacy";
import { Shirt, type CardModel } from "./TuCard";
import { tierCls } from "./shell/tierCls";
import { wantedNumber } from "./view";
import { shareImage, type Fmt } from "./shareDraw";
import { VSheet } from "./places/vitrina/Sheet";
import { VIc } from "./places/vitrina/icons";
import { KitStillContext } from "../../../components/jersey3d/kitStill";

export function Compartir(p: ScreenProps & { card: CardModel; onClose: () => void }) {
  const { data, who, say, card, onClose } = p;
  const vinc = who.kind === "jugador";
  const [ds, setDs] = useState<"carta" | "poster">(vinc ? "carta" : "poster");
  const [fmt, setFmt] = useState<Fmt>("historia");
  const [face, setFace] = useState<"frente" | "dorso">("frente");
  const [busy, setBusy] = useState(false);
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

  // the preview (B's tc-prev): the frame in its format, its top line, the mini card, the name and its foot
  const dorso = isCarta && face === "dorso";
  const big = card.kind === "face" ? card.rating || "—" : card.kind === "carne" ? "S" : "?";
  const shownName = isCarta ? (dorso ? `Carné · ${card.back.name}` : niceName(data.card.name || data.shirt.current || data.nickname)) : poster.name;
  const top = isCarta ? `Manchester Piti · ${data.seasonName}` : poster.kick;
  const foot = isCarta ? (dorso ? "Con el QR de tu página" : `${host}${card.back.path}`) : poster.line;
  const aria = `${isCarta ? `Tu carta, ${dorso ? "el dorso con el carné y el QR" : "el frente"}` : `Póster «${poster.kick}»`}, formato ${fmt === "post" ? "post 4:5" : "historia 9:16"}.`;

  return (
    <VSheet id="tv-st-h" kick="El estudio" title={vinc ? "Compartir mi carta" : "Compartir mi póster"} desc={lead} onClose={onClose} className="tv-studio">
      <div className="tv-studio__in">
        <div className="tk-form">
          <div>
            <p className="tk-card__k">Diseño</p>
            <Seg
              label="Diseño"
              opts={[
                { key: "carta", t: "Mi carta", on: isCarta, off: !vinc, pick: () => setDs("carta") },
                { key: "poster", t: "¡Ya es oficial!", on: !isCarta, pick: () => setDs("poster") },
              ]}
            />
            {!vinc && <p className="nx-meta tv-studio__note">«Mi carta», cuando tengas carta. {pack ? "Mientras el capitán confirma tu ficha, el póster dice «Fichaje en trámite»." : "Sin ficha, el póster te presenta como nuevo socio."}</p>}
          </div>
          <div>
            <p className="tk-card__k">Formato</p>
            <Seg
              label="Formato"
              opts={[
                { key: "historia", t: "Historia 9:16", on: fmt === "historia", pick: () => setFmt("historia") },
                { key: "post", t: "Post 4:5", on: fmt === "post", pick: () => setFmt("post") },
              ]}
            />
          </div>
          {isCarta && (
            <div>
              <p className="tk-card__k">Cara</p>
              <Seg
                label="Cara"
                opts={[
                  { key: "frente", t: "Frente", on: face === "frente", pick: () => setFace("frente") },
                  { key: "dorso", t: "Dorso", on: face === "dorso", pick: () => setFace("dorso") },
                ]}
              />
            </div>
          )}
        </div>
        <div className="tc-prev">
          <div className={`tc-prev__f ${fmt === "historia" ? "is-h" : "is-p"} tone-${tone}`} role="img" aria-label={aria}>
            <span className="tc-prev__l">{top}</span>
            {isCarta && !dorso ? (
              <span className={`tc-mini ${tierCls(card)}`} aria-hidden="true">
                <b>{big}</b>
                <Shirt num={card.kind === "face" ? card.num : undefined} className="tc-mini__shirt" />
              </span>
            ) : dorso ? (
              <span className="tv-prev__qr" aria-hidden="true">
                <img src="/crest-128.webp" alt="" width="56" height="56" />
                <i>QR</i>
              </span>
            ) : shirtSrc ? (
              <img className={`tv-prev__shirt${tone === "off" ? " is-off" : ""}`} src={shirtSrc} alt="" />
            ) : (
              <span className="tv-prev__shirt" aria-hidden="true" />
            )}
            <b>{shownName}</b>
            <span className="tc-prev__l">{foot}</span>
          </div>
        </div>
      </div>
      <div className="nx-sheet__btns">
        <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={() => void download()} aria-disabled={busy || undefined}>
          Descargar
        </button>
        <button type="button" className="vd-glass vd-press nx-btn" onClick={() => void share()} aria-disabled={busy || undefined}>
          <VIc name="share" />
          Compartir
        </button>
        <button type="button" className="nx-lnk" onClick={() => void copy()}>
          Copiar el enlace de tu página
        </button>
      </div>
      <p className="nx-meta tv-studio__priv">
        <VIc name="lock" />
        {isCarta ? "La imagen no lleva tu correo ni tu id: solo lo que ves. El dorso lleva el QR a tu página pública." : "El póster no lleva tu correo ni tu id: solo lo que ves."}
      </p>
    </VSheet>
  );
}
