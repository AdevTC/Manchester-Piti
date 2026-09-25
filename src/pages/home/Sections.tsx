import { Link } from "@tanstack/react-router";
import { Icon } from "../../components/celeste/icons";
import { dateMillis, formatDate, isCompleted, type ClubMatch } from "../../lib/clubData";
import { resultOf, type PlayerLine, type Pulse, type Result } from "../../lib/home";
import { plural } from "../../lib/vestuario";

const RESULT_LABEL: Record<Result, string> = { G: "Victoria", E: "Empate", P: "Derrota" };
const MONTH = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", month: "short" });
const DAYN = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric" });
const HOUR = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });

function goalsOf(m: ClubMatch, nameOf: (id: string) => string) {
  return (m.events ?? [])
    .filter((e) => /^goal/.test(e.type) && e.playerId)
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
    .map((e) => ({ minute: e.minute, who: nameOf(e.playerId!), assist: e.assistPlayerId ? nameOf(e.assistPlayerId) : null }));
}

// ---------- la temporada: último partido · así va · lo que viene
export function SeasonRow({ pulse, now, nameOf }: { pulse: Pulse; now: number; nameOf: (id: string) => string }) {
  const last = pulse.last;
  const played = pulse.played.length;
  const form: (Result | null)[] = [...pulse.form, ...Array(5 - pulse.form.length).fill(null)];
  const upcoming = pulse.upcoming.filter((m) => !isCompleted(m) && m.id !== pulse.live?.id).slice(0, 3);
  const r = last ? resultOf(last) : null;
  return (
    <section className="hm-sec" aria-label="La temporada">
      <div className="hm-season">
        <div className="blk">
          <span className="hm-kick">El último partido</span>
          <h2 className="hm-h2">{last ? RESULT_LABEL[r!] + (r === "G" ? "" : " ante " + (last.rival ?? "el rival")) : "Todo por estrenar"}</h2>
          {last ? (
            <Link className="hm-last hm-card" to="/matches/$matchId" params={{ matchId: last.id }}>
              <span className="sc">
                <b>PITI</b>
                <span className={`n ${r}`}>
                  {last.goalsFor ?? 0}–{last.goalsAgainst ?? 0}
                </span>
                <b>{last.rival ?? "Rival"}</b>
              </span>
              <span className="d">{formatDate(last.date)}</span>
              {goalsOf(last, nameOf).length > 0 && (
                <ul>
                  {goalsOf(last, nameOf).map((g, i) => (
                    <li key={i}>
                      <b>{g.minute != null ? `${g.minute}′` : "Gol"}</b>
                      {g.who}
                      {g.assist && ` · asistencia de ${g.assist}`}
                    </li>
                  ))}
                </ul>
              )}
              <span className="hm-link">
                Crónica y acta <Icon name="arrow" size={15} stroke={2.2} />
              </span>
            </Link>
          ) : (
            <div className="hm-empty">
              <b>Aún no se ha jugado ninguno.</b>Aquí aparecerán el resultado y los goleadores en cuanto se cierre el acta.
            </div>
          )}
        </div>
        <div className="blk">
          <span className="hm-kick">Así va la temporada</span>
          <h2 className="hm-h2">{played ? `${plural(played, "partido", "partidos")}, ${plural(pulse.gf, "gol", "goles")}` : "Todo a cero"}</h2>
          <dl className="hm-stats">
            <div>
              <dt>Partidos</dt>
              <dd className={played ? undefined : "ph"}>{played}</dd>
            </div>
            <div>
              <dt>Goles</dt>
              <dd className={played ? "sky" : "ph"}>{pulse.gf}</dd>
            </div>
            <div>
              <dt>Victorias</dt>
              <dd className={played ? undefined : "ph"}>{pulse.wins}</dd>
            </div>
          </dl>
          <span className="hm-kick" style={{ margin: "6px 0 0" }}>
            Forma · últimos 5
          </span>
          <div className="hm-form" aria-label={pulse.form.length ? `Últimos partidos: ${pulse.form.map((x) => RESULT_LABEL[x].toLowerCase()).join(", ")}` : "Sin partidos todavía"}>
            {form.map((x, i) => (
              <i key={i} className={x ?? "q"} aria-hidden="true">
                {x ?? "?"}
              </i>
            ))}
          </div>
        </div>
        <div className="blk">
          <span className="hm-kick">Calendario</span>
          <h2 className="hm-h2">Lo que viene</h2>
          {upcoming.length ? (
            <ul className="hm-next">
              {upcoming.map((m) => {
                const at = dateMillis(m.date);
                return (
                  <li key={m.id}>
                    <Link to="/matches/$matchId" params={{ matchId: m.id }}>
                      <span className="d">
                        {at ? (
                          <>
                            <b>{DAYN.format(at)}</b>
                            <small>{MONTH.format(at).replace(".", "")}</small>
                          </>
                        ) : (
                          <b>?</b>
                        )}
                      </span>
                      <span>
                        <span className="r">vs {m.rival ?? "Rival por anunciar"}</span>
                        <span className="s">{[m.home === false ? "Fuera" : "En casa", m.venue].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="t">{at && at > now ? HOUR.format(at) : ""}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="hm-empty">
              <b>El calendario llega pronto.</b>Suscríbete arriba y cada partido entrará solo en tu calendario, con hora y campo.
            </div>
          )}
          <Link className="hm-link" to="/partidos">
            Todo el calendario <Icon name="arrow" size={15} stroke={2.2} />
          </Link>
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
