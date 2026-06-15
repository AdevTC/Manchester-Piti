import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { ThemeToggle } from "../components/ThemeToggle";
import { useCountUp } from "../hooks/useCountUp";
import { useReveal } from "../hooks/useReveal";
import { FloodlightCanvas } from "../components/FloodlightCanvas";
import { Crest as CrestImg } from "../components/Crest";
import "./Landing.css";

interface LandingProps {
  onEnter: () => void;
}

interface MatchEvent {
  type: string;
  playerId?: string;
  assistPlayerId?: string;
}
interface MatchDoc {
  id: string;
  rival?: string;
  competition?: string;
  date?: { seconds: number } | string | number;
  goalsFor?: number;
  goalsAgainst?: number;
  events?: MatchEvent[];
}
interface PlayerDoc {
  id: string;
  firstName?: string;
  lastName?: string;
  shirtName?: string;
  number?: number;
}

type Outcome = "V" | "E" | "D";

interface Summary {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  points: number;
  latest: {
    rival: string;
    competition: string;
    gf: number;
    ga: number;
    outcome: Outcome;
    dateLabel: string;
  } | null;
  topScorer: { name: string; number: number; goals: number } | null;
}

const GOAL_TYPES = new Set(["goal", "goal_penalty", "goal_freekick"]);

function toDate(value: MatchDoc["date"]): Date | null {
  if (value == null) return null;
  if (typeof value === "object" && "seconds" in value) return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function rv(i: number): React.CSSProperties {
  return { "--i": i } as React.CSSProperties;
}

const Teaser: React.FC<{ onEnter: () => void }> = ({ onEnter }) => (
  <div className="mp-teaser">
    <p>Aún no hay partidos cargados de esta temporada. Entra al vestuario para construir el historial del club.</p>
    <button type="button" className="mp-btn mp-btn-primary" onClick={onEnter}>
      Entrar
    </button>
  </div>
);

const Crest: React.FC<{ className?: string }> = ({ className }) => (
  <CrestImg className={`mp-crest ${className ?? ""}`} />
);

const CountUp: React.FC<{ value: number; className?: string }> = ({ value, className }) => {
  const { value: shown, ref } = useCountUp(value);
  return (
    <span ref={ref} className={className}>
      {shown}
    </span>
  );
};

export const Landing: React.FC<LandingProps> = ({ onEnter }) => {
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [matchSnap, playerSnap] = await Promise.all([
          getDocs(collection(db, "matches")),
          getDocs(collection(db, "players")),
        ]);
        if (!active) return;

        const matches = matchSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as MatchDoc[];
        const players = playerSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as PlayerDoc[];

        if (matches.length === 0) {
          setStatus("empty");
          return;
        }

        let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
        for (const m of matches) {
          const f = m.goalsFor ?? 0;
          const a = m.goalsAgainst ?? 0;
          gf += f; ga += a;
          if (f > a) wins += 1;
          else if (f === a) draws += 1;
          else losses += 1;
        }

        const sorted = [...matches].sort(
          (x, y) => (toDate(y.date)?.getTime() ?? 0) - (toDate(x.date)?.getTime() ?? 0),
        );
        const lm = sorted[0];
        const lf = lm.goalsFor ?? 0;
        const la = lm.goalsAgainst ?? 0;
        const outcome: Outcome = lf > la ? "V" : lf === la ? "E" : "D";
        const dateLabel =
          toDate(lm.date)?.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) ?? "";

        const goalsByPlayer: Record<string, number> = {};
        for (const m of matches) {
          for (const ev of m.events ?? []) {
            if (ev.playerId && GOAL_TYPES.has(ev.type)) {
              goalsByPlayer[ev.playerId] = (goalsByPlayer[ev.playerId] ?? 0) + 1;
            }
          }
        }
        const playerMap = new Map(players.map((p) => [p.id, p]));
        let topScorer: Summary["topScorer"] = null;
        for (const [pid, goals] of Object.entries(goalsByPlayer)) {
          if (!topScorer || goals > topScorer.goals) {
            const p = playerMap.get(pid);
            const fallbackName = p ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() : "";
            topScorer = {
              name: p?.shirtName?.trim() || fallbackName || "Jugador",
              number: p?.number ?? 0,
              goals,
            };
          }
        }

        setSummary({
          played: matches.length,
          wins, draws, losses, gf, ga,
          points: wins * 3 + draws,
          latest: { rival: lm.rival ?? "Rival", competition: lm.competition ?? "Partido", gf: lf, ga: la, outcome, dateLabel },
          topScorer,
        });
        setStatus("ready");
      } catch {
        if (active) setStatus("empty");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useReveal(status);

  useEffect(() => {
    console.info(
      "%cManchester Piti",
      "color:#6CABDD;font:700 14px Archivo,system-ui,sans-serif",
      "— Fútbol de domingo, pompa de élite.",
    );
  }, []);

  const outcomeLabel = (o: Outcome) => (o === "V" ? "Victoria" : o === "E" ? "Empate" : "Derrota");

  const tickerItems: string[] =
    status === "ready" && summary
      ? [
          "Temporada 23/24",
          `${summary.played} partidos`,
          summary.topScorer ? `Pichichi · ${summary.topScorer.name} · ${summary.topScorer.goals}` : "",
          summary.latest ? `Último · ${summary.latest.gf}–${summary.latest.ga} vs ${summary.latest.rival}` : "",
          `${summary.gf} goles a favor`,
          `${summary.points} puntos`,
        ].filter(Boolean)
      : ["Manchester Piti", "Club de Fútbol", "Temporada 23/24", "Fútbol de domingo, pompa de élite"];

  return (
    <div className="mp-landing">
      {/* ---------------- HERO ---------------- */}
      <header className="mp-hero">
        <FloodlightCanvas />
        <nav className="mp-topnav">
          <a className="mp-brand" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <Crest className="mp-crest-sky" />
            <span>Manchester Piti</span>
          </a>
          <div className="mp-topnav-actions">
            <ThemeToggle />
            <button type="button" className="mp-btn mp-btn-primary" onClick={onEnter}>
              Entrar
            </button>
          </div>
        </nav>

        <div className="mp-hero-body">
          <p className="mp-eyebrow reveal" style={rv(0)}>Club de Fútbol</p>
          <h1 className="mp-hero-title">
            <span className="reveal" style={rv(1)}>Manchester</span>
            <span className="reveal mp-sky-text" style={rv(2)}>Piti</span>
          </h1>
          <span className="mp-hero-rule reveal" style={rv(3)} aria-hidden="true" />
          <p className="mp-hero-tagline reveal" style={rv(4)}>Fútbol de domingo. Pompa de élite.</p>
          <p className="mp-hero-sub reveal" style={rv(5)}>
            Cada partido, cada gol y cada racha del equipo, contados como se merecen.
          </p>
          <div className="mp-hero-cta reveal" style={rv(6)}>
            <button type="button" className="mp-btn mp-btn-primary mp-btn-lg" onClick={onEnter}>
              Entrar al vestuario
            </button>
            <a className="mp-btn mp-btn-ghost mp-btn-lg" href="#temporada">Ver la temporada</a>
          </div>
        </div>

        <Crest className="mp-hero-watermark" />

        <div className="mp-hero-foot">
          <span>Temporada 23/24</span>
          <span className="mp-scrollcue">Desliza</span>
        </div>

        <div className="mp-marquee" aria-hidden="true">
          <div className="mp-marquee-track">
            {[...tickerItems, ...tickerItems].map((t, i) => (
              <span className="mp-marquee-item" key={i}>
                {t}
                <span className="sep">/</span>
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ---------------- SECTIONS ---------------- */}
      <main className="mp-sections mp-wrap">
        {/* Último partido */}
        <section className="mp-section">
          <div className="mp-section-head" data-reveal>
            <h2 className="mp-h2">El último partido</h2>
            <span className="mp-h2-rule" aria-hidden="true" />
          </div>
          {status === "loading" && <div className="mp-skel mp-skel-feat" />}
          {status === "empty" && <Teaser onEnter={onEnter} />}
          {status === "ready" && summary?.latest && (
            <article data-reveal className={`mp-feat mp-feat-${summary.latest.outcome}`}>
              <span className="mp-feat-comp">{summary.latest.competition}</span>
              <div className="mp-feat-line">
                <span className="mp-feat-team">Manchester Piti</span>
                <span className="mp-feat-score">
                  {summary.latest.gf}<span className="sep">–</span>{summary.latest.ga}
                </span>
                <span className="mp-feat-team away">{summary.latest.rival}</span>
              </div>
              <div className="mp-feat-meta">
                <div>
                  <div className="lbl">Resultado</div>
                  <span className={`mp-outcome mp-feat-${summary.latest.outcome}`}>
                    <span className="dot" />{outcomeLabel(summary.latest.outcome)}
                  </span>
                </div>
                {summary.latest.dateLabel && (
                  <div>
                    <div className="lbl">Fecha</div>
                    {summary.latest.dateLabel}
                  </div>
                )}
              </div>
            </article>
          )}
        </section>

        {/* Pichichi */}
        <section className="mp-section">
          <div className="mp-section-head" data-reveal>
            <h2 className="mp-h2">El Pichichi</h2>
            <span className="mp-h2-rule" aria-hidden="true" />
          </div>
          {status === "loading" && <div className="mp-skel mp-skel-pichichi" />}
          {status === "empty" && <Teaser onEnter={onEnter} />}
          {status === "ready" && summary?.topScorer && (
            <div className="mp-pichichi" data-reveal>
              <div className="mp-pichichi-fig">
                <CountUp className="n" value={summary.topScorer.goals} />
                <span className="u">goles</span>
              </div>
              <div className="mp-pichichi-who">
                <div className="nm">
                  {summary.topScorer.name}
                  {summary.topScorer.number > 0 && <span className="mp-dorsal">{summary.topScorer.number}</span>}
                </div>
                <div className="role">Pichichi del club</div>
              </div>
            </div>
          )}
          {status === "ready" && !summary?.topScorer && (
            <div className="mp-teaser"><p>Todavía no hay goles registrados esta temporada.</p></div>
          )}
        </section>

        {/* Temporada */}
        <section className="mp-section" id="temporada">
          <div className="mp-section-head" data-reveal>
            <h2 className="mp-h2">La temporada</h2>
            <span className="mp-h2-rule" aria-hidden="true" />
          </div>
          {status === "loading" && <div className="mp-skel mp-skel-band" />}
          {status === "empty" && <Teaser onEnter={onEnter} />}
          {status === "ready" && summary && (
            <div className="mp-band" data-reveal>
              <div className="cell"><div className="v"><CountUp value={summary.played} /></div><div className="k">PJ</div></div>
              <div className="cell hl"><div className="v"><CountUp value={summary.wins} /></div><div className="k">Ganados</div></div>
              <div className="cell"><div className="v"><CountUp value={summary.draws} /></div><div className="k">Empat.</div></div>
              <div className="cell"><div className="v"><CountUp value={summary.losses} /></div><div className="k">Perd.</div></div>
              <div className="cell"><div className="v"><CountUp value={summary.gf} /></div><div className="k">GF</div></div>
              <div className="cell"><div className="v"><CountUp value={summary.ga} /></div><div className="k">GC</div></div>
              <div className="cell hl"><div className="v"><CountUp value={summary.points} /></div><div className="k">Puntos</div></div>
            </div>
          )}
        </section>

        {/* CTA */}
        <section className="mp-cta-band" data-reveal>
          <h2>Entra al vestuario</h2>
          <p>Estadísticas completas, plantilla, historial de cada temporada y los récords del club.</p>
          <button type="button" className="mp-btn mp-btn-primary mp-btn-lg" onClick={onEnter}>
            Entrar
          </button>
        </section>
      </main>

      <footer className="mp-footer">
        <div className="mp-wrap mp-footer-inner">
          <a className="mp-brand" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <Crest className="mp-crest-sky" />
            <span className="mp-footer-word">Manchester Piti</span>
          </a>
          <span className="mp-footer-note">Club de Fútbol · Hecho por y para el equipo</span>
          <ThemeToggle />
        </div>
      </footer>
    </div>
  );
};
