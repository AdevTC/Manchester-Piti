// The «clac» of a seat coming down, and the buzz of a press. The sound is opt-in (remembered on this device)
// and its AudioContext is only made inside a press, as the browsers ask; the vibration only ever answers a
// press of the member's own.
const KEY = "piti-fila-clac";
type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const w = window as Window & { webkitAudioContext?: AudioCtor };
  const A: AudioCtor | undefined = window.AudioContext ?? w.webkitAudioContext;
  if (!A) return null;
  ctx = new A();
  return ctx;
}

/** Inside a press: make (or wake) the AudioContext so later clacs may sound. */
export function primeClac(): void {
  try {
    const a = audio();
    if (a && a.state === "suspended") void a.resume().catch(() => undefined);
  } catch {
    // no WebAudio: the clac stays silent
  }
}

/** A short, dry knock: filtered noise with a fast decay. Silent until primed by a press. */
export function playClac(): void {
  try {
    const a = ctx;
    if (!a) return;
    const n = Math.floor(a.sampleRate * 0.07);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 2400;
    f.Q.value = 2.5;
    src.connect(f);
    f.connect(a.destination);
    src.start();
  } catch {
    // a refused or closed context: no sound
  }
}

/** A short buzz, only in answer to a press. */
export function buzz(ms: number): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(ms);
  } catch {
    // vibration blocked
  }
}

export function readClacPref(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function writeClacPref(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked: the choice lasts this visit
  }
}
