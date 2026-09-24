import { Link } from "@tanstack/react-router";
import { Icon, type IconName } from "../../components/celeste/icons";
import { dateMillis, formatDate, isCompleted, type ClubMatch } from "../../lib/clubData";
import { resultOf, type ClubMedal, type PlayerLine, type Pulse, type Result } from "../../lib/home";
import { plural } from "../../lib/vestuario";

const RESULT_LABEL: Record<Result, string> = { G: "Victoria", E: "Empate", P: "Derrota" };

// ---------- así va la temporada
export function SeasonPulse({ pulse }: { pulse: Pulse }) {
  const played = pulse.played.length;
  const form: (Result | null)[] = [...pulse.form, ...Array(5 - pulse.form.length).fill(null)];
  return (
    <section className="hm-sec" aria-labelledby="hm-pulse">
      <span className="hm-kick">Así va la temporada</span>
      <h2 className="hm-h2" id="hm-pulse">
        {played ? (
          <>
            {plural(played, "partido", "partidos")}. <em>{plural(pulse.gf, "gol", "goles")}.</em>
          </>
        ) : (
          <>
            Todo a cero. <em>La jornada 1 lo enciende.</em>
          </>
        )}
      </h2>
      <div className="hm-pulse">
        <div className={`hm-cell${played ? "" : " ph"}`}>
          <span className="k">Partidos</span>
          <b>{played}</b>
          <span className="s">{played ? `${plural(pulse.wins, "victoria", "victorias")} · ${plural(pulse.draws, "empate", "empates")} · ${plural(pulse.losses, "derrota", "derrotas")}` : "El marcador se enciende en la jornada 1."}</span>
        </div>
        <div className={`hm-cell${played ? "" : " ph"}`}>
          <span className="k">Goles</span>
          <b style={played ? { color: "var(--accent)" } : undefined}>{pulse.gf}</b>
          <span className="s">{played ? `${(pulse.gf / played).toFixed(1).replace(".", ",")} por partido · ${pulse.ga} en contra` : "Cada gol del acta suma aquí al instante."}</span>
        </div>
        <div className="hm-cell wide">
          <span className="k">Forma · últimos 5</span>
          <div className="hm-form" aria-label={pulse.form.length ? `Últimos partidos: ${pulse.form.map((r) => RESULT_LABEL[r].toLowerCase()).join(", ")}` : "Sin partidos todavía"}>
            {form.map((r, i) => (
              <i key={i} className={r ?? "q"} aria-hidden="true">
                {r ?? "?"}
              </i>
            ))}
          </div>
          <span className="s">G victoria · E empate · P derrota{pulse.form.length ? " · el más reciente a la izquierda" : ""}</span>
        </div>
      </div>
    </section>
  );
}

// ---------- pichichi + cumpleaños
const SHIRT = "M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3a4 4 0 0 1-8 0Z";
function Pod({ line, rank, stat }: { line?: PlayerLine; rank: 1 | 2 | 3; stat: string }) {
  const h = rank === 1 ? 112 : rank === 2 ? 74 : 54;
  return (
    <div className={`hm-pod${rank === 1 ? " first" : ""}${line ? "" : " ghost"}`}>
      <span className="j">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={SHIRT} fill="currentColor" />
        </svg>
        <b>{line?.num ?? "?"}</b>
      </span>
      <span className="nm">{line?.name ?? "Por decidir"}</span>
      <span className="v">{stat}</span>
      <span className="st" style={{ height: h }} aria-label={`Puesto ${rank}`}>
        {rank}
      </span>
    </div>
  );
}
export function RaceAndBirthdays({ scorers, assister, birthdays }: { scorers: PlayerLine[]; assister?: PlayerLine; birthdays: { id: string; name: string; num: string; label: string; days: number }[] }) {
  const [first, second, third] = scorers;
  const stat = (l?: PlayerLine) => (l ? plural(l.stats.goals, "gol", "goles") : "0 goles");
  return (
    <section className="hm-sec" aria-labelledby="hm-race">
      <div className="hm-two">
        <div>
          <span className="hm-kick">Pichichi y asistencias</span>
          <h2 className="hm-h2" id="hm-race">
            {first ? (
              <>
                El {first.num} manda: <em>{plural(first.stats.goals, "gol", "goles")}.</em>
              </>
            ) : (
              <>
                ¿Quién será <em>el primer Pichichi?</em>
              </>
            )}
          </h2>
          <div className="hm-race">
            <Pod line={second} rank={2} stat={stat(second)} />
            <Pod line={first} rank={1} stat={stat(first)} />
            <Pod line={third} rank={3} stat={stat(third)} />
          </div>
          <p className="hm-lede">
            {assister
              ? `${assister.name} es quien más goles regala: ${plural(assister.stats.assists, "asistencia", "asistencias")}.`
              : "La tabla arranca en cero para todos y se actualiza sola con cada gol y cada asistencia del acta."}
          </p>
        </div>
        {birthdays.length > 0 && (
          <div>
            <span className="hm-kick">El vestuario también celebra esto</span>
            <h2 className="hm-h2" style={{ fontSize: 32 }}>
              Próximos cumpleaños
            </h2>
            <ul className="hm-bdays">
              {birthdays.map((b) => (
                <li key={b.id} className="hm-bday">
                  <span className="d" aria-hidden="true">
                    {b.num}
                  </span>
                  <span>
                    <b>{b.name}</b>
                    <span>Cumple el {b.label}</span>
                  </span>
                  <span className="w">{b.days === 0 ? "¡hoy!" : b.days === 1 ? "mañana" : `en ${b.days} días`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- vitrina
const MEDAL_ICON: Record<string, IconName> = { debut: "flag", goal: "ball", win: "star", pichichi: "crown", assist: "boot", record: "flame" };
export function ClubVitrina({ medals, seasonName }: { medals: ClubMedal[]; seasonName: string }) {
  const earned = medals.filter((m) => m.earned).length;
  return (
    <section className="hm-sec" aria-labelledby="hm-vit">
      <span className="hm-kick">
        La vitrina del club · {seasonName} · {earned} de {medals.length}
      </span>
      <h2 className="hm-h2" id="hm-vit">
        {earned ? (
          <>
            Lo que ya <em>es historia</em>
          </>
        ) : (
          <>
            Una vitrina <em>por estrenar</em>
          </>
        )}
      </h2>
      <ul className="hm-medals">
        {medals.map((m) => (
          <li key={m.id} className={`hm-medal${m.earned ? (m.tone === "sky" ? " sky" : "") : " off"}`}>
            <span className="m">
              <Icon name={MEDAL_ICON[m.id]} size={26} stroke={2} />
            </span>
            <span className="k">{m.kicker}</span>
            <b>{m.title}</b>
            <span>
              {m.detail}
              <span className="hm-sr">{m.earned ? " · conseguido" : " · pendiente"}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- calendario + equipaciones
function Game({ m, now, nameOf, hot }: { m: ClubMatch; now: number; nameOf: (id: string) => string; hot: boolean }) {
  const done = isCompleted(m);
  const r = done ? resultOf(m) : null;
  const scorers = done
    ? (m.events ?? [])
        .filter((e) => /^goal/.test(e.type) && e.playerId)
        .reduce((acc, e) => acc.set(e.playerId!, (acc.get(e.playerId!) ?? 0) + 1), new Map<string, number>())
    : null;
  const who = scorers?.size ? [...scorers.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => (n > 1 ? `${nameOf(id)} ×${n}` : nameOf(id))).join(" · ") : done ? "Sin goles del Piti" : dateMillis(m.date) > now ? formatDate(m.date, true) : "Resultado pendiente";
  return (
    <Link to="/matches/$matchId" params={{ matchId: m.id }} className={`hm-game${done ? " res" : ""}${hot ? " hot" : ""}`}>
      <span className="d">
        {formatDate(m.date)}
        {r && (
          <span className={`tag ${r}`} aria-label={RESULT_LABEL[r]}>
            {r}
          </span>
        )}
      </span>
      <div className="sc">
        <div className="vx-flap">
          <b>{done ? (m.goalsFor ?? 0) : "?"}</b>
        </div>
        <i>–</i>
        <div className="vx-flap them">
          <b>{done ? (m.goalsAgainst ?? 0) : "?"}</b>
        </div>
      </div>
      <b className="r">{m.rival ?? "Rival por anunciar"}</b>
      <small>{who}</small>
    </Link>
  );
}
export function CalendarAndKits({ pulse, now, nameOf, kit, onKit }: { pulse: Pulse; now: number; nameOf: (id: string) => string; kit: "home" | "away"; onKit: (k: "home" | "away") => void }) {
  const upcoming = pulse.upcoming.filter((m) => !isCompleted(m));
  const results = [...pulse.played].reverse();
  const games = [...upcoming, ...results];
  const pickKit = (k: "home" | "away") => {
    onKit(k);
    document.querySelector(".hm-poster")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  };
  const shirt = (
    <svg className="sh" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} aria-hidden="true">
      <path d={SHIRT} />
    </svg>
  );
  return (
    <section className="hm-sec" aria-labelledby="hm-fx">
      <div className="hm-row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <span className="hm-kick">Calendario</span>
          <h2 className="hm-h2" id="hm-fx">
            Jornada a jornada
          </h2>
        </div>
        <Link className="hm-link" to="/partidos">
          Todo el calendario <Icon name="arrow" size={15} stroke={2.2} />
        </Link>
      </div>
      <div className="hm-fx">
        {games.length === 0 && (
          <article className="hm-game next">
            <span className="d">Partido inaugural</span>
            <b>Fecha por confirmar</b>
            <span className="hm-link">El calendario se publica aquí</span>
          </article>
        )}
        {games.map((m) => (
          <Game key={m.id} m={m} now={now} nameOf={nameOf} hot={m.id === pulse.last?.id || m.id === pulse.live?.id} />
        ))}
      </div>
      <div className="hm-kits">
        <button type="button" className="hm-kitcard home" aria-pressed={kit === "home"} onClick={() => pickKit("home")}>
          {shirt}
          <span className="k">1ª equipación · pruébatela arriba</span>
          <b>Local</b>
        </button>
        <button type="button" className="hm-kitcard away" aria-pressed={kit === "away"} onClick={() => pickKit("away")}>
          {shirt}
          <span className="k">2ª equipación · pruébatela arriba</span>
          <b>Visitante</b>
        </button>
      </div>
    </section>
  );
}

// ---------- vestuario + patrocinadores
export function VestuarioBand({ theme }: { theme: "dark" | "light" }) {
  return (
    <section className="hm-vest" aria-labelledby="hm-vest">
      <div>
        <span className="k">Solo para la plantilla</span>
        <h2 id="hm-vest">Tu cartel te espera</h2>
        <p>Convocatoria, porra, entrenos, MVP y tablón del equipo, en tiempo real. Con tu nombre en la camiseta.</p>
        <ul>
          <li>Convocatoria</li>
          <li>Porra</li>
          <li>Entrenos</li>
          <li>MVP</li>
          <li>Tablón</li>
        </ul>
        <div className="hm-row">
          <Link className="hm-vest-cta" to="/vestuario">
            Entrar al vestuario
            <i>
              <Icon name="arrow" size={18} stroke={2.4} />
            </i>
          </Link>
        </div>
      </div>
      <img src={`/models/shirt-tu-nombre-${theme}.webp`} alt="" width={720} height={820} loading="lazy" />
    </section>
  );
}
export function Sponsors({ sponsors }: { sponsors: { name: string; url: string; logo: string }[] }) {
  if (!sponsors.length) return null;
  return (
    <section className="hm-sec" aria-labelledby="hm-spon">
      <span className="hm-kick">Nos apoyan</span>
      <h2 className="hm-h2" id="hm-spon" style={{ fontSize: 32 }}>
        Patrocinadores
      </h2>
      <div className="hm-sponsors">
        {sponsors.map((s) => (
          <a key={s.name} href={s.url} target="_blank" rel="noreferrer">
            {s.logo && <img src={s.logo} alt="" />}
            {s.name}
          </a>
        ))}
      </div>
    </section>
  );
}
