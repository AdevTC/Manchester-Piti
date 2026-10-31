// /perfil/vitrina/cromos (TuCarta B, the cromos sheet over Tu vitrina): his season in cromos, one at a time — the
// cromo big, «Cromo anterior» / «Siguiente cromo» (← → too; the last one's button closes), «Compartir este» (its
// PNG by recapDraw, to the phone's share sheet, else the link) and «Descargar todos en una imagen» (ONE file: a
// browser blocks a burst of downloads, bug 17). The cromos are tu/cromosModel's (the season recap, the single model).
// A dialog (VSheet): the focus goes in and stays, Esc / × / the scrim go back to the vitrina.
import { useEffect, useState } from "react";
import { copyText, saveBlob } from "../fxRuntime";
import { shareOut, slugOf, type ShareNav } from "../share";
import { drawRecapCard, recapCardBlob, RECAP_PALETTE, type RecapTheme } from "../recapDraw";
import { recapFileName, recapShirt } from "../recapView";
import type { ScreenProps } from "./screens/legacy";
import { cromoStart, cromosOfData, cromosSheetBlob, cromoWords } from "./cromosModel";
import { VSheet } from "./places/vitrina/Sheet";
import { VIc } from "./places/vitrina/icons";

const themeNow = (): RecapTheme => (typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark");

export function Cromos(p: ScreenProps & { onClose: () => void }) {
  const { data, say, onClose } = p;
  const cromos = data.ficha.state === "vinculada" ? cromosOfData(data, p.now) : null;
  const [i, setI] = useState(() => cromoStart.peek());
  const [busy, setBusy] = useState(false);
  useEffect(() => cromoStart.clear(), []);
  if (!cromos)
    return (
      <VSheet id="tv-cr-h" kick="Tu temporada en cromos" title="Aún sin cromos" onClose={onClose} className="tv-cromos">
        <p className="nx-meta">Tus cromos salen con tu primer partido de la temporada: partidos, goles, tu puesto, tu socio, la porra y el equipo.</p>
        <div className="nx-sheet__btns">
          <button type="button" className="vd-glass vd-press nx-btn" onClick={onClose}>
            Volver a tu vitrina
          </button>
        </div>
      </VSheet>
    );

  const list = cromos.cards;
  const n = list.length;
  const k = Math.max(0, Math.min(i, n - 1));
  const cur = list[k];
  const w = cromoWords(cur, cromos.closed);
  const season = cromos.recap.seasonName;
  const pid = data.ficha.playerId ?? "";
  const ctx = () => ({ theme: themeNow(), shirt: recapShirt(cromos.recap) });
  const prev = () => setI(Math.max(0, k - 1));
  const next = () => (k < n - 1 ? setI(k + 1) : onClose());

  const shareOne = async () => {
    if (busy) return;
    setBusy(true);
    const blob = await recapCardBlob(cur, ctx()).catch(() => null);
    const f = blob ? new File([blob], recapFileName(season, k, cur), { type: "image/png" }) : null;
    const out = await shareOut({ nav: navigator as ShareNav, file: f, link: `${p.origin}/jugadores/${pid}`, title: `${w.k} · Manchester Piti`, text: `${w.k}: ${w.t}.`, copy: copyText });
    setBusy(false);
    if (out === "shared-file") say(`Compartiendo el cromo «${w.k}».`);
    else if (out === "shared-link") say("Compartiendo el enlace a tu página.");
    else if (out === "copied") say("Este navegador no comparte imágenes: te hemos copiado el enlace.");
    else if (out === "failed") say("No se ha podido compartir el cromo. Inténtalo otra vez.");
  };
  const all = async () => {
    if (busy) return;
    setBusy(true);
    say(`Preparando tus ${n} cromos en una imagen…`);
    const theme = themeNow();
    const shirt = recapShirt(cromos.recap);
    const blob = await cromosSheetBlob(list, (cv, c) => drawRecapCard(cv, c, { theme, shirt }), RECAP_PALETTE[theme].bg).catch(() => null);
    setBusy(false);
    if (!blob) return say("No se ha podido preparar la imagen. Inténtalo otra vez.");
    const file = `${slugOf(season) || "temporada"}-cromos.png`;
    saveBlob(blob, file);
    say(`Tus ${n} cromos, en una imagen: ${file}`);
  };

  return (
    <VSheet
      id="tv-cr-h"
      kick="Tu temporada en cromos"
      title={cromos.closed ? `${season}, completa` : `${season}, hasta ahora`}
      onClose={onClose}
      className="tv-cromos"
      onKey={(e) => {
        if (e.key === "ArrowRight" && k < n - 1) {
          e.preventDefault();
          setI(k + 1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          prev();
        }
      }}
    >
      <div className={`tc-cromobig${w.gold ? " is-gold" : ""}`} role="group" aria-roledescription="cromo" aria-label={`Cromo ${k + 1} de ${n}: ${w.k}. ${w.t}. ${w.s}`} aria-live="polite">
        <small>{w.k}</small>
        <b>{w.t}</b>
        <p>{w.s}</p>
        <small>
          {k + 1} de {n}
        </small>
      </div>
      <div className="tv-cromos__dots" aria-hidden="true">
        {list.map((c, j) => (
          <i key={`${c.kind}-${j}`} className={j === k ? "is-on" : j < k ? "is-done" : ""} />
        ))}
      </div>
      <div className="nx-sheet__btns">
        <button type="button" className="vd-glass vd-press nx-btn" onClick={prev} disabled={k === 0}>
          <VIc name="chevL" />
          Cromo anterior
        </button>
        <button type="button" className="vd-glass vd-press nx-btn" onClick={next}>
          {k < n - 1 ? "Siguiente cromo" : "Cerrar los cromos"}
          {k < n - 1 && <VIc name="chevR" />}
        </button>
        <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={() => void shareOne()} aria-disabled={busy || undefined}>
          <VIc name="share" />
          Compartir este
        </button>
        <button type="button" className="nx-lnk" onClick={() => void all()} aria-disabled={busy || undefined}>
          Descargar todos en una imagen
        </button>
      </div>
    </VSheet>
  );
}
