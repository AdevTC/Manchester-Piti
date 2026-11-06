import { describe, expect, it } from "vitest";
import { withEmails } from "./memberEmails";
import { planEmailMove } from "../../functions/src/memberEmailsLogic";

const person = (uid: string, email = "") => ({ uid, nickname: uid, email });

describe("withEmails (Socios, Capitanes, la puerta)", () => {
  it("pone el correo de memberEmails a cada socio", () => {
    const people = [person("a"), person("b")];
    expect(withEmails(people, [{ uid: "a", email: "a@x.es" }]).map((p) => p.email)).toEqual(["a@x.es", ""]);
  });
  it("un perfil sin migrar conserva su copia; memberEmails manda si hay las dos", () => {
    const people = [person("a", "viejo@x.es"), person("b", "b@x.es")];
    expect(withEmails(people, [{ uid: "a", email: "nuevo@x.es" }]).map((p) => p.email)).toEqual(["nuevo@x.es", "b@x.es"]);
  });
  it("sin correos (aún cargando, o sin permiso) devuelve la misma lista", () => {
    const people = [person("a", "a@x.es")];
    expect(withEmails(people, [])).toBe(people);
    // a blank email never hides the profile's copy
    expect(withEmails(people, [{ uid: "a", email: "" }])[0]).toBe(people[0]);
  });
});

describe("planEmailMove (functions/scripts/migrate-member-emails.mjs)", () => {
  it("un perfil con correo: se copia a memberEmails y se quita del perfil", () => {
    expect(planEmailMove({ email: "a@x.es" }, undefined)).toEqual({ copy: "a@x.es", strip: true });
  });
  it("ya hay correo en memberEmails (la puerta lo escribió): no se pisa, solo se quita del perfil", () => {
    expect(planEmailMove({ email: "viejo@x.es" }, "nuevo@x.es")).toEqual({ copy: null, strip: true });
  });
  it("un correo vacío o raro: solo se quita", () => {
    expect(planEmailMove({ email: "" }, undefined)).toEqual({ copy: null, strip: true });
    expect(planEmailMove({ email: "   " }, undefined)).toEqual({ copy: null, strip: true });
    expect(planEmailMove({ email: 42 }, undefined)).toEqual({ copy: null, strip: true });
  });
  it("un perfil ya migrado (sin el campo) no se toca", () => {
    expect(planEmailMove({ nickname: "a" }, "a@x.es")).toBeNull();
    expect(planEmailMove({}, undefined)).toBeNull();
  });
});
