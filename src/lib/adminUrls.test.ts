import { describe, expect, it } from "vitest";
import { legacyHref } from "./legacyUrls";

// DIRECTION.md § Redirecciones (r12): every old address of the Sala de control → its new one, the season kept.
const moves = (from: string, to: string) => it(`${from} → ${to}`, () => expect(legacyHref(from)).toBe(to));

describe("the Sala de control's old addresses", () => {
  describe("/admin?tab= (the v1 single page)", () => {
    moves("/admin?tab=matches", "/admin/partidos");
    moves("/admin?tab=roster", "/admin/plantilla");
    moves("/admin?tab=seasons", "/admin/club/temporadas");
    moves("/admin?tab=admins", "/admin/plantilla/capitanes");
    moves("/admin?tab=otra", "/admin");
    moves("/admin?tab=matches&season=t1", "/admin/partidos?season=t1");
  });
  describe("Partidos and the match", () => {
    moves("/admin/partidos?nuevo=true", "/admin/partidos/nuevo");
    moves("/admin/partidos?nuevo=true&season=t1", "/admin/partidos/nuevo?season=t1");
    moves("/admin/partidos/m1?tab=encuentro", "/admin/partidos/m1/datos");
    moves("/admin/partidos/m1?tab=convocatoria", "/admin/partidos/m1/convocatoria");
    moves("/admin/partidos/m1?tab=acta", "/admin/partidos/m1/acta");
    moves("/admin/partidos/m1?tab=publicar", "/admin/partidos/m1/publicar");
    moves("/admin/partidos/m1?vitrina=true", "/admin/partidos/m1/despues");
    moves("/admin/partidos/m1?tab=acta&vitrina=true", "/admin/partidos/m1/despues");
    moves("/admin/partidos/m1?tab=acta&season=t1", "/admin/partidos/m1/acta?season=t1");
    // without a known tab: the station of its moment (the match's own address)
    moves("/admin/partidos/m1?tab=otra", "/admin/partidos/m1");
    moves("/admin/partidos/m1?tab=acta&nuevo=true", "/admin/partidos/nuevo");
    moves("/admin/en-juego/m1", "/partidos/m1/mesa");
  });
  describe("Convocar is the match's first station", () => {
    moves("/admin/convocar?j=m1", "/admin/partidos/m1/convocatoria");
    moves("/admin/convocar", "/admin/partidos/proximo/convocatoria");
    moves("/admin/convocatorias?j=m1", "/admin/partidos/m1/convocatoria");
    moves("/admin/convocar?j=m1&season=t1", "/admin/partidos/m1/convocatoria?season=t1");
  });
  describe("Plantilla", () => {
    moves("/admin/plantilla?jugador=p1", "/admin/plantilla/p1");
    moves("/admin/plantilla?jugador=11", "/admin/plantilla/11");
    moves("/admin/plantilla?nuevo=true", "/admin/plantilla/alta");
    moves("/admin/plantilla?nuevo=true&dorsal=12", "/admin/plantilla/alta?dorsal=12");
    moves("/admin/plantilla?vista=cromos", "/admin/plantilla/cromos");
    moves("/admin/plantilla?jugador=p1&season=t1", "/admin/plantilla/p1?season=t1");
    moves("/admin/fichas", "/admin/plantilla/socios?ver=fichas");
    moves("/admin/fichas?season=t1", "/admin/plantilla/socios?season=t1&ver=fichas");
    moves("/admin/capitanes", "/admin/plantilla/capitanes");
  });
  describe("Caja and Club", () => {
    moves("/admin/caja?coste=m1", "/admin/caja/coste/m1");
    moves("/admin/caja?coste=m1&season=t1", "/admin/caja/coste/m1?season=t1");
    moves("/admin/temporadas", "/admin/club/temporadas");
    moves("/admin/clasificacion?season=t1", "/admin/club/clasificacion?season=t1");
    moves("/admin/turnos", "/admin/club/turnos");
    moves("/admin/contenido", "/admin/club/web");
    moves("/admin/contenido?seccion=escudo", "/admin/club/web/historia");
    moves("/admin/contenido?seccion=foto", "/admin/club/web/contacto");
    moves("/admin/contenido?seccion=momentos", "/admin/club/web/momentos");
    moves("/admin/contenido?seccion=galeria&season=t1", "/admin/club/web/galeria?season=t1");
    moves("/admin/contenido?seccion=nada", "/admin/club/web");
  });
  it("leaves the new addresses alone", () => {
    for (const href of [
      "/admin",
      "/admin?season=t1",
      "/admin/partidos",
      "/admin/partidos/nuevo",
      "/admin/partidos/archivados",
      "/admin/partidos/m1",
      "/admin/partidos/m1/acta/narracion",
      "/admin/plantilla",
      "/admin/plantilla/p1",
      "/admin/plantilla/alta?dorsal=12",
      "/admin/plantilla/socios?ver=fichas",
      "/admin/caja",
      "/admin/caja/coste/m1",
      "/admin/club",
      "/admin/club/web/historia",
      "/admin/no-existe",
    ])
      expect(legacyHref(href), href).toBeNull();
  });
  it("every move lands on an address that does not move again", () => {
    for (const from of ["/admin?tab=matches", "/admin/convocar", "/admin/plantilla?nuevo=true&dorsal=3", "/admin/fichas", "/admin/contenido?seccion=foto", "/admin/partidos/m1?vitrina=true"]) {
      const to = legacyHref(from);
      expect(to, from).not.toBeNull();
      expect(legacyHref(to ?? ""), to ?? "").toBeNull();
    }
  });
});
