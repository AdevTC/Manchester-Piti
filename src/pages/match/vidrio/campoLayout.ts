// «Ahora en el campo»'s collision pass, pure: Inicio's (home/vidrio/pitchLayout) on the match page's upright pitch,
// our goal at the bottom. Two things differ there: a centre-back stands right above the keeper, so every name and
// every column of marks keeps a little air under it (a name never sits on the shirt below, two players' marks never
// read as one column); and the players are placed from the top of the pitch down, so the keeper — on our goal line,
// his name under him — is the last to give way (the air under his name may hang past the bottom line).
import { placePitch, type PitchPlace, type PitchPlayer } from "../../home/vidrio/pitchLayout";

/** Air kept under a name and under a column of marks (px). */
export const AIR = 3;

/** Where each player, name and column of marks goes (same order as `players`; px from the pitch's top-left). */
export function placeCampo(players: readonly PitchPlayer[], W: number, H: number): PitchPlace[] {
  const aired = players.map((p) => ({
    ...p,
    plate: { ...p.plate, h: p.plate.h + AIR },
    plate2: p.plate2 ? { ...p.plate2, h: p.plate2.h + AIR } : p.plate2,
    tags: p.tags ? { ...p.tags, h: p.tags.h + AIR } : null,
  }));
  const order = aired.map((_, i) => i).sort((a, b) => aired[a].shirt.y - aired[b].shirt.y);
  const placed = placePitch(order.map((i) => aired[i]), W, H ? H + AIR : 0);
  const out: PitchPlace[] = [];
  order.forEach((i, k) => (out[i] = placed[k]));
  return out;
}
