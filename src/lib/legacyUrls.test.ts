import { describe, expect, it } from "vitest";
import { legacyHref } from "./legacyUrls";

// Every old address of the Vidrio boards' «Redirecciones» (IN, PA, P, NU, CL, PL, TU Main): its new one,
// with its parameters. The router redirects with this table in the browser (replace), the server render
// answers 308 with it.
const moves = (from: string, to: string) => it(`${from} → ${to}`, () => expect(legacyHref(from)).toBe(to));

describe("Inicio: the home's old places", () => {
  moves("/#hoy", "/");
  moves("/#temporada", "/estadisticas");
  moves("/#club", "/club");
  moves("/#tu", "/hoy/lo-tuyo");
  moves("/#t%C3%BA", "/hoy/lo-tuyo");
  moves("/?lugar=temporada", "/");
  moves("/?lugar=club&season=t1", "/?season=t1");
  it("the home itself, and a hash that is no place (the skip link), stay", () => {
    expect(legacyHref("/")).toBeNull();
    expect(legacyHref("/#contenido")).toBeNull();
    expect(legacyHref("/?min=36")).toBeNull();
  });
});

describe("the match: /matches → /partidos", () => {
  moves("/matches", "/partidos");
  moves("/matches/j1", "/partidos/j1");
  moves("/matches/j1/", "/partidos/j1");
  moves("/matches/j1?tab=cronica", "/partidos/j1");
  moves("/matches/j1?tab=pulso", "/partidos/j1");
  moves("/matches/j1?tab=campo", "/partidos/j1/siete");
  moves("/matches/j1?tab=estadisticas", "/partidos/j1/numeros");
  moves("/matches/j1?tab=vestuario", "/partidos/j1/vestuario");
  moves("/matches/j1/mesa", "/partidos/j1/mesa");
  moves("/matches/j1/mesa?vista=cronica", "/partidos/j1/mesa?vista=cronica");
  moves("/admin/en-juego/j1", "/partidos/j1/mesa");
  moves("/matches/AbC_12-x?tab=estadisticas&analysis=catalog&metric=070&season=t1", "/partidos/AbC_12-x/numeros?analysis=catalog&metric=070&season=t1");
  moves("/matches/j1?tab=vestuario#vx-mvp", "/partidos/j1/vestuario#vx-mvp");
  // (an old ?tab= that reached the new address: a link written before the screens)
  moves("/partidos/j1?tab=campo", "/partidos/j1/siete");
  // (Números was the section's name: every /numeros screen moves to the same one under /estadisticas)
  moves("/numeros", "/estadisticas");
  moves("/numeros/", "/estadisticas");
  moves("/numeros/campo/puestos?temporada=t1", "/estadisticas/campo/puestos?temporada=t1");
  moves("/numeros/juego/catalogo?partidos=m1&metrica=070", "/estadisticas/juego/catalogo?partidos=m1&metrica=070");
  moves("/numeros/jugadores?view=minutes", "/estadisticas/jugadores?ranking=minutos&ver=todo");
  it("the new addresses stay", () => {
    for (const href of ["/partidos/j1", "/partidos/j1/siete", "/partidos/j1/mesa", "/partidos/j1?min=21", "/partidos/j1?hoja=cartel"]) expect(legacyHref(href), href).toBeNull();
  });
  it("«tabla» and «balance» are Partidos' screens, never a match", () => {
    expect(legacyHref("/partidos/tabla?tab=campo")).toBeNull();
  });
});

describe("Partidos: the old ?view=", () => {
  moves("/partidos?view=tabla", "/partidos/tabla");
  moves("/partidos?view=numeros", "/partidos/balance");
  moves("/partidos?view=tabla&temporada=t0", "/partidos/tabla?temporada=t0");
  it("Jornadas and its parameters stay", () => {
    expect(legacyHref("/partidos")).toBeNull();
    expect(legacyHref("/partidos?view=otra")).toBeNull();
    expect(legacyHref("/partidos?jornada=2&lente=previa")).toBeNull();
  });
});

describe("Números: /stats and its English parameters", () => {
  moves("/stats", "/estadisticas");
  moves("/stats?view=summary", "/estadisticas");
  moves("/stats?view=players", "/estadisticas/jugadores");
  moves("/stats?view=minutes", "/estadisticas/jugadores?ranking=minutos&ver=todo");
  moves("/stats?view=positions&season=t1", "/estadisticas/campo/puestos?temporada=t1");
  moves("/stats?view=rivals", "/estadisticas/rivales");
  moves("/stats?view=compare&a=alcides&b=erik", "/plantilla/cara-a-cara?a=alcides&b=erik");
  moves("/stats?tab=compare", "/plantilla/cara-a-cara");
  moves("/stats?view=compare&a=alcides&season=t1", "/plantilla/cara-a-cara?a=alcides&season=t1");
  moves("/stats?view=explore", "/estadisticas/records/marcas");
  moves("/stats?view=explore&section=individual", "/estadisticas/records/marcas");
  moves("/stats?view=explore&section=streaks", "/estadisticas/records");
  moves("/stats?view=explore&section=team", "/estadisticas/records/marcas");
  moves("/stats?view=explore&section=evolution", "/estadisticas/records/evolucion");
  moves("/stats?view=game", "/estadisticas/juego");
  moves("/stats?view=game&analysis=catalog", "/estadisticas/juego/catalogo");
  moves(
    "/stats?view=game&analysis=catalog&family=pase&metric=070&q=centro&excluded=true&team=opponent&period=2",
    "/estadisticas/juego/catalogo?familia=pase&metrica=070&q=centro&equipo=rival&parte=2&fuera-del-audio=1",
  );
  moves("/stats?season=all", "/estadisticas?temporada=todas");
  moves("/stats?seasons=a,b", "/estadisticas?temporada=a%2Cb");
  // (the router writes lists as JSON: both forms read the same)
  moves(`/stats?view=game&matches=${encodeURIComponent('["m1","m2"]')}&players=${encodeURIComponent('["alcides"]')}`, "/estadisticas/juego?partidos=m1%2Cm2&jugadores=alcides");
  moves("/stats?view=players&utm_source=wa", "/estadisticas/jugadores?utm_source=wa");
  // (today's page still writes ?view= on its own screens until Números lands: only the screen moves)
  moves("/estadisticas/jugadores?view=game&family=pase", "/estadisticas/juego?family=pase");
  moves("/estadisticas?view=compare&a=x", "/plantilla/cara-a-cara?a=x");
  moves("/estadisticas/jugadores?view=minutes", "/estadisticas/jugadores?ranking=minutos&ver=todo");
  it("the new addresses stay", () => {
    for (const href of ["/estadisticas", "/estadisticas/campo/puestos?temporada=temporada-1", "/estadisticas/juego?partidos=m1&temporada=todas"]) expect(legacyHref(href), href).toBeNull();
  });
});

describe("Plantilla", () => {
  moves("/jugadores", "/plantilla");
  moves("/plantilla#sq-cara", "/plantilla/cara-a-cara");
  moves("/plantilla/pichichi", "/plantilla");
  moves("/jugadores/alcides/posiciones", "/jugadores/alcides/juego");
  it("a player, his sections and ?season= stay", () => {
    for (const href of ["/jugadores/alcides", "/jugadores/alcides?season=t1", "/jugadores/alcides/cromo", "/plantilla?kit=2&orden=posicion"]) expect(legacyHref(href), href).toBeNull();
  });
});

describe("El club: the old anchors", () => {
  moves("/club#cl-trophies", "/club/vitrina");
  moves("/club#cl-crest", "/club/vitrina/escudo");
  moves("/club#cl-kits", "/club/equipo");
  moves("/club#cl-ground", "/club/equipo");
  moves("/club#cl-history", "/club/historia");
  moves("/club#cl-story", "/club/historia");
  moves("/club#cl-gallery", "/club/historia");
  moves("/club#cl-nums", "/plantilla");
  moves("/club#cl-pos", "/plantilla");
  moves("/club#cl-faq", "/club/gente");
  moves("/club#cl-contact", "/club/gente");
  moves("/club#cl-sponsors", "/club/gente");
  it("the club and an unknown anchor stay", () => {
    expect(legacyHref("/club")).toBeNull();
    expect(legacyHref("/club#otra")).toBeNull();
  });
});

describe("El vestuario: the old anchors", () => {
  moves("/vestuario#vx-caja", "/vestuario/caja");
  moves("/vestuario#encuestas", "/vestuario/encuestas");
  moves("/vestuario#vx-ausencias", "/vestuario/ausencias");
  moves("/vestuario#vx-train", "/vestuario/entrenos");
  moves("/vestuario#vx-board", "/vestuario/tablon");
  moves("/vestuario#puerta", "/vestuario/puerta");
  moves("/vestuario#vx-ficha", "/vestuario/ficha");
  it("«¿Vas?» (#vx-rsvp) is the vestuario's own first block: its anchor stays", () => {
    expect(legacyHref("/vestuario#vx-rsvp")).toBeNull();
  });
  it("a notice's answer stays as it is (?rsvp=…&m=…&n=…)", () => {
    expect(legacyHref("/vestuario?rsvp=yes&m=m8&n=3f2b8c1e-9a4d")).toBeNull();
  });
  it("#vx-mvp waits for the matches (components/InterimLanding)", () => {
    expect(legacyHref("/vestuario#vx-mvp")).toBeNull();
  });
});

describe("Tú: /profile and its tabs", () => {
  moves("/profile", "/perfil");
  moves("/profile#carta", "/perfil");
  moves("/profile#temporada", "/perfil/temporada");
  moves("/profile#cromos", "/perfil/temporada/cromos");
  moves("/profile#avisos", "/avisos/a-medida");
  moves("/profile#ajustes", "/perfil/ajustes");
  moves("/profile#cuenta", "/perfil/cuenta");
  moves("/profile#capitania", "/perfil/capitania");
  moves("/profile#pe-nombre", "/perfil/nombre");
  moves("/profile#pe-posiciones", "/perfil/posiciones");
  moves("/profile#pe-pick", "/perfil");
  moves("/profile#pe-ficha", "/perfil");
  // (the server's 301 keeps the hash: /profile#ajustes reaches the browser as /perfil#ajustes)
  moves("/perfil#ajustes", "/perfil/ajustes");
  moves("/perfil/temporada#cuenta", "/perfil/cuenta");
  moves("/avisos/a-medida#ajustes", "/perfil/ajustes");
  it("the new addresses stay", () => {
    for (const href of ["/perfil", "/perfil/temporada/cromos", "/avisos", "/avisos?ver=sin-leer", "/avisos/a-medida", "/buscar?q=kevin"]) expect(legacyHref(href), href).toBeNull();
  });
});

describe("no new address is itself old", () => {
  const OLD = ["/#temporada", "/matches/j1?tab=campo", "/stats?view=explore&section=evolution", "/stats?view=compare&a=x", "/club#cl-kits", "/vestuario#vx-caja", "/profile#cromos", "/partidos?view=numeros"];
  it.each(OLD)("%s lands in one step", (from) => {
    const to = legacyHref(from);
    expect(to).not.toBeNull();
    expect(legacyHref(to ?? "")).toBeNull();
  });
});
