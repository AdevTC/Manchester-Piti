import { describe, expect, it } from "vitest";
import { DEFAULT_EMULATOR, DEMO_PROJECT, PROD_PROJECT, classifyWriteError, migrationSummary, resolveMigrationTarget } from "../../functions/src/migratePositions";

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

  it("anything else is an error", () => {
    expect(classifyWriteError(7)).toBe("error");
    expect(classifyWriteError(undefined)).toBe("error");
    expect(classifyWriteError("boom")).toBe("error");
  });
});

describe("migrationSummary", () => {
  it("dry-run: counts what would be written and what is skipped", () => {
    expect(migrationSummary({ total: 30, planned: 3, write: false })).toBe(
      "Resumen (en seco): a escribir 3 · escritas 0 · saltadas (ya tenían) 27 · cambiadas mientras tanto 0 · errores 0",
    );
  });

  it("write: counts every outcome", () => {
    expect(migrationSummary({ total: 30, planned: 4, write: true, outcomes: ["escrita", "escrita", "cambiada", "error"] })).toBe(
      "Resumen: a escribir 4 · escritas 2 · saltadas (ya tenían) 26 · cambiadas mientras tanto 1 · errores 1",
    );
  });
});
