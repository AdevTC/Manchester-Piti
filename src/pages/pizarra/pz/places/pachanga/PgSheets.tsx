// r14 «La pizarra» · Pachanga's own sheets (the shell draws the frame): «Compartir los equipos» (the preview IS the
// image: Post 4:5 · Historia 9:16, share the file, download, copy the text, WhatsApp), «Juntos o separados» (pick
// two and how they go) and «Portero de …» (porteros fijos).
import { useState, type CSSProperties } from "react";
import { usePz } from "../../store/context";
import type { SheetProps } from "../../store/types";
import { PzIcon } from "../../campo/Shirt";
import { fmt } from "../../store/fmt";
import * as V from "./pachangaView";
import { pg, pgSlice } from "./pgStore";
import { pgModel } from "./pgModel";
import { PgShirt, Sw } from "./Pachanga";
import { pachangaCard, type CardModel } from "./pgCard";
import "../../../../../styles/pz/pachanga.css";

function useCard() {
  const P = usePz();
  const m = pgModel(P, P.state.layout);
  const st = m.st;
  const day = `${fmt.day(m.at)} · ${fmt.hm(m.at)}${m.src.place ? " · " + m.src.place : ""}`;
  const cols = (m.n === 3 ? [0, 1, 2] : [0, 1]).map((t) => {
    const k = m.isReady ? V.keeperOf(m.who, st, t) : null;
    return { name: m.names[t], pat: m.pats[t], sub: `media ${m.stats[t]?.media ?? 0} · ${m.stats[t]?.n ?? 0}`, rows: (m.isReady ? V.orderTeam(m.who, st, t) : []).map((id) => ({ t: m.who(id).shirt, k: id === k ? " · portero" : "" })) };
  });
  const foot = st.gk === "turnos" ? "Portería por turnos de 10′" : "Porteros fijos";
  const card: CardModel = { fmt: st.fmt, title: "Pachanga", sub: day, cols, foot, word: m.bal.word };
  const alt = `Equipos de la pachanga del ${fmt.day(m.at)}. ` + cols.map((c) => `${c.name} (media ${m.stats[cols.indexOf(c)]?.media ?? 0}): ${c.rows.map((r) => r.t).join(", ")}`).join(". ") + `. ${m.bal.word}.`;
  const text = V.pachangaText(m.who, st, `Pachanga · ${day}`);
  return { P, m, card, alt, text, day };
}

export function PgCompartirSheet() {
  const { P, m, card, alt, text } = useCard();
  const [busy, setBusy] = useState(false);
  const file = async (): Promise<File | null> => {
    const b = await pachangaCard(card);
    return b ? new File([b], `pachanga-${card.fmt}.png`, { type: "image/png" }) : null;
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      P.toast("Equipos copiados: pégalos en el grupo", { icon: "copy" });
    } catch {
      P.toast("Este navegador no deja copiar: usa WhatsApp o la imagen", { icon: "warn" });
    }
  };
  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const f = await file();
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (f && nav.share && (!nav.canShare || nav.canShare({ files: [f] }))) {
        await nav.share({ files: [f], title: "Pachanga", text });
        P.toast("Imagen de los equipos compartida", { icon: "share" });
      } else if (f) {
        download(f);
        P.toast("Este navegador no comparte imágenes: se ha descargado", { icon: "check" });
      } else await copy();
    } catch (e) {
      if (!(e && typeof e === "object" && (e as { name?: unknown }).name === "AbortError")) P.toast("No se ha podido compartir: prueba a descargarla", { icon: "warn" });
    } finally {
      setBusy(false);
    }
  };
  const down = async () => {
    const f = await file();
    if (f) {
      download(f);
      P.toast("Imagen de los equipos descargada", { icon: "check" });
    } else P.toast("Este navegador no deja dibujar la imagen: copia el texto", { icon: "warn" });
  };
  if (!m.isReady)
    return (
      <div className="pz-sh pg-sh">
        <p className="pz-line">Todavía no hay equipos: marca quién ha venido y aparecerán aquí.</p>
      </div>
    );
  return (
    <div className="pz-sh pg-sh">
      <div className="vd-glass pg-seg" style={{ "--n": 2 } as CSSProperties} role="group" aria-label="Formato">
        {(
          [
            ["post", "Post 4:5"],
            ["historia", "Historia 9:16"],
          ] as const
        ).map(([k, t]) => (
          <button key={k} type="button" aria-pressed={m.st.fmt === k} onClick={() => pg.fmt(P, k)}>
            {t}
          </button>
        ))}
      </div>
      <div className="pg-card">
        <figure className={`pg-img${card.fmt === "historia" ? " is-story" : ""}`} role="img" aria-label={alt}>
          <div className="pg-img__top">
            <img src="/crest-128.webp" alt="" />
            <span>Manchester Piti</span>
          </div>
          <div className="pg-img__h">
            <b>{card.title}</b>
            <span>{card.sub}</span>
          </div>
          <div className="pg-img__cols" style={{ "--cols": card.cols.length } as CSSProperties}>
            {card.cols.map((c) => (
              <div className="pg-img__col" key={c.name}>
                <div className="pg-img__ch">
                  <Sw pat={c.pat} />
                  <span>
                    <b>{c.name}</b>
                    <small>{c.sub}</small>
                  </span>
                </div>
                {c.rows.map((r) => (
                  <span key={r.t}>
                    {r.t}
                    {r.k && <i>{r.k}</i>}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div className="pg-img__foot">
            <span>{card.foot}</span>
            <b>{card.word}</b>
          </div>
        </figure>
      </div>
      <p className="pg-alt">Cada equipo va con su nombre y su dibujo de peto; la imagen lleva este texto para quien no la vea.</p>
      <div className="pz-acts">
        <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" disabled={busy} onClick={() => void share()}>
          <PzIcon name="share" />
          Compartir la imagen
        </button>
        <button type="button" className="vd-glass vd-press pz-btn" onClick={() => void down()}>
          Descargar
        </button>
      </div>
      <div className="pz-acts">
        <button type="button" className="vd-glass vd-press pz-btn" onClick={() => void copy()}>
          <PzIcon name="copy" />
          Copiar el texto
        </button>
        <a className="vd-glass vd-press pz-btn" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
          <PzIcon name="chat" />
          Mandar por WhatsApp
        </a>
      </div>
    </div>
  );
}
function download(f: File) {
  const url = URL.createObjectURL(f);
  const a = document.createElement("a");
  a.href = url;
  a.download = f.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function PgParejaSheet() {
  const P = usePz();
  const m = pgModel(P, P.state.layout);
  const [pa, setPa] = useState<string | null>(null);
  const [pb, setPb] = useState<string | null>(null);
  const [kind, setKind] = useState<V.PairKind>("separados");
  const nm = (id: string) => m.who(id).shirt;
  const line = pa && pb ? `${nm(pa)} y ${nm(pb)}, ${kind}` : pa ? `${nm(pa)} y… elige al otro` : "Elige a dos de los que han venido";
  const pick = (id: string) => {
    if (pa === id) {
      setPa(pb);
      setPb(null);
    } else if (pb === id) setPb(null);
    else if (!pa) setPa(id);
    else setPb(id);
  };
  return (
    <div className="pz-sh pg-sh">
      <p className="pg-pairline" aria-live="polite">
        {line}
      </p>
      <div className="vd-glass pg-seg" style={{ "--n": 2 } as CSSProperties} role="group" aria-label="Cómo van">
        {(
          [
            ["separados", "Separados", "cross"],
            ["juntos", "Juntos", "link"],
          ] as const
        ).map(([k, t, ic]) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
            <PzIcon name={ic} />
            {t}
          </button>
        ))}
      </div>
      <div className="pg-pick" role="group" aria-label="Elige a dos">
        {m.st.comes.map((id) => {
          const on = pa === id || pb === id;
          return (
            <button key={id} type="button" className="vd-glass vd-press" aria-pressed={on} aria-label={nm(id) + (on ? ", elegido" : "")} onClick={() => pick(id)}>
              <PgShirt P={P} id={id} size={30} />
              <small>{nm(id)}</small>
            </button>
          );
        })}
      </div>
      <div className="pz-acts">
        <button
          type="button"
          className="vd-glass vd-press pz-btn pz-btn--pri"
          disabled={!(pa && pb)}
          onClick={() => {
            if (!(pa && pb)) return;
            pg.pair(P, pa, pb, kind);
            P.act.closeSheet();
          }}
        >
          <PzIcon name="plus" />
          Añadir la pareja
        </button>
        <button type="button" className="nx-lnk" onClick={() => P.act.closeSheet()}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function PgPorteroSheet({ args }: SheetProps) {
  const P = usePz();
  const m = pgModel(P, P.state.layout);
  const t = Math.max(0, Math.min(m.n - 1, Number(args.t ?? 0) || 0));
  const st = pgSlice(P).get();
  if (!m.isReady) return <p className="pz-line">Todavía no hay equipos.</p>;
  const k = V.keeperOf(m.who, st, t);
  return (
    <div className="pz-sh pg-sh">
      <p className="pz-line">Elige quién se queda en la portería de {m.names[t]} toda la pachanga.</p>
      <ul className="pz-rows">
        {V.orderTeam(m.who, st, t).map((id) => {
          const pl = m.who(id);
          const on = id === k;
          return (
            <li key={id}>
              <button
                type="button"
                className="pz-row"
                aria-pressed={on}
                aria-label={pl.shirt + (on ? ", portero ahora" : ", ponerlo de portero")}
                onClick={() => {
                  if (!on) pg.keeper(P, t, id);
                  P.act.closeSheet();
                }}
              >
                <PgShirt P={P} id={id} size={30} />
                <span className="pz-row__t">
                  <b>{pl.shirt}</b>
                  <span>{on ? "Es el portero ahora" : pl.line === "POR" ? "Portero de oficio" : V.LSHORT[pl.line ?? ""] || (pl.guest ? "Invitado" : "")}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
