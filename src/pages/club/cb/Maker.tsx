// /club/equipo/camiseta · «Ponte la del Piti» (CL- boards, part-maker): the real printed shirt of any player of the
// squad, or the blank kit with the name and dorsal you type drawn as the kit prints them (Inicio's drawPrint), the
// 1ª or the 2ª, with floodlights or by day; «Descargar la imagen» renders the 3D scene's own still with that print.
// It starts on the viewer's own shirt. The name never travels in the address.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useShirtStills } from "../../../components/jersey3d/useShirtStills";
import type { Kit } from "../../../components/jersey3d/kitStill";
import { drawPrint } from "../../home/portada/Camiseta";
import { I, CREST } from "./ui";

export interface MakerPerson {
  id: string;
  /** «Kevin». */
  name: string;
  num: string;
  /** As the kit prints it: «KEVIN». */
  print: string;
}
export interface MakerProps {
  people: MakerPerson[];
  /** The viewer's own ficha (the maker starts on it). */
  mine: string | null;
  day: boolean;
  back: () => void;
  say: (t: string) => void;
}

const cleanName = (v: string) => v.toLocaleUpperCase("es").replace(/[^A-ZÁÉÍÓÚÜÑÇ .'-]/g, "").slice(0, 14);
const cleanNum = (v: string) => v.replace(/\D/g, "").slice(0, 2);

export function Maker({ people, mine, day, back, say }: MakerProps) {
  const [who, setWho] = useState<string>(mine && people.some((p) => p.id === mine) ? mine : "custom");
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [kit, setKit] = useState<Kit>("home");
  const [luz, setLuz] = useState<"focos" | "dia">(day ? "dia" : "focos");
  const [busy, setBusy] = useState(false);
  const theme = luz === "dia" ? ("light" as const) : ("dark" as const);
  const person = who === "custom" ? null : (people.find((p) => p.id === who) ?? null);
  const printed = person ? { kit, theme, name: person.print, num: person.num } : null;
  const blank = { kit, theme, name: "", num: "" };
  const stills = useShirtStills(printed ? [printed] : [blank], { offMainThread: true });
  const src = stills(printed ?? blank);
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
    if (person) return;
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
  }, [person, src, name, num, kit, fonts]);

  const shownName = person ? person.print : name.trim();
  const shownNum = person ? person.num : num;
  const alt = person ? `La camiseta de ${person.name} con el ${person.num} a la espalda` : `La camiseta del Piti con ${name.trim() || "tu nombre"} y el ${num || "dorsal que elijas"} a la espalda`;
  const save = async () => {
    if (busy) return;
    setBusy(true);
    const fn = person ? person.name.toLocaleLowerCase("es").normalize("NFD").replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "") : (name.trim() || "piti").toLocaleLowerCase("es").replace(/\s+/g, "-");
    const file = `camiseta-piti-${fn}.png`;
    try {
      const { renderStill } = await import("../../../components/jersey3d/scene");
      const blob = await renderStill({ kit, theme, name: shownName, num: shownNum }, "image/png", 3);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      say(`Imagen guardada: ${file}`);
    } catch {
      say("No se ha podido hacer la imagen en este navegador.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cb-room cb-room--maker">
      <header className="cb-roomhead">
        <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm cb-back" onClick={back}>
          <I n="chev-l" />
          El equipo
        </button>
        <h1 className="cb-roomhead__t" tabIndex={-1}>
          Ponte la del Piti
        </h1>
        <p className="cb-roomhead__s">La camiseta de verdad: la de un jugador, o la tuya con tu nombre y tu dorsal.</p>
      </header>
      <div className="cb-mk">
        <figure className={["cb-mk__pic", luz === "dia" ? "is-dia" : "", kit === "away" ? "is-away" : ""].filter(Boolean).join(" ")} style={{ viewTransitionName: "cb-mk-shirt" }}>
          {person ? src ? <img className="cb-mk__img" src={src} alt={alt} width={540} height={600} /> : <span className="cb-mk__img" role="img" aria-label={alt} /> : <canvas className="cb-mk__img" ref={canvas} width={540} height={600} role="img" aria-label={alt} />}
          <img className="cb-mk__crest" src={CREST} alt="" width={28} height={28} />
        </figure>
        <div className="cb-mk__form">
          <p className="vd-label" id="cb-mk-who">
            De quién
          </p>
          <ul className="cb-mk__people" role="group" aria-labelledby="cb-mk-who">
            {people.map((p) => (
              <li key={p.id}>
                <button type="button" className="cb-chip" aria-pressed={who === p.id} onClick={() => setWho(p.id)}>
                  <b>{p.num}</b>
                  {p.name}
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="cb-chip cb-chip--other" aria-pressed={who === "custom"} onClick={() => setWho("custom")}>
                Otro nombre
              </button>
            </li>
          </ul>
          {who === "custom" && (
            <div className="cb-mk__row">
              <label>
                <span className="vd-label">Tu nombre</span>
                <input className="vd-input" type="text" value={name} onChange={(e) => setName(cleanName(e.currentTarget.value))} placeholder="TU NOMBRE" maxLength={14} autoComplete="off" spellCheck={false} />
              </label>
              <label>
                <span className="vd-label">Dorsal</span>
                <input className="vd-input" type="text" inputMode="numeric" value={num} onChange={(e) => setNum(cleanNum(e.currentTarget.value))} placeholder="10" maxLength={2} />
              </label>
            </div>
          )}
          <div className="cb-mk__segs">
            <div className="vd-glass vd-seg" role="group" aria-label="La camiseta" style={{ "--n": 2, "--i": kit === "away" ? 1 : 0 } as CSSProperties}>
              <span className="vd-shelf__bead" aria-hidden="true" />
              <button type="button" className="vd-seg__b" aria-pressed={kit === "home"} onClick={() => setKit("home")}>
                1ª, celeste
              </button>
              <button type="button" className="vd-seg__b" aria-pressed={kit === "away"} onClick={() => setKit("away")}>
                2ª, negra
              </button>
            </div>
            <div className="vd-glass vd-seg" role="group" aria-label="La foto" style={{ "--n": 2, "--i": luz === "dia" ? 1 : 0 } as CSSProperties}>
              <span className="vd-shelf__bead" aria-hidden="true" />
              <button type="button" className="vd-seg__b" aria-pressed={luz === "focos"} onClick={() => setLuz("focos")}>
                Con focos
              </button>
              <button type="button" className="vd-seg__b" aria-pressed={luz === "dia"} onClick={() => setLuz("dia")}>
                De día
              </button>
            </div>
          </div>
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri cb-mk__save" onClick={() => void save()} aria-busy={busy || undefined}>
            <I n="arrow" />
            {busy ? "Haciendo la imagen…" : "Descargar la imagen"}
          </button>
          <p className="cb-small">{person ? "La camiseta impresa de verdad, la misma del vestuario y del siete." : "Tu nombre no se guarda: la imagen se hace en tu móvil."}</p>
        </div>
      </div>
    </div>
  );
}
