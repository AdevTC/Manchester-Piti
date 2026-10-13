import { describe, expect, it } from "vitest";
import { clockTxt, parseClock, readVideo, videoHref, videoLabel, videoUrlError } from "./playVideo";
import { newPlay, parsePlays, playToData, setPlayVideo } from "../plays";
import { dataToLineupDoc, extractLineup, lineupToData, type LineupMeta } from "../lineupDoc";
import { seedLineup } from "../lineupOps";

// Bloque 5 · «Ver en vídeo»: the minute read and written, the link checked (https only), the link that
// opens at its moment, and the video kept in the jugada (and dropped on read when broken, never the jugada).

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const meta: LineupMeta = { ownerUid: "u", ownerNickname: "n", seasonId: "s", name: "x", isOfficial: false, matchId: null };
const play = () => newPlay("Córner", { a: { x: 40, y: 30 } });

describe("the minute", () => {
  it("reads 12:34, 1:02:03, plain seconds and the ′ ″ marks; refuses what is not a time", () => {
    expect(parseClock("12:34")).toBe(754);
    expect(parseClock(" 1:02:03 ")).toBe(3723);
    expect(parseClock("90")).toBe(90);
    expect(parseClock("12′34″")).toBe(754);
    expect(parseClock("")).toBe(0);
    expect(parseClock("12:75")).toBeNull();
    expect(parseClock("doce")).toBeNull();
    expect(parseClock("9:00:00")).toBeNull();
  });
  it("writes it back as m:ss or h:mm:ss", () => {
    expect(clockTxt(754)).toBe("12:34");
    expect(clockTxt(5)).toBe("0:05");
    expect(clockTxt(3723)).toBe("1:02:03");
  });
});

describe("the link", () => {
  it("only https links are kept, with the reason in Spanish otherwise", () => {
    expect(videoUrlError("https://youtu.be/abc123")).toBeNull();
    expect(videoUrlError("http://youtu.be/abc123")).toMatch(/https:\/\//);
    expect(videoUrlError("javascript:alert(1)")).toMatch(/no vale/);
    expect(videoUrlError("")).toMatch(/Pega el enlace/);
    expect(videoUrlError("https://x.es/" + "a".repeat(400))).toMatch(/demasiado largo/);
    expect(videoUrlError("https://user:pw@evil.es/v")).toMatch(/no vale/);
  });
  it("reads the editor's two fields into a video, or says what is wrong", () => {
    expect(readVideo(" https://drive.google.com/file/d/x/view ", "1:05")).toEqual({ video: { url: "https://drive.google.com/file/d/x/view", at: 65 } });
    expect(readVideo("https://youtu.be/a1b2c3", "doce")).toEqual({ error: "El minuto va como 12:34 (minutos y segundos)." });
    expect("error" in readVideo("ftp://x.es/v.mp4", "0:00")).toBe(true);
  });
  it("opens at its moment where the site understands it: YouTube's t=, a video file's #t=; any other page as it is", () => {
    expect(videoHref({ url: "https://www.youtube.com/watch?v=abc", at: 754 })).toBe("https://www.youtube.com/watch?v=abc&t=754s");
    expect(videoHref({ url: "https://youtu.be/abc", at: 30 })).toBe("https://youtu.be/abc?t=30s");
    expect(videoHref({ url: "https://club.es/v/corner.mp4", at: 12 })).toBe("https://club.es/v/corner.mp4#t=12");
    expect(videoHref({ url: "https://drive.google.com/file/d/x/view", at: 12 })).toBe("https://drive.google.com/file/d/x/view");
    expect(videoHref({ url: "https://youtu.be/abc", at: 0 })).toBe("https://youtu.be/abc");
  });
  it("is labelled «Ver en vídeo (12:34)», with where it goes for screen readers", () => {
    expect(videoLabel({ url: "https://www.youtube.com/watch?v=abc", at: 754 })).toEqual({
      txt: "Ver en vídeo (12:34)",
      aria: "Ver en vídeo (12:34), en youtube.com. Se abre en otra pestaña",
    });
  });
});

describe("the video in the jugada", () => {
  it("is linked, changed and taken off (the same jugada back when nothing changes)", () => {
    const p = play();
    const v = setPlayVideo(p, { url: " https://youtu.be/abc ", at: 12.4 });
    expect(v.video).toEqual({ url: "https://youtu.be/abc", at: 12 });
    expect(setPlayVideo(v, { url: "https://youtu.be/abc", at: 12 })).toBe(v);
    const off = setPlayVideo(v, null);
    expect(off.video).toBeUndefined();
    expect("video" in off).toBe(false);
    expect(setPlayVideo(off, null)).toBe(off);
  });
  it("is stored with the jugada and read back with the board", () => {
    const L = seedLineup("2-3-1", ["a"]);
    const withV = { ...L, plays: [setPlayVideo(play(), { url: "https://youtu.be/abc", at: 75 })] };
    const back = extractLineup(dataToLineupDoc("x", json(lineupToData(withV, meta))));
    expect(back.plays[0].video).toEqual({ url: "https://youtu.be/abc", at: 75 });
    expect(playToData(play())).not.toHaveProperty("video");
  });
  it("a broken link (http, a string minute) is dropped on read; the jugada stays", () => {
    const raw = json(playToData(play()));
    const bad = [
      { ...raw, video: { url: "http://youtu.be/abc", at: 3 } },
      { ...raw, id: "j2", video: { url: "https://youtu.be/abc", at: "12:00" } },
      { ...raw, id: "j3", video: "https://youtu.be/abc" },
    ];
    const out = parsePlays(bad, "doc");
    expect(out).toHaveLength(3);
    expect(out.every((p) => p.video === undefined)).toBe(true);
  });
});
