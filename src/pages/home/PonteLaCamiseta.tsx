import { useRef, useState } from "react";
import { Jersey3D, type Jersey3DRef } from "../../components/jersey3d/Jersey3D";
import { Icon } from "../../components/celeste/icons";

const cleanName = (v: string) => v.toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑÇ .'-]/g, "").slice(0, 12);
const cleanNum = (v: string) => v.replace(/\D/g, "").slice(0, 2);

/** For the fans: your name and number on the real kit, to turn and keep as an image. */
export function PonteLaCamiseta({ theme }: { theme: "dark" | "light" }) {
  const shirt = useRef<Jersey3DRef>(null);
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [kit, setKit] = useState<"home" | "away">("home");
  const [busy, setBusy] = useState(false);
  const printed = { name: name.trim() || "TU NOMBRE", num: num || "26" };
  const canShareFiles = typeof navigator !== "undefined" && !!navigator.canShare;

  // The image is rendered on the viewer's device: the name never leaves it.
  const image = async () => {
    const { renderStill } = await import("../../components/jersey3d/scene");
    const blob = await renderStill({ kit, theme, name: printed.name, num: printed.num }, "image/png", 3);
    return new File([blob], `camiseta-piti-${printed.name.toLowerCase().replace(/\s+/g, "-")}.png`, { type: "image/png" });
  };
  const download = async () => {
    setBusy(true);
    try {
      const file = await image();
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (error) {
      console.error("No se ha podido crear la imagen:", error);
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    setBusy(true);
    try {
      const file = await image();
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Mi camiseta del Manchester Piti" });
      else await download();
    } catch {
      // cancelled by the viewer
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="hm-fan" aria-labelledby="hm-fan-t">
      <div className="stage">
        <div className="glow" aria-hidden="true" />
        <Jersey3D
          ref={shirt}
          className="hm-fan3d"
          kit={kit}
          theme={theme}
          name={printed.name}
          num={printed.num}
          zoom={0.9}
          lift={0.2}
          label={`Tu camiseta con ${printed.name} y el dorsal ${printed.num}. Arrástrala o usa las flechas para girarla.`}
        />
        <button type="button" className="turn" onClick={() => shirt.current?.turn()}>
          <Icon name="turn" size={14} />
          Gírala
        </button>
      </div>
      <div className="copy">
        <span className="hm-kick">Para la afición</span>
        <h2 id="hm-fan-t">
          Ponte <em>la del Piti.</em>
        </h2>
        <p className="hm-lede">Escribe tu nombre y tu dorsal, elige equipación y gírala. Descárgala para el fondo de pantalla o compártela.</p>
        <div className="form">
          <label>
            <span>Tu nombre</span>
            <input type="text" value={name} placeholder="TU NOMBRE" maxLength={12} autoComplete="off" onChange={(e) => setName(cleanName(e.target.value))} />
          </label>
          <label>
            <span>Dorsal</span>
            <input type="text" inputMode="numeric" value={num} placeholder="26" maxLength={2} onChange={(e) => setNum(cleanNum(e.target.value))} />
          </label>
        </div>
        <div className="hm-row">
          <div className="hm-kitseg" role="group" aria-label="Equipación">
            <button type="button" aria-pressed={kit === "home"} onClick={() => setKit("home")}>
              <i className="sw" />
              1ª
            </button>
            <button type="button" aria-pressed={kit === "away"} onClick={() => setKit("away")}>
              <i className="sw a" />
              2ª
            </button>
          </div>
          <button type="button" className="hm-btn" onClick={download} disabled={busy}>
            <Icon name="down" size={17} stroke={2.2} />
            Descargar imagen
          </button>
          {canShareFiles && (
            <button type="button" className="hm-ghostbtn" onClick={share} disabled={busy}>
              <Icon name="share" size={17} stroke={2} />
              Compartir
            </button>
          )}
        </div>
        <small className="note">Tu nombre no se guarda: la imagen se crea en tu propio dispositivo.</small>
      </div>
    </section>
  );
}
