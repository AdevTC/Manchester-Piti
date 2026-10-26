import { describe, expect, it } from "vitest";
import { socialLabel, socialLinks } from "./social";

describe("socialLinks", () => {
  it("the club's two profiles, Instagram first, with their handles", () => {
    const l = socialLinks({ youtube: "https://www.youtube.com/@ManchesterPitiFC2026", instagram: "https://www.instagram.com/manchesterpiti.__/" });
    expect(l.map((x) => [x.key, x.handle, x.href])).toEqual([
      ["instagram", "@manchesterpiti.__", "https://www.instagram.com/manchesterpiti.__/"],
      ["youtube", "@ManchesterPitiFC2026", "https://www.youtube.com/@ManchesterPitiFC2026"],
    ]);
    expect(socialLabel(l[1])).toBe("YouTube de Manchester Piti (se abre en otra pestaña)");
  });
  it("shows nothing for an empty field, a typo, http or another site", () => {
    expect(socialLinks({ instagram: "", youtube: "  " })).toEqual([]);
    expect(socialLinks({ instagram: "manchesterpiti" })).toEqual([]);
    expect(socialLinks({ instagram: "http://instagram.com/manchesterpiti" })).toEqual([]);
    expect(socialLinks({ youtube: "https://evil.example/@ManchesterPiti" })).toEqual([]);
    expect(socialLinks({ instagram: "https://instagram.com.evil.example/x" })).toEqual([]);
  });
  it("a channel address without @handle keeps the network's name", () => {
    expect(socialLinks({ youtube: "https://www.youtube.com/channel/UC123" })[0].handle).toBe("YouTube");
  });
});
