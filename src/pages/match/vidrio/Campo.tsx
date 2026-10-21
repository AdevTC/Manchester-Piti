// «Ahora en el campo» (V-Vivo, the match page's right column): the seven on a glass pitch — our goal at the
// bottom — each one in his spot with his dorsal and name and the marks of the night; the changes walk in as
// they happen. Before the whistle it is the seven the pizarra published («Publicado a las 18:10»).
import { useEffect, useRef, type CSSProperties } from "react";
import type { ClubMatch } from "../../../lib/clubData";
import type { PlayerDoc } from "../../../lib/schemas";
import { useSeason } from "../../../context/SeasonContext";
import { lineupWalk, parseMatchLineup } from "../../../lib/matchLineup";
import { settled } from "../../../lib/eventMeta";
import { madridTime } from "../../../lib/derived/madrid";
import { nightTags } from "../../../lib/derived/vidrio/squadLive";
import { TagRow } from "../../../components/paginas/Tags";
import type { PitchPlayer } from "../../home/vidrio/pitchLayout";
import { useNumOf } from "../useNumOf";
import { placeCampo } from "./campoLayout";

/** The collision pass on this pitch (campoLayout): measured as laid out (offsets, so no transform skews it), every
 *  name kept clear of the other shirts and names — the player moved a little from the pizarra's spot when he must —
 *  and every column of marks clear of the names, the shirts and the other marks; again whenever the pitch resizes,
 *  the fonts arrive or someone comes on. */
function useCampoLayout(key: string) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const pitch = ref.current;
    if (!pitch) return;
    let raf = 0;
    const run = () => {
      raf = 0;
      const items = [...pitch.querySelectorAll<HTMLElement>(".mp-player")];
      // (measured as first laid out — one line, the marks in one column — so the pass gives the same answer
      // every time it runs)
      for (const li of items) {
        li.classList.remove("mp-player--two", "mp-player--tags2", "mp-player--tagsicon");
        delete li.dataset.tags;
      }
      const boxes = items.map((li) => ({ x0: li.offsetLeft - li.offsetWidth / 2, y0: li.offsetTop - li.offsetHeight / 2 }));
      const players: PitchPlayer[] = items.map((li, i) => {
        const { x0, y0 } = boxes[i];
        const shirt = li.querySelector<HTMLElement>(".vd-shirt");
        const plate = li.querySelector<HTMLElement>(".vd-player__name");
        const tags = li.querySelector<HTMLElement>(".vd-tags");
        // (a name with a space can go on two lines: measured with the class on, then off again)
        let plate2: { w: number; h: number } | null = null;
        if (plate && /\s/.test(plate.firstChild?.textContent?.trim() ?? "")) {
          li.classList.add("mp-player--two");
          plate2 = { w: plate.offsetWidth, h: plate.scrollHeight };
          li.classList.remove("mp-player--two");
        }
        return {
          shirt: { x: x0 + (shirt?.offsetLeft ?? 0), y: y0 + (shirt?.offsetTop ?? 0), w: shirt?.offsetWidth ?? 0, h: shirt?.offsetHeight ?? 0 },
          plate: { x: x0 + (plate?.offsetLeft ?? 0), y: y0 + (plate?.offsetTop ?? 0), w: plate?.offsetWidth ?? 0, h: plate?.offsetHeight ?? 0 },
          plate2,
          tags: tags ? { w: tags.offsetWidth, h: tags.offsetHeight, n: tags.childElementCount } : null,
        };
      });
      placeCampo(players, pitch.clientWidth, pitch.clientHeight).forEach((p, i) => {
        const li = items[i];
        const { x0, y0 } = boxes[i];
        li.classList.toggle("mp-player--two", p.plate === "two");
        li.classList.toggle("mp-player--tags2", p.cols === 2);
        li.classList.toggle("mp-player--tagsicon", p.chips === "icon");
        li.style.setProperty("--nx", `${p.nx}px`);
        li.style.setProperty("--ny", `${p.ny}px`);
        li.style.setProperty("--pdx", `${p.plateDx}px`);
        li.style.setProperty("--pdy", `${p.plateDy}px`);
        if (p.tagsAt) {
          li.dataset.tags = p.tags;
          li.style.setProperty("--tx", `${Math.round(p.tagsAt.x - (x0 + p.nx))}px`);
          li.style.setProperty("--ty", `${Math.round(p.tagsAt.y - (y0 + p.ny))}px`);
        }
      });
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    run();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(queue) : null;
    ro?.observe(pitch);
    void document.fonts?.ready.then(queue);
    return () => {
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [key]);
  return ref;
}

/** A seven without a published lineup stands in a 3-2-1 (keeper first), in the pizarra's frame. */
const DEFAULT_SPOTS: readonly (readonly [number, number])[] = [[50, 90], [18, 68], [50, 72], [82, 68], [32, 42], [68, 42], [50, 16]];

const LINES = (
  <svg className="vd-pitch__lines" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
    <rect x="4" y="3" width="92" height="134" rx="1" />
    <line x1="4" y1="70" x2="96" y2="70" />
    <circle cx="50" cy="70" r="11" />
    <rect x="26" y="3" width="48" height="17" />
    <rect x="26" y="120" width="48" height="17" />
  </svg>
);

export function Campo({ match, players, nameOf, live, started }: { match: ClubMatch; players: PlayerDoc[]; nameOf: (id: string) => string; live: boolean; started: boolean }) {
  const numOf = useNumOf(players, match.seasonId);
  const { seasons } = useSeason();
  const captain = seasons.find((s) => s.id === match.seasonId)?.captainPlayerId ?? null;
  const lineup = parseMatchLineup((match as ClubMatch & { lineup?: unknown }).lineup);
  const slots = lineup ? lineup.slots : (match.starters ?? []).slice(0, 7).map((id, i) => ({ playerId: id, code: i === 0 ? ("POR" as const) : ("MC" as const), x: DEFAULT_SPOTS[i][0], y: DEFAULT_SPOTS[i][1] }));
  const events = started ? settled(match.events) : [];
  const walk = lineupWalk({ slots }, events);
  const tags = nightTags(events, live);
  const pitch = useCampoLayout(walk.now.map((s) => `${s.playerId}@${s.x},${s.y}:${nameOf(s.playerId)}:${(tags.get(s.playerId) ?? []).map((t) => t.kind + t.text).join(",")}`).join("|"));
  if (!slots.length) return null;
  const subs = walk.steps.filter((s) => s.k === "sub" && s.inId).map((s) => nameOf(s.inId!));
  const sub = !started
    ? lineup?.setAt
      ? `Publicado a las ${madridTime(lineup.setAt)}`
      : "El siete de la convocatoria"
    : subs.length
      ? `Con ${subs.length === 1 ? subs[0] : `${subs.slice(0, -1).join(", ")} y ${subs.at(-1)}`}`
      : (lineup?.system ?? "");
  return (
    <section className="vd-glass vd-glass--clear vd-orn mp-campo" aria-labelledby="mp-campo-t">
      <div className="vd-orn__head">
        <h2 id="mp-campo-t">{started ? "Ahora en el campo" : "El siete"}</h2>
        {sub && <span>{sub}</span>}
      </div>
      <div ref={pitch} className="vd-pitch mp-pitch">
        {LINES}
        <ul className="mp-players" aria-label="Los siete">
          {walk.now.map((s) => {
            const left = Math.max(12, Math.min(88, s.x));
            const top = Math.max(9, Math.min(91, s.y));
            // (the marks go beside the shirt, towards the roomier side: outwards in the middle, inwards at the edges;
            // the collision pass then moves whatever would touch another player)
            const tl = left > 75 ? true : left < 25 ? false : left < 50;
            return (
              <li key={s.playerId} className={`vd-player mp-player${tl ? " mp-player--tl" : ""}`} style={{ left: `${left}%`, top: `${top}%` } as CSSProperties}>
                <span className="vd-shirt" style={{ "--s": "34px" } as CSSProperties} aria-hidden="true">
                  <b>{numOf(s.playerId)}</b>
                  {captain === s.playerId && <i className="vd-arm" />}
                </span>
                <span className="vd-player__name">
                  {nameOf(s.playerId).toLocaleUpperCase("es")}
                  {captain === s.playerId && <span className="vd-vh">, capitán</span>}
                </span>
                <TagRow tags={tags.get(s.playerId) ?? []} />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
