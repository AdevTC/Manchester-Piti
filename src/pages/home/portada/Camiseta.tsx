// /camiseta · «Ponte la del Piti»: your name and dorsal on the back of the real kit, big, under its own light.
// The kit's blank still (the 3D scene's, the kit and the light chosen) with the print drawn over it as the kit
// prints it (Barlow Condensed 700 for the name, 600 for the number, the name over the number with its gap); the
// image to download or share is the scene's own render with that print. The name never travels in the address.
import { useEffect, useRef, useState } from "react";
import { useShirtStills } from "../../../components/jersey3d/useShirtStills";
import type { Kit } from "../../../components/jersey3d/kitStill";
import { PageLink } from "./links";
import { PI, Seg, Tee } from "./ui";

// (the name in the kit's text face, the number in its number face: prints.ts FONT_TXT / FONT_NUM, as the scene prints them)
const FAM = '"Barlow Condensed", "Arial Narrow", sans-serif';
const FAM_NUM = '"Barlow Semi Condensed", "Barlow Condensed", "Arial Narrow", sans-serif';
const cleanName = (v: string) => v.toLocaleUpperCase("es").replace(/[^A-ZÁÉÍÓÚÜÑÇ .'-]/g, "").slice(0, 12);
const cleanNum = (v: string) => v.replace(/\D/g, "").slice(0, 2);

/** The print over a 540 × 600 blank still: the name's cap height 45 (rows 113–157), condensed past 220 px wide but
 *  never shrunk in height; the number 188 tall (rows 191–380), a 34 px gap under the name. */
export function drawPrint(g: CanvasRenderingContext2D, img: CanvasImageSource, name: string, num: string, kit: Kit) {
  g.clearRect(0, 0, 540, 600);
  g.drawImage(img, 0, 0, 540, 600);
  g.fillStyle = kit === "away" ? "#F5F5F5" : "#051330";
  g.textBaseline = "alphabetic";
  const sizeFor = (w: string, cap: number, fam = FAM) => {
    g.font = `${w} 100px ${fam}`;
    return (100 * cap) / (g.measureText("H").actualBoundingBoxAscent || 70);
  };
  const ink = (t: string) => {
    const m = g.measureText(t);
    return { w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight || m.width, l: m.actualBoundingBoxLeft || 0 };
  };
  const put = (t: string, w: string, cap: number, sx: number, cx: number, base: number, fam = FAM) => {
    g.font = `${w} ${sizeFor(w, cap, fam)}px ${fam}`;
    g.textAlign = "left";
    const k = ink(t);
    g.save();
    g.translate(cx, base);
    g.scale(sx, 1);
    g.fillText(t, -k.w / 2 + k.l, 0);
    g.restore();
  };
  if (name) {
    g.font = `700 ${sizeFor("700", 45)}px ${FAM}`;
    const nsx = 119 / ink("JORDI").w;
    const nw = ink(name).w * nsx;
    put(name, "700", 45, nw > 220 ? 220 / ink(name).w : nsx, 270, 157);
  }
  if (num) {
    g.font = `600 ${sizeFor("600", 188, FAM_NUM)}px ${FAM_NUM}`;
    put(num, "600", 188, 167 / ink("10").w, 270, 380, FAM_NUM);
  }
}

export interface CamisetaProps {
  initialName: string;
  initialNum: string;
  initialKit: Kit;
  /** The page's theme: «De día» starts on in the light one. */
  day: boolean;
  /** The player's own printed shirt (the real one, in his carta). */
  mine: { num: string; short: string } | null;
  fan: boolean;
  say: (t: string) => void;
}

export function Camiseta({ initialName, initialNum, initialKit, day, mine, fan, say }: CamisetaProps) {
  const [name, setName] = useState(initialName);
  const [num, setNum] = useState(initialNum);
  const [kit, setKit] = useState<Kit>(initialKit);
  const [luz, setLuz] = useState<"focos" | "dia">(day ? "dia" : "focos");
  const [busy, setBusy] = useState(false);
  const theme = luz === "dia" ? ("light" as const) : ("dark" as const);
  const blank = { kit, theme, name: "", num: "", yaw: 0 };
  const src = useShirtStills([blank], { offMainThread: true })(blank);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [fonts, setFonts] = useState(0);
  useEffect(() => {
    let on = true;
    void document.fonts?.load(`700 64px "Barlow Condensed"`).then(() => on && setFonts((n) => n + 1));
    void document.fonts?.load(`600 64px "Barlow Semi Condensed"`).then(() => on && setFonts((n) => n + 1));
    return () => {
      on = false;
    };
  }, []);
  useEffect(() => {
    const cv = canvas.current;
    const g = cv?.getContext("2d");
    if (!cv || !g || !src) return;
    const img = new Image();
    let on = true;
    img.onload = () => on && drawPrint(g, img, name.trim(), num, kit);
    img.src = src;
    return () => {
      on = false;
    };
  }, [src, name, num, kit, fonts]);

  const printed = { name: name.trim(), num };
  const file = `camiseta-piti${printed.name ? `-${printed.name.toLocaleLowerCase("es").replace(/\s+/g, "-")}` : ""}.png`;
  const image = async () => {
    const { renderStill } = await import("../../../components/jersey3d/scene");
    return renderStill({ kit, theme, name: printed.name, num: printed.num }, "image/png", 3);
  };
  const download = async (blob?: Blob) => {
    const b = blob ?? (await image());
    const url = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const run = async (share: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await image();
      const f = new File([blob], file, { type: "image/png" });
      if (share && typeof navigator.canShare === "function" && navigator.canShare({ files: [f] })) {
        await navigator.share({ files: [f], title: "Ponte la del Piti" });
        say("Camiseta compartida.");
      } else {
        await download(blob);
        say(`Imagen guardada: ${file}.`);
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) say("No se ha podido hacer la imagen en este navegador.");
    } finally {
      setBusy(false);
    }
  };
  const label = `La camiseta ${kit === "away" ? "segunda, negra y roja" : "primera, celeste"} del Manchester Piti${printed.name ? ` con ${printed.name}` : " sin nombre"}${num ? ` y el ${num} a la espalda` : ""}`;
  const cap = printed.name || num ? `${printed.name || "Sin nombre"}${num ? ` · ${num}` : ""} · ${kit === "away" ? "segunda equipación" : "primera equipación"}` : "Escribe tu nombre y tu dorsal";
  return (
    <section className="in-place in-cam" aria-label="Ponte la del Piti">
      <div className="ik-grid">
        <figure className={`ik-fig ${luz === "dia" ? "is-dia" : "is-focos"} is-${kit}`}>
          <span className="ik-glow" aria-hidden="true" />
          <canvas ref={canvas} className="ik-shirt" width={540} height={600} style={{ viewTransitionName: "in-tee" }} role="img" aria-label={label} />
          <figcaption className="ik-cap">{cap}</figcaption>
        </figure>
        <form
          className="ik-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(false);
          }}
        >
          {mine && (
            <p className="ik-mine">
              <Tee num={mine.num} className="ik-mine__tee" />
              <span>
                Rellenada con la tuya: {mine.short} {mine.num}. La de verdad, impresa, está en tu carta.
              </span>
            </p>
          )}
          <div className="ik-fields">
            <label className="ik-f ik-f--name">
              <span>Tu nombre</span>
              <input className="ik-in" type="text" maxLength={12} autoComplete="off" spellCheck={false} placeholder="Tu nombre" value={name} onChange={(e) => setName(cleanName(e.currentTarget.value))} aria-describedby="ik-note" />
            </label>
            <label className="ik-f ik-f--num">
              <span>Dorsal</span>
              <input className="ik-in" type="text" inputMode="numeric" maxLength={2} autoComplete="off" placeholder="10" value={num} onChange={(e) => setNum(cleanNum(e.currentTarget.value))} />
            </label>
          </div>
          <div className="ik-segs">
            <div className="ik-segw">
              <span className="ik-segl" id="ik-kit-l">
                Equipación
              </span>
              <Seg labelledBy="ik-kit-l" opts={[{ id: "home", t: "Primera", on: kit === "home" }, { id: "away", t: "Segunda", on: kit === "away" }]} onPick={(id) => setKit(id === "away" ? "away" : "home")} />
            </div>
            <div className="ik-segw">
              <span className="ik-segl" id="ik-luz-l">
                La luz
              </span>
              <Seg labelledBy="ik-luz-l" opts={[{ id: "focos", t: "Con focos", on: luz === "focos" }, { id: "dia", t: "De día", on: luz === "dia" }]} onPick={(id) => setLuz(id === "dia" ? "dia" : "focos")} />
            </div>
          </div>
          <div className="ik-btns">
            <button type="submit" className="vd-glass vd-press vd-btn vd-btn--pri" aria-busy={busy || undefined}>
              <PI name="arrow" />
              Descargar la imagen
            </button>
            <button type="button" className="vd-glass vd-press vd-btn" onClick={() => void run(true)} aria-busy={busy || undefined}>
              <PI name="share" />
              Compartir
            </button>
          </div>
          <p className="ik-note" id="ik-note">
            Tu nombre no se guarda: la imagen se hace en tu móvil. Sale con la letra y el dorsal de la equipación de verdad.
          </p>
          {fan && (
            <p className="ik-invite">
              <b>¿Juegas en el Piti?</b> La tuya ya está impresa en el vestuario.{" "}
              <PageLink to="vestuario" className="vd-link">
                Pedir entrar
              </PageLink>
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
