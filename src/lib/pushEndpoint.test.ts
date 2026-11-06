import { describe, expect, it } from "vitest";
import { isPushServiceEndpoint } from "../../functions/src/pushEndpoint";

describe("push endpoints the server accepts", () => {
  it("the browsers' own push services", () => {
    // Chrome, Edge on Android, Samsung Internet, Opera, Brave
    expect(isPushServiceEndpoint("https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91bH")).toBe(true);
    expect(isPushServiceEndpoint("https://fcm.googleapis.com/wp/dQw4w9WgXcQ")).toBe(true);
    // Firefox
    expect(isPushServiceEndpoint("https://updates.push.services.mozilla.com/wpush/v2/gAAAAABk")).toBe(true);
    // Safari (macOS, iOS 16.4+)
    expect(isPushServiceEndpoint("https://web.push.apple.com/QGuQyavXutnMsmbg")).toBe(true);
    // Edge on Windows
    expect(isPushServiceEndpoint("https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB")).toBe(true);
    expect(isPushServiceEndpoint("https://FCM.googleapis.com/fcm/send/x")).toBe(true);
  });
  it("anything else is refused", () => {
    expect(isPushServiceEndpoint("https://example.com/push")).toBe(false);
    expect(isPushServiceEndpoint("http://fcm.googleapis.com/fcm/send/x")).toBe(false);
    expect(isPushServiceEndpoint("https://fcm.googleapis.com:8443/fcm/send/x")).toBe(false);
    expect(isPushServiceEndpoint("https://user:pw@fcm.googleapis.com/fcm/send/x")).toBe(false);
    // look-alike hosts
    expect(isPushServiceEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(false);
    expect(isPushServiceEndpoint("https://evilpush.apple.com.example/x")).toBe(false);
    expect(isPushServiceEndpoint("https://notify.windows.com.evil.example/x")).toBe(false);
    expect(isPushServiceEndpoint("https://xnotify.windows.com/x")).toBe(false);
    expect(isPushServiceEndpoint("not a url")).toBe(false);
  });
  it("the emulators' fake devices only when asked", () => {
    expect(isPushServiceEndpoint("https://push.example.test/abc/socio")).toBe(false);
    expect(isPushServiceEndpoint("https://push.example.test/abc/socio", true)).toBe(true);
    expect(isPushServiceEndpoint("https://example.com/x", true)).toBe(false);
  });
});
