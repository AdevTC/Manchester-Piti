import { describe, expect, it } from "vitest";
import { notaBand, notaText } from "./semaforo";

describe("semáforo de la nota", () => {
  it("cada rango tiene su banda y su palabra, con la nota redondeada a una cifra como se lee", () => {
    expect(notaBand(9).k).toBe("s9");
    expect(notaBand(8.96).k).toBe("s9");
    expect(notaBand(8.94)).toEqual({ k: "s8", word: "Muy buena" });
    expect(notaBand(7).k).toBe("s7");
    expect(notaBand(6.95).k).toBe("s7");
    expect(notaBand(6.5)).toEqual({ k: "s65", word: "Normal" });
    expect(notaBand(6.45).k).toBe("s65");
    expect(notaBand(6.44).k).toBe("s6");
    expect(notaBand(6)).toEqual({ k: "s6", word: "Floja" });
    expect(notaBand(5.9)).toEqual({ k: "s5", word: "Baja" });
    expect(notaBand(0).k).toBe("s5");
  });

  it("sin nota no hay banda", () => {
    expect(notaBand(null)).toEqual({ k: "no", word: "Sin nota" });
    expect(notaBand(undefined).k).toBe("no");
    expect(notaBand(Number.NaN).k).toBe("no");
  });

  it("se escribe con coma y una cifra, y una raya sin nota", () => {
    expect(notaText(7.44)).toBe("7,4");
    expect(notaText(10)).toBe("10,0");
    expect(notaText(6.45)).toBe("6,5");
    expect(notaText(null)).toBe("—");
  });
});
