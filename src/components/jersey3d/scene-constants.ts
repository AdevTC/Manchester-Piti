// Framing of the kit stills; kept outside the three.js chunk so pages can size their boxes.
export const STILL = { w: 360, h: 400, zoom: 1.02, lift: 0.02 };
/**
 * Version of the rendered stills kept on the device (Cache Storage). Bump it whenever the
 * model, the kit textures, the prints or the lighting change, so old photos are dropped.
 */
export const STILL_VERSION = 1;
