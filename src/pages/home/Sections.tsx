// The plantilla's «Pichichi y asistencias» podium and the next birthdays (Plantilla imports it; it was the old
// home's section, and its rules still live in styles/home.css).
import { PlayerLink } from "../../components/celeste/PlayerLink";
import type { PlayerLine } from "../../lib/home";
import { plural } from "../../lib/derived/words";
import { rankedLeaders, medalFor } from "../../lib/clubAnalytics";

// ---------- pichichi + cumpleaños
const SHIRT = "M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3a4 4 0 0 1-8 0Z";
function Pod({ line, rank, stat, shared, seasonId }: { line?: PlayerLine; rank: number; stat: string; shared?: boolean; seasonId?: string }) {
  const h = rank === 1 ? 112 : rank === 2 ? 74 : 54;
  return (
    <div className={`hm-pod ${medalFor(rank, line?.stats.goals ?? 0) ?? ""}${rank === 1 ? " first" : ""}${line ? "" : " ghost"}`}>
      <span className="j">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={SHIRT} fill="currentColor" />
        </svg>
        <b>{line?.num ?? "?"}</b>
      </span>
      <span className="nm">
        {line ? (
          <PlayerLink id={line.id} seasonId={seasonId} variant="quiet">
            {line.name}
          </PlayerLink>
        ) : (
          "Por decidir"
        )}
      </span>
      <span className="v">{stat}</span>
      <span className="st" style={{ height: h }} aria-label={`Puesto ${rank}${shared ? ", compartido" : ""}`}>
        {rank}
        {shared && <small>Compartido</small>}
      </span>
    </div>
  );
}
export function RaceAndBirthdays({ scorers, assisters = [], birthdays, seasonId }: { scorers: PlayerLine[]; assisters?: PlayerLine[]; birthdays: { id: string; name: string; num: string; label: string; days: number }[]; /** The season the names and links are in. */ seasonId?: string }) {
  const ranked = rankedLeaders(scorers, (p) => p.stats.goals);
  const podium: { item?: PlayerLine; rank: number; shared: boolean }[] = [...ranked];
  for (let rank = ranked.length + 1; rank <= 3; rank++) podium.push({ rank, shared: false });
  // Traditional steps when the three places are distinct; shared places stay together.
  const ordered = podium.length === 3 && podium.every((p, i) => p.rank === i + 1) ? [podium[1], podium[0], podium[2]] : podium;
  const first = ranked[0]?.item;
  const tiedFirst = ranked.filter((p) => p.rank === 1).length > 1;
  const stat = (l?: PlayerLine) => (l ? plural(l.stats.goals, "gol", "goles") : "0 goles");
  return (
    <section className="hm-sec" aria-labelledby="hm-race">
      <div className="hm-two">
        <div>
          <span className="hm-kick">Pichichi y asistencias</span>
          <h2 className="hm-h2" id="hm-race">
            {first ? (
              <>
                {tiedFirst ? "Pichichi compartido:" : `${first.name}, Pichichi:`} <em>{plural(first.stats.goals, "gol", "goles")}.</em>
              </>
            ) : (
              <>
                ¿Quién será <em>el primer Pichichi?</em>
              </>
            )}
          </h2>
          <div className="hm-race">
            {ordered.map(({item, rank, shared}) => <Pod key={item?.id ?? `empty-${rank}`} line={item} rank={rank} stat={stat(item)} shared={shared} seasonId={seasonId} />)}
          </div>
          <p className="hm-lede">
            {assisters.length ? (
              <>
                {assisters.map((p, i) => <span key={p.id}>{i > 0 ? i === assisters.length - 1 ? " y " : ", " : ""}<PlayerLink id={p.id} seasonId={seasonId} variant="quiet">{p.name}</PlayerLink></span>)}{" "}
                {assisters.length > 1 ? "comparten el liderato:" : "es quien más goles regala:"} {plural(assisters[0].stats.assists, "asistencia", "asistencias")}{assisters.length > 1 ? " cada uno" : ""}.
              </>
            ) : (
              "La tabla arranca en cero para todos y se actualiza sola con cada gol y cada asistencia del acta."
            )}
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
                    <b>
                      <PlayerLink id={b.id} seasonId={seasonId} variant="quiet">
                        {b.name}
                      </PlayerLink>
                    </b>
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
