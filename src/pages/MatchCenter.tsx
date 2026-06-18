import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useSeason } from "../context/SeasonContext";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { outcomeOf, OUTCOME, type MatchDoc } from "../components/match/matchData";
import { CountUp } from "../components/match/MatchBits";
import { ScoreboardHero } from "../components/match/ScoreboardHero";
import { BoardRow } from "../components/match/BoardRow";
import "./MatchCenter.css";

interface PlayerDoc {
  id: string;
  firstName?: string;
  lastName?: string;
  shirtName?: string;
  seasons?: string[];
  seasonDetails?: Record<string, { shirtName?: string; number?: number }>;
}

export const MatchCenter: React.FC = () => {
  const { selectedSeasonId, setSelectedSeasonId, seasons } = useSeason();
  // Stored with the season it belongs to, so `loading` is derived (no setState in the effect body).
  const [feed, setFeed] = useState<{ seasonId: string; matches: MatchDoc[] }>({ seasonId: "", matches: [] });
  const [players, setPlayers] = useState<PlayerDoc[]>([]);

  const loaded = feed.seasonId === selectedSeasonId;
  const loading = !loaded;
  const matches = useMemo(() => (loaded ? feed.matches : []), [loaded, feed.matches]);

  const currentSeasonName =
    selectedSeasonId === "all" ? "Histórico Total" : seasons.find((s) => s.id === selectedSeasonId)?.name || "Temporada";

  // Players (realtime)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "players"), (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayerDoc));
    });
    return () => unsub();
  }, []);

  // Matches filtered by season (realtime), date desc
  useEffect(() => {
    const ref = collection(db, "matches");
    const q =
      selectedSeasonId === "all"
        ? query(ref, orderBy("date", "desc"))
        : query(ref, where("seasonId", "==", selectedSeasonId), orderBy("date", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setFeed({ seasonId: selectedSeasonId, matches: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MatchDoc) });
      },
      (err) => {
        console.error("Error loading matches:", err);
        setFeed({ seasonId: selectedSeasonId, matches: [] });
      },
    );
    return () => unsub();
  }, [selectedSeasonId]);

  // Resolve shirt names, eagerly per season present in the feed (no post-render mutation).
  const playersMaps = useMemo(() => {
    const keys = new Set<string>(["_"]);
    matches.forEach((m) => keys.add(m.seasonId || "_"));
    const out = new Map<string, Record<string, string>>();
    keys.forEach((key) => {
      const seasonId = key === "_" ? undefined : key;
      const map: Record<string, string> = {};
      players.forEach((p) => {
        let shirt = p.shirtName || "";
        if (seasonId && p.seasonDetails?.[seasonId]?.shirtName) {
          shirt = p.seasonDetails[seasonId].shirtName as string;
        } else if (p.seasons && p.seasons.length > 0 && p.seasonDetails) {
          const inList = seasons.filter((s) => p.seasons?.includes(s.id));
          const latest = inList[inList.length - 1];
          if (latest && p.seasonDetails[latest.id]?.shirtName) shirt = p.seasonDetails[latest.id].shirtName as string;
        }
        map[p.id] = shirt || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Jugador";
      });
      out.set(key, map);
    });
    return out;
  }, [players, seasons, matches]);
  const playersMapFor = (seasonId?: string): Record<string, string> => playersMaps.get(seasonId || "_") ?? {};

  // Season tally
  const tally = useMemo(() => {
    let w = 0,
      d = 0,
      l = 0,
      gf = 0,
      gc = 0;
    for (const m of matches) {
      const f = m.goalsFor ?? 0;
      const a = m.goalsAgainst ?? 0;
      gf += f;
      gc += a;
      const o = outcomeOf(f, a);
      if (o === "win") w++;
      else if (o === "draw") d++;
      else l++;
    }
    return { pj: matches.length, w, d, l, gf, gc };
  }, [matches]);

  // Recent form, oldest to newest (rightmost = most recent, == the hero match).
  const form = useMemo(
    () => matches.slice(0, 6).map((m) => outcomeOf(m.goalsFor ?? 0, m.goalsAgainst ?? 0)).reverse(),
    [matches],
  );
  const formAria = form.map((o) => OUTCOME[o].word).join(", ");

  const latest = matches[0];
  const rest = matches.slice(1);

  const readout = [
    { k: "PJ", v: tally.pj, tone: "" },
    { k: "G", v: tally.w, tone: "win" },
    { k: "E", v: tally.d, tone: "draw" },
    { k: "P", v: tally.l, tone: "loss" },
    { k: "GF", v: tally.gf, tone: "gf" },
    { k: "GC", v: tally.gc, tone: "muted" },
  ];

  return (
    <div className="mp-bd">
      {/* Masthead */}
      <header className="mp-bd-mast">
        <h2 className="mp-bd-title">Partidos</h2>
        <span className="mp-bd-rule" aria-hidden="true" />
        <p className="mp-bd-sub">
          El marcador de <strong>{currentSeasonName}</strong>
        </p>
      </header>

      {/* Season filter */}
      {seasons.length > 0 && (
        <div className="mp-bd-periodo" role="group" aria-label="Periodo del marcador">
          <span className="mp-bd-periodo-label">Periodo</span>
          <button
            type="button"
            className="mp-bd-periodo-btn"
            aria-pressed={selectedSeasonId === "all"}
            onClick={() => setSelectedSeasonId("all")}
          >
            Histórico Total
          </button>
          {seasons.map((s) => (
            <button
              key={s.id}
              type="button"
              className="mp-bd-periodo-btn"
              aria-pressed={selectedSeasonId === s.id}
              onClick={() => setSelectedSeasonId(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="mp-bd-board mp-bd-board--skel" aria-hidden="true">
          <div className="mp-bd-skel-head">
            <span className="mp-bd-shimmer" />
          </div>
          <div className="mp-bd-skel-hero">
            <span className="mp-bd-shimmer" />
          </div>
          <div className="mp-bd-skel-rows">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="mp-bd-skel-row" key={i}>
                <span className="mp-bd-shimmer" />
              </div>
            ))}
          </div>
          <p className="mp-bd-loading-text">Encendiendo el marcador de {currentSeasonName}...</p>
        </div>
      ) : matches.length === 0 ? (
        <div className="mp-bd-empty">
          <span className="mp-bd-empty-mark">Marcador apagado</span>
          <p className="mp-bd-empty-text">
            No hay entradas para <strong>{currentSeasonName}</strong>. Cuando se registren partidos, se encenderán aquí.
          </p>
        </div>
      ) : (
        <div className="mp-bd-board">
          <span className="mp-bd-board-rail" aria-hidden="true" />

          <div className="mp-bd-board-head">
            <div className="mp-bd-board-id">
              <span className="mp-bd-board-label">
                <span className="mp-bd-board-led" aria-hidden="true" />
                Marcador
                <span className="mp-bd-board-season">{currentSeasonName}</span>
              </span>
              {form.length > 0 && (
                <div className="mp-bd-form" aria-label={`Forma reciente, de la más antigua a la más reciente: ${formAria}`}>
                  <span className="mp-bd-form-k">Forma</span>
                  <span className="mp-bd-form-tiles" aria-hidden="true">
                    {form.map((o, i) => (
                      <span
                        key={i}
                        className={`mp-bd-form-tile mp-bd-form-tile--${o}${i === form.length - 1 ? " mp-bd-form-tile--last" : ""}`}
                      >
                        {OUTCOME[o].letter}
                      </span>
                    ))}
                  </span>
                </div>
              )}
            </div>
            <dl className="mp-bd-readout" aria-label="Resumen de la temporada">
              {readout.map((c) => (
                <div className="mp-bd-readout-cell" key={c.k}>
                  <dd className={`mp-bd-readout-v${c.tone ? ` mp-bd-readout-v--${c.tone}` : ""}`}>
                    <CountUp value={c.v} />
                  </dd>
                  <dt className="mp-bd-readout-k">{c.k}</dt>
                </div>
              ))}
            </dl>
          </div>

          <ScoreboardHero match={latest} playersMap={playersMapFor(latest.seasonId)} />

          {rest.length > 0 && (
            <>
              <div className="mp-bd-rowshead">
                <span className="mp-bd-rowshead-bar" aria-hidden="true" />
                <span className="mp-bd-rowshead-label">Entradas anteriores</span>
                <span className="mp-bd-rowshead-count">
                  {rest.length} {rest.length === 1 ? "entrada" : "entradas"}
                </span>
              </div>

              <ol className="mp-bd-rows">
                <AnimatePresence>
                  {rest.map((m, i) => (
                    <BoardRow key={m.id} match={m} playersMap={playersMapFor(m.seasonId)} index={i} />
                  ))}
                </AnimatePresence>
              </ol>
            </>
          )}

          <p className="mp-bd-foot">
            Fin del marcador <span className="mp-bd-foot-sep">·</span> {matches.length}{" "}
            {matches.length === 1 ? "entrada" : "entradas"}
          </p>
        </div>
      )}
    </div>
  );
};
