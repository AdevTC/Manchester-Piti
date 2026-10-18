// Private copy of the sun for CDM Palomeras, with the signature of the shared `src/lib/derived/sun.ts`
// (W1). The integrator swaps the import in `light.ts` for that file once it is on main.

export interface SunPosition {
  /** Degrees above the horizon (refraction included near it). */
  elevation: number;
  /** Degrees from north, clockwise. */
  azimuth: number;
}

export const PALOMERAS = { lat: 40.39, lon: -3.66 } as const;

const RAD = Math.PI / 180;

/** Solar position (NOAA) at an instant, by default over CDM Palomeras. */
export function sunPosition(ms: number, lat: number = PALOMERAS.lat, lon: number = PALOMERAS.lon): SunPosition {
  const jd = ms / 86_400_000 + 2_440_587.5;
  const utcMin = ((ms % 86_400_000) + 86_400_000) % 86_400_000 / 60_000;
  const T = (jd - 2_451_545) / 36_525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * RAD) * 0.000289;
  const om = 125.04 - 1934.136 * T;
  const lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * RAD);
  const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lam * RAD));
  const yy = Math.tan((eps * RAD) / 2) ** 2;
  const eot =
    (4 / RAD) *
    (yy * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * yy * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * yy * yy * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD));
  const ha = (utcMin + eot + 4 * lon) / 4 - 180;
  const la = lat * RAD;
  const cz = Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha * RAD);
  let elevation = 90 - Math.acos(Math.max(-1, Math.min(1, cz))) / RAD;
  if (elevation > -1.5) elevation += 1.02 / Math.tan((elevation + 10.3 / (elevation + 5.11)) * RAD) / 60;
  const azimuth =
    (Math.atan2(Math.sin(ha * RAD), Math.cos(ha * RAD) * Math.sin(la) - Math.tan(decl) * Math.cos(la)) / RAD + 180 + 360) % 360;
  return { elevation, azimuth };
}
