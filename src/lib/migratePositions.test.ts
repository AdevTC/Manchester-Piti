import { describe, expect, it } from "vitest";
import { DEFAULT_EMULATOR, DEMO_PROJECT, PROD_PROJECT, RETRY_CODES, classifyWriteError, migrationExit, migrationSummary, resolveMigrationTarget } from "../../functions/src/migratePositions";

describe("resolveMigrationTarget (a qué proyecto apunta la migración)", () => {
  it("defaults to the emulator, dry-run, on the demo project", () => {
    expect(resolveMigrationTarget([], {})).toEqual({
      ok: true,
      prod: false,
      write: false,
      projectId: DEMO_PROJECT,
      emulatorHost: DEFAULT_EMULATOR,
      label: "Destino: emulador 127.0.0.1:8080 · demo-manchester-piti",
    });
  });

  it("--write writes to the emulator", () => {
    const t = resolveMigrationTarget(["--write"], {});
    expect(t).toMatchObject({ ok: true, prod: false, write: true, projectId: DEMO_PROJECT });
  });

  it("honours an emulator host already in the environment", () => {
    const t = resolveMigrationTarget([], { FIRESTORE_EMULATOR_HOST: "localhost:9090" });
    expect(t).toMatchObject({ ok: true, emulatorHost: "localhost:9090", label: "Destino: emulador localhost:9090 · demo-manchester-piti" });
  });

  it("--prod targets production without an emulator, dry-run unless --write", () => {
    expect(resolveMigrationTarget(["--prod"], {})).toEqual({
      ok: true,
      prod: true,
      write: false,
      projectId: PROD_PROJECT,
      emulatorHost: null,
      label: "Destino: PRODUCCIÓN · futbolmanagement-dc6cb",
    });
    expect(resolveMigrationTarget(["--prod", "--write"], {})).toMatchObject({ ok: true, prod: true, write: true });
  });

  it("refuses --prod while FIRESTORE_EMULATOR_HOST is set (even empty)", () => {
    for (const host of ["127.0.0.1:8080", ""]) {
      const t = resolveMigrationTarget(["--prod", "--write"], { FIRESTORE_EMULATOR_HOST: host });
      expect(t.ok).toBe(false);
      if (!t.ok) expect(t.error).toMatch(/FIRESTORE_EMULATOR_HOST/);
    }
  });

  it("refuses unknown arguments instead of guessing (a typo never writes)", () => {
    const t = resolveMigrationTarget(["--wirte"], {});
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.error).toMatch(/--wirte/);
  });
});

describe("classifyWriteError", () => {
  it("a failed precondition or a vanished doc means it changed meanwhile", () => {
    expect(classifyWriteError(9)).toBe("cambiada");
    expect(classifyWriteError(5)).toBe("cambiada");
  });

  it("a timeout or an abort: not known whether it landed (never retried under the precondition)", () => {
    expect(classifyWriteError(4)).toBe("sin confirmar");
    expect(classifyWriteError(10)).toBe("sin confirmar");
    expect(RETRY_CODES.has(4)).toBe(false);
    expect(RETRY_CODES.has(10)).toBe(false);
    expect([...RETRY_CODES].sort((a, b) => a - b)).toEqual([8, 14]);
  });

  it("anything else is an error", () => {
    expect(classifyWriteError(7)).toBe("error");
    expect(classifyWriteError(undefined)).toBe("error");
    expect(classifyWriteError("boom")).toBe("error");
  });
});

describe("migrationExit", () => {
  it("0 only when every write landed (or there was nothing to write)", () => {
    expect(migrationExit(["escrita", "escrita"])).toEqual({ code: 0, advice: null });
    expect(migrationExit([])).toEqual({ code: 0, advice: null });
  });

  it("changed meanwhile or unconfirmed: 1 and «vuelve a lanzarla»", () => {
    for (const o of ["cambiada", "sin confirmar"] as const) {
      const r = migrationExit(["escrita", o]);
      expect(r.code).toBe(1);
      expect(r.advice).toMatch(/vuelve a lanzarla/);
    }
  });

  it("errors: 1, look above", () => {
    const r = migrationExit(["cambiada", "error"]);
    expect(r.code).toBe(1);
    expect(r.advice).toMatch(/errores.*vuelve a lanzarla/);
  });
});

describe("migrationSummary", () => {
  it("dry-run: counts what would be written and what is skipped", () => {
    expect(migrationSummary({ total: 30, planned: 3, write: false })).toBe(
      "Resumen (en seco): a escribir 3 · escritas 0 · saltadas (ya tenían) 27 · cambiadas mientras tanto 0 · no confirmadas 0 · errores 0",
    );
  });

  it("write: counts every outcome", () => {
    expect(migrationSummary({ total: 30, planned: 5, write: true, outcomes: ["escrita", "escrita", "cambiada", "sin confirmar", "error"] })).toBe(
      "Resumen: a escribir 5 · escritas 2 · saltadas (ya tenían) 25 · cambiadas mientras tanto 1 · no confirmadas 1 · errores 1",
    );
  });
});
