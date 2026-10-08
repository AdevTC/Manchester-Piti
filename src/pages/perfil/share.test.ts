import { describe, expect, it, vi } from "vitest";
import {
  cartaKicker,
  designFor,
  pageText,
  posterModel,
  shareFileName,
  shareLink,
  shareOut,
  sharePlan,
  shareToast,
  shareWords,
  slugOf,
  studioCopy,
  type ShareNav,
} from "./share";

const file = () => new File([new Uint8Array([1, 2, 3])], "carta-adri.png", { type: "image/png" });
const abort = () => Object.assign(new Error("cancelado"), { name: "AbortError" });

describe("nombres de archivo y enlaces", () => {
  it("el slug sale del nombre o del apodo, sin tildes ni símbolos", () => {
    expect(slugOf("ADRIÁN T.C.")).toBe("adrian-t-c");
    expect(slugOf("@adrian_tc")).toBe("adrian-tc");
    expect(slugOf("Ñoño O'Neill")).toBe("nono-o-neill");
    expect(slugOf("···")).toBe("socio");
    expect(slugOf("")).toBe("socio");
  });
  it("carta-{slug}.png / oficial-{slug}.png", () => {
    expect(shareFileName("carta", "adri")).toBe("carta-adri.png");
    expect(shareFileName("poster", "adri")).toBe("oficial-adri.png");
    expect(shareFileName("poster", "")).toBe("oficial-socio.png");
  });
  it("vinculada: tu página pública (en producción por /compartir, con la vista previa); sin ficha o pendiente: el club", () => {
    const o = { origin: "https://manchesterpiti.es", playerId: "adri" };
    expect(shareLink({ ...o, state: "vinculada", dev: false })).toBe("https://manchesterpiti.es/compartir/jugador/adri");
    expect(shareLink({ ...o, state: "vinculada", dev: true })).toBe("https://manchesterpiti.es/jugadores/adri");
    expect(shareLink({ ...o, state: "pendiente", dev: false })).toBe("https://manchesterpiti.es/");
    expect(shareLink({ ...o, playerId: null, state: "sin-ficha", dev: false })).toBe("https://manchesterpiti.es/");
    expect(pageText("https://manchesterpiti.es", "adri")).toBe("manchesterpiti.es/jugadores/adri");
  });
  it("nunca lleva el correo ni el uid", () => {
    const words = [shareWords({ state: "vinculada", design: "carta", shirt: "ADRI", number: "10" }), shareWords({ state: "pendiente", design: "poster", shirt: "", number: "9" }), shareWords({ state: "sin-ficha", design: "poster", shirt: "", number: "" })];
    words.forEach((w) => expect(JSON.stringify(w)).not.toMatch(/@example|u1/));
    expect(words[0]).toEqual({ title: "ADRI · Manchester Piti", text: "Mi carta del Manchester Piti: ADRI, dorsal 10." });
  });
});

describe("el estudio en cada estado", () => {
  it("vinculada: Mi carta (frente o dorso) o el póster", () => {
    const c = studioCopy("vinculada", "carta");
    expect(c.title).toBe("Compartir mi carta");
    expect(c.lead).toBe("Elige diseño, formato y cara: se descarga tal cual la ves.");
    expect(c.designs.map((d) => [d.label, d.sub, d.disabled])).toEqual([
      ["Mi carta", "frente o dorso", false],
      ["¡Ya es oficial!", "tu fichaje", false],
    ]);
    expect(c.note).toBeNull();
    expect(c.tiny).toMatch(/^La imagen no lleva tu correo ni tu id/);
    expect(studioCopy("vinculada", "poster").tiny).toBe("El póster no lleva tu correo ni tu id: solo lo que ves.");
    expect(c.formats.map((f) => f.label + " " + f.sub)).toEqual(["Historia 9:16", "Post 4:5"]);
    expect(c.faces.map((f) => f.label + " " + f.sub)).toEqual(["Frente tu carta", "Dorso carné y QR"]);
  });
  it("pendiente y sin ficha: Mi carta desactivada («cuando tengas carta»), el póster y la nota", () => {
    expect(designFor("pendiente", "carta")).toBe("poster");
    const p = studioCopy("pendiente", "carta");
    expect(p.title).toBe("Compartir mi póster");
    expect(p.designs[0]).toMatchObject({ label: "Mi carta", sub: "cuando tengas carta", disabled: true });
    expect(p.designs[1].sub).toBe("en trámite");
    expect(p.note).toMatch(/«Fichaje en trámite»/);
    const s = studioCopy("sin-ficha", "poster");
    expect(s.designs[1].sub).toBe("nuevo socio");
    expect(s.lead).toBe("Tu cartel para redes. Hoy te presenta como nuevo socio; con tu ficha, «¡Ya es oficial!».");
    expect(s.note).toMatch(/nuevo socio/);
  });
  it("el póster dice el estado en palabras", () => {
    const base = { shirt: "ADRI", nick: "adrian_tc", number: "10", posLong: "Delantero", presented: "sep 2026", format: "historia" as const };
    const v = posterModel({ ...base, state: "vinculada" });
    expect(v).toMatchObject({ tone: "ok", l1: "¡YA ES", l2: "OFICIAL!", blank: false, print: "ADRI", num: "10", name: "ADRI", nmCls: "", line: "DORSAL 10 · DELANTERO", presented: "SEP 2026", long: false });
    expect(v.aria).toBe("Vista previa del póster (historia 9:16): ¡Ya es oficial! ADRI, dorsal 10, Delantero");
    const p = posterModel({ ...base, state: "pendiente", number: "9" });
    expect(p).toMatchObject({ tone: "warn", l1: "FICHAJE", l2: "EN TRÁMITE", long: true, blank: true, print: "", num: "9", name: "@ADRIAN_TC", nmCls: "m", line: "PIDE EL 9 · EN REVISIÓN" });
    const s = posterModel({ ...base, state: "sin-ficha", number: "", format: "post" });
    expect(s).toMatchObject({ tone: "off", l1: "NUEVO", l2: "SOCIO", blank: true, num: "?", line: "SIN DORSAL TODAVÍA" });
    expect(s.aria).toBe("Vista previa del póster (post 4:5): Nuevo socio: @adrian_tc, sin dorsal todavía");
    expect(posterModel({ ...base, state: "vinculada", shirt: "EGUZQUIZA ETX" }).nmCls).toBe("s");
  });
  it("lo que pone encima de la carta", () => {
    expect(cartaKicker("frente", false, "T1")).toBe("Mi carta · T1");
    expect(cartaKicker("frente", true, "T1")).toBe("En racha · T1");
    expect(cartaKicker("dorso", true, "T1")).toBe("Socio del club");
  });
});

describe("Compartir: archivo, enlace o portapapeles", () => {
  it("elige el camino según lo que acepta el navegador", () => {
    expect(sharePlan({}, file())).toBe("copy");
    expect(sharePlan({ share: async () => undefined }, file())).toBe("url");
    expect(sharePlan({ share: async () => undefined, canShare: () => false }, file())).toBe("url");
    expect(sharePlan({ share: async () => undefined, canShare: () => true }, file())).toBe("files");
    expect(sharePlan({ share: async () => undefined, canShare: () => true }, null)).toBe("url");
    expect(
      sharePlan(
        {
          share: async () => undefined,
          canShare: () => {
            throw new TypeError("no");
          },
        },
        file(),
      ),
    ).toBe("url");
  });

  it("con archivos: la imagen, el título, el texto y el enlace", async () => {
    const share = vi.fn(async () => undefined);
    const nav: ShareNav = { share, canShare: () => true };
    const f = file();
    const copy = vi.fn(async () => true);
    expect(await shareOut({ nav, file: f, link: "https://x/jugadores/adri", title: "T", text: "X", copy })).toBe("shared-file");
    expect(share).toHaveBeenCalledWith({ files: [f], title: "T", text: "X", url: "https://x/jugadores/adri" });
    expect(copy).not.toHaveBeenCalled();
  });

  it("sin archivos: solo el enlace", async () => {
    const share = vi.fn(async () => undefined);
    expect(await shareOut({ nav: { share }, file: file(), link: "L", title: "T", text: "X", copy: async () => true })).toBe("shared-link");
    expect(share).toHaveBeenCalledWith({ title: "T", text: "X", url: "L" });
  });

  it("cerrar el menú de compartir no es un error", async () => {
    const copy = vi.fn(async () => true);
    const nav: ShareNav = {
      share: async () => {
        throw abort();
      },
      canShare: () => true,
    };
    expect(await shareOut({ nav, file: file(), link: "L", title: "T", text: "X", copy })).toBe("cancelled");
    expect(copy).not.toHaveBeenCalled();
    expect(shareToast("cancelled", "files")).toBeNull();
  });

  it("si el menú falla, el enlace va al portapapeles; si tampoco, a mano", async () => {
    const nav: ShareNav = {
      share: async () => {
        throw Object.assign(new Error("no"), { name: "NotAllowedError" });
      },
    };
    expect(await shareOut({ nav, file: null, link: "L", title: "T", text: "X", copy: async () => true })).toBe("copied");
    expect(await shareOut({ nav, file: null, link: "L", title: "T", text: "X", copy: async () => false })).toBe("failed");
    expect(shareToast("copied", "url")).toBe("No se ha podido compartir: te hemos copiado el enlace");
  });

  it("sin Web Share: copia el enlace", async () => {
    const copy = vi.fn(async () => true);
    expect(await shareOut({ nav: {}, file: file(), link: "L", title: "T", text: "X", copy })).toBe("copied");
    expect(copy).toHaveBeenCalledWith("L");
    expect(shareToast("copied", "copy")).toBe("Este navegador no comparte imágenes: te hemos copiado el enlace");
    expect(shareToast("shared-file", "files")).toBe("Imagen enviada al menú de compartir");
  });
});
