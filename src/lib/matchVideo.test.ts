import { describe, expect, it } from "vitest";
import { isYouTubeUrl, matchVideoHref } from "../../functions/src/matchVideo";

describe("el vídeo del partido", () => {
  it("accepts a YouTube video in its usual shapes", () => {
    for (const u of ["https://www.youtube.com/watch?v=abc123XYZ_-", "https://youtu.be/abc123", "https://youtube.com/live/abc123", "https://m.youtube.com/watch?v=abc&t=60s", "https://www.youtube.com/shorts/abc123"]) expect(isYouTubeUrl(u), u).toBe(true);
  });
  it("refuses anything else: empty, http, a channel, another site, a look-alike host", () => {
    for (const u of ["", "  ", "http://www.youtube.com/watch?v=abc", "https://www.youtube.com/@ManchesterPitiFC2026", "https://www.youtube.com/watch", "https://youtu.be/", "https://vimeo.com/123", "https://youtube.com.evil.example/watch?v=abc", "youtube.com/watch?v=abc"]) expect(isYouTubeUrl(u), u).toBe(false);
  });
  it("gives the link to show, trimmed, or null", () => {
    expect(matchVideoHref("  https://youtu.be/abc123 ")).toBe("https://youtu.be/abc123");
    expect(matchVideoHref(undefined)).toBeNull();
    expect(matchVideoHref("https://vimeo.com/1")).toBeNull();
  });
});
