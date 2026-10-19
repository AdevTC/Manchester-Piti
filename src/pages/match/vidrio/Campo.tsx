// «Ahora en el campo» (V-Vivo, the match page's right column): the seven on a glass pitch — our goal at the
// bottom — each one in his spot with his dorsal and name and the marks of the night; the changes walk in as
// they happen. Before the whistle it is the seven the pizarra published («Publicado a las 18:10»).
import type { CSSProperties } from "react";
import type { ClubMatch } from "../../../lib/clubData";
import type { PlayerDoc } from "../../../lib/schemas";
import { useSeason } from "../../../context/SeasonContext";
import { lineupWalk, parseMatchLineup } from "../../../lib/matchLineup";
import { settled } from "../../../lib/eventMeta";
import { madridTime } from "../../../lib/derived/madrid";
import { nightTags } from "../../../lib/derived/vidrio/squadLive";
import { TagRow } from "../../../components/paginas/Tags";
import { useNumOf } from "../useNumOf";

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
  if (!slots.length) return null;
  const events = started ? settled(match.events) : [];
  const walk = lineupWalk({ slots }, events);
  const tags = nightTags(events, live);
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
      <div className="vd-pitch mp-pitch">
        {LINES}
        <ul className="mp-players" aria-label="Los siete">
          {walk.now.map((s) => {
            const left = Math.max(12, Math.min(88, s.x));
            const top = Math.max(9, Math.min(91, s.y));
            return (
              <li key={s.playerId} className="vd-player mp-player" style={{ left: `${left}%`, top: `${top}%` } as CSSProperties}>
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
