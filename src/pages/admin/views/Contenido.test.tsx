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
const h = vi.hoisted(() => ({
  content: null as ClubContent | null,
  writes: { publishContent: vi.fn((content: unknown, stories: unknown) => Promise.resolve(void [content, stories])) },
}));
vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => String(e) }));
vi.mock("../club/useClubWrites", () => ({ useClubWrites: () => h.writes }));
vi.mock("../club/clubLive", () => ({ useLiveClubContent: () => ({ content: h.content, loaded: true }) }));

const row = (title: string) => screen.getByRole("button", { name: new RegExp(`^Editar ${title}`) });
const bar = () => document.querySelector<HTMLElement>(".pubbar")!;
const publishBtn = () => within(bar()).getByRole("button", { name: "Publicar contenido", hidden: true });

describe("Contenido del club", () => {
  beforeEach(() => {
    localStorage.clear();
    resetContentDraftsForTests();
    h.writes.publishContent.mockClear();
    h.content = clean;
    setAdminData(adminFixture());
  });
  afterEach(() => vi.useRealTimers());

  it("lists the sections with their state and what they hold", async () => {
    h.content = { ...clean, gallery: [...clean.gallery, { url: "http://i.imgur.com/piti-banquillo.jpg", caption: "" }] };
    mountAdmin("/admin/contenido", { contenido: Contenido });
    expect(await screen.findByRole("heading", { level: 1, name: "Contenido del club" })).toBeInTheDocument();
    expect(row("Frase, localidad y campo")).toHaveAccessibleName("Editar Frase, localidad y campo · Publicado");
    expect(row("Frase, localidad y campo")).toHaveTextContent("«El equipo más celeste de la liga» · Madrid · Polideportivo Norte");
    expect(row("Historias de jugadores")).toHaveTextContent("8 de 12 · faltan KEVIN, FER, ANDIA y BRAWAN");
    expect(row("Momentos del club")).toHaveTextContent("2 hitos · el último, «Primera victoria fuera»");
    expect(row("Galería")).toHaveAccessibleName("Editar Galería · Revisar");
    expect(row("Galería")).toHaveTextContent("2 fotos · 1 enlace no es HTTPS");
    expect(bar()).toHaveTextContent("Todo publicado");
    expect(bar()).toHaveTextContent("Para publicar, arregla: Galería: 1 enlace no es HTTPS");
    expect(publishBtn()).toHaveAttribute("aria-disabled", "true");
  });

  it("saves a section as a draft and publishes every draft at once, behind an undo toast", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mountAdmin("/admin/contenido", { contenido: Contenido });
    await user.click(await screen.findByRole("button", { name: /^Editar Frase, localidad y campo/ }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ seccion: "frase" }));
    const d = screen.getByRole("dialog", { name: "Frase, localidad y campo" });
    expect(within(d).getByText("✓ Igual que lo publicado")).toBeInTheDocument();
    expect(within(d).getByRole("button", { name: "Guardar borrador" })).toHaveAttribute("aria-disabled", "true");
    expect(publishBtn()).toHaveAttribute("aria-disabled", "true");
    const loc = within(d).getByRole("textbox", { name: "Localidad" });
    await user.clear(loc);
    await user.type(loc, "Getafe");
    expect(within(d).getByText("● Cambios sin guardar")).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Guardado en borrador · falta publicar.")).toBeInTheDocument();
    expect(row("Frase, localidad y campo")).toHaveAccessibleName("Editar Frase, localidad y campo · Sin publicar");
    expect(row("Frase, localidad y campo")).toHaveTextContent("Getafe");
    expect(bar()).toHaveTextContent("1 cambio sin publicar");
    expect(bar()).toHaveTextContent("Frase, localidad y campo");
    expect(localStorage.getItem("mp.admin.contentDrafts.v1:a1")).toContain("Getafe");

    // Deshacer: nothing is written, the draft is still there
    await user.click(publishBtn());
    expect(screen.getByText("Contenido publicado · ya sale en «El club» (Frase, localidad y campo).")).toBeInTheDocument();
    expect(row("Frase, localidad y campo")).toHaveAccessibleName("Editar Frase, localidad y campo · Publicado");
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(row("Frase, localidad y campo")).toHaveAccessibleName("Editar Frase, localidad y campo · Sin publicar");
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
    await waitFor(() => expect(localStorage.getItem("mp.admin.contentDrafts.v1:a1")).toBeNull());
  });

  it("checks every gallery link live, and a broken link blocks publishing until it is gone", async () => {
    const user = userEvent.setup();
    h.content = { ...clean, gallery: [...clean.gallery, { url: "http://i.imgur.com/piti-banquillo.jpg", caption: "" }] };
    mountAdmin("/admin/contenido?seccion=galeria", { contenido: Contenido });
    const d = await screen.findByRole("dialog", { name: "Galería" });
    const photos = within(within(d).getByRole("list", { name: "Fotos de la galería" })).getAllByRole("listitem");
    expect(photos[0]).toHaveTextContent("HTTPS · se ve en la web");
    expect(photos[1]).toHaveTextContent("No es HTTPS · no se verá en la web");
    const add = within(d).getByRole("textbox", { name: /Añadir foto/ });
    await user.type(add, "http://x.es/a.jpg");
    expect(within(d).getByText("Tiene que empezar por https://")).toBeInTheDocument();
    expect(within(d).getByRole("button", { name: "Añadir a la galería" })).toHaveAttribute("aria-disabled", "true");
    await user.clear(add);
    await user.type(add, "https://x.es/j7.jpg");
    expect(within(d).getByText("Enlace seguro · se puede añadir")).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Añadir a la galería" }));
    await user.click(within(d).getByRole("button", { name: "Quitar la foto 2" }));
    expect(within(within(d).getByRole("list", { name: "Fotos de la galería" })).getAllByRole("listitem").map((li) => li.querySelector("b")?.textContent)).toEqual([
      "https://firebasestorage.googleapis.com/j6.jpg",
      "https://x.es/j7.jpg",
    ]);
    await user.click(within(d).getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(row("Galería")).toHaveAccessibleName("Editar Galería · Sin publicar");
    expect(bar()).not.toHaveTextContent("Para publicar");
    expect(publishBtn()).toHaveAttribute("aria-disabled", "false");
  });

  it("adds, reorders and removes momentos", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/contenido?seccion=momentos", { contenido: Contenido });
    const d = await screen.findByRole("dialog", { name: "Momentos del club" });
    const list = () => within(within(d).getByRole("list", { name: "Momentos" })).getAllByRole("listitem");
    expect(within(d).getByRole("button", { name: "Añadir momento" })).toHaveAttribute("aria-disabled", "true");
    await user.type(within(d).getByRole("textbox", { name: "Fecha" }), "Nov 2026");
    await user.type(within(d).getByRole("textbox", { name: "Momento" }), "Primer doblete: ERIK");
    await user.click(within(d).getByRole("button", { name: "Añadir momento" }));
    expect(list()).toHaveLength(3);
    expect(list()[2]).toHaveTextContent("Primer doblete: ERIK● Sin publicar");
    expect(list()[0]).toHaveTextContent("✓ Publicado");
    await user.click(within(d).getByRole("button", { name: "Subir «Primer doblete: ERIK»" }));
    expect(list()[1]).toHaveTextContent("Primer doblete: ERIK");
    await user.click(within(d).getByRole("button", { name: "Editar «Primer partido de liga»" }));
    const title = within(d).getByRole("textbox", { name: "Momento" });
    expect(title).toHaveValue("Primer partido de liga");
    await user.clear(title);
    await user.type(title, "Primer partido");
    await user.click(within(d).getByRole("button", { name: "Guardar momento" }));
    expect(list()[0]).toHaveTextContent("Primer partido● Sin publicar");
    await user.click(within(d).getByRole("button", { name: "Quitar «Primera victoria fuera»" }));
    expect(list()).toHaveLength(2);
  });

  it("writes player stories (as drafts) and publishes them on the player docs", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mountAdmin("/admin/contenido?seccion=historias", { contenido: Contenido });
    const d = await screen.findByRole("dialog", { name: "Historias de jugadores" });
    expect(within(d).getByRole("combobox", { name: /^Jugador/ })).toHaveValue("kevin");
    expect(within(d).getByText("8 de 12 con historia")).toBeInTheDocument();
    await user.type(within(d).getByRole("textbox", { name: "Presentación" }), "El once del Piti.");
    await user.type(within(d).getByRole("textbox", { name: /Foto/ }), "http://x.es/k.jpg");
    expect(within(d).getByText("No es HTTPS · no se verá en la web")).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Guardado en borrador · 1 historia sin publicar.")).toBeInTheDocument();
    expect(row("Historias de jugadores")).toHaveAccessibleName("Editar Historias de jugadores · Revisar");
    expect(bar()).toHaveTextContent("Historias: la foto de KEVIN no es HTTPS");

    await user.click(row("Historias de jugadores"));
    const again = await screen.findByRole("dialog", { name: "Historias de jugadores" });
    // the next player without a story comes first; KEVIN keeps his draft
    expect(within(again).getByRole("combobox", { name: /^Jugador/ })).toHaveValue("fer");
    await user.selectOptions(within(again).getByRole("combobox", { name: /^Jugador/ }), "kevin");
    const photo = within(again).getByRole("textbox", { name: /Foto/ });
    expect(photo).toHaveValue("http://x.es/k.jpg");
    await user.clear(photo);
    await user.click(within(again).getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(row("Historias de jugadores")).toHaveTextContent("9 de 12 · faltan FER, ANDIA y BRAWAN");
    await user.click(publishBtn());
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    expect(h.writes.publishContent).toHaveBeenCalledWith(null, [{ id: "kevin", data: { bio: "El once del Piti.", quote: "", photoUrl: "" } }]);
  });

  it("guards unsaved edits, can save the draft on the way out, and discard it later (with undo)", async () => {
    const user = userEvent.setup();
    mountAdmin("/admin/contenido?seccion=escudo", { contenido: Contenido });
    const d = await screen.findByRole("dialog", { name: "Nuestra historia y el escudo" });
    await user.type(within(d).getByRole("textbox", { name: "La historia del escudo" }), "Lo dibujó Tello.");
    await user.keyboard("{Escape}");
    const guard = await screen.findByRole("alertdialog", { name: "¿Salir sin guardar?" });
    expect(guard).toHaveTextContent("Hay cambios sin guardar en «Nuestra historia y el escudo»");
    await user.click(within(guard).getByRole("button", { name: "Guardar borrador y salir" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(row("Nuestra historia y el escudo")).toHaveAccessibleName("Editar Nuestra historia y el escudo · Sin publicar");
    expect(row("Nuestra historia y el escudo")).toHaveTextContent("escudo: escrito");

    await user.click(row("Nuestra historia y el escudo"));
    const again = await screen.findByRole("dialog", { name: "Nuestra historia y el escudo" });
    expect(within(again).getByText(/● Borrador guardado a las \d\d:\d\d · sin publicar/)).toBeInTheDocument();
    await user.click(within(again).getByRole("button", { name: "Descartar borrador" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(row("Nuestra historia y el escudo")).toHaveAccessibleName("Editar Nuestra historia y el escudo · Publicado");
    expect(screen.getByText("Borrador de «Nuestra historia y el escudo» descartado · vuelve a lo publicado.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(row("Nuestra historia y el escudo")).toHaveAccessibleName("Editar Nuestra historia y el escudo · Sin publicar");
  });

  it("flags a draft whose section changed on the web meanwhile", async () => {
    localStorage.setItem("mp.admin.contentDrafts.v1:a1", JSON.stringify({ club: { frase: { value: { intro: "Mía", location: "Madrid", founded: "", venue: "Polideportivo Norte" }, base: { intro: "Antigua", location: "Madrid", founded: "", venue: "Polideportivo Norte" }, at: 1 } }, stories: {} }));
    mountAdmin("/admin/contenido", { contenido: Contenido });
    const r = await screen.findByRole("button", { name: /^Editar Frase, localidad y campo/ });
    expect(r).toHaveAccessibleName("Editar Frase, localidad y campo · Revisar");
    expect(r).toHaveTextContent("ha cambiado en la web desde tu borrador");
    expect(bar()).toHaveTextContent("1 cambio sin publicar");
  });
});
