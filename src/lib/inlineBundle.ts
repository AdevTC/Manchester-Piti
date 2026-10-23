// The data bundle as text to put inside a server-rendered page (api/render.js, read back by lib/bundle.ts).

/** Every length-prefixed element re-encoded with «<» escaped (as <, inside its JSON strings, where alone it
 *  can appear), so nothing in the data can close the <script> early. Same data, a valid bundle (each length
 *  recomputed in bytes). */
export function inlineBundle(bytes: Uint8Array): string {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    let j = i;
    while (j < bytes.length && bytes[j] >= 48 && bytes[j] <= 57) j++;
    const len = Number(dec.decode(bytes.subarray(i, j)));
    if (j === i || !Number.isFinite(len)) throw new Error("bundle: no length prefix");
    const json = dec.decode(bytes.subarray(j, j + len)).replace(/</g, "\\u003c");
    out += enc.encode(json).length + json;
    i = j + len;
  }
  return out;
}
