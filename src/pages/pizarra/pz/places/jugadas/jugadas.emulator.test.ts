// r14 · Jugadas: the save flows FOR REAL against the shared emulators (rules and triggers of main), on Jordi's own
// board `pz-como-j1`, through the app's own writers (useLineups.saveData → updateDoc, data/seasonPlays) with plays
// built by this place's logic (jugadasView). Everything it creates is removed and the board's `plays` /
// `seasonPlays` are written back exactly as they were. Skipped unless PZ_EMU=1 (with the VITE_* emulator env):
//   PZ_EMU=1 VITE_USE_FIREBASE_EMULATOR=1 VITE_FIREBASE_PROJECT_ID=demo-manchester-piti VITE_FIREBASE_API_KEY=demo-key
//   VITE_EMULATOR_FIRESTORE_PORT=28080 VITE_EMULATOR_AUTH_PORT=29099 vitest run <this file>
import { describe, expect, it } from "vitest";
import type { PjPlay, PjStep, XY } from "./jugadasView";

// (read through globalThis: the app's tsconfig has no Node types)
const ON = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.PZ_EMU === "1";
const BOARD = "pz-como-j1";
const JORDI = "e5VyTucoVvZQVMI1T7al1kAnjr2d";

describe.skipIf(!ON)("Jugadas · save flows on the shared emulators (pz-como-j1)", () => {
  it("new play, step edits (dur, key, strokes, curves), reorder, video, season play by reference — then back as it was", async () => {
    const { auth, db } = await import("../../../../../firebase");
    const { GoogleAuthProvider, signInWithCredential } = await import("firebase/auth");
    const { doc, getDoc, updateDoc, deleteField } = await import("firebase/firestore");
    const { dataToLineupDoc } = await import("../../../lineupDoc");
    const { saveData } = await import("../../../useLineups");
    const { createSeasonPlay, updateSeasonPlay, deleteSeasonPlay, mapSeasonPlay } = await import("../../../data/seasonPlays");
    const { withSeasonPlay } = await import("../../../data/seasonPlayRefs");
    const { verOf } = await import("../../store/seven");
    const V = await import("./jugadasView");

    const enc = (v: object) => btoa(JSON.stringify(v)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const token = enc({ alg: "none", typ: "JWT" }) + "." + enc({ sub: "preview-admin", email: "admin@piti.test", email_verified: true, name: "Administrador de pruebas", aud: "demo", iss: "https://accounts.google.com" }) + ".";
    await signInWithCredential(auth, GoogleAuthProvider.credential(token));
    expect(auth.currentUser?.uid).toBe(JORDI);

    const ref = doc(db, "lineups", BOARD);
    const raw0 = (await getDoc(ref)).data() as Record<string, unknown>;
    expect(raw0).toBeTruthy();
    const keep = { plays: raw0.plays, seasonPlays: raw0.seasonPlays, bench: raw0.bench, pinned: raw0.pinned };
    const read = async () => dataToLineupDoc(BOARD, (await getDoc(ref)).data() as Record<string, unknown>);
    let seasonId: string | null = null;
    try {
      const L0 = (await read());
      const slots = verOf(L0, "titular").slots;
      // 1 · a new play from the seven (as «Nueva jugada»)
      const p = slots.map((s) => [s.x, s.y] as XY);
      const steps: PjStep[] = [
        { title: "Salida", note: "", p, r: [[50, 6]], b: [50, 88], dur: 2.3, c: {}, bk: null },
        { title: "Paso nuevo", note: "", p: p.map((q) => [q[0], Math.max(5, q[1] - 12)] as XY), r: [[48, 10]], b: [40, 60], dur: 2.6, c: {}, bk: null },
      ];
      const pj: PjPlay = { id: "pz-emu-test", name: "Prueba del emulador", kind: "propia", own: true, play: { id: "pz-emu-test", name: "Prueba del emulador", kind: "propia", frames: [] }, ids: slots.map((s) => s.playerId), rivalIds: ["r1"], steps };
      const first = V.fromSteps(pj, steps);
      await updateDoc(ref, saveData({ ...L0, plays: [...(L0.plays ?? []), first] }));
      let L1 = (await read());
      let mine = L1.plays?.find((x) => x.id === "pz-emu-test");
      expect(mine?.frames.length).toBe(2);
      expect(mine?.frames[1].dur).toBe(2600);

      // 2 · edit a step: its length, «Paso clave», 8 strokes of 64 points, a bent run, a third step; reorder; a video
      const own = V.ownPlay(mine!, slots);
      let s2 = V.setDurAt(own.steps, 1, 4);
      s2 = V.setKeyAt(s2, 1, true);
      const stroke = (k: number) => ({ id: "kemu" + k, kind: "lapiz" as const, color: "sky" as const, points: Array.from({ length: 64 }, (_, j) => ({ x: 10 + j, y: 20 + (k % 5) * 10 + (j % 3) })) });
      s2 = V.setStrokesAt(s2, 1, Array.from({ length: 8 }, (_, k) => stroke(k)));
      const movedK = s2[1].p.findIndex((q, k) => V.dist(own.steps[0].p[k], q) > 4);
      s2 = V.bendTo(s2, 1, movedK, [s2[1].p[movedK][0] - 8, (own.steps[0].p[movedK][1] + s2[1].p[movedK][1]) / 2]);
      s2 = V.addStepEnd(s2)!;
      s2 = V.moveStepTo(s2, 2, 1)!;
      const edited = { ...V.fromSteps(own, s2), video: { url: "https://youtu.be/pizarra-emu", at: 754 } };
      await updateDoc(ref, saveData({ ...L1, plays: (L1.plays ?? []).map((x) => (x.id === "pz-emu-test" ? edited : x)) }));
      L1 = (await read());
      mine = L1.plays?.find((x) => x.id === "pz-emu-test");
      expect(mine?.frames.length).toBe(3);
      expect(mine?.frames[1].title).toBe("Paso nuevo");
      expect(mine?.frames[2].dur).toBe(4000);
      expect(mine?.frames[2].key).toBe(true);
      expect(mine?.frames[2].d?.length).toBe(8);
      expect(mine?.video).toEqual({ url: "https://youtu.be/pizarra-emu", at: 754 });

      // 3 · a season play: kept for the season, used by reference, edited (every board), dropped, deleted
      seasonId = await createSeasonPlay({ seasonId: (raw0.seasonId as string) ?? "", uid: JORDI, nickname: "jordi", scope: "mine", play: first });
      await updateDoc(ref, saveData({ ...L1, seasonPlays: withSeasonPlay(L1.seasonPlays, seasonId, true) }));
      L1 = (await read());
      expect(L1.seasonPlays).toContain(seasonId);
      await updateSeasonPlay(seasonId, { ...first, name: "Prueba editada" });
      const sp = mapSeasonPlay(seasonId, (await getDoc(doc(db, "seasonPlays", seasonId))).data());
      expect(sp?.play.name).toBe("Prueba editada");
      await updateDoc(ref, saveData({ ...L1, seasonPlays: withSeasonPlay(L1.seasonPlays, seasonId, false) }));
      expect((await read()).seasonPlays ?? []).not.toContain(seasonId);
    } finally {
      // back as it was: the board's plays and refs exactly, the season play gone
      if (seasonId) await deleteSeasonPlay(seasonId);
      await updateDoc(ref, { plays: keep.plays ?? deleteField(), seasonPlays: keep.seasonPlays ?? deleteField(), ...(keep.bench !== undefined ? { bench: keep.bench } : {}), ...(keep.pinned !== undefined ? { pinned: keep.pinned } : {}) });
      const raw1 = (await getDoc(ref)).data() as Record<string, unknown>;
      expect(JSON.stringify(raw1.plays)).toBe(JSON.stringify(raw0.plays));
      expect(JSON.stringify(raw1.seasonPlays)).toBe(JSON.stringify(raw0.seasonPlays));
    }
  }, 60_000);
});
