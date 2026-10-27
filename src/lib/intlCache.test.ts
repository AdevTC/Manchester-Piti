import { describe, expect, it } from "vitest";
import { dateFormat, numberFormat } from "./intlCache";

describe("the formatters' cache", () => {
  it("gives one formatter per locale and options, formatting as a new one would", () => {
    const o: Intl.DateTimeFormatOptions = { timeZone: "Europe/Madrid", day: "numeric", month: "long" };
    const f = dateFormat("es-ES", o);
    expect(dateFormat("es-ES", { ...o })).toBe(f);
    expect(f.format(Date.UTC(2026, 9, 25, 12))).toBe(new Intl.DateTimeFormat("es-ES", o).format(Date.UTC(2026, 9, 25, 12)));
    expect(dateFormat("en-CA", o)).not.toBe(f);
  });

  it("does the same for numbers", () => {
    const n = numberFormat("es", { maximumFractionDigits: 1 });
    expect(numberFormat("es", { maximumFractionDigits: 1 })).toBe(n);
    expect(n.format(7.25)).toBe((7.25).toLocaleString("es", { maximumFractionDigits: 1 }));
  });
});
