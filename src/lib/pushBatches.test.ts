import { describe, expect, it } from "vitest";
import { inBatches, PUSH_BATCH } from "../../functions/src/pushLogic";

describe("avisos en tandas (functions/src/push.ts sendTo)", () => {
  it("manda a todos, como mucho PUSH_BATCH a la vez, y la siguiente tanda espera a la anterior", async () => {
    const sent: number[] = [];
    let busy = 0;
    let peak = 0;
    const devices = Array.from({ length: 2 * PUSH_BATCH + 7 }, (_, i) => i);
    await inBatches(devices, PUSH_BATCH, async (d) => {
      busy++;
      peak = Math.max(peak, busy);
      await new Promise((r) => setTimeout(r, 0));
      sent.push(d);
      busy--;
    });
    expect(PUSH_BATCH).toBe(50);
    expect(peak).toBe(PUSH_BATCH);
    expect([...sent].sort((a, b) => a - b)).toEqual(devices);
  });
  it("sin dispositivos no hace nada; un tamaño raro cuenta como 1", async () => {
    let calls = 0;
    await inBatches([], PUSH_BATCH, async () => {
      calls++;
    });
    expect(calls).toBe(0);
    let peak = 0;
    let busy = 0;
    await inBatches([1, 2, 3], 0, async () => {
      busy++;
      peak = Math.max(peak, busy);
      await Promise.resolve();
      busy--;
    });
    expect(peak).toBe(1);
  });
});
