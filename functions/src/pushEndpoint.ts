// Which push endpoints the server accepts (pushSubscribe, pushSetMatchTopics): only the browsers' own push services.
// Anyone can register a device without an account, and every notice to a topic is a POST to each device's endpoint,
// so an arbitrary URL would let a script fill pushSubscriptions with fake devices (slowing every goal's notice) and
// make the server send requests to hosts of its choosing. Pure: tested without Firestore.

/** The push services a browser's PushManager.subscribe() hands out today:
 *  · fcm.googleapis.com — Chrome, Edge on Android, Samsung Internet, Opera, Brave (Google's FCM)
 *  · *.push.services.mozilla.com — Firefox (updates.push.services.mozilla.com)
 *  · *.push.apple.com — Safari on macOS and iOS 16.4+ (web.push.apple.com)
 *  · *.notify.windows.com — Edge on Windows (wns2-par02p.notify.windows.com and the like) */
const EXACT = new Set(["fcm.googleapis.com"]);
const SUFFIXES = [".push.services.mozilla.com", ".push.apple.com", ".notify.windows.com"];

/** Whether `endpoint` is an https URL of a known push service (`allowTest`: also any `*.test` host, the emulators'
 *  fake devices; never in production). */
export function isPushServiceEndpoint(endpoint: string, allowTest = false): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") return false;
  const host = url.hostname.toLowerCase();
  if (EXACT.has(host) || SUFFIXES.some((s) => host.endsWith(s))) return true;
  return allowTest && host.endsWith(".test");
}
