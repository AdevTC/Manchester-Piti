import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONTENT, type ClubContent } from "../../../lib/clubContentDefaults";
import { adminFixture, mountAdmin, setAdminData } from "../../../test/adminKit";
import { resetContentDraftsForTests } from "../club/contentDraftStore";
import { Contenido } from "./Contenido";

const clean: ClubContent = {
  ...DEFAULT_CONTENT,
  intro: "El equipo más celeste de la liga",
  location: "Madrid",
  venue: "Polideportivo Norte",
  email: "club@piti.es",
  milestones: [
    { year: "Sep 2026", title: "Primer partido de liga", text: "" },
    { year: "Oct 2026", title: "Primera victoria fuera", text: "" },
  ],
  gallery: [{ url: "https://firebasestorage.googleapis.com/j6.jpg", caption: "J6" }],
};
const withBadLink: ClubContent = { ...clean, gallery: [...clean.gallery, { url: "http://i.imgur.com/piti-banquillo.jpg", caption: "" }] };
const h = vi.hoisted(() => ({
  content: null as ClubContent | null,
  writes: { publishContent: vi.fn((content: unknown, stories: unknown) => Promise.resolve(void [content, stories])) },
}));
vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => String(e) }));
vi.mock("../club/useClubWrites", () => ({ useClubWrites: () => h.writes }));
vi.mock("../club/clubLive", () => ({ useLiveClubContent: () => ({ content: h.content, loaded: true }) }));

const WIDTH = window.innerWidth;
const KEY = "mp.admin.contentDrafts.v1:a1";
const entry = (no: string) => screen.getByRole("button", { name: new RegExp(`^${no} `) });
const bar = () => document.querySelector<HTMLElement>(".pbar")!;
const publishBtn = () => within(bar()).getByRole("button", { name: "Publicar contenido" });
const editor = (name: string) => screen.findByRole("dialog", { name });

describe("Contenido · el programa del club", () => {
  beforeEach(() => {
    localStorage.clear();
    resetContentDraftsForTests();
    h.writes.publishContent.mockClear();
    h.content = clean;
    setAdminData(adminFixture());
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH });
  });

  it("is a cover and a numbered index 01–06 with where each shows, marking only the exceptions", async () => {
    h.content = withBadLink;
    mountAdmin("/admin/contenido", { contenido: Contenido });
    expect(await screen.findByRole("heading", { level: 1, name: "Contenido" })).toBeInTheDocument();
    expect(document.querySelector(".cover")).toHaveTextContent("PROGRAMA DEL CLUB · T1");
    expect(document.querySelector(".cover")).toHaveTextContent("Edición de noviembre");
    const list = within(screen.getByRole("list", { name: "Programa del club" })).getAllByRole("button");
    expect(list.map((b) => b.getAttribute("aria-label"))).toEqual([
      "01 Frase, historia y campo",
      "02 Contacto, redes y foto de equipo",
      "03 Momentos del club",
      "04 Historias de jugadores",
      "05 Preguntas de vestuario",
      "06 Galería y colaboradores · Revisar",
    ]);
    expect(entry("01")).toHaveAccessibleDescription(/^«El equipo más celeste de la liga» · Madrid · Polideportivo Norte · falta la historia del escudo$/);
    expect(entry("01")).toHaveTextContent("→ El club · portada e historia");
    expect(entry("03")).toHaveAccessibleDescription("2 hitos · el último, «Primera victoria fuera»");
    expect(entry("04")).toHaveAccessibleDescription("8 de 12 perfiles con historia · faltan KEVIN, FER, ANDIA y BRAWAN");
    expect(entry("06")).toHaveAccessibleDescription("2 fotos · 0 colaboradores · 1 enlace no es HTTPS");
    expect(entry("06").querySelector(".tag.rd")).toHaveTextContent("Revisar");
    expect(entry("01").querySelector(".tag")).toBeNull();
    expect(bar()).toHaveTextContent("Todo publicado");
    expect(bar()).toHaveTextContent("Revisa: Galería: 1 enlace no es HTTPS");
    expect(publishBtn()).toHaveAttribute("aria-disabled", "true");
  });

  it("saves as it is written and publishes every draft at once, behind a lower third with «Deshacer»", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mountAdmin("/admin/contenido", { contenido: Contenido });
    await user.click(await screen.findByRole("button", { name: /^01 Frase/ }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ seccion: "frase" }));
    const d = await editor("Frase, historia y campo");
    expect(d).toHaveTextContent("Se ve en: El club · portada e historia");
    expect(d).toHaveTextContent("Se guarda como borrador al escribir");
    expect(document.querySelector(".cover")).toBeNull();
    expect(entry("01")).toHaveAttribute("aria-current", "true");
    expect(within(d).queryByRole("button", { name: "Descartar borrador" })).toBeNull();
    const loc = within(d).getByRole("textbox", { name: "Localidad" });
    await user.clear(loc);
    await user.type(loc, "Getafe");
    // saved at once: the entry is marked, the bar counts it, the draft is on this device
    expect(entry("01")).toHaveAccessibleName("01 Frase, historia y campo · Sin publicar");
    expect(entry("01")).toHaveAccessibleDescription(/Getafe/);
    expect(bar()).toHaveTextContent("1 cambio sin publicar");
    expect(bar()).toHaveTextContent("Frase, historia y campo");
    expect(localStorage.getItem(KEY)).toContain("Getafe");
    expect(within(d).getByRole("button", { name: "Descartar borrador" })).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.state.location.search).not.toHaveProperty("seccion");

    // Deshacer: nothing is written, the draft is still there
    await user.click(publishBtn());
    expect(screen.getByText("Contenido publicado · la web ya lo enseña")).toBeInTheDocument();
    expect(screen.getByText("WEB")).toBeInTheDocument();
    expect(entry("01")).toHaveAccessibleName("01 Frase, historia y campo");
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(entry("01")).toHaveAccessibleName("01 Frase, historia y campo · Sin publicar");
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(h.writes.publishContent).not.toHaveBeenCalled();

    await user.click(publishBtn());
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.publishContent).toHaveBeenCalledTimes(1);
    const [content, stories] = h.writes.publishContent.mock.calls[0];
    expect(content).toEqual({ ...clean, location: "Getafe" });
    expect(stories).toEqual([]);
    await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
  });

  it("checks every gallery link live; a broken link in what is about to be published stops it", async () => {
    const user = userEvent.setup();
    h.content = withBadLink;
    mountAdmin("/admin/contenido?seccion=galeria", { contenido: Contenido });
    const d = await editor("Galería y colaboradores");
    const photos = () => within(within(d).getByRole("list", { name: "Fotos de la galería" })).getAllByRole("listitem");
    expect(photos()[0]).toHaveTextContent("HTTPS");
    expect(photos()[1]).toHaveTextContent("No es HTTPS");
    const add = within(d).getByRole("textbox", { name: "Añadir foto (HTTPS)" });
    await user.type(add, "http://x.es/a.jpg");
    expect(within(d).getByText("Tiene que empezar por https://")).toBeInTheDocument();
    expect(within(d).getByRole("button", { name: "Añadir" })).toHaveAttribute("aria-disabled", "true");
    await user.clear(add);
    await user.type(add, "https://x.es/j7.jpg");
    await user.click(within(d).getByRole("button", { name: "Añadir" }));
    expect(photos()).toHaveLength(3);
    // the gallery is about to be published with a broken link: publishing waits
    expect(entry("06")).toHaveAccessibleName("06 Galería y colaboradores · Sin publicar · Revisar");
    expect(bar()).toHaveTextContent("para publicar, arregla: Galería: 1 enlace no es HTTPS");
    expect(publishBtn()).toHaveAttribute("aria-disabled", "true");
    await user.click(publishBtn());
    expect(screen.getByText("Antes de publicar: Galería: 1 enlace no es HTTPS")).toBeInTheDocument();
    expect(h.writes.publishContent).not.toHaveBeenCalled();

    await user.click(within(d).getByRole("button", { name: "Quitar la foto 2" }));
    expect(photos().map((li) => li.firstElementChild?.textContent)).toEqual(["https://firebasestorage.googleapis.com/j6.jpg", "https://x.es/j7.jpg"]);
    expect(entry("06")).toHaveAccessibleName("06 Galería y colaboradores · Sin publicar");
    expect(bar()).not.toHaveTextContent("para publicar");
    expect(publishBtn()).toHaveAttribute("aria-disabled", "false");
  });

  it("adds momentos (the new ones in amber, dated this month), edits and removes them", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/contenido?seccion=momentos", { contenido: Contenido });
    const d = await editor("Momentos del club");
    const list = () => within(within(d).getByRole("list", { name: "Momentos" })).getAllByRole("listitem");
    expect(within(d).getByRole("button", { name: "Añadir" })).toHaveAttribute("aria-disabled", "true");
    expect(within(d).getByRole("textbox", { name: "Fecha" })).toHaveValue("Nov 2026");
    await user.type(within(d).getByRole("textbox", { name: "Nuevo momento" }), "Primer doblete: ERIK{Enter}");
    expect(list()).toHaveLength(3);
    expect(list()[2]).toHaveClass("dr");
    expect(list()[2]).toHaveTextContent("Nov 2026Primer doblete: ERIKSin publicar");
    expect(list()[0]).not.toHaveClass("dr");
    expect(entry("03")).toHaveAccessibleDescription("3 hitos · «Primer doblete: ERIK» sin publicar");

    await user.click(within(d).getByRole("button", { name: "Editar «Primer partido de liga»" }));
    const title = within(d).getByRole("textbox", { name: "Momento" });
    expect(title).toHaveValue("Primer partido de liga");
    await user.clear(title);
    await user.type(title, "Primer partido");
    await user.click(within(d).getByRole("button", { name: "Guardar" }));
    expect(list()[0]).toHaveTextContent("Primer partidoSin publicar");
    await user.click(within(d).getByRole("button", { name: "Quitar «Primera victoria fuera»" }));
    expect(list()).toHaveLength(2);
  });

  it("writes player stories as drafts and publishes them on the player docs", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/contenido?seccion=historias", { contenido: Contenido });
    const d = await editor("Historias de jugadores");
    const players = within(within(d).getByRole("group", { name: "Jugadores" })).getAllByRole("button");
    expect(players).toHaveLength(12);
    expect(within(d).getByRole("button", { name: "11 KEVIN · falta" })).toHaveAttribute("aria-current", "true");
    expect(within(d).getByRole("button", { name: "1 EVANS ✓" })).toHaveClass("ok");
    await user.type(within(d).getByRole("textbox", { name: "Presentación" }), "El once del Piti.");
    await user.type(within(d).getByRole("textbox", { name: "Foto de KEVIN (HTTPS)" }), "http://x.es/k.jpg");
    expect(within(d).getByText("No es HTTPS · no se verá en la web")).toBeInTheDocument();
    expect(within(d).getByRole("button", { name: "11 KEVIN ✓ ●" })).toBeInTheDocument();
    expect(entry("04")).toHaveAccessibleName("04 Historias de jugadores · Sin publicar · Revisar");
    expect(bar()).toHaveTextContent("para publicar, arregla: Historias: la foto de KEVIN no es HTTPS");

    await user.clear(within(d).getByRole("textbox", { name: "Foto de KEVIN (HTTPS)" }));
    expect(entry("04")).toHaveAccessibleName("04 Historias de jugadores · Sin publicar");
    expect(entry("04")).toHaveAccessibleDescription("9 de 12 perfiles con historia · faltan FER, ANDIA y BRAWAN");
    await user.click(publishBtn());
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.publishContent).toHaveBeenCalledWith(null, [{ id: "kevin", data: { bio: "El once del Piti.", quote: "", photoUrl: "" } }]);
  });

  it("Esc keeps what was written; «Descartar borrador» goes back to the web (with «Deshacer»)", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/contenido?seccion=escudo", { contenido: Contenido });
    let d = await editor("Frase, historia y campo");
    await user.type(within(d).getByRole("textbox", { name: "La historia del escudo" }), "Lo dibujó Tello.");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(entry("01")).toHaveAccessibleName("01 Frase, historia y campo · Sin publicar");
    expect(entry("01")).not.toHaveAccessibleDescription(/falta la historia del escudo/);

    await user.click(entry("01"));
    d = await editor("Frase, historia y campo");
    expect(within(d).getByRole("textbox", { name: "La historia del escudo" })).toHaveValue("Lo dibujó Tello.");
    await user.click(within(d).getByRole("button", { name: "Descartar borrador" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(entry("01")).toHaveAccessibleName("01 Frase, historia y campo");
    expect(screen.getByText("Borrador de «Frase, historia y campo» descartado · vuelve a lo publicado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(entry("01")).toHaveAccessibleName("01 Frase, historia y campo · Sin publicar");
  });

  it("flags a draft whose section changed on the web meanwhile", async () => {
    localStorage.setItem(KEY, JSON.stringify({ club: { frase: { value: { intro: "Mía", location: "Madrid", founded: "", venue: "Polideportivo Norte" }, base: { intro: "Antigua", location: "Madrid", founded: "", venue: "Polideportivo Norte" }, at: 1 } }, stories: {} }));
    mountAdmin("/admin/contenido", { contenido: Contenido });
    const r = await screen.findByRole("button", { name: /^01 / });
    expect(r).toHaveAccessibleName("01 Frase, historia y campo · Sin publicar · Revisar");
    expect(r).toHaveAccessibleDescription(/ha cambiado en la web desde tu borrador$/);
    expect(bar()).toHaveTextContent("1 cambio sin publicar");
  });

  it("on a phone: no cover, and the editor is a sheet over the index", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    mountAdmin("/admin/contenido?seccion=contacto", { contenido: Contenido });
    const d = await editor("Contacto, redes y foto de equipo");
    expect(d).toHaveAttribute("aria-modal", "true");
    expect(document.querySelector(".cover")).toBeNull();
    expect(within(d).getByRole("textbox", { name: "Correo" })).toHaveValue("club@piti.es");
    expect(within(d).getByText("Correo válido")).toBeInTheDocument();
  });
});
